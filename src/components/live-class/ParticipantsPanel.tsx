"use client";

import { useEffect, useState, useMemo } from "react";
import { getPusherClient } from "@/lib/realtime/pusher-client";
import { sessionChannel, WB_EVENTS } from "@/lib/realtime/events";

export type Participant = {
  id: string;
  userId: string;
  name: string;
  photoUrl: string | null;
  email: string | null;
  hasJoined: boolean;
  joinedAt: string | null;
  lastSeenAt: string | null;
  activeDurationSec: number;
  reconnectCount: number;
  interactionCount: number;
  isRecentlyActive: boolean;
};

export type TeacherInfo = {
  id: string;
  userId: string;
  name: string;
  photoUrl: string | null;
};

type MediaConnectionState = { audioConnected: boolean; videoConnected: boolean };

async function getJson(url: string) {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error ?? "Request failed");
  return json.data;
}

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error ?? "Request failed");
  return json.data;
}

function formatDuration(totalSec: number) {
  const abs = Math.abs(totalSec);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function ParticipantsPanel({
  whiteboardSessionId,
  theme = "dark",
}: {
  whiteboardSessionId: string;
  theme?: "light" | "dark";
}) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [teacher, setTeacher] = useState<TeacherInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [connections, setConnections] = useState<Record<string, MediaConnectionState>>({});
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const data = await getJson(`/api/whiteboard/sessions/${whiteboardSessionId}/participants`);
      setParticipants(data.participants || []);
      setTeacher(data.teacher || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load participants roster");
    } finally {
      setLoading(false);
    }
  };

  const loadConnections = async () => {
    try {
      const data = await getJson(`/api/whiteboard/sessions/${whiteboardSessionId}/teacher-connect`);
      const next: Record<string, MediaConnectionState> = {};
      for (const c of data.connections || []) {
        next[c.studentId] = { audioConnected: c.audioConnected, videoConnected: c.videoConnected };
      }
      setConnections(next);
    } catch {
      // Non-fatal — the roster still renders, buttons just start from "not connected"
      // until the next Pusher event.
    }
  };

  useEffect(() => {
    loadData();
    loadConnections();
    const interval = setInterval(loadData, 30_000);
    return () => clearInterval(interval);
  }, [whiteboardSessionId]);

  const connectStudent = async (studentId: string, mediaType: "AUDIO" | "VIDEO") => {
    setPendingAction(`${studentId}:${mediaType}`);
    try {
      const data = await postJson(`/api/whiteboard/sessions/${whiteboardSessionId}/teacher-connect`, {
        studentId,
        mediaType,
      });
      setConnections((prev) => ({
        ...prev,
        [studentId]: {
          audioConnected: data.connection.audioConnected,
          videoConnected: data.connection.videoConnected,
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect student");
    } finally {
      setPendingAction(null);
    }
  };

  const disconnectStudent = async (studentId: string) => {
    setPendingAction(`${studentId}:DISCONNECT`);
    try {
      await postJson(`/api/whiteboard/sessions/${whiteboardSessionId}/teacher-connect/${studentId}/disconnect`);
      setConnections((prev) => ({ ...prev, [studentId]: { audioConnected: false, videoConnected: false } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect student");
    } finally {
      setPendingAction(null);
    }
  };

  useEffect(() => {
    const client = getPusherClient();
    const channel = client.subscribe(sessionChannel(whiteboardSessionId));

    const syncMembers = (members: any) => {
      const ids = new Set<string>();
      if (members?.each) {
        members.each((m: any) => {
          if (m?.id) {
            // member.id is 'STUDENT:entityId' or 'TEACHER:entityId'
            const parts = m.id.split(":");
            ids.add(parts.length > 1 ? parts[1] : m.id);
          }
        });
      }
      setOnlineUserIds(ids);
    };

    const onTeacherConnectUpdated = (payload: any) => {
      if (!payload?.studentId) return;
      setConnections((prev) => ({
        ...prev,
        [payload.studentId]: {
          audioConnected: !!payload.audioConnected,
          videoConnected: !!payload.videoConnected,
        },
      }));
    };
    channel.bind(WB_EVENTS.TEACHER_CONNECT_UPDATED, onTeacherConnectUpdated);

    channel.bind("pusher:subscription_succeeded", syncMembers);
    channel.bind("pusher:member_added", (member: any) => {
      if (member?.id) {
        const parts = member.id.split(":");
        const id = parts.length > 1 ? parts[1] : member.id;
        setOnlineUserIds((prev) => new Set([...prev, id]));
      }
    });
    channel.bind("pusher:member_removed", (member: any) => {
      if (member?.id) {
        const parts = member.id.split(":");
        const id = parts.length > 1 ? parts[1] : member.id;
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    });

    return () => {
      channel.unbind("pusher:subscription_succeeded", syncMembers);
      channel.unbind(WB_EVENTS.TEACHER_CONNECT_UPDATED, onTeacherConnectUpdated);
    };
  }, [whiteboardSessionId]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return participants;
    const q = searchQuery.toLowerCase();
    return participants.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.email && p.email.toLowerCase().includes(q))
    );
  }, [participants, searchQuery]);

  const onlineCount = useMemo(() => {
    return participants.filter((p) => onlineUserIds.has(p.id) || p.isRecentlyActive).length;
  }, [participants, onlineUserIds]);

  const isDark = theme === "dark";

  return (
    <div className="flex flex-col h-full">
      {/* Search and Summary */}
      <div className="space-y-2 mb-3 shrink-0">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className={isDark ? "text-slate-300" : "text-slate-700"}>
            Enrolled Students ({participants.length})
          </span>
          <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-full text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {onlineCount} Online
          </span>
        </div>

        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter students..."
            className={`w-full text-xs rounded-lg px-2.5 py-1.5 pl-8 outline-none border transition-colors ${
              isDark
                ? "bg-[#10131b] border-[#2d2e3b] text-white placeholder:text-gray-500 focus:border-blue-500"
                : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-500"
            }`}
          />
          <span className="material-symbols-outlined absolute left-2 top-1.5 text-[16px] text-gray-400 pointer-events-none">
            search
          </span>
        </div>
      </div>

      {/* Roster List */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0">
        {teacher && (
          <div
            className={`flex items-center gap-2.5 p-2 rounded-xl border ${
              isDark
                ? "bg-orange-950/20 border-orange-900/40 text-slate-200"
                : "bg-orange-50 border-orange-200 text-slate-800"
            }`}
          >
            {teacher.photoUrl ? (
              <img
                src={teacher.photoUrl}
                alt={teacher.name}
                className="w-8 h-8 rounded-full object-cover border border-orange-300/40 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#a33900] text-white flex items-center justify-center font-bold text-xs shrink-0">
                {teacher.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold truncate text-[#ea580c]">{teacher.name}</span>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-950/70 text-[#a33900] dark:text-orange-300 border border-orange-200 dark:border-orange-800/60 uppercase">
                  Educator
                </span>
              </div>
              <p className="text-[10px] text-slate-400">Host • Live</p>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-xs text-center py-6 text-gray-400">Loading roster…</p>
        ) : error ? (
          <p className="text-xs text-center py-6 text-red-400">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-center py-6 text-gray-400">
            {searchQuery ? "No matching students found." : "No enrolled students."}
          </p>
        ) : (
          filtered.map((p) => {
            const isOnline = onlineUserIds.has(p.id) || p.isRecentlyActive;
            const initial = p.name.charAt(0).toUpperCase();

            return (
              <div
                key={p.id}
                className={`flex items-center gap-2.5 p-2 rounded-xl border transition-colors ${
                  isDark
                    ? "bg-[#141622] border-[#2d2e3b] hover:border-slate-700"
                    : "bg-slate-50 border-slate-200 hover:border-slate-300"
                }`}
              >
                {/* Avatar with live status dot */}
                <div className="relative shrink-0">
                  {p.photoUrl ? (
                    <img
                      src={p.photoUrl}
                      alt={p.name}
                      className="w-8 h-8 rounded-full object-cover border border-slate-700"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs">
                      {initial}
                    </div>
                  )}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 ${
                      isDark ? "border-[#141622]" : "border-slate-50"
                    } ${isOnline ? "bg-emerald-500" : p.hasJoined ? "bg-amber-500" : "bg-slate-400"}`}
                  />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-xs font-semibold truncate ${
                        isDark ? "text-slate-200" : "text-slate-800"
                      }`}
                    >
                      {p.name}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        isOnline
                          ? "bg-emerald-950/70 text-emerald-300 border border-emerald-800/60"
                          : p.hasJoined
                          ? "bg-amber-950/70 text-amber-300 border border-amber-800/60"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {isOnline ? "ONLINE" : p.hasJoined ? "ATTENDED" : "ABSENT"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                    {p.hasJoined ? (
                      <span>Time in class: {formatDuration(p.activeDurationSec)}</span>
                    ) : (
                      <span>Has not entered room yet</span>
                    )}
                    {p.reconnectCount > 0 && (
                      <span className="text-amber-400/80">({p.reconnectCount} reconnects)</span>
                    )}
                  </div>

                  {p.hasJoined && (
                    <MediaConnectRow
                      studentId={p.id}
                      state={connections[p.id] ?? { audioConnected: false, videoConnected: false }}
                      pendingAction={pendingAction}
                      onConnect={(mediaType) => connectStudent(p.id, mediaType)}
                      onDisconnect={() => disconnectStudent(p.id)}
                      isDark={isDark}
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * Teacher-initiated connect/disconnect buttons for one roster row. Kept as
 * its own component so each row's pending-request state doesn't re-render
 * (or block) the rest of the roster while a request is in flight — the
 * spec's double-click concern (§22) is handled by disabling per-action, not
 * the whole panel.
 */
function MediaConnectRow({
  studentId,
  state,
  pendingAction,
  onConnect,
  onDisconnect,
  isDark,
}: {
  studentId: string;
  state: MediaConnectionState;
  pendingAction: string | null;
  onConnect: (mediaType: "AUDIO" | "VIDEO") => void;
  onDisconnect: () => void;
  isDark: boolean;
}) {
  const audioPending = pendingAction === `${studentId}:AUDIO`;
  const videoPending = pendingAction === `${studentId}:VIDEO`;
  const disconnectPending = pendingAction === `${studentId}:DISCONNECT`;
  const anyPending = audioPending || videoPending || disconnectPending;
  const isConnected = state.audioConnected || state.videoConnected;

  const baseBtn = `flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border transition-colors disabled:opacity-50 disabled:cursor-not-allowed`;

  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <button
        type="button"
        disabled={anyPending}
        onClick={() => onConnect("AUDIO")}
        className={`${baseBtn} ${
          state.audioConnected
            ? "bg-emerald-950/70 text-emerald-300 border-emerald-800/60"
            : isDark
            ? "bg-[#1a1d29] text-slate-300 border-[#2d2e3b] hover:border-blue-600"
            : "bg-white text-slate-600 border-slate-200 hover:border-blue-400"
        }`}
        title={state.audioConnected ? "Audio connected" : "Connect audio"}
      >
        <span className="material-symbols-outlined text-[12px]">mic</span>
        {audioPending ? "…" : state.audioConnected ? "Audio On" : "Connect Audio"}
      </button>

      <button
        type="button"
        disabled={anyPending}
        onClick={() => onConnect("VIDEO")}
        className={`${baseBtn} ${
          state.videoConnected
            ? "bg-emerald-950/70 text-emerald-300 border-emerald-800/60"
            : isDark
            ? "bg-[#1a1d29] text-slate-300 border-[#2d2e3b] hover:border-blue-600"
            : "bg-white text-slate-600 border-slate-200 hover:border-blue-400"
        }`}
        title={state.videoConnected ? "Video connected" : "Connect video"}
      >
        <span className="material-symbols-outlined text-[12px]">videocam</span>
        {videoPending ? "…" : state.videoConnected ? "Video On" : "Connect Video"}
      </button>

      {isConnected && (
        <button
          type="button"
          disabled={anyPending}
          onClick={onDisconnect}
          className={`${baseBtn} bg-red-950/70 text-red-300 border-red-800/60 hover:bg-red-900/60`}
          title="Disconnect audio/video"
        >
          <span className="material-symbols-outlined text-[12px]">call_end</span>
          {disconnectPending ? "…" : "Disconnect"}
        </button>
      )}
    </div>
  );
}
