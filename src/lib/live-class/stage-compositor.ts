/**
 * Stage compositor: turns what the teacher sees on the whiteboard into ONE
 * video — board strokes, slide background and the teacher's camera — plus
 * the teacher's microphone, as a MediaStream. In the desktop app this
 * stream goes to the local encoder and on to YouTube (step 9), so the
 * YouTube video (and its recording) always contains the whiteboard, with no
 * screen capture, no OBS scene and no second copy of the board to keep in
 * sync.
 *
 * Browser-only (uses canvas/getUserMedia); import it from client components.
 *
 * Canvas taint safety: a canvas that ever had a cross-origin image drawn on
 * it can no longer be captured, and captureStream() would throw. So:
 *   - the slide background is loaded by the compositor itself with
 *     crossOrigin="anonymous"; if CORS fails, the background is skipped
 *     (never drawn tainted);
 *   - each board layer is checked once; a tainted layer is skipped.
 * Any skipped source is reported in `warnings` — the stream itself keeps
 * running.
 */

import { ChromaKeyer, drawKeyedTeacher, type ChromaSettings } from "@/lib/live-class/chroma-key";
import { MIC_CONSTRAINTS, createVoiceFilter } from "@/lib/live-class/voice-filter";
import { chatVoteHint, type PollOption } from "@/lib/live-class/youtube-poll";

export type CameraShape = "CIRCULAR" | "SQUARE";

export interface StageSources {
  /** Board canvases, bottom to top (e.g. the engine's base + active layers). */
  boardLayers: HTMLCanvasElement[];
  /** Solid page colour behind everything (named slide themes). */
  backgroundColor: string | null;
  /** Uploaded slide / PDF page image, if the page has one. */
  backgroundImageUrl: string | null;
  /** Named slide template (atomic_white, ruled, grid, dotted, black, ...) — drawn into the video. */
  backgroundTemplate?: string | null;
  cameraShape: CameraShape;
  /** UPPER_RIGHT | UPPER_LEFT | LOWER_RIGHT | LOWER_LEFT */
  cameraPosition: string;
  showCamera: boolean;
  /** Green/blue screen removal for the camera (teacher cut out over the board). */
  chroma?: ChromaSettings | null;
  /** The open poll — drawn into the video so YouTube viewers can answer in the chat. */
  poll?: StagePoll | null;
}

export interface StagePoll {
  questionText: string | null;
  options: PollOption[];
  status: "ACTIVE" | "REVEALED";
  /** Epoch ms the poll opened (for the countdown). */
  startedAtMs: number;
  timeLimitSec: number;
  correctOption?: string | null;
  /** Per-option totals — only after reveal (never leak the vote before). */
  counts?: Record<string, number> | null;
  totalResponses?: number | null;
}

/** Stage poll from the room's quiz state (null when nothing should show). */
export function toStagePoll(
  quiz: { questionText: string | null; options: PollOption[]; status: string; startedAt?: string | null; timeLimitSec: number; correctOption?: string | null } | null | undefined,
  revealed?: { counts?: Record<string, number> | null; totalResponses?: number | null } | null
): StagePoll | null {
  if (!quiz || (quiz.status !== "ACTIVE" && quiz.status !== "REVEALED")) return null;
  const startedAtMs = quiz.startedAt ? Date.parse(quiz.startedAt) : NaN;
  return {
    questionText: quiz.questionText,
    options: quiz.options,
    status: quiz.status,
    startedAtMs: Number.isFinite(startedAtMs) ? startedAtMs : Date.now(),
    timeLimitSec: quiz.timeLimitSec,
    correctOption: quiz.status === "REVEALED" ? quiz.correctOption ?? null : null,
    counts: quiz.status === "REVEALED" ? revealed?.counts ?? null : null,
    totalResponses: quiz.status === "REVEALED" ? revealed?.totalResponses ?? null : null,
  };
}

