import "server-only";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";

/**
 * Crops a figure (structure / diagram) out of a still image in plain
 * JavaScript — milliseconds, no headless browser. Same rules as the PDF page
 * renderer's crop: start from the AI's box, push each edge outwards only while
 * it cuts through the drawing (labels like CH3 / NO2 / the O of C=O), drop a
 * stray text line or speck glued to the top / bottom, then fit the drawing.
 */

export type Box = [number, number, number, number]; // [ymin, xmin, ymax, xmax], 0–1000

type Raster = { data: Uint8Array; width: number; height: number };

export function decodeImage(buf: Buffer, mimeType = ""): Raster {
  const isPng = mimeType.includes("png") || (buf[0] === 0x89 && buf[1] === 0x50);
  if (isPng) {
    const png = PNG.sync.read(buf);
    return { data: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.length), width: png.width, height: png.height };
  }
  const img = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 256 });
  return { data: img.data as Uint8Array, width: img.width, height: img.height };
}

export function cropFigure(img: Raster, box: Box, opts: { grow?: boolean } = {}): Buffer | null {
  const { data: px, width: W, height: H } = img;
  const grow = opts.grow ?? true;
  const pad = grow ? 0.004 : 0.012;
  let y0 = Math.round(Math.max(0, box[0] / 1000 - pad) * H);
  let x0 = Math.round(Math.max(0, box[1] / 1000 - pad) * W);
  let y1 = Math.round(Math.min(1, box[2] / 1000 + pad) * H);
  let x1 = Math.round(Math.min(1, box[3] / 1000 + pad) * W);
  // White-ish background assumed: "ink" = darker than light grey (alpha-aware).
  const ink = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    const a = px[i + 3]! / 255;
    const r = px[i]! * a + 255 * (1 - a);
    const g = px[i + 1]! * a + 255 * (1 - a);
    const b = px[i + 2]! * a + 255 * (1 - a);
    return r + g + b < 600;
  };

  if (grow) {
    const GAP = Math.max(6, Math.round(H * 0.006));
    const maxX = Math.round(W * 0.12);
    const maxY = Math.round(H * 0.06);
    for (let pass = 0; pass < 2; pass++) {
      for (let side = 0; side < 4; side++) {
        const vertical = side < 2;
        const limit = vertical ? H : W;
        const dir = side === 0 || side === 2 ? -1 : 1;
        let grown = 0;
        let first = true;
        while (grown < (vertical ? maxY : maxX)) {
          const edge = side === 0 ? y0 : side === 1 ? y1 : side === 2 ? x0 : x1;
          const from = vertical ? x0 : y0;
          const to = vertical ? x1 : y1;
          let found = -1;
          for (let d = 0; d < (first ? 1 : GAP) && found < 0; d++) {
            const line = edge + dir * d;
            if (line < 0 || line > limit - 1) break;
            for (let k = from; k < to; k++) {
              if (vertical ? ink(k, line) : ink(line, k)) {
                found = d;
                break;
              }
            }
          }
          if (found < 0) break;
          first = false;
          const step = found + 1;
          if (side === 0) y0 = Math.max(0, y0 - step);
          else if (side === 1) y1 = Math.min(limit - 1, y1 + step);
          else if (side === 2) x0 = Math.max(0, x0 - step);
          else x1 = Math.min(limit - 1, x1 + step);
          grown += step;
          if ((side === 0 && y0 === 0) || (side === 2 && x0 === 0) || (side === 1 && y1 === limit - 1) || (side === 3 && x1 === limit - 1)) break;
        }
      }
    }

    // Bands of ink rows; drop a text-like line or speck glued to top / bottom.
    type Band = { s: number; e: number; minX: number; maxX: number };
    const bands: Band[] = [];
    for (let y = y0; y < y1; y++) {
      let mn = -1;
      let mx = -1;
      for (let x = x0; x < x1; x++) {
        if (ink(x, y)) {
          if (mn < 0) mn = x;
          mx = x;
        }
      }
      if (mn < 0) continue;
      const r = y - y0;
      const last = bands[bands.length - 1];
      if (last && r - last.e <= 5) {
        last.e = r;
        last.minX = Math.min(last.minX, mn);
        last.maxX = Math.max(last.maxX, mx);
      } else bands.push({ s: r, e: r, minX: mn, maxX: mx });
    }
    const lineH = Math.max(H * 0.022, 30);
    const speck = Math.max(H * 0.003, 3);
    const wideMin = (x1 - x0) * 0.55;
    const textLike = (b: Band) => b.e - b.s < lineH && b.maxX - b.minX > wideMin;
    while (bands.length > 1 && textLike(bands[0]!) && bands[1]!.s - bands[0]!.e > 4) bands.shift();
    while (bands.length > 1 && textLike(bands[bands.length - 1]!) && bands[bands.length - 1]!.s - bands[bands.length - 2]!.e > 4) bands.pop();
    while (bands.length > 1 && bands[0]!.e - bands[0]!.s < speck && bands[1]!.s - bands[0]!.e > 4) bands.shift();
    while (bands.length > 1 && bands[bands.length - 1]!.e - bands[bands.length - 1]!.s < speck && bands[bands.length - 1]!.s - bands[bands.length - 2]!.e > 4) bands.pop();
    if (bands.length) {
      const top = bands[0]!.s;
      const bottom = bands[bands.length - 1]!.e;
      let left = Infinity;
      let right = -1;
      for (const b of bands) {
        left = Math.min(left, b.minX);
        right = Math.max(right, b.maxX);
      }
      y1 = y0 + bottom + 1;
      y0 = y0 + top;
      if (right >= left) {
        x0 = left;
        x1 = right + 1;
      }
    }
    const m = Math.round(W * 0.006) + 2;
    x0 = Math.max(0, x0 - m);
    y0 = Math.max(0, y0 - m);
    x1 = Math.min(W, x1 + m);
    y1 = Math.min(H, y1 + m);
  }

  const cw = x1 - x0;
  const ch = y1 - y0;
  if (cw < 4 || ch < 4) return null;
  const out = new PNG({ width: cw, height: ch });
  for (let y = 0; y < ch; y++) {
    const srcStart = ((y0 + y) * W + x0) * 4;
    out.data.set(px.subarray(srcStart, srcStart + cw * 4), y * cw * 4);
  }
  return PNG.sync.write(out);
}
