// End-to-end test of the built-in encoder WITHOUT YouTube: FFmpeg itself
// plays the RTMP ingest server locally; our EncoderRun streams to it; the
// received video is inspected with ffprobe. Also covers a mid-stream
// network drop + reconnect, and stream-key redaction.
//
//   node scripts/test-encoder.mjs          (needs vendor/ffmpeg — scripts/fetch-ffmpeg.mjs)
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const enc = require("../src/encoder.js");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FFMPEG = join(root, "vendor", "ffmpeg", "ffmpeg.exe");
const FFPROBE = join(root, "vendor", "ffmpeg", "ffprobe.exe");
if (!existsSync(FFMPEG)) {
  console.error("vendor/ffmpeg missing — run: node scripts/fetch-ffmpeg.mjs");
  process.exit(2);
}

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const work = mkdtempSync(join(tmpdir(), "atomic-encoder-test-"));
const KEY = "sk-secret-TEST-1234";
const PORT = 19350;

// ---- Pure pieces ------------------------------------------------------------
const args = enc.buildFfmpegArgs({ encoder: "h264_qsv", serverUrl: "rtmps://a.rtmps.youtube.com/live2/", streamKey: KEY });
const has = (...seq) => args.join(" ").includes(seq.join(" "));
assert(args.at(-1) === `rtmps://a.rtmps.youtube.com/live2/${KEY}`, "RTMP URL joined without a double slash");
assert(has("-c:a", "aac") && has("-ar", "48000") && has("-ac", "2"), "AAC stereo 48 kHz (YouTube)");
assert(has("-force_key_frames", "expr:gte(t,n_forced*2)") && has("-g", "60"), "Keyframe every 2 s");
assert(has("-b:v", "4500k") && has("-maxrate", "4500k"), "Constant 4.5 Mbps at 1080p");
assert(has("-bf", "0"), "No B-frames");
assert(enc.buildFfmpegArgs({ encoder: "libopenh264", serverUrl: "rtmp://x", streamKey: "k", profile: "720p" }).join(" ").includes("scale=1280:720"), "720p profile scales down");
const prog = enc.parseProgressBlock("fps=29.97\nbitrate=4488.2kbits/s\ndrop_frames=3\nout_time_us=5000000\nprogress=continue\n");
assert(prog.fps === 29.97 && prog.bitrateKbps === 4488.2 && prog.droppedFrames === 3 && prog.outTimeMs === 5000, "Progress parsing");
assert(!enc.redact(`failed to connect to rtmp://h/live2/${KEY}`, KEY).includes(KEY), "Stream key is redacted from logs");

// ---- Probe -------------------------------------------------------------------
const usable = enc.probeEncoders(FFMPEG);
assert(usable.length > 0 && usable.includes("libopenh264"), `Encoder probe finds working encoders: ${usable.join(", ")}`);
const chosen = usable[0];
console.log(`   using ${chosen}`);

// ---- Test input: WebM (VP8 + Opus), like the page's MediaRecorder ---------
function makeWebm(name, seconds) {
  const out = join(work, name);
  const r = spawnSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", String(seconds), "-c:v", "libvpx", "-b:v", "2M", "-deadline", "realtime", "-cpu-used", "8", "-c:a", "libopus", "-f", "webm", out]);
  if (r.status !== 0) throw new Error(`could not make test webm: ${r.stderr}`);
  return readFileSync(out);
}
const webmA = makeWebm("a.webm", 10);
const webmB = makeWebm("b.webm", 8);

function startIngest(outFile) {
  // FFmpeg as a one-shot RTMP server: accepts one publisher, saves what it gets.
  const p = spawn(FFMPEG, ["-hide_banner", "-loglevel", "error", "-listen", "1", "-i", `rtmp://127.0.0.1:${PORT}/live2/${KEY}`, "-c", "copy", "-f", "flv", "-y", outFile], { windowsHide: true });
  return p;
}

async function feed(run, generation, buf, realtimeSeconds) {
  const chunk = 32 * 1024;
  const delay = (realtimeSeconds * 1000) / Math.ceil(buf.length / chunk);
  for (let i = 0; i < buf.length; i += chunk) {
    run.write(generation, buf.subarray(i, i + chunk));
    await sleep(delay);
  }
}

