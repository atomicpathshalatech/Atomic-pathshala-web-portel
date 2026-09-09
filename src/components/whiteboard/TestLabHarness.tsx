"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getPusherClient } from "@/lib/realtime/pusher-client";
import { sessionChannel } from "@/lib/realtime/events";
import { TeacherLiveClassRoomClient } from "@/components/live-class/TeacherLiveClassRoomClient";
import { StudentLiveClassRoomClient } from "@/components/live-class/StudentLiveClassRoomClient";

type View = "teacher" | "student" | "split";
type StudentDevice = "desktop" | "mobile";
type LogRow = {
  t: string;
  event: string;
  summary: string;
  /** Whether a student was subscribed to the session channel when this fired. */
  delivered: boolean;
};

const EVENT_LABEL: Record<string, string> = {
  "board-updated": "Whiteboard stroke / board update",
  "page-changed": "Page changed",
  "message-sent": "Chat message",
  "quiz-launched": "Poll / quiz started",
  "quiz-metrics": "Poll response count updated",
  "quiz-revealed": "Poll / quiz revealed",
  "quiz-closed": "Poll / quiz closed",
  "hand-raise-updated": "Hand raise",
  "hand-raise-list": "Hand-raise queue updated",
  "speaker-approved": "Student speaker approved",
  "speaker-revoked": "Student speaker revoked",
  "live-phase-changed": "Class phase changed",
  "session-extended": "Session extended",
  "session-ended": "Session ended",
  "config-updated": "Classroom settings changed",
};

function summarise(data: unknown): string {
  if (data == null) return "";
  if (typeof data !== "object") return String(data);
  const keys = Object.keys(data as Record<string, unknown>).slice(0, 4);
  return keys.map((k) => `${k}: ${JSON.stringify((data as Record<string, unknown>)[k])}`).join(", ").slice(0, 140);
}

