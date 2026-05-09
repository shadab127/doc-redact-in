#!/usr/bin/env python3
"""
Faithful Python port of ImagePreprocessor.ts preprocessForOCR() pipeline:
  1. toGrayscale (BT.601) — PIL convert('L') uses BT.601 weights
  2. gaussianBlur3x3 (sigma~0.5) — PIL GaussianBlur(radius=0.5)
  3. applyClaheGlobal (clipLimit=0.01) — pure Python histogram manipulation
  No Otsu (applyOtsu defaults to false in preprocessForOCR)

Usage: python3 preprocess_image.py <input_path> <output_path.png>
Exits 0 on success, 1 on error. Prints "OK WxH" on success.
"""
import sys
from PIL import Image, ImageFilter


def apply_clahe_global(blurred_img, clip_limit=0.01):
    """
    Faithful port of applyClaheGlobal() from ImagePreprocessor.ts.
    Operates on a grayscale PIL Image.
    """
    px = list(blurred_img.getdata())
    count = len(px)
    clip = max(1, int(count * clip_limit))

    hist = [0] * 256
    for v in px:
        hist[v] += 1

    excess = 0
    for v in range(256):
        if hist[v] > clip:
            excess += hist[v] - clip
            hist[v] = clip

    add = excess // 256
    for v in range(256):
        hist[v] += add

    cdf = [0] * 256
    cdf[0] = hist[0]
    for v in range(1, 256):
        cdf[v] = cdf[v - 1] + hist[v]

    cdf_min = next((c for c in cdf if c > 0), 0)
    denom = count - cdf_min or 1

    lut = bytes([max(0, min(255, round(((cdf[v] - cdf_min) / denom) * 255)))
                 for v in range(256)])

    out_px = bytes([lut[v] for v in px])
    return Image.frombytes('L', blurred_img.size, out_px)


def main():
    if len(sys.argv) != 3:
        print("Usage: preprocess_image.py <input> <output.png>", file=sys.stderr)
        sys.exit(1)

    inp, out = sys.argv[1], sys.argv[2]

    try:
        img = Image.open(inp).convert('RGB')
    except Exception as e:
        print(f"ERROR opening {inp}: {e}", file=sys.stderr)
        sys.exit(1)

    width, height = img.size

    # Step 1: BT.601 grayscale (PIL convert('L') is BT.601)
    gray = img.convert('L')

    # Step 2: Gaussian blur 3x3 (radius 0.5 ~ sigma 0.5, approximates the 3x3 kernel)
    blurred = gray.filter(ImageFilter.GaussianBlur(radius=0.5))

    # Step 3: Global CLAHE (clipLimit=0.01)
    result = apply_clahe_global(blurred, clip_limit=0.01)

    result.save(out, format='PNG')
    print(f"OK {width}x{height} -> {out}")


if __name__ == '__main__':
    main()
