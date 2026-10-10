// GNU Affero General Public License v3.0 or later; Copyright (C) 2026 Shadab Khan. See LICENSE.
interface RequestLike {
  url(): string;
  method(): string;
  postDataBuffer(): Buffer | null;
}

const ROUTES = new Set(['/', '/manual/', '/mask-aadhaar-online/', '/how-it-works/', '/api-waitlist/', '/privacy/', '/terms/', '/contact/', '/redact-pan-card/', '/hide-aadhaar-number-pdf/']);

export function isAllowedRedactionRequest(request: RequestLike, origin: string): boolean {
  const url = new URL(request.url());
  if (url.protocol === 'blob:' || url.protocol === 'data:') return true;
  if (url.origin !== origin || request.method() !== 'GET' || request.postDataBuffer()?.length) return false;
  const staticAsset = /^\/(?:_next\/static\/|vendor\/|samples\/|schema\/)/.test(url.pathname)
    || ['/favicon.ico', '/icon.svg', '/og.png'].includes(url.pathname);
  if (staticAsset) return !url.search || (url.pathname.startsWith('/_next/static/') && /^\?v=\d+$/.test(url.search));
  const route = url.pathname.replace(/(?:index\.txt|\.txt)$/, '').replace(/\/?$/, '/');
  return ROUTES.has(route) && (!url.search || /^\?_rsc=[a-zA-Z0-9]+$/.test(url.search));
}
