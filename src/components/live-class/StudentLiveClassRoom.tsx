"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getPusherClient } from "@/lib/realtime/pusher-client";
import { sessionChannel, WB_EVENTS } from "@/lib/realtime/events";
import { CanvasEngine, type StrokeObject } from "@/lib/canvas/canvas-engine";
import { MessagesPanel } from "@/components/live-class/MessagesPanel";
import { YouTubeLivePlayer } from "@/components/live-class/YouTubeLivePlayer";
import { VideoStrip } from "@/components/live-class/VideoStrip";
import { RecordingPlayer } from "@/components/live-class/RecordingPlayer";
import { StudentPostClassFeedback } from "@/components/live-class/StudentPostClassFeedback";
import {
  playPollAlert,
  playPollRevealChime,
  playCallIncomingRingtone,
  playCallConnectedChime,
  unlockAudioForNotifications,
} from "@/lib/live-class/live-sound-effects";


type QuizOption = { key: string; label: string };
type LiveQuiz = {
  id: string;
  questionText: string | null;
  isQuickQuiz: boolean;
  options: QuizOption[];
  timeLimitSec: number;
  status: "ACTIVE" | "REVEALED" | "CLOSED";
  startedAt: string;
  correctOption?: string | null;
};

interface WhiteboardSessionData {
  id: string;
  title: string;
  status: "ACTIVE" | "ENDED";
  livePhase: "SCHEDULED" | "PREPARING" | "LIVE" | "ENDED" | string;
  videoTransport?: "LIVEKIT" | "YOUTUBE" | "BOTH";
  youtubeVideoId?: string | null;
  presentationUrl?: string | null;
  presentationName?: string | null;
  presentationType?: string | null;
  classroomTheme?: "LIGHT" | "DARK" | string;
  cameraShape?: "SQUARE" | "CIRCULAR" | string;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  actualStartedAt?: string | null;
  totalExtendedMinutes?: number;
  chatEnabled?: boolean;
}

// Diameter (px) of the floating teacher-camera bubble shown when the
// sidebar is hidden — see floatCamPos in StudentLiveClassRoom.
const FLOAT_CAM_SIZE = 104;

function isBackgroundImageUrl(background: string | undefined): background is string {
  return typeof background === "string" && /^https?:\/\//.test(background);
}

function formatHms(totalSec: number) {
  const isNeg = totalSec < 0;
  const abs = Math.abs(totalSec);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${isNeg ? "-" : ""}${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatDurationFriendly(totalSec: number) {
  const abs = Math.abs(totalSec);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function StudentWhiteboardMirror({
  boardBackground,
  boardEmpty,
  isLive,
  objects,
}: {
  boardBackground: string;
  boardEmpty: boolean;
  isLive: boolean;
  objects: StrokeObject[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const activeRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const [mirrorDim, setMirrorDim] = useState<{ width: number; height: number }>({ width: 960, height: 540 });

  useEffect(() => {
    if (!containerRef.current) return;
    const compute = () => {
      const parent = containerRef.current?.parentElement;
      if (!parent) return;
      const { clientWidth, clientHeight } = parent;
      if (clientWidth <= 0 || clientHeight <= 0) return;
      const padW = 16;
      const padH = 16;
      const availW = Math.max(100, clientWidth - padW);
      const availH = Math.max(100, clientHeight - padH);
      let w = availW;
      let h = Math.round(w * (9 / 16));
      if (h > availH) {
        h = availH;
        w = Math.round(h * (16 / 9));
      }
      setMirrorDim({ width: w, height: h });
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (containerRef.current.parentElement) {
      ro.observe(containerRef.current.parentElement);
    }
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!baseRef.current || !activeRef.current) return;
    const engine = new CanvasEngine(baseRef.current, activeRef.current, undefined, undefined, {
      readOnly: true,
    });
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
  }, [mirrorDim, objects]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-xl border border-slate-800/60 shadow-2xl shrink-0 transition-all ${boardBackground === "dark" ? "bg-[#10131d]" : "bg-white"}`}
      style={{
        width: `${mirrorDim.width}px`,
        height: `${mirrorDim.height}px`,
      }}
    >
      {isBackgroundImageUrl(boardBackground) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={boardBackground}
          alt=""
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        />
      )}
      <canvas ref={baseRef} className="absolute inset-0 w-full h-full" />
      <canvas ref={activeRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Standby Watermark */}
      {boardEmpty && !isBackgroundImageUrl(boardBackground) && (
        <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none text-center p-6 ${
          boardBackground === "dark"
            ? "bg-gradient-to-b from-transparent via-[#10131d]/40 to-[#10131d]/80 text-slate-300"
            : "bg-gradient-to-b from-transparent via-slate-100/40 to-slate-200/80 text-slate-700"
        }`}>
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center mb-1">
            <span className="material-symbols-outlined text-2xl">draw</span>
          </div>
          <p className="text-sm font-bold">Atomic Whiteboard Studio Connected</p>
          <p className="text-xs text-slate-500 max-w-md">
            {isLive
              ? "Teacher canvas is active. Slides, notes, and strokes appear here in real time."
              : "Waiting for teacher to start presentation. You are connected to the live studio canvas."}
          </p>
        </div>
      )}
    </div>
  );
}

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error ?? "Request failed");
  return json.data;
}

