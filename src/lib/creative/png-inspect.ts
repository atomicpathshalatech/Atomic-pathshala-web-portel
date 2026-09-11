import "server-only";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface PngInfo {
  isPng: boolean;
  width: number;
  height: number;
  /** True for color type 4/6 (explicit alpha channel), or a palette (type 3)
   * image that carries a tRNS transparency chunk. */
  hasAlpha: boolean;
}

/**
 * Reads just the PNG chunk headers (IHDR + scanning for tRNS) — never
 * decodes pixel data, so this is cheap even for a large upload. Used for
 * the "does this PNG actually have transparency?" warning (spec section 2)
 * without pulling in a full image-decoding dependency.
 */
export function inspectPng(buf: Buffer): PngInfo {
  if (buf.length < 33 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { isPng: false, width: 0, height: 0, hasAlpha: false };
  }

  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const colorType = buf.readUInt8(25);

  if (colorType === 4 || colorType === 6) {
    return { isPng: true, width, height, hasAlpha: true };
  }
  if (colorType !== 3) {
    // 0 (grayscale) or 2 (RGB) — no alpha channel possible.
    return { isPng: true, width, height, hasAlpha: false };
  }

  // Palette image: transparency (if any) lives in a later tRNS chunk. Walk
  // chunk headers only — length(4) + type(4) + [data] + crc(4) — until
  // IEND or we find it.
  let offset = 8;
  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    if (type === "tRNS") return { isPng: true, width, height, hasAlpha: true };
    if (type === "IEND" || type === "IDAT") break; // tRNS must precede IDAT per spec
    offset += 8 + length + 4;
  }
  return { isPng: true, width, height, hasAlpha: false };
}
