"use client";

import { CalendarDays, Pencil, Plus, RefreshCw, Trash2, Youtube } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const BATCHES = [
  { value: "SELECTION_PRO", label: "Selection Pro Batch" },
  { value: "SELECTION_1_0", label: "Selection 1.0 Batch" },
  { value: "ARAMBH", label: "Arambh Batch" },
  { value: "MANZIL", label: "Manzil Batch" },
  { value: "UDAAN", label: "Udaan Batch (Class 10th)" },
  { value: "NO_BATCH", label: "No Batch" },
];

const TEACHERS = [
  "Firoz Ali",
  "Yaman",
  "Mukul Kashyap",
  "Sonu Bhaiya",
  "Sanu Yadav",
  "Mohsin Ali",
  "Ilmas Ameer",
  "Darakhsha Ishrat",
  "Rehan Ali",
  "Umaima Nadeem",
];

interface ScheduleEntry {
  id: string;
  batch: string;
  classDate: string;
  startTime: string;
  endTime: string | null;
  subject: string;
  teacherName: string | null;
  teacherPhotoUrl: string | null;
  topic: string;
  youtubeLink: string | null;
  notes: string | null;
}

const emptyForm = {
  id: "",
  batch: "SELECTION_PRO",
  classDate: "",
  startTime: "",
  endTime: "",
  subject: "",
  teacherName: "",
  teacherPhotoUrl: "",
  topic: "",
  youtubeLink: "",
  notes: "",
};

