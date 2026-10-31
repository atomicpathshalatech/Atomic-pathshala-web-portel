"use client";

import { useEffect, useRef } from "react";
import { getDesktopBridge } from "@/lib/desktop/bridge";
import { DesktopClassStreamer } from "@/lib/live-class/desktop-streamer";
import type { StagePoll } from "@/lib/live-class/stage-compositor";

type StageLook = {
  background: string | null;
  cameraShape?: string | null;
  cameraPosition?: string | null;
  /** The open poll, drawn into the video (YouTube viewers answer in the chat). */
  poll?: StagePoll | null;
  /** The teacher's zoom on the slide. */
  view?: { zoom: number; panX: number; panY: number } | null;
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
  call,
}: {
  /** The mirror's container + its canvases (null until mounted). */
  getBoard: () => { container: HTMLElement | null; layers: HTMLCanvasElement[] };
  look: StageLook;
  /**
   * While a student is on a call, the stage joins the class's call room
   * listen-only and mixes the student's voice into the YouTube stream (the
   * teacher's own call identity is skipped — their mic is already in it).
   */
  call?: { active: boolean; sessionId: string; stageToken: string; teacherIdentity: string | null };
}) {
  const lookRef = useRef(look);
  lookRef.current = look;
  const getBoardRef = useRef(getBoard);
  getBoardRef.current = getBoard;
  const streamerRef = useRef<DesktopClassStreamer | null>(null);
  const teacherIdentityRef = useRef(call?.teacherIdentity ?? null);
  teacherIdentityRef.current = call?.teacherIdentity ?? null;

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
        poll: lookRef.current.poll ?? null,
        view: lookRef.current.view ?? null,
      };
    };

    (async () => {
      const job = await bridge.stage!.job();
      if (cancelled || !job) return;
      streamer = new DesktopClassStreamer(bridge, readSources, () => undefined);
      streamerRef.current = streamer;
      if (job.control) {
        streamer.setCameraOff(job.control.cameraOff);
        streamer.setMicMuted(job.control.micMuted);
        streamer.setChroma(job.control.chroma ?? null);
      }
      unsubscribeControl = bridge.stage!.onControl?.((c) => {
        streamer?.setCameraOff(c.cameraOff);
        streamer?.setMicMuted(c.micMuted);
        streamer?.setChroma(c.chroma ?? null);
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
      streamerRef.current = null;
      void streamer?.stop();
    };
  }, []);

  // Call audio → stream: connect only while a call is on (no idle room minutes).
  const callActive = Boolean(call?.active);
  const callSessionId = call?.sessionId ?? null;
  const stageToken = call?.stageToken ?? null;
  useEffect(() => {
    if (!callActive || !callSessionId || !stageToken) return;
    let cancelled = false;
    let room: import("livekit-client").Room | null = null;
    (async () => {
      try {
        const res = await fetch(
          `/api/whiteboard/sessions/${callSessionId}/video-token?broadcast_token=${encodeURIComponent(stageToken)}`
        );
        const json = await res.json().catch(() => null);
        if (cancelled || !res.ok || !json?.success || !json.data?.url || !json.data?.token) return;
        const { Room, RoomEvent, Track } = await import("livekit-client");
        const r = new Room({ adaptiveStream: false, dynacast: false });
        room = r;
        const isCaller = (identity: string) => identity !== teacherIdentityRef.current && !identity.startsWith("OBS:");
        r.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (track.kind === Track.Kind.Audio && isCaller(participant.identity)) {
            streamerRef.current?.addCallAudio(publication.trackSid, track.mediaStreamTrack);
          }
        });
        r.on(RoomEvent.TrackUnsubscribed, (_track, publication) => {
          streamerRef.current?.removeCallAudio(publication.trackSid);
        });
        await r.connect(json.data.url, json.data.token, { autoSubscribe: true });
        if (cancelled) await r.disconnect();
      } catch (err) {
        console.warn("[desktop_stage_call_audio]", err);
      }
    })();
    return () => {
      cancelled = true;
      streamerRef.current?.clearCallAudio();
      void room?.disconnect();
    };
  }, [callActive, callSessionId, stageToken]);

  return null;
}
