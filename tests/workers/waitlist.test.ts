// GNU Affero General Public License v3.0 or later; Copyright (C) 2026 Shadab Khan. See LICENSE.
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker, { type Env } from '../../workers/waitlist';

const payload = { email: 'synthetic@example.test', company: 'Synthetic Co', useCase: 'HR / payroll' };

function fixture() {
  const put = vi.fn(async () => {});
  const limit = vi.fn(async () => ({ success: true }));
  const env: Env = {
    ALLOWED_ORIGINS: 'https://docredact.in,https://www.docredact.in',
    WAITLIST_RETENTION_SECONDS: '7776000',
    WAITLIST_KV: { put }, WAITLIST_RATE_LIMITER: { limit }, NOTIFICATION_EMAIL: 'owner@example.test',
  };
  return { env, put, limit };
}

function request(body: unknown = payload, headers: Record<string, string> = {}, method = 'POST') {
  return new Request('https://docredact.in/api/waitlist', {
    method,
    headers: { Origin: 'https://docredact.in', 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1', ...headers },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('waitlist security', () => {
  it('stores only normalized approved fields with configured expiration', async () => {
    const { env, put, limit } = fixture();
    const result = await worker.fetch(request({ ...payload, email: ` ${payload.email} `, company: ` ${payload.company} ` }), env);
    expect(result.status).toBe(202);
    expect(result.headers.get('Cache-Control')).toBe('no-store');
    expect(limit).toHaveBeenCalledWith({ key: 'waitlist:192.0.2.1' });
    const [key, value, options] = put.mock.calls[0]! as unknown as [string, string, { expirationTtl: number }];
    expect(key).toMatch(/^[a-f0-9-]{36}$/);
    const stored = JSON.parse(value);
    expect(stored).toEqual({ ...payload, receivedAt: expect.any(String) });
    expect(options).toEqual({ expirationTtl: 7776000 });
  });

  it.each(['https://untrusted.example', 'null', ''])('rejects unapproved or absent origins: %s', async (origin) => {
    const { env, put, limit } = fixture();
    expect((await worker.fetch(request(payload, { Origin: origin }), env)).status).toBe(403);
    expect(put).not.toHaveBeenCalled();
    expect(limit).not.toHaveBeenCalled();
  });

  it('supports allowed preflight without creating entries', async () => {
    const { env, put } = fixture();
    const result = await worker.fetch(request(undefined, {}, 'OPTIONS'), env);
    expect(result.status).toBe(204);
    expect(result.headers.get('Access-Control-Allow-Origin')).toBe('https://docredact.in');
    expect(put).not.toHaveBeenCalled();
  });

  it.each([
    null, [], 123, {}, { ...payload, extra: 'unexpected' },
    { ...payload, company: 123 }, { ...payload, email: ['invalid'] },
    { ...payload, useCase: 'unapproved' }, { ...payload, company: 'x'.repeat(201) },
    { ...payload, email: 'x'.repeat(254) + '@example.test' },
  ])('rejects invalid JSON shapes and fields without throwing', async (body) => {
    const { env, put } = fixture();
    expect((await worker.fetch(request(body), env)).status).toBe(400);
    expect(put).not.toHaveBeenCalled();
  });

  it('bounds actual streamed bodies even without Content-Length', async () => {
    const { env, put } = fixture();
    expect((await worker.fetch(request({ ...payload, company: 'x'.repeat(5000) }), env)).status).toBe(413);
    expect(put).not.toHaveBeenCalled();
  });

  it('rejects declared oversized bodies and non-JSON requests', async () => {
    const { env } = fixture();
    expect((await worker.fetch(request(payload, { 'Content-Length': '5000' }), env)).status).toBe(413);
    expect((await worker.fetch(request(payload, { 'Content-Type': 'text/plain' }), env)).status).toBe(415);
    expect((await worker.fetch(request(undefined, {}, 'GET'), env)).status).toBe(405);
  });

  it('rejects malformed JSON', async () => {
    const { env } = fixture();
    const bad = new Request(request(), { body: '{' });
    expect((await worker.fetch(bad, env)).status).toBe(400);
  });

  it('rate limits before creating entries or notifications', async () => {
    const { env, put, limit } = fixture();
    limit.mockResolvedValue({ success: false });
    expect((await worker.fetch(request(), env)).status).toBe(429);
    expect(put).not.toHaveBeenCalled();
  });

  it('fails closed when rate limiting or retention configuration is unavailable', async () => {
    const { env, put, limit } = fixture();
    limit.mockRejectedValue(new Error('unavailable'));
    expect((await worker.fetch(request(), env)).status).toBe(503);
    limit.mockResolvedValue({ success: true });
    env.WAITLIST_RETENTION_SECONDS = 'invalid';
    expect((await worker.fetch(request(), env)).status).toBe(503);
    env.WAITLIST_RETENTION_SECONDS = '7776000';
    expect((await worker.fetch(request(payload, { 'CF-Connecting-IP': '' }), env)).status).toBe(503);
    expect(put).not.toHaveBeenCalled();
  });

  it('returns a generic unavailable response when storage fails', async () => {
    const { env, put } = fixture();
    put.mockRejectedValue(new Error('private backend details'));
    const result = await worker.fetch(request(), env);
    expect(result.status).toBe(503);
    expect(await result.json()).toEqual({ error: 'temporarily_unavailable' });
  });

  it('does not forward submitted personal information to notification email providers', async () => {
    const { env } = fixture();
    env.RESEND_API_KEY = 'synthetic-test-key';
    const fetcher = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetcher);
    expect((await worker.fetch(request(), env)).status).toBe(202);
    const [, options] = fetcher.mock.calls[0]! as unknown as [string, RequestInit];
    const notice = String(options.body);
    for (const value of Object.values(payload)) expect(notice).not.toContain(value);
  });
});
