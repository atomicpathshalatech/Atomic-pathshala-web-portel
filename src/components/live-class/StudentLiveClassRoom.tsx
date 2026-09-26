"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getPusherClient } from "@/lib/realtime/pusher-client";
import { sessionChannel, WB_EVENTS } from "@/lib/realtime/events";
import { CanvasEngine, type StrokeObject } from "@/lib/canvas/canvas-engine";
import { MessagesPanel } from "@/components/live-class/MessagesPanel";
import { YouTubeLivePlayer } from "@/components/live-class/YouTubeLivePlayer";
import { VideoPollOverlay, type VideoPollData } from "@/components/classroom/VideoPollOverlay";
import { VideoStrip } from "@/components/live-class/VideoStrip";
import { RecordingPlayer } from "@/components/live-class/RecordingPlayer";
import { StudentPostClassFeedback } from "@/components/live-class/StudentPostClassFeedback";
import {
  playPollAlert,
  playPollRevealChime,
  playCallIncomingRingtone,
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
// teacher's Material & Setup camera shape is Circular — see floatCamPos
// in StudentLiveClassRoom.
const FLOAT_CAM_SIZE = 128;

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

export type WhiteboardMirrorHandle = {
  // Laser pointer is local-only in the canvas engine (never persisted/
  // autosaved), so it needs an escape hatch straight to this mirror's own
  // engine instance rather than flowing through boardObjects/setState like
  // every other stroke — see the Pusher LASER_POINTER binding below.
  setRemoteLaserActive: (points: { x: number; y: number }[]) => void;
  pushRemoteLaserStroke: (points: { x: number; y: number }[]) => void;
};

const StudentWhiteboardMirror = forwardRef<WhiteboardMirrorHandle, {
  boardBackground: string;
  boardEmpty: boolean;
  isLive: boolean;
  objects: StrokeObject[];
}>(function StudentWhiteboardMirror({ boardBackground, boardEmpty, isLive, objects }, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const activeRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const [mirrorDim, setMirrorDim] = useState<{ width: number; height: number }>({ width: 960, height: 540 });

  useImperativeHandle(ref, () => ({
    setRemoteLaserActive: (points) => engineRef.current?.setRemoteLaserActive(points),
    pushRemoteLaserStroke: (points) => engineRef.current?.pushRemoteLaserStroke(points),
  }), []);

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
});

/**
 * The one shared "people & engagement" panel — same two tabs (Live Chat,
 * Questions), same content, rendered under the teacher's camera dock on
 * both the desktop sidebar and the mobile bottom section, mirroring the
 * teacher room's own camera-on-top-tabs-below pattern. A live poll shows
 * as an inline card here instead of floating over the whiteboard/canvas —
 * it used to be a separate overlay drawer positioned outside this panel
 * entirely, which is what made it feel disconnected from "the class".
 * Doubt submission (previously a separate modal) is now the Questions
 * tab's own body, so raising a hand never leaves this screen either.
 */
function StudentEngagementPanel({
  wbSessionId,
  currentUserId,
  isThemeDark,
  activeTab,
  setActiveTab,
  quiz,
  quizError,
  mySelection,
  remainingSec,
  submitAnswer,
  submittingAnswer,
  quizDismissed,
  setQuizDismissed,
  handRaised,
  handRaiseBusy,
  participationType,
  onToggleHandRaise,
  onSubmitHandRaise,
  doubtImageInputRef,
  onDoubtImageSelected,
  uploadingDoubtImage,
  doubtImageError,
  pendingDoubtPreviewUrl,
  pendingDoubtNote,
  onNoteChange,
  onConfirmSendDoubt,
  onCancelPendingDoubt,
}: {
  wbSessionId?: string;
  currentUserId: string;
  isThemeDark: boolean;
  activeTab: "chat" | "questions";
  setActiveTab: (t: "chat" | "questions") => void;
  quiz: LiveQuiz | null;
  quizError: string | null;
  mySelection: string | null;
  remainingSec: number;
  submitAnswer: (optionKey: string) => void;
  submittingAnswer: boolean;
  quizDismissed: boolean;
  setQuizDismissed: (v: boolean) => void;
  handRaised: boolean;
  handRaiseBusy: boolean;
  participationType: "CHAT" | "AUDIO" | "VIDEO";
  onToggleHandRaise: () => void;
  onSubmitHandRaise: (type: "CHAT" | "AUDIO" | "VIDEO") => void;
  doubtImageInputRef: React.RefObject<HTMLInputElement>;
  onDoubtImageSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadingDoubtImage: boolean;
  doubtImageError: string | null;
  pendingDoubtPreviewUrl?: string | null;
  pendingDoubtNote?: string;
  onNoteChange?: (note: string) => void;
  onConfirmSendDoubt?: () => void;
  onCancelPendingDoubt?: () => void;
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Live poll — inline card, visible regardless of active tab */}
      {quiz && !quizDismissed && (
        <div className="m-2.5 mb-0 bg-[#13172b] border-2 border-blue-500 rounded-2xl p-3.5 shadow-xl space-y-2.5 shrink-0 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center justify-between pb-1 border-b border-blue-900/60">
            <h3 className="text-xs font-black text-white flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping shrink-0" />
              <span className="truncate">{quiz.questionText || "Live Class Poll"}</span>
            </h3>
            <div className="flex items-center gap-1.5 shrink-0">
              {quiz.status === "ACTIVE" ? (
                <span className="text-[11px] font-mono font-black text-slate-950 bg-amber-400 border border-amber-300 px-2 py-0.5 rounded-full">
                  {remainingSec}s
                </span>
              ) : (
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/50 px-2 py-0.5 rounded-full">
                  {quiz.status === "REVEALED" ? "Revealed" : "Closed"}
                </span>
              )}
              <button
                type="button"
                onClick={() => setQuizDismissed(true)}
                className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-800 transition"
                title="Dismiss"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          </div>
          {quizError && <p className="text-[11px] text-rose-400 font-medium">{quizError}</p>}
          {quiz.status === "REVEALED" && (
            <div
              className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg animate-in fade-in duration-200 flex items-center gap-1.5 ${
                mySelection === quiz.correctOption
                  ? "bg-emerald-500/20 text-emerald-300"
                  : mySelection
                  ? "bg-rose-500/20 text-rose-300"
                  : "bg-blue-500/20 text-blue-300"
              }`}
            >
              {mySelection === quiz.correctOption ? "🎉 Correct!" : mySelection ? "❌ Incorrect." : "Poll ended."} Correct option: {quiz.correctOption}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
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
                  className={`text-left px-2.5 py-2 rounded-lg border-2 text-[11px] font-bold transition active:scale-[0.98] touch-manipulation ${
                    isCorrect
                      ? "border-emerald-400 bg-emerald-600 text-white"
                      : isWrong
                      ? "border-rose-500 bg-rose-950/80 text-rose-200"
                      : selected
                      ? "border-white bg-blue-600 text-white"
                      : "bg-[#1a2038] hover:bg-[#252d4e] border-[#333d6b] text-white"
                  } disabled:cursor-default`}
                >
                  <span className="font-mono font-black mr-1.5">{o.key}.</span>
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab bar — exactly two tabs */}
      <div className="flex border-b border-slate-800 px-2 pt-2 shrink-0 bg-[#0a0b12] gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("chat")}
          className={`flex-1 px-3 py-2 text-xs font-bold rounded-t-lg flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
            activeTab === "chat"
              ? "text-blue-400 border-blue-500 bg-blue-950/20"
              : "text-slate-400 border-transparent hover:text-slate-200"
          }`}
        >
          <span className="material-symbols-outlined text-sm">chat</span>
          Live Chat
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("questions")}
          className={`flex-1 px-3 py-2 text-xs font-bold rounded-t-lg flex items-center justify-center gap-1.5 transition-colors border-b-2 relative ${
            activeTab === "questions"
              ? "text-blue-400 border-blue-500 bg-blue-950/20"
              : "text-slate-400 border-transparent hover:text-slate-200"
          }`}
        >
          <span className="material-symbols-outlined text-sm">help_center</span>
          Questions
          {handRaised && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse absolute top-1.5 right-3" />}
        </button>
      </div>

      {/* Tab body */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {activeTab === "chat" ? (
          <div className="flex-1 min-h-0 p-2 flex flex-col">
            {wbSessionId ? (
              <MessagesPanel
                whiteboardSessionId={wbSessionId}
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
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
            {handRaised ? (
              <div className="bg-amber-950/60 border border-amber-500/50 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  {participationType === "AUDIO"
                    ? "Requested to speak (audio)"
                    : participationType === "VIDEO"
                    ? "Requested to speak (video)"
                    : "Doubt sent to teacher"}
                  — waiting for teacher
                </div>
                <button
                  type="button"
                  disabled={handRaiseBusy}
                  onClick={onToggleHandRaise}
                  className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition disabled:opacity-60"
                >
                  Lower Hand / Cancel
                </button>
              </div>
            ) : pendingDoubtPreviewUrl ? (
              <div className="bg-[#13172b] border border-blue-500/50 rounded-xl p-3 space-y-2.5 animate-in fade-in duration-200 shadow-xl">
                <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-blue-400">image</span>
                    Doubt Photo Preview
                  </span>
                  <button
                    type="button"
                    onClick={onCancelPendingDoubt}
                    className="text-slate-400 hover:text-white text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pendingDoubtPreviewUrl}
                  alt="Doubt Preview"
                  className="w-full max-h-40 object-contain rounded-lg bg-black/60 border border-slate-700/80"
                />
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Add a Question Note (Optional)
                  </label>
                  <textarea
                    value={pendingDoubtNote || ""}
                    onChange={(e) => onNoteChange?.(e.target.value)}
                    placeholder="e.g. Sir please explain step 2, or help me with this question..."
                    className="w-full bg-[#0a0b12] border border-slate-700 rounded-lg p-2 text-xs text-white placeholder-slate-500 resize-none outline-none focus:border-blue-500"
                    rows={2}
                  />
                </div>
                {doubtImageError && <p className="text-[11px] text-rose-400">{doubtImageError}</p>}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onCancelPendingDoubt}
                    className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={uploadingDoubtImage}
                    onClick={onConfirmSendDoubt}
                    className="flex-1 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/30 cursor-pointer disabled:opacity-60"
                  >
                    {uploadingDoubtImage ? (
                      <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-sm">send</span>
                    )}
                    <span>{uploadingDoubtImage ? "Uploading…" : "Send Doubt"}</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-400">Choose how you&apos;d like to ask your doubt:</p>
                <button
                  type="button"
                  onClick={() => onSubmitHandRaise("AUDIO")}
                  disabled={handRaiseBusy}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-700 hover:border-blue-500 bg-slate-800/60 hover:bg-blue-950/30 text-left transition group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-lg">mic</span>
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white">Request to Speak (Audio)</h4>
                    <p className="text-[10px] text-slate-400">Mic enabled once the teacher approves.</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onSubmitHandRaise("VIDEO")}
                  disabled={handRaiseBusy}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-700 hover:border-blue-500 bg-slate-800/60 hover:bg-blue-950/30 text-left transition group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-lg">videocam</span>
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white">Request Video + Audio</h4>
                    <p className="text-[10px] text-slate-400">Join as a live video participant.</p>
                  </div>
                </button>
                <div className="w-full flex items-stretch gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSubmitHandRaise("CHAT")}
                    disabled={handRaiseBusy || uploadingDoubtImage}
                    className="flex-1 flex items-center gap-3 p-3 rounded-xl border border-slate-700 hover:border-slate-500 bg-slate-800/60 hover:bg-slate-800 text-left transition cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-xl bg-slate-700/50 text-slate-300 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-lg">chat</span>
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white">Send Doubt to Teacher</h4>
                      <p className="text-[10px] text-slate-400">Text alert, or attach a photo.</p>
                    </div>
                  </button>
                  <input
                    ref={doubtImageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={onDoubtImageSelected}
                  />
                  <button
                    type="button"
                    onClick={() => doubtImageInputRef.current?.click()}
                    disabled={handRaiseBusy || uploadingDoubtImage}
                    title="Attach a photo of your doubt (notebook/textbook page)"
                    className="w-14 shrink-0 flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-700 hover:border-blue-500 bg-slate-800/60 hover:bg-blue-950/30 transition disabled:opacity-60 cursor-pointer"
                  >
                    {uploadingDoubtImage ? (
                      <span className="material-symbols-outlined text-lg text-blue-400 animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-lg text-blue-400">add_a_photo</span>
                    )}
                    <span className="text-[9px] font-bold text-slate-400">Photo</span>
                  </button>
                </div>
                {doubtImageError && <p className="text-[11px] text-rose-400">{doubtImageError}</p>}
              </>
            )}
          </div>
        )}
      </div>
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
  const [participationType, setParticipationType] = useState<"CHAT" | "AUDIO" | "VIDEO">("AUDIO");
  const [isApprovedSpeaker, setIsApprovedSpeaker] = useState(false);
  const [speakerRequestType, setSpeakerRequestType] = useState<"AUDIO" | "VIDEO" | null>(null);
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
      const timer = setTimeout(() => {
        setQuizDismissed(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [quiz?.status]);

  const videoPollData: VideoPollData | null = useMemo(() => {
    if (!quiz || quizDismissed || quiz.status === "CLOSED") return null;
    return {
      id: quiz.id,
      questionText: quiz.questionText || (quiz.isQuickQuiz ? "Quick Quiz: Select your answer" : "Live Class Poll"),
      options: quiz.options,
      correctOption: quiz.correctOption || undefined,
      timeLimitSec: quiz.timeLimitSec,
      startedAt: quiz.startedAt,
      status: quiz.status === "REVEALED" ? "REVEALED" : "ACTIVE",
      counts: (quiz as any).counts,
      totalVotes: (quiz as any).totalVotes,
      mySelection,
    };
  }, [quiz, quizDismissed, mySelection]);

  // Shared between the desktop sidebar and the mobile bottom panel — same
  // two tabs, same content, in both places (see StudentEngagementPanel).
  const [activeTab, setActiveTab] = useState<"chat" | "questions">("chat");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [mobileLandscapeShowChat, setMobileLandscapeShowChat] = useState(false);
  const [mobileCamCorner, setMobileCamCorner] = useState<"top-left" | "top-right" | "bottom-right" | "bottom-left">("top-right");

  const toggleMobileCamCorner = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMobileCamCorner((prev) => {
      if (prev === "top-right") return "top-left";
      if (prev === "top-left") return "bottom-left";
      if (prev === "bottom-left") return "bottom-right";
      return "top-right";
    });
  };

  // Floating teacher camera position — used only on desktop when the
  // teacher's Material & Setup camera shape is Circular (see isCameraCircle
  // below). <VideoStrip> is mounted exactly once, in a single stable
  // wrapper div that never moves in the React tree; only that wrapper's
  // own CSS switches (docked in the sidebar vs. a fixed-position draggable
  // bubble over the main stage), so the LiveKit connection it holds is
  // never dropped by a camera-shape change arriving mid-class.
  const [floatCamPos, setFloatCamPos] = useState<{ x: number; y: number }>({ x: 16, y: 70 });
  const floatCamDraggingRef = useRef(false);
  const floatCamDragOffsetRef = useRef({ x: 0, y: 0 });
  // The actual PPT/slide stage element (see the div this ref is attached to
  // below) — the floating bubble's position is clamped to stay within it,
  // not the whole viewport, matching the teacher's own floating camera so
  // the student can drag it to different spots but only over the board.
  const stageContainerRef = useRef<HTMLDivElement>(null);

  function clampToStage(x: number, y: number): { x: number; y: number } {
    const rect = stageContainerRef.current?.getBoundingClientRect();
    if (!rect) return { x, y };
    const minX = rect.left + 8;
    const minY = rect.top + 8;
    const maxX = Math.max(minX, rect.right - FLOAT_CAM_SIZE - 8);
    const maxY = Math.max(minY, rect.bottom - FLOAT_CAM_SIZE - 8);
    return { x: Math.min(Math.max(x, minX), maxX), y: Math.min(Math.max(y, minY), maxY) };
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("atomic_student_floating_cam_pos");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          setFloatCamPos(clampToStage(parsed.x, parsed.y));
          return;
        }
      }
    } catch {
      // fallback below
    }
    const rect = stageContainerRef.current?.getBoundingClientRect();
    setFloatCamPos(
      rect
        ? clampToStage(rect.right - FLOAT_CAM_SIZE - 16, rect.top + 16)
        : { x: Math.max(16, window.innerWidth - FLOAT_CAM_SIZE - 16), y: 70 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wbSession?.cameraShape]);

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
    const nx = e.clientX - floatCamDragOffsetRef.current.x;
    const ny = e.clientY - floatCamDragOffsetRef.current.y;
    setFloatCamPos(clampToStage(nx, ny));
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
      try {
        localStorage.setItem("atomic_student_floating_cam_pos", JSON.stringify(pos));
      } catch {
        // ignore
      }
      return pos;
    });
  }


  // The root shell deliberately does NOT track window.visualViewport height
  // anymore. It used to (a live-resized height so the bottom toolbar
  // wouldn't hide behind an opening mobile keyboard), but that resize is
  // exactly what showed up as "the whole screen changes while I'm typing" -
  // the camera dock, tabs and canvas all visibly compressed/jumped the
  // moment the keyboard opened. The chat/doubt inputs live inside their own
  // scrollable tab body (not pinned below unrelated chrome), so a plain
  // stable 100dvh is enough - the keyboard simply covers what it covers,
  // same as any normal scrollable page, with nothing else on screen moving.

  // Exactly one <VideoStrip> must ever be mounted per student
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
  // Reaches whichever StudentWhiteboardMirror is currently mounted (desktop
  // or mobile — never both) so the LASER_POINTER Pusher binding below can
  // feed it directly, bypassing boardObjects/setState the way every other
  // synced stroke goes through, since the laser is never persisted.
  const mirrorRef = useRef<WhiteboardMirrorHandle>(null);
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

  const toggleMobileOrientation = async () => {
    if (typeof document === "undefined") return;
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
        if (screen.orientation && "lock" in screen.orientation) {
          await (screen.orientation as any).lock("landscape").catch(() => {});
        }
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
        if (screen.orientation && "unlock" in screen.orientation) {
          (screen.orientation as any).unlock();
        }
      }
    } catch {
      toggleFullscreen();
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
    let consecutiveFailures = 0;

    async function poll() {
      try {
        const res = await fetch(`/api/whiteboard/sessions/by-schedule/${batchScheduleId}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          consecutiveFailures += 1;
          // A handful of retries absorbs a transient blip (a slow deploy, a
          // dropped request) without flashing an error the student would
          // never actually see resolve itself. Past that, this stops being
          // transient — most commonly a real access-check failure — and
          // silently retrying forever left the student staring at an
          // indefinite "waiting" screen with zero camera/board and zero
          // explanation of why.
          if (consecutiveFailures >= 5 && !cancelled) {
            setError(
              res.status === 403
                ? "You don't have access to this class. If you believe this is a mistake, contact support."
                : "Could not connect to this class. Please refresh the page."
            );
          }
          if (!cancelled) timer = setTimeout(poll, 3000);
          return;
        }
        consecutiveFailures = 0;
        setError(null);
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
        if (wb && (wb.status === "ACTIVE" || wb.livePhase === "LIVE")) {
          setWbSession(wb);
          const hasYouTubeStream = Boolean(wb.youtubeVideoId) && wb.livePhase !== "ENDED" && wb.status !== "ENDED";
          if (wb.livePhase === "LIVE" || json.data.schedule?.status === "LIVE" || hasYouTubeStream) {
            setPhase("live");
            // Keep polling at a slower rate to catch ENDED state
            if (!cancelled) timer = setTimeout(poll, 4000);
            return;
          }
          setPhase("lobby");
        } else if (json.data.schedule?.status === "LIVE") {
          if (wb) setWbSession(wb);
          setPhase("live");
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
    const channelId = wbSession?.id || batchScheduleId;
    if (!channelId) return;
    const client = getPusherClient();
    const channel = client.subscribe(sessionChannel(channelId));
    const secondaryChannel =
      wbSession?.id && wbSession.id !== batchScheduleId
        ? client.subscribe(sessionChannel(batchScheduleId))
        : null;

    const handleSessionEnded = () => {
      setPhase("ended");
      setQuiz(null);
    };

    const handleLivePhaseChanged = (data: any) => {
      const p = data.livePhase || data.phase;
      if (p === "LIVE") {
        setPhase("live");
        setWbSession((prev) =>
          prev
            ? {
                ...prev,
                livePhase: "LIVE",
                videoTransport: data.videoTransport ?? prev.videoTransport,
                youtubeVideoId: data.youtubeVideoId !== undefined ? data.youtubeVideoId : prev.youtubeVideoId,
                actualStartedAt: data.actualStartedAt ?? prev.actualStartedAt,
              }
            : prev
        );
        refreshBoard();
      }
      if (p === "ENDED") setPhase("ended");
    };

    const handleSessionExtended = (data: { newScheduledEnd: string; totalExtendedMinutes: number }) => {
      setWbSession((prev) =>
        prev
          ? {
              ...prev,
              scheduledEnd: data.newScheduledEnd,
              totalExtendedMinutes: data.totalExtendedMinutes,
            }
          : prev
      );
    };

    const handleConfigUpdated = (data: any) => {
      setWbSession((prev) =>
        prev
          ? {
              ...prev,
              presentationUrl: data.presentationUrl ?? prev.presentationUrl,
              presentationName: data.presentationName ?? prev.presentationName,
              presentationType: data.presentationType ?? prev.presentationType,
              classroomTheme: data.classroomTheme ?? prev.classroomTheme,
              cameraShape: data.cameraShape ?? prev.cameraShape,
              videoTransport: data.videoTransport ?? prev.videoTransport,
              youtubeVideoId: data.youtubeVideoId !== undefined ? data.youtubeVideoId : prev.youtubeVideoId,
            }
          : prev
      );
    };

    const handleBoardUpdated = (data?: { pageNumber?: number; objects?: StrokeObject[]; background?: string }) => {
      if (data?.objects && Array.isArray(data.objects)) {
        setBoardObjects(data.objects);
        setBoardEmpty(data.objects.length === 0);
        if (data.background) setBoardBackground(data.background);
      } else {
        refreshBoard();
      }
    };

    channel.bind(WB_EVENTS.SESSION_ENDED, handleSessionEnded);
    channel.bind(WB_EVENTS.LIVE_PHASE_CHANGED, handleLivePhaseChanged);
    channel.bind(WB_EVENTS.SESSION_EXTENDED, handleSessionExtended);
    channel.bind(WB_EVENTS.CONFIG_UPDATED, handleConfigUpdated);
    channel.bind(WB_EVENTS.BOARD_UPDATED, handleBoardUpdated);
    channel.bind(WB_EVENTS.PAGE_CHANGED, () => refreshBoard());

    if (secondaryChannel) {
      secondaryChannel.bind(WB_EVENTS.SESSION_ENDED, handleSessionEnded);
      secondaryChannel.bind(WB_EVENTS.LIVE_PHASE_CHANGED, handleLivePhaseChanged);
      secondaryChannel.bind(WB_EVENTS.SESSION_EXTENDED, handleSessionExtended);
      secondaryChannel.bind(WB_EVENTS.CONFIG_UPDATED, handleConfigUpdated);
      secondaryChannel.bind(WB_EVENTS.BOARD_UPDATED, handleBoardUpdated);
    }

    // Laser pointer — never persisted, so it bypasses boardObjects/setState
    // entirely and goes straight into whichever mirror is mounted (see
    // mirrorRef / WhiteboardMirrorHandle).
    channel.bind(
      WB_EVENTS.LASER_POINTER,
      (data: { points?: { x: number; y: number }[]; phase?: "move" | "end" }) => {
        if (!Array.isArray(data?.points) || data.points.length === 0) return;
        if (data.phase === "end") {
          mirrorRef.current?.pushRemoteLaserStroke(data.points);
        } else {
          mirrorRef.current?.setRemoteLaserActive(data.points);
        }
      }
    );

    channel.bind(WB_EVENTS.QUIZ_LAUNCHED, (data: LiveQuiz) => {
      setQuiz({ ...data, status: "ACTIVE" });
      setMySelection(null);
      setQuizError(null);
      setQuizDismissed(false);
      playPollAlert();
    });

    channel.bind(
      WB_EVENTS.QUIZ_REVEALED,
      (data: { id: string; correctOption: string | null; counts?: Record<string, number>; totalResponses?: number; correctCount?: number }) => {
        setQuiz((prev) => {
          if (prev && prev.id === data.id) {
            playPollRevealChime(mySelection === data.correctOption);
            return {
              ...prev,
              status: "REVEALED",
              correctOption: data.correctOption,
              counts: data.counts,
              totalVotes: data.totalResponses,
            } as any;
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
      (data: { studentUserId: string; requestType: "AUDIO" | "VIDEO"; speakerToken?: string }) => {
        if (data.studentUserId === currentUserId) {
          setIsApprovedSpeaker(true);
          setSpeakerRequestType(data.requestType || "AUDIO");
          if (data.speakerToken) setSpeakerToken(data.speakerToken);
          playCallIncomingRingtone();
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
        if (data.audioConnected || data.videoConnected) {
          playCallIncomingRingtone();
        }
      }
    );

    // Restore teacher-connect state after a refresh
    if (wbSession?.id) {
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

      fetch(`/api/whiteboard/sessions/${wbSession.id}/quiz`)
        .then((r) => r.json())
        .then((j) => {
          if (j.success && j.data?.quiz && j.data.quiz.status !== "CLOSED") {
            setQuiz(j.data.quiz);
            setMySelection(j.data.mySelection ?? null);
          }
        })
        .catch(() => {});
    }

    return () => {
      client.unsubscribe(sessionChannel(channelId));
      if (secondaryChannel) {
        client.unsubscribe(sessionChannel(batchScheduleId));
      }
    };
  }, [wbSession?.id, batchScheduleId, currentUserId]);

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
      // Doubt submission now lives inline in the Questions tab (previously
      // a separate modal) — jump the student there instead of popping a
      // dialog over the class.
      setActiveTab("questions");
      setShowChat(true);
    }
  }

  async function submitHandRaise(type: "CHAT" | "AUDIO" | "VIDEO", imageUrl?: string) {
    if (!wbSession?.id || handRaiseBusy) return;
    setHandRaiseBusy(true);
    setHandRaised(true);
    setParticipationType(type);
    try {
      await postJson(`/api/whiteboard/sessions/${wbSession.id}/hand-raise`, {
        requestType: type,
        ...(imageUrl && { imageUrl }),
      });
    } catch {
      setHandRaised(false);
    } finally {
      setHandRaiseBusy(false);
    }
  }

  // A photographed doubt (notebook/textbook page) attached to the
  // "Chat Queue Only" option — preview and optional note before upload.
  const [uploadingDoubtImage, setUploadingDoubtImage] = useState(false);
  const [doubtImageError, setDoubtImageError] = useState<string | null>(null);
  const [pendingDoubtFile, setPendingDoubtFile] = useState<File | null>(null);
  const [pendingDoubtPreviewUrl, setPendingDoubtPreviewUrl] = useState<string | null>(null);
  const [pendingDoubtNote, setPendingDoubtNote] = useState<string>("");
  const doubtImageInputRef = useRef<HTMLInputElement | null>(null);

  function handleDoubtImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPendingDoubtFile(file);
    setPendingDoubtPreviewUrl(URL.createObjectURL(file));
    setPendingDoubtNote("");
    setDoubtImageError(null);
  }

  function handleCancelPendingDoubt() {
    if (pendingDoubtPreviewUrl) {
      URL.revokeObjectURL(pendingDoubtPreviewUrl);
    }
    setPendingDoubtFile(null);
    setPendingDoubtPreviewUrl(null);
    setPendingDoubtNote("");
    setDoubtImageError(null);
  }

  async function handleConfirmSendDoubt() {
    if (!pendingDoubtFile || !wbSession?.id || uploadingDoubtImage || handRaiseBusy) return;
    setUploadingDoubtImage(true);
    setDoubtImageError(null);
    try {
      const formData = new FormData();
      formData.append("attachment", pendingDoubtFile);
      const res = await fetch(`/api/whiteboard/sessions/${wbSession.id}/hand-raise/attachment`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Could not upload that image.");
      const uploadedUrl = json.data.url as string;
      const finalPayload = pendingDoubtNote.trim()
        ? JSON.stringify({ url: uploadedUrl, note: pendingDoubtNote.trim() })
        : uploadedUrl;
      await submitHandRaise("CHAT", finalPayload);
      handleCancelPendingDoubt();
    } catch (err) {
      setDoubtImageError(err instanceof Error ? err.message : "Could not upload that image.");
    } finally {
      setUploadingDoubtImage(false);
    }
  }

  async function toggleHandRaise() {
    return handleRaiseHandClick();
  }

  async function handleEndCall() {
    if (wbSession?.id) {
      // Two independent connection types can be active here (hand-raise
      // approval vs. a teacher-initiated connect) — clear whichever one
      // actually applies, best-effort. Previously only the hand-raise
      // DELETE happened; ending a teacher-initiated call only cleared
      // local state with no server call at all, so the teacher's own view
      // never learned the call had ended and the student's publish
      // permission was never revoked server-side ("call doesn't end").
      await fetch(`/api/whiteboard/sessions/${wbSession.id}/hand-raise`, { method: "DELETE" }).catch(() => {});
      if (teacherAudioConnected || teacherVideoConnected) {
        // "self" — the server resolves the caller's own connection for a
        // student caller regardless of what's in this URL slot.
        await fetch(`/api/whiteboard/sessions/${wbSession.id}/teacher-connect/self/disconnect`, {
          method: "POST",
        }).catch(() => {});
      }
    }
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

  const isLive =
    phase === "live" ||
    wbSession?.livePhase === "LIVE" ||
    Boolean(wbSession?.actualStartedAt && wbSession?.livePhase !== "ENDED" && wbSession?.status !== "ENDED" && phase !== "ended") ||
    (Boolean(wbSession?.youtubeVideoId) && wbSession?.livePhase !== "ENDED" && wbSession?.status !== "ENDED" && phase !== "ended");
  const secondsUntilStart = scheduledStartMs > 0 ? Math.floor((scheduledStartMs - currentTimeMs) / 1000) : 0;
  const elapsedSeconds = actualStartedAtMs ? Math.max(0, Math.floor((currentTimeMs - actualStartedAtMs) / 1000)) : 0;
  const remainingSeconds = scheduledEndMs > 0 ? Math.floor((scheduledEndMs - currentTimeMs) / 1000) : 0;

  const isThemeDark = wbSession?.classroomTheme !== "LIGHT";
  const isCameraCircle = wbSession?.cameraShape === "CIRCULAR";
  // YouTube mode is active ONLY when an actual YouTube video id exists.
  // If YouTube streaming failed or was unconfigured, we seamlessly fall back
  // to the interactive whiteboard canvas + LiveKit / WebRTC camera room so
  // students are never left with a blank or broken screen.
  const isYouTube =
    (wbSession?.videoTransport === "YOUTUBE" || wbSession?.videoTransport === "BOTH") &&
    Boolean(wbSession?.youtubeVideoId);

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

  // ---------------- ACCESS / CONNECTION ERROR ----------------
  // Set after several consecutive failed by-schedule polls (see the poll
  // effect above) — previously this failure mode retried silently forever
  // with no error ever surfaced, leaving the student on an indefinite blank
  // "waiting" screen with no camera/board and no explanation.
  if (error && phase === "waiting") {
    return (
      <div className="min-h-screen-safe w-full bg-[#0b0d14] flex flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="material-symbols-outlined text-4xl text-rose-400">error</span>
        <p className="text-sm font-semibold text-white max-w-sm">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
        >
          Refresh
        </button>
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
      style={{ height: "100dvh", maxHeight: "100dvh" }}
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

          {/* Mobile Fullscreen Rotate Button */}
          <button
            type="button"
            onClick={toggleMobileOrientation}
            className="lg:hidden flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] sm:text-xs font-semibold border border-slate-700 transition active:scale-95"
            title="Rotate to Landscape Fullscreen"
          >
            <span className="material-symbols-outlined text-sm">screen_rotation</span>
            <span className="text-[10px] uppercase font-bold hidden xs:inline">Rotate</span>
          </button>

          {/* Local Hide/Show Teacher-Video-&-Chat Popup (Student Preference). */}
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
              <button
                type="button"
                onClick={() => {
                  if (!stageContainerRef.current) return;
                  if (document.fullscreenElement) {
                    document.exitFullscreen().catch(() => {});
                  } else {
                    stageContainerRef.current.requestFullscreen().catch(() => {});
                  }
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] sm:text-[11px] font-semibold border border-slate-700 transition cursor-pointer"
                title="Full Screen Presentation Stage"
              >
                <span className="material-symbols-outlined text-xs">fullscreen</span>
                <span className="hidden sm:inline">Stage Fullscreen</span>
              </button>
            </div>
          </div>

          {/* Canvas Center Stage */}
          <div
            ref={stageContainerRef}
            className="flex-1 min-h-0 w-full relative flex items-center justify-center p-2 bg-[#0d0e16] overflow-hidden"
          >
            {isYouTube ? (
              <div className="w-full h-full max-w-full max-h-full aspect-video flex items-center justify-center">
                <YouTubeLivePlayer
                  youtubeVideoId={wbSession?.youtubeVideoId ?? null}
                  title={scheduleTitle}
                  subject={subject || batchName}
                  educatorName={teacherName}
                  scheduledStart={wbSession?.scheduledStart || scheduleTimes?.startTime}
                  livePhase={isLive ? "LIVE" : "PREPARING"}
                >
                  <VideoPollOverlay
                    poll={videoPollData}
                    onVote={submitAnswer}
                    onDismiss={() => setQuizDismissed(true)}
                    voting={submittingAnswer}
                  />
                </YouTubeLivePlayer>
              </div>
            ) : isDesktopViewport ? (
              <StudentWhiteboardMirror
                ref={mirrorRef}
                boardBackground={boardBackground}
                boardEmpty={boardEmpty}
                isLive={isLive}
                objects={boardObjects}
              />
            ) : null}
          </div>
        </div>

        {/* Right Fixed Sidebar (Teacher Video on Top + Live Chat Console on Bottom) */}
        <aside className="w-80 xl:w-88 h-full shrink-0 flex flex-col bg-[#10121d] rounded-2xl border border-slate-800/80 overflow-hidden shadow-2xl">
          {/* Teacher Video — a draggable floating bubble over the main slide
              area (fixed positioning escapes the sidebar visually without
              moving in the DOM), independent of the teacher's own bubble —
              this student's drag position is their own local preference
              (own localStorage key below), never synced to or from the
              teacher's. Movability used to be gated to the Circular camera
              shape only, which meant the (default) Square shape couldn't be
              moved; shape now only controls circle-vs-rounded-square clip.
              The whole thing (not just the mount inside it) is gated on
              there being anything to show, so an empty bubble never floats
              over the video when this student has no active grant. The
              <VideoStrip> mount itself never moves or unmounts while
              visible — only this wrapper's own CSS does — so a camera-shape
              change arriving mid-class never drops the call. */}
          {isDesktopViewport && (!isYouTube || isApprovedSpeaker || teacherAudioConnected || teacherVideoConnected) && (
            <div
              onPointerDown={handleFloatCamPointerDown}
              onPointerMove={handleFloatCamPointerMove}
              onPointerUp={handleFloatCamPointerUp}
              onPointerCancel={handleFloatCamPointerUp}
              style={{ position: "fixed", top: floatCamPos.y, left: floatCamPos.x, width: FLOAT_CAM_SIZE, height: FLOAT_CAM_SIZE, touchAction: "none" }}
              className={`z-40 overflow-hidden border-2 border-blue-500 shadow-2xl bg-black cursor-grab active:cursor-grabbing select-none ${
                isCameraCircle ? "rounded-full" : "rounded-2xl"
              }`}
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
              />
            </div>
          )}

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

          <StudentEngagementPanel
            wbSessionId={wbSession?.id}
            currentUserId={currentUserId}
            isThemeDark={isThemeDark}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            quiz={quiz}
            quizError={quizError}
            mySelection={mySelection}
            remainingSec={remainingSec}
            submitAnswer={submitAnswer}
            submittingAnswer={submittingAnswer}
            quizDismissed={quizDismissed}
            setQuizDismissed={setQuizDismissed}
            handRaised={handRaised}
            handRaiseBusy={handRaiseBusy}
            participationType={participationType}
            onToggleHandRaise={handleRaiseHandClick}
            onSubmitHandRaise={submitHandRaise}
            doubtImageInputRef={doubtImageInputRef}
            onDoubtImageSelected={handleDoubtImageSelected}
            uploadingDoubtImage={uploadingDoubtImage}
            doubtImageError={doubtImageError}
            pendingDoubtPreviewUrl={pendingDoubtPreviewUrl}
            pendingDoubtNote={pendingDoubtNote}
            onNoteChange={setPendingDoubtNote}
            onConfirmSendDoubt={handleConfirmSendDoubt}
            onCancelPendingDoubt={handleCancelPendingDoubt}
          />
        </aside>
      </div>

      {/* ========================================================================= */}
      {/* MOBILE & TABLET VIEW (< lg): Top Video/Canvas Stage + Bottom Tabbed Console */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* MOBILE & TABLET VIEW (< lg): Fullscreen Landscape / Tabbed Portrait View */}
      {/* ========================================================================= */}
      <div className="lg:hidden flex-1 min-h-0 flex flex-col landscape:flex-row overflow-hidden bg-[#0b0d14] relative">
        {/* Mobile Media Area: In portrait takes top 40-45dvh; in LANDSCAPE takes 100% FULL SCREEN */}
        <div className="w-full aspect-video max-h-[40dvh] sm:max-h-[45dvh] landscape:w-full landscape:h-full landscape:max-h-full landscape:aspect-auto shrink-0 bg-black relative flex items-center justify-center overflow-hidden border-b landscape:border-0 border-slate-800/80">
          {/* Quick Fullscreen Rotate overlay button on top right of video in mobile */}
          <button
            type="button"
            onClick={toggleMobileOrientation}
            className="absolute top-2 right-2 z-20 px-2 py-1 rounded-lg bg-black/60 hover:bg-black/80 active:scale-95 text-white/90 hover:text-white border border-white/20 flex items-center gap-1 text-[11px] font-bold shadow-lg backdrop-blur-xs transition cursor-pointer"
            title="Toggle Landscape Fullscreen"
          >
            <span className="material-symbols-outlined text-sm">
              {isFullscreen ? "fullscreen_exit" : "screen_rotation"}
            </span>
            <span className="hidden xs:inline">{isFullscreen ? "Exit" : "Full Screen"}</span>
          </button>

          {isYouTube ? (
            <div className="relative w-full h-full">
              <YouTubeLivePlayer
                youtubeVideoId={wbSession?.youtubeVideoId ?? null}
                title={scheduleTitle}
                subject={subject || batchName}
                educatorName={teacherName}
                scheduledStart={wbSession?.scheduledStart || scheduleTimes?.startTime}
                livePhase={isLive ? "LIVE" : "PREPARING"}
              >
                <VideoPollOverlay
                  poll={videoPollData}
                  onVote={submitAnswer}
                  onDismiss={() => setQuizDismissed(true)}
                  voting={submittingAnswer}
                />
              </YouTubeLivePlayer>

              {/* Teacher's camera is already baked into the YouTube video via
                  OBS, so this stays hidden the rest of the time — it only
                  appears for the on-demand LiveKit audio connection while a
                  hand raise (or teacher-connect) is actively granted. */}
              {(isApprovedSpeaker || teacherAudioConnected || teacherVideoConnected) && (
                <div
                  className={`absolute ${
                    mobileCamCorner === "top-right"
                      ? "top-2 right-2"
                      : mobileCamCorner === "bottom-right"
                      ? "bottom-2 right-2"
                      : mobileCamCorner === "bottom-left"
                      ? "bottom-2 left-2"
                      : "top-2 left-2"
                  } w-28 xs:w-32 aspect-video rounded-lg overflow-hidden border border-emerald-500/60 shadow-xl bg-[#10121d] z-20 transition-all duration-200`}
                >
                  <button
                    type="button"
                    onClick={toggleMobileCamCorner}
                    className="absolute top-1 right-1 z-30 w-5 h-5 rounded bg-black/60 hover:bg-black/80 text-white/90 flex items-center justify-center text-[10px]"
                    title="Reposition camera to next corner"
                  >
                    <span className="material-symbols-outlined text-xs">sync_alt</span>
                  </button>
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
                    compact
                  />
                </div>
              )}
            </div>
          ) : !isDesktopViewport ? (
            <div className="relative aspect-[16/9] w-full h-full max-w-full max-h-full overflow-hidden flex items-center justify-center">
              <StudentWhiteboardMirror
                ref={mirrorRef}
                boardBackground={boardBackground}
                boardEmpty={boardEmpty}
                isLive={isLive}
                objects={boardObjects}
              />
              {/* Mobile PiP Teacher Video (Corner Preview with switchable position) */}
              {!isYouTube && (
                <div
                  className={`absolute ${
                    mobileCamCorner === "top-right"
                      ? "top-2 right-2"
                      : mobileCamCorner === "bottom-right"
                      ? "bottom-2 right-2"
                      : mobileCamCorner === "bottom-left"
                      ? "bottom-2 left-2"
                      : "top-2 left-2"
                  } w-28 xs:w-32 aspect-video rounded-lg overflow-hidden border border-blue-500/60 shadow-xl bg-[#10121d] z-20 transition-all duration-200`}
                >
                  <button
                    type="button"
                    onClick={toggleMobileCamCorner}
                    className="absolute top-1 right-1 z-30 w-5 h-5 rounded bg-black/60 hover:bg-black/80 text-white/90 flex items-center justify-center text-[10px]"
                    title="Reposition camera to next corner"
                  >
                    <span className="material-symbols-outlined text-xs">sync_alt</span>
                  </button>
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
                  />
                </div>
              )}
            </div>
          ) : null}

          {/* Floating pill in Landscape mode to open Chat/Polls without resizing the 100% video */}
          <button
            type="button"
            onClick={() => setMobileLandscapeShowChat(true)}
            className="hidden landscape:flex items-center gap-1.5 absolute bottom-3 right-3 z-30 px-3 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700/80 shadow-2xl backdrop-blur-md text-xs font-bold transition active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm text-blue-400">chat</span>
            <span>Chat & Polls</span>
            {quiz && quiz.status === "ACTIVE" && !quizDismissed && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </button>
        </div>

        {/* In portrait: normal bottom half console. In landscape: floating slide-in drawer when requested */}
        <div
          className={`flex-1 min-h-0 bg-[#10121d] overflow-hidden ${
            mobileLandscapeShowChat
              ? "landscape:absolute landscape:right-0 landscape:top-0 landscape:bottom-0 landscape:w-80 landscape:max-w-[85vw] landscape:z-40 landscape:shadow-2xl landscape:border-l landscape:border-slate-700 flex flex-col"
              : "portrait:flex landscape:hidden"
          }`}
        >
          {/* Header in landscape drawer to allow closing */}
          <div className="hidden landscape:flex items-center justify-between px-3 py-2 bg-[#0a0b12] border-b border-slate-800 shrink-0">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-blue-400">forum</span>
              Live Interaction
            </span>
            <button
              type="button"
              onClick={() => setMobileLandscapeShowChat(false)}
              className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer"
              title="Close chat drawer"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>

          <StudentEngagementPanel
            wbSessionId={wbSession?.id}
            currentUserId={currentUserId}
            isThemeDark={isThemeDark}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            quiz={quiz}
            quizError={quizError}
            mySelection={mySelection}
            remainingSec={remainingSec}
            submitAnswer={submitAnswer}
            submittingAnswer={submittingAnswer}
            quizDismissed={quizDismissed}
            setQuizDismissed={setQuizDismissed}
            handRaised={handRaised}
            handRaiseBusy={handRaiseBusy}
            participationType={participationType}
            onToggleHandRaise={handleRaiseHandClick}
            onSubmitHandRaise={submitHandRaise}
            doubtImageInputRef={doubtImageInputRef}
            onDoubtImageSelected={handleDoubtImageSelected}
            uploadingDoubtImage={uploadingDoubtImage}
            doubtImageError={doubtImageError}
            pendingDoubtPreviewUrl={pendingDoubtPreviewUrl}
            pendingDoubtNote={pendingDoubtNote}
            onNoteChange={setPendingDoubtNote}
            onConfirmSendDoubt={handleConfirmSendDoubt}
            onCancelPendingDoubt={handleCancelPendingDoubt}
          />
        </div>
      </div>
    </div>
  );
}

