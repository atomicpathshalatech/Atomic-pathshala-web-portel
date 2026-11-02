/**
 * Turns a photo / scan of the authorised signature into the ID-card asset:
 * crops to the ink, makes the paper transparent, and saves
 * public/brand/signature.png (which the cards pick up automatically).
 *
 *   npx tsx scripts/prepare-signature.ts <input image> [--color "#0a1f5c"]
 *
 * --color recolours the ink (default: keep it as written, near-black).
 */
import fs from "node:fs";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";

async function main() {
  const input = process.argv[2];
  if (!input) throw new Error("Usage: npx tsx scripts/prepare-signature.ts <input image> [--color #0a1f5c]");
  const ci = process.argv.indexOf("--color");
  const color = ci > 0 ? process.argv[ci + 1] : null;

  const img = await loadImage(fs.readFileSync(input));
  const src = createCanvas(img.width, img.height);
  const sctx = src.getContext("2d");
  sctx.drawImage(img, 0, 0);
  const { data, width, height } = sctx.getImageData(0, 0, img.width, img.height);

  // Ink = clearly darker than the paper. Find its bounding box.
  const lum = (i: number) => 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3]! > 40 && lum(i) < 170) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  if (x1 < 0) throw new Error("No ink found in the image.");
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.03) + 2;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(width - 1, x1 + pad);
  y1 = Math.min(height - 1, y1 + pad);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;

  // Scale so the result is crisp in print (~ 3× the 132 px slot) without being huge.
  const k = Math.min(4, Math.max(1, 600 / w));
  const out = createCanvas(Math.round(w * k), Math.round(h * k));
  const octx = out.getContext("2d");
  octx.imageSmoothingQuality = "high";
  octx.drawImage(src, x0, y0, w, h, 0, 0, out.width, out.height);
  const od = octx.getImageData(0, 0, out.width, out.height);
  const rgb = color ? [1, 3, 5].map((o) => parseInt(color.slice(o, o + 2), 16)) : null;
  for (let i = 0; i < od.data.length; i += 4) {
    const l = 0.299 * od.data[i]! + 0.587 * od.data[i + 1]! + 0.114 * od.data[i + 2]!;
    // Paper → transparent, ink → opaque, soft edge in between.
    const a = Math.max(0, Math.min(1, (215 - l) / 120));
    od.data[i + 3] = Math.round(a * (od.data[i + 3]! ));
    if (rgb) [od.data[i], od.data[i + 1], od.data[i + 2]] = rgb as [number, number, number];
  }
  octx.putImageData(od, 0, 0);

  const dest = path.resolve("public/brand/signature.png");
  fs.writeFileSync(dest, out.toBuffer("image/png"));
  console.log(`Saved ${dest} (${out.width}×${out.height}, cropped from ${w}×${h} of ${width}×${height})`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
