"use client";

import { useEffect, useState } from "react";
import { DoubtSessionRoom } from "./DoubtSessionRoom";

type BookingDetail = {
  id: string;
  status: string;
  slot: { startTime: string; endTime: string };
  role: "STUDENT" | "TEACHER" | "ADMIN";
  counterpart: { name: string; photoUrl: string | null };
};

async function getJson(url: string) {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error ?? "Request failed");
  return json.data;
}

function fmtRange(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const date = start.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
  const time = `${start.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString(
    "en-IN",
    { hour: "numeric", minute: "2-digit" }
  )}`;
  return `${date} · ${time}`;
}

/**
 * Shared join/status screen for a Doubt Book Session booking — used by
 * both the student and teacher sides (backHref differs per caller). Every
 * piece of state shown (who the other participant is, whether this booking
 * is still joinable) comes from the server via resolveDoubtBookingCaller,
 * never assumed client-side.
 */
export function DoubtBookingJoinScreen({ bookingId, backHref }: { bookingId: string; backHref: string }) {
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inCall, setInCall] = useState(false);
  const [liveKit, setLiveKit] = useState<{ token: string; serverUrl: string } | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getJson(`/api/doubt-booking/bookings/${bookingId}`);
        setBooking(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Booking not found.");
      }
    })();
  }, [bookingId]);

  async function handleJoin() {
    setJoining(true);
    setError(null);
    try {
      const res = await fetch(`/api/doubt-booking/bookings/${bookingId}/join`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Could not join this session");
      setLiveKit({
        token: json.data.token,
        serverUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL || "",
      });
      setInCall(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join this session");
    } finally {
      setJoining(false);
    }
  }

  if (inCall && liveKit) {
    return (
      <div className="h-[70vh] max-w-4xl mx-auto">
        <DoubtSessionRoom
          token={liveKit.token}
          serverUrl={liveKit.serverUrl}
          onLeave={() => {
            setInCall(false);
            setLiveKit(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <a href={backHref} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800">
        <span className="material-symbols-outlined text-base">arrow_back</span>
        Back
      </a>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-semibold text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {booking && (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center space-y-4">
          {booking.counterpart.photoUrl ? (
            <img
              src={booking.counterpart.photoUrl}
              alt={booking.counterpart.name}
              className="w-16 h-16 rounded-full object-cover mx-auto"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center font-bold text-xl mx-auto">
              {booking.counterpart.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              Doubt Session with {booking.counterpart.name}
            </p>
            <p className="text-xs text-slate-500 mt-1">{fmtRange(booking.slot.startTime, booking.slot.endTime)}</p>
          </div>

          {booking.status !== "CONFIRMED" ? (
            <p className="text-xs font-bold text-amber-600">
              This session has been {booking.status.toLowerCase().replace(/_/g, " ")} and can no longer be joined.
            </p>
          ) : (
            <button
              type="button"
              onClick={handleJoin}
              disabled={joining}
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm transition"
            >
              {joining ? "Joining…" : "Join Session"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