// Source gated this whole screen behind `useAuth()`'s user.role === "ADMIN"
// || "FACULTY" check. That gate is unreachable here: ScheduleGate (see
// ScheduleGate.tsx) only renders ScheduleManager for users where
// useAiChatUser().user.isScheduleManager is already true, and the API
// routes this component calls are themselves gated server-side by
// requireScheduleManager(). No client-side re-check needed.
export function ScheduleManager() {
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [filterBatch, setFilterBatch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async (batch: string = "") => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ai-chat/admin/schedule?batch=" + encodeURIComponent(batch), {
        cache: "no-store",
      });
      const data = (await response.json()) as { schedules?: ScheduleEntry[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not load schedule.");
      setSchedules(data.schedules ?? []);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not load schedule.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filterBatch);
  }, [filterBatch, load]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const startEdit = (entry: ScheduleEntry) => {
    setEditingId(entry.id);
    setForm({
      id: entry.id,
      batch: entry.batch,
      classDate: entry.classDate.slice(0, 10),
      startTime: entry.startTime,
      endTime: entry.endTime ?? "",
      subject: entry.subject,
      teacherName: entry.teacherName ?? "",
      teacherPhotoUrl: entry.teacherPhotoUrl ?? "",
      topic: entry.topic,
      youtubeLink: entry.youtubeLink ?? "",
      notes: entry.notes ?? "",
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const method = editingId ? "PATCH" : "POST";
      const response = await fetch("/api/ai-chat/admin/schedule", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { ...form, id: editingId } : form),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not save class.");

      setNotice(editingId ? "Class updated." : "Class added.");
      resetForm();
      await load(filterBatch);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not save class.");
    } finally {
      setSaving(false);
    }
  };

  const handleSyncFromSheet = async () => {
    setSyncing(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/ai-chat/admin/schedule/sync", { method: "POST" });
      const data = (await response.json()) as {
        created?: number;
        updated?: number;
        skipped?: number;
        total?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Could not sync from Google Sheet.");
      setNotice(
        `Sheet sync complete: ${data.created ?? 0} added, ${data.updated ?? 0} updated, ${data.skipped ?? 0} skipped (${data.total ?? 0} rows read).`
      );
      await load(filterBatch);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not sync from Google Sheet.");
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/ai-chat/admin/schedule?id=" + encodeURIComponent(id), {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not delete class.");
      setNotice("Class deleted.");
      await load(filterBatch);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not delete class.");
    }
  };

  const handleDeleteGroup = async (ids: string[]) => {
    setError(null);
    setNotice(null);
    try {
      await Promise.all(
        ids.map((id) =>
          fetch("/api/ai-chat/admin/schedule?id=" + encodeURIComponent(id), { method: "DELETE" })
        )
      );
      setNotice("Class deleted.");
      await load(filterBatch);
    } catch {
      setError("Could not delete class.");
    }
  };

  const groupedSchedules = useMemo(() => {
    const map = new Map<string, ScheduleEntry[]>();
    for (const entry of schedules) {
      const key = [
        entry.classDate,
        entry.startTime,
        entry.subject,
        entry.topic,
        entry.teacherName ?? "",
      ].join("|");
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    return Array.from(map.values());
  }, [schedules]);

  return (
    <main className="min-h-dvh bg-white dark:bg-atomic-navy">
      <div className="mx-auto max-w-5xl px-4 py-7 sm:px-6">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-atomic-orange" />
            <div>
              <p className="text-sm font-medium text-atomic-orange">Atomic Pathshala</p>
              <h1 className="text-2xl font-bold">Class Schedule</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSyncFromSheet()}
              disabled={syncing}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync from Sheet"}
            </button>
            <Link
              href="/guru"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Return to chat
            </Link>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border-l-4 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-4 rounded-lg border-l-4 border-emerald-500 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
            {notice}
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-2xl border border-slate-200 p-5 dark:border-slate-700"
        >
          <h2 className="mb-4 font-semibold">{editingId ? "Edit class" : "Add a new class"}</h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block text-slate-500">Batch</span>
              <select
                value={form.batch}
                onChange={(event) => setForm({ ...form, batch: event.target.value })}
                required
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-900"
              >
                {BATCHES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-slate-500">Class date</span>
              <input
                type="date"
                value={form.classDate}
                onChange={(event) => setForm({ ...form, classDate: event.target.value })}
                required
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-900"
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-slate-500">Subject</span>
              <input
                value={form.subject}
                onChange={(event) => setForm({ ...form, subject: event.target.value })}
                placeholder="Biology / Physics / Chemistry"
                required
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-900"
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-slate-500">Teacher</span>
              <select
                value={form.teacherName}
                onChange={(event) => setForm({ ...form, teacherName: event.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">Select teacher</option>
                {TEACHERS.map((teacher) => (
                  <option key={teacher} value={teacher}>
                    {teacher}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-slate-500">Teacher photo URL (optional)</span>
              <input
                value={form.teacherPhotoUrl}
                onChange={(event) => setForm({ ...form, teacherPhotoUrl: event.target.value })}
                placeholder="https://... (leave blank to show initials)"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-900"
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-slate-500">Start time</span>
              <input
                type="time"
                value={form.startTime}
                onChange={(event) => setForm({ ...form, startTime: event.target.value })}
                required
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-900"
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-slate-500">End time (optional)</span>
              <input
                type="time"
                value={form.endTime}
                onChange={(event) => setForm({ ...form, endTime: event.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-900"
              />
            </label>

            <label className="text-sm sm:col-span-2 lg:col-span-1">
              <span className="mb-1 block text-slate-500">YouTube link</span>
              <input
                value={form.youtubeLink}
                onChange={(event) => setForm({ ...form, youtubeLink: event.target.value })}
                placeholder="https://youtube.com/..."
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-900"
              />
            </label>

            <label className="text-sm sm:col-span-2 lg:col-span-3">
              <span className="mb-1 block text-slate-500">Topic (what will be taught)</span>
              <input
                value={form.topic}
                onChange={(event) => setForm({ ...form, topic: event.target.value })}
                placeholder="e.g. Human Reproduction - Part 2"
                required
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-900"
              />
            </label>

            <label className="text-sm sm:col-span-2 lg:col-span-3">
              <span className="mb-1 block text-slate-500">Notes (optional)</span>
              <textarea
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                rows={2}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-atomic-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-atomic-orange-dark disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {saving ? "Saving..." : editingId ? "Update class" : "Add class"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Upcoming classes</h2>
            <select
              value={filterBatch}
              onChange={(event) => setFilterBatch(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">All batches</option>
              {BATCHES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : groupedSchedules.length === 0 ? (
            <p className="text-sm text-slate-500">No classes scheduled yet.</p>
          ) : (
            <div className="space-y-3">
              {groupedSchedules.map((group) => {
                const entry = group[0];
                const batchLabels = group.map(
                  (item) => BATCHES.find((b) => b.value === item.batch)?.label ?? item.batch
                );
                const dateLabel = new Date(entry.classDate).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "2-digit",
                });

                return (
                  <div
                    key={group.map((item) => item.id).join(",")}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                  >
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap gap-1.5">
                        {batchLabels.map((label) => (
                          <span
                            key={label}
                            className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-atomic-orange dark:bg-orange-950/30"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                      <p className="mt-1 font-semibold">
                        {entry.subject} - {entry.topic}
                      </p>
                      {entry.teacherName && (
                        <p className="mt-0.5 text-xs text-slate-500">Teacher: {entry.teacherName}</p>
                      )}
                      <p className="mt-1 text-sm text-slate-500">
                        {dateLabel} - {entry.startTime}
                        {entry.endTime ? " to " + entry.endTime : ""}
                      </p>
                      {entry.notes && <p className="mt-1 text-xs text-slate-400">{entry.notes}</p>}
                      {entry.youtubeLink && (
                        <a
                          href={entry.youtubeLink}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
                        >
                          <Youtube className="h-3.5 w-3.5" />
                          Watch link
                        </a>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => startEdit(entry)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Edit"
                        aria-label="Edit class"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => void handleDeleteGroup(group.map((item) => item.id))}
                        className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                        title="Delete"
                        aria-label="Delete class"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
