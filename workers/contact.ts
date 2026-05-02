/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */

// Cloudflare Worker — forwards contact form messages to the maintainer inbox
// via Resend. No database; messages live only in the destination inbox.

export interface Env {
  RESEND_API_KEY?: string;
  NOTIFICATION_EMAIL: string;
  /** Comma-separated list of allowed origins (e.g., "https://docredact.in"). */
  ALLOWED_ORIGINS: string;
}

interface ContactPayload {
  email: string;
  message: string;
}

function pickAllowedOrigin(requestOrigin: string | null, env: Env): string | null {
  if (!requestOrigin) return null;
  const allowed = env.ALLOWED_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return allowed.includes(requestOrigin) ? requestOrigin : null;
}

function corsHeaders(origin: string | null): Record<string, string> {
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

function validate(body: Partial<ContactPayload>): string | null {
  if (!body.email || !EMAIL_RE.test(body.email)) return 'invalid_email';
  const m = body.message ?? '';
  if (m.trim().length < 10) return 'message_too_short';
  if (m.length > 5000) return 'message_too_long';
  return null;
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

    let body: Partial<ContactPayload>;
    try {
      body = (await request.json()) as Partial<ContactPayload>;
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

    const full = body as ContactPayload;
    if (env.RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'DocRedact Contact <noreply@docredact.in>',
          to: env.NOTIFICATION_EMAIL,
          reply_to: full.email,
          subject: 'New contact form message',
          text: full.message,
        }),
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 202,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  },
};
