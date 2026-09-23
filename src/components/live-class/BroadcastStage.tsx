"use client";

import { useEffect, useRef, useState } from "react";
import { CanvasEngine, type StrokeObject } from "@/lib/canvas/canvas-engine";

type StageData = {
  status: string;
  livePhase: string;
  title: string;
  classroomTheme?: string | null;
  cameraShape?: string | null;
  cameraPosition?: string | null;
  page: { objects: StrokeObject[]; background: string | null } | null;
};

const CAMERA_SIZE = 220;
const POLL_INTERVAL_MS = 1500;

function isBackgroundImageUrl(background: string | null | undefined): background is string {
  return typeof background === "string" && /^https?:\/\//.test(background);
}

function cameraCornerStyle(position: string | null | undefined): React.CSSProperties {
  const inset = 24;
  switch (position) {
    case "UPPER_LEFT":
      return { top: inset, left: inset };
    case "LOWER_LEFT":
      return { bottom: inset, left: inset };
    case "LOWER_RIGHT":
      return { bottom: inset, right: inset };
    case "UPPER_RIGHT":
    default:
      return { top: inset, right: inset };
  }
}

/**
 * Local, LiveKit-free camera feed — this page is meant to be captured whole
 * by OBS as a Browser Source, so the camera just needs to be real pixels on
 * this page (getUserMedia), never a network call anywhere.
 */
function LocalCamera({ shape }: { shape: string | null | undefined }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, audio: false })
      .then((s) => {
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Camera unavailable"));
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div
      className={`overflow-hidden border-4 border-blue-500 shadow-2xl bg-black ${
        shape === "CIRCULAR" ? "rounded-full" : "rounded-2xl"
      }`}
      style={{ width: CAMERA_SIZE, height: CAMERA_SIZE }}
    >
      {error ? (
        <div className="w-full h-full flex items-center justify-center text-white/70 text-xs text-center p-2">
          {error}
        </div>
      ) : (
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
      )}
    </div>
  );
}

/** Read-only board mirror, sized to fill its parent at a fixed 16:9 — same
 * CanvasEngine primitive/pattern as StudentLiveClassRoom's own mirror, just
 * full-bleed instead of boxed into a sidebar-adjacent panel. */
function BoardMirror({ objects, background }: { objects: StrokeObject[]; background: string | null }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const activeRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const [dim, setDim] = useState({ width: 1280, height: 720 });

  useEffect(() => {
    const compute = () => {
      const parent = containerRef.current?.parentElement;
      if (!parent) return;
      const { clientWidth, clientHeight } = parent;
      if (clientWidth <= 0 || clientHeight <= 0) return;
      let w = clientWidth;
      let h = Math.round(w * (9 / 16));
      if (h > clientHeight) {
        h = clientHeight;
        w = Math.round(h * (16 / 9));
      }
      setDim({ width: w, height: h });
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (containerRef.current?.parentElement) ro.observe(containerRef.current.parentElement);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!baseRef.current || !activeRef.current) return;
    const engine = new CanvasEngine(baseRef.current, activeRef.current, undefined, undefined, { readOnly: true });
    engineRef.current = engine;
    engine.syncSize();
    engine.loadObjects(objects);
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.syncSize();
    engineRef.current?.loadObjects(objects);
  }, [dim, objects]);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden bg-white"
      style={{ width: dim.width, height: dim.height }}
    >
      {isBackgroundImageUrl(background) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={background} alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
      )}
      <canvas ref={baseRef} className="absolute inset-0 w-full h-full" />
      <canvas ref={activeRef} className="absolute inset-0 w-full h-full pointer-events-none" />
    </div>
  );
}

/**
 * The full OBS-capturable stage: board + camera composited into one frame,
 * with zero UI chrome (no header/toolbar/chat) — see /obs-stage/[scheduleId]
 * for the page that mounts this. Polls src/app/api/live-class/obs-stage
 * rather than subscribing to Pusher, since that channel is presence-based
 * and requires a real session this token-only page doesn't have.
 */
export function BroadcastStage({ scheduleId, token }: { scheduleId: string; token: string }) {
  const [data, setData] = useState<StageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(
          `/api/live-class/obs-stage/${scheduleId}?token=${encodeURIComponent(token)}`
        );
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !json.success) {
          setError(json.error || "Could not load class session.");
          return;
        }
        setError(null);
        setData(json.data);
      } catch {
        if (!cancelled) setError("Connection lost — retrying...");
      }
    }
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [scheduleId, token]);

  if (error && !data) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center text-rose-400 text-sm font-bold text-center p-8">
        {error}
      </div>
    );
  }

  if (!data) {
    return <div className="w-screen h-screen bg-black" />;
  }

  return (
    <div className="w-screen h-screen bg-black flex items-center justify-center relative overflow-hidden">
      <BoardMirror objects={data.page?.objects ?? []} background={data.page?.background ?? "blank"} />
      <div className="absolute" style={cameraCornerStyle(data.cameraPosition)}>
        <LocalCamera shape={data.cameraShape} />
      </div>
    </div>
  );
}
