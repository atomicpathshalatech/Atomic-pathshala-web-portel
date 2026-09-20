"use client";

import { useEffect, useRef, useState } from "react";
import { getPusherClient } from "@/lib/realtime/pusher-client";
import { classroomChannel, CLASSROOM_EVENTS } from "@/lib/realtime/events";
import { ClassroomLayout } from "./ClassroomLayout";
import { ClassroomYouTubePlayer } from "./ClassroomYouTubePlayer";
import { ChatPanel } from "./ChatPanel";
import { DoubtPanel } from "./DoubtPanel";
import { HandRaisePanel } from "./HandRaisePanel";
import { StudentCountBadge } from "./StudentCountBadge";
import { VideoPollOverlay, type VideoPollData } from "./VideoPollOverlay";
import { getJson, postJson } from "./lib";

const POLL_MS = 10_000;
const HEARTBEAT_MS = 20_000;

type ByScheduleData = {
  classroomSession: {
    id: string;
    title: string;
    phase: string;
    youtubeVideoId: string | null;
    recordingVideoId: string | null;
    recordingStatus: string | null;
    chatEnabled: boolean;
    handRaiseEnabled: boolean;
  } | null;
  schedule: { id: string; title: string; startsAt: string; endsAt: string; type: string; status: string };
  access: { canStudentJoin: boolean; isCancelled: boolean };
  serverTime: string;
};

