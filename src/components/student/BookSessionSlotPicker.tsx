"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Slot = { id: string; date: string; startTime: string; endTime: string };

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
  return new Date(iso).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
}

export function BookSessionSlotPicker({ teacherId }: { teacherId: string }) {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await getJson(`/api/doubt-booking/teachers/${teacherId}/slots`);
      setSlots(data.slots || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load slots");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [teacherId]);

  async function handleBook(slotId: string) {
    setBookingId(slotId);
    setError(null);
    try {
      const res = await fetch(`/api/doubt-booking/slots/${slotId}/book`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Could not book this slot");
      router.push(`/book-session/bookings/${json.data.booking.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not book this slot");
      await load(); // a 409 (already booked) means the list is stale — refresh it
    } finally {
      setBookingId(null);
    }
  }

  // Group by date for a cleaner picker.
  const byDate = new Map<string, Slot[]>();
  for (const s of slots) {
    const key = fmtDate(s.startTime);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(s);
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Link href="/book-session" className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800">
        <span className="material-symbols-outlined text-base">arrow_back</span>
        Back to teachers
      </Link>

      <header>
        <h1 className="text-xl font-black text-slate-900 dark:text-white">Available Slots</h1>
        <p className="text-xs text-slate-500 mt-1">Pick a time that works for you.</p>
      </header>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-semibold text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-400 text-center py-12">Loading…</p>
      ) : slots.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-12 text-center text-slate-500 text-xs">
          No open slots from this teacher right now.
        </div>
      ) : (
        <div className="space-y-5">
          {Array.from(byDate.entries()).map(([dateLabel, daySlots]) => (
            <div key={dateLabel}>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">{dateLabel}</p>
              <div className="flex flex-wrap gap-2">
                {daySlots.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    disabled={bookingId !== null}
                    onClick={() => handleBook(s.id)}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:opacity-50 transition"
                  >
                    {bookingId === s.id ? "Booking…" : `${fmtTime(s.startTime)} – ${fmtTime(s.endTime)}`}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
