"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Slot = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "OPEN" | "BOOKED" | "CANCELLED";
  booking: {
    id: string;
    status: string;
    student: { user: { name: string; photoUrl: string | null } };
  } | null;
};

async function getJson(url: string) {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error ?? "Request failed");
  return json.data;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * Teacher-side Doubt Book Session console: publish availability (a
 * date + start/end window sliced into fixed-duration bookable slots,
 * matching the "4:00-6:00, 30 min -> four 30-min slots" spec example) and
 * see/cancel the resulting slots and their bookings.
 */
export function DoubtBookingTeacherConsole() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("16:00");
  const [endTime, setEndTime] = useState("18:00");
  const [duration, setDuration] = useState(30);

  const loadSlots = async () => {
    try {
      const data = await getJson("/api/doubt-booking/slots");
      setSlots(data.slots || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load slots");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSlots();
  }, []);

  async function handleCreateSlots(e: React.FormEvent) {
    e.preventDefault();
    if (!date) {
      setError("Pick a date first.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);
    const dayStart = new Date(`${date}T00:00:00`);
    const windowStart = new Date(dayStart);
    windowStart.setHours(startH!, startM!, 0, 0);
    const windowEnd = new Date(dayStart);
    windowEnd.setHours(endH!, endM!, 0, 0);

    if (!(windowStart < windowEnd)) {
      setError("Start time must be before end time.");
      setSubmitting(false);
      return;
    }

    const generated: { start: Date; end: Date }[] = [];
    let cursor = new Date(windowStart);
    while (cursor.getTime() + duration * 60_000 <= windowEnd.getTime()) {
      const slotEnd = new Date(cursor.getTime() + duration * 60_000);
      generated.push({ start: new Date(cursor), end: slotEnd });
      cursor = slotEnd;
    }

    let failures = 0;
    for (const g of generated) {
      try {
        const res = await fetch("/api/doubt-booking/slots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            startTime: g.start.toISOString(),
            endTime: g.end.toISOString(),
          }),
        });
        if (!res.ok) failures++;
      } catch {
        failures++;
      }
    }

    if (failures > 0) {
      setError(`${failures} of ${generated.length} slot(s) could not be created (likely overlapping an existing slot).`);
    }
    setSubmitting(false);
    await loadSlots();
  }

  async function handleCancel(slotId: string) {
    if (!confirm("Cancel this slot? If it's already booked, the student will be notified.")) return;
    try {
      const res = await fetch(`/api/doubt-booking/slots/${slotId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to cancel");
      await loadSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel slot");
    }
  }

  const upcoming = slots
    .filter((s) => s.status !== "CANCELLED" && new Date(s.startTime) > new Date())
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <header>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Doubt Book Session</h1>
        <p className="text-xs md:text-sm text-slate-500 mt-1">
          Publish availability windows — students book 1:1 doubt sessions from what you open up.
        </p>
      </header>

      <form
        onSubmit={handleCreateSlots}
        className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 grid grid-cols-2 md:grid-cols-5 gap-3 items-end"
      >
        <div className="col-span-2 md:col-span-1">
          <label className="text-[11px] font-bold text-slate-500 block mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-500 block mb-1">From</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
            className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-500 block mb-1">To</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
            className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-500 block mb-1">Slot length (min)</label>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 outline-none focus:border-blue-500"
          >
            {[15, 20, 30, 45, 60].map((d) => (
              <option key={d} value={d}>
                {d} min
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="col-span-2 md:col-span-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm transition"
        >
          {submitting ? "Publishing…" : "Publish Slots"}
        </button>
      </form>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-semibold text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6">
        <h2 className="text-sm font-black text-slate-900 dark:text-white mb-4">
          Upcoming Slots ({upcoming.length})
        </h2>
        {loading ? (
          <p className="text-xs text-slate-400 text-center py-8">Loading…</p>
        ) : upcoming.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8">No upcoming slots published yet.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {fmtDate(s.startTime)} · {fmtTime(s.startTime)} – {fmtTime(s.endTime)}
                  </p>
                  {s.booking ? (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                      Booked by {s.booking.student.user.name}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400 mt-0.5">Open</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {s.booking && s.booking.status === "CONFIRMED" && (
                    <Link
                      href={`/team/doubt-booking/${s.booking.id}`}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 transition"
                    >
                      Join
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => handleCancel(s.id)}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
