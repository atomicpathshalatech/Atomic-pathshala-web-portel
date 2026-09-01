"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Enrollment = {
  id: string;
  studentId: string;
  status: "ACTIVE" | "COMPLETED" | "DROPPED";
  enrolledAt: string;
  student: {
    enrollmentNumber: string;
    class: string | null;
    targetExam: string | null;
    user: { name: string; email: string };
  };
};

type StudentOption = {
  id: string;
  enrollmentNumber: string;
  class: string | null;
  user: { name: string; email: string };
};

const STATUS_STYLES: Record<Enrollment["status"], string> = {
  ACTIVE: "bg-primary/10 text-primary",
  COMPLETED: "bg-secondary/10 text-secondary",
  DROPPED: "bg-error/10 text-error",
};

export function BatchEnrollmentManager({
  batchId,
  enrollments,
  allStudents,
}: {
  batchId: string;
  enrollments: Enrollment[];
  allStudents: StudentOption[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enrolledIds = useMemo(
    () => new Set(enrollments.filter((e) => e.status === "ACTIVE").map((e) => e.studentId)),
    [enrollments]
  );

  const filteredStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allStudents
      .filter((s) => !enrolledIds.has(s.id))
      .filter(
        (s) =>
          !q ||
          s.user.name.toLowerCase().includes(q) ||
          s.enrollmentNumber.toLowerCase().includes(q) ||
          s.user.email.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [allStudents, enrolledIds, query]);

  async function enroll() {
    if (!selectedStudentId) {
      setError("Search and select a student to enroll.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/team/batches/${batchId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: selectedStudentId }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setError(body.error ?? "Could not enroll this student.");
        return;
      }
      setSelectedStudentId("");
      setQuery("");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function changeStatus(studentId: string, status: Enrollment["status"]) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/team/batches/${batchId}/students/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setError(body.error ?? "Could not update enrollment status.");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeStudent(studentId: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/team/batches/${batchId}/students/${studentId}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setError(body.error ?? "Could not remove this student.");
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

      {enrollments.length === 0 ? (
        <p className="text-label-sm text-on-surface-variant">No students enrolled yet.</p>
      ) : (
        <ul className="space-y-2">
          {enrollments.map((e) => (
            <li
              key={e.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-surface-container-lowest rounded-lg px-3 py-2"
            >
              <div>
                <p className="font-label-md text-label-md text-on-surface">{e.student.user.name}</p>
                <p className="text-label-sm text-on-surface-variant">
                  {e.student.enrollmentNumber} · Class {e.student.class} · {e.student.targetExam}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${STATUS_STYLES[e.status]}`}>
                  {e.status}
                </span>
                <select
                  className="text-label-sm rounded-lg border border-outline-variant bg-surface py-1 px-2 outline-none"
                  value={e.status}
                  disabled={submitting}
                  onChange={(ev) => changeStatus(e.studentId, ev.target.value as Enrollment["status"])}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="DROPPED">Dropped</option>
                </select>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => removeStudent(e.studentId)}
                  className="text-error hover:underline text-label-sm font-label-sm disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="pt-2 border-t border-outline-variant/20 space-y-2">
        <input
          className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-2 px-3 text-body-md outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="Search by name, email, or enrollment number..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedStudentId("");
          }}
        />
        {query.trim() && (
          <div className="max-h-48 overflow-y-auto rounded-lg border border-outline-variant/40 divide-y divide-outline-variant/20">
            {filteredStudents.length === 0 ? (
              <p className="text-label-sm text-on-surface-variant px-3 py-2">No matching students.</p>
            ) : (
              filteredStudents.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => {
                    setSelectedStudentId(s.id);
                    setQuery(`${s.user.name} (${s.enrollmentNumber})`);
                  }}
                  className={`w-full text-left px-3 py-2 text-label-sm hover:bg-primary/5 ${
                    selectedStudentId === s.id ? "bg-primary/10" : ""
                  }`}
                >
                  {s.user.name} — {s.enrollmentNumber} — {s.user.email}
                </button>
              ))
            )}
          </div>
        )}
        <button
          type="button"
          disabled={submitting || !selectedStudentId}
          onClick={enroll}
          className="bg-primary text-on-primary font-label-md text-label-md px-5 py-2 rounded-lg hover:opacity-90 disabled:opacity-60"
        >
          Enroll Selected Student
        </button>
      </div>
    </div>
  );
}
