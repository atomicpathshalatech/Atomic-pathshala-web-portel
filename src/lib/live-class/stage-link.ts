/**
 * The teacher's screen, straight to the class video.
 *
 * The class video is drawn by the Teacher app's hidden stage window. It used
 * to learn about the board only from the SERVER (save → push → fetch), so a
 * stroke reached the video late, and the camera sat in a fixed corner
 * whatever the teacher had done with it. Both windows run on the same
 * computer, so the teacher's window now tells the stage directly — the moment
 * a stroke is finished, a slide is changed or the camera is moved — over a
 * BroadcastChannel. The server path stays as the fallback (older app, the
 * teacher's page reloading).
 */

export type StageLinkMessage =
  | { t: "hello" }
  | { t: "ping" }
  | { t: "board"; objects: unknown[]; background: string | null }
  | { t: "camera"; position: string; shape: "SQUARE" | "CIRCULAR" };

export function stageLinkName(whiteboardSessionId: string): string {
  return `atomic-stage-link:${whiteboardSessionId}`;
}

export function openStageLink(whiteboardSessionId: string): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  try {
    return new BroadcastChannel(stageLinkName(whiteboardSessionId));
  } catch {
    return null;
  }
}

/** How long the stage trusts the direct link after its last message. */
export const STAGE_LINK_STALE_MS = 6000;
export const STAGE_LINK_PING_MS = 2000;
