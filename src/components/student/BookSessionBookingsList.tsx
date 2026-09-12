"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Booking = {
  id: string;
  status: string;
  slot: { startTime: string; endTime: string };
  teacher: { user: { name: string; photoUrl: string | null } };
};

async function getJson(url: string) {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error ?? "Request failed");
  return json.data;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function BookSessionBookingsList() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getJson("/api/doubt-booking/bookings");
        setBookings(data.bookings || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load bookings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Link href="/book-session" className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800">
        <span className="material-symbols-outlined text-base">arrow_back</span>
        Book another session
      </Link>

      <header>
        <h1 className="text-xl font-black text-slate-900 dark:text-white">My Doubt Sessions</h1>
      </header>

      {loading ? (
        <p className="text-xs text-slate-400 text-center py-12">Loading…</p>
      ) : error ? (
        <p className="text-xs text-rose-500 text-center py-12">{error}</p>
      ) : bookings.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-12 text-center text-slate-500 text-xs">
          You haven&apos;t booked a doubt session yet.
        </div>
      ) : (
        <div className="space-y-2">
          {bookings.map((b) => (
            <Link
              key={b.id}
              href={`/book-session/bookings/${b.id}`}
              className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400 transition"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {b.teacher.user.name}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">{fmt(b.slot.startTime)}</p>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${
                  b.status === "CONFIRMED"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {b.status.replace(/_/g, " ")}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
