// GNU Affero General Public License v3.0 or later; Copyright (C) 2026 Shadab Khan. See LICENSE.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

interface RequestLike {
  url(): string;
  method(): string;
  postDataBuffer(): Buffer | null;
}

const ROUTES = ['/', '/manual/', '/mask-aadhaar-online/', '/how-it-works/', '/api-waitlist/', '/privacy/', '/terms/', '/contact/', '/redact-pan-card/', '/hide-aadhaar-number-pdf/'];
const ROUTE_PATHS = new Set(ROUTES.flatMap((route) => [route, route === '/' ? route : route.slice(0, -1), `${route}index.txt`]));

function collectFiles(directory: string, prefix: string, paths: Set<string>): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const url = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) collectFiles(join(directory, entry.name), url, paths);
    else if (entry.isFile()) paths.add(url);
  }
}

export function redactionAssetPaths(): ReadonlySet<string> {
  const paths = new Set<string>();
  if (process.env.E2E_PRODUCTION === '1') {
    collectFiles('out', '', paths);
  } else {
    collectFiles('public', '', paths);
    collectFiles('.next/static', '/_next/static', paths);
  }
  return new Set([...paths].filter((path) => /^\/(?:_next\/static\/|vendor\/|samples\/|schema\/)/.test(path)
    || ['/favicon.ico', '/icon.svg', '/og.png'].includes(path)));
}

export function isAllowedRedactionRequest(request: RequestLike, origin: string, assets: ReadonlySet<string>): boolean {
  let url: URL;
  try {
    url = new URL(request.url());
  } catch {
    return false;
  }
  if (url.protocol === 'blob:' || url.protocol === 'data:') return true;
  if (url.origin !== origin || request.method() !== 'GET' || request.postDataBuffer()?.length) return false;
  if (assets.has(url.pathname)) {
    return !url.search || (process.env.E2E_PRODUCTION !== '1' && url.pathname.startsWith('/_next/static/') && /^\?v=\d{1,13}$/.test(url.search));
  }
  return ROUTE_PATHS.has(url.pathname) && (!url.search || /^\?_rsc=[a-zA-Z0-9_-]{1,32}$/.test(url.search));
}
