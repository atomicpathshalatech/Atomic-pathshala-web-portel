/**
 * Sends the class to YouTube from the Atomic Pathshala Teacher desktop app:
 *
 *   StageCompositor (board + slide + camera, mic)  →  MediaRecorder (WebM,
 *   250 ms chunks)  →  window.atomicDesktop.encoder  →  FFmpeg  →  YouTube
 *
 * The teacher never sees OBS, an RTMP URL or a stream key: the key comes
 * from the class's own stream lease and goes straight to the local encoder.
 *
 * Browser-only; used by the teacher room when getDesktopBridge() is present.
 */
import type { AtomicDesktopBridge, DesktopEncoderStatus } from "@/lib/desktop/bridge";
import { StageCompositor, type StageSources } from "@/lib/live-class/stage-compositor";
import { sanitizeChroma, type ChromaSettings } from "@/lib/live-class/chroma-key";

const RECORDER_TYPES = ["video/webm;codecs=h264,opus", "video/webm;codecs=vp8,opus", "video/webm"];

export function pickRecorderMimeType(
  isTypeSupported: (t: string) => boolean = (t) => MediaRecorder.isTypeSupported(t),
  skip = 0
): string {
  return RECORDER_TYPES.filter((t) => isTypeSupported(t))[skip] ?? "video/webm";
}

// A recorder that hasn't produced any data this long after start is stuck
// (seen: the H.264 recorder in the offscreen stage never starting while the
// hardware encoder was busy) — fall back to the next format (VP8, CPU).
const RECORDER_STALL_MS = 8000;

export class DesktopClassStreamer {
  private compositor: StageCompositor | null = null;
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private runId: string | null = null;
  private generation = 0;
  private chain: Promise<void> = Promise.resolve();
  private unsubscribe: (() => void) | null = null;
  private sourceTimer: ReturnType<typeof setInterval> | null = null;
  private silentAudio: AudioContext | null = null;
  encoderName: string | null = null;
  private cameraOff = false;
  private micMuted = false;

  /** Teacher's emergency switches: take the camera out of the video / mute the mic in the stream. */
  setCameraOff(off: boolean) {
    this.cameraOff = off;
    this.compositor?.setSources(this.currentSources());
  }

  setMicMuted(muted: boolean) {
    this.micMuted = muted;
    this.applyMicMute();
  }

  private applyMicMute() {
    for (const t of this.stream?.getAudioTracks() ?? []) {
      if (t !== this.silentTrack) t.enabled = !this.micMuted;
    }
  }

  private chroma: ChromaSettings | null = null;

  /** Green/blue screen removal for the camera in the class video. */
  setChroma(settings: unknown) {
    this.chroma = settings ? sanitizeChroma(settings) : null;
    this.compositor?.setSources(this.currentSources());
  }

  private currentSources() {
    const s = { ...this.readSources(), chroma: this.chroma };
    return this.cameraOff ? { ...s, showCamera: false } : s;
  }

  private silentTrack: MediaStreamTrack | null = null;

  constructor(
    private readonly bridge: AtomicDesktopBridge,
    private readonly readSources: () => Partial<StageSources>,
    private readonly onStatus: (status: DesktopEncoderStatus & { warnings?: string[] }) => void
  ) {}

  get running() {
    return this.runId !== null;
  }