export function TestLabHarness({
  batchScheduleId,
  whiteboardSessionId,
  currentUserId,
  endsAtIso,
}: {
  batchScheduleId: string;
  whiteboardSessionId: string;
  currentUserId: string;
  endsAtIso: string;
}) {
  const [view, setView] = useState<View>("teacher");
  const [studentDevice, setStudentDevice] = useState<StudentDevice>("desktop");
  const [log, setLog] = useState<LogRow[]>([]);
  const [online, setOnline] = useState(true);
  const [realtime, setRealtime] = useState<"connecting" | "connected" | "unavailable">("connecting");
  const [apiOk, setApiOk] = useState<"checking" | "ok" | "fail">("checking");
  const [studentPresent, setStudentPresent] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  // Read the latest presence inside the event handler without re-binding it.
  const studentPresentRef = useRef(false);
  useEffect(() => {
    studentPresentRef.current = studentPresent;
  }, [studentPresent]);

  const pushLog = useCallback((event: string, summary: string) => {
    setLog((prev) =>
      [
        { t: new Date().toLocaleTimeString(), event, summary, delivered: studentPresentRef.current },
        ...prev,
      ].slice(0, 200)
    );
  }, []);

  // ---- Event monitor: tap the SAME Pusher channel the rooms use ----------
  useEffect(() => {
    const client = getPusherClient();
    const chName = sessionChannel(whiteboardSessionId);
    const channel = client.subscribe(chName);

    const onAny = (event: string, data: unknown) => {
      if (event.startsWith("pusher:") || event.startsWith("pusher_internal:")) {
        if (event === "pusher:subscription_succeeded") {
          const count = (channel as unknown as { members?: { count: number } }).members?.count ?? 1;
          setStudentPresent(count > 1);
        }
        return;
      }
      pushLog(event, summarise(data));
    };
    (channel as unknown as { bind_global: (cb: typeof onAny) => void }).bind_global(onAny);

    const onMemberAdded = () => setStudentPresent(true);
    const onMemberRemoved = () => {
      const count = (channel as unknown as { members?: { count: number } }).members?.count ?? 1;
      setStudentPresent(count > 1);
    };
    channel.bind("pusher:member_added", onMemberAdded);
    channel.bind("pusher:member_removed", onMemberRemoved);

    const conn = client.connection;
    const syncConn = () =>
      setRealtime(conn.state === "connected" ? "connected" : conn.state === "unavailable" || conn.state === "failed" ? "unavailable" : "connecting");
    conn.bind("state_change", syncConn);
    syncConn();

    return () => {
      (channel as unknown as { unbind_global: (cb: typeof onAny) => void }).unbind_global(onAny);
      channel.unbind("pusher:member_added", onMemberAdded);
      channel.unbind("pusher:member_removed", onMemberRemoved);
      conn.unbind("state_change", syncConn);
    };
  }, [whiteboardSessionId, pushLog]);

  // ---- Real diagnostics -------------------------------------------------
  useEffect(() => {
    const setOn = () => setOnline(navigator.onLine);
    setOn();
    window.addEventListener("online", setOn);
    window.addEventListener("offline", setOn);
    return () => {
      window.removeEventListener("online", setOn);
      window.removeEventListener("offline", setOn);
    };
  }, []);

  const checkApi = useCallback(async () => {
    setApiOk("checking");
    try {
      const res = await fetch(`/api/whiteboard/sessions/${whiteboardSessionId}`, { cache: "no-store" });
      setApiOk(res.ok ? "ok" : "fail");
    } catch {
      setApiOk("fail");
    }
  }, [whiteboardSessionId]);
  useEffect(() => {
    checkApi();
  }, [checkApi]);

  async function reset() {
    if (!window.confirm("Reset test classroom? This clears the test whiteboard pages, chat, polls and hand-raises. Real class data is not touched.")) return;
    setResetting(true);
    try {
      const res = await fetch("/api/team/whiteboard/test/reset", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Reset failed.");
      setLog([]);
      toast.success("Test classroom reset");
      setTimeout(() => window.location.reload(), 400);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed.");
    } finally {
      setResetting(false);
    }
  }

  /**
   * §26 — drop and re-open the realtime socket, then confirm the board comes
   * back. Uses the real Pusher client both rooms share, so this exercises
   * their actual reconnect/re-fetch paths, not a fake.
   */
  function simulateReconnect() {
    if (reconnecting) return;
    setReconnecting(true);
    const client = getPusherClient();
    pushLog("test-reconnect", "socket disconnect requested");
    try {
      client.disconnect();
    } catch {
      /* noop */
    }
    window.setTimeout(() => {
      try {
        client.connect();
        pushLog("test-reconnect", "socket reconnecting…");
      } catch {
        /* noop */
      }
      window.setTimeout(() => {
        setReconnecting(false);
        pushLog("test-reconnect", `state: ${getPusherClient().connection.state}`);
      }, 2500);
    }, 1200);
  }

  const Dot = ({ ok }: { ok: boolean | "warn" }) => (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${
        ok === true ? "bg-emerald-500" : ok === "warn" ? "bg-amber-500" : "bg-red-500"
      }`}
    />
  );

  const teacherRoom = (
    <TeacherLiveClassRoomClient
      batchScheduleId={batchScheduleId}
      scheduleTitle="Whiteboard Test Lab"
      batchName="Whiteboard Test Lab"
      currentUserId={currentUserId}
      endsAt={endsAtIso}
    />
  );
  const studentRoomInner = (
    <StudentLiveClassRoomClient
      batchScheduleId={batchScheduleId}
      scheduleTitle="Whiteboard Test Lab"
      batchName="Whiteboard Test Lab"
      teacherName={null}
      currentUserId={currentUserId}
    />
  );
  // §33 — constrain the student pane to a phone width so the responsive
  // student classroom layout can be eyeballed without a real device.
  const studentRoom =
    studentDevice === "mobile" ? (
      <div className="h-full w-full overflow-auto bg-slate-800 flex justify-center py-3">
        <div className="w-[390px] shrink-0 h-full rounded-2xl overflow-hidden border border-white/15 shadow-2xl bg-slate-950">
          {studentRoomInner}
        </div>
      </div>
    ) : (
      studentRoomInner
    );

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-950 text-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-white/10 bg-slate-900">
        <span className="font-black tracking-tight text-sm">
          Whiteboard Test Lab
          <span className="ml-2 text-[10px] font-bold uppercase bg-amber-500 text-black px-1.5 py-0.5 rounded">Test session</span>
        </span>

        <div className="flex rounded-lg bg-white/10 p-0.5 ml-1">
          {(["teacher", "student", "split"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3 py-1 rounded-md text-xs font-bold capitalize ${view === v ? "bg-white text-slate-900" : "text-white/80 hover:text-white"}`}
            >
              {v === "split" ? "Split view" : `${v} view`}
            </button>
          ))}
        </div>

        {(view === "student" || view === "split") && (
          <div className="flex rounded-lg bg-white/10 p-0.5" title="Student view device size (§33)">
            {(["desktop", "mobile"] as StudentDevice[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setStudentDevice(d)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold capitalize ${studentDevice === d ? "bg-white text-slate-900" : "text-white/70 hover:text-white"}`}
              >
                {d === "mobile" ? "📱 Mobile" : "💻 Desktop"}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 text-[11px] ml-auto">
          <span className="flex items-center gap-1.5"><Dot ok={online} /> Internet</span>
          <span className="flex items-center gap-1.5"><Dot ok={realtime === "connected" ? true : realtime === "connecting" ? "warn" : false} /> Realtime</span>
          <span className="flex items-center gap-1.5"><Dot ok={apiOk === "ok" ? true : apiOk === "checking" ? "warn" : false} /> Whiteboard API</span>
          <span className="flex items-center gap-1.5"><Dot ok={studentPresent ? true : "warn"} /> Student sync</span>
          <button
            type="button"
            onClick={simulateReconnect}
            disabled={reconnecting}
            className="ml-1 rounded-md border border-white/20 px-2.5 py-1 text-xs font-bold hover:bg-white/10 disabled:opacity-50"
            title="Drop & restore the realtime socket, then confirm the board is intact (§26)"
          >
            {reconnecting ? "Reconnecting…" : "Simulate reconnect"}
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={resetting}
            className="rounded-md border border-white/20 px-2.5 py-1 text-xs font-bold hover:bg-white/10 disabled:opacity-50"
          >
            {resetting ? "Resetting…" : "Reset test session"}
          </button>
        </div>
      </div>

      {/* Rooms */}
      <div className="flex-1 min-h-0 flex">
        <div className={`min-h-0 min-w-0 ${view === "split" ? "w-1/2 border-r border-white/10" : view === "teacher" ? "w-full" : "hidden"}`}>
          {(view === "teacher" || view === "split") && teacherRoom}
        </div>
        <div className={`min-h-0 min-w-0 ${view === "split" ? "w-1/2" : view === "student" ? "w-full" : "hidden"}`}>
          {(view === "student" || view === "split") && studentRoom}
        </div>
      </div>

      {/* Live activity / event monitor — Teacher action → event → student receives (§13–15) */}
      <details className="border-t border-white/10 bg-slate-900" open>
        <summary className="px-3 py-1.5 text-xs font-bold cursor-pointer select-none">
          Live Activity — real classroom events ({log.length})
        </summary>
        <div className="max-h-40 overflow-y-auto px-3 pb-2 font-mono text-[11px] leading-relaxed">
          {log.length === 0 ? (
            <p className="text-white/40 py-2">
              Draw, change page, upload a PDF, start a poll or send a chat — events from the real
              classroom engine appear here, with whether a student was connected to receive them.
            </p>
          ) : (
            <>
              <div className="flex gap-2 text-white/30 uppercase tracking-wider text-[9px] py-1 border-b border-white/10 sticky top-0 bg-slate-900">
                <span className="shrink-0 w-16">Time</span>
                <span className="shrink-0 w-56">Classroom event</span>
                <span className="shrink-0 w-24">Student</span>
                <span>Payload</span>
              </div>
              {log.map((r, i) => (
                <div key={i} className="flex gap-2 border-b border-white/5 py-1">
                  <span className="text-white/40 shrink-0 w-16">{r.t}</span>
                  <span className="text-emerald-400 shrink-0 w-56 truncate">{EVENT_LABEL[r.event] ?? r.event}</span>
                  <span className={`shrink-0 w-24 ${r.delivered ? "text-emerald-400" : "text-amber-400/80"}`}>
                    {r.delivered ? "✓ received" : "— none joined"}
                  </span>
                  <span className="text-white/60 truncate">{r.summary}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </details>
    </div>
  );
}
