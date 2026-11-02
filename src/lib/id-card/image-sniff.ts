/**
 * Reads an image's real type and pixel size from its bytes — the file
 * signature, not the browser-sent MIME type or the file name. Pure (works on
 * a Uint8Array), so it is unit-tested in scripts/test-id-cards.ts.
 */

export type SniffedImage = { type: "image/jpeg" | "image/png" | "image/webp"; width: number; height: number };

/** Byte at i, 0 past the end. */
function at(b: Uint8Array, i: number): number {
  return b[i] ?? 0;
}
function u16be(b: Uint8Array, o: number) {
  return (at(b, o) << 8) | at(b, o + 1);
}
function u32be(b: Uint8Array, o: number) {
  return ((at(b, o) << 24) >>> 0) + ((at(b, o + 1) << 16) | (at(b, o + 2) << 8) | at(b, o + 3));
}
function u16le(b: Uint8Array, o: number) {
  return at(b, o) | (at(b, o + 1) << 8);
}
function u24le(b: Uint8Array, o: number) {
  return at(b, o) | (at(b, o + 1) << 8) | (at(b, o + 2) << 16);
}

function png(b: Uint8Array): SniffedImage | null {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length < 24 || !sig.every((v, i) => at(b, i) === v)) return null;
  // First chunk must be IHDR.
  if (String.fromCharCode(at(b, 12), at(b, 13), at(b, 14), at(b, 15)) !== "IHDR") return null;
  return { type: "image/png", width: u32be(b, 16), height: u32be(b, 20) };
}

function jpeg(b: Uint8Array): SniffedImage | null {
  if (b.length < 4 || at(b, 0) !== 0xff || at(b, 1) !== 0xd8 || at(b, 2) !== 0xff) return null;
  let o = 2;
  while (o + 9 < b.length) {
    if (at(b, o) !== 0xff) {
      o++;
      continue;
    }
    const marker = at(b, o + 1);
    if (marker === 0xff) {
      o++;
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      o += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break; // end / start of scan before any frame header
    const len = u16be(b, o + 2);
    if (len < 2) return null;
    // SOF0..SOF15 except DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { type: "image/jpeg", height: u16be(b, o + 5), width: u16be(b, o + 7) };
    }
    o += 2 + len;
  }
  return null;
}

function webp(b: Uint8Array): SniffedImage | null {
  if (b.length < 30) return null;
  if (String.fromCharCode(at(b, 0), at(b, 1), at(b, 2), at(b, 3)) !== "RIFF" || String.fromCharCode(at(b, 8), at(b, 9), at(b, 10), at(b, 11)) !== "WEBP") return null;
  const chunk = String.fromCharCode(at(b, 12), at(b, 13), at(b, 14), at(b, 15));
  if (chunk === "VP8 ") {
    // Key frame start code 9d 01 2a, then 14-bit width / height.
    if (at(b, 23) !== 0x9d || at(b, 24) !== 0x01 || at(b, 25) !== 0x2a) return null;
    return { type: "image/webp", width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    if (at(b, 20) !== 0x2f) return null;
    const bits = at(b, 21) | (at(b, 22) << 8) | (at(b, 23) << 16) | (at(b, 24) << 24);
    return { type: "image/webp", width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") {
    return { type: "image/webp", width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  }
  return null;
}

export function sniffImage(bytes: Uint8Array): SniffedImage | null {
  return png(bytes) ?? jpeg(bytes) ?? webp(bytes);
}

export const PHOTO_RULES = {
  maxBytes: 3 * 1024 * 1024,
  minWidth: 240,
  minHeight: 300,
  maxSide: 8000,
} as const;

/** Why an uploaded photo can't be used, or null when it can. */
export function photoProblem(img: SniffedImage | null, sizeBytes: number): string | null {
  if (sizeBytes > PHOTO_RULES.maxBytes) return "Image is too large — please keep it under 3MB.";
  if (!img) return "This file is not a valid JPG, PNG or WEBP image.";
  if (img.width > PHOTO_RULES.maxSide || img.height > PHOTO_RULES.maxSide) return "Image dimensions are too large.";
  if (img.width < PHOTO_RULES.minWidth || img.height < PHOTO_RULES.minHeight) {
    return `Photo is too small (${img.width}×${img.height}). Please use a clearer photo, at least ${PHOTO_RULES.minWidth}×${PHOTO_RULES.minHeight} pixels.`;
  }
  return null;
}
