"use strict";

/**
 * Built-in encoder: the class's stage video (WebM from the page's
 * MediaRecorder, piped in chunk by chunk) → FFmpeg → RTMP(S) → YouTube.
 *
 * No Electron imports here so it can be tested with plain Node.
 *
 * Choices, in order of what matters for a live class:
 *   - Hardware H.264 when the machine has it (NVENC → QSV → AMF → Media
 *     Foundation), openh264 otherwise. Each candidate is test-encoded once;
 *     being listed by FFmpeg doesn't mean the GPU/driver is really there.
 *   - What YouTube asks for: constant bitrate, a keyframe every 2 s, no
 *     B-frames, AAC stereo 48 kHz, constant frame rate.
 *   - If the connection to YouTube drops, FFmpeg is restarted with backoff.
 *     A fresh FFmpeg needs a fresh WebM header, so each restart bumps a
 *     `generation`; the page restarts its recorder for that generation and
 *     only chunks of the current generation are written.
 *   - The stream key never appears in logs or status (redacted).
 */

const { spawn, spawnSync } = require("node:child_process");
const { EventEmitter } = require("node:events");

const ENCODER_PREFERENCE = ["h264_nvenc", "h264_qsv", "h264_amf", "h264_mf", "libopenh264"];

const PROFILES = {
  "1080p": { width: 1920, height: 1080, videoKbps: 4500 },
  "720p": { width: 1280, height: 720, videoKbps: 2500 },
};

/** Test-encodes one second with each candidate; returns the ones that really work. */
function probeEncoders(ffmpegPath, candidates = ENCODER_PREFERENCE) {
  const usable = [];
  for (const enc of candidates) {
    const pix = enc === "h264_qsv" || enc === "h264_amf" || enc === "h264_mf" ? "nv12" : "yuv420p";
    const r = spawnSync(
      ffmpegPath,
      ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=black:size=640x360:rate=30", "-t", "0.5", "-pix_fmt", pix, "-c:v", enc, "-f", "null", "-"],
      { timeout: 20_000, windowsHide: true }
    );
    if (r.status === 0) usable.push(enc);
  }
  return usable;
}

function rateControlArgs(encoder, kbps, fps) {
  const b = `${kbps}k`;
  const buf = `${kbps * 2}k`;
  const gop = String(fps * 2);
  switch (encoder) {
    case "h264_nvenc":
      return ["-c:v", "h264_nvenc", "-preset", "p4", "-tune", "ll", "-rc", "cbr", "-b:v", b, "-maxrate", b, "-bufsize", buf, "-g", gop, "-bf", "0", "-profile:v", "high"];
    case "h264_qsv":
      return ["-c:v", "h264_qsv", "-preset", "veryfast", "-b:v", b, "-maxrate", b, "-bufsize", buf, "-g", gop, "-bf", "0", "-profile:v", "high"];
    case "h264_amf":
      return ["-c:v", "h264_amf", "-usage", "lowlatency", "-quality", "speed", "-rc", "cbr", "-b:v", b, "-maxrate", b, "-bufsize", buf, "-g", gop, "-bf", "0"];
    case "h264_mf":
      return ["-c:v", "h264_mf", "-rate_control", "cbr", "-scenario", "live_streaming", "-b:v", b, "-g", gop];
    default:
      return ["-c:v", "libopenh264", "-rc_mode", "bitrate", "-b:v", b, "-maxrate", b, "-g", gop];
  }
}

function joinRtmpUrl(serverUrl, streamKey) {
  return `${String(serverUrl).replace(/\/+$/, "")}/${streamKey}`;
}

/** FFmpeg arguments for one run. Pure — unit tested. */
function buildFfmpegArgs({ encoder, serverUrl, streamKey, fps = 30, profile = "1080p", audioKbps = 128 }) {
  const p = PROFILES[profile] || PROFILES["1080p"];
  const pix = encoder === "libopenh264" || encoder === "h264_nvenc" ? "yuv420p" : "nv12";
  return [
    "-hide_banner",
    "-loglevel", "warning",
    "-nostats",
    "-progress", "pipe:1",
    "-fflags", "+genpts",
    "-f", "webm",
    "-i", "pipe:0",
    "-map", "0:v:0",
    "-map", "0:a:0",
    // Chromium's recorder writes BT.601 colour without tagging it, while
    // YouTube (and every HD player) reads untagged video as BT.709: board
    // colours came out shifted (green darker, red/pink/cyan off). Measured:
    // convert to BT.709 and tag it, and the decoded colours match the board.
    "-vf", `fps=${fps},scale=${p.width}:${p.height}:flags=bicubic:in_color_matrix=bt601:out_color_matrix=bt709:in_range=tv:out_range=tv,format=${pix}`,
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
    "-fps_mode", "cfr",
    ...rateControlArgs(encoder, p.videoKbps, fps),
    "-force_key_frames", "expr:gte(t,n_forced*2)",
    "-c:a", "aac", "-b:a", `${audioKbps}k`, "-ar", "48000", "-ac", "2",
    "-f", "flv",
    "-flvflags", "no_duration_filesize",
    joinRtmpUrl(serverUrl, streamKey),
  ];
}

/** Parses FFmpeg `-progress` key=value blocks. */
function parseProgressBlock(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const kbps = parseFloat(String(out.bitrate || "").replace("kbits/s", ""));
  return {
    fps: out.fps !== undefined ? Number(out.fps) : undefined,
    bitrateKbps: Number.isFinite(kbps) ? kbps : undefined,
    droppedFrames: out.drop_frames !== undefined ? Number(out.drop_frames) : undefined,
    dupFrames: out.dup_frames !== undefined ? Number(out.dup_frames) : undefined,
    outTimeMs: out.out_time_us !== undefined ? Math.round(Number(out.out_time_us) / 1000) : undefined,
    speed: out.speed,
    ended: out.progress === "end",
  };
}

