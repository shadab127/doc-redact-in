/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */

// Cloudflare Worker — stores B2B API waitlist submissions in Workers KV and
// forwards a notification email via Resend. Deployed separately from the
// static Pages site; wire the route in wrangler.toml post-domain-registration.

export interface Env {
  WAITLIST_KV: KVNamespace;
  RESEND_API_KEY?: string;
  NOTIFICATION_EMAIL: string;
  /** Comma-separated list of allowed origins (e.g., "https://docredact.in"). */
  ALLOWED_ORIGINS: string;
}

interface WaitlistPayload {
  email: string;
  company: string;
  useCase: string;
}

function pickAllowedOrigin(requestOrigin: string | null, env: Env): string | null {
  if (!requestOrigin) return null;
  const allowed = env.ALLOWED_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return allowed.includes(requestOrigin) ? requestOrigin : null;
}

function corsHeaders(origin: string | null): Record<string, string> {
  // If the origin is not allowlisted we omit the CORS headers entirely; the
  // browser will reject the response because the matching preflight failed.
  if (!origin) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(body: Partial<WaitlistPayload>): string | null {
  if (!body.email || !EMAIL_RE.test(body.email)) return 'invalid_email';
  if (!body.company || body.company.trim().length < 2) return 'invalid_company';
  if (!body.useCase || body.useCase.trim().length === 0) return 'invalid_use_case';
  return null;
}

async function sendNotification(env: Env, payload: WaitlistPayload): Promise<void> {
  if (!env.RESEND_API_KEY) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'DocRedact Waitlist <noreply@docredact.in>',
      to: env.NOTIFICATION_EMAIL,
      subject: `New waitlist signup: ${payload.company}`,
      text: `Email: ${payload.email}\nCompany: ${payload.company}\nUse case: ${payload.useCase}`,
    }),
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = pickAllowedOrigin(request.headers.get('Origin'), env);
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }
    if (request.method !== 'POST') {
      return new Response('method not allowed', { status: 405 });
    }

    let body: Partial<WaitlistPayload>;
    try {
      body = (await request.json()) as Partial<WaitlistPayload>;
    } catch {
      return new Response(JSON.stringify({ error: 'invalid_json' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    const err = validate(body);
    if (err) {
      return new Response(JSON.stringify({ error: err }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    const full = body as WaitlistPayload;
    const id = crypto.randomUUID();
    await env.WAITLIST_KV.put(
      id,
      JSON.stringify({ ...full, receivedAt: new Date().toISOString() })
    );
    await sendNotification(env, full);

    return new Response(JSON.stringify({ ok: true }), {
      status: 202,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  },
};

interface KVNamespace {
  put(key: string, value: string): Promise<void>;
}
