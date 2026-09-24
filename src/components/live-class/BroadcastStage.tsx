"use client";

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import PusherClient from "pusher-js";
import { CanvasEngine, type StrokeObject } from "@/lib/canvas/canvas-engine";
import { sessionChannel, WB_EVENTS } from "@/lib/realtime/events";

type StageData = {
  sessionId?: string;
  status: string;
  livePhase: string;
  title: string;
  classroomTheme?: string | null;
  cameraShape?: string | null;
  cameraPosition?: string | null;
  page: { objects: StrokeObject[]; background: string | null } | null;
};

export interface BoardMirrorHandle {
  setRemoteLaserActive: (points: { x: number; y: number }[]) => void;
  pushRemoteLaserStroke: (points: { x: number; y: number }[]) => void;
}

const CAMERA_SIZE = 220;
const POLL_INTERVAL_MS = 1000;

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
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let currentStream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, audio: false })
      .then((s) => {
        currentStream = s;
        setStream(s);
        setError(null);
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Camera unavailable"));
    return () => {
      currentStream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

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

/** Read-only board mirror with laser pointer support */
const BoardMirror = forwardRef<
  BoardMirrorHandle,
  { objects: StrokeObject[]; background: string | null }
>(function BoardMirror({ objects, background }, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const activeRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const [dim, setDim] = useState({ width: 1280, height: 720 });

  useImperativeHandle(ref, () => ({
    setRemoteLaserActive: (points) => {
      engineRef.current?.setRemoteLaserActive(points);
    },
    pushRemoteLaserStroke: (points) => {
      engineRef.current?.pushRemoteLaserStroke(points);
    },
  }));

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
});

/**
 * The full OBS-capturable stage: board + camera composited into one frame,
 * with zero UI chrome (no header/toolbar/chat) — see /obs-stage/[scheduleId]
 * for the page that mounts this. Connects to Pusher with the broadcast token
 * to receive instant laser pointer trails and real-time board updates.
 */
export function BroadcastStage({ scheduleId, token }: { scheduleId: string; token: string }) {
  const [data, setData] = useState<StageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mirrorRef = useRef<BoardMirrorHandle | null>(null);

  const fetchStage = async () => {
    try {
      const res = await fetch(
        `/api/live-class/obs-stage/${scheduleId}?token=${encodeURIComponent(token)}`
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || "Could not load class session.");
        return;
      }
      setError(null);
      setData(json.data);
    } catch {
      setError("Connection lost — retrying...");
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchStage();
    const interval = setInterval(() => {
      if (!cancelled) fetchStage();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [scheduleId, token]);

  // Realtime Pusher subscription for Laser Pointer and zero-latency board sync in OBS
  useEffect(() => {
    if (!data?.sessionId) return;
    const pusher = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY ?? "", {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "ap2",
      authEndpoint: `/api/pusher/auth?broadcast_token=${encodeURIComponent(token)}`,
      auth: {
        params: {
          broadcast_token: token,
        },
      },
    });

    const channel = pusher.subscribe(sessionChannel(data.sessionId));

    // Instant Laser Pointer Render in OBS
    channel.bind(
      WB_EVENTS.LASER_POINTER,
      (payload: { points?: { x: number; y: number }[]; phase?: "move" | "end" }) => {
        if (!Array.isArray(payload?.points) || payload.points.length === 0) return;
        if (payload.phase === "end") {
          mirrorRef.current?.pushRemoteLaserStroke(payload.points);
        } else {
          mirrorRef.current?.setRemoteLaserActive(payload.points);
        }
      }
    );

    // Instant Board Updates in OBS
    channel.bind(WB_EVENTS.BOARD_UPDATED, (payload?: { objects?: StrokeObject[]; background?: string }) => {
      if (payload?.objects && Array.isArray(payload.objects)) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                page: {
                  objects: payload.objects!,
                  background: payload.background !== undefined ? payload.background : (prev.page?.background ?? null),
                },
              }
            : prev
        );
      }
      fetchStage();
    });
    channel.bind(WB_EVENTS.PAGE_CHANGED, () => {
      fetchStage();
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(sessionChannel(data.sessionId!));
      pusher.disconnect();
    };
  }, [data?.sessionId, token, scheduleId]);

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
      <BoardMirror ref={mirrorRef} objects={data.page?.objects ?? []} background={data.page?.background ?? "blank"} />
      <div className="absolute" style={cameraCornerStyle(data.cameraPosition)}>
        <LocalCamera shape={data.cameraShape} />
      </div>
    </div>
  );
}
