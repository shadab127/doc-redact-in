/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Footer } from '@/src/ui/Footer';
import { Header } from '@/src/ui/Header';
import { UnsupportedBrowserGuard } from '@/src/ui/UnsupportedBrowserGuard';
import './globals.css';

export const metadata: Metadata = {
  title: 'DocRedact.in — Redact Aadhaar, PAN & passport in your browser',
  description:
    'Client-side, mobile-first redactor for Indian ID documents. Your browser processes the file. Nothing leaves your device.',
  metadataBase: new URL('https://docredact.in'),
  openGraph: {
    type: 'website',
    siteName: 'DocRedact.in',
    images: [{ url: '/og.png', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', images: ['/og.png'] },
};

const CF_ANALYTICS_TOKEN = process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN;

// Runs before first paint. Reads the persisted preference (or system setting)
// and applies data-theme to <html> synchronously so the initial paint uses
// the right palette. Without this, users reloading with dark mode saved would
// see a brief flash of the light theme while React hydrates.
const THEME_INIT_SCRIPT = `
(function(){try{
  var s = localStorage.getItem('docredact-theme');
  if (s === 'dark' || s === 'light') {
    document.documentElement.setAttribute('data-theme', s);
    return;
  }
  var m = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  document.documentElement.setAttribute('data-theme', m && m.matches ? 'dark' : 'light');
}catch(e){}})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <UnsupportedBrowserGuard />
        <Header />
        {children}
        <Footer />
        {CF_ANALYTICS_TOKEN && (
          <script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={`{"token":"${CF_ANALYTICS_TOKEN}"}`}
          />
        )}
      </body>
    </html>
  );
}