export function StudentClassroomRoom({
  batchScheduleId,
  currentUserId,
  studentId,
  teacherName,
  chapterName,
}: {
  batchScheduleId: string;
  currentUserId: string;
  studentId: string;
  teacherName: string;
  chapterName: string;
}) {
  const [data, setData] = useState<ByScheduleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [poll, setPoll] = useState<VideoPollData | null>(null);
  const [voting, setVoting] = useState(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = () => {
    getJson(`/api/classroom/sessions/by-schedule/${batchScheduleId}`)
      .then(setData)
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchScheduleId]);

  const classroomSessionId = data?.classroomSession?.id;

  // Poll fetch on session discovery
  useEffect(() => {
    if (!classroomSessionId) return;
    getJson(`/api/classroom/sessions/${classroomSessionId}/poll`)
      .then((res) => {
        if (res?.poll) {
          setPoll(res.poll);
        }
      })
      .catch(() => {});
  }, [classroomSessionId]);

  useEffect(() => {
    if (!classroomSessionId) return;
    const client = getPusherClient();
    const channel = client.subscribe(classroomChannel(classroomSessionId));
    const onPhaseChanged = () => refresh();
    channel.bind(CLASSROOM_EVENTS.PHASE_CHANGED, onPhaseChanged);

    const onPollLaunched = (newPoll: VideoPollData) => {
      setPoll(newPoll);
    };

    const onPollRevealed = (revealed: VideoPollData) => {
      setPoll((prev) => (prev ? { ...prev, ...revealed, status: "REVEALED" } : revealed));
    };

    const onPollEnded = () => {
      setPoll(null);
    };

    channel.bind(CLASSROOM_EVENTS.POLL_LAUNCHED, onPollLaunched);
    channel.bind(CLASSROOM_EVENTS.POLL_REVEALED, onPollRevealed);
    channel.bind(CLASSROOM_EVENTS.POLL_ENDED, onPollEnded);

    return () => {
      channel.unbind(CLASSROOM_EVENTS.PHASE_CHANGED, onPhaseChanged);
      channel.unbind(CLASSROOM_EVENTS.POLL_LAUNCHED, onPollLaunched);
      channel.unbind(CLASSROOM_EVENTS.POLL_REVEALED, onPollRevealed);
      channel.unbind(CLASSROOM_EVENTS.POLL_ENDED, onPollEnded);
      client.unsubscribe(classroomChannel(classroomSessionId));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classroomSessionId]);

  const handleVote = async (optionKey: string) => {
    if (!classroomSessionId || !poll || voting) return;
    setVoting(true);
    try {
      setPoll((prev) => (prev ? { ...prev, mySelection: optionKey } : null));
      await postJson(`/api/classroom/sessions/${classroomSessionId}/poll/vote`, {
        pollId: poll.id,
        selectedOption: optionKey,
      });
    } catch {
      // keep local selection
    } finally {
      setVoting(false);
    }
  };

  useEffect(() => {
    if (!classroomSessionId || data?.classroomSession?.phase !== "LIVE") {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      return;
    }
    const beat = () => postJson(`/api/classroom/sessions/${classroomSessionId}/heartbeat`).catch(() => {});
    beat();
    heartbeatRef.current = setInterval(beat, HEARTBEAT_MS);
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [classroomSessionId, data?.classroomSession?.phase]);

  if (error) {
    return <ErrorState message="Live class is currently unavailable. Please try again shortly." />;
  }
  if (!data) {
    return <LoadingState />;
  }
  if (data.access.isCancelled) {
    return <ErrorState message="This class was not started and has been cancelled." />;
  }

  const phase = data.classroomSession?.phase ?? "SCHEDULED";

  if (!data.access.canStudentJoin || phase === "SCHEDULED") {
    return <WaitingState startsAt={data.schedule.startsAt} teacherName={teacherName} chapterName={chapterName} status="Class starts at" />;
  }

  if (phase === "PREPARING") {
    return <WaitingState startsAt={data.schedule.startsAt} teacherName={teacherName} chapterName={chapterName} status="Waiting for teacher to start..." />;
  }

  if (phase === "PROCESSING_RECORDING" || (phase === "ENDED" && data.classroomSession?.recordingStatus !== "READY")) {
    return <ErrorState message="Live class has ended. Recording is being processed. It will be available shortly." icon="hourglass_top" />;
  }

  if ((phase === "RECORDED" || phase === "ENDED") && data.classroomSession?.recordingVideoId) {
    return <RecordedState recordingVideoId={data.classroomSession.recordingVideoId} title={data.classroomSession.title} />;
  }

  if (phase === "CANCELLED" || phase === "FAILED") {
    return <ErrorState message="Live class is currently unavailable. Please try again shortly." />;
  }

  if (phase === "LIVE" && data.classroomSession?.youtubeVideoId && classroomSessionId) {
    return (
      <ClassroomLayout
        video={
          <ClassroomYouTubePlayer youtubeVideoId={data.classroomSession.youtubeVideoId} title={data.classroomSession.title}>
            <VideoPollOverlay
              poll={poll}
              onVote={handleVote}
              onDismiss={() => setPoll(null)}
              voting={voting}
            />
          </ClassroomYouTubePlayer>
        }
        extraHeader={
          <div className="flex items-center justify-between px-1">
            <p className="text-sm font-semibold text-white truncate">{data.classroomSession.title}</p>
            <StudentCountBadge classroomSessionId={classroomSessionId} />
          </div>
        }
        panels={{
          chat: <ChatPanel classroomSessionId={classroomSessionId} currentUserId={currentUserId} role="STUDENT" />,
          doubt: <DoubtPanel classroomSessionId={classroomSessionId} />,
          "hand-raise": <HandRaisePanel classroomSessionId={classroomSessionId} role="STUDENT" myStudentId={studentId} />,
          students: (
            <div className="p-4 text-center text-gray-400 text-sm flex flex-col items-center gap-2">
              <StudentCountBadge classroomSessionId={classroomSessionId} />
              <p>students currently in class</p>
            </div>
          ),
        }}
      />
    );
  }

  return <LoadingState />;
}

function WaitingState({
  startsAt,
  teacherName,
  chapterName,
  status,
}: {
  startsAt: string;
  teacherName: string;
  chapterName: string;
  status: string;
}) {
  const time = new Date(startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center gap-3 bg-[#0a0b12] text-center p-8">
      <span className="material-symbols-outlined text-4xl text-blue-400 animate-pulse">schedule</span>
      <p className="text-xs uppercase tracking-wider text-gray-500 font-bold">Class Starts At</p>
      <p className="text-3xl font-black text-white">{time}</p>
      <div className="text-sm text-gray-400 space-y-0.5">
        <p>
          Teacher: <span className="text-white font-semibold">{teacherName}</span>
        </p>
        <p>
          Chapter: <span className="text-white font-semibold">{chapterName}</span>
        </p>
      </div>
      <p className="text-sm text-blue-400 font-semibold mt-2">{status}</p>
    </div>
  );
}

function ErrorState({ message, icon = "error" }: { message: string; icon?: string }) {
  return (
    <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center gap-3 bg-[#0a0b12] text-center p-8">
      <span className="material-symbols-outlined text-4xl text-rose-400">{icon}</span>
      <p className="text-sm text-gray-300 max-w-sm">{message}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-[#0a0b12]">
      <span className="material-symbols-outlined text-3xl text-gray-500 animate-spin">progress_activity</span>
    </div>
  );
}

function RecordedState({ recordingVideoId, title }: { recordingVideoId: string; title: string }) {
  const embedUrl = `https://www.youtube-nocookie.com/embed/${recordingVideoId}?rel=0&modestbranding=1`;
  return (
    <div className="w-full h-full min-h-[400px] bg-[#0a0b12] p-4 space-y-3">
      <p className="text-sm font-semibold text-white">{title} — Recording</p>
      <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden">
        <iframe src={embedUrl} title={title} allowFullScreen className="w-full h-full border-0" />
      </div>
    </div>
  );
}