export function StudentLiveClassRoom({
  batchScheduleId,
  scheduleTitle,
  batchName,
  teacherName,
  subject = null,
  chapterTitle = null,
  currentUserId,
}: {
  batchScheduleId: string;
  scheduleTitle: string;
  batchName: string;
  teacherName: string | null;
  subject?: string | null;
  chapterTitle?: string | null;
  currentUserId: string;
}) {
  const [phase, setPhase] = useState<"waiting" | "lobby" | "live" | "ended">("waiting");
  const [wbSession, setWbSession] = useState<WhiteboardSessionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [handRaised, setHandRaised] = useState(false);
  const [handRaiseBusy, setHandRaiseBusy] = useState(false);
  const [handRaiseModalOpen, setHandRaiseModalOpen] = useState(false);
  const [participationType, setParticipationType] = useState<"CHAT" | "AUDIO" | "VIDEO">("AUDIO");
  const [isApprovedSpeaker, setIsApprovedSpeaker] = useState(false);
  const [speakerRequestType, setSpeakerRequestType] = useState<"AUDIO" | "VIDEO" | null>(null);
  const [speakerToken, setSpeakerToken] = useState<string | null>(null);

  // Teacher-initiated connect — independent of the hand-raise flow above
  // (teacher grants directly, no request from the student involved).
  const [teacherAudioConnected, setTeacherAudioConnected] = useState(false);
  const [teacherVideoConnected, setTeacherVideoConnected] = useState(false);
  // The Pusher handler below is registered once per wbSession.id (see this
  // effect's dependency array), so a state variable read inside it would
  // stay captured at its initial value forever - a ref is the correct way
  // to read the latest "was already connected" value from inside that
  // stable closure.
  const teacherConnectedRef = useRef(false);

  // A DIFFERENT student who is currently an approved video speaker — shown
  // to the rest of the class as a small popup (see LiveVideoCallModal's
  // classSpeaker branch). Previously only the teacher could see a speaking
  // classmate's video at all.
  const [activeClassSpeaker, setActiveClassSpeaker] = useState<{ studentUserId: string; studentName: string } | null>(null);
  const [teacherConnectionToken, setTeacherConnectionToken] = useState<string | null>(null);

  const [quiz, setQuiz] = useState<LiveQuiz | null>(null);
  const [mySelection, setMySelection] = useState<string | null>(null);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [remainingSec, setRemainingSec] = useState(0);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [quizDismissed, setQuizDismissed] = useState(false);

  // Auto-dismiss quiz 5 seconds after results are revealed or closed
  useEffect(() => {
    if (quiz?.status === "REVEALED" || quiz?.status === "CLOSED") {
      const timer = setTimeout(() => {
        setQuizDismissed(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [quiz?.status]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChat, setShowChat] = useState(true);

  // Live student count — reuses the SAME presence channel already
  // subscribed below for chat/board/quiz events (Pusher's built-in member
  // tracking, the same mechanism ParticipantsPanel already uses on the
  // teacher side), rather than polling a new endpoint or inventing a count.
  const [onlineCount, setOnlineCount] = useState(0);

  // Floating teacher camera position, used only while the sidebar is
  // hidden (see the camera wrapper below). <VideoStrip> itself is mounted
  // exactly once, in a single stable wrapper div, and NEVER moves in the
  // React tree — only this wrapper's CSS (docked vs. fixed-position
  // bubble) changes with `showChat`, so the LiveKit connection it holds
  // is never dropped by a hide/show toggle. This mirrors the drag math in
  // the existing (otherwise-unused) DraggableFloatingCamera component,
  // reimplemented inline here specifically so it can be applied to the
  // persistent wrapper instead of swapping in a different component
  // (which would remount VideoStrip and restart the call).
  // Starts as a fixed, SSR-safe default (not null) so the floating bubble
  // always has a real position/size to render with — the effect below
  // just corrects it to a proper top-right default (or the saved spot)
  // once the window is available. Previously this started as null and
  // the bubble's inline position/size styles were skipped entirely until
  // the effect ran, which could render a zero-size/invisible camera for
  // that first frame.
  const [floatCamPos, setFloatCamPos] = useState<{ x: number; y: number }>({ x: 16, y: 70 });
  const floatCamDraggingRef = useRef(false);
  const floatCamDragOffsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("atomic_student_floating_cam_pos");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          setFloatCamPos(parsed);
          return;
        }
      }
    } catch {
      // fallback below
    }
    setFloatCamPos({ x: Math.max(16, window.innerWidth - FLOAT_CAM_SIZE - 16), y: 70 });
  }, []);

  function handleFloatCamPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    floatCamDraggingRef.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    floatCamDragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleFloatCamPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!floatCamDraggingRef.current) return;
    const maxX = Math.max(10, window.innerWidth - FLOAT_CAM_SIZE - 12);
    const maxY = Math.max(10, window.innerHeight - FLOAT_CAM_SIZE - 12);
    let nx = e.clientX - floatCamDragOffsetRef.current.x;
    let ny = e.clientY - floatCamDragOffsetRef.current.y;
    nx = Math.max(8, Math.min(nx, maxX));
    ny = Math.max(56, Math.min(ny, maxY));
    setFloatCamPos({ x: nx, y: ny });
  }

  function handleFloatCamPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!floatCamDraggingRef.current) return;
    floatCamDraggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    setFloatCamPos((pos) => {
      if (pos) {
        try {
          localStorage.setItem("atomic_student_floating_cam_pos", JSON.stringify(pos));
        } catch {
          // ignore
        }
      }
      return pos;
    });
  }

  // Notification chimes (poll alert/reveal, call ring/connected) fire from
  // realtime events, not a user gesture — browser autoplay policy keeps
  // the shared AudioContext suspended without one. Unlock it on the
  // student's first interaction with the room.
  useEffect(() => {
    const unlock = () => unlockAudioForNotifications();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Manual orientation mode toggle ("auto" | "portrait" | "landscape") — a
  // student can still force one, but "auto" (the default) now tracks the
  // device's real physical rotation via matchMedia below, rather than
  // relying solely on Tailwind's CSS `landscape:` variant. JS-driven state
  // repaints reliably across browsers/WebViews where the CSS orientation
  // media query alone doesn't (this is also blocked entirely for installed
  // PWA users while manifest.ts locks orientation to "portrait" — see that
  // file for the matching fix).
  const [orientationMode, setOrientationMode] = useState<"auto" | "portrait" | "landscape">("auto");
  const [deviceIsLandscape, setDeviceIsLandscape] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(orientation: landscape)");
    setDeviceIsLandscape(mql.matches);
    const handler = (e: MediaQueryListEvent) => setDeviceIsLandscape(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  const effectiveOrientation: "portrait" | "landscape" =
    orientationMode === "auto" ? (deviceIsLandscape ? "landscape" : "portrait") : orientationMode;

  // VisualViewport listener for mobile virtual keyboard and soft-keyboard resize
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
      } else {
        setViewportHeight(window.innerHeight);
      }
    };
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", update);
      window.visualViewport.addEventListener("scroll", update);
      update();
    }
    window.addEventListener("resize", update);
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", update);
        window.visualViewport.removeEventListener("scroll", update);
      }
      window.removeEventListener("resize", update);
    };
  }, []);

  // Time & countdown state (Synchronized with authoritative server clock)
  const [currentTimeMs, setCurrentTimeMs] = useState(Date.now());
  const serverTimeOffsetRef = useRef<number>(0);
  const [scheduleTimes, setScheduleTimes] = useState<{ startTime?: string; endTime?: string } | null>(null);

  // Board mirror (read-only)
  const [boardEmpty, setBoardEmpty] = useState(true);
  const [boardBackground, setBoardBackground] = useState<string>("blank");
  const [boardObjects, setBoardObjects] = useState<StrokeObject[]>([]);

  // Keep local clock ticking with server offset
  useEffect(() => {
    const interval = setInterval(() => setCurrentTimeMs(Date.now() + serverTimeOffsetRef.current), 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleFullscreen = () => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Poll for the session state until live/ended
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const res = await fetch(`/api/whiteboard/sessions/by-schedule/${batchScheduleId}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          // On error, keep retrying — don't surface the error yet, just wait
          if (!cancelled) timer = setTimeout(poll, 3000);
          return;
        }
        if (json.data?.serverTimeMs) {
          serverTimeOffsetRef.current = json.data.serverTimeMs - Date.now();
          setCurrentTimeMs(Date.now() + serverTimeOffsetRef.current);
        } else if (json.data?.serverTime) {
          serverTimeOffsetRef.current = new Date(json.data.serverTime).getTime() - Date.now();
          setCurrentTimeMs(Date.now() + serverTimeOffsetRef.current);
        }
        if (json.data.schedule) {
          setScheduleTimes({
            startTime: json.data.schedule.startsAt,
            endTime: json.data.schedule.endsAt,
          });
        }
        const wb = json.data.whiteboardSession;
        if (cancelled) return;
        if (wb && wb.status === "ENDED") {
          setWbSession(wb);
          setPhase("ended");
          return; // class is over, stop polling
        }
        if (wb && wb.status === "ACTIVE") {
          setWbSession(wb);
          if (wb.livePhase === "LIVE") {
            setPhase("live");
            // Keep polling at a slower rate to catch ENDED state
            if (!cancelled) timer = setTimeout(poll, 5000);
            return;
          }
          setPhase("lobby");
        }
      } catch {
        // Network error — keep retrying silently
      }
      if (!cancelled) timer = setTimeout(poll, 2000);
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [batchScheduleId]);

  // Announce arrival once a session exists
  useEffect(() => {
    if (!wbSession?.id) return;
    postJson(`/api/whiteboard/sessions/${wbSession.id}/join`).catch(() => {});

    // Periodic attendance heartbeat while viewing class
    const hbInterval = setInterval(() => {
      fetch(`/api/whiteboard/sessions/${wbSession.id}/heartbeat`, { method: "POST" }).catch(() => {});
    }, 25000);
    return () => clearInterval(hbInterval);
  }, [wbSession?.id]);


  // Board mirror refresh
  async function refreshBoard() {
    if (!wbSession?.id) return;
    try {
      const res = await fetch(`/api/whiteboard/sessions/${wbSession.id}/board`);
      const json = await res.json();
      if (!res.ok || !json.success) return;
      const objects: StrokeObject[] = json.data.page?.objects ?? [];
      setBoardObjects(objects);
      setBoardEmpty(objects.length === 0);
      setBoardBackground(json.data.page?.background ?? "blank");
    } catch {
      // best effort
    }
  }

  // Load board objects only when class is LIVE (never before class starts)
  useEffect(() => {
    if (wbSession?.id && phase === "live") {
      refreshBoard();
    }
  }, [wbSession?.id, phase]);

  // Periodic fallback sync while live to ensure board stays 100% synchronized
  useEffect(() => {
    if (phase !== "live" || !wbSession?.id) return;
    const interval = setInterval(() => {
      refreshBoard();
    }, 2500);
    return () => clearInterval(interval);
  }, [phase, wbSession?.id]);

  // Subscribe to realtime Pusher session events
  useEffect(() => {
    if (!wbSession?.id) return;
    const client = getPusherClient();
    const channel = client.subscribe(sessionChannel(wbSession.id));

    // Live student count — sessionChannel is a Pusher presence channel
    // (see pusher/auth/route.ts), so membership is already tracked
    // server-side; this just reads that count, the same mechanism
    // ParticipantsPanel uses for its "Online" badge on the teacher side.
    channel.bind("pusher:subscription_succeeded", (members: any) => {
      if (members?.count != null) setOnlineCount(members.count);
    });
    channel.bind("pusher:member_added", () => setOnlineCount((c) => c + 1));
    channel.bind("pusher:member_removed", () => setOnlineCount((c) => Math.max(0, c - 1)));

    channel.bind(WB_EVENTS.SESSION_ENDED, () => {
      setPhase("ended");
      setQuiz(null);
    });

    channel.bind(WB_EVENTS.LIVE_PHASE_CHANGED, (data: { livePhase?: string; phase?: string }) => {
      const p = data.livePhase || data.phase;
      if (p === "LIVE") setPhase("live");
      if (p === "ENDED") setPhase("ended");
    });

    channel.bind(WB_EVENTS.SESSION_EXTENDED, (data: { newScheduledEnd: string; totalExtendedMinutes: number }) => {
      setWbSession((prev) =>
        prev
          ? {
              ...prev,
              scheduledEnd: data.newScheduledEnd,
              totalExtendedMinutes: data.totalExtendedMinutes,
            }
          : prev
      );
    });

    channel.bind(WB_EVENTS.CONFIG_UPDATED, (data: any) => {
      setWbSession((prev) =>
        prev
          ? {
              ...prev,
              presentationUrl: data.presentationUrl ?? prev.presentationUrl,
              presentationName: data.presentationName ?? prev.presentationName,
              presentationType: data.presentationType ?? prev.presentationType,
              classroomTheme: data.classroomTheme ?? prev.classroomTheme,
              cameraShape: data.cameraShape ?? prev.cameraShape,
            }
          : prev
      );
    });

    channel.bind(
      WB_EVENTS.BOARD_UPDATED,
      (data?: { pageNumber?: number; objects?: StrokeObject[]; background?: string }) => {
        if (data?.objects && Array.isArray(data.objects)) {
          setBoardObjects(data.objects);
          setBoardEmpty(data.objects.length === 0);
          if (data.background) setBoardBackground(data.background);
        } else {
          refreshBoard();
        }
      }
    );
    channel.bind(WB_EVENTS.PAGE_CHANGED, () => refreshBoard());

    channel.bind(WB_EVENTS.QUIZ_LAUNCHED, (data: LiveQuiz) => {
      setQuiz({ ...data, status: "ACTIVE" });
      setMySelection(null);
      setQuizError(null);
      setQuizDismissed(false);
      playPollAlert();
    });

    channel.bind(
      WB_EVENTS.QUIZ_REVEALED,
      (data: { id: string; correctOption: string | null }) => {
        setQuiz((prev) => {
          if (prev && prev.id === data.id) {
            playPollRevealChime(mySelection === data.correctOption);
            return { ...prev, status: "REVEALED", correctOption: data.correctOption };
          }
          return prev;
        });
      }
    );

    channel.bind(WB_EVENTS.QUIZ_CLOSED, (data: { id: string }) => {
      setQuiz((prev) => (prev && prev.id === data.id ? null : prev));
    });

    // Handle teacher approving speaking permission for this student
    channel.bind(
      WB_EVENTS.SPEAKER_APPROVED,
      (data: { studentUserId: string; studentName?: string; requestType: "AUDIO" | "VIDEO"; speakerToken?: string }) => {
        if (data.studentUserId === currentUserId) {
          setIsApprovedSpeaker(true);
          setSpeakerRequestType(data.requestType || "AUDIO");
          if (data.speakerToken) setSpeakerToken(data.speakerToken);
          playCallIncomingRingtone();
        } else if (data.requestType === "VIDEO" && data.studentName) {
          // A classmate (not me) just got approved for video — surface
          // their feed to the rest of the class too (see
          // LiveVideoCallModal's classSpeaker prop). This event already
          // broadcasts to every student on the shared session channel;
          // it was just being ignored for anyone but the approved student.
          setActiveClassSpeaker({ studentUserId: data.studentUserId, studentName: data.studentName });
        }
      }
    );

    // Handle teacher revoking speaking permission
    channel.bind(WB_EVENTS.SPEAKER_REVOKED, (data: { studentUserId: string }) => {
      if (data.studentUserId === currentUserId) {
        setIsApprovedSpeaker(false);
        setSpeakerToken(null);
        setSpeakerRequestType(null);
        setHandRaised(false);
      }
      setActiveClassSpeaker((prev) => (prev?.studentUserId === data.studentUserId ? null : prev));
    });

    // Teacher-initiated connect/disconnect — independent of hand-raise above.
    channel.bind(
      WB_EVENTS.TEACHER_CONNECT_UPDATED,
      (data: {
        studentUserId: string;
        audioConnected: boolean;
        videoConnected: boolean;
        connectionToken: string | null;
      }) => {
        if (data.studentUserId !== currentUserId) return;
        const nowConnected = data.audioConnected || data.videoConnected;
        if (nowConnected && !teacherConnectedRef.current) {
          playCallConnectedChime();
        }
        teacherConnectedRef.current = nowConnected;
        setTeacherAudioConnected(data.audioConnected);
        setTeacherVideoConnected(data.videoConnected);
        setTeacherConnectionToken(data.connectionToken);
      }
    );

    // Restore teacher-connect state after a refresh — server state is
    // authoritative, so this fills in what the last Pusher event (missed
    // while the page was reloading) would have set, including a freshly
    // minted token so the client can actually resume publishing.
    fetch(`/api/whiteboard/sessions/${wbSession.id}/teacher-connect`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.data) {
          setTeacherAudioConnected(!!j.data.audioConnected);
          setTeacherVideoConnected(!!j.data.videoConnected);
          setTeacherConnectionToken(j.data.connectionToken ?? null);
        }
      })
      .catch(() => {});

    // Check existing quiz

    fetch(`/api/whiteboard/sessions/${wbSession.id}/quiz`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.data?.quiz && j.data.quiz.status !== "CLOSED") {
          setQuiz(j.data.quiz);
          setMySelection(j.data.mySelection ?? null);
        }
      })
      .catch(() => {});

    return () => {
      client.unsubscribe(sessionChannel(wbSession.id));
    };
  }, [wbSession?.id]);

  // Quiz countdown
  useEffect(() => {
    if (!quiz || quiz.status !== "ACTIVE") return;
    const tick = () => {
      const deadline = new Date(quiz.startedAt).getTime() + quiz.timeLimitSec * 1000;
      setRemainingSec(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [quiz]);

  async function handleRaiseHandClick() {
    if (handRaised) {
      // Lower hand directly
      if (!wbSession?.id || handRaiseBusy) return;
      setHandRaiseBusy(true);
      try {
        await fetch(`/api/whiteboard/sessions/${wbSession.id}/hand-raise`, { method: "DELETE" });
        setHandRaised(false);
        setIsApprovedSpeaker(false);
      } catch {
        // ignore
      } finally {
        setHandRaiseBusy(false);
      }
    } else {
      // Show participation choice modal
      setHandRaiseModalOpen(true);
    }
  }

  async function submitHandRaise(type: "CHAT" | "AUDIO" | "VIDEO") {
    if (!wbSession?.id || handRaiseBusy) return;
    setHandRaiseBusy(true);
    setHandRaiseModalOpen(false);
    setHandRaised(true);
    setParticipationType(type);
    try {
      await postJson(`/api/whiteboard/sessions/${wbSession.id}/hand-raise`, { requestType: type });
    } catch {
      setHandRaised(false);
    } finally {
      setHandRaiseBusy(false);
    }
  }

  async function toggleHandRaise() {
    return handleRaiseHandClick();
  }

  async function handleEndCall() {
    try {
      if (wbSession?.id) {
        await fetch(`/api/whiteboard/sessions/${wbSession.id}/hand-raise`, { method: "DELETE" });
      }
    } catch {}
    setIsApprovedSpeaker(false);
    setSpeakerToken(null);
    setSpeakerRequestType(null);
    setHandRaised(false);
    setTeacherAudioConnected(false);
    setTeacherVideoConnected(false);
  }


  async function submitAnswer(optionKey: string) {
    if (!wbSession?.id || !quiz || submittingAnswer || mySelection) return;
    setSubmittingAnswer(true);
    setQuizError(null);
    // Optimistic: lock the button in immediately so one tap reads as one
    // tap. If the request turns out to have failed, mySelection is cleared
    // again below so the (still-ACTIVE) quiz becomes answerable once more.
    setMySelection(optionKey);
    try {
      await postJson(`/api/whiteboard/sessions/${wbSession.id}/quiz/${quiz.id}/respond`, {
        selectedOption: optionKey,
        optionKey,
      });
    } catch (err: any) {
      setMySelection(null);
      setQuizError(err instanceof Error ? err.message : "Could not submit your answer.");
    } finally {
      setSubmittingAnswer(false);
    }
  }

  // Authoritative timers
  const scheduledStartMs = wbSession?.scheduledStart
    ? new Date(wbSession.scheduledStart).getTime()
    : scheduleTimes?.startTime
    ? new Date(scheduleTimes.startTime).getTime()
    : 0;
  const scheduledEndMs = wbSession?.scheduledEnd
    ? new Date(wbSession.scheduledEnd).getTime()
    : scheduleTimes?.endTime
    ? new Date(scheduleTimes.endTime).getTime()
    : 0;
  const actualStartedAtMs = wbSession?.actualStartedAt
    ? new Date(wbSession.actualStartedAt).getTime()
    : null;

  const isLive = phase === "live" || wbSession?.livePhase === "LIVE";
  const secondsUntilStart = scheduledStartMs > 0 ? Math.floor((scheduledStartMs - currentTimeMs) / 1000) : 0;
  const elapsedSeconds = actualStartedAtMs ? Math.max(0, Math.floor((currentTimeMs - actualStartedAtMs) / 1000)) : 0;
  const remainingSeconds = scheduledEndMs > 0 ? Math.floor((scheduledEndMs - currentTimeMs) / 1000) : 0;

  const isThemeDark = wbSession?.classroomTheme !== "LIGHT";
  const isCameraCircle = wbSession?.cameraShape === "CIRCULAR";
  const isYouTube = wbSession?.videoTransport === "YOUTUBE";

  // ---------------- CLASS ENDED ----------------
  // Students see ONLY "Class Ended" + Student Learning Feedback.
  // Strictly NO PDF or PPTX download buttons appear on this immediate post-class screen.
  if (phase === "ended") {
    return (
      <div className="min-h-screen-safe w-full bg-[#0b0d14] flex flex-col justify-center px-4">
        <StudentPostClassFeedback
          sessionId={wbSession?.id || batchScheduleId}
          sessionTitle={scheduleTitle}
          teacherName={teacherName}
        />
      </div>
    );
  }

  // ---------------- PRE-CLASS CLASSROOM ----------------
  // Before the educator starts the session (livePhase: "LIVE"), students see
  // this pre-class classroom view instead — class info, countdown, teacher,
  // and chat, not a bare "waiting room" placeholder. The whiteboard canvas,
  // video broadcast, and teacher slides are strictly NOT mounted or revealed
  // until livePhase flips to "LIVE".
  if (!isLive) {
    const hours = Math.floor(Math.max(0, secondsUntilStart) / 3600);
    const minutes = Math.floor((Math.max(0, secondsUntilStart) % 3600) / 60);
    const seconds = Math.max(0, secondsUntilStart) % 60;

    return (
      <div className="min-h-screen-safe w-full bg-[#0b0d14] text-white flex flex-col justify-between select-none">
        {/* Top pre-class classroom header */}
        <header className="h-14 px-4 sm:px-6 shrink-0 flex items-center justify-between border-b border-slate-800/80 bg-[#10131d]">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/schedule"
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center shrink-0 transition shadow-xs"
              title="Back to Schedule"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
            </Link>
            <div className="w-8 h-8 rounded-xl overflow-hidden p-0.5 bg-white/5 border border-white/10 shrink-0 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/logo.png" alt="Atomic Pathshala" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate leading-tight">{batchName}</p>
              <h1 className="text-sm font-bold truncate max-w-xs sm:max-w-md text-white leading-tight">{scheduleTitle}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-blue-400 border border-blue-500/40 bg-blue-950/60 px-3 py-1 rounded-full shadow-xs">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              CLASSROOM
            </span>
          </div>
        </header>

        {/* Central pre-class classroom content */}
        <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 flex flex-col lg:flex-row items-stretch justify-center gap-6 my-auto">
          {/* Left Column: Hero & Countdown */}
          <div className="flex-1 bg-[#121422] border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-2xl space-y-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold">
                <span className="material-symbols-outlined text-sm animate-spin">hourglass_top</span>
                <span>Classroom is being prepared</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                {scheduleTitle}
              </h2>
              <p className="text-sm text-slate-400">
                Batch: <span className="text-blue-300 font-semibold">{batchName}</span>
              </p>
              {(subject || chapterTitle) && (
                <p className="text-sm text-slate-400">
                  {subject && <span className="text-blue-300 font-semibold">{subject}</span>}
                  {subject && chapterTitle && <span className="text-slate-600"> &middot; </span>}
                  {chapterTitle && <span>{chapterTitle}</span>}
                </p>
              )}
            </div>

            {/* Countdown / Status Box */}
            <div className="bg-[#181a2c] border border-slate-800/80 rounded-2xl p-5 text-center space-y-3">
              {secondsUntilStart > 0 ? (
                <>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Class Starts In</p>
                  <div className="flex items-center justify-center gap-3 font-mono">
                    <div className="bg-[#0e0f1a] border border-slate-700/60 rounded-xl px-3 py-2 min-w-[60px]">
                      <span className="text-2xl sm:text-3xl font-black text-white">{String(hours).padStart(2, "0")}</span>
                      <span className="block text-[9px] uppercase tracking-wider text-slate-500 font-sans mt-0.5">Hours</span>
                    </div>
                    <span className="text-2xl font-bold text-slate-600">:</span>
                    <div className="bg-[#0e0f1a] border border-slate-700/60 rounded-xl px-3 py-2 min-w-[60px]">
                      <span className="text-2xl sm:text-3xl font-black text-white">{String(minutes).padStart(2, "0")}</span>
                      <span className="block text-[9px] uppercase tracking-wider text-slate-500 font-sans mt-0.5">Mins</span>
                    </div>
                    <span className="text-2xl font-bold text-slate-600">:</span>
                    <div className="bg-[#0e0f1a] border border-slate-700/60 rounded-xl px-3 py-2 min-w-[60px]">
                      <span className="text-2xl sm:text-3xl font-black text-blue-400">{String(seconds).padStart(2, "0")}</span>
                      <span className="block text-[9px] uppercase tracking-wider text-slate-500 font-sans mt-0.5">Secs</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-2 py-2">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto border border-blue-500/30">
                    <span className="material-symbols-outlined text-xl animate-pulse">sensors</span>
                  </div>
                  <p className="text-base font-bold text-white">Starting Momentarily</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Your educator is setting up the live canvas &amp; broadcast. You will be connected automatically when class begins.
                  </p>
                </div>
              )}
            </div>

            {/* Educator Card */}
            <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-[#181a2c]/60 border border-slate-800">
              <div className="w-12 h-12 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-lg border border-blue-500/30">
                {teacherName ? teacherName.charAt(0).toUpperCase() : "E"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-bold text-white truncate">{teacherName || "Educator"}</h4>
                  <span className="material-symbols-outlined text-xs text-blue-400" title="Verified Educator">verified</span>
                </div>
                <p className="text-xs text-slate-400">Atomic Pathshala Faculty</p>
              </div>
            </div>

            {/* Preparation Tips */}
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-900/60 border border-slate-800/60">
                <span className="material-symbols-outlined text-blue-400 text-base">edit_note</span>
                <span>Keep notebook &amp; pen ready</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-900/60 border border-slate-800/60">
                <span className="material-symbols-outlined text-emerald-400 text-base">wifi</span>
                <span>Stable internet active</span>
              </div>
            </div>
          </div>

          {/* Right Column: Pre-Class Chat / Info Panel */}
          {wbSession?.id && wbSession?.chatEnabled ? (
            <div className="w-full lg:w-80 h-96 lg:h-auto flex flex-col bg-[#121422] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
              <div className="px-4 py-3 bg-[#0a0b12] border-b border-slate-800 flex items-center justify-between shrink-0">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-blue-400">chat</span>
                  Pre-Class Discussion
                </span>
                <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-full font-semibold">
                  Chat Open
                </span>
              </div>
              <div className="flex-1 min-h-0">
                <MessagesPanel
                  whiteboardSessionId={wbSession.id}
                  currentUserId={currentUserId}
                  role="STUDENT"
                  theme="dark"
                  showOwnToggle={false}
                />
              </div>
            </div>
          ) : (
            <div className="w-full lg:w-72 bg-[#121422] border border-slate-800 rounded-3xl p-6 flex flex-col justify-center items-center text-center space-y-3 shadow-2xl">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">lock_clock</span>
              </div>
              <h3 className="text-sm font-bold text-white">Live Stage Locked</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Strokes, presentation slides, quizzes, and live broadcast will unlock the instant the educator starts the session.
              </p>
            </div>
          )}
        </main>

        <footer className="h-10 px-4 flex items-center justify-center text-[11px] text-slate-500 border-t border-slate-800/60 bg-[#0d0e17]">
          <span>Atomic Pathshala Live Teaching Classroom • Stay on this screen for automatic entry</span>
        </footer>
      </div>
    );
  }

  // ---------------- COMPLETE WHITEBOARD STUDIO (ACTIVE FOR ALL STUDENTS ONCE LIVE) ----------------
  return (
    <div
      style={{
        height: viewportHeight ? `${viewportHeight}px` : "100dvh",
        maxHeight: viewportHeight ? `${viewportHeight}px` : "100dvh",
      }}
      className={`fixed inset-0 w-full flex flex-col overflow-hidden select-none z-50 ${isThemeDark ? "bg-[#0b0d14] text-white" : "bg-slate-900 text-slate-100"}`}
    >
      {/* Top Authoritative Studio Header */}
      <header className="h-12 sm:h-14 px-3 sm:px-4 shrink-0 flex items-center justify-between border-b border-slate-800/80 bg-[#10131d] z-20">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            href="/schedule"
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center shrink-0 transition shadow-xs"
            title="Back to Schedule"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
          </Link>
          <div className="w-8 h-8 rounded-xl overflow-hidden p-0.5 bg-white/5 border border-white/10 shrink-0 hidden xs:flex items-center justify-center">
            <img
              src="/brand/logo.png"
              alt="Atomic Pathshala Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate leading-tight">{batchName}</p>
            <h1 className="text-xs sm:text-sm font-bold truncate max-w-[140px] xs:max-w-[200px] sm:max-w-md text-white leading-tight">{scheduleTitle}</h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Status Badge */}
          {isLive ? (
            <span className="flex items-center gap-1.5 text-[11px] sm:text-xs font-black text-rose-400 border border-rose-500/40 bg-rose-950/60 px-2.5 sm:px-3 py-1 rounded-full shadow-sm shadow-rose-950">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              LIVE
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] sm:text-xs font-bold text-amber-400 border border-amber-500/40 bg-amber-950/60 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              CONNECTING
            </span>
          )}

          {/* Dynamic Timers */}
          {isLive ? (
            <span
              className="hidden sm:inline-flex items-center gap-1 text-xs font-mono font-semibold px-2.5 py-1 rounded-md bg-slate-800/90 border border-slate-700 text-slate-200"
              title={`Class runtime: ${formatDurationFriendly(elapsedSeconds)} since start`}
            >
              <span className="material-symbols-outlined text-xs text-emerald-400">schedule</span>
              Elapsed: {formatHms(elapsedSeconds)} <span className="text-[10px] text-slate-400 font-normal">({formatDurationFriendly(elapsedSeconds)})</span>
            </span>
          ) : secondsUntilStart > 0 ? (
            <span
              className="hidden sm:inline-flex items-center gap-1 text-xs font-mono font-semibold px-2.5 py-1 rounded-md bg-blue-950/60 border border-blue-500/40 text-blue-300"
              title="Time until scheduled class start"
            >
              <span className="material-symbols-outlined text-xs">hourglass_top</span>
              Starts in: {formatDurationFriendly(secondsUntilStart)} ({formatHms(secondsUntilStart)})
            </span>
          ) : null}

          {/* Mobile Orientation Toggle Button */}
          <button
            type="button"
            onClick={() => {
              setOrientationMode((prev) =>
                prev === "auto" ? "landscape" : prev === "landscape" ? "portrait" : "auto"
              );
            }}
            className="lg:hidden flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] sm:text-xs font-semibold border border-slate-700 transition"
            title={`Orientation: ${orientationMode.toUpperCase()} (Click to toggle)`}
          >
            <span className="material-symbols-outlined text-sm">
              {orientationMode === "landscape"
                ? "stay_current_landscape"
                : orientationMode === "portrait"
                ? "stay_current_portrait"
                : "screen_rotation"}
            </span>
            <span className="text-[10px] uppercase font-bold hidden xs:inline">{orientationMode}</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition border border-slate-700"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            <span className="material-symbols-outlined text-base">
              {isFullscreen ? "fullscreen_exit" : "fullscreen"}
            </span>
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* Main stage + right sidebar (video on top, chat below) — one layout
          at every screen size and orientation, matching the reference
          classroom UI the product owner asked to mirror, rather than
          switching to a separate stacked mobile layout below `lg`. */}
      {/* ========================================================================= */}
      <div className="flex flex-1 min-h-0 flex-row p-1.5 sm:p-3 gap-1.5 sm:gap-3 overflow-hidden bg-[#0b0d14]">
        {/* Left Main Stage (Whiteboard Canvas / YouTube Player + Overlaid Quiz Drawer) */}
        <div className="flex-1 min-w-0 h-full flex flex-col bg-[#10121d] rounded-2xl border border-slate-800/80 overflow-hidden relative shadow-2xl">
          {/* Presentation Title Banner */}
          <div className="flex items-center justify-between px-4 py-2 bg-[#0a0b12] border-b border-slate-800 text-xs text-slate-400 shrink-0">
            <span className="flex items-center gap-2 font-medium text-slate-300">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span>{isYouTube ? "Live Stream Broadcast" : "Live Whiteboard & Presentation Stage"}</span>
            </span>
            <div className="flex items-center gap-2">
              {wbSession?.presentationName && (
                <span className="text-[11px] font-mono text-blue-300 bg-blue-950/60 border border-blue-500/30 px-2 py-0.5 rounded">
                  {wbSession.presentationName}
                </span>
              )}
              <span className="text-[10px] font-bold text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded">
                16:9 HD Mirror
              </span>
            </div>
          </div>

          {/* Canvas Center Stage */}
          <div className="flex-1 min-h-0 w-full relative flex items-center justify-center p-2 bg-[#0d0e16] overflow-hidden">
            {isYouTube ? (
              <div className="w-full h-full max-w-full max-h-full aspect-video flex items-center justify-center">
                <YouTubeLivePlayer
                  youtubeVideoId={wbSession?.youtubeVideoId ?? null}
                  title={scheduleTitle}
                  subject={batchName}
                  livePhase={isLive ? "LIVE" : "PREPARING"}
                />
              </div>
            ) : (
              <StudentWhiteboardMirror
                boardBackground={boardBackground}
                boardEmpty={boardEmpty}
                isLive={isLive}
                objects={boardObjects}
              />
            )}

            {/* Desktop Quiz / Poll Floating Drawer (High Contrast + Close Button + Auto-Dismiss) */}
            {quiz && !quizDismissed && (
              <div className="absolute bottom-4 left-4 right-4 max-w-2xl mx-auto bg-[#13172b]/95 backdrop-blur-md border-2 border-blue-500 shadow-[0_0_35px_rgba(99,102,241,0.35)] rounded-2xl p-4 space-y-3 z-30 animate-in slide-in-from-bottom duration-200">
                <div className="flex items-center justify-between pb-1 border-b border-blue-900/60">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
                    {quiz.questionText || "Live Class Quiz"}
                  </h3>
                  <div className="flex items-center gap-2">
                    {quiz.status === "ACTIVE" ? (
                      <span className="text-xs font-mono font-black text-slate-950 bg-amber-400 border border-amber-300 px-2.5 py-0.5 rounded-full shadow">
                        {remainingSec}s
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/50 px-2.5 py-0.5 rounded-full">
                        {quiz.status === "REVEALED" ? "Results Revealed" : "Quiz Closed"}
                      </span>
                    )}
                    {/* Close (X) button */}
                    <button
                      type="button"
                      onClick={() => setQuizDismissed(true)}
                      className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                      title="Dismiss Quiz"
                    >
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  </div>
                </div>
                {quizError && <p className="text-xs text-rose-400 font-medium">{quizError}</p>}
                {quiz.status === "REVEALED" && (
                  <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                    {mySelection === quiz.correctOption ? (
                      <div className="p-3 rounded-xl bg-emerald-500/20 border-2 border-emerald-500/60 text-emerald-300 text-xs font-bold flex items-center gap-2.5">
                        <span className="text-xl">🎉</span>
                        <div>
                          <p className="font-extrabold text-white text-sm">Congratulations! Your answer is correct.</p>
                          <p className="text-[11px] text-emerald-300/90 font-medium">Option {quiz.correctOption} is the correct answer.</p>
                        </div>
                      </div>
                    ) : mySelection ? (
                      <div className="p-3 rounded-xl bg-rose-500/20 border-2 border-rose-500/60 text-rose-300 text-xs font-bold flex items-center gap-2.5">
                        <span className="text-xl">❌</span>
                        <div>
                          <p className="font-extrabold text-white text-sm">Your answer is incorrect.</p>
                          <p className="text-[11px] text-rose-300/90 font-medium">The correct answer is Option {quiz.correctOption}.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-blue-500/20 border-2 border-blue-500/60 text-blue-300 text-xs font-bold flex items-center gap-2.5">
                        <span className="text-xl">ℹ️</span>
                        <div>
                          <p className="font-extrabold text-white text-sm">Poll Ended</p>
                          <p className="text-[11px] text-blue-300/90 font-medium">The correct answer is Option {quiz.correctOption}.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {quiz.options.map((o) => {
                    const selected = mySelection === o.key;
                    const revealed = quiz.status === "REVEALED";
                    const isCorrect = revealed && quiz.correctOption === o.key;
                    const isWrong = revealed && selected && quiz.correctOption !== o.key;
                    return (
                      <button
                        key={o.key}
                        type="button"
                        disabled={Boolean(mySelection) || quiz.status !== "ACTIVE" || submittingAnswer}
                        onClick={() => submitAnswer(o.key)}
                        className={`text-left px-3.5 py-3 rounded-xl border-2 text-xs font-bold transition active:scale-[0.98] touch-manipulation cursor-pointer shadow-md ${
                          isCorrect
                            ? "border-emerald-400 bg-emerald-600 text-white shadow-emerald-500/50 ring-2 ring-emerald-300"
                            : isWrong
                            ? "border-rose-500 bg-rose-950/80 text-rose-200"
                            : selected
                            ? "border-white bg-blue-600 text-white shadow-blue-500/50 ring-2 ring-blue-400 scale-[1.02]"
                            : "bg-[#1a2038] hover:bg-[#252d4e] border-[#333d6b] hover:border-blue-400 text-white"
                        } disabled:cursor-default`}
                      >
                        <span className={`font-mono font-black mr-2 text-sm pointer-events-none ${selected || isCorrect ? "text-white" : "text-blue-400"}`}>{o.key}.</span>
                        <span className="truncate pointer-events-none text-white">{o.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Classroom Sidebar — Teacher Camera, Chat, Doubt/Hand Raise,
            Student Count, then a Settings control that hides/shows this
            whole panel (reference classroom layout). Width ramps up with
            viewport via Tailwind breakpoints alone (desktop/tablet/mobile
            each get a naturally-scaled width) rather than a JS viewport
            check, so there's no separate "mode" to keep in sync. */}
        <aside
          className={`${
            showChat
              ? "w-[38%] min-w-[132px] max-w-[230px] xs:max-w-[250px] sm:w-64 sm:max-w-none md:w-72 lg:w-80 xl:w-88 border border-slate-800/80"
              : "w-0 border-0"
          } h-full shrink-0 flex flex-col bg-[#10121d] rounded-2xl overflow-hidden shadow-2xl transition-[width] duration-200`}
        >
          {/* 1. Teacher Camera. <VideoStrip> is mounted exactly once, in
              this one wrapper, and never moves in the tree — only the
              wrapper's own CSS switches between "docked at sidebar top"
              and "fixed-position draggable bubble over the main stage"
              when the sidebar is hidden, so the LiveKit connection it
              holds is never dropped by toggling the sidebar. */}
          <div
            onPointerDown={!showChat ? handleFloatCamPointerDown : undefined}
            onPointerMove={!showChat ? handleFloatCamPointerMove : undefined}
            onPointerUp={!showChat ? handleFloatCamPointerUp : undefined}
            onPointerCancel={!showChat ? handleFloatCamPointerUp : undefined}
            style={
              !showChat
                ? { position: "fixed", top: floatCamPos.y, left: floatCamPos.x, width: FLOAT_CAM_SIZE, height: FLOAT_CAM_SIZE, touchAction: "none" }
                : undefined
            }
            className={
              !showChat
                ? "z-40 rounded-full overflow-hidden border-2 border-blue-500 shadow-2xl bg-black cursor-grab active:cursor-grabbing select-none"
                : "h-24 xs:h-28 sm:h-48 md:h-52 bg-black relative border-b border-slate-800 shrink-0"
            }
          >
            <VideoStrip
              whiteboardSessionId={wbSession?.id || batchScheduleId}
              variant="panel"
              role="STUDENT"
              teacherName={teacherName}
              isApprovedSpeaker={isApprovedSpeaker}
              speakerRequestType={speakerRequestType}
              speakerToken={speakerToken}
              teacherAudioConnected={teacherAudioConnected}
              teacherVideoConnected={teacherVideoConnected}
              teacherConnectionToken={teacherConnectionToken}
              onEndCall={handleEndCall}
              classSpeaker={activeClassSpeaker}
            />

            {!showChat && (
              <button
                type="button"
                onClick={() => setShowChat(true)}
                title="Show sidebar"
                className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-slate-800 hover:bg-blue-600 text-white flex items-center justify-center border-2 border-slate-900 shadow-md transition"
              >
                <span className="material-symbols-outlined text-[13px]">open_in_full</span>
              </button>
            )}
          </div>

          {showChat && (
            <>
              {/* Approved Speaker Banner */}
              {isApprovedSpeaker && (
                <div className="mx-3 my-2 bg-emerald-950/80 border border-emerald-500/60 rounded-xl px-3 py-1.5 flex items-center justify-between text-xs text-emerald-200 font-bold shrink-0">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Speaking Active
                  </span>
                  <span className="text-[10px] text-emerald-400 font-normal">Mic Connected</span>
                </div>
              )}

              {/* Teacher-Connected Banner — informational only, no accept/reject
                  (same as hand-raise approval above, the teacher's action is
                  already authoritative by the time this fires). */}
              {(teacherAudioConnected || teacherVideoConnected) && (
                <div className="mx-3 my-2 bg-blue-950/80 border border-blue-500/60 rounded-xl px-3 py-1.5 flex items-center justify-between text-xs text-blue-200 font-bold shrink-0">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                    {teacherVideoConnected ? "Teacher connected your camera & mic" : "Teacher connected your mic"}
                  </span>
                  <span className="text-[10px] text-blue-400 font-normal">
                    {teacherVideoConnected ? "Camera + Mic" : "Mic Only"}
                  </span>
                </div>
              )}

              {/* Sidebar Header Tabs */}
              <div className="flex border-b border-slate-800 px-3 pt-2 shrink-0 bg-[#0a0b12]">
                <span className="px-3 py-2 text-xs font-bold text-blue-400 border-b-2 border-blue-500 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">chat</span>
                  Live Classroom Chat
                </span>
              </div>

              {/* 2. Chat — the flexible section, everything else below is a
                  compact fixed-height row. */}
              <div className="flex-1 min-h-0 p-2 flex flex-col bg-[#0d0f18]">
                {wbSession?.id ? (
                  <MessagesPanel
                    whiteboardSessionId={wbSession.id}
                    currentUserId={currentUserId}
                    role="STUDENT"
                    theme="dark"
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    Connecting chat...
                  </div>
                )}
              </div>

              {/* 3. Doubt + Hand Raise — one compact row instead of two
                  separate sections. Doubt pings a quick chat-only
                  hand-raise request; Hand Raise opens the existing
                  audio/video participation modal below. Both still go
                  through the same hand-raise backend as before. */}
              <div className="shrink-0 grid grid-cols-2 gap-1.5 px-2 pt-1.5 pb-2 bg-[#0d0f18] border-t border-slate-800/60">
                <button
                  type="button"
                  disabled={handRaiseBusy}
                  onClick={() => (handRaised && participationType === "CHAT" ? handleRaiseHandClick() : submitHandRaise("CHAT"))}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold border transition disabled:opacity-60 ${
                    handRaised && participationType === "CHAT"
                      ? "bg-amber-500 border-amber-300 text-slate-950"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">contact_support</span>
                  Ask Doubt
                </button>
                <button
                  type="button"
                  disabled={handRaiseBusy}
                  onClick={toggleHandRaise}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold border transition disabled:opacity-60 ${
                    handRaised
                      ? "bg-amber-500 border-amber-300 text-slate-950"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">back_hand</span>
                  {handRaised ? "Lower" : "Raise Hand"}
                </button>
              </div>

              {/* 4. Student Count — real presence-channel membership, not a
                  static/fake number. */}
              <div className="shrink-0 px-3 py-1.5 border-t border-slate-800 flex items-center justify-center gap-1.5 text-xs bg-[#0a0b12]">
                <span className="material-symbols-outlined text-sm text-emerald-400">group</span>
                <span className="font-bold text-white">{onlineCount}</span>
                <span className="text-slate-500">{onlineCount === 1 ? "Student" : "Students"} Online</span>
              </div>

              {/* 5. Settings / Hide Sidebar */}
              <button
                type="button"
                onClick={() => setShowChat(false)}
                className="shrink-0 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white bg-[#0a0b12] hover:bg-slate-800 border-t border-slate-800 transition"
              >
                <span className="material-symbols-outlined text-sm">visibility_off</span>
                Hide Sidebar
              </button>
            </>
          )}
        </aside>
      </div>

      {/* Student Hand Raise Participation Modal */}

      {handRaiseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4 text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400 text-2xl">back_hand</span>
                <h3 className="text-base font-bold">Ask Doubt / Participate</h3>
              </div>
              <button
                type="button"
                onClick={() => setHandRaiseModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Select how you would like to interact with the teacher once approved:
            </p>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => submitHandRaise("AUDIO")}
                disabled={handRaiseBusy}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-700 hover:border-blue-500 bg-slate-800/60 hover:bg-blue-950/30 text-left transition group"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <span className="material-symbols-outlined text-xl">mic</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white group-hover:text-blue-300 transition">
                    Request to Speak (Audio Only)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Your microphone will be enabled once teacher approves your request.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => submitHandRaise("VIDEO")}
                disabled={handRaiseBusy}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-700 hover:border-blue-500 bg-slate-800/60 hover:bg-blue-950/30 text-left transition group"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <span className="material-symbols-outlined text-xl">videocam</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white group-hover:text-blue-300 transition">
                    Request Video + Audio
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Join as a live video participant upon teacher approval.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => submitHandRaise("CHAT")}
                disabled={handRaiseBusy}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-700 hover:border-slate-500 bg-slate-800/60 hover:bg-slate-800 text-left transition group"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-700/50 text-slate-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <span className="material-symbols-outlined text-xl">chat</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white transition">Chat Queue Only</h4>
                  <p className="text-[11px] text-slate-400">
                    Alert the teacher to read your question in the classroom chat.
                  </p>
                </div>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setHandRaiseModalOpen(false)}
                className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

