"use client";

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import PusherClient from "pusher-js";
import { CanvasEngine, type StrokeObject } from "@/lib/canvas/canvas-engine";
import { sessionChannel, teacherChannel, WB_EVENTS } from "@/lib/realtime/events";
import { BroadcastQuizCanvasOverlay, type BroadcastQuizData } from "@/components/live-class/BroadcastQuizCanvasOverlay";

type StageData = {
  sessionId?: string;
  status: string;
  livePhase: string;
  title: string;
  classroomTheme?: string | null;
  cameraShape?: string | null;
  cameraPosition?: string | null;
  page: { objects: StrokeObject[]; background: string | null } | null;
  activeQuiz?: BroadcastQuizData | null;
  quizMetrics?: { counts: Record<string, number>; totalResponses: number } | null;
  handRaise?: {
    id: string;
    studentName: string;
    requestType?: "CHAT" | "AUDIO" | "VIDEO";
    status?: "PENDING" | "APPROVED";
    imageUrl?: string | null;
  } | null;
};

export interface BoardMirrorHandle {
  setRemoteLaserActive: (points: { x: number; y: number }[]) => void;
  pushRemoteLaserStroke: (points: { x: number; y: number }[]) => void;
}

const CAMERA_SIZE = 220;
const POLL_INTERVAL_MS = 800;

function isBackgroundImageUrl(background: string | null | undefined): background is string {
  if (typeof background !== "string" || !background.trim()) return false;
  const bg = background.trim().toLowerCase();
  if (["blank", "light", "dark", "grid", "lines", "dots", "graph"].includes(bg)) {
    return false;
  }
  return (
    bg.startsWith("http://") ||
    bg.startsWith("https://") ||
    bg.startsWith("/") ||
    bg.startsWith("data:image/") ||
    bg.startsWith("blob:")
  );
}

