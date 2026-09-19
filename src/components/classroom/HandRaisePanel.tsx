"use client";

import { useEffect, useState } from "react";
import { getPusherClient } from "@/lib/realtime/pusher-client";
import { classroomChannel, classroomTeacherChannel, CLASSROOM_EVENTS } from "@/lib/realtime/events";
import { getJson, postJson, patchJson, deleteJson } from "./lib";

type HandRaiseEntry = {
  id: string;
  studentId: string;
  studentName: string;
  status: string;
  raisedAt: string;
  imageUrl?: string | null;
};

export function HandRaisePanel({
  classroomSessionId,
  role,
  myStudentId,
}: {
  classroomSessionId: string;
  role: "TEACHER" | "STUDENT";
  myStudentId?: string;
}) {
  const [queue, setQueue] = useState<HandRaiseEntry[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    getJson(`/api/classroom/sessions/${classroomSessionId}/hand-raise`)
      .then((data) => {
        setQueue(data.queue);
        setEnabled(data.handRaiseEnabled);
      })
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    if (role === "TEACHER") refresh();
  }, [classroomSessionId, role]);

  useEffect(() => {
    const client = getPusherClient();
    const channelName = role === "TEACHER" ? classroomTeacherChannel(classroomSessionId) : classroomChannel(classroomSessionId);
    const channel = client.subscribe(channelName);
    const event = role === "TEACHER" ? CLASSROOM_EVENTS.HAND_RAISE_LIST : CLASSROOM_EVENTS.HAND_RAISE_UPDATED;
    const onUpdate = (payload: { queue?: HandRaiseEntry[] }) => {
      if (payload.queue) setQueue(payload.queue);
    };
    channel.bind(event, onUpdate);
    return () => {
      channel.unbind(event, onUpdate);
      client.unsubscribe(channelName);
    };
  }, [classroomSessionId, role]);

  const myEntry = queue.find((h) => h.studentId === myStudentId);

  const raiseHand = async () => {
    try {
      await postJson(`/api/classroom/sessions/${classroomSessionId}/hand-raise`, {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not raise hand");
    }
  };

  const lowerHand = async () => {
    try {
      await deleteJson(`/api/classroom/sessions/${classroomSessionId}/hand-raise`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not lower hand");
    }
  };

  const act = async (handRaiseId: string, action: "APPROVE" | "REJECT" | "RESOLVE") => {
    try {
      await patchJson(`/api/classroom/sessions/${classroomSessionId}/hand-raise/${handRaiseId}`, { action });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update hand raise");
    }
  };

  if (role === "STUDENT") {
    return (
      <div className="p-4 space-y-3">
        {!enabled ? (
          <p className="text-xs text-gray-500 text-center">The teacher has turned off hand raise for this class.</p>
        ) : myEntry ? (
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-300">
              {myEntry.status === "APPROVED" ? "The teacher will address your question." : "Your hand is raised."}
            </p>
            <button
              type="button"
              onClick={lowerHand}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition"
            >
              Lower Hand
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={raiseHand}
            className="w-full px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold transition flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-base">back_hand</span>
            Raise Hand
          </button>
        )}
        {error && <p className="text-xs text-red-400 text-center">{error}</p>}
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      {queue.length === 0 && <p className="text-xs text-gray-500 text-center py-4">No raised hands right now.</p>}
      {queue.map((h) => (
        <div key={h.id} className="flex items-center justify-between gap-2 rounded-xl border border-[#2d2e3b] bg-[#1e1f2b] px-3 py-2">
          <div className="min-w-0">
            <p className="text-sm text-white truncate">{h.studentName}</p>
            <p className="text-[10px] text-gray-500">{h.status}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {h.status === "PENDING" && (
              <>
                <button
                  type="button"
                  onClick={() => act(h.id, "APPROVE")}
                  className="p-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 transition"
                  title="Approve"
                >
                  <span className="material-symbols-outlined text-base">check</span>
                </button>
                <button
                  type="button"
                  onClick={() => act(h.id, "REJECT")}
                  className="p-1.5 rounded-lg bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 transition"
                  title="Reject"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </>
            )}
            {h.status === "APPROVED" && (
              <button
                type="button"
                onClick={() => act(h.id, "RESOLVE")}
                className="px-2 py-1 rounded-lg bg-slate-700 text-white text-[11px] font-semibold hover:bg-slate-600 transition"
              >
                Done
              </button>
            )}
          </div>
        </div>
      ))}
      {error && <p className="text-xs text-red-400 text-center">{error}</p>}
    </div>
  );
}
