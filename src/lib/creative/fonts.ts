import "server-only";
import { readFileSync } from "fs";
import path from "path";

/**
 * next/og's ImageResponse (Satori) needs an explicit font, or it falls back
 * to loading its own bundled Noto Sans via a relative-path -> file:// URL
 * construction that throws `ERR_INVALID_URL` on Windows (`next dev` on this
 * machine reproduces it every time — a real, confirmed bug in that fallback
 * path, not a Satori/font-rendering limitation). Supplying our own font
 * explicitly skips that internal fallback entirely, on every platform.
 *
 * Reads the exact font Next already ships (so no new binary asset to
 * maintain) straight out of its own package, once per process.
 */
let cachedFont: ArrayBuffer | null = null;

export function loadDefaultCreativeFont(): ArrayBuffer {
  if (cachedFont) return cachedFont;
  // require.resolve() inside a webpack-bundled RSC/route module resolves
  // through webpack's own module graph, not the real filesystem (it comes
  // back as something like "(rsc)/node_modules/..." here) — process.cwd()
  // is the one reliable way to get the real project root, both in `next
  // dev` and in a deployed Vercel function.
  const fontPath = path.join(
    process.cwd(),
    "node_modules/next/dist/compiled/@vercel/og/noto-sans-v27-latin-regular.ttf"
  );
  const buf = readFileSync(fontPath);
  cachedFont = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return cachedFont;
}
