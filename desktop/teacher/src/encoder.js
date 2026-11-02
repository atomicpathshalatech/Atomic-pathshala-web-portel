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
  // YouTube's live encoder page (H.264, 30 fps): 1080p ≈ 5–10 Mbps, 720p lower.
  "1080p": { width: 1920, height: 1080, videoKbps: 6000 },
  "720p": { width: 1280, height: 720, videoKbps: 3500 },
  // Low-network steps (see QUALITY_LADDER): the board stays readable, the
  // class keeps moving instead of buffering.
  "720p-low": { width: 1280, height: 720, videoKbps: 1400, audioKbps: 96 },
  "480p": { width: 854, height: 480, videoKbps: 800, fps: 24, audioKbps: 64 },
  "360p": { width: 640, height: 360, videoKbps: 450, fps: 20, audioKbps: 64 },
};

/**
 * Best → lowest. A teacher on a weak connection cannot push 4.5 Mbps: FFmpeg
 * then falls behind real time and YouTube viewers get a class that keeps
 * buffering. When the run falls behind, it steps down this ladder (and back up
 * one step after a long steady stretch).
 */
const QUALITY_LADDER = ["1080p", "720p", "720p-low", "480p", "360p"];
/** Behind real time by this much … */
const LAG_STEP_DOWN_MS = 4000;
/** … for this long, while FFmpeg is not taking data as fast as it comes = the upload can't keep up. */
const LAG_SUSTAIN_MS = 8000;
/** FFmpeg's input queue above this = it is not keeping up (upload / encoder slow). */
const BACKLOG_BYTES = 1_000_000;
/** How recent that backlog must be to blame the upload. */
const BACKLOG_RECENT_MS = 5000;
/** Ignore the first seconds of a run: start-up always looks slow. */
const WARMUP_MS = 12_000;
/** Steady for this long → try one step up again. */
const STEP_UP_AFTER_MS = 6 * 60_000;

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

/**
 * Rate control + GOP per encoder. Every 2 s must be an IDR frame (a clean
 * restart point), not just an I-frame: hardware encoders turn the forced
 * keyframes into plain I-frames unless told otherwise. Measured on Intel QSV:
 * an I-frame every 2 s but only ONE IDR in the whole stream — YouTube then
 * reports "keyframe frequency 13 s" and viewers buffer. The `forced idr`
 * switches make those 2-second keyframes real IDRs (closed GOP; no B-frames).
 */
