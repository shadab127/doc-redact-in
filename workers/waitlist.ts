// GNU Affero General Public License v3.0 or later; Copyright (C) 2026 Shadab Khan. See LICENSE.
import { WAITLIST_LIMITS, WAITLIST_USE_CASES, validateWaitlist, type WaitlistPayload } from '../src/ui/forms';

export interface Env {
  WAITLIST_KV: { put(key: string, value: string, options: { expirationTtl: number }): Promise<void> };
  WAITLIST_RATE_LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> };
  WAITLIST_RETENTION_SECONDS: string;
  RESEND_API_KEY?: string;
  NOTIFICATION_EMAIL: string;
  ALLOWED_ORIGINS: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

function allowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get('Origin');
  return origin && env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).includes(origin) ? origin : null;
}

function corsHeaders(origin: string | null): Record<string, string> {
  return origin ? {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  } : { Vary: 'Origin' };
}

function response(status: number, body: Record<string, unknown>, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...corsHeaders(origin) },
  });
}

async function readBody(request: Request): Promise<unknown> {
  if (!request.body) throw new Error('invalid_json');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > WAITLIST_LIMITS.bodyBytes) {
        await reader.cancel();
        throw new Error('body_too_large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

function parsePayload(body: unknown): WaitlistPayload | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const value = body as Record<string, unknown>;
  if (Object.keys(value).length !== 3 || Object.keys(value).some((k) => !['email', 'company', 'useCase'].includes(k))) return null;
  if (typeof value.email !== 'string' || typeof value.company !== 'string' || typeof value.useCase !== 'string') return null;
  if (!WAITLIST_USE_CASES.includes(value.useCase as WaitlistPayload['useCase'])) return null;
  const payload: WaitlistPayload = {
    email: value.email.trim(),
    company: value.company.trim(),
    useCase: value.useCase as WaitlistPayload['useCase'],
  };
  return validateWaitlist(payload) ? null : payload;
}

async function sendNotification(env: Env): Promise<void> {
  if (!env.RESEND_API_KEY) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'DocRedact Waitlist <noreply@docredact.in>',
      to: env.NOTIFICATION_EMAIL,
      subject: 'New waitlist signup',
      text: 'A new signup is available in the Cloudflare KV waitlist. Submitted details are not included in this notification.',
    }),
  });
}

export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const origin = allowedOrigin(request, env);
    if (!origin) return response(403, { error: 'origin_not_allowed' }, null);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (request.method !== 'POST') return response(405, { error: 'method_not_allowed' }, origin);
    if (request.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
      return response(415, { error: 'unsupported_content_type' }, origin);
    }
    const ttl = Number(env.WAITLIST_RETENTION_SECONDS);
    const ip = request.headers.get('CF-Connecting-IP');
    if (!ip || !Number.isInteger(ttl) || ttl < 60 || ttl > 31_536_000 || !env.WAITLIST_RATE_LIMITER) {
      return response(503, { error: 'temporarily_unavailable' }, origin);
    }
    try {
      const { success } = await env.WAITLIST_RATE_LIMITER.limit({ key: `waitlist:${ip}` });
      if (!success) return response(429, { error: 'too_many_requests' }, origin);
    } catch {
      return response(503, { error: 'temporarily_unavailable' }, origin);
    }
    const declaredLength = Number(request.headers.get('Content-Length') ?? 0);
    if (declaredLength > WAITLIST_LIMITS.bodyBytes) return response(413, { error: 'body_too_large' }, origin);
    let body: unknown;
    try {
      body = await readBody(request);
    } catch (error) {
      const tooLarge = error instanceof Error && error.message === 'body_too_large';
      return response(tooLarge ? 413 : 400, { error: tooLarge ? 'body_too_large' : 'invalid_json' }, origin);
    }
    const payload = parsePayload(body);
    if (!payload) return response(400, { error: 'invalid_payload' }, origin);
    try {
      await env.WAITLIST_KV.put(crypto.randomUUID(), JSON.stringify({
        email: payload.email,
        company: payload.company,
        useCase: payload.useCase,
        receivedAt: new Date().toISOString(),
      }), { expirationTtl: ttl });
    } catch {
      return response(503, { error: 'temporarily_unavailable' }, origin);
    }
    const notification = sendNotification(env).catch(() => undefined);
    if (ctx) ctx.waitUntil(notification);
    else await notification;
    return response(202, { ok: true }, origin);
  },
};
