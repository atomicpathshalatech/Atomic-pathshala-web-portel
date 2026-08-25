"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AssignedTeacher = {
  id: string;
  teacherId: string;
  subject: string | null;
  teacher: {
    employeeCode: string;
    department: string;
    user: { name: string };
  };
};

type TeacherOption = {
  id: string;
  employeeCode: string;
  department: string;
  user: { name: string };
};

export function BatchTeacherManager({
  batchId,
  assigned,
  allTeachers,
}: {
  batchId: string;
  assigned: AssignedTeacher[];
  allTeachers: TeacherOption[];
}) {
  const router = useRouter();
  const [teacherId, setTeacherId] = useState("");
  const [subject, setSubject] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function assign() {
    if (!teacherId) {
      setError("Select a teacher to assign.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/team/batches/${batchId}/teachers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId, subject: subject.trim() || undefined }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setError(body.error ?? "Could not assign this teacher.");
        return;
      }
      setTeacherId("");
      setSubject("");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(teacherIdToRemove: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/team/batches/${batchId}/teachers/${teacherIdToRemove}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setError(body.error ?? "Could not remove this teacher.");
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

      {assigned.length === 0 ? (
        <p className="text-label-sm text-on-surface-variant">No teachers assigned yet.</p>
      ) : (
        <ul className="space-y-2">
          {assigned.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 bg-surface-container-lowest rounded-lg px-3 py-2"
            >
              <div>
                <p className="font-label-md text-label-md text-on-surface">{a.teacher.user.name}</p>
                <p className="text-label-sm text-on-surface-variant">
                  {a.teacher.department} · {a.teacher.employeeCode}
                  {a.subject ? ` · ${a.subject}` : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => remove(a.teacherId)}
                className="text-error hover:underline text-label-sm font-label-sm disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-outline-variant/20">
        <select
          className="flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest py-2 px-3 text-body-md outline-none focus:ring-2 focus:ring-primary/30"
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
        >
          <option value="">Select a teacher...</option>
          {allTeachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.user.name} — {t.department} ({t.employeeCode})
            </option>
          ))}
        </select>
        <input
          className="w-full sm:w-40 rounded-lg border border-outline-variant bg-surface-container-lowest py-2 px-3 text-body-md outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="Subject (optional)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <button
          type="button"
          disabled={submitting}
          onClick={assign}
          className="bg-primary text-on-primary font-label-md text-label-md px-5 py-2 rounded-lg hover:opacity-90 disabled:opacity-60 whitespace-nowrap"
        >
          Assign
        </button>
      </div>
    </div>
  );
}
