/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

type NavLink = { href: string; label: string; external?: boolean };

const NAV_LINKS: NavLink[] = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/mask-aadhaar-online', label: 'Mask Aadhaar' },
  { href: '/api-waitlist', label: 'API (coming soon)' },
  { href: 'https://github.com/shadab127/doc-redact-in', label: 'GitHub ↗', external: true },
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    function onOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function onResize() {
      if (window.innerWidth >= 768) setOpen(false);
    }

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onOutside);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onOutside);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="mobile-menu-root">
      <button
        type="button"
        className="mobile-menu-toggle"
        aria-label="Toggle navigation"
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="4" y1="4" x2="16" y2="16" />
            <line x1="16" y1="4" x2="4" y2="16" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="3" y1="6" x2="17" y2="6" />
            <line x1="3" y1="10" x2="17" y2="10" />
            <line x1="3" y1="14" x2="17" y2="14" />
          </svg>
        )}
      </button>

      <nav
        id="mobile-nav"
        className={`mobile-nav${open ? ' mobile-nav--open' : ''}`}
        aria-label="Mobile navigation"
      >
        {NAV_LINKS.map(({ href, label, external }) =>
          external ? (
            <a
              key={href}
              href={href}
              rel="noopener noreferrer"
              target="_blank"
              className="mobile-nav-link"
              onClick={() => setOpen(false)}
            >
              {label}
            </a>
          ) : (
            <Link
              key={href}
              href={href}
              className="mobile-nav-link"
              onClick={() => setOpen(false)}
            >
              {label}
            </Link>
          )
        )}
        <Link href="/#redactor" className="mobile-nav-cta" onClick={() => setOpen(false)}>
          Try it now
        </Link>
      </nav>
    </div>
  );
}