function redact(text, secret) {
  return secret ? String(text).split(secret).join("•••") : String(text);
}

const BACKOFF_MS = [2000, 4000, 8000, 15000, 30000];
const STALL_MS = 20_000;

/**
 * One class's encoder run. Emits "status" objects:
 *   { state: "starting" | "streaming" | "reconnecting" | "stopped" | "failed", generation, encoder, fps, bitrateKbps, droppedFrames, error }
 */
class EncoderRun extends EventEmitter {
  constructor({ runId, ffmpegPath, encoder, serverUrl, streamKey, fps, profile, spawnImpl = spawn }) {
    super();
    this.runId = runId;
    this.ffmpegPath = ffmpegPath;
    this.encoder = encoder;
    this.serverUrl = serverUrl;
    this.streamKey = streamKey;
    this.fps = fps;
    this.profile = profile;
    this.spawnImpl = spawnImpl;
    this.generation = 0;
    this.state = "starting";
    this.proc = null;
    this.stopping = false;
    this.restarts = 0;
    this.lastOutTimeMs = 0;
    this.lastProgressAt = Date.now();
    this.stderrTail = [];
    this.stats = {};
    this.watchdog = null;
  }

  status() {
    return {
      runId: this.runId,
      state: this.state,
      generation: this.generation,
      encoder: this.encoder,
      restarts: this.restarts,
      ...this.stats,
      ...(this.error ? { error: this.error } : {}),
    };
  }

  emitStatus() {
    this.emit("status", this.status());
  }

  start() {
    this.spawnProcess();
    this.watchdog = setInterval(() => {
      if (this.state === "streaming" && Date.now() - this.lastProgressAt > STALL_MS) {
        this.stderrTail.push("encoder stalled — restarting");
        this.proc?.kill();
      }
    }, 5000);
  }

  spawnProcess() {
    const args = buildFfmpegArgs({ encoder: this.encoder, serverUrl: this.serverUrl, streamKey: this.streamKey, fps: this.fps, profile: this.profile });
    const proc = this.spawnImpl(this.ffmpegPath, args, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    this.proc = proc;
    this.lastProgressAt = Date.now();
    let progressBuf = "";
    proc.stdout.on("data", (d) => {
      progressBuf += d.toString();
      let idx;
      while ((idx = progressBuf.search(/progress=(continue|end)\r?\n/)) !== -1) {
        const end = progressBuf.indexOf("\n", idx) + 1;
        const block = progressBuf.slice(0, end);
        progressBuf = progressBuf.slice(end);
        const p = parseProgressBlock(block);
        this.stats = { fps: p.fps, bitrateKbps: p.bitrateKbps, droppedFrames: p.droppedFrames, dupFrames: p.dupFrames, speed: p.speed };
        if (p.outTimeMs !== undefined && p.outTimeMs > 0 && p.outTimeMs !== this.lastOutTimeMs) {
          this.lastOutTimeMs = p.outTimeMs;
          this.lastProgressAt = Date.now();
          if (this.state !== "streaming") {
            this.state = "streaming";
            this.error = undefined;
          }
        }
        this.emitStatus();
      }
    });
    proc.stderr.on("data", (d) => {
      for (const line of redact(d.toString(), this.streamKey).split(/\r?\n/)) {
        if (line.trim()) this.stderrTail.push(line.trim());
      }
      if (this.stderrTail.length > 40) this.stderrTail = this.stderrTail.slice(-40);
    });
    proc.stdin.on("error", () => {
      // EPIPE when FFmpeg exits mid-write — handled by the exit handler.
    });
    proc.on("exit", (code) => this.onExit(proc, code));
    proc.on("error", (err) => {
      this.stderrTail.push(redact(err.message, this.streamKey));
    });
    this.emitStatus();
  }

  onExit(proc, code) {
    if (proc !== this.proc) return;
    this.proc = null;
    if (this.stopping) {
      this.state = "stopped";
      this.cleanup();
      this.emitStatus();
      return;
    }
    // Unexpected exit (network drop, YouTube closed the connection, stall):
    // restart with backoff; the page re-sends a fresh WebM stream for the
    // new generation.
    const delay = BACKOFF_MS[Math.min(this.restarts, BACKOFF_MS.length - 1)];
    this.restarts++;
    this.state = "reconnecting";
    this.error = `Encoder exited (code ${code}): ${this.stderrTail.slice(-3).join(" | ")}`.slice(0, 500);
    this.emitStatus();
    this.restartTimer = setTimeout(() => {
      if (this.stopping) return;
      this.generation++;
      this.spawnProcess();
    }, delay);
  }

  /** Writes one WebM chunk. Chunks from an older generation (before a restart) are dropped. */
  write(generation, chunk) {
    if (generation !== this.generation || !this.proc || this.stopping) return false;
    try {
      return this.proc.stdin.write(Buffer.from(chunk));
    } catch {
      return false;
    }
  }

  stop() {
    this.stopping = true;
    clearTimeout(this.restartTimer);
    const proc = this.proc;
    if (!proc) {
      this.state = "stopped";
      this.cleanup();
      this.emitStatus();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const kill = setTimeout(() => proc.kill(), 5000);
      proc.once("exit", () => {
        clearTimeout(kill);
        resolve();
      });
      try {
        proc.stdin.end();
      } catch {
        proc.kill();
      }
    });
  }

  cleanup() {
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = null;
  }
}

module.exports = {
  ENCODER_PREFERENCE,
  PROFILES,
  probeEncoders,
  buildFfmpegArgs,
  parseProgressBlock,
  joinRtmpUrl,
  redact,
  EncoderRun,
  BACKOFF_MS,
};
