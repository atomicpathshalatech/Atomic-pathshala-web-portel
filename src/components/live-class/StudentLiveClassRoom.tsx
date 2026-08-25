"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getPusherClient } from "@/lib/realtime/pusher-client";
import { sessionChannel, WB_EVENTS } from "@/lib/realtime/events";
import { CanvasEngine, type StrokeObject } from "@/lib/canvas/canvas-engine";
import { VideoStrip } from "@/components/live-class/VideoStrip";
import { MessagesPanel } from "@/components/live-class/MessagesPanel";

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

// WhiteboardPage.background is "blank" (default)/"light"/"dark" for the
// theme, or an uploaded storage URL — anything that looks like a URL is
// treated as an image. Mirrors the same helper in TeacherLiveClassRoom.tsx.
function isBackgroundImageUrl(background: string | undefined): background is string {
  return typeof background === "string" && /^https?:\/\//.test(background);
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
  const [wbSessionId, setWbSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [handRaised, setHandRaised] = useState(false);
  const [handRaiseBusy, setHandRaiseBusy] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const [quiz, setQuiz] = useState<LiveQuiz | null>(null);
  const [mySelection, setMySelection] = useState<string | null>(null);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [remainingSec, setRemainingSec] = useState(0);
  const [quizError, setQuizError] = useState<string | null>(null);

  // ---- Board mirror (read-only) ----
  const boardBaseRef = useRef<HTMLCanvasElement>(null);
  const boardActiveRef = useRef<HTMLCanvasElement>(null);
  const boardEngineRef = useRef<CanvasEngine | null>(null);
  const [boardEmpty, setBoardEmpty] = useState(true);
  const [boardBackground, setBoardBackground] = useState<string>("blank");

  // ---- Poll for the session to start ----------------------------------------
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
        const wb = json.data.whiteboardSession;
        if (cancelled) return;
        if (wb && wb.status === "ACTIVE") {
          setWbSessionId(wb.id);
          if (wb.livePhase === "LIVE") {
            setPhase("live");
            return; // stop polling once live
          }
          // Session exists but the teacher hasn't clicked Start Class yet —
          // the pre-class lobby: chat is already live, board/video aren't.
          // Keep polling (fall through below) as the fallback path in case
          // the LIVE_PHASE_CHANGED push (bound once wbSessionId is set) is
          // missed.
          setPhase("lobby");
        }
        if (wb && wb.status === "ENDED") {
          setPhase("ended");
          return;
        }
      } catch {
        if (!cancelled) setError("Could not reach the server. Retrying…");
      }
      if (!cancelled) timer = setTimeout(poll, 5000);
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [batchScheduleId]);

  // ---- Announce arrival once a session exists (lobby or live) --------------
  // Fires the "X has joined the class" system message + attendance row (see
  // .../join/route.ts) the moment we know a session id — no need to wait
  // for "live", since the whole point of the lobby is that chat + who's-here
  // work before the teacher starts class. The route itself is idempotent
  // (only the first-ever call for this student announces), so re-running
  // this on every wbSessionId change (e.g. resuming after a refresh) is safe.
  useEffect(() => {
    if (!wbSessionId) return;
    postJson(`/api/whiteboard/sessions/${wbSessionId}/join`).catch(() => {
      // best-effort — a failed join ping just means no announcement went
      // out; nothing in the student's own experience depends on it.
    });
  }, [wbSessionId]);

  // ---- Board mirror: fetch the teacher's current active page and redraw ----
  async function refreshBoard() {
    if (!wbSessionId || !boardEngineRef.current) return;
    try {
      const res = await fetch(`/api/whiteboard/sessions/${wbSessionId}/board`);
      const json = await res.json();
      if (!res.ok || !json.success) return;
      const objects: StrokeObject[] = json.data.page?.objects ?? [];
      boardEngineRef.current.loadObjects(objects);
      setBoardEmpty(objects.length === 0);
      setBoardBackground(json.data.page?.background ?? "blank");
    } catch {
      // best-effort — the next BOARD_UPDATED/PAGE_CHANGED push (or a manual
      // page refresh) will resync; the board isn't authoritative state, so
      // a missed frame here isn't harmful the way a missed quiz event would be
    }
  }

  // ---- Once live: mount the read-only board-mirror canvas ------------------
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
  }, [phase, wbSessionId]);

  // ---- Once live: subscribe to the session channel (counts as presence) ----
  useEffect(() => {
    if (!wbSessionId) return;
    const client = getPusherClient();
    const channel = client.subscribe(sessionChannel(wbSessionId));

    channel.bind(WB_EVENTS.SESSION_ENDED, () => {
      setPhase("ended");
      setQuiz(null);
    });

    // Fast path out of the lobby — see the poll loop above for the fallback
    // if this push is ever missed.
    channel.bind(WB_EVENTS.LIVE_PHASE_CHANGED, (data: { livePhase: string }) => {
      if (data.livePhase === "LIVE") setPhase("live");
    });

    channel.bind(WB_EVENTS.BOARD_UPDATED, () => {
      refreshBoard();
    });
    channel.bind(WB_EVENTS.PAGE_CHANGED, () => {
      refreshBoard();
    });

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

    // Catch a quiz already in progress if joining mid-class.
    fetch(`/api/whiteboard/sessions/${wbSessionId}/quiz`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.data.quiz && j.data.quiz.status !== "CLOSED") {
          setQuiz(j.data.quiz);
          if (j.data.hasResponded) setMySelection("__submitted__");
        }
      })
      .catch(() => {});

    return () => {
      client.unsubscribe(sessionChannel(wbSessionId));
    };
  }, [wbSessionId]);

  // ---- Quiz countdown (display only — the server enforces the real deadline) ----
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
    if (!wbSessionId || handRaiseBusy) return;
    setHandRaiseBusy(true);
    try {
      if (handRaised) {
        await fetch(`/api/whiteboard/sessions/${wbSessionId}/hand-raise`, { method: "DELETE" });
        setHandRaised(false);
      } else {
        await postJson(`/api/whiteboard/sessions/${wbSessionId}/hand-raise`);
        setHandRaised(true);
      }
    } catch {
      // best-effort — button stays clickable to retry
    } finally {
      setHandRaiseBusy(false);
    }
  }

  async function submitAnswer(optionKey: string) {
    if (!wbSessionId || !quiz || submittingAnswer || mySelection) return;
    setSubmittingAnswer(true);
    setQuizError(null);
    try {
      await postJson(`/api/whiteboard/sessions/${wbSessionId}/quiz/${quiz.id}/respond`, {
        selectedOption: optionKey,
      });
      setMySelection(optionKey);
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : "Could not submit your answer.");
    } finally {
      setSubmittingAnswer(false);
    }
  }

  // ------------------------------------------------------------------------

  if (phase === "waiting") {
    return (
      <div className="space-y-stack-lg max-w-3xl mx-auto">
        <header>
          <p className="text-label-sm text-on-surface-variant mb-1">{batchName}</p>
          <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface">
            {scheduleTitle}
          </h1>
        </header>
        <div className="glass-card rounded-2xl p-10 text-center space-y-3">
          <span className="material-symbols-outlined text-4xl text-primary animate-pulse">cast</span>
          <p className="font-headline-md text-headline-md text-on-surface">
            Waiting for {teacherName ?? "your teacher"} to start the class
          </p>
          <p className="text-body-md text-on-surface-variant">
            This page will switch over automatically the moment the live board opens.
          </p>
          {error && <p className="text-label-sm text-error">{error}</p>}
          <Link href="/schedule" className="inline-block text-primary text-label-md hover:underline mt-2">
            ← Back to schedule
          </Link>
        </div>
      </div>
    );
  }

  if (phase === "lobby") {
    return (
      <div className="space-y-stack-lg max-w-3xl mx-auto">
        <header>
          <p className="text-label-sm text-on-surface-variant mb-1">{batchName}</p>
          <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface">
            {scheduleTitle}
          </h1>
        </header>
        <div className="glass-card rounded-2xl p-8 text-center space-y-2">
          <span className="material-symbols-outlined text-4xl text-primary animate-pulse">meeting_room</span>
          <p className="font-headline-md text-headline-md text-on-surface">
            You&apos;re in — {teacherName ?? "your teacher"} hasn&apos;t started the class yet
          </p>
          <p className="text-body-md text-on-surface-variant">
            Chat with your classmates while you wait. The board and video will appear the moment
            class starts — this page switches over automatically.
          </p>
          {error && <p className="text-label-sm text-error">{error}</p>}
        </div>
        {wbSessionId && (
          <div className="glass-card rounded-2xl p-3 h-96 flex flex-col">
            <MessagesPanel whiteboardSessionId={wbSessionId} currentUserId={currentUserId} role="STUDENT" />
          </div>
        )}
        <Link href="/schedule" className="inline-block text-primary text-label-md hover:underline">
          ← Back to schedule
        </Link>
      </div>
    );
  }

  if (phase === "ended") {
    return (
      <div className="space-y-stack-lg max-w-3xl mx-auto">
        <div className="glass-card rounded-2xl p-10 text-center space-y-3">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant">event_busy</span>
          <p className="font-headline-md text-headline-md text-on-surface">This class has ended</p>
          <Link href="/schedule" className="inline-block text-primary text-label-md hover:underline mt-2">
            ← Back to schedule
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-stack-lg max-w-3xl mx-auto">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-label-sm text-on-surface-variant mb-1">{batchName}</p>
          <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface">
            {scheduleTitle}
          </h1>
        </div>
        {wbSessionId && <VideoStrip whiteboardSessionId={wbSessionId} />}
      </header>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-outline-variant/20 text-label-sm text-on-surface-variant">
          <span className="material-symbols-outlined text-lg text-primary">cast</span>
          Live board — mirrors what your teacher is drawing right now
        </div>
        <div className={`relative aspect-[4/3] ${boardBackground === "dark" ? "bg-[#1a1f2e]" : "bg-white"}`}>
          {isBackgroundImageUrl(boardBackground) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={boardBackground}
              alt=""
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />
          )}
          <canvas ref={boardBaseRef} className="absolute inset-0 w-full h-full" />
          <canvas ref={boardActiveRef} className="absolute inset-0 w-full h-full pointer-events-none" />
          {boardEmpty && (
            <div className="absolute inset-0 flex items-center justify-center text-label-sm text-on-surface-variant pointer-events-none">
              Nothing on the board yet
            </div>
          )}
        </div>
      </div>

      {quiz ? (
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-headline-md text-headline-md text-on-surface">
              {quiz.questionText || "Quick Quiz"}
            </h2>
            {quiz.status === "ACTIVE" && (
              <span className="text-label-md font-label-md text-primary">{remainingSec}s</span>
            )}
          </div>
          {quizError && <p className="text-label-sm text-error">{quizError}</p>}
          <div className="space-y-2">
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
                  className={`w-full text-left px-4 py-3 rounded-xl border text-label-md transition-colors ${
                    isCorrect
                      ? "border-secondary bg-secondary/10 text-secondary"
                      : selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-outline-variant hover:bg-surface-container-high text-on-surface"
                  } disabled:cursor-default`}
                >
                  <span className="font-bold mr-2">{o.key}.</span>
                  {o.label}
                </button>
              );
            })}
          </div>
          {mySelection && quiz.status === "ACTIVE" && (
            <p className="text-label-sm text-on-surface-variant">
              Answer submitted — waiting for your teacher to reveal the result.
            </p>
          )}
          {quiz.status === "REVEALED" && (
            <p className="text-label-sm text-secondary font-label-sm">Answer revealed above.</p>
          )}
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-8 text-center text-on-surface-variant font-body-md">
          No quiz running right now.
        </div>
      )}

      <button
        type="button"
        disabled={handRaiseBusy}
        onClick={toggleHandRaise}
        className={`fixed bottom-8 right-8 shadow-lg rounded-full w-16 h-16 flex items-center justify-center transition-colors disabled:opacity-60 bg-primary text-on-primary ${
          handRaised ? "ring-4 ring-primary/40" : ""
        }`}
        title={handRaised ? "Lower hand" : "Raise hand"}
      >
        <span className="material-symbols-outlined text-2xl">back_hand</span>
      </button>

      {wbSessionId && chatOpen && (
        <div className="fixed bottom-28 left-8 w-80 h-96 glass-card rounded-2xl shadow-lg flex flex-col p-3 z-10">
          <div className="flex items-center justify-between mb-1">
            <span className="text-label-md font-label-md text-on-surface">Class Chat</span>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="text-on-surface-variant hover:text-on-surface p-1"
              title="Close chat"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
          <MessagesPanel whiteboardSessionId={wbSessionId} currentUserId={currentUserId} role="STUDENT" />
        </div>
      )}

      {wbSessionId && (
        <button
          type="button"
          onClick={() => setChatOpen((v) => !v)}
          className="fixed bottom-8 left-8 shadow-lg rounded-full w-16 h-16 flex items-center justify-center transition-colors bg-surface-container-high text-on-surface border border-outline-variant/30"
          title={chatOpen ? "Close chat" : "Open chat"}
        >
          <span className="material-symbols-outlined text-2xl">chat</span>
        </button>
      )}
    </div>
  );
}
