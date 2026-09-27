/**
 * The Atomic Pathshala Teacher desktop app (desktop/teacher) exposes
 * `window.atomicDesktop` to the trusted Atomic origin. In a normal browser
 * it is absent and everything falls back to the web flow (manual OBS).
 */
export interface DesktopEncoderProbe {
  available: boolean;
  reason?: string;
  hardwareEncoders?: string[];
}

export interface DesktopEncoderStatus {
  runId?: string;
  state: "unavailable" | "starting" | "streaming" | "reconnecting" | "stopped" | "failed";
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
    start(opts: { liveSessionId: string; serverUrl: string; streamKey: string; width: number; height: number; fps: number; mimeType: string }): Promise<{ runId: string }>;
    push(runId: string, chunk: ArrayBuffer): void;
    stop(runId: string): Promise<{ stopped: boolean }>;
    status(runId: string): Promise<DesktopEncoderStatus>;
    onStatus(listener: (status: DesktopEncoderStatus) => void): () => void;
  };
}

export function getDesktopBridge(): AtomicDesktopBridge | null {
  if (typeof window === "undefined") return null;
  const bridge = (window as unknown as { atomicDesktop?: AtomicDesktopBridge }).atomicDesktop;
  return bridge?.isDesktop ? bridge : null;
}
