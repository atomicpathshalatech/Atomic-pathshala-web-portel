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

export type CameraShape = "CIRCULAR" | "SQUARE";

export interface StageSources {
  /** Board canvases, bottom to top (e.g. the engine's base + active layers). */
  boardLayers: HTMLCanvasElement[];
  /** Solid page colour behind everything (named slide themes). */
  backgroundColor: string | null;
  /** Uploaded slide / PDF page image, if the page has one. */
  backgroundImageUrl: string | null;
  cameraShape: CameraShape;
  /** UPPER_RIGHT | UPPER_LEFT | LOWER_RIGHT | LOWER_LEFT */
  cameraPosition: string;
  showCamera: boolean;
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
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            ...(media.microphoneDeviceId ? { deviceId: { exact: media.microphoneDeviceId } } : {}),
          },
          video: false,
        });
        this.mediaStreams.push(mic);
        for (const track of mic.getAudioTracks()) output.addTrack(track);
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

    ctx.fillStyle = this.sources.backgroundColor || "#ffffff";
    ctx.fillRect(0, 0, W, H);

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
