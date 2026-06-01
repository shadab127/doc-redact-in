/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import type { MetadataRoute } from 'next';

const SITE = 'https://docredact.in';
const LAST_MODIFIED = new Date('2026-05-02');

export default function sitemap(): MetadataRoute.Sitemap {
  const paths: { url: string; priority: number }[] = [
    { url: '/', priority: 0.9 },
    { url: '/mask-aadhaar-online', priority: 1.0 },
    { url: '/redact-pan-card', priority: 0.9 },
    { url: '/hide-aadhaar-number-pdf', priority: 0.9 },
    { url: '/how-it-works', priority: 0.8 },
    { url: '/privacy', priority: 0.6 },
    { url: '/terms', priority: 0.5 },
    { url: '/api-waitlist', priority: 0.7 },
    { url: '/contact', priority: 0.6 },
  ];
  return paths.map(({ url, priority }) => ({
    url: `${SITE}${url}`,
    lastModified: LAST_MODIFIED,
    changeFrequency: 'monthly' as const,
    priority,
  }));
}
