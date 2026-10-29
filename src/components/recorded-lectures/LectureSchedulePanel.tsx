"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { premiereState, toIstLocal } from "@/lib/recorded-lectures/premiere";

type Slot = { id: string; batchId: string; batchName: string; startsAt: string; endsAt: string; status: string };
type Batch = { id: string; name: string };

const when = (d: string) =>
  new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Schedule a recorded lecture by date and time: it appears in each batch's
 * live schedule and plays live in that slot (like a live class), then stays
 * as a recording. Scheduling publishes the lecture; students cannot play it
 * before the slot.
 */
export function LectureSchedulePanel({ lectureId, ready, onChanged }: { lectureId: string; ready: boolean; onChanged?: () => void }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [at, setAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const apply = (data: { slots: Slot[]; batches: Batch[] }) => {
    setSlots(data.slots);
    setBatches(data.batches);
    setPicked((cur) => (cur.length ? cur.filter((id) => data.batches.some((b) => b.id === id)) : data.batches.map((b) => b.id)));
    const next = data.slots.find((s) => s.status !== "CANCELLED" && premiereState(s) !== "ENDED");
    if (next) setAt(toIstLocal(next.startsAt));
  };

  const load = useCallback(async () => {
    const res = await fetch(`/api/team/recorded-lectures/${lectureId}/schedule`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success) apply(json.data);
    setLoaded(true);
  }, [lectureId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!at) return toast.error("Choose the date and time.");
    if (!picked.length) return toast.error("Choose at least one batch.");
    setBusy(true);
    try {
      const res = await fetch(`/api/team/recorded-lectures/${lectureId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startsAt: at, batchIds: picked }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "Could not schedule the lecture.");
      apply(json.data);
      toast.success("Scheduled. It is in the batches' live schedule.");
      onChanged?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (slot: Slot) => {
    if (!window.confirm(`Remove the ${when(slot.startsAt)} slot of ${slot.batchName}?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/team/recorded-lectures/${lectureId}/schedule?slot=${encodeURIComponent(slot.id)}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "Could not remove the slot.");
      apply(json.data);
      toast.success("Removed from the schedule.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
      <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
        <span className="material-symbols-outlined text-blue-600 text-xl">event</span>
        Schedule (plays live at this time)
      </h2>
      <p className="text-xs text-slate-500">
        The lecture appears in the batch&apos;s live schedule. At that time it plays like a live class: every student is at the same point and
        cannot skip ahead. After the class it stays as a recording. Scheduling publishes the lecture, but students can only play it from that time.
      </p>

      {!ready ? (
        <p className="text-sm text-slate-500">Upload and verify the video first.</p>
      ) : !loaded ? (
        <div className="h-16 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
      ) : batches.length === 0 ? (
        <p className="text-sm text-amber-700">This lecture&apos;s chapter is not in any batch yet. Add the chapter to a batch first.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <label className="block text-xs flex-1">
              <span className="font-bold text-slate-600 dark:text-slate-300">Date and time (India)</span>
              <input
                type="datetime-local"
                value={at}
                onChange={(e) => setAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold px-4 py-2"
            >
              {busy ? "Saving…" : slots.some((s) => s.status !== "CANCELLED") ? "Save time" : "Schedule"}
            </button>
          </div>
          {batches.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {batches.map((b) => (
                <label key={b.id} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={picked.includes(b.id)}
                    onChange={(e) => setPicked((cur) => (e.target.checked ? [...cur, b.id] : cur.filter((x) => x !== b.id)))}
                  />
                  {b.name}
                </label>
              ))}
            </div>
          )}
          {slots.length > 0 && (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
              {slots.map((s) => {
                const state = s.status === "CANCELLED" ? "CANCELLED" : premiereState(s);
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{s.batchName}</p>
                      <p className="text-xs text-slate-500">
                        {when(s.startsAt)} – {new Date(s.endsAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          state === "LIVE"
                            ? "bg-red-600 text-white"
                            : state === "UPCOMING"
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {state === "LIVE" ? "Live now" : state === "UPCOMING" ? "Upcoming" : state === "CANCELLED" ? "Cancelled" : "Done"}
                      </span>
                      {state !== "CANCELLED" && (
                        <button type="button" onClick={() => remove(s)} disabled={busy} className="text-xs font-bold text-rose-600 hover:underline">
                          Remove
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
