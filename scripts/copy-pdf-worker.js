// Copies pdfjs-dist's worker file into public/ so it's served as a plain
// static asset instead of being resolved through webpack's
// `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)` pattern.
//
// Why this exists: that `new URL(...)` pattern makes Next's production
// webpack build treat the worker as a bundled JS asset and run Terser over
// it — but pdf.worker.min.mjs is a real ES module (top-level import/export),
// which Terser can't parse outside module context, so the Vercel build
// fails with "'import', and 'export' cannot be used outside of module
// code". Serving it from public/ instead means the browser just fetches it
// as-is; webpack/Terser never touch it.
//
// Runs on every `npm install` (see the "postinstall" script in
// package.json, right after `prisma generate`) so the copied file always
// matches whatever pdfjs-dist version is actually installed — it is NOT
// committed to git (see .gitignore) for exactly that reason.
const fs = require("fs");
const path = require("path");

const src = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
const publicDir = path.join(__dirname, "..", "public");
const dest = path.join(publicDir, "pdf.worker.min.mjs");

fs.mkdirSync(publicDir, { recursive: true });
fs.copyFileSync(src, dest);

console.log(`[copy-pdf-worker] copied ${src} -> ${dest}`);
