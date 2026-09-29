// Full desktop pipeline test, no YouTube and no real camera/mic:
//   real Electron app → the real DesktopClassStreamer + StageCompositor (from
//   src/, bundled) drawing an animated "board" → Chromium MediaRecorder →
//   IPC → built-in encoder (FFmpeg) → local RTMP ingest (FFmpeg) → ffprobe.
// Camera/mic are denied (ATOMIC_DENY_MEDIA=1), which also exercises the
// board-only + silent-audio fallback.
//
//   node scripts/test-desktop-e2e.mjs
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, "..");
const repo = join(appDir, "..", "..");
const FFMPEG = join(appDir, "vendor", "ffmpeg", "ffmpeg.exe");
const FFPROBE = join(appDir, "vendor", "ffmpeg", "ffprobe.exe");
const ELECTRON = join(appDir, "node_modules", "electron", "dist", "electron.exe");
for (const f of [FFMPEG, ELECTRON]) if (!existsSync(f)) (console.error(`missing ${f}`), process.exit(2));

let pass = 0;
let fail = 0;
const assert = (ok, name, detail) => {
  if (ok) (console.log(`✅ PASS: ${name}`), pass++);
  else (console.error(`❌ FAIL: ${name}${detail ? ` - ${detail}` : ""}`), fail++);
};
const work = mkdtempSync(join(tmpdir(), "atomic-desktop-e2e-"));
const KEY = "sk-e2e-secret-9876";
const RTMP_PORT = 19351;

// 1. Bundle the REAL streamer for the browser.
const esbuild = require(join(repo, "node_modules", "esbuild"));
const entry = join(work, "entry.ts");
writeFileSync(
  entry,
  `import { DesktopClassStreamer } from ${JSON.stringify(join(repo, "src", "lib", "live-class", "desktop-streamer.ts").replace(/\\/g, "/"))};
(window as any).DesktopClassStreamer = DesktopClassStreamer;
import { ChromaKeyer, DEFAULT_CHROMA } from ${JSON.stringify(join(repo, "src", "lib", "live-class", "chroma-key.ts").replace(/\\/g, "/"))};
// Chroma check (real GPU keyer in real Electron): green screen + dim, grainy
// green (low light / cheap camera) must go transparent; the "teacher" stays.
(window as any).chromaCheck = () => {
  const c = document.createElement("canvas");
  c.width = 160; c.height = 90;
  const g = c.getContext("2d")!;
  g.fillStyle = "#00b140"; g.fillRect(0, 0, 80, 90);
  for (let y = 0; y < 90; y++) for (let x = 80; x < 120; x++) {
    const n = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
    g.fillStyle = "rgb(" + Math.round(10 + 12 * n) + "," + Math.round(70 + 25 * n) + "," + Math.round(30 + 12 * n) + ")";
    g.fillRect(x, y, 1, 1);
  }
  g.fillStyle = "#c0392b"; g.fillRect(120, 0, 40, 90); // the teacher (skin/shirt-ish)
  g.fillStyle = "#161616"; g.fillRect(60, 0, 20, 45); // black hair / clothes
  g.fillStyle = "#5a5f5a"; g.fillRect(60, 45, 20, 45); // grey shirt
  const k = new ChromaKeyer();
  if (!k.supported) return { supported: false };
  k.setSettings({ ...DEFAULT_CHROMA, enabled: true, similarity: 0.45, gamma: 1.6, denoise: 2 });
  const out = k.process(c, 160, 90)!;
  const o = document.createElement("canvas"); o.width = 160; o.height = 90;
  const og = o.getContext("2d")!; og.drawImage(out, 0, 0);
  const a = (x: number, y: number) => og.getImageData(x, y, 1, 1).data[3];
  return { supported: true, screen: a(40, 45), dimScreen: a(100, 45), teacher: a(140, 45), black: a(70, 20), grey: a(70, 70) };
};`
);
const bundle = await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  absWorkingDir: repo,
  tsconfig: join(repo, "tsconfig.json"),
});
const js = bundle.outputFiles[0].text;

