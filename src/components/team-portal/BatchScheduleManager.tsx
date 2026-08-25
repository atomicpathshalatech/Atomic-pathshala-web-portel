"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  SCHEDULE_SESSION_TYPE_OPTIONS,
  SCHEDULE_SESSION_STATUS_OPTIONS,
} from "@/lib/validation/batch";

type ScheduleEntry = {
  id: string;
  title: string;
  subject: string | null;
  type: (typeof SCHEDULE_SESSION_TYPE_OPTIONS)[number];
  status: (typeof SCHEDULE_SESSION_STATUS_OPTIONS)[number];
  startsAt: string;
  endsAt: string;
  notes: string | null;
  teacherId: string | null;
  teacher: { user: { name: string } } | null;
};

type TeacherOption = { id: string; user: { name: string } };

const TYPE_LABELS: Record<ScheduleEntry["type"], string> = {
  LIVE_CLASS: "Live Class",
  TEST: "Test",
  DPP: "DPP",
  DOUBT_SESSION: "Doubt Session",
  OTHER: "Other",
};

const STATUS_STYLES: Record<ScheduleEntry["status"], string> = {
  SCHEDULED: "bg-surface-container-high text-on-surface-variant",
  LIVE: "bg-error/10 text-error",
  COMPLETED: "bg-secondary/10 text-secondary",
  CANCELLED: "bg-outline-variant/30 text-on-surface-variant line-through",
};

function toDateTimeLocal(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

const inputClass =
  "w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-2 px-3 text-body-sm outline-none focus:ring-2 focus:ring-primary/30";

export function BatchScheduleManager({
  batchId,
  schedules,
  teachers,
}: {
  batchId: string;
  schedules: ScheduleEntry[];
  teachers: TeacherOption[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    subject: "",
    type: "LIVE_CLASS" as ScheduleEntry["type"],
    status: "SCHEDULED" as ScheduleEntry["status"],
    teacherId: "",
    startsAt: "",
    endsAt: "",
    notes: "",
  });

  function resetForm() {
    setForm({
      title: "",
      subject: "",
      type: "LIVE_CLASS",
      status: "SCHEDULED",
      teacherId: "",
      startsAt: "",
      endsAt: "",
      notes: "",
    });
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(entry: ScheduleEntry) {
    setForm({
      title: entry.title,
      subject: entry.subject ?? "",
      type: entry.type,
      status: entry.status,
      teacherId: entry.teacherId ?? "",
      startsAt: toDateTimeLocal(entry.startsAt),
      endsAt: toDateTimeLocal(entry.endsAt),
      notes: entry.notes ?? "",
    });
    setEditingId(entry.id);
    setShowForm(true);
  }

  async function submit() {
    if (!form.title.trim() || !form.startsAt || !form.endsAt) {
      setError("Title, start time, and end time are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const url = editingId
        ? `/api/team/batches/${batchId}/schedule/${editingId}`
        : `/api/team/batches/${batchId}/schedule`;
      const payload = {
        title: form.title,
        subject: form.subject.trim() || undefined,
        type: form.type,
        ...(editingId ? { status: form.status } : {}),
        teacherId: form.teacherId || undefined,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        notes: form.notes.trim() || undefined,
      };
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setError(body.error ?? "Could not save this schedule entry.");
        return;
      }
      resetForm();
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/team/batches/${batchId}/schedule/${id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setError(body.error ?? "Could not delete this schedule entry.");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-error-container/40 border border-error/20 rounded-xl px-4 py-2">
          <p className="text-label-sm font-label-sm text-error">{error}</p>
        </div>
      )}

      {schedules.length === 0 ? (
        <p className="text-label-sm text-on-surface-variant">No timetable entries yet.</p>
      ) : (
        <ul className="space-y-2">
          {schedules.map((s) => (
            <li key={s.id} className="bg-surface-container-lowest rounded-lg px-3 py-2 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary px-2 py-0.5 rounded mr-2">
                    {TYPE_LABELS[s.type]}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${STATUS_STYLES[s.status]}`}>
                    {s.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-label-sm">
                  {s.type === "LIVE_CLASS" && (
                    <Link
                      href={`/team/live-class/${s.id}`}
                      className="flex items-center gap-1 text-primary font-label-sm hover:underline"
                    >
                      <span className="material-symbols-outlined text-base">cast</span>
                      Start Live Class
                    </Link>
                  )}
                  <button type="button" onClick={() => startEdit(s)} className="text-primary hover:underline">
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => remove(s.id)}
                    className="text-error hover:underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="font-label-md text-label-md text-on-surface">{s.title}</p>
              <p className="text-label-sm text-on-surface-variant">
                {s.subject ? `${s.subject} · ` : ""}
                {new Date(s.startsAt).toLocaleString()} — {new Date(s.endsAt).toLocaleString()}
                {s.teacher ? ` · ${s.teacher.user.name}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}

      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="text-primary font-label-md text-label-md hover:underline"
        >
          + Add Timetable Entry
        </button>
      ) : (
        <div className="border-t border-outline-variant/20 pt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className={inputClass}
              placeholder="Title, e.g. Chemical Kinetics: Rate Laws"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <input
              className={inputClass}
              placeholder="Subject (optional)"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
            <select
              className={inputClass}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as ScheduleEntry["type"] })}
            >
              {SCHEDULE_SESSION_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            {editingId && (
              <select
                className={inputClass}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as ScheduleEntry["status"] })}
              >
                {SCHEDULE_SESSION_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
            <select
              className={inputClass}
              value={form.teacherId}
              onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
            >
              <option value="">No teacher assigned</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.user.name}
                </option>
              ))}
            </select>
            <div />
            <label className="text-label-sm text-on-surface-variant space-y-1">
              <span>Starts at</span>
              <input
                type="datetime-local"
                className={inputClass}
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              />
            </label>
            <label className="text-label-sm text-on-surface-variant space-y-1">
              <span>Ends at</span>
              <input
                type="datetime-local"
                className={inputClass}
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
              />
            </label>
          </div>
          <textarea
            rows={2}
            className={inputClass}
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <div className="flex gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={submit}
              className="bg-primary text-on-primary font-label-md text-label-md px-5 py-2 rounded-lg hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Saving..." : editingId ? "Save Changes" : "Add Entry"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="text-on-surface-variant font-label-md text-label-md px-5 py-2 rounded-lg hover:bg-surface-container-high"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