function probe(file) {
  const r = spawnSync(FFPROBE, ["-v", "error", "-show_entries", "stream=codec_name,codec_type,width,height,avg_frame_rate,sample_rate,channels:format=duration", "-of", "json", file], { encoding: "utf8" });
  return JSON.parse(r.stdout || "{}");
}
function keyframeGaps(file) {
  // Packet-level keyframe flags (the receiver is cut off mid-packet, which
  // makes decoder-based counting unreliable at the tail).
  const r = spawnSync(FFPROBE, ["-v", "quiet", "-select_streams", "v:0", "-show_entries", "packet=pts_time,flags", "-of", "csv=p=0", file], { encoding: "utf8" });
  const t = r.stdout
    .split(/\r?\n/)
    .map((l) => l.split(","))
    .filter(([, flags]) => flags && flags.includes("K"))
    .map(([pts]) => Number(pts))
    .filter((n) => Number.isFinite(n));
  return t.slice(1).map((v, i) => v - t[i]);
}

// ---- 1. Normal run -------------------------------------------------------------
const outA = join(work, "received-a.flv");
let ingest = startIngest(outA);
await sleep(800);
const statuses = [];
const run = new enc.EncoderRun({ runId: "r1", ffmpegPath: FFMPEG, encoder: chosen, serverUrl: `rtmp://127.0.0.1:${PORT}/live2`, streamKey: KEY, fps: 30, profile: "1080p" });
run.on("status", (s) => statuses.push(s));
run.start();
// Real-time-ish feed of a 10 s clip over 10 s; the ingest "network" drops at 6 s.
const feeding = feed(run, 0, webmA, 10);
await sleep(6000);
assert(statuses.some((s) => s.state === "streaming"), "Run reaches 'streaming'");
const last = statuses.filter((s) => s.state === "streaming").at(-1);
assert(last && last.bitrateKbps > 0 && last.fps > 0, `Live stats reported (fps ${last?.fps}, ${last?.bitrateKbps} kbps)`);

// ---- 2. Network drop mid-stream → reconnect ------------------------------------
const dropAt = statuses.length;
const droppedAt = Date.now();
ingest.kill();
await sleep(500);
const outB = join(work, "received-b.flv");
ingest = startIngest(outB);
await feeding;
for (let i = 0; i < 40 && !statuses.slice(dropAt).some((s) => s.state === "reconnecting"); i++) await sleep(250);
const detectedMs = Date.now() - droppedAt;
assert(statuses.slice(dropAt).some((s) => s.state === "reconnecting"), `Connection drop → 'reconnecting' (noticed within ${Math.round(detectedMs / 1000)} s)`);
for (let i = 0; i < 80 && run.generation < 1; i++) await sleep(250);
assert(run.generation === 1, "Encoder restarted with a new generation after backoff");
assert(run.write(0, Buffer.alloc(10)) === false, "Chunks from the old generation are dropped");
await feed(run, 1, webmB, 5);
assert(statuses.slice(dropAt).some((s) => s.state === "streaming" && s.generation === 1), "Streaming again after reconnect");
const allText = JSON.stringify(statuses);
assert(!allText.includes(KEY), "Stream key never appears in any status/error");

await run.stop();
assert(run.state === "stopped", "Stop ends the run cleanly");
await new Promise((r) => (ingest.exitCode !== null ? r() : ingest.once("exit", r)));

// ---- 3. What the ingest server actually received -------------------------------
for (const [label, file] of [["first connection", outA], ["after reconnect", outB]]) {
  const info = probe(file);
  const v = info.streams?.find((s) => s.codec_type === "video");
  const a = info.streams?.find((s) => s.codec_type === "audio");
  assert(existsSync(file) && statSync(file).size > 50_000, `${label}: stream received (${Math.round(statSync(file).size / 1024)} KB)`);
  assert(v?.codec_name === "h264" && v.width === 1920 && v.height === 1080, `${label}: H.264 1920×1080`, JSON.stringify(v));
  assert(v?.avg_frame_rate === "30/1", `${label}: constant 30 fps`, v?.avg_frame_rate);
  assert(a?.codec_name === "aac" && a.sample_rate === "48000" && a.channels === 2, `${label}: AAC 48 kHz stereo`, JSON.stringify(a));
  const gaps = keyframeGaps(file);
  assert(gaps.length >= 2 && gaps.every((g) => g >= 1.9 && g <= 2.1), `${label}: a keyframe every 2 s (${gaps.map((g) => g.toFixed(2)).join(", ")})`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