  async start(opts: { serverUrl: string; streamKey: string; profile?: "1080p" | "720p" }) {
    if (this.runId) return;
    const compositor = new StageCompositor({ width: 1920, height: 1080, fps: 30 });
    this.compositor = compositor;
    compositor.setSources(this.currentSources());
    const stream = await compositor.start({ camera: true, microphone: true });
    if (stream.getAudioTracks().length === 0) {
      this.silentTrack = this.silentAudioTrack();
      stream.addTrack(this.silentTrack);
    }
    this.stream = stream;
    this.applyMicMute();

    // Keep the stage in step with the board (page changes, theme, camera layout).
    this.sourceTimer = setInterval(() => this.compositor?.setSources(this.currentSources()), 1000);

    const { runId, encoder } = await this.bridge.encoder.start({
      serverUrl: opts.serverUrl,
      streamKey: opts.streamKey,
      fps: 30,
      profile: opts.profile ?? "1080p",
    });
    this.runId = runId;
    this.encoderName = encoder;
    this.unsubscribe = this.bridge.encoder.onStatus((status) => {
      if (status.runId !== this.runId) return;
      // After a reconnect the encoder is a fresh FFmpeg that needs a fresh
      // WebM stream (header first): restart the recorder for that generation.
      if (typeof status.generation === "number" && status.generation !== this.generation) {
        this.generation = status.generation;
        this.startRecorder();
      }
      this.onStatus({ ...status, warnings: [...compositor.warnings] });
    });
    this.startRecorder();
    this.onStatus({ runId, state: "starting", encoder, warnings: [...compositor.warnings] });
  }

  private recorderFallback = 0;
  private recorderWatchdog: ReturnType<typeof setTimeout> | null = null;

  private startRecorder() {
    if (!this.stream || !this.runId) return;
    if (this.recorderWatchdog) clearTimeout(this.recorderWatchdog);
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.ondataavailable = null;
      this.recorder.stop();
    }
    const runId = this.runId;
    const generation = this.generation;
    const mimeType = pickRecorderMimeType(undefined, this.recorderFallback);
    let gotData = false;
    const recorder = new MediaRecorder(this.stream, {
      mimeType,
      videoBitsPerSecond: 8_000_000,
      audioBitsPerSecond: 128_000,
    });
    recorder.ondataavailable = (e) => {
      if (!e.data || e.data.size === 0) return;
      gotData = true;
      // Keep chunk order: arrayBuffer() is async, so serialise the pushes.
      this.chain = this.chain
        .then(() => e.data.arrayBuffer())
        .then((buf) => {
          if (this.runId === runId) this.bridge.encoder.push(runId, generation, buf);
        })
        .catch(() => undefined);
    };
    recorder.start(250);
    this.recorder = recorder;
    this.recorderWatchdog = setTimeout(() => {
      if (gotData || this.recorder !== recorder || this.runId !== runId) return;
      const next = this.recorderFallback + 1;
      if (pickRecorderMimeType(undefined, next) === mimeType) return; // nothing else to try
      console.warn(`[desktop_streamer] ${mimeType} recorder produced nothing in ${RECORDER_STALL_MS} ms — switching format`);
      this.recorderFallback = next;
      this.startRecorder();
    }, RECORDER_STALL_MS);
  }

  private silentAudioTrack(): MediaStreamTrack {
    const ctx = new AudioContext({ sampleRate: 48000 });
    this.silentAudio = ctx;
    const dest = ctx.createMediaStreamDestination();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const osc = ctx.createOscillator();
    osc.connect(gain).connect(dest);
    osc.start();
    // Started explicitly: with no visible app window Chromium may leave it
    // suspended — the recorder then waits for audio and sends NOTHING.
    void ctx.resume().catch(() => undefined);
    return dest.stream.getAudioTracks()[0]!;
  }

  async stop() {
    if (this.recorderWatchdog) clearTimeout(this.recorderWatchdog);
    this.recorderWatchdog = null;
    const runId = this.runId;
    this.runId = null;
    if (this.sourceTimer) clearInterval(this.sourceTimer);
    this.sourceTimer = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.ondataavailable = null;
      this.recorder.stop();
    }
    this.recorder = null;
    if (runId) await this.bridge.encoder.stop(runId).catch(() => undefined);
    this.compositor?.stop();
    this.compositor = null;
    this.stream = null;
    await this.silentAudio?.close().catch(() => undefined);
    this.silentAudio = null;
  }
}
