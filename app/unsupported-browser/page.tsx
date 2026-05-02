/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */
import type { Metadata } from 'next';
import { TextPage } from '@/src/ui/TextPage';

export const metadata: Metadata = {
  title: 'Unsupported browser — DocRedact.in',
};

export default function UnsupportedBrowserPage() {
  return (
    <TextPage title="Your browser cannot run DocRedact.in">
      <p>
        DocRedact.in needs WebAssembly and modern Canvas APIs to redact
        documents locally on your device. It looks like your browser does not
        support these, or they are disabled.
      </p>
      <p>
        Please try one of the following modern browsers:
      </p>
      <ul>
        <li>Chrome (Android or desktop), version 2023 or later</li>
        <li>Safari (iOS or macOS), version 2023 or later</li>
        <li>Firefox, version 2023 or later</li>
        <li>Samsung Internet, version 2023 or later</li>
        <li>Microsoft Edge, version 2023 or later</li>
      </ul>
      <p>
        We deliberately do not support older WebAssembly-incapable browsers
        (UC Browser, Opera Mini, very old Android webviews) because the whole
        tool runs locally on your device — it cannot fall back to
        server-side processing, because there is no server-side.
      </p>
    </TextPage>
  );
}
