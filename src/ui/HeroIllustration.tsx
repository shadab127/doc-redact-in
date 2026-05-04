/*
 * DocRedact.in — Client-side Indian ID document redactor
 * Copyright (C) 2026 Shadab Khan
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE file in the project root for full text.
 */

// Inline SVG illustration. Inlined (not loaded via <img src>) so its fills
// can resolve CSS custom properties from the page's current theme — this is
// how the before/after cards flip colors when the user toggles light/dark.

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";

export function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 320 390"
      width="320"
      height="390"
      role="img"
      aria-label="Before and after illustration: an ID card with the face photo, ID number, and QR replaced by black redaction bars"
      style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
    >
      <defs>
        <linearGradient id="hi-card-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--hi-card-top, var(--bg-elev))" />
          <stop offset="100%" stopColor="var(--hi-card-bot, var(--bg-elev))" />
        </linearGradient>
      </defs>

      {/* ============== BEFORE ============== */}
      <text
        x="20"
        y="18"
        fontFamily={FONT}
        fontSize="11"
        fontWeight="600"
        fill="var(--muted)"
        letterSpacing="1.4"
      >
        BEFORE
      </text>

      {/* Card 1 */}
      <rect
        x="20"
        y="26"
        width="280"
        height="160"
        rx="14"
        ry="14"
        fill="url(#hi-card-bg)"
        stroke="var(--border-strong)"
        strokeWidth="1"
      />

      {/* Card header strip */}
      <rect
        x="20"
        y="26"
        width="280"
        height="30"
        rx="14"
        ry="14"
        fill="var(--hi-header-bg, var(--surface-subtle))"
      />
      <rect
        x="20"
        y="46"
        width="280"
        height="10"
        fill="var(--hi-header-bg, var(--surface-subtle))"
      />
      <text
        x="36"
        y="45"
        fontFamily={FONT}
        fontSize="10"
        fontWeight="700"
        fill="var(--muted)"
        letterSpacing="1.2"
      >
        GOVERNMENT ID
      </text>

      {/* Face silhouette */}
      <circle cx="62" cy="104" r="22" fill="var(--hi-face-bg, var(--border))" />
      <ellipse cx="62" cy="134" rx="18" ry="10" fill="var(--hi-face-bg, var(--border))" />
      <circle cx="55" cy="101" r="2.3" fill="var(--muted)" />
      <circle cx="69" cy="101" r="2.3" fill="var(--muted)" />
      <path
        d="M56 110 Q62 115 68 110"
        stroke="var(--muted)"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />

      {/* Labels */}
      <text x="96" y="84" fontFamily={FONT} fontSize="9" fill="var(--muted)">
        Name
      </text>
      <text
        x="96"
        y="99"
        fontFamily={FONT}
        fontSize="12"
        fontWeight="600"
        fill="var(--fg)"
      >
        Lorem Ipsum
      </text>

      <text x="96" y="116" fontFamily={FONT} fontSize="9" fill="var(--muted)">
        Date of Birth
      </text>
      <text
        x="96"
        y="131"
        fontFamily={FONT}
        fontSize="12"
        fontWeight="600"
        fill="var(--fg)"
      >
        01/01/1990
      </text>

      <text x="96" y="148" fontFamily={FONT} fontSize="9" fill="var(--muted)">
        ID Number
      </text>
      <text
        x="96"
        y="164"
        fontFamily={FONT}
        fontSize="13"
        fontWeight="700"
        fill="var(--fg)"
        letterSpacing="2"
      >
        1234 5678 9012
      </text>

      {/* QR placeholder */}
      <rect
        x="243"
        y="92"
        width="44"
        height="44"
        rx="4"
        fill="var(--hi-qr-bg, var(--border))"
      />
      <rect x="248" y="97" width="11" height="11" rx="1" fill="var(--muted)" />
      <rect x="264" y="97" width="11" height="11" rx="1" fill="var(--muted)" />
      <rect x="248" y="113" width="11" height="11" rx="1" fill="var(--muted)" />
      <rect x="264" y="113" width="5" height="5" fill="var(--muted)" />
      <rect x="271" y="113" width="5" height="5" fill="var(--muted)" />
      <rect x="264" y="120" width="5" height="5" fill="var(--muted)" />
      <rect x="271" y="120" width="5" height="5" fill="var(--muted)" />

      {/* ============== Arrow + caption ============== */}
      <text
        x="160"
        y="203"
        textAnchor="middle"
        fontFamily={FONT}
        fontSize="11"
        fontWeight="600"
        fill="var(--brand)"
      >
        Auto-detect &amp; redact
      </text>
      <g transform="translate(160,217)">
        <path
          d="M0 -8 L0 6 M-6 0 L0 6 L6 0"
          stroke="var(--brand)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* ============== AFTER ============== */}
      <text
        x="20"
        y="236"
        fontFamily={FONT}
        fontSize="11"
        fontWeight="600"
        fill="var(--muted)"
        letterSpacing="1.4"
      >
        AFTER
      </text>

      {/* Card 2 */}
      <rect
        x="20"
        y="244"
        width="280"
        height="130"
        rx="14"
        ry="14"
        fill="url(#hi-card-bg)"
        stroke="var(--brand)"
        strokeOpacity="0.35"
        strokeWidth="1"
      />

      {/* Card header strip */}
      <rect
        x="20"
        y="244"
        width="280"
        height="30"
        rx="14"
        ry="14"
        fill="var(--hi-header-bg, var(--surface-subtle))"
      />
      <rect
        x="20"
        y="264"
        width="280"
        height="10"
        fill="var(--hi-header-bg, var(--surface-subtle))"
      />
      <text
        x="36"
        y="263"
        fontFamily={FONT}
        fontSize="10"
        fontWeight="700"
        fill="var(--muted)"
        letterSpacing="1.2"
      >
        GOVERNMENT ID
      </text>

      {/* Redacted face */}
      <rect x="40" y="286" width="44" height="52" rx="4" fill="#111" />
      <text x="62" y="314" textAnchor="middle" fontFamily={FONT} fontSize="8" fill="#666">
        FACE
      </text>

      {/* Name kept */}
      <text x="96" y="300" fontFamily={FONT} fontSize="9" fill="var(--muted)">
        Name
      </text>
      <text
        x="96"
        y="315"
        fontFamily={FONT}
        fontSize="12"
        fontWeight="600"
        fill="var(--fg)"
      >
        Lorem Ipsum
      </text>

      {/* DOB kept */}
      <text x="96" y="330" fontFamily={FONT} fontSize="9" fill="var(--muted)">
        Date of Birth
      </text>
      <text
        x="96"
        y="345"
        fontFamily={FONT}
        fontSize="12"
        fontWeight="600"
        fill="var(--fg)"
      >
        01/01/1990
      </text>

      {/* Masked ID number using the UIDAI first-8-masked convention */}
      <text
        x="96"
        y="362"
        fontFamily={FONT}
        fontSize="13"
        fontWeight="700"
        fill="var(--fg)"
        letterSpacing="2"
      >
        <tspan fill="#111">XXXX XXXX</tspan> 9012
      </text>

      {/* Redacted QR */}
      <rect x="243" y="286" width="44" height="44" rx="4" fill="#111" />
      <text x="265" y="312" textAnchor="middle" fontFamily={FONT} fontSize="8" fill="#666">
        QR
      </text>

      {/* Bottom caption */}
      <text
        x="20"
        y="386"
        fontFamily={FONT}
        fontSize="10"
        fill="var(--muted)"
      >
        Synthetic example. No real PII shown.
      </text>
    </svg>
  );
}
