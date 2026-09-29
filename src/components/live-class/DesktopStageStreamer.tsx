"use client";

import { useEffect, useRef } from "react";
import { getDesktopBridge } from "@/lib/desktop/bridge";
import { DesktopClassStreamer } from "@/lib/live-class/desktop-streamer";

type StageLook = {
  background: string | null;
  cameraShape?: string | null;
  cameraPosition?: string | null;
};

/**
 * Runs inside the desktop app's hidden offscreen stage window only (see
 * desktop/teacher/src/stage-window.js): takes the board mirror's canvases,
 * adds this machine's camera + mic and sends the class to YouTube. Renders
 * nothing. Because the offscreen window can never be minimised or covered,
 * the stream keeps going whatever the teacher does with the app window.
 */
export function DesktopStageStreamer({
  getBoard,
  look,
}: {
  /** The mirror's container + its canvases (null until mounted). */
  getBoard: () => { container: HTMLElement | null; layers: HTMLCanvasElement[] };
  look: StageLook;
}) {
  const lookRef = useRef(look);
  lookRef.current = look;
  const getBoardRef = useRef(getBoard);
  getBoardRef.current = getBoard;

  useEffect(() => {
    const bridge = getDesktopBridge();
    if (!bridge?.stage?.isStage) return;
    let cancelled = false;
    let streamer: DesktopClassStreamer | null = null;
    let unsubscribeControl: (() => void) | null = null;

    const readSources = () => {
      const { container, layers } = getBoardRef.current();
      const bgColor = container ? getComputedStyle(container).backgroundColor : null;
      const bg = lookRef.current.background;
      return {
        boardLayers: layers,
        backgroundColor: bgColor && bgColor !== "rgba(0, 0, 0, 0)" ? bgColor : "#ffffff",
        backgroundImageUrl: bg && /^https?:\/\//.test(bg) ? bg : null,
        backgroundTemplate: bg && !/^https?:\/\//.test(bg) ? bg : null,
        cameraShape: lookRef.current.cameraShape === "SQUARE" ? ("SQUARE" as const) : ("CIRCULAR" as const),
        cameraPosition: lookRef.current.cameraPosition || "UPPER_RIGHT",
        showCamera: true,
      };
    };

    (async () => {
      const job = await bridge.stage!.job();
      if (cancelled || !job) return;
      streamer = new DesktopClassStreamer(bridge, readSources, () => undefined);
      if (job.control) {
        streamer.setCameraOff(job.control.cameraOff);
        streamer.setMicMuted(job.control.micMuted);
      }
      unsubscribeControl = bridge.stage!.onControl?.((c) => {
        streamer?.setCameraOff(c.cameraOff);
        streamer?.setMicMuted(c.micMuted);
      }) ?? null;
      try {
        await streamer.start({ serverUrl: job.serverUrl, streamKey: job.streamKey, profile: job.profile });
      } catch (err) {
        console.error("[desktop_stage_start_error]", err);
      }
      if (cancelled) await streamer.stop();
    })();

    return () => {
      cancelled = true;
      unsubscribeControl?.();
      void streamer?.stop();
    };
  }, []);

  return null;
}
