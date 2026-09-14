"use client";

import { useEffect, useState, useMemo } from "react";
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
    topic?: string | null;
    description?: string | null;
    attachmentUrls?: string[];
    claimedByTeacherId?: string | null;
    claimedAt?: string | null;
    voiceAnswerUrl?: string | null;
    voiceDurationSec?: number | null;
    student: {
      user: {
        name: string;
        email?: string | null;
        photoUrl: string | null;
      };
    };
  } | null;
};

type TeacherOption = {
  id: string;
  name: string;
  email?: string | null;
};

interface Props {
  initialTeacherId?: string;
  teachers?: TeacherOption[];
  isAdmin?: boolean;
  hasOwnTeacherProfile?: boolean;
}

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
 * Teacher-side Doubt Book Session console: publish availability,
 * view student bookings with dedicated room links, and supervise across faculty.
 */
export function DoubtBookingTeacherConsole({
  initialTeacherId = "",
  teachers = [],
  isAdmin = false,
  hasOwnTeacherProfile = true,
}: Props) {
  const [selectedTeacherId, setSelectedTeacherId] = useState(initialTeacherId);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"BOOKED" | "OPEN" | "PUBLISH" | "HISTORY">("BOOKED");

  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("16:00");
  const [endTime, setEndTime] = useState("18:00");
  const [duration, setDuration] = useState(30);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [claimingBookingId, setClaimingBookingId] = useState<string | null>(null);

  const loadSlots = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = selectedTeacherId
        ? `/api/doubt-booking/slots?teacherId=${encodeURIComponent(selectedTeacherId)}`
        : "/api/doubt-booking/slots";
      const data = await getJson(url);
      setSlots(data.slots || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load doubt slots");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSlots();
  }, [selectedTeacherId]);

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
    } else {
      setActiveTab("OPEN");
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

  async function handleClaimDoubt(bookingId: string) {
    setClaimingBookingId(bookingId);
    setError(null);
    try {
      const res = await fetch(`/api/doubt-booking/bookings/${bookingId}/claim`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to accept doubt");
      await loadSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept doubt");
    } finally {
      setClaimingBookingId(null);
    }
  }

  const now = new Date();

  // Categorize slots
  const { upcomingBookings, pastBookings, openSlots } = useMemo(() => {
    const upcomingB: Slot[] = [];
    const pastB: Slot[] = [];
    const open: Slot[] = [];

    for (const s of slots) {
      const sEnd = new Date(s.endTime);
      if (s.status === "CANCELLED") continue;

      if (s.booking && s.booking.status === "CONFIRMED") {
        if (sEnd >= now) {
          upcomingB.push(s);
        } else {
          pastB.push(s);
        }
      } else if (s.status === "OPEN") {
        if (sEnd >= now) {
          open.push(s);
        } else {
          pastB.push(s);
        }
      }
    }

    upcomingB.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    pastB.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    open.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    return {
      upcomingBookings: upcomingB,
      pastBookings: pastB,
      openSlots: open,
    };
  }, [slots]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header & Supervisor Switcher */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 text-2xl">event_available</span>
            Doubt Book Session Console
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Manage your 1:1 student doubt sessions, publish bookable windows, and join live rooms.
          </p>
        </div>

        {isAdmin && teachers.length > 0 && (
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] font-bold text-slate-500 px-2">Viewing Faculty:</span>
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-1.5 outline-none focus:border-blue-500"
            >
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.email ? `(${t.email})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("BOOKED")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === "BOOKED"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <span className="material-symbols-outlined text-base">video_call</span>
          <span>Booked Sessions</span>
          {upcomingBookings.length > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === "BOOKED"
                  ? "bg-white text-blue-600"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
              }`}
            >
              {upcomingBookings.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("OPEN")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === "OPEN"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <span className="material-symbols-outlined text-base">date_range</span>
          <span>Open Slots</span>
          {openSlots.length > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === "OPEN"
                  ? "bg-white text-blue-600"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
              }`}
            >
              {openSlots.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("PUBLISH")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === "PUBLISH"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <span className="material-symbols-outlined text-base">add_circle</span>
          <span>Publish Availability</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("HISTORY")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === "HISTORY"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <span className="material-symbols-outlined text-base">history</span>
          <span>Session History ({pastBookings.length})</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-rose-500">error</span>
          <p>{error}</p>
        </div>
      )}

      {/* TAB 1: BOOKED SESSIONS */}
      {activeTab === "BOOKED" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-900 dark:text-white">
              Student Booked Sessions ({upcomingBookings.length})
            </h2>
            <button
              type="button"
              onClick={() => loadSlots()}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              Refresh
            </button>
          </div>

          {loading ? (
            <p className="text-xs text-slate-400 text-center py-12">Loading booked sessions…</p>
          ) : upcomingBookings.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-2xl">event_upcoming</span>
              </div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No booked doubt sessions scheduled right now.
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Once students select a time slot from your published schedule, their sessions will appear here with a
                direct live room link.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab("PUBLISH")}
                className="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Publish Available Slots
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcomingBookings.map((s) => {
                const isLiveNow = new Date(s.startTime) <= now && new Date(s.endTime) >= now;
                const isStartingSoon =
                  !isLiveNow && new Date(s.startTime).getTime() - now.getTime() <= 15 * 60 * 1000;

                return (
                  <div
                    key={s.id}
                    className={`rounded-3xl border p-5 transition flex flex-col justify-between ${
                      isLiveNow
                        ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs"
                    }`}
                  >
                    <div>
                      {/* Status header */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-1.5">
                          {isLiveNow ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wide">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                              Live Now
                            </span>
                          ) : isStartingSoon ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wide">
                              Starting Soon
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase tracking-wide">
                              Confirmed
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          {fmtDate(s.startTime)}
                        </span>
                      </div>

                      {/* Student Info */}
                      <div className="flex items-center gap-3 mb-4">
                        {s.booking?.student.user.photoUrl ? (
                          <img
                            src={s.booking.student.user.photoUrl}
                            alt={s.booking.student.user.name}
                            className="w-10 h-10 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold text-sm shrink-0">
                            {s.booking?.student.user.name ? s.booking.student.user.name.charAt(0).toUpperCase() : "S"}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {s.booking?.student.user.name || "Student"}
                          </p>
                          {s.booking?.student.user.email && (
                            <p className="text-[11px] text-slate-500 truncate">{s.booking.student.user.email}</p>
                          )}
                        </div>
                      </div>

                      {/* Time Window */}
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 rounded-xl mb-3">
                        <span className="material-symbols-outlined text-sm text-slate-400">schedule</span>
                        <span>
                          {fmtTime(s.startTime)} – {fmtTime(s.endTime)}
                        </span>
                      </div>

                      {/* Student Submitted Doubt Information */}
                      {s.booking && (s.booking.topic || s.booking.description || (s.booking.attachmentUrls && s.booking.attachmentUrls.length > 0)) && (
                        <div className="p-3 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 mb-4 space-y-2">
                          {s.booking.topic && (
                            <div className="flex items-start gap-1.5">
                              <span className="material-symbols-outlined text-sm text-blue-600 dark:text-blue-400 mt-0.5 shrink-0">topic</span>
                              <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                                {s.booking.topic}
                              </p>
                            </div>
                          )}

                          {s.booking.description && (
                            <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap line-clamp-3 pl-5">
                              {s.booking.description}
                            </p>
                          )}

                          {/* Uploaded Question Images / Screenshots */}
                          {s.booking.attachmentUrls && s.booking.attachmentUrls.length > 0 && (
                            <div className="pt-1 pl-5">
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">image</span>
                                Question Images ({s.booking.attachmentUrls.length}):
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {s.booking.attachmentUrls.map((imgUrl, imgIdx) => (
                                  <button
                                    key={imgIdx}
                                    type="button"
                                    onClick={() => {
                                      setZoomImage(imgUrl);
                                      setZoomScale(1);
                                    }}
                                    className="relative group w-14 h-14 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:ring-2 hover:ring-blue-500 transition cursor-zoom-in"
                                    title="Click to view and zoom image"
                                  >
                                    <img src={imgUrl} alt={`Doubt Image ${imgIdx + 1}`} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                                      <span className="material-symbols-outlined text-base">zoom_in</span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions & Claiming */}
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {s.booking && !s.booking.claimedByTeacherId && (
                        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60">
                          <span className="text-[11px] font-bold text-amber-800 dark:text-amber-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Unclaimed Doubt
                          </span>
                          <button
                            type="button"
                            disabled={claimingBookingId === s.booking.id}
                            onClick={() => handleClaimDoubt(s.booking!.id)}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition active:scale-95 disabled:opacity-50"
                          >
                            {claimingBookingId === s.booking.id ? "Accepting…" : "Take / Accept Doubt"}
                          </button>
                        </div>
                      )}

                      {s.booking?.claimedByTeacherId && (
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 px-1">
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                          <span>Accepted by Faculty</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        {s.booking && (
                          <Link
                            href={`/team/doubt-booking/${s.booking.id}`}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition active:scale-95"
                          >
                            <span className="material-symbols-outlined text-base">videocam</span>
                            <span>{isLiveNow ? "Join Session Now" : "Start Doubt Session"}</span>
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCancel(s.id)}
                          className="p-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition"
                          title="Cancel this session"
                        >
                          <span className="material-symbols-outlined text-base">cancel</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: OPEN SLOTS */}
      {activeTab === "OPEN" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-900 dark:text-white">
              Open Availability Slots ({openSlots.length})
            </h2>
            <button
              type="button"
              onClick={() => setActiveTab("PUBLISH")}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Publish More Slots
            </button>
          </div>

          {loading ? (
            <p className="text-xs text-slate-400 text-center py-12">Loading slots…</p>
          ) : openSlots.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center text-slate-500 text-xs">
              No open slots published right now. Use the &ldquo;Publish Availability&rdquo; tab to open new slots for
              students.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {openSlots.map((s) => (
                <div
                  key={s.id}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{fmtDate(s.startTime)}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {fmtTime(s.startTime)} – {fmtTime(s.endTime)}
                    </p>
                    <span className="inline-block mt-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                      Open for Booking
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCancel(s.id)}
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                    title="Cancel Slot"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PUBLISH SLOTS FORM */}
      {activeTab === "PUBLISH" && (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">Publish New Availability Window</h2>
            <p className="text-xs text-slate-500 mt-1">
              Specify a date and time window. The system will automatically slice the window into 1:1 bookable slots
              that students can reserve.
            </p>
          </div>

          <form onSubmit={handleCreateSlots} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1.5">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2.5 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1.5">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2.5 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1.5">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2.5 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1.5">
                Slot Length (Minutes)
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2.5 outline-none focus:border-blue-500"
              >
                {[15, 20, 30, 45, 60].map((d) => (
                  <option key={d} value={d}>
                    {d} mins per session
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 md:col-span-4 flex justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-xs shadow-sm transition"
              >
                {submitting ? "Generating & Publishing Slots…" : "Publish Availability Window"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: SESSION HISTORY */}
      {activeTab === "HISTORY" && (
        <div className="space-y-4">
          <h2 className="text-sm font-black text-slate-900 dark:text-white">Past / Completed Sessions</h2>

          {loading ? (
            <p className="text-xs text-slate-400 text-center py-12">Loading history…</p>
          ) : pastBookings.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center text-slate-500 text-xs">
              No past sessions recorded yet.
            </div>
          ) : (
            <div className="space-y-2">
              {pastBookings.map((s) => (
                <div
                  key={s.id}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {fmtDate(s.startTime)} · {fmtTime(s.startTime)} – {fmtTime(s.endTime)}
                    </p>
                    {s.booking ? (
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                        Completed with{" "}
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {s.booking.student.user.name}
                        </span>{" "}
                        {s.booking.student.user.email ? `(${s.booking.student.user.email})` : ""}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-400 mt-0.5">Unbooked Slot (Expired)</p>
                    )}
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {s.booking ? s.booking.status.replace(/_/g, " ") : "EXPIRED"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Image Lightbox with Zoom Controls */}
      {zoomImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center">
            {/* Top Toolbar */}
            <div className="w-full flex items-center justify-between gap-3 mb-3 text-white">
              <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-2xl border border-slate-700/60 backdrop-blur-xs">
                <button
                  type="button"
                  onClick={() => setZoomScale((s) => Math.max(0.5, s - 0.25))}
                  className="p-1 hover:bg-slate-800 rounded-lg transition"
                  title="Zoom Out"
                >
                  <span className="material-symbols-outlined text-lg">zoom_out</span>
                </button>
                <span className="text-xs font-mono font-bold w-12 text-center">{Math.round(zoomScale * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setZoomScale((s) => Math.min(3, s + 0.25))}
                  className="p-1 hover:bg-slate-800 rounded-lg transition"
                  title="Zoom In"
                >
                  <span className="material-symbols-outlined text-lg">zoom_in</span>
                </button>
                <button
                  type="button"
                  onClick={() => setZoomScale(1)}
                  className="text-[11px] font-bold px-2 py-0.5 hover:bg-slate-800 rounded-lg transition"
                >
                  Reset
                </button>
                <a
                  href={zoomImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 hover:bg-slate-800 rounded-lg transition flex items-center"
                  title="Open in new tab"
                >
                  <span className="material-symbols-outlined text-lg">open_in_new</span>
                </a>
              </div>

              <button
                type="button"
                onClick={() => setZoomImage(null)}
                className="w-9 h-9 rounded-full bg-slate-900/80 hover:bg-rose-600 text-white flex items-center justify-center transition border border-slate-700/60"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Image Container */}
            <div className="overflow-auto max-h-[80vh] rounded-2xl border border-slate-800 bg-slate-950/60 p-2 flex items-center justify-center">
              <img
                src={zoomImage}
                alt="Zoomed Doubt Question"
                style={{ transform: `scale(${zoomScale})`, transformOrigin: "center center" }}
                className="max-h-[75vh] w-auto object-contain transition-transform duration-100 select-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