function slideBackgroundStyle(background: string | null | undefined): React.CSSProperties {
  switch (background) {
    case "atomic_white":
      return {
        backgroundColor: "#ffffff",
        backgroundImage:
          "linear-gradient(to bottom, #fff7ed 0px, #fff7ed 36px, #ea580c 36px, #ea580c 38px, transparent 38px)",
      };
    case "atomic_dark":
      return {
        backgroundColor: "#0d0f17",
        backgroundImage:
          "linear-gradient(to bottom, #171924 0px, #171924 36px, #ea580c 36px, #ea580c 38px, transparent 38px)",
      };
    case "atomic_ruled":
      return {
        backgroundColor: "#ffffff",
        backgroundImage:
          "linear-gradient(to bottom, #fff7ed 0px, #fff7ed 36px, #ea580c 36px, #ea580c 38px, transparent 38px), repeating-linear-gradient(to bottom, transparent, transparent 27px, #e2e8f0 27px, #e2e8f0 28px)",
        backgroundPosition: "0 0, 0 38px",
      };
    case "ruled":
    case "notebook":
      return {
        backgroundColor: "#ffffff",
        backgroundImage: "repeating-linear-gradient(to bottom, transparent, transparent 27px, #e2e8f0 27px, #e2e8f0 28px)",
      };
    case "dark":
      return { backgroundColor: "#1a1b23" };
    case "grid":
      return {
        backgroundColor: "#ffffff",
        backgroundImage:
          "linear-gradient(#9ca3af 1px, transparent 1px), linear-gradient(90deg, #9ca3af 1px, transparent 1px)",
        backgroundSize: "20px 20px",
      };
    case "coordinate":
      return {
        backgroundColor: "#ffffff",
        backgroundImage:
          "linear-gradient(#d1d5db 1px, transparent 1px), linear-gradient(90deg, #d1d5db 1px, transparent 1px)",
        backgroundSize: "20px 20px",
        backgroundPosition: "center center",
      };
    case "dotted":
      return {
        backgroundColor: "#ffffff",
        backgroundImage: "radial-gradient(#9ca3af 1.5px, transparent 1.5px)",
        backgroundSize: "20px 20px",
      };
    case "light":
    default:
      return { backgroundColor: "#ffffff" };
  }
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

import {
  LiveKitRoom,
  VideoTrack,
  useTracks,
  RoomAudioRenderer,
} from "@livekit/components-react";
import { Track } from "livekit-client";

function LiveKitCameraStream({
  shape,
  onTrackStatus,
}: {
  shape: string | null | undefined;
  onTrackStatus?: (active: boolean) => void;
}) {
  const tracks = useTracks([Track.Source.Camera]);
  const cameraTrack = tracks.find((t) => t.source === Track.Source.Camera && !t.participant.isLocal) || tracks[0];
  const isLive = Boolean(cameraTrack && cameraTrack.publication && !cameraTrack.publication.isMuted);

  useEffect(() => {
    onTrackStatus?.(isLive);
  }, [isLive, onTrackStatus]);

  if (isLive && cameraTrack) {
    return (
      <div
        className={`overflow-hidden border-4 border-blue-500 shadow-2xl bg-black ${
          shape === "CIRCULAR" ? "rounded-full" : "rounded-2xl"
        }`}
        style={{ width: CAMERA_SIZE, height: CAMERA_SIZE }}
      >
        <RoomAudioRenderer />
        <VideoTrack trackRef={cameraTrack} className="w-full h-full object-cover scale-x-[-1]" />
      </div>
    );
  }

  return null;
}

function LocalCameraFallback({
  shape,
  title,
}: {
  shape: string | null | undefined;
  title?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    let currentStream: MediaStream | null = null;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;

    navigator.mediaDevices
      .getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      })
      .then((s) => {
        currentStream = s;
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => {
        setStream(null);
      });

    return () => {
      currentStream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (stream) {
    return (
      <div
        className={`overflow-hidden border-4 border-blue-500 shadow-2xl bg-black ${
          shape === "CIRCULAR" ? "rounded-full" : "rounded-2xl"
        }`}
        style={{ width: CAMERA_SIZE, height: CAMERA_SIZE }}
      >
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
      </div>
    );
  }

  // Stylish Educator Live Card when webcam is held by teacher studio tab
  return (
    <div
      className={`overflow-hidden border-4 border-blue-500 shadow-2xl bg-[#0e101a] flex flex-col items-center justify-center p-3 text-center ${
        shape === "CIRCULAR" ? "rounded-full" : "rounded-2xl"
      }`}
      style={{ width: CAMERA_SIZE, height: CAMERA_SIZE }}
    >
      <div className="w-16 h-16 rounded-full bg-blue-950/80 border-2 border-blue-400 flex items-center justify-center text-blue-300 mb-2 shadow-inner">
        <span className="material-symbols-outlined text-3xl">account_circle</span>
      </div>
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-[10px] font-black">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        EDUCATOR LIVE
      </div>
      {title && <span className="text-white text-[11px] font-bold mt-1 max-w-[170px] truncate">{title}</span>}
    </div>
  );
}

function BroadcastCamera({
  sessionId,
  token,
  shape,
  title,
}: {
  sessionId?: string;
  token: string;
  shape: string | null | undefined;
  title?: string;
}) {
  const [livekitCreds, setLivekitCreds] = useState<{ token: string; url: string } | null>(null);
  const [isRemoteActive, setIsRemoteActive] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    fetch(`/api/whiteboard/sessions/${sessionId}/video-token?broadcast_token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json.success && json.data?.url && json.data?.token) {
          setLivekitCreds({ token: json.data.token, url: json.data.url });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sessionId, token]);

  if (livekitCreds?.token && livekitCreds?.url) {
    return (
      <LiveKitRoom
        token={livekitCreds.token}
        serverUrl={livekitCreds.url}
        connect={true}
        audio={false}
        video={false}
      >
        <LiveKitCameraStream shape={shape} onTrackStatus={setIsRemoteActive} />
        {!isRemoteActive && <LocalCameraFallback shape={shape} title={title} />}
      </LiveKitRoom>
    );
  }

  return <LocalCameraFallback shape={shape} title={title} />;
}

/** Read-only board mirror with laser pointer and PDF/PPT/Theme support */
const BoardMirror = forwardRef<
  BoardMirrorHandle,
  {
    objects: StrokeObject[];
    background: string | null;
    classroomTheme?: string | null;
    onDimensionsChange?: (dim: { width: number; height: number }) => void;
  }
>(function BoardMirror({ objects, background, classroomTheme, onDimensionsChange }, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const activeRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const [dim, setDim] = useState({ width: 1920, height: 1080 });

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
      onDimensionsChange?.({ width: w, height: h });
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (containerRef.current?.parentElement) ro.observe(containerRef.current.parentElement);
    return () => ro.disconnect();
  }, [onDimensionsChange]);

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
    if (engineRef.current) {
      engineRef.current.syncSize();
      engineRef.current.loadObjects(objects);
    }
  }, [dim, objects]);

  const bgStyle = isBackgroundImageUrl(background)
    ? undefined
    : slideBackgroundStyle(background || (classroomTheme === "DARK" ? "atomic_dark" : "atomic_white"));

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden shadow-2xl border border-slate-800"
      style={{
        width: dim.width,
        height: dim.height,
        ...bgStyle,
      }}
    >
      {/* Atomic Pathshala Sleek Brand Header on canvas */}
      {!isBackgroundImageUrl(background) && (
        <div className="absolute top-1.5 left-3 right-3 z-10 flex items-center justify-between pointer-events-none select-none opacity-90">
          <div className="w-6 h-6 bg-white/95 rounded-lg shadow-sm border border-slate-200 flex items-center justify-center">
            <span className="text-orange-500 font-black text-xs tracking-tighter">A</span>
          </div>
          <div className="flex-1 mx-3 h-[2px] bg-gradient-to-r from-orange-500 via-slate-800 to-transparent rounded-full opacity-60" />
          <div className="flex items-center gap-1.5 pr-0.5">
            <span className="text-[10px] font-black tracking-widest text-slate-800 leading-none">ATOMIC</span>
            <span className="text-[8px] font-bold tracking-wider text-orange-600 leading-tight">PATHSHALA</span>
          </div>
        </div>
      )}

      {isBackgroundImageUrl(background) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={background}
          alt=""
          crossOrigin="anonymous"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        />
      )}

      {background === "coordinate" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-full h-[2px] bg-blue-500/70" />
          <div className="absolute h-full w-[2px] bg-blue-500/70" />
        </div>
      )}

      <canvas ref={baseRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      <canvas ref={activeRef} className="absolute inset-0 w-full h-full pointer-events-none" />
    </div>
  );
});

/**
 * The full OBS-capturable stage: board + camera + quiz overlay + hand raises composited into one frame.
 */
export function BroadcastStage({ scheduleId, token }: { scheduleId: string; token: string }) {
  const [data, setData] = useState<StageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stageDimensions, setStageDimensions] = useState({ width: 1920, height: 1080 });
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

  // Realtime Pusher subscription for Laser Pointer, Quizzes, Hand Raises, and Live Board Sync
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

    // Instant Live Quiz / MCQ Events in OBS
    channel.bind(WB_EVENTS.QUIZ_LAUNCHED, (quizPayload: BroadcastQuizData) => {
      setData((prev) => (prev ? { ...prev, activeQuiz: quizPayload, quizMetrics: null } : prev));
    });

    channel.bind(WB_EVENTS.QUIZ_METRICS, (metricsPayload: { counts: Record<string, number>; totalResponses: number }) => {
      setData((prev) => (prev ? { ...prev, quizMetrics: metricsPayload } : prev));
    });

    channel.bind(WB_EVENTS.QUIZ_REVEALED, (revealPayload: { correctOption: string }) => {
      setData((prev) =>
        prev && prev.activeQuiz
          ? {
              ...prev,
              activeQuiz: { ...prev.activeQuiz, status: "REVEALED", correctOption: revealPayload.correctOption },
            }
          : prev
      );
    });

    channel.bind(WB_EVENTS.QUIZ_CLOSED, () => {
      setData((prev) => (prev ? { ...prev, activeQuiz: null, quizMetrics: null } : prev));
    });

    // Hand Raises in OBS
    channel.bind(WB_EVENTS.HAND_RAISE_LIST, () => {
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
      {/* Board & PPT Canvas */}
      <BoardMirror
        ref={mirrorRef}
        objects={data.page?.objects ?? []}
        background={data.page?.background ?? "blank"}
        classroomTheme={data.classroomTheme}
        onDimensionsChange={setStageDimensions}
      />

      {/* Broadcast Quiz / MCQ Overlay on Stage */}
      {data.activeQuiz && data.activeQuiz.status !== "CLOSED" && (
        <BroadcastQuizCanvasOverlay
          activeQuiz={data.activeQuiz}
          quizMetrics={data.quizMetrics ?? null}
          containerWidth={stageDimensions.width}
          containerHeight={stageDimensions.height}
        />
      )}

      {/* Live Hand Raise / Doubt Notice on Stage */}
      {data.handRaise && (
        <div className="absolute top-4 left-4 z-40 bg-gradient-to-r from-blue-900/90 to-indigo-900/90 border border-blue-400/50 text-white px-3.5 py-2 rounded-xl shadow-2xl flex items-center gap-2.5 backdrop-blur-md animate-fade-in">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
          <span className="material-symbols-outlined text-sm text-blue-300">
            {data.handRaise.requestType === "AUDIO" ? "mic" : data.handRaise.requestType === "VIDEO" ? "videocam" : "help"}
          </span>
          <div className="text-xs">
            <span className="font-bold">{data.handRaise.studentName}</span>
            <span className="text-blue-200 ml-1.5 opacity-90">
              {data.handRaise.requestType === "AUDIO"
                ? "requested to speak"
                : data.handRaise.requestType === "VIDEO"
                ? "connected via video"
                : "raised a question"}
            </span>
          </div>
        </div>
      )}

      {/* Teacher Camera Overlay on Stage */}
      <div className="absolute z-30" style={cameraCornerStyle(data.cameraPosition)}>
        <BroadcastCamera
          sessionId={data.sessionId}
          token={token}
          shape={data.cameraShape}
          title={data.title}
        />
      </div>
    </div>
  );
}