// Two modes:
//   stage (default) — the real app flow: the teacher page opens the app's
//                     OFFSCREEN stage window; the stage page streams.
//   inpage          — older app flow: the streamer runs in the teacher page.
const MODE = process.env.E2E_MODE === "inpage" ? "inpage" : "stage";
const RTMP_URL = `rtmp://127.0.0.1:${RTMP_PORT}/live2`;

const boardScript = `
const board = document.getElementById("board");
const g = board.getContext("2d");
g.lineWidth = 6; g.strokeStyle = "#111";
let t = 0;
setInterval(() => { t++; g.beginPath(); g.moveTo((t * 17) % 960, 40); g.lineTo((t * 17) % 960, 500); g.stroke(); }, 100);
const sources = () => ({ boardLayers: [board], backgroundColor: "#ffffff", backgroundImageUrl: null, cameraShape: "CIRCULAR", cameraPosition: "UPPER_RIGHT", showCamera: true });
`;

// Stage page (loaded by the app in its offscreen window): gets its job over IPC.
const stageHtml = `<!doctype html><html><body style="margin:0;background:#111">
<canvas id="board" width="960" height="540"></canvas>
<script src="/streamer.js"></script>
<script>${boardScript}
(async () => {
  const bridge = window.atomicDesktop;
  if (!bridge || !bridge.stage || !bridge.stage.isStage) return;
  const MR = window.MediaRecorder;
  window.MediaRecorder = class extends MR { constructor(st, o) { super(st, o); console.log("MR new", o && o.mimeType, st.getTracks().map((t) => t.kind + ":" + t.readyState + ":" + t.enabled).join(",")); this.addEventListener("error", (e) => console.log("MR error", e.error && e.error.message)); this.addEventListener("start", () => console.log("MR start")); let n = 0; this.addEventListener("dataavailable", (e) => { if (n++ < 3) console.log("MR data", e.data.size); }); } };
  window.MediaRecorder.isTypeSupported = MR.isTypeSupported.bind(MR);
  setTimeout(() => console.log("AC probe", typeof AudioContext), 0);
  const job = await bridge.stage.job();
  const s = new window.DesktopClassStreamer(bridge, sources, () => {});
  await s.start({ serverUrl: job.serverUrl, streamKey: job.streamKey, profile: job.profile });
})();
</script></body></html>`;

// Teacher page: in stage mode it only opens/closes the stage and listens.
const teacherHtml =
  MODE === "stage"
    ? `<!doctype html><html><body><script src="/streamer.js"></script><script>
(async () => {
  const statuses = [];
  try {
    const bridge = window.atomicDesktop;
    const isStage = bridge.stage.isStage;
    const chroma = window.chromaCheck ? window.chromaCheck() : null;
    let firstStreamingAt = null;
    bridge.encoder.onStatus((st) => { statuses.push(st); if (st.state === "streaming" && !firstStreamingAt) firstStreamingAt = Date.now(); });
    const first = await bridge.stage.open({ stagePath: "/stage.html", serverUrl: "${RTMP_URL}", streamKey: "${KEY}" });
    await new Promise((r) => setTimeout(r, 5000));
    const control = await bridge.stage.control({ cameraOff: true, micMuted: true });
    // A teacher-page refresh re-opens the same stage: it must be reused, not restarted.
    const again = await bridge.stage.open({ stagePath: "/stage.html", serverUrl: "${RTMP_URL}", streamKey: "${KEY}" });
    await new Promise((r) => setTimeout(r, 7000));
    const streamedSeconds = firstStreamingAt ? (Date.now() - firstStreamingAt) / 1000 : 0;
    await bridge.stage.close();
    const withEncoder = statuses.find((x) => x.encoder);
    window.__selftest = { ok: true, statuses, streamedSeconds, control, chroma, isStage, reused: again.reused, firstReused: first.reused, encoder: withEncoder ? withEncoder.encoder : null };
  } catch (e) {
    window.__selftest = { ok: false, error: String((e && e.message) || e), statuses };
  }
})();
</script></body></html>`
    : `<!doctype html><html><body style="margin:0;background:#111">
<canvas id="board" width="960" height="540"></canvas>
<script src="/streamer.js"></script>
<script>${boardScript}
(async () => {
  const statuses = [];
  try {
    const s = new window.DesktopClassStreamer(window.atomicDesktop, sources, (st) => statuses.push(st));
    await s.start({ serverUrl: "${RTMP_URL}", streamKey: "${KEY}" });
    await new Promise((r) => setTimeout(r, 12000));
    await s.stop();
    window.__selftest = { ok: true, statuses, encoder: s.encoderName };
  } catch (e) {
    window.__selftest = { ok: false, error: String((e && e.message) || e), statuses };
  }
})();
</script></body></html>`;

