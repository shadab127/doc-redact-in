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
import { UnsupportedBrowserGuard } from '@/src/ui/UnsupportedBrowserGuard';
import './globals.css';

export const metadata: Metadata = {
  title: 'DocRedact.in — Redact Aadhaar, PAN & passport in your browser',
  description:
    'Client-side, mobile-first redactor for Indian ID documents. Your browser processes the file. Nothing leaves your device.',
};

const CF_ANALYTICS_TOKEN = process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <UnsupportedBrowserGuard />
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
