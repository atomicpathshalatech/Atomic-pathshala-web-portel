/**
 * The Atomic Pathshala Teacher desktop app (desktop/teacher) exposes
 * `window.atomicDesktop` to the trusted Atomic origin. In a normal browser
 * it is absent and everything falls back to the web flow (manual OBS).
 */
export interface DesktopEncoderProbe {
  available: boolean;
  reason?: string;
  /** Working hardware encoders on this machine (NVENC / QSV / AMF / MF). */
  hardwareEncoders?: string[];
  encoders?: string[];
  chosen?: string;
}

export interface DesktopEncoderStatus {
  runId?: string;
  state: "unavailable" | "starting" | "streaming" | "reconnecting" | "stopped" | "failed";
  /** Encoder restart counter — the page records a fresh stream per generation. */
  generation?: number;
  encoder?: string;
  restarts?: number;
  bitrateKbps?: number;
  fps?: number;
  droppedFrames?: number;
  error?: string;
}

export interface AtomicDesktopBridge {
  isDesktop: true;
  info(): Promise<{ appVersion: string; electron: string; platform: string; arch: string }>;
  encoder: {
    probe(): Promise<DesktopEncoderProbe>;
    start(opts: { serverUrl: string; streamKey: string; fps: number; profile: "1080p" | "720p" }): Promise<{ runId: string; encoder: string }>;
    push(runId: string, generation: number, chunk: ArrayBuffer): void;
    stop(runId: string): Promise<{ stopped: boolean }>;
    status(runId: string): Promise<DesktopEncoderStatus>;
    onStatus(listener: (status: DesktopEncoderStatus) => void): () => void;
  };
  /**
   * The class stage runs in a hidden offscreen window of the app (it can't be
   * minimised or covered, so the stream never pauses). Absent in app builds
   * older than this feature.
   */
  stage?: {
    /** True only inside that offscreen stage window. */
    isStage: boolean;
    open(opts: { stagePath: string; serverUrl: string; streamKey: string; profile?: "1080p" | "720p" }): Promise<{ opened: boolean; reused: boolean }>;
    close(): Promise<{ closed: boolean }>;
    /** Stage window only: what to send where. */
    job(): Promise<{ serverUrl: string; streamKey: string; profile: "1080p" | "720p" } | null>;
  };
}

export function getDesktopBridge(): AtomicDesktopBridge | null {
  if (typeof window === "undefined") return null;
  const bridge = (window as unknown as { atomicDesktop?: AtomicDesktopBridge }).atomicDesktop;
  return bridge?.isDesktop ? bridge : null;
}