const server = createServer((req, res) => {
  if (req.url === "/streamer.js") return res.writeHead(200, { "content-type": "text/javascript" }).end(js);
  if (req.url === "/stage.html") return res.writeHead(200, { "content-type": "text/html" }).end(stageHtml);
  res.writeHead(200, { "content-type": "text/html" }).end(teacherHtml);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

// 2. Local RTMP ingest.
const received = join(work, "received.flv");
const ingest = spawn(FFMPEG, ["-hide_banner", "-loglevel", "error", "-listen", "1", "-i", `rtmp://127.0.0.1:${RTMP_PORT}/live2/${KEY}`, "-c", "copy", "-f", "flv", "-y", received], { windowsHide: true });
await new Promise((r) => setTimeout(r, 800));

// 3. Real Electron app pointed at the test page.
// Async spawn: the page server above lives in this process's event loop.
const electron = await new Promise((resolve) => {
  const out = { stdout: "", stderr: "", error: null };
  const child = spawn(ELECTRON, [".", "--smoke"], {
  cwd: appDir,
  env: {
    ...process.env,
    ATOMIC_APP_URL: `http://127.0.0.1:${port}`,
    ATOMIC_START_PATH: "/selftest.html",
    ATOMIC_DENY_MEDIA: "1",
    ATOMIC_SMOKE_WAIT_FOR: "__selftest",
    ...(process.env.E2E_DEBUG ? { ATOMIC_STAGE_LOG: "1" } : {}),
    ...(process.env.E2E_MINIMIZE ? { ATOMIC_SMOKE_MINIMIZE: process.env.E2E_MINIMIZE } : {}),
  },
  });
  child.stdout.on("data", (d) => (out.stdout += d));
  child.stderr.on("data", (d) => (out.stderr += d));
  const timer = setTimeout(() => ((out.error = "timeout"), child.kill()), 180_000);
  child.on("exit", () => (clearTimeout(timer), resolve(out)));
});
server.close();
await new Promise((r) => (ingest.exitCode !== null ? r() : ingest.once("exit", r)));

const line = (electron.stdout || "").split(/\r?\n/).find((l) => l.startsWith("ATOMIC_SMOKE "));
const result = line ? JSON.parse(line.slice("ATOMIC_SMOKE ".length)) : null;
const self = result?.selftest;
if (process.env.E2E_DEBUG) console.error((electron.stdout || "").split("\n").filter((l) => l.startsWith("[stage]")).join("\n"));
if (process.env.E2E_DEBUG) console.error("E2E_DEBUG", JSON.stringify({ self, bridge: result?.bridge?.encoder, err: result?.error }));
if (!self?.ok) console.error("electron output:\n", electron.error ?? "", (electron.stdout || "").slice(-3000), (electron.stderr || "").slice(-3000));
assert(Boolean(result?.loaded && result?.bridge?.encoder?.available), "Electron app loaded the page with a working encoder", JSON.stringify(result?.bridge?.encoder));
assert(self?.ok === true, "Streamer ran start → 12 s → stop without errors", self?.error);
const states = (self?.statuses ?? []).map((s) => s.state);
assert(states.includes("streaming"), `Encoder reported 'streaming' (via ${self?.encoder})`, states.join(","));
const warn = (self?.statuses ?? []).flatMap((s) => s.warnings ?? []);
if (MODE === "inpage") assert(warn.some((w) => /Camera unavailable/.test(w)), "Denied camera → warning, stream continues (board only)");
else {
  assert(self?.isStage === false && self?.firstReused === false, "Teacher window is not the stage; the stage window was opened fresh");
  assert(self?.control?.cameraOff === true && self?.control?.micMuted === true, "Teacher Cam/Mic switches reach the stage (control round-trip)");
  const ch = self?.chroma;
  assert(ch?.supported === true, "Chroma key runs on the GPU (WebGL) in the app", JSON.stringify(ch));
  assert(ch?.screen === 0 && ch?.dimScreen <= 10, "Green screen AND dim/grainy green (low light, cheap camera) removed", JSON.stringify(ch));
  assert(ch?.teacher === 255, "Teacher kept fully opaque", JSON.stringify(ch));
  assert(ch?.black === 255 && ch?.grey === 255, "Black hair / grey clothes never keyed out", JSON.stringify(ch));
  assert(self?.reused === true, "Re-opening the same stage (teacher page refresh) reuses it — stream not restarted");
}
assert(!JSON.stringify(self ?? {}).includes(KEY), "Stream key not echoed back to the page in any status");

// 4. What YouTube's side would have received.
assert(existsSync(received) && statSync(received).size > 100_000, `Ingest received the stream (${existsSync(received) ? Math.round(statSync(received).size / 1024) : 0} KB)`);
const info = JSON.parse(spawnSync(FFPROBE, ["-v", "quiet", "-show_entries", "stream=codec_name,codec_type,width,height,avg_frame_rate,sample_rate,channels:format=duration", "-of", "json", received], { encoding: "utf8" }).stdout || "{}");
const v = info.streams?.find((s) => s.codec_type === "video");
const a = info.streams?.find((s) => s.codec_type === "audio");
assert(v?.codec_name === "h264" && v.width === 1920 && v.height === 1080 && v.avg_frame_rate === "30/1", "H.264 1920×1080 @ 30 fps", JSON.stringify(v));
assert(a?.codec_name === "aac" && a.channels === 2, "AAC stereo audio track present (silent fallback when no mic)", JSON.stringify(a));
// 12 s window; the stage window needs ~2-3 s to load and connect. Any pause
// (minimised/covered window) shows up as missing seconds here.
const expectSeconds = MODE === "stage" ? 9 : 11.5;
assert(Number(info.format?.duration) >= expectSeconds - 1, `No video lost while streaming (${Number(info.format?.duration).toFixed(1)} s received, need ≥ ${(expectSeconds - 1).toFixed(1)} s)`);
{
  // YouTube needs a keyframe at least every 4 s; we send one every 2 s.
  const pk = spawnSync(FFPROBE, ["-v", "quiet", "-select_streams", "v:0", "-show_entries", "packet=pts_time,flags", "-of", "csv=p=0", received], { encoding: "utf8" }).stdout || "";
  const t = pk.split(/\r?\n/).map((l) => l.split(",")).filter(([, f]) => f && f.includes("K")).map(([x]) => Number(x)).filter(Number.isFinite);
  const gaps = t.slice(1).map((v, i) => v - t[i]);
  assert(gaps.length >= 3 && Math.max(...gaps) <= 2.1, `Keyframe every 2 s (max gap ${gaps.length ? Math.max(...gaps).toFixed(2) : "?"} s)`);
}


// 5. The board is IN the video: grab a frame and count dark (stroke) pixels on white.
const frame = spawnSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-ss", "6", "-i", received, "-frames:v", "1", "-vf", "scale=480:270,format=gray", "-f", "rawvideo", "-"], { maxBuffer: 10 * 1024 * 1024 });
const px = frame.stdout ?? Buffer.alloc(0);
let dark = 0;
let light = 0;
for (const b of px) b < 80 ? dark++ : b > 200 && light++;
assert(px.length === 480 * 270 && dark > 500 && light > 480 * 270 * 0.2, `Board strokes visible in the received video (${dark} dark px on a white page)`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
