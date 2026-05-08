/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import Link from 'next/link';
import { MobileMenu } from './MobileMenu';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-header-brand">
          DocRedact.in
        </Link>
        <nav className="site-header-nav">
          <Link href="/how-it-works">How it works</Link>
          <Link href="/mask-aadhaar-online">Mask Aadhaar</Link>
          <Link href="/api-waitlist">API (coming soon)</Link>
          <a
            href="https://github.com/shadab127/doc-redact-in"
            rel="noopener noreferrer"
            target="_blank"
          >
            GitHub ↗
          </a>
        </nav>
        <ThemeToggle />
        <Link href="/#redactor" className="site-header-cta">
          Try it now
        </Link>
        <MobileMenu />
      </div>
    </header>
  );
}