function rateControlArgs(encoder, kbps, fps) {
  const b = `${kbps}k`;
  const buf = `${kbps * 2}k`;
  const gop = String(fps * 2);
  switch (encoder) {
    case "h264_nvenc":
      return ["-c:v", "h264_nvenc", "-preset", "p4", "-tune", "ll", "-rc", "cbr", "-b:v", b, "-maxrate", b, "-bufsize", buf, "-g", gop, "-bf", "0", "-forced-idr", "1", "-profile:v", "high"];
    case "h264_qsv":
      return ["-c:v", "h264_qsv", "-preset", "veryfast", "-b:v", b, "-maxrate", b, "-bufsize", buf, "-g", gop, "-bf", "0", "-forced_idr", "1", "-profile:v", "high"];
    case "h264_amf":
      return ["-c:v", "h264_amf", "-usage", "lowlatency", "-quality", "speed", "-rc", "cbr", "-b:v", b, "-maxrate", b, "-bufsize", buf, "-g", gop, "-bf", "0", "-forced_idr", "1"];
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
/**
 * recordPath: also keep this run's class video in a local file (the same
 * encoded stream, no second encode) — the class recording, uploaded after the
 * class so it plays in Atomic's own player. Written with the tee muxer; the
 * file side may fail without stopping the stream (onfail=ignore).
 */
function buildFfmpegArgs({ encoder, serverUrl, streamKey, fps = 30, profile = "1080p", audioKbps = 128, recordPath = null }) {
  const p = PROFILES[profile] || PROFILES["1080p"];
  if (p.fps) fps = Math.min(fps, p.fps);
  if (p.audioKbps) audioKbps = p.audioKbps;
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
    ...(recordPath
      ? [
          "-flags", "+global_header",
          "-f", "tee",
          `[f=flv:flvflags=no_duration_filesize]${joinRtmpUrl(serverUrl, streamKey)}|[f=matroska:onfail=ignore]${String(recordPath).replace(/\\/g, "/")}`,
        ]
      : ["-f", "flv", "-flvflags", "no_duration_filesize", joinRtmpUrl(serverUrl, streamKey)]),
  ];
}

/**
 * The class recording's upload copy: 720p, ~1.5 Mbps, AAC 96k, fast start
 * (plays while downloading), a keyframe every 2 s — ~0.7 GB per hour instead
 * of ~2.7 GB at the live 1080p bitrate. Same hardware encoder as the stream.
 */
function buildArchiveArgs({ encoder }) {
  const pix = encoder === "libopenh264" || encoder === "h264_nvenc" ? "yuv420p" : "nv12";
  return [
    "-map", "0:v:0",
    "-map", "0:a:0?",
    "-vf", `scale=-2:720:flags=bicubic,format=${pix}`,
    ...rateControlArgs(encoder, 1500, 30),
    "-force_key_frames", "expr:gte(t,n_forced*2)",
    "-c:a", "aac", "-b:a", "96k", "-ar", "48000", "-ac", "2",
    "-movflags", "+faststart",
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
  constructor({ runId, ffmpegPath, encoder, serverUrl, streamKey, fps, profile, recordDir = null, spawnImpl = spawn }) {
    super();
    this.runId = runId;
    this.ffmpegPath = ffmpegPath;
    this.encoder = encoder;
    this.serverUrl = serverUrl;
    this.streamKey = streamKey;
    this.fps = fps;
    this.profile = QUALITY_LADDER.includes(profile) ? profile : "1080p";
    // Never go above what the class was started with; a failed step-up lowers this.
    this.ceiling = QUALITY_LADDER.indexOf(this.profile);
    this.startIndex = this.ceiling;
    this.networkLimited = false;
    this.lagSince = 0;
    this.backedUpAt = 0;
    this.starvedNoted = false;
    this.procStartedAt = 0;
    this.firstOutAt = 0;
    this.firstOutTimeMs = 0;
    this.steadySince = 0;
    this.lastStepUpAt = 0;
    this.recentExits = [];
    this.spawnImpl = spawnImpl;
    // Local copy of the class (one part file per FFmpeg run: a reconnect starts a fresh one).
    this.recordDir = recordDir;
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
      quality: this.profile,
      networkLimited: this.networkLimited,
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
    const recordPath = this.recordDir ? require("node:path").join(this.recordDir, `part-${String(this.generation).padStart(3, "0")}.mkv`) : null;
    const args = buildFfmpegArgs({ encoder: this.encoder, serverUrl: this.serverUrl, streamKey: this.streamKey, fps: this.fps, profile: this.profile, recordPath });
    const proc = this.spawnImpl(this.ffmpegPath, args, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    this.proc = proc;
    this.lastProgressAt = Date.now();
    this.procStartedAt = Date.now();
    this.firstOutAt = 0;
    this.firstOutTimeMs = 0;
    this.lagSince = 0;
    this.backedUpAt = 0;
    this.steadySince = 0;
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
          this.checkNetwork(p.outTimeMs);
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

  /** How far this run's output is behind real time (ms). */
  lagMs(outTimeMs, now = Date.now()) {
    if (!this.firstOutAt) {
      this.firstOutAt = now;
      this.firstOutTimeMs = outTimeMs;
      return 0;
    }
    return now - this.firstOutAt - (outTimeMs - this.firstOutTimeMs);
  }

  /**
   * Called on every progress report. Output behind real time has two causes:
   *   - the upload (or encoder) can't carry this bitrate: FFmpeg stops taking
   *     data and its input queue grows → one step down helps;
   *   - the page sends the picture late (busy / throttled window): FFmpeg's
   *     queue stays empty → a lower quality would NOT help, it would only cost
   *     a restart (a gap on YouTube) and a blurrier board. Not a step down.
   * Measured on a class: it stepped 1080p → 720p → 720p-low (1.4 Mbps) in three
   * minutes on 1-second blips, each restart leaving a gap on YouTube.
   * A long steady stretch → one step back up (a step-up that fails lowers the
   * ceiling for good).
   */
  checkNetwork(outTimeMs, now = Date.now()) {
    const lag = this.lagMs(outTimeMs, now);
    if (now - this.procStartedAt < WARMUP_MS) return;
    if (lag > LAG_STEP_DOWN_MS) {
      this.steadySince = 0;
      if (now - this.backedUpAt > BACKLOG_RECENT_MS) {
        // Input starved, not the upload.
        this.lagSince = 0;
        if (!this.starvedNoted) {
          this.starvedNoted = true;
          this.stderrTail.push(`picture arriving late (~${Math.round(lag / 1000)} s behind, upload keeping up) — quality kept`);
        }
        return;
      }
      if (!this.lagSince) this.lagSince = now;
      if (now - this.lagSince >= LAG_SUSTAIN_MS) this.changeQuality(+1, `upload ~${Math.round(lag / 1000)} s behind`);
      return;
    }
    this.lagSince = 0;
    if (lag < 1500) {
      if (!this.steadySince) this.steadySince = now;
      const idx = QUALITY_LADDER.indexOf(this.profile);
      if (idx > this.ceiling && now - this.steadySince > STEP_UP_AFTER_MS && now - this.lastStepUpAt > STEP_UP_AFTER_MS) {
        this.lastStepUpAt = now;
        this.steppedUpFrom = idx;
        this.changeQuality(-1, "connection steady");
      }
    } else {
      this.steadySince = 0;
    }
  }

  /** Moves along the ladder (+1 = lower quality) and restarts FFmpeg at once. */
  changeQuality(direction, why) {
    const idx = QUALITY_LADDER.indexOf(this.profile);
    const next = Math.min(QUALITY_LADDER.length - 1, Math.max(this.ceiling, idx + direction));
    if (next === idx || this.stopping || this.adapting) return false;
    // Stepped up and fell behind again: that level is too much for this line.
    if (direction > 0 && this.steppedUpFrom !== undefined && idx < this.steppedUpFrom) {
      this.ceiling = Math.max(this.ceiling, this.steppedUpFrom);
    }
    if (direction > 0) this.steppedUpFrom = undefined;
    this.profile = QUALITY_LADDER[next];
    this.networkLimited = next > this.startIndex;
    this.stderrTail.push(`quality ${QUALITY_LADDER[idx]} -> ${this.profile} (${why})`);
    this.adapting = true;
    this.proc?.kill();
    return true;
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
    // A quality change: restart straight away at the new level (not a failure).
    if (this.adapting) {
      this.adapting = false;
      this.state = "reconnecting";
      this.error = undefined;
      this.emitStatus();
      this.restartTimer = setTimeout(() => {
        if (this.stopping) return;
        this.generation++;
        this.spawnProcess();
      }, 300);
      return;
    }
    // Unexpected exit (network drop, YouTube closed the connection, stall):
    // restart with backoff; the page re-sends a fresh WebM stream for the
    // new generation. Dropping twice within two minutes also means the line
    // can't hold this quality: come back one step lower.
    const nowExit = Date.now();
    this.recentExits = this.recentExits.filter((t) => nowExit - t < 120_000);
    this.recentExits.push(nowExit);
    if (this.recentExits.length >= 2) {
      const idx = QUALITY_LADDER.indexOf(this.profile);
      if (idx < QUALITY_LADDER.length - 1) {
        this.profile = QUALITY_LADDER[idx + 1];
        this.networkLimited = true;
        this.stderrTail.push(`quality ${QUALITY_LADDER[idx]} -> ${this.profile} (connection dropped twice)`);
        this.recentExits = [];
      }
    }
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
      const ok = this.proc.stdin.write(Buffer.from(chunk));
      // (write() is false past 16 KB — every chunk; only a real backlog counts.)
      if (this.proc.stdin.writableLength > BACKLOG_BYTES) this.backedUpAt = Date.now();
      return ok;
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
  LAG_SUSTAIN_MS,
  ENCODER_PREFERENCE,
  PROFILES,
  QUALITY_LADDER,
  probeEncoders,
  buildFfmpegArgs,
  buildArchiveArgs,
  parseProgressBlock,
  joinRtmpUrl,
  redact,
  EncoderRun,
  BACKOFF_MS,
};
