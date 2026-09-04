"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getPusherClient } from "@/lib/realtime/pusher-client";
import { sessionChannel, WB_EVENTS } from "@/lib/realtime/events";
import { CanvasEngine, type StrokeObject } from "@/lib/canvas/canvas-engine";
import { VideoStrip } from "@/components/live-class/VideoStrip";
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

  // Poll for the session state until live/ended
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const res = await fetch(`/api/whiteboard/sessions/by-schedule/${batchScheduleId}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          if (!cancelled) setError(json.error ?? "Could not check class status.");
          return;
        }
        if (json.data.schedule) {
          setScheduleTimes({
            startTime: json.data.schedule.startTime,
            endTime: json.data.schedule.endTime,
          });
        }
        const wb = json.data.whiteboardSession;
        if (cancelled) return;
        if (wb && wb.status === "ACTIVE") {
          setWbSession(wb);
          if (wb.livePhase === "LIVE") {
            setPhase("live");
            return; // stop polling once live
          }
          setPhase("lobby");
        }
        if (wb && wb.status === "ENDED") {
          setWbSession(wb);
          setPhase("ended");
          return;
        }
      } catch {
        if (!cancelled) setError("Could not reach the server. Retrying…");
      }
      if (!cancelled) timer = setTimeout(poll, 4000);
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
      boardEngineRef.current.loadObjects(objects);
      setBoardEmpty(objects.length === 0);
      setBoardBackground(json.data.page?.background ?? "blank");
    } catch {
      // best effort
    }
  }

  // Once live: mount read-only board-mirror canvas
  useEffect(() => {
    if (phase !== "live" || !boardBaseRef.current || !boardActiveRef.current) return;
    const engine = new CanvasEngine(boardBaseRef.current, boardActiveRef.current, undefined, undefined, {
      readOnly: true,
    });
    boardEngineRef.current = engine;
    engine.syncSize();
    refreshBoard();

    const onResize = () => engine.syncSize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      engine.destroy();
      boardEngineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const secondsUntilStart = scheduledStartMs > 0 ? Math.floor((scheduledStartMs - currentTimeMs) / 1000) : 0;
  const elapsedSeconds = actualStartedAtMs ? Math.max(0, Math.floor((currentTimeMs - actualStartedAtMs) / 1000)) : 0;
  const remainingSeconds = scheduledEndMs > 0 ? Math.floor((scheduledEndMs - currentTimeMs) / 1000) : 0;

  const isThemeDark = wbSession?.classroomTheme === "DARK";
  const isCameraCircle = wbSession?.cameraShape === "CIRCULAR";

  // ---------------- WAITING / LOBBY ROOM ----------------
  if (phase === "waiting" || phase === "lobby") {
    return (
      <div className="space-y-6 max-w-4xl mx-auto p-4 animate-in fade-in duration-200">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{batchName}</p>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {scheduleTitle}
            </h1>
          </div>
          <span className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-full animate-pulse shrink-0">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Waiting Room Open
          </span>
        </header>

        {/* Live Classroom Waiting Stage */}
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white rounded-3xl p-8 sm:p-12 text-center shadow-xl relative overflow-hidden border border-slate-800">
          <div className="relative z-10 max-w-lg mx-auto space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/10">
              <span className="material-symbols-outlined text-3xl animate-pulse">live_tv</span>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-indigo-400">
                Live Classroom Waiting Room
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                Waiting for {teacherName ?? "Teacher"} to Start Class
              </h2>
            </div>

            {/* Countdown Display */}
            {secondsUntilStart > 0 && (
              <div className="inline-block bg-indigo-900/50 border border-indigo-500/30 rounded-2xl px-6 py-3 my-2">
                <p className="text-[11px] font-medium text-indigo-300 uppercase tracking-wider">Class starts in</p>
                <p className="text-2xl sm:text-3xl font-mono font-black text-white tracking-widest">
                  {formatHms(secondsUntilStart)}
                </p>
              </div>
            )}

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              You are connected in the live waiting lobby. You can chat with your teacher and classmates below. The whiteboard and video feed will start automatically the moment the teacher clicks <span className="font-bold text-emerald-400">&quot;Start Class&quot;</span>.
            </p>

            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 text-xs font-bold text-slate-200 backdrop-blur-sm border border-white/10">
              <span className="material-symbols-outlined text-base text-emerald-400">groups</span>
              <span>Instant Auto-Connect Active</span>
            </div>

            {error && <p className="text-xs text-rose-400 font-bold bg-rose-950/50 p-2.5 rounded-xl">{error}</p>}
          </div>
        </div>

        {/* Realtime Live Chat During Waiting Room */}
        {wbSession?.id && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm h-96 flex flex-col">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-indigo-500">chat</span>
                Class Live Chat &amp; Arrivals
              </h3>
              <span className="text-[10px] text-slate-400 font-medium">Real-time messaging active</span>
            </div>
            <div className="flex-1 min-h-0">
              <MessagesPanel whiteboardSessionId={wbSession.id} currentUserId={currentUserId} role="STUDENT" />
            </div>
          </div>
        )}

        <div className="text-center pt-2">
          <Link href="/schedule" className="text-xs font-bold text-indigo-600 hover:text-indigo-500 hover:underline">
            &larr; Back to Schedule
          </Link>
        </div>
      </div>
    );
  }

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

  // ---------------- LIVE CLASSROOM (MATCHED 2-COLUMN LAYOUT) ----------------
  const isYouTube = wbSession?.videoTransport === "YOUTUBE";

  return (
    <div className={`min-h-[calc(100vh-4rem)] p-4 ${isThemeDark ? "bg-[#0c0e14] text-white" : "bg-slate-50 text-slate-900"}`}>
      {/* Top Authoritative Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-700/40">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{batchName}</p>
          <h1 className="text-lg sm:text-xl font-bold truncate max-w-lg">{scheduleTitle}</h1>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs font-bold text-red-400 border border-red-500/40 bg-red-950/40 px-3 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            LIVE
          </span>

          <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700 text-slate-200">
            Elapsed: {formatHms(elapsedSeconds)}
          </span>

          {remainingSeconds > 0 && (
            <span
              className={`text-xs font-mono font-semibold px-2.5 py-1 rounded-md border ${
                remainingSeconds <= 300
                  ? "text-amber-300 bg-amber-950/60 border-amber-500/50 animate-pulse"
                  : "text-slate-300 bg-slate-800/80 border-slate-700"
              }`}
            >
              {remainingSeconds <= 300 ? "5m Left" : `Rem: ${formatHms(remainingSeconds)}`}
            </span>
          )}

          <button
            type="button"
            disabled={handRaiseBusy}
            onClick={toggleHandRaise}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              handRaised
                ? "bg-amber-500 text-slate-950 ring-2 ring-amber-400/50"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
            }`}
          >
            <span className="material-symbols-outlined text-sm">back_hand</span>
            {handRaised ? "Hand Raised" : "Raise Hand"}
          </button>
        </div>
      </header>

      {/* Main Studio Grid: Left Main Presentation + Right Upper-Right Camera & Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Main Canvas / Video Area (75% / 9 cols) */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-4">
          {isYouTube ? (
            <YouTubeLivePlayer
              youtubeVideoId={wbSession?.youtubeVideoId ?? null}
              title={scheduleTitle}
              subject={batchName}
              livePhase="LIVE"
            />
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-950/80 border-b border-slate-800 text-xs text-slate-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="material-symbols-outlined text-sm text-indigo-400">cast</span>
                  Live Teacher Presentation &amp; Whiteboard
                </span>
                {wbSession?.presentationName && (
                  <span className="text-[11px] font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
                    {wbSession.presentationName}
                  </span>
                )}
              </div>

              {/* Canvas Frame Preserving 16:9 Aspect Ratio */}
              <div className={`relative aspect-[16/9] w-full ${boardBackground === "dark" ? "bg-[#10131b]" : "bg-white"}`}>
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
                {boardEmpty && !boardBackground && (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500 pointer-events-none">
                    Presentation canvas active &middot; Waiting for teacher ink
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Active Quiz Card */}
          {quiz && (
            <div className="bg-slate-900 border border-indigo-500/50 rounded-2xl p-5 shadow-2xl space-y-3 animate-in fade-in">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                          ? "border-emerald-500 bg-emerald-950/60 text-emerald-300"
                          : selected
                          ? "border-indigo-500 bg-indigo-950/60 text-white"
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
          )}
        </div>

        {/* Right Rail (25% / 3-4 cols): Upper-Right Camera + Chat Below */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4">
          {/* Upper-Right Teacher Camera Feed */}
          {wbSession?.id && !isYouTube && (
            <div
              className={`bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl ${
                isCameraCircle ? "p-3 flex items-center justify-center aspect-square" : ""
              }`}
            >
              <div
                className={`w-full overflow-hidden ${
                  isCameraCircle
                    ? "aspect-square rounded-full border-2 border-indigo-500 shadow-lg shadow-indigo-500/20"
                    : "aspect-video rounded-xl"
                }`}
              >
                <VideoStrip whiteboardSessionId={wbSession.id} variant="panel" />
              </div>
            </div>
          )}

          {/* Live Chat Panel Directly Below Camera */}
          {wbSession?.id && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl h-[460px] flex flex-col">
              <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-indigo-400">chat</span>
                  Classroom Live Chat
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Real-time</span>
              </div>
              <div className="flex-1 min-h-0 p-2">
                <MessagesPanel
                  whiteboardSessionId={wbSession.id}
                  currentUserId={currentUserId}
                  role="STUDENT"
                  theme={isThemeDark ? "dark" : "light"}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