/** Word-wraps `text` to `maxWidth`, at most `maxLines` lines (last one ellipsised). */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    let last = lines[maxLines - 1]!;
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

/**
 * The poll card in the class video (bottom-left): question, options, timer
 * and how to answer from YouTube; after reveal the right answer and the
 * share of votes per option. Dark glass so it reads on any slide template.
 * Returns the card rect (tests check it stays inside the frame).
 */
export function drawPollCard(ctx: CanvasRenderingContext2D, poll: StagePoll, W: number, H: number, now = Date.now()): Rect {
  const s = H / 1080;
  const pad = 22 * s;
  const w = Math.round(W * 0.3);
  const rowH = 46 * s;
  const gap = 8 * s;
  ctx.save();
  ctx.font = `700 ${Math.round(26 * s)}px system-ui, sans-serif`;
  const q = wrapLines(ctx, poll.questionText?.trim() || "Quick poll", w - pad * 2, 3);
  const qLineH = 34 * s;
  const headH = 34 * s;
  const footH = 40 * s;
  const h = Math.round(pad + headH + q.length * qLineH + 10 * s + poll.options.length * (rowH + gap) + footH + pad * 0.6);
  const x = Math.round(28 * s);
  const y = Math.round(H - h - 28 * s);

  ctx.fillStyle = "rgba(10, 12, 22, 0.88)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 18 * s);
  ctx.fill();
  ctx.lineWidth = 2 * s;
  ctx.strokeStyle = "rgba(234, 88, 12, 0.9)";
  ctx.stroke();

  // Header: LIVE POLL + countdown / result.
  let cy = y + pad;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.font = `800 ${Math.round(20 * s)}px system-ui, sans-serif`;
  ctx.fillStyle = "#fb923c";
  ctx.fillText("LIVE POLL", x + pad, cy);
  ctx.textAlign = "right";
  if (poll.status === "ACTIVE") {
    const left = Math.max(0, Math.ceil((poll.startedAtMs + poll.timeLimitSec * 1000 - now) / 1000));
    ctx.fillStyle = left <= 5 ? "#f87171" : "#e2e8f0";
    ctx.fillText(left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "Time up", x + w - pad, cy);
  } else {
    ctx.fillStyle = "#4ade80";
    ctx.fillText("RESULT", x + w - pad, cy);
  }
  cy += headH;

  ctx.textAlign = "left";
  ctx.font = `700 ${Math.round(26 * s)}px system-ui, sans-serif`;
  ctx.fillStyle = "#ffffff";
  for (const line of q) {
    ctx.fillText(line, x + pad, cy);
    cy += qLineH;
  }
  cy += 10 * s;

  const total = poll.totalResponses ?? 0;
  for (const o of poll.options) {
    const isRight = poll.status === "REVEALED" && poll.correctOption === o.key;
    const share = poll.status === "REVEALED" && total > 0 ? (poll.counts?.[o.key] ?? 0) / total : null;
    const rx = x + pad;
    const rw = w - pad * 2;
    ctx.fillStyle = isRight ? "rgba(22, 163, 74, 0.35)" : "rgba(255, 255, 255, 0.08)";
    ctx.beginPath();
    ctx.roundRect(rx, cy, rw, rowH, 10 * s);
    ctx.fill();
    if (share !== null && share > 0) {
      ctx.fillStyle = isRight ? "rgba(34, 197, 94, 0.55)" : "rgba(148, 163, 184, 0.35)";
      ctx.beginPath();
      ctx.roundRect(rx, cy, Math.max(12 * s, rw * share), rowH, 10 * s);
      ctx.fill();
    }
    if (isRight) {
      ctx.lineWidth = 2 * s;
      ctx.strokeStyle = "#22c55e";
      ctx.beginPath();
      ctx.roundRect(rx, cy, rw, rowH, 10 * s);
      ctx.stroke();
    }
    // Key chip
    const chip = 32 * s;
    ctx.fillStyle = isRight ? "#16a34a" : "#ea580c";
    ctx.beginPath();
    ctx.roundRect(rx + 8 * s, cy + (rowH - chip) / 2, chip, chip, 8 * s);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${Math.round(20 * s)}px system-ui, sans-serif`;
    ctx.fillText(o.key, rx + 8 * s + chip / 2, cy + rowH / 2 + 1 * s);
    // Label + percentage
    ctx.textAlign = "left";
    ctx.font = `600 ${Math.round(22 * s)}px system-ui, sans-serif`;
    const pctText = share !== null ? `${Math.round(share * 100)}%` : "";
    const pctW = pctText ? ctx.measureText(pctText).width + 14 * s : 0;
    const labelMax = rw - chip - 28 * s - pctW;
    let label = o.label;
    while (label.length > 1 && ctx.measureText(label).width > labelMax) label = label.slice(0, -2) + "…";
    ctx.fillText(label, rx + chip + 20 * s, cy + rowH / 2 + 1 * s);
    if (pctText) {
      ctx.textAlign = "right";
      ctx.font = `800 ${Math.round(22 * s)}px system-ui, sans-serif`;
      ctx.fillText(pctText, rx + rw - 12 * s, cy + rowH / 2 + 1 * s);
    }
    ctx.textBaseline = "top";
    cy += rowH + gap;
  }

  // Footer: how to answer (open) / the answer (revealed).
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = `700 ${Math.round(21 * s)}px system-ui, sans-serif`;
  if (poll.status === "ACTIVE") {
    ctx.fillStyle = "#fca5a5";
    ctx.fillText(chatVoteHint(poll.options), x + pad, cy + 6 * s);
  } else {
    ctx.fillStyle = "#4ade80";
    const right = poll.options.find((o) => o.key === poll.correctOption);
    ctx.fillText(right ? `Answer: ${right.key}${right.label && right.label !== right.key ? ` — ${right.label}` : ""}` : "Poll closed", x + pad, cy + 6 * s);
  }
  ctx.restore();
  return { x, y, w, h };
}

/** Templates that carry the Atomic Pathshala brand band (logo + name). */
export function isBrandedTemplate(template: string | null | undefined): boolean {
  return !template || template.startsWith("atomic_");
}

/**
 * Draws a named slide template exactly like the teacher's board CSS does, so
 * students on YouTube see the same page (before this, the video showed a
 * flat colour: no brand band, lines, grid or dots). Pattern sizes follow the
 * teacher's 960x540 board, scaled to the video.
 */
export function drawSlideTemplate(
  ctx: CanvasRenderingContext2D,
  template: string | null | undefined,
  W: number,
  H: number,
  logo: HTMLImageElement | null
) {
  const s = H / 540;
  const fill = (c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, W, H);
  };
  const lines = (step: number, color: string, vertical: boolean, horizontal: boolean, from = 0) => {
    ctx.fillStyle = color;
    const px = Math.max(1, Math.round(s));
    if (horizontal) for (let y = from + step * s - px; y < H; y += step * s) ctx.fillRect(0, Math.round(y), W, px);
    if (vertical) for (let x = step * s - px; x < W; x += step * s) ctx.fillRect(Math.round(x), from, px, H - from);
  };
  const band = (bandColor: string, textColor: string) => {
    const bh = 36 * s;
    ctx.fillStyle = bandColor;
    ctx.fillRect(0, 0, W, bh);
    ctx.fillStyle = "#ea580c";
    ctx.fillRect(0, bh, W, 2 * s);
    if (logo && logo.complete && logo.naturalWidth > 0) {
      const lh = 26 * s;
      const lw = (logo.naturalWidth / logo.naturalHeight) * lh;
      ctx.drawImage(logo, 12 * s, (bh - lh) / 2, lw, lh);
    }
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    ctx.font = `800 ${Math.round(11 * s)}px system-ui, sans-serif`;
    ctx.fillStyle = "#ea580c";
    ctx.fillText("PATHSHALA", W - 14 * s, bh / 2);
    const pw = ctx.measureText("PATHSHALA").width;
    ctx.fillStyle = textColor;
    ctx.fillText("ATOMIC", W - 20 * s - pw, bh / 2);
    return bh + 2 * s;
  };
  switch (template) {
    case "atomic_dark":
      fill("#0d0f17");
      band("#171924", "#e2e8f0");
      return;
    case "atomic_ruled": {
      fill("#ffffff");
      const top = band("#fff7ed", "#1e293b");
      lines(28, "#e2e8f0", false, true, top);
      return;
    }
    case "ruled":
    case "notebook":
      fill("#ffffff");
      lines(28, "#e2e8f0", false, true);
      return;
    case "grid":
      fill("#ffffff");
      lines(20, "#9ca3af", true, true);
      return;
    case "coordinate":
      fill("#ffffff");
      lines(20, "#d1d5db", true, true);
      ctx.fillStyle = "rgba(59,130,246,0.7)";
      ctx.fillRect(0, H / 2 - s, W, 2 * s);
      ctx.fillRect(W / 2 - s, 0, 2 * s, H);
      return;
    case "dotted": {
      fill("#ffffff");
      ctx.fillStyle = "#9ca3af";
      const step = 20 * s;
      const r = 1.5 * s;
      for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W; x += step) ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
      return;
    }
    case "dark":
      fill("#1a1b23");
      return;
    case "black":
      fill("#000000");
      return;
    case "blank":
      fill("#f8fafc");
      return;
    case "light":
      fill("#ffffff");
      return;
    case "atomic_white":
    default:
      fill("#ffffff");
      band("#fff7ed", "#1e293b");
  }
}

export interface StageCompositorOptions {
  width?: number;
  height?: number;
  fps?: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Largest rect of aspect `srcW:srcH` that fits inside `dst`, centred. */
export function containRect(srcW: number, srcH: number, dst: Rect): Rect {
  if (srcW <= 0 || srcH <= 0) return { ...dst };
  const scale = Math.min(dst.w / srcW, dst.h / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { x: dst.x + (dst.w - w) / 2, y: dst.y + (dst.h - h) / 2, w, h };
}

/** Source crop of `srcW:srcH` that fills a `dstW:dstH` box (like object-fit: cover). */
export function coverCrop(srcW: number, srcH: number, dstW: number, dstH: number): Rect {
  const srcAspect = srcW / srcH;
  const dstAspect = dstW / dstH;
  if (srcAspect > dstAspect) {
    const w = srcH * dstAspect;
    return { x: (srcW - w) / 2, y: 0, w, h: srcH };
  }
  const h = srcW / dstAspect;
  return { x: 0, y: (srcH - h) / 2, w: srcW, h };
}

/** Camera box on the stage for a corner position. */
/**
 * The teacher can drag/resize their camera bubble anywhere on the board. That
 * layout travels as the session's cameraPosition "FREE:x,y,size" — fractions
 * of the board (x, y = top-left; size = diameter / board height) — so the
 * stage, OBS and students show the camera exactly where the teacher put it.
 */
export function parseFreeCameraLayout(position: string | null | undefined): { x: number; y: number; size: number } | null {
  const m = /^FREE:([0-9.]+),([0-9.]+),([0-9.]+)$/.exec(position ?? "");
  if (!m) return null;
  const [x, y, size] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (![x, y, size].every((n) => Number.isFinite(n) && n >= 0 && n <= 1) || size < 0.05) return null;
  return { x, y, size };
}

export function formatFreeCameraLayout(x: number, y: number, size: number): string {
  const f = (n: number) => Math.min(1, Math.max(0, n)).toFixed(3);
  return `FREE:${f(x)},${f(y)},${f(size)}`;
}

export function cameraRect(position: string, stageW: number, stageH: number, size: number, margin: number): Rect {
  const free = parseFreeCameraLayout(position);
  if (free) {
    const s = Math.round(free.size * stageH);
    return {
      x: Math.min(Math.max(0, Math.round(free.x * stageW)), stageW - s),
      y: Math.min(Math.max(0, Math.round(free.y * stageH)), stageH - s),
      w: s,
      h: s,
    };
  }
  const left = position.endsWith("LEFT");
  const top = position.startsWith("UPPER");
  return {
    x: left ? margin : stageW - margin - size,
    y: top ? margin : stageH - margin - size,
    w: size,
    h: size,
  };
}

export class StageCompositor {
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly canvas: HTMLCanvasElement;
  readonly warnings: string[] = [];

  private readonly ctx: CanvasRenderingContext2D;
  private sources: StageSources = {
    boardLayers: [],
    backgroundColor: "#ffffff",
    backgroundImageUrl: null,
    cameraShape: "CIRCULAR",
    cameraPosition: "UPPER_RIGHT",
    showCamera: true,
  };
  private bgImage: HTMLImageElement | null = null;
  private bgImageUrl: string | null = null;
  private bgImageReady = false;
  private warnedTaintedLayer = false;
  private readonly probe: CanvasRenderingContext2D | null;
  private cameraVideo: HTMLVideoElement | null = null;
  private logoImage: HTMLImageElement | null = null;
  private keyer: ChromaKeyer | null = null;
  private stopVoiceFilter: (() => Promise<void>) | null = null;

  /** The real Atomic Pathshala logo for the brand band (same origin: never taints the canvas). */
  private brandLogo(): HTMLImageElement | null {
    if (!this.logoImage && typeof Image !== "undefined") {
      const img = new Image();
      img.src = "/brand/logo.png";
      this.logoImage = img;
    }
    return this.logoImage;
  }
  private mediaStreams: MediaStream[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private output: MediaStream | null = null;
  // Explicit frame push (Chromium's MediaStreamTrackGenerator): each drawn
  // frame is handed to the video track directly. canvas.captureStream()
  // instead depends on the page being painted, and Windows stops painting a
  // minimised/covered window — the class then sent NO video to YouTube
  // ("No data", 11 s keyframes) while the teacher looked at another app.
  private frameWriter: WritableStreamDefaultWriter<unknown> | null = null;
  private framePending = false;
  // Frame timestamps count from the stage start (not page load): a stream that
  // began minutes into the page would otherwise make the encoder pad the gap.
  private frameEpoch = 0;

  constructor(opts: StageCompositorOptions = {}) {
    this.width = opts.width ?? 1920;
    this.height = opts.height ?? 1080;
    this.fps = opts.fps ?? 30;
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    const ctx = this.canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D canvas is not available.");
    this.ctx = ctx;
    const probeCanvas = document.createElement("canvas");
    probeCanvas.width = 1;
    probeCanvas.height = 1;
    this.probe = probeCanvas.getContext("2d", { willReadFrequently: true });
  }

  /** Updates what the stage shows; call whenever the page, theme or camera layout changes. */
  setSources(next: Partial<StageSources>) {
    this.sources = { ...this.sources, ...next };
    if (next.backgroundImageUrl !== undefined && next.backgroundImageUrl !== this.bgImageUrl) {
      this.loadBackground(next.backgroundImageUrl);
    }
  }

  /**
   * Starts drawing and returns the output stream (video from the stage
   * canvas + the microphone track). Camera/mic failures are recorded in
   * `warnings`; the stage still runs (board only / silent).
   */
  async start(media: { camera: boolean; microphone: boolean; cameraDeviceId?: string; microphoneDeviceId?: string }) {
    if (this.output) return this.output;
    const Generator = (globalThis as { MediaStreamTrackGenerator?: new (init: { kind: "video" }) => MediaStreamTrack & { writable: WritableStream } }).MediaStreamTrackGenerator;
    let output: MediaStream;
    if (typeof Generator === "function" && typeof VideoFrame === "function") {
      const track = new Generator({ kind: "video" });
      this.frameWriter = track.writable.getWriter();
      this.frameEpoch = performance.now();
      output = new MediaStream([track]);
    } else {
      output = this.canvas.captureStream(this.fps);
    }

    if (media.camera && navigator.mediaDevices?.getUserMedia) {
      try {
        const cam = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: this.fps },
            ...(media.cameraDeviceId ? { deviceId: { exact: media.cameraDeviceId } } : {}),
          },
          audio: false,
        });
        this.mediaStreams.push(cam);
        const video = document.createElement("video");
        video.muted = true;
        video.playsInline = true;
        video.srcObject = cam;
        await video.play().catch(() => undefined);
        this.cameraVideo = video;
      } catch (err) {
        this.warnings.push(`Camera unavailable: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (media.microphone && navigator.mediaDevices?.getUserMedia) {
      try {
        const mic = await navigator.mediaDevices.getUserMedia({
          audio: {
            ...MIC_CONSTRAINTS,
            ...(media.microphoneDeviceId ? { deviceId: { exact: media.microphoneDeviceId } } : {}),
          },
          video: false,
        });
        this.mediaStreams.push(mic);
        // Voice filter: rumble/hiss filters, close-talk noise gate, compressor.
        const raw = mic.getAudioTracks()[0];
        if (raw) {
          const vf = await createVoiceFilter(raw);
          this.stopVoiceFilter = vf.stop;
          if (!vf.filtered) this.warnings.push("Voice filter unavailable — sending the microphone unfiltered.");
          else if (!vf.rnnoise) this.warnings.push("AI noise suppression unavailable — using the basic voice filter.");
          output.addTrack(vf.track);
        }
      } catch (err) {
        this.warnings.push(`Microphone unavailable: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    this.tick();
    this.timer = setInterval(() => this.tick(), Math.round(1000 / this.fps));
    this.output = output;
    return output;
  }

  private tick() {
    this.drawFrame();
    const writer = this.frameWriter;
    if (!writer || this.framePending) return; // encoder busy: drop this frame rather than queue
    let frame: VideoFrame;
    try {
      frame = new VideoFrame(this.canvas, { timestamp: Math.round((performance.now() - this.frameEpoch) * 1000) });
    } catch {
      return;
    }
    this.framePending = true;
    writer
      .write(frame)
      .catch(() => undefined)
      .finally(() => {
        frame.close();
        this.framePending = false;
      });
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    void this.stopVoiceFilter?.();
    this.stopVoiceFilter = null;
    this.frameWriter?.close().catch(() => undefined);
    this.frameWriter = null;
    for (const s of this.mediaStreams) s.getTracks().forEach((t) => t.stop());
    this.mediaStreams = [];
    this.output?.getTracks().forEach((t) => t.stop());
    this.output = null;
    if (this.cameraVideo) this.cameraVideo.srcObject = null;
    this.cameraVideo = null;
  }

  /** Draws one frame. Public so tests/previews can render without starting media. */
  drawFrame() {
    const { ctx, width: W, height: H } = this;
    const stage: Rect = { x: 0, y: 0, w: W, h: H };

    if (this.sources.backgroundTemplate !== undefined && !(this.bgImage && this.bgImageReady)) {
      drawSlideTemplate(ctx, this.sources.backgroundTemplate, W, H, this.brandLogo());
    } else {
      ctx.fillStyle = this.sources.backgroundColor || "#ffffff";
      ctx.fillRect(0, 0, W, H);
    }

    if (this.bgImage && this.bgImageReady) {
      const r = containRect(this.bgImage.naturalWidth, this.bgImage.naturalHeight, stage);
      ctx.drawImage(this.bgImage, r.x, r.y, r.w, r.h);
    }

    for (const layer of this.sources.boardLayers) {
      if (!layer.width || !layer.height || !this.isLayerSafe(layer)) continue;
      const r = containRect(layer.width, layer.height, stage);
      ctx.drawImage(layer, r.x, r.y, r.w, r.h);
    }

    const video = this.cameraVideo;
    if (this.sources.showCamera && video && video.readyState >= 2 && video.videoWidth > 0) {
      const size = Math.round(H * 0.26);
      const box = cameraRect(this.sources.cameraPosition, W, H, size, Math.round(H * 0.035));
      const crop = coverCrop(video.videoWidth, video.videoHeight, box.w, box.h);
      const chroma = this.sources.chroma;
      if (chroma?.enabled) {
        this.keyer ??= new ChromaKeyer();
        if (this.keyer.supported) {
          this.keyer.setSettings(chroma);
          const keyed = this.keyer.process(video, video.videoWidth, video.videoHeight);
          if (keyed) {
            // Keyed teacher: no bubble, no ring — just the person over the board.
            drawKeyedTeacher(ctx, keyed, crop, box, Boolean(chroma.naturalShadow));
            return this.drawOverlays();
          }
        } else if (!this.warnedChroma) {
          this.warnedChroma = true;
          this.warnings.push("Chroma key needs WebGL, which isn't available here — camera shown without it.");
        }
      }
      ctx.save();
      ctx.beginPath();
      if (this.sources.cameraShape === "CIRCULAR") {
        ctx.arc(box.x + box.w / 2, box.y + box.h / 2, box.w / 2, 0, Math.PI * 2);
      } else {
        ctx.roundRect(box.x, box.y, box.w, box.h, Math.round(box.w * 0.08));
      }
      ctx.clip();
      ctx.drawImage(video, crop.x, crop.y, crop.w, crop.h, box.x, box.y, box.w, box.h);
      ctx.restore();
      ctx.save();
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      if (this.sources.cameraShape === "CIRCULAR") {
        ctx.arc(box.x + box.w / 2, box.y + box.h / 2, box.w / 2, 0, Math.PI * 2);
      } else {
        ctx.roundRect(box.x, box.y, box.w, box.h, Math.round(box.w * 0.08));
      }
      ctx.stroke();
      ctx.restore();
    }

    this.drawOverlays();
  }

  /** Everything drawn above the board and camera. */
  private drawOverlays() {
    if (this.sources.poll) drawPollCard(this.ctx, this.sources.poll, this.width, this.height);
    this.drawChannelMark();
  }

  private warnedChroma = false;

  private drawChannelMark() {
    const { ctx, width: W, height: H } = this;
    // Small, unobtrusive channel mark so a clipped recording is attributable.
    ctx.save();
    ctx.font = `600 ${Math.round(H * 0.018)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(15, 23, 42, 0.45)";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText("Atomic Pathshala", W - Math.round(H * 0.03), H - Math.round(H * 0.025));
    ctx.restore();
  }

  private loadBackground(url: string | null) {
    this.bgImageUrl = url;
    this.bgImageReady = false;
    this.bgImage = null;
    if (!url) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      if (this.bgImageUrl === url) {
        this.bgImage = img;
        this.bgImageReady = true;
      }
    };
    img.onerror = () => {
      if (this.bgImageUrl === url) {
        this.warnings.push("Slide background could not be loaded for the stream (CORS); it is left out of the video.");
      }
    };
    img.src = url;
  }

  /**
   * A layer that would taint the stage canvas is skipped instead of breaking
   * the stream. Checked every frame (a 1×1 probe is cheap), because a layer
   * can become cross-origin later — e.g. when an image is dropped on the board.
   */
  private isLayerSafe(layer: HTMLCanvasElement): boolean {
    if (!this.probe) return true;
    try {
      this.probe.clearRect(0, 0, 1, 1);
      this.probe.drawImage(layer, 0, 0, 1, 1);
      this.probe.getImageData(0, 0, 1, 1);
      return true;
    } catch {
      if (!this.warnedTaintedLayer) {
        this.warnedTaintedLayer = true;
        this.warnings.push("A board layer contains cross-origin content and is left out of the video.");
      }
      return false;
    }
  }
}
