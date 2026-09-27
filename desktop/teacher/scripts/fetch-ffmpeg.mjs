// Downloads the LGPL FFmpeg build bundled with the teacher app into
// vendor/ffmpeg (gitignored), verifying it against the release's published
// SHA-256 checksums. LGPL build: hardware H.264 encoders (NVENC/QSV/AMF),
// openh264 and the native AAC encoder — no GPL components, no licence fee.
//
//   node scripts/fetch-ffmpeg.mjs [--force]
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FILE = "ffmpeg-n9.0-latest-win64-lgpl-9.0.zip";
const BASE = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "vendor", "ffmpeg");

if (existsSync(join(dest, "ffmpeg.exe")) && !process.argv.includes("--force")) {
  console.log("vendor/ffmpeg already present (use --force to re-download).");
  process.exit(0);
}

async function download(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

const checksums = (await download(`${BASE}/checksums.sha256`)).toString("utf8");
const line = checksums.split(/\r?\n/).find((l) => l.trim().endsWith(FILE));
if (!line) throw new Error(`${FILE} is not listed in checksums.sha256`);
const expected = line.trim().split(/\s+/)[0].toLowerCase();

console.log(`Downloading ${FILE}…`);
const zip = await download(`${BASE}/${FILE}`);
const actual = createHash("sha256").update(zip).digest("hex");
if (actual !== expected) throw new Error(`SHA-256 mismatch for ${FILE}: expected ${expected}, got ${actual}`);
console.log(`SHA-256 verified (${expected}).`);

const work = mkdtempSync(join(tmpdir(), "atomic-ffmpeg-"));
const zipPath = join(work, FILE);
writeFileSync(zipPath, zip);
// Windows' own bsdtar (System32) reads zip files; a GNU tar earlier on PATH
// (e.g. Git Bash) does not, and mistakes "C:" for a remote host.
const systemTar = process.env.SystemRoot ? join(process.env.SystemRoot, "System32", "tar.exe") : null;
const tar = spawnSync(systemTar && existsSync(systemTar) ? systemTar : "tar", ["-xf", zipPath, "-C", work], { stdio: "inherit" });
if (tar.status !== 0) throw new Error("Could not extract the FFmpeg archive (tar -xf).");

const folder = readdirSync(work).find((n) => n.startsWith("ffmpeg-") && !n.endsWith(".zip"));
if (!folder) throw new Error("Unexpected archive layout.");
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
for (const f of ["ffmpeg.exe", "ffprobe.exe"]) copyFileSync(join(work, folder, "bin", f), join(dest, f));
if (existsSync(join(work, folder, "LICENSE.txt"))) copyFileSync(join(work, folder, "LICENSE.txt"), join(dest, "LICENSE.txt"));
writeFileSync(
  join(dest, "SOURCE.txt"),
  [
    `FFmpeg ${FILE} (LGPL build) from ${BASE}/${FILE}`,
    `SHA-256 ${expected}`,
    `Fetched ${new Date().toISOString()}`,
    "FFmpeg is licensed under the LGPL v2.1+; its source is available at https://ffmpeg.org/ and https://github.com/BtbN/FFmpeg-Builds.",
    "",
  ].join("\n")
);
rmSync(work, { recursive: true, force: true });
console.log(`FFmpeg installed to ${dest}`);
