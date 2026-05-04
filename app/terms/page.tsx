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
  title: 'Terms of Service — DocRedact.in',
  description: 'Best-effort tooling. No warranty. You verify the output before sharing.',
};

export default function TermsPage() {
  return (
    <TextPage title="Terms of Service" lastUpdated="2026-05-02">
      <p>
        DocRedact.in is a free, open-source, browser-based tool. By using it you
        agree to the following.
      </p>

      <h2>1. Best-effort detection</h2>
      <p>
        The tool runs automated detection (OCR, Verhoeff validation, face
        detection, QR decoding, MRZ regex) and is correct on most Indian ID
        documents most of the time. It is not correct on every document under
        every condition. Small fonts, rotated text, heavy glare, unusual
        layouts, and handwritten annotations can cause the tool to miss a
        region that should have been masked, or to mask a region that should
        not have been.
      </p>

      <h2>2. You are responsible for the output</h2>
      <p>
        Review each detection in the toggle list before downloading. Open the
        downloaded PDF in your PDF reader and verify that the regions you
        intended to mask are actually masked. The final responsibility for the
        output PDF rests with you, the user.
      </p>

      <h2>3. Not a legal substitute</h2>
      <p>
        DocRedact.in does not substitute for UIDAI-issued masked Aadhaar where a
        specific regulation requires that particular form. Where a regulator,
        employer, or counterparty asks specifically for a UIDAI-issued masked
        Aadhaar, use UIDAI&apos;s portal.
      </p>

      <h2>4. No warranty</h2>
      <p>
        The tool is provided &ldquo;as is&rdquo; without any warranty of
        merchantability, fitness for a particular purpose, or non-infringement.
        Use it at your own risk.
      </p>

      <h2>5. No liability</h2>
      <p>
        To the maximum extent permitted by law, the author of DocRedact.in is
        not liable for any direct, indirect, consequential, or incidental
        damages arising out of your use of the tool, including any loss
        resulting from disclosure of unmasked information in the output file.
      </p>

      <h2>6. Licence</h2>
      <p>
        The software is licensed under the{' '}
        <a
          href="https://www.gnu.org/licenses/agpl-3.0.html"
          rel="noopener noreferrer"
          target="_blank"
        >
          GNU Affero General Public License v3.0 or later
        </a>
        . Source code is available at{' '}
        <a
          href="https://github.com/shadab127/doc-redact-in"
          rel="noopener noreferrer"
          target="_blank"
        >
          github.com/shadab127/doc-redact-in
        </a>
        .
      </p>

      <h2>7. Output notice</h2>
      <p>
        The output file is an image-only PDF. No searchable text layer is
        present; therefore the masked regions cannot be recovered via
        copy-paste or text-extraction tools. The output is typically 2–5×
        larger than the input as a result.
      </p>
    </TextPage>
  );
}
