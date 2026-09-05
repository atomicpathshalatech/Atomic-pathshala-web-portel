"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getPusherClient } from "@/lib/realtime/pusher-client";
import { sessionChannel, WB_EVENTS } from "@/lib/realtime/events";
import { CanvasEngine, type StrokeObject } from "@/lib/canvas/canvas-engine";
import { MessagesPanel } from "@/components/live-class/MessagesPanel";
import { YouTubeLivePlayer } from "@/components/live-class/YouTubeLivePlayer";

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
  if (h > 0) return `${isNeg ? "-" : ""}${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${isNeg ? "-" : ""}${pad(m)}:${pad(s)}`;
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

  const [quiz, setQuiz] = useState<LiveQuiz | null>(null);
  const [mySelection, setMySelection] = useState<string | null>(null);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [remainingSec, setRemainingSec] = useState(0);
  const [quizError, setQuizError] = useState<string | null>(null);

  const [activeMobileTab, setActiveMobileTab] = useState<"chat" | "quiz" | "info">("chat");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Time & countdown state
  const [currentTimeMs, setCurrentTimeMs] = useState(Date.now());
  const [scheduleTimes, setScheduleTimes] = useState<{ startTime?: string; endTime?: string } | null>(null);

  // Board mirror (read-only)
  const boardBaseRef = useRef<HTMLCanvasElement>(null);
  const boardActiveRef = useRef<HTMLCanvasElement>(null);
  const boardEngineRef = useRef<CanvasEngine | null>(null);
  const [boardEmpty, setBoardEmpty] = useState(true);
  const [boardBackground, setBoardBackground] = useState<string>("blank");

  // Keep local clock ticking for authoritative UI timers
  useEffect(() => {
    const interval = setInterval(() => setCurrentTimeMs(Date.now()), 1000);
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
  }, [wbSession?.id]);

  // Board mirror refresh
  async function refreshBoard() {
    if (!wbSession?.id || !boardEngineRef.current) return;
    try {
      const res = await fetch(`/api/whiteboard/sessions/${wbSession.id}/board`);
      const json = await res.json();
      if (!res.ok || !json.success) return;
      const objects: StrokeObject[] = json.data.page?.objects ?? [];
      boardEngineRef.current.syncSize();
      boardEngineRef.current.loadObjects(objects);
      setBoardEmpty(objects.length === 0);
      setBoardBackground(json.data.page?.background ?? "blank");
    } catch {
      // best effort
    }
  }

  // Mount read-only board-mirror canvas whenever room is open
  useEffect(() => {
    if (phase === "ended" || !boardBaseRef.current || !boardActiveRef.current) return;
    const engine = new CanvasEngine(boardBaseRef.current, boardActiveRef.current, undefined, undefined, {
      readOnly: true,
    });
    boardEngineRef.current = engine;
    engine.syncSize();
    refreshBoard();

    const onResize = () => {
      engine.syncSize();
      refreshBoard();
    };
    window.addEventListener("resize", onResize);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && boardBaseRef.current.parentElement) {
      ro = new ResizeObserver(() => {
        engine.syncSize();
        refreshBoard();
      });
      ro.observe(boardBaseRef.current.parentElement);
    }

    return () => {
      window.removeEventListener("resize", onResize);
      if (ro) ro.disconnect();
      engine.destroy();
      boardEngineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, wbSession?.id]);

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

    channel.bind(WB_EVENTS.BOARD_UPDATED, () => refreshBoard());
    channel.bind(WB_EVENTS.PAGE_CHANGED, () => refreshBoard());

    channel.bind(WB_EVENTS.QUIZ_LAUNCHED, (data: LiveQuiz) => {
      setQuiz({ ...data, status: "ACTIVE" });
      setMySelection(null);
      setQuizError(null);
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

    // Check existing quiz
    fetch(`/api/whiteboard/sessions/${wbSession.id}/quiz`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.data?.quiz && j.data.quiz.status !== "CLOSED") {
          setQuiz(j.data.quiz);
          if (j.data.hasResponded) setMySelection("__submitted__");
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

  async function toggleHandRaise() {
    if (!wbSession?.id || handRaiseBusy) return;
    setHandRaiseBusy(true);
    try {
      if (handRaised) {
        await fetch(`/api/whiteboard/sessions/${wbSession.id}/hand-raise`, { method: "DELETE" });
        setHandRaised(false);
      } else {
        await postJson(`/api/whiteboard/sessions/${wbSession.id}/hand-raise`);
        setHandRaised(true);
      }
    } catch {
      // ignore
    } finally {
      setHandRaiseBusy(false);
    }
  }

  async function submitAnswer(optionKey: string) {
    if (!wbSession?.id || !quiz || submittingAnswer || mySelection) return;
    setSubmittingAnswer(true);
    setQuizError(null);
    try {
      await postJson(`/api/whiteboard/sessions/${wbSession.id}/quiz/${quiz.id}/respond`, { optionKey });
      setMySelection(optionKey);
    } catch (err: any) {
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
  if (phase === "ended") {
    return (
      <div className="max-w-xl mx-auto mt-16 p-8 bg-slate-900 text-white rounded-3xl border border-slate-800 text-center space-y-4 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-3xl">event_busy</span>
        </div>
        <h2 className="text-2xl font-bold text-white">This Class Has Ended</h2>
        <p className="text-xs text-slate-400">
          The teacher has concluded this live teaching session. The class recording and study notes will be processed shortly.
        </p>
        <Link
          href="/schedule"
          className="inline-block mt-4 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/30"
        >
          &larr; Return to Schedule
        </Link>
      </div>
    );
  }

  // ---------------- COMPLETE WHITEBOARD STUDIO (ACTIVE FOR ALL STUDENTS) ----------------
  return (
    <div className={`fixed inset-0 w-screen h-[100dvh] flex flex-col overflow-hidden select-none z-50 ${isThemeDark ? "bg-[#0b0d14] text-white" : "bg-slate-900 text-slate-100"}`}>
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
            <span className="hidden sm:inline-flex text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-800/90 border border-slate-700 text-slate-200">
              {formatHms(elapsedSeconds)}
            </span>
          ) : secondsUntilStart > 0 ? (
            <span className="hidden sm:inline-flex text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-indigo-950/60 border border-indigo-500/40 text-indigo-300">
              Starts: {formatHms(secondsUntilStart)}
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
      {/* DESKTOP & LAPTOP VIEW (lg and up): 2-Column Split (Left Canvas, Right Feed/Chat) */}
      {/* ========================================================================= */}
      <div className="hidden lg:flex flex-1 min-h-0 flex-row p-3 gap-3 overflow-hidden bg-[#0b0d14]">
        {/* Left Main Stage (Whiteboard Canvas / YouTube Player + Quiz Drawer) */}
        <div className="flex-1 min-w-0 h-full flex flex-col bg-[#10121d] rounded-2xl border border-slate-800/80 overflow-hidden relative shadow-2xl">
          {/* Presentation Title Banner */}
          <div className="flex items-center justify-between px-4 py-2 bg-[#0a0b12] border-b border-slate-800 text-xs text-slate-400 shrink-0">
            <span className="flex items-center gap-2 font-medium text-slate-300">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              <span>{isYouTube ? "Live Stream Broadcast" : "Live Whiteboard & Presentation Stage"}</span>
            </span>
            <div className="flex items-center gap-2">
              {wbSession?.presentationName && (
                <span className="text-[11px] font-mono text-indigo-300 bg-indigo-950/60 border border-indigo-500/30 px-2 py-0.5 rounded">
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
              <div className={`relative aspect-[16/9] w-full max-w-full max-h-full h-auto overflow-hidden rounded-xl border border-slate-800/60 shadow-2xl ${boardBackground === "dark" ? "bg-[#10131d]" : "bg-white"}`}>
                {isBackgroundImageUrl(boardBackground) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={boardBackground}
                    alt=""
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  />
                )}
                <canvas ref={boardBaseRef} className="absolute inset-0 w-full h-full" />
                <canvas ref={boardActiveRef} className="absolute inset-0 w-full h-full pointer-events-none" />

                {/* Standby Watermark */}
                {boardEmpty && !isBackgroundImageUrl(boardBackground) && (
                  <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none text-center p-6 ${
                    boardBackground === "dark"
                      ? "bg-gradient-to-b from-transparent via-[#10131d]/40 to-[#10131d]/80 text-slate-300"
                      : "bg-gradient-to-b from-transparent via-slate-100/40 to-slate-200/80 text-slate-700"
                  }`}>
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center mb-1">
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
            )}

            {/* Desktop Quiz / Poll Floating Drawer */}
            {quiz && (
              <div className="absolute bottom-4 left-4 right-4 max-w-2xl mx-auto bg-slate-900/95 backdrop-blur-md border border-indigo-500/60 rounded-2xl p-4 shadow-2xl space-y-2 z-30 animate-in slide-in-from-bottom duration-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                    {quiz.questionText || "Live Class Quiz"}
                  </h3>
                  {quiz.status === "ACTIVE" && (
                    <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded-full">
                      {remainingSec}s
                    </span>
                  )}
                </div>
                {quizError && <p className="text-[11px] text-rose-400">{quizError}</p>}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {quiz.options.map((o) => {
                    const selected = mySelection === o.key;
                    const revealed = quiz.status === "REVEALED";
                    const isCorrect = revealed && quiz.correctOption === o.key;
                    return (
                      <button
                        key={o.key}
                        type="button"
                        disabled={Boolean(mySelection) || quiz.status !== "ACTIVE" || submittingAnswer}
                        onClick={() => submitAnswer(o.key)}
                        className={`text-left px-3 py-2 rounded-xl border text-xs font-medium transition ${
                          isCorrect
                            ? "border-emerald-500 bg-emerald-950/60 text-emerald-300 font-bold"
                            : selected
                            ? "border-indigo-500 bg-indigo-950/60 text-white font-bold"
                            : "border-slate-800 hover:bg-slate-800 text-slate-300"
                        } disabled:cursor-default`}
                      >
                        <span className="font-mono font-bold mr-1.5 text-indigo-400">{o.key}.</span>
                        <span className="truncate">{o.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Rail (Teacher Video + Live Chat) */}
        <div className="w-80 xl:w-96 h-full flex flex-col gap-3 shrink-0">
          {/* Teacher Video Box */}
          {!isYouTube && (
            <div className={`bg-[#10121d] border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl shrink-0 ${isCameraCircle ? "p-3 flex items-center justify-center aspect-square" : ""}`}>
              <div className={`w-full overflow-hidden ${isCameraCircle ? "aspect-square rounded-full border-2 border-indigo-500 shadow-lg shadow-indigo-500/20" : "aspect-video rounded-xl"}`}>
                <div className="relative w-full h-full bg-[#0a0b12] rounded-xl overflow-hidden border border-[#252836] flex flex-col items-center justify-center p-4 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center mb-2 shadow-md">
                    <span className="material-symbols-outlined text-2xl">videocam</span>
                  </div>
                  <p className="text-xs font-bold text-white truncate max-w-full">
                    {teacherName || "Instructor"}
                  </p>
                  <span className="text-[10px] text-indigo-300 font-medium mt-1 flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-rose-500 animate-ping" : "bg-amber-400 animate-pulse"}`} />
                    {isLive ? "Live Teaching" : "Awaiting Class"}
                  </span>
                </div>
              </div>
            </div>
          )}


          {/* Live Chat Panel */}
          <div className="bg-[#10121d] border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl flex-1 min-h-0 flex flex-col">
            <div className="px-4 py-2.5 bg-[#0a0b12] border-b border-slate-800 flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-indigo-400">chat</span>
                Classroom Live Chat
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Real-time</span>
            </div>
            <div className="flex-1 min-h-0 p-2">
              {wbSession?.id ? (
                <MessagesPanel
                  whiteboardSessionId={wbSession.id}
                  currentUserId={currentUserId}
                  role="STUDENT"
                  theme={isThemeDark ? "dark" : "light"}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  Connecting chat...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MOBILE & TABLET VIEW (< lg): Top Video/Canvas Stage + Bottom Tabbed Console */}
      {/* ========================================================================= */}
      <div className="lg:hidden flex-1 min-h-0 flex flex-col overflow-hidden bg-[#0b0d14]">
        {/* Top Media Area: 16:9 Canvas or YouTube Player */}
        <div className="w-full shrink-0 aspect-video max-h-[38dvh] sm:max-h-[45dvh] bg-black relative flex items-center justify-center overflow-hidden border-b border-slate-800/80">
          {isYouTube ? (
            <YouTubeLivePlayer
              youtubeVideoId={wbSession?.youtubeVideoId ?? null}
              title={scheduleTitle}
              subject={batchName}
              livePhase={isLive ? "LIVE" : "PREPARING"}
            />
          ) : (
            <div className={`relative aspect-[16/9] w-full h-full max-w-full max-h-full overflow-hidden ${boardBackground === "dark" ? "bg-[#10131d]" : "bg-white"}`}>
              {isBackgroundImageUrl(boardBackground) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={boardBackground}
                  alt=""
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                />
              )}
              <canvas ref={boardBaseRef} className="absolute inset-0 w-full h-full" />
              <canvas ref={boardActiveRef} className="absolute inset-0 w-full h-full pointer-events-none" />

              {/* Watermark */}
              {boardEmpty && !isBackgroundImageUrl(boardBackground) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center p-4 bg-gradient-to-b from-transparent via-[#10131d]/50 to-[#10131d]/90">
                  <span className="material-symbols-outlined text-xl text-indigo-400">draw</span>
                  <p className="text-xs font-bold text-slate-300">Whiteboard Canvas Connected</p>
                  <p className="text-[10px] text-slate-500">
                    {isLive ? "Notes and drawings sync live from teacher." : "Waiting for teacher to start class."}
                  </p>
                </div>
              )}

              {/* Mobile PiP Teacher Video (Corner Preview) */}
              {!isYouTube && (
                <div className="absolute top-2 right-2 w-28 xs:w-32 aspect-video rounded-lg overflow-hidden border border-indigo-500/60 shadow-xl bg-[#10121d] z-20 flex flex-col items-center justify-center">
                  <span className="material-symbols-outlined text-base text-indigo-400">videocam</span>
                  <span className={`text-[9px] text-indigo-300 mt-1 flex items-center gap-1`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-rose-500 animate-ping" : "bg-amber-400 animate-pulse"}`} />
                    {isLive ? "Live" : "Standby"}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Interactive Area (Tabs: Chat | Quiz | Details) */}
        <div className="flex-1 min-h-0 flex flex-col bg-[#10121d] overflow-hidden">
          {/* Tab Selection Bar */}
          <div className="flex items-center justify-around bg-[#0a0b12] border-b border-slate-800 shrink-0 px-2">
            <button
              type="button"
              onClick={() => setActiveMobileTab("chat")}
              className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
                activeMobileTab === "chat"
                  ? "text-indigo-400 border-indigo-500 bg-indigo-950/20"
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
                  ? "text-indigo-400 border-indigo-500 bg-indigo-950/20"
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
                  ? "text-indigo-400 border-indigo-500 bg-indigo-950/20"
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
                  <div className="bg-slate-900 border border-indigo-500/50 rounded-2xl p-4 shadow-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                        {quiz.questionText || "Live Class Quiz"}
                      </h3>
                      {quiz.status === "ACTIVE" && (
                        <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2.5 py-0.5 rounded-full">
                          {remainingSec}s
                        </span>
                      )}
                    </div>
                    {quizError && <p className="text-xs text-rose-400">{quizError}</p>}
                    <div className="grid grid-cols-1 gap-2">
                      {quiz.options.map((o) => {
                        const selected = mySelection === o.key;
                        const revealed = quiz.status === "REVEALED";
                        const isCorrect = revealed && quiz.correctOption === o.key;
                        return (
                          <button
                            key={o.key}
                            type="button"
                            disabled={Boolean(mySelection) || quiz.status !== "ACTIVE" || submittingAnswer}
                            onClick={() => submitAnswer(o.key)}
                            className={`text-left px-4 py-3 rounded-xl border text-xs font-medium transition ${
                              isCorrect
                                ? "border-emerald-500 bg-emerald-950/60 text-emerald-300 font-bold"
                                : selected
                                ? "border-indigo-500 bg-indigo-950/60 text-white font-bold"
                                : "border-slate-800 hover:bg-slate-800 text-slate-300"
                            } disabled:cursor-default`}
                          >
                            <span className="font-mono font-bold mr-2 text-indigo-400">{o.key}.</span>
                            {o.label}
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
                    <div className="w-full aspect-video rounded-xl overflow-hidden bg-black border border-slate-800 shadow-md">
                      <VideoStrip
                        whiteboardSessionId={wbSession?.id || batchScheduleId}
                        variant="panel"
                        role="STUDENT"
                        teacherName={teacherName}
                      />
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
                      <span className="font-bold text-indigo-300">{teacherName}</span>
                    </div>
                  )}
                  {wbSession?.presentationName && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-400">Material:</span>
                      <span className="font-mono text-[11px] text-indigo-400">{wbSession.presentationName}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
