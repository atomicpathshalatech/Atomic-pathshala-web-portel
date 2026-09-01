"use client";

import { useState } from "react";
import Link from "next/link";
import { ChapterImportModal } from "./ChapterImportModal";
import { BatchTeacherManager } from "./BatchTeacherManager";
import { BatchEnrollmentManager } from "./BatchEnrollmentManager";
import { BatchScheduleManager } from "./BatchScheduleManager";

type BatchDetailClientProps = {
  batch: {
    id: string;
    name: string;
    code: string;
    description: string | null;
    targetExam: string | null;
    status: string;
    startDate: string | null;
    endDate: string | null;
    capacity: number | null;
    course: { id: string; title: string } | null;
  };
  teachers: Array<{
    id: string;
    teacherId: string;
    subject: string | null;
    teacher: {
      employeeCode: string;
      department: string;
      user: { name: string };
    };
  }>;
  enrollments: Array<{
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
  }>;
  schedules: Array<{
    id: string;
    title: string;
    subject: string | null;
    type: "LIVE_CLASS" | "TEST" | "DPP" | "DOUBT_SESSION" | "OTHER";
    status: "SCHEDULED" | "LIVE" | "COMPLETED" | "CANCELLED";
    startsAt: string;
    endsAt: string;
    notes: string | null;
    teacherId: string | null;
    teacher: { user: { name: string } } | null;
  }>;
  allTeachers: Array<{ id: string; employeeCode: string; department: string; user: { name: string } }>;
  allStudents: Array<{ id: string; enrollmentNumber: string; class: string | null; user: { name: string; email: string } }>;
  canUpdate: boolean;
  canManageEnrollment: boolean;
  canManageSchedule: boolean;
};

const STATUS_STYLES: Record<string, string> = {
  UPCOMING: "bg-secondary/10 text-secondary border border-secondary/20",
  ACTIVE: "bg-primary/10 text-primary border border-primary/20",
  COMPLETED: "bg-outline-variant/30 text-on-surface-variant",
  ARCHIVED: "bg-outline-variant/30 text-on-surface-variant",
};

