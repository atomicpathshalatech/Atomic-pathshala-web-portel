"use client";

import { useEffect, useState } from "react";
import { CameraPublisher, type PublisherState } from "./CameraPublisher";
import { ClassroomLayout } from "./ClassroomLayout";
import { ChatPanel } from "./ChatPanel";
import { HandRaisePanel } from "./HandRaisePanel";
import { StudentCountBadge } from "./StudentCountBadge";
import { TeacherPollModal } from "./TeacherPollModal";
import { getJson, postJson } from "./lib";

type ClassroomSessionState = {
  id: string;
  // Not returned by the .../start route's response (only by the fuller
  // session-detail GET) — the room always renders the `title` prop instead
  // of this field, so it's optional rather than backfilled with a placeholder.
  title?: string;
  phase: string;
  streamMethod: "BROWSER_RELAY" | "EXTERNAL_ENCODER" | null;
  relayWhipUrl: string | null;
  youtubeIngestUrl: string | null;
  youtubeStreamKey: string | null;
  youtubeVideoId: string | null;
};

export function TeacherClassroomRoom({
  scheduleId,
  currentUserId,
  title,
}: {
  scheduleId: string;
  currentUserId: string;
  title: string;
}) {
  const [session, setSession] = useState<ClassroomSessionState | null>(null);
  const [streamMethod, setStreamMethod] = useState<"BROWSER_RELAY" | "EXTERNAL_ENCODER">("BROWSER_RELAY");
  const [starting, setStarting] = useState(false);
  const [goingLive, setGoingLive] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publisherState, setPublisherState] = useState<PublisherState>("idle");
  const [pollModalOpen, setPollModalOpen] = useState(false);

  // If a ClassroomSession already exists for this schedule (e.g. page reload mid-class), pick it up.
  useEffect(() => {
    getJson(`/api/classroom/sessions/by-schedule/${scheduleId}`)
      .then((data) => {
        if (data.classroomSession) {
          // GET by-schedule intentionally omits teacher-only secrets; the
          // teacher room re-fetches those via the session-detail route once
          // it knows the session id.
          getJson(`/api/classroom/sessions/${data.classroomSession.id}`)
            .then((full) => setSession(full.classroomSession))
            .catch(() => setSession(data.classroomSession));
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleId]);

  const start = async (methodOverride?: "BROWSER_RELAY" | "EXTERNAL_ENCODER") => {
    setStarting(true);
    setError(null);
    try {
      const data = await postJson(`/api/team/classroom/${scheduleId}/start`, {
        streamMethod: methodOverride ?? streamMethod,
      });
      setSession((prev) => ({ ...(prev ?? ({} as ClassroomSessionState)), ...data.classroomSession }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start classroom");
    } finally {
      setStarting(false);
    }
  };

  const goLive = async () => {
    setGoingLive(true);
    setError(null);
    try {
      const data = await postJson(`/api/team/classroom/${scheduleId}/go-live`);
      setSession((prev) => (prev ? { ...prev, ...data.classroomSession } : data.classroomSession));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "YouTube did not confirm the stream is live yet — make sure your camera/OBS is actually publishing."
      );
    } finally {
      setGoingLive(false);
    }
  };

  const end = async () => {
    setEnding(true);
    setError(null);
    try {
      const data = await postJson(`/api/team/classroom/${scheduleId}/end`);
      setSession((prev) => (prev ? { ...prev, ...data.classroomSession } : data.classroomSession));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not end classroom");
    } finally {
      setEnding(false);
    }
  };

  if (!session || session.phase === "SCHEDULED") {
    return (
      <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center gap-4 bg-[#0a0b12] p-8">
        <p className="text-sm text-gray-400">Choose how your camera will reach YouTube for this class.</p>
        <div className="flex gap-3">
          {(["BROWSER_RELAY", "EXTERNAL_ENCODER"] as const).map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => setStreamMethod(method)}
              className={`px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                streamMethod === method
                  ? "border-blue-500 bg-blue-600/20 text-blue-300"
                  : "border-[#2d2e3b] text-gray-400 hover:text-white"
              }`}
            >
              {method === "BROWSER_RELAY" ? "Use my camera (in-browser)" : "Use OBS / a streaming app"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => start()}
          disabled={starting}
          className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold disabled:opacity-40 transition"
        >
          {starting ? "Setting up..." : "Configure Classroom"}
        </button>
        {error && <p className="text-xs text-rose-400">{error}</p>}
      </div>
    );
  }

  if (session.phase === "PREPARING") {
    // A previous .../start call can leave the ClassroomSession row created
    // (phase already PREPARING) but without a completed YouTube broadcast/
    // relay path if it failed partway through (e.g. a YouTube API error) —
    // there would otherwise be no way back to a "Configure Classroom" button
    // to retry, since the phase alone already routes here.
    const configIncomplete =
      (session.streamMethod === "BROWSER_RELAY" && !session.relayWhipUrl) ||
      (session.streamMethod === "EXTERNAL_ENCODER" && !session.youtubeIngestUrl);

    if (configIncomplete) {
      return (
        <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center gap-4 bg-[#0a0b12] p-8 text-center">
          <span className="material-symbols-outlined text-3xl text-amber-400">warning</span>
          <p className="text-sm text-gray-300 max-w-sm">
            The YouTube broadcast couldn't be fully set up last time (often a temporary API/permission issue). Nothing has
            gone live — it's safe to retry.
          </p>
          <button
            type="button"
            onClick={() => start(session.streamMethod ?? undefined)}
            disabled={starting}
            className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold disabled:opacity-40 transition"
          >
            {starting ? "Retrying..." : "Retry Configuration"}
          </button>
          {error && <p className="text-xs text-rose-400">{error}</p>}
        </div>
      );
    }

    return (
      <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center gap-4 bg-[#0a0b12] p-8">
        {session.streamMethod === "BROWSER_RELAY" && session.relayWhipUrl ? (
          <div className="w-full max-w-lg space-y-3">
            <CameraPublisher whipUrl={session.relayWhipUrl} onStateChange={setPublisherState} />
            <button
              type="button"
              onClick={goLive}
              disabled={goingLive || publisherState !== "live"}
              className="w-full px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold disabled:opacity-40 transition"
            >
              {goingLive ? "Going live..." : "Go Live"}
            </button>
            {publisherState !== "live" && (
              <p className="text-xs text-gray-500 text-center">Start your camera above — "Go Live" unlocks once it connects.</p>
            )}
          </div>
        ) : (
          <div className="w-full max-w-lg space-y-3 text-center">
            <p className="text-sm text-gray-400">Paste these into OBS Studio (or your phone streaming app), then start streaming there.</p>
            <div className="text-left space-y-2 bg-[#0d0e16] border border-[#2d2e3b] rounded-xl p-4">
              <div>
                <p className="text-[10px] uppercase text-gray-500 font-bold">Server URL</p>
                <p className="text-sm text-white font-mono break-all">{session.youtubeIngestUrl}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-gray-500 font-bold">Stream Key</p>
                <p className="text-sm text-white font-mono break-all">{session.youtubeStreamKey}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={goLive}
              disabled={goingLive}
              className="w-full px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold disabled:opacity-40 transition"
            >
              {goingLive ? "Confirming..." : "I'm Live in OBS — Go Live"}
            </button>
          </div>
        )}
        {error && <p className="text-xs text-rose-400">{error}</p>}
      </div>
    );
  }

  if (session.phase === "LIVE") {
    return (
      <>
        <ClassroomLayout
        video={
          session.streamMethod === "BROWSER_RELAY" && session.relayWhipUrl ? (
            <CameraPublisher whipUrl={session.relayWhipUrl} onStateChange={setPublisherState} />
          ) : (
            <div className="w-full aspect-video bg-[#0d0e16] rounded-2xl border border-slate-800 flex items-center justify-center text-gray-400 text-sm">
              Streaming from your external encoder — watch the class as your students see it on YouTube.
            </div>
          )
        }
        extraHeader={
          <div className="flex items-center justify-between px-1">
            <p className="text-sm font-semibold text-white truncate">{title}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPollModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer"
                title="Push Interactive Poll directly over students' video screen"
              >
                <span className="material-symbols-outlined text-sm">poll</span>
                <span>Launch Poll</span>
              </button>
              <StudentCountBadge classroomSessionId={session.id} />
              <button
                type="button"
                onClick={end}
                disabled={ending}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold disabled:opacity-40 transition"
              >
                {ending ? "Ending..." : "End Classroom"}
              </button>
            </div>
          </div>
        }
        panels={{
          chat: <ChatPanel classroomSessionId={session.id} currentUserId={currentUserId} role="TEACHER" />,
          doubt: (
            <div className="p-4 text-center text-gray-400 text-sm">
              Student doubts from this class appear in your regular Doubt Desk.
            </div>
          ),
          "hand-raise": <HandRaisePanel classroomSessionId={session.id} role="TEACHER" />,
          students: (
            <div className="p-4 text-center text-gray-400 text-sm flex flex-col items-center gap-2">
              <StudentCountBadge classroomSessionId={session.id} />
              <p>students currently in class</p>
            </div>
          ),
        }}
      />
      <TeacherPollModal
        classroomSessionId={session.id}
        isOpen={pollModalOpen}
        onClose={() => setPollModalOpen(false)}
      />
      </>
    );
  }

  return (
    <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center gap-2 bg-[#0a0b12] p-8 text-center">
      <span className="material-symbols-outlined text-4xl text-emerald-400">check_circle</span>
      <p className="text-sm text-gray-300">
        {session.phase === "PROCESSING_RECORDING" ? "Class ended — recording is processing." : "Class completed."}
      </p>
    </div>
  );
}
