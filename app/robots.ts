/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import type { MetadataRoute } from 'next';

const SITE = 'https://docredact.in';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/unsupported-browser'] }],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
