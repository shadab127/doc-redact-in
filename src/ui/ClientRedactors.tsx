// GNU Affero General Public License v3.0 or later; Copyright (C) 2026 Shadab Khan. See LICENSE.
'use client';

import dynamic from 'next/dynamic';

export const RedactorApp = dynamic(
  () => import('./RedactorApp').then((m) => m.RedactorApp),
  { ssr: false }
);

export const ManualRedactApp = dynamic(
  () => import('./manual/ManualRedactApp').then((m) => m.ManualRedactApp),
  { ssr: false }
);
