"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  SCHEDULE_SESSION_TYPE_OPTIONS,
  SCHEDULE_SESSION_STATUS_OPTIONS,
} from "@/lib/validation/batch";
import {
  COMMON_DURATIONS,
  calculateEndTime,
} from "@/lib/batch/schedule-conflict";

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

import {
  parseISTDateTimeInput,
  toISTDateTimeLocal,
  formatISTTime,
  formatISTDate,
} from "@/lib/date-utils";

const inputClass =
  "w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest py-2.5 px-3.5 text-body-sm outline-none focus:ring-2 focus:ring-primary/30";

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
    durationMinutes: 60,
    isCustomDuration: false,
    customDuration: 60,
    notes: "",
  });

  // Calculate End Time automatically: End Time = Start Time + Duration
  const calculatedEndTime = useMemo(() => {
    if (!form.startsAt) return null;
    const duration = form.isCustomDuration ? form.customDuration : form.durationMinutes;
    if (!duration || duration <= 0) return null;
    try {
      const startsAtDate = parseISTDateTimeInput(form.startsAt);
      return calculateEndTime(startsAtDate, duration);
    } catch {
      return null;
    }
  }, [form.startsAt, form.durationMinutes, form.isCustomDuration, form.customDuration]);

  function resetForm() {
    setForm({
      title: "",
      subject: "",
      type: "LIVE_CLASS",
      status: "SCHEDULED",
      teacherId: "",
      startsAt: "",
      durationMinutes: 60,
      isCustomDuration: false,
      customDuration: 60,
      notes: "",
    });
    setEditingId(null);
    setShowForm(false);
    setError(null);
  }

  function startEdit(entry: ScheduleEntry) {
    const start = new Date(entry.startsAt);
    const end = new Date(entry.endsAt);
    const diffMins = Math.max(15, Math.round((end.getTime() - start.getTime()) / (1000 * 60)));
    const isCommon = COMMON_DURATIONS.some((d) => d.minutes === diffMins);

    setForm({
      title: entry.title,
      subject: entry.subject ?? "",
      type: entry.type,
      status: entry.status,
      teacherId: entry.teacherId ?? "",
      startsAt: toISTDateTimeLocal(entry.startsAt),
      durationMinutes: isCommon ? diffMins : 60,
      isCustomDuration: !isCommon,
      customDuration: diffMins,
      notes: entry.notes ?? "",
    });
    setEditingId(entry.id);
    setShowForm(true);
  }

  async function submit() {
    if (!form.title.trim()) {
      setError("Lecture title is required.");
      return;
    }
    if (!form.startsAt) {
      setError("Start date and time are required.");
      return;
    }
    const duration = form.isCustomDuration ? form.customDuration : form.durationMinutes;
    if (!duration || duration <= 0) {
      setError("Duration must be a positive number of minutes.");
      return;
    }
    if (!calculatedEndTime) {
      setError("Invalid start time or duration provided.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const url = editingId
        ? `/api/team/batches/${batchId}/schedule/${editingId}`
        : `/api/team/batches/${batchId}/schedule`;

      const startsAtDate = parseISTDateTimeInput(form.startsAt);
      const endsAtDate = calculatedEndTime;

      const payload = {
        title: form.title.trim(),
        subject: form.subject.trim() || undefined,
        type: form.type,
        ...(editingId ? { status: form.status } : {}),
        teacherId: form.teacherId || undefined,
        startsAt: startsAtDate.toISOString(),
        endsAt: endsAtDate.toISOString(),
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
      setError("Network connection error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Are you sure you want to delete this scheduled class?")) return;
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
    <div className="space-y-6">
      {/* Error Alert Box */}
      {error && (
        <div className="bg-error/10 border border-error/20 rounded-2xl p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-error text-xl shrink-0 mt-0.5">warning</span>
          <div className="space-y-0.5">
            <p className="font-bold text-xs text-error">Schedule Validation Error</p>
            <p className="text-xs text-on-surface leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* Timetable Entries List */}
      {schedules.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-outline-variant/30 rounded-2xl text-on-surface-variant text-xs">
          No timetable entries yet for this batch.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {schedules.map((s) => (
            <li
              key={s.id}
              className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-4 hover:border-primary/40 transition-all space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">
                    {TYPE_LABELS[s.type]}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-full ${STATUS_STYLES[s.status]}`}
                  >
                    {s.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {s.type === "LIVE_CLASS" && (
                    <Link
                      href={`/team/live-class/${s.id}`}
                      className="flex items-center gap-1 text-primary font-bold hover:underline"
                    >
                      <span className="material-symbols-outlined text-base">cast</span>
                      Start Class
                    </Link>
                  )}
                  <button type="button" onClick={() => startEdit(s)} className="text-primary font-bold hover:underline">
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => remove(s.id)}
                    className="text-error font-bold hover:underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="font-bold text-sm text-on-surface">{s.title}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                {s.subject && <span className="font-semibold text-primary">{s.subject} &middot;</span>}
                <span>
                  {formatISTDate(s.startsAt)} &middot;{" "}
                  {formatISTTime(s.startsAt)} →{" "}
                  {formatISTTime(s.endsAt)} (IST)
                </span>
                {s.teacher && <span className="font-medium bg-surface-container-high px-2 py-0.5 rounded">Faculty: {s.teacher.user.name}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Timetable Form & Duration Selector */}
      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="px-5 py-2.5 bg-primary text-on-primary font-bold text-xs rounded-xl shadow hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Schedule Lecture / Class
        </button>
      ) : (
        <div className="border border-outline-variant/30 bg-surface-container-high/20 rounded-3xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
            <h4 className="font-bold text-sm text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-base">calendar_clock</span>
              {editingId ? "Edit Lecture Timetable" : "Schedule New Lecture"}
            </h4>
            <span className="text-[11px] text-on-surface-variant font-mono">
              Auto End-Time &amp; Overlap Detection Enabled (IST)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface">Lecture Title *</label>
              <input
                className={inputClass}
                placeholder="e.g. Chemical Kinetics: Integrated Rate Equations"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface">Subject (optional)</label>
              <input
                className={inputClass}
                placeholder="e.g. Chemistry / Physics"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface">Session Type</label>
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
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface">Assigned Faculty (Teacher Overlap Checked)</label>
              <select
                className={inputClass}
                value={form.teacherId}
                onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
              >
                <option value="">No faculty assigned</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.user.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date & Time */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface">Start Date &amp; Time (IST) *</label>
              <input
                type="datetime-local"
                className={inputClass}
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              />
            </div>

            {/* Auto-Calculated End Time Display */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface">Calculated End Time (Automatic IST)</label>
              <div className="w-full rounded-xl border border-primary/30 bg-primary/5 py-2.5 px-3.5 text-xs text-primary font-bold flex items-center justify-between">
                <span>
                  {calculatedEndTime
                    ? `${formatISTTime(calculatedEndTime)} (${formatISTDate(calculatedEndTime)})`
                    : "Set Start Time & Duration"}
                </span>
                <span className="material-symbols-outlined text-sm text-primary">schedule</span>
              </div>
            </div>
          </div>

          {/* Flexible Duration Options */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-bold text-on-surface flex items-center justify-between">
              <span>Lecture Duration (Required) *</span>
              <span className="text-[11px] font-normal text-on-surface-variant">
                Current: {form.isCustomDuration ? `${form.customDuration} Mins` : `${form.durationMinutes} Mins`}
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              {COMMON_DURATIONS.map((d) => (
                <button
                  key={d.minutes}
                  type="button"
                  onClick={() => setForm({ ...form, durationMinutes: d.minutes, isCustomDuration: false })}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    !form.isCustomDuration && form.durationMinutes === d.minutes
                      ? "bg-primary text-on-primary shadow-sm"
                      : "bg-surface-container-lowest border border-outline-variant/30 text-on-surface hover:border-primary/50"
                  }`}
                >
                  {d.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setForm({ ...form, isCustomDuration: true })}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  form.isCustomDuration
                    ? "bg-primary text-on-primary shadow-sm"
                    : "bg-surface-container-lowest border border-outline-variant/30 text-on-surface hover:border-primary/50"
                }`}
              >
                Custom Mins
              </button>
            </div>

            {form.isCustomDuration && (
              <div className="flex items-center gap-2 max-w-xs pt-1">
                <input
                  type="number"
                  min="1"
                  max="480"
                  placeholder="Enter minutes (e.g. 100)"
                  value={form.customDuration}
                  onChange={(e) => setForm({ ...form, customDuration: parseInt(e.target.value) || 0 })}
                  className={inputClass}
                />
                <span className="text-xs text-on-surface-variant font-bold">Minutes</span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface">Notes / Instructions (optional)</label>
            <textarea
              rows={2}
              className={inputClass}
              placeholder="e.g. Bring NCERT Chapter 4 notes and formula sheet"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2 border-t border-outline-variant/20">
            <button
              type="button"
              disabled={submitting}
              onClick={submit}
              className="px-6 py-2.5 bg-primary text-on-primary font-bold text-xs rounded-xl shadow hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">save</span>
              {submitting ? "Validating & Saving..." : editingId ? "Save Changes" : "Confirm Schedule"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-5 py-2.5 rounded-xl border border-outline-variant/40 bg-surface text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
