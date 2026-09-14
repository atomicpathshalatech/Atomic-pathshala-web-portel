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

  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  async function handleUploadFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingImage(true);
    setError(null);
    try {
      for (let i = 0; i < Math.min(files.length, 5); i++) {
        const file = files[i];
        if (!file) continue;
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "doubts");
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to upload image");
        setImages((prev) => [...prev, json.data.url]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  }

  async function handleConfirmBooking() {
    if (!selectedSlot) return;
    setBookingId(selectedSlot.id);
    setError(null);
    try {
      const res = await fetch(`/api/doubt-booking/slots/${selectedSlot.id}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          description: description.trim(),
          attachmentUrls: images,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Could not book this slot");
      router.push(`/book-session/bookings/${json.data.booking.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not book this slot");
      await load();
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
                    onClick={() => {
                      setSelectedSlot(s);
                      setTopic("");
                      setDescription("");
                      setImages([]);
                    }}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:opacity-50 transition"
                  >
                    {fmtTime(s.startTime)} – {fmtTime(s.endTime)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Booking Modal to submit Doubt details & images */}
      {selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">help</span>
                  Submit Doubt &amp; Confirm Booking
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {fmtDate(selectedSlot.startTime)} · {fmtTime(selectedSlot.startTime)} – {fmtTime(selectedSlot.endTime)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSlot(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 flex items-center justify-center transition"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Question / Theory Topic <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Physics - Wave Optics / Friction problem"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Detailed Doubt / What would you like to understand?
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Explain the concept or question where you are getting stuck..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Attach Question Images / Screenshots
                </label>

                {/* Uploaded thumbnails */}
                {images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {images.map((imgUrl, idx) => (
                      <div key={idx} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100">
                        <img src={imgUrl} alt={`Doubt attachment ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] opacity-90 group-hover:opacity-100 transition shadow"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {images.length < 5 && (
                  <label className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-400 bg-slate-50/60 dark:bg-slate-800/40 cursor-pointer transition">
                    <span className="material-symbols-outlined text-2xl text-blue-500">add_photo_alternate</span>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      {uploadingImage ? "Uploading image…" : "Upload Question Photo or Screenshot"}
                    </span>
                    <span className="text-[10px] text-slate-400">PNG, JPG, WEBP (Max 5 images)</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={uploadingImage}
                      onChange={handleUploadFiles}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedSlot(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bookingId !== null || uploadingImage}
                onClick={handleConfirmBooking}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm disabled:opacity-50 transition flex items-center gap-1.5"
              >
                {bookingId !== null ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>Confirming…</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    <span>Confirm Booking</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
