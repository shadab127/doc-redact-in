# Test fixtures

**Policy (from RFC §11):** fixtures in this folder must be **synthetic** — never real Aadhaar / PAN / passport data, even your own.

- Synthetic digit strings generated via `verhoeffCheckDigit` are fine.
- Hand-drawn PNGs with fake numbers are fine.
- Real IDs (yours, family, anyone's) are **never** committed here, even redacted.
- Image fixtures are not yet needed in W1 — detection unit tests use hand-built OCR token arrays, so we do not exercise Tesseract in CI.

Add image fixtures only when Validation Gate #1 (real-world OCR accuracy spike) runs as a separate benchmark outside CI.
