// Class recording (tee): the encoder streams to RTMP AND keeps a local part
// file of the same encoded video. Checks both arrive: H.264 1080p + AAC,
// keyframes every 2 s in the file, the stream received by the ingest.
//   node scripts/test-recording.mjs   (needs vendor/ffmpeg)
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const enc = require("../src/encoder.js");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FFMPEG = join(root, "vendor", "ffmpeg", "ffmpeg.exe");
const FFPROBE = join(root, "vendor", "ffmpeg", "ffprobe.exe");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0;
let fail = 0;
const assert = (ok, name, detail) => {
  if (ok) {
    console.log(`✅ PASS: ${name}`);
    pass++;
  } else {
    console.error(`❌ FAIL: ${name}${detail ? ` - ${detail}` : ""}`);
    fail++;
  }
};

const work = mkdtempSync(join(tmpdir(), "atomic-rec-test-"));
const recordDir = join(work, "rec");
require("node:fs").mkdirSync(recordDir);
const KEY = "rec-test-KEY";
const PORT = 19352;

const webm = join(work, "in.webm");
spawnSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", "10", "-c:v", "libvpx", "-b:v", "2M", "-deadline", "realtime", "-cpu-used", "8", "-c:a", "libopus", "-f", "webm", webm]);
const buf = readFileSync(webm);

const received = join(work, "received.flv");
const ingest = spawn(FFMPEG, ["-hide_banner", "-loglevel", "error", "-listen", "1", "-i", `rtmp://127.0.0.1:${PORT}/live2/${KEY}`, "-c", "copy", "-f", "flv", "-y", received], { windowsHide: true });
await sleep(800);

const encoder = enc.probeEncoders(FFMPEG)[0];
console.log(`   using ${encoder}`);
const run = new enc.EncoderRun({ runId: "rec", ffmpegPath: FFMPEG, encoder, serverUrl: `rtmp://127.0.0.1:${PORT}/live2`, streamKey: KEY, fps: 30, profile: "1080p", recordDir });
run.start();
await sleep(500);
const chunk = 32 * 1024;
for (let i = 0; i < buf.length; i += chunk) {
  run.write(0, buf.subarray(i, i + chunk));
  await sleep((10_000 * chunk) / buf.length);
}
await run.stop();
await new Promise((r) => (ingest.exitCode !== null ? r() : ingest.once("exit", r)));

const parts = readdirSync(recordDir);
assert(parts.length === 1 && parts[0] === "part-000.mkv", `one part file written (${parts.join(", ")})`);
const part = join(recordDir, parts[0] ?? "x");
assert(existsSync(part) && statSync(part).size > 100_000, `recording has data (${existsSync(part) ? Math.round(statSync(part).size / 1024) : 0} KB)`);
const info = JSON.parse(spawnSync(FFPROBE, ["-v", "error", "-show_entries", "stream=codec_name,codec_type,width,height:format=duration", "-of", "json", part], { encoding: "utf8" }).stdout || "{}");
const v = info.streams?.find((s) => s.codec_type === "video");
const a = info.streams?.find((s) => s.codec_type === "audio");
assert(v?.codec_name === "h264" && v.width === 1920 && v.height === 1080, "recording: H.264 1920×1080", JSON.stringify(v));
assert(a?.codec_name === "aac", "recording: AAC audio", JSON.stringify(a));
assert(Number(info.format?.duration) > 7, `recording: full length (${Number(info.format?.duration).toFixed(1)} s)`);
const showinfo = spawnSync(FFMPEG, ["-hide_banner", "-i", part, "-map", "0:v:0", "-vf", "showinfo", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 28 }).stderr;
const keys = [...showinfo.matchAll(/pts_time:([\d.]+).*iskey:1/g)].map((m) => Number(m[1]));
const gaps = keys.slice(1).map((t, i) => t - keys[i]);
assert(gaps.length >= 2 && gaps.every((g) => g >= 1.9 && g <= 2.1), `recording: IDR every 2 s (${gaps.map((g) => g.toFixed(2)).join(", ")})`);
assert(existsSync(received) && statSync(received).size > 100_000, `stream still received by the ingest (${existsSync(received) ? Math.round(statSync(received).size / 1024) : 0} KB)`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
