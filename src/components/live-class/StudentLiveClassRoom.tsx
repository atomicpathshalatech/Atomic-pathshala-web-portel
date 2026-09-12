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
import { DraggableFloatingCamera } from "@/components/live-class/DraggableFloatingCamera";


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
  currentUserId,
}: {
  batchScheduleId: string;
  scheduleTitle: string;
  batchName: string;
  teacherName: string | null;
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
  const [speakerToken, setSpeakerToken] = useState<string | null>(null);

  // Teacher-initiated connect — independent of the hand-raise flow above
  // (teacher grants directly, no request from the student involved).
  const [teacherAudioConnected, setTeacherAudioConnected] = useState(false);
  const [teacherVideoConnected, setTeacherVideoConnected] = useState(false);
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
      const t = setTimeout(() => {
        setQuizDismissed(true);
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [quiz?.status]);

  const [activeMobileTab, setActiveMobileTab] = useState<"chat" | "quiz" | "info">("chat");
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Governs the single merged teacher-video + chat popup on desktop (see
  // the floating panel in the lg:flex branch below). Mobile's chat lives in
  // its own always-visible tab and isn't gated by this.
  const [showChat, setShowChat] = useState(true);

  // Exactly one <VideoStrip> must ever be mounted per student: it opens its
  // own LiveKit connection using this student's fixed participant identity,
  // and LiveKit only allows one live connection per identity per room - a
  // second one joining makes the server boot the first ("client leave
  // request received"), which immediately reconnects and boots the new one
  // right back, forever. The desktop/mobile layouts below are pure CSS
  // toggles (hidden lg:flex / lg:hidden) so both are always mounted in
  // React - track the viewport ourselves so only the visible layout's
  // VideoStrip actually renders.
  const [isDesktopViewport, setIsDesktopViewport] = useState(true);
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    setIsDesktopViewport(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktopViewport(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
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
    });

    channel.bind(
      WB_EVENTS.QUIZ_REVEALED,
      (data: { id: string; correctOption: string | null }) => {
        setQuiz((prev) => (prev && prev.id === data.id ? { ...prev, status: "REVEALED", correctOption: data.correctOption } : prev));
      }
    );

    channel.bind(WB_EVENTS.QUIZ_CLOSED, (data: { id: string }) => {
      setQuiz((prev) => (prev && prev.id === data.id ? null : prev));
    });

    // Handle teacher approving speaking permission for this student
    channel.bind(
      WB_EVENTS.SPEAKER_APPROVED,
      (data: { studentUserId: string; requestType: "AUDIO" | "VIDEO"; speakerToken?: string }) => {
        if (data.studentUserId === currentUserId) {
          setIsApprovedSpeaker(true);
          if (data.speakerToken) setSpeakerToken(data.speakerToken);
        }
      }
    );

    // Handle teacher revoking speaking permission
    channel.bind(WB_EVENTS.SPEAKER_REVOKED, (data: { studentUserId: string }) => {
      if (data.studentUserId === currentUserId) {
        setIsApprovedSpeaker(false);
        setSpeakerToken(null);
        setHandRaised(false);
      }
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

  // ---------------- WAITING ROOM (PRE-CLASS LOBBY) ----------------
  // If the class has not started yet, students stay in this dedicated Waiting Room.
  // The Whiteboard Canvas, video broadcast, and teacher slides are strictly NOT mounted or revealed
  // until the educator starts the session (livePhase: "LIVE").
  if (!isLive) {
    const hours = Math.floor(Math.max(0, secondsUntilStart) / 3600);
    const minutes = Math.floor((Math.max(0, secondsUntilStart) % 3600) / 60);
    const seconds = Math.max(0, secondsUntilStart) % 60;

    return (
      <div className="min-h-screen-safe w-full bg-[#0b0d14] text-white flex flex-col justify-between select-none">
        {/* Top Waiting Room Header */}
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
            <span className="flex items-center gap-1.5 text-xs font-bold text-amber-400 border border-amber-500/40 bg-amber-950/60 px-3 py-1 rounded-full shadow-xs">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              WAITING ROOM
            </span>
          </div>
        </header>

        {/* Central Waiting Room Content */}
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
    <div className={`fixed inset-0 w-full h-full h-screen-safe flex flex-col overflow-hidden select-none z-50 ${isThemeDark ? "bg-[#0b0d14] text-white" : "bg-slate-900 text-slate-100"}`}>
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

          {/* Raise Hand Button */}
          <button
            type="button"
            disabled={handRaiseBusy}
            onClick={toggleHandRaise}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition shadow-sm ${
              handRaised
                ? "bg-amber-500 text-slate-950 ring-2 ring-amber-400/50"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
            }`}
            title={handRaised ? "Lower Hand" : "Raise Hand to ask Doubt"}
          >
            <span className="material-symbols-outlined text-sm">back_hand</span>
            <span className="hidden xs:inline">{handRaised ? "Raised" : "Raise"}</span>
          </button>

          {/* Local Hide/Show Teacher-Video-&-Chat Popup (Student Preference).
              Desktop-only: on mobile, video is a PiP corner overlay and chat
              is its own always-visible tab, neither gated by this toggle. */}
          <button
            type="button"
            onClick={() => setShowChat((v) => !v)}
            className={`hidden lg:flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition shadow-sm border ${
              showChat
                ? "bg-slate-800 hover:bg-slate-700 text-blue-300 border-blue-500/40"
                : "bg-slate-800/60 hover:bg-slate-700/80 text-slate-400 border-slate-700"
            }`}
            title={showChat ? "Minimize teacher video & chat (distraction-free focus)" : "Show teacher video & chat"}
          >
            <span className="material-symbols-outlined text-sm">
              {showChat ? "chat" : "chat_bubble_outline"}
            </span>
            <span className="hidden xs:inline">{showChat ? "Chat" : "Chat Off"}</span>
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
      {/* DESKTOP & LAPTOP VIEW (lg and up): Fixed 2-Column Split */}
      {/* ========================================================================= */}
      <div className="hidden lg:flex flex-1 min-h-0 flex-row p-3 gap-3 overflow-hidden bg-[#0b0d14]">
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
            ) : isDesktopViewport ? (
              <StudentWhiteboardMirror
                boardBackground={boardBackground}
                boardEmpty={boardEmpty}
                isLive={isLive}
                objects={boardObjects}
              />
            ) : null}

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

        {/* Right Fixed Sidebar (Teacher Video on Top + Live Chat Console on Bottom) */}
        <aside className="w-80 xl:w-88 h-full shrink-0 flex flex-col bg-[#10121d] rounded-2xl border border-slate-800/80 overflow-hidden shadow-2xl">
          {/* Pinned Teacher Video on Top */}
          <div className="h-48 sm:h-52 bg-black relative border-b border-slate-800 shrink-0">
            {isDesktopViewport && (
              <VideoStrip
                whiteboardSessionId={wbSession?.id || batchScheduleId}
                variant="panel"
                role="STUDENT"
                teacherName={teacherName}
                isApprovedSpeaker={isApprovedSpeaker}
                speakerToken={speakerToken}
                teacherAudioConnected={teacherAudioConnected}
                teacherVideoConnected={teacherVideoConnected}
                teacherConnectionToken={teacherConnectionToken}
              />
            )}
          </div>

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

          {/* Fixed Scrollable Chat Console */}
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
        </aside>
      </div>

      {/* ========================================================================= */}
      {/* MOBILE & TABLET VIEW (< lg): Top Video/Canvas Stage + Bottom Tabbed Console */}
      {/* ========================================================================= */}
      <div className="lg:hidden flex-1 min-h-0 flex flex-col landscape:flex-row overflow-hidden bg-[#0b0d14]">
        {/* Top Media Area: 16:9 Canvas or YouTube Player */}
        <div className="w-full landscape:w-3/5 landscape:h-full shrink-0 aspect-video landscape:aspect-auto max-h-[38dvh] sm:max-h-[45dvh] landscape:max-h-full bg-black relative flex items-center justify-center overflow-hidden border-b landscape:border-b-0 landscape:border-r border-slate-800/80">
          {isYouTube ? (
            <YouTubeLivePlayer
              youtubeVideoId={wbSession?.youtubeVideoId ?? null}
              title={scheduleTitle}
              subject={batchName}
              livePhase={isLive ? "LIVE" : "PREPARING"}
            />
          ) : !isDesktopViewport ? (
            <div className="relative aspect-[16/9] w-full h-full max-w-full max-h-full overflow-hidden">
              <StudentWhiteboardMirror
                boardBackground={boardBackground}
                boardEmpty={boardEmpty}
                isLive={isLive}
                objects={boardObjects}
              />
              {/* Mobile PiP Teacher Video (Corner Preview) */}
              {!isYouTube && (
                <div className="absolute top-2 right-2 w-28 xs:w-32 aspect-video rounded-lg overflow-hidden border border-blue-500/60 shadow-xl bg-[#10121d] z-20">
                  <VideoStrip
                    whiteboardSessionId={wbSession?.id || batchScheduleId}
                    variant="panel"
                    role="STUDENT"
                    teacherName={teacherName}
                    isApprovedSpeaker={isApprovedSpeaker}
                    speakerToken={speakerToken}
                    teacherAudioConnected={teacherAudioConnected}
                    teacherVideoConnected={teacherVideoConnected}
                    teacherConnectionToken={teacherConnectionToken}
                  />
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Bottom Interactive Area (Tabs: Chat | Quiz | Details) */}
        <div className="flex-1 landscape:w-2/5 min-h-0 flex flex-col bg-[#10121d] overflow-hidden">
          {/* Tab Selection Bar */}
          <div className="flex items-center justify-around bg-[#0a0b12] border-b border-slate-800 shrink-0 px-2">
            <button
              type="button"
              onClick={() => setActiveMobileTab("chat")}
              className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
                activeMobileTab === "chat"
                  ? "text-blue-400 border-blue-500 bg-blue-950/20"
                  : "text-slate-400 border-transparent hover:text-slate-200"
              }`}
            >
              <span className="material-symbols-outlined text-base">chat</span>
              <span>Live Chat</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMobileTab("quiz")}
              className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border-b-2 relative ${
                activeMobileTab === "quiz"
                  ? "text-blue-400 border-blue-500 bg-blue-950/20"
                  : "text-slate-400 border-transparent hover:text-slate-200"
              }`}
            >
              <span className="material-symbols-outlined text-base">quiz</span>
              <span>Quiz &amp; Polls</span>
              {quiz && quiz.status === "ACTIVE" && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping absolute top-2 right-3" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveMobileTab("info")}
              className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
                activeMobileTab === "info"
                  ? "text-blue-400 border-blue-500 bg-blue-950/20"
                  : "text-slate-400 border-transparent hover:text-slate-200"
              }`}
            >
              <span className="material-symbols-outlined text-base">info</span>
              <span>Class Info</span>
            </button>
          </div>

          {/* Active Tab Body */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {activeMobileTab === "chat" && (
              <div className="h-full p-2">
                {wbSession?.id ? (
                  <MessagesPanel
                    whiteboardSessionId={wbSession.id}
                    currentUserId={currentUserId}
                    role="STUDENT"
                    theme={isThemeDark ? "dark" : "light"}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    Connecting live chat...
                  </div>
                )}
              </div>
            )}

            {activeMobileTab === "quiz" && (
              <div className="p-4 space-y-4">
                {quiz ? (
                  <div className="bg-[#13172b] border-2 border-blue-500 rounded-2xl p-4 shadow-2xl space-y-3">
                    <div className="flex items-center justify-between pb-1 border-b border-blue-900/60">
                      <h3 className="text-sm font-black text-white flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
                        {quiz.questionText || "Live Class Quiz"}
                      </h3>
                      {quiz.status === "ACTIVE" ? (
                        <span className="text-xs font-mono font-black text-slate-950 bg-amber-400 border border-amber-300 px-2.5 py-0.5 rounded-full shadow">
                          {remainingSec}s
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/50 px-2.5 py-0.5 rounded-full">
                          {quiz.status === "REVEALED" ? "Results Revealed" : "Closed"}
                        </span>
                      )}
                    </div>
                    {quizError && <p className="text-xs text-rose-400 font-medium">{quizError}</p>}
                    <div className="grid grid-cols-1 gap-2.5">
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
                            className={`text-left px-4 py-3 rounded-xl border-2 text-xs font-bold transition active:scale-[0.98] touch-manipulation cursor-pointer shadow-md ${
                              isCorrect
                                ? "border-emerald-400 bg-emerald-600 text-white shadow-emerald-500/50 ring-2 ring-emerald-300"
                                : isWrong
                                ? "border-rose-500 bg-rose-950/80 text-rose-200"
                                : selected
                                ? "border-white bg-blue-600 text-white shadow-blue-500/50 ring-2 ring-blue-400"
                                : "bg-[#1a2038] hover:bg-[#252d4e] border-[#333d6b] text-white"
                            } disabled:cursor-default`}
                          >
                            <span className={`font-mono font-black mr-2 text-sm pointer-events-none ${selected || isCorrect ? "text-white" : "text-blue-400"}`}>{o.key}.</span>
                            <span className="pointer-events-none text-white">{o.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500 space-y-2">
                    <span className="material-symbols-outlined text-3xl">hourglass_empty</span>
                    <p className="text-xs font-semibold">No active quiz or poll at this moment.</p>
                    <p className="text-[11px]">When the teacher launches a live poll, it will appear here instantly.</p>
                  </div>
                )}
              </div>
            )}

            {activeMobileTab === "info" && (
              <div className="p-4 space-y-4 text-xs">
                {/* Full Teacher Video Preview in Info */}
                {!isYouTube && (
                  <div className="space-y-1.5">
                    <p className="font-bold text-slate-400 text-[11px] uppercase tracking-wider">Teacher Video Stream</p>
                    <div className="w-full aspect-video rounded-xl overflow-hidden bg-[#0a0b12] border border-slate-800 shadow-md flex flex-col items-center justify-center gap-2">
                      <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-500/40 text-blue-400 flex items-center justify-center">
                        <span className="material-symbols-outlined text-xl">videocam</span>
                      </div>
                      <p className="text-xs font-bold text-white">{teacherName || "Instructor"}</p>
                      <span className="text-[10px] text-blue-300 flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-rose-500 animate-ping" : "bg-amber-400 animate-pulse"}`} />
                        {isLive ? "Live Teaching" : "Awaiting Class"}
                      </span>
                    </div>
                  </div>
                )}

                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex justify-between items-center py-1 border-b border-slate-800">
                    <span className="text-slate-400">Batch:</span>
                    <span className="font-bold text-white truncate max-w-[200px]">{batchName}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-800">
                    <span className="text-slate-400">Topic:</span>
                    <span className="font-bold text-white truncate max-w-[200px]">{scheduleTitle}</span>
                  </div>
                  {teacherName && (
                    <div className="flex justify-between items-center py-1 border-b border-slate-800">
                      <span className="text-slate-400">Teacher:</span>
                      <span className="font-bold text-blue-300">{teacherName}</span>
                    </div>
                  )}
                  {wbSession?.presentationName && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-400">Material:</span>
                      <span className="font-mono text-[11px] text-blue-400">{wbSession.presentationName}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
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