export function BatchDetailClient({
  batch,
  teachers,
  enrollments,
  schedules,
  allTeachers,
  allStudents,
  canUpdate,
  canManageEnrollment,
  canManageSchedule,
}: BatchDetailClientProps) {
  const [showImportModal, setShowImportModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"flow" | "timetable" | "teachers" | "students">("flow");

  // Derive imported chapters from schedules
  const uniqueSubjects = Array.from(new Set(schedules.map((s) => s.subject || "General")));

  const activeEnrollmentsCount = enrollments.filter((e) => e.status === "ACTIVE").length;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-outline-variant/20 pb-6">
        <div>
          <p className="flex items-center gap-2 text-xs text-on-surface-variant mb-1">
            <Link href="/team/batches" className="hover:text-primary transition-colors">
              Batches
            </Link>
            <span className="material-symbols-outlined text-xs">chevron_right</span>
            <span className="font-mono font-bold text-primary">{batch.code}</span>
          </p>
          <h1 className="font-headline-lg text-headline-lg md:text-3xl font-bold text-on-surface">
            {batch.name}
          </h1>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span
              className={`text-[10px] font-bold uppercase tracking-wide px-3 py-1 rounded-full ${
                STATUS_STYLES[batch.status] ?? "bg-surface-container-high text-on-surface-variant"
              }`}
            >
              {batch.status}
            </span>
            {batch.targetExam && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-surface-container-high text-on-surface">
                {batch.targetExam}
              </span>
            )}
            {batch.course && (
              <span className="text-xs text-on-surface-variant">· {batch.course.title}</span>
            )}
            <span className="text-xs text-on-surface-variant font-mono">
              · {activeEnrollmentsCount} / {batch.capacity ?? "Unlimited"} Students
            </span>
          </div>

          {batch.description && (
            <p className="text-xs text-on-surface-variant mt-3 max-w-2xl leading-relaxed">
              {batch.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {canManageSchedule && (
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs shadow-lg hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">download_for_offline</span>
              Import Master Chapter
            </button>
          )}
          {canUpdate && (
            <Link
              href={`/team/batches/${batch.id}/edit`}
              className="px-4 py-2.5 rounded-xl border border-outline-variant/40 bg-surface text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">edit</span>
              Edit Batch
            </Link>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-outline-variant/20 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("flow")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "flow"
              ? "bg-primary text-on-primary shadow-sm"
              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
          }`}
        >
          <span className="material-symbols-outlined text-base">account_tree</span>
          Course Flow &amp; Chapters
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("timetable")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "timetable"
              ? "bg-primary text-on-primary shadow-sm"
              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
          }`}
        >
          <span className="material-symbols-outlined text-base">calendar_month</span>
          Timetable ({schedules.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("teachers")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "teachers"
              ? "bg-primary text-on-primary shadow-sm"
              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
          }`}
        >
          <span className="material-symbols-outlined text-base">school</span>
          Faculty ({teachers.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("students")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "students"
              ? "bg-primary text-on-primary shadow-sm"
              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
          }`}
        >
          <span className="material-symbols-outlined text-base">groups</span>
          Students ({activeEnrollmentsCount})
        </button>
      </div>

      {/* Tab 1: Course Flow & Imported Master Chapters */}
      {activeTab === "flow" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-headline-md text-headline-md font-bold text-on-surface">
                Academic Course Flow &amp; Master Content
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Master chapters imported into this batch with zero duplicate content architecture.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="text-primary text-xs font-bold hover:underline flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">add_circle</span>
              Import Another Chapter
            </button>
          </div>

          {schedules.length === 0 ? (
            <div className="glass-card rounded-3xl p-12 text-center text-on-surface-variant space-y-3 border border-dashed border-outline-variant/30">
              <span className="material-symbols-outlined text-4xl text-primary opacity-60">download_for_offline</span>
              <h4 className="font-bold text-sm text-on-surface">No Master Chapters Imported Yet</h4>
              <p className="text-xs text-on-surface-variant max-w-md mx-auto">
                Click &quot;Import Master Chapter&quot; above to link centralized chapter lectures, DPPs, and test series into this batch.
              </p>
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="px-6 py-2.5 bg-primary text-on-primary font-bold text-xs rounded-xl shadow hover:opacity-90 transition-all inline-flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                Import Chapter Now
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {uniqueSubjects.map((subjectName) => {
                const subjectSchedules = schedules.filter((s) => (s.subject || "General") === subjectName);
                return (
                  <div
                    key={subjectName}
                    className="glass-card rounded-3xl p-6 border border-outline-variant/30 space-y-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                          {subjectName[0]}
                        </span>
                        <h4 className="font-bold text-sm text-on-surface">{subjectName}</h4>
                      </div>
                      <span className="text-xs text-on-surface-variant font-mono">
                        {subjectSchedules.length} Scheduled Sessions
                      </span>
                    </div>

                    <div className="space-y-2">
                      {subjectSchedules.map((s, idx) => (
                        <div
                          key={s.id}
                          className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 flex items-center justify-between text-xs"
                        >
                          <div className="space-y-0.5 min-w-0 pr-4">
                            <p className="font-bold text-on-surface truncate">{s.title}</p>
                            <p className="text-[11px] text-on-surface-variant">
                              {new Date(s.startsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} &middot;{" "}
                              {new Date(s.startsAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })} →{" "}
                              {new Date(s.endsAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })}
                              {s.teacher ? ` · Faculty: ${s.teacher.user.name}` : ""}
                            </p>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary uppercase shrink-0">
                            {s.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Timetable & Schedule */}
      {activeTab === "timetable" && (
        <section className="glass-card rounded-3xl p-6 md:p-8 border border-outline-variant/30 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-headline-md text-headline-md font-bold text-on-surface">
                Batch Timetable &amp; Live Sessions
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Every lecture has required duration, auto-calculated end time, and strict batch/faculty overlap validation.
              </p>
            </div>
          </div>

          <BatchScheduleManager
            batchId={batch.id}
            schedules={schedules}
            teachers={teachers.map((t) => ({
              id: t.teacherId,
              user: { name: t.teacher.user.name },
            }))}
          />
        </section>
      )}

      {/* Tab 3: Faculty Management */}
      {activeTab === "teachers" && (
        <section className="glass-card rounded-3xl p-6 md:p-8 border border-outline-variant/30 space-y-6">
          <div>
            <h3 className="font-headline-md text-headline-md font-bold text-on-surface">
              Assigned Faculty Team
            </h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Subject-wise educator mapping for this batch program.
            </p>
          </div>

          {canUpdate ? (
            <BatchTeacherManager
              batchId={batch.id}
              assigned={teachers.map((t) => ({
                id: t.id,
                teacherId: t.teacherId,
                subject: t.subject,
                teacher: {
                  employeeCode: t.teacher.employeeCode,
                  department: t.teacher.department,
                  user: { name: t.teacher.user.name },
                },
              }))}
              allTeachers={allTeachers}
            />
          ) : (
            <ul className="space-y-2">
              {teachers.map((t) => (
                <li key={t.id} className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/20">
                  <p className="font-bold text-sm text-on-surface">{t.teacher.user.name}</p>
                  <p className="text-xs text-on-surface-variant">
                    {t.teacher.department} · {t.teacher.employeeCode}
                    {t.subject ? ` · Subject: ${t.subject}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Tab 4: Students Management */}
      {activeTab === "students" && (
        <section className="glass-card rounded-3xl p-6 md:p-8 border border-outline-variant/30 space-y-6">
          <div>
            <h3 className="font-headline-md text-headline-md font-bold text-on-surface">
              Enrolled Students ({activeEnrollmentsCount})
            </h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Manage cohort access, active enrollments, and capacity limits.
            </p>
          </div>

          {canManageEnrollment ? (
            <BatchEnrollmentManager
              batchId={batch.id}
              enrollments={enrollments}
              allStudents={allStudents}
            />
          ) : (
            <ul className="space-y-2">
              {enrollments.map((e) => (
                <li key={e.id} className="bg-surface-container-lowest rounded-xl p-3 border border-outline-variant/20">
                  <p className="font-bold text-xs text-on-surface">{e.student.user.name}</p>
                  <p className="text-[11px] text-on-surface-variant">{e.student.enrollmentNumber} · {e.status}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Chapter Import Modal Dialog */}
      {showImportModal && (
        <ChapterImportModal
          batchId={batch.id}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </div>
  );
}
