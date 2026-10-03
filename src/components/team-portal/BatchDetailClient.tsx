"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChapterImportModal } from "./ChapterImportModal";
import { BatchTeacherManager } from "./BatchTeacherManager";
import { BatchEnrollmentManager } from "./BatchEnrollmentManager";
import { BatchScheduleManager } from "./BatchScheduleManager";
import { BatchFolderManager } from "./BatchFolderManager";
import {
  BatchPdfLibrary,
  type ClassNoteEntry,
  type DppEntry,
  type TestEntry,
} from "./BatchPdfLibrary";
import { BatchNotificationManager } from "./BatchNotificationManager";
import { BatchTestSeriesManager } from "./BatchTestSeriesManager";
import { BatchContentBoard } from "./BatchContentBoard";
import { BOX, BOX_GRID, FacultyCardBody } from "./batch-ui";
import { HorizontalScheduleCalendar, type ScheduleItem } from "@/components/schedule/HorizontalScheduleCalendar";
import { BatchSchedulePdfs } from "./BatchSchedulePdfs";
import { cleanBatchName, formatDescriptionText } from "@/lib/academic/canonical-courses";

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
    liveWhiteboardSession?: {
      id?: string;
      status?: string;
      livePhase?: string;
      actualStartedAt?: string | null;
      actualEndedAt?: string | null;
      videoTransport?: string | null;
      youtubeVideoId?: string | null;
    } | null;
    lectureYoutubeId?: string | null;
    /** Set when this schedule was created by importing a master chapter. */
    chapter: {
      id: string;
      chapterId: string | null;
      title: string;
      status: string;
      subjectTitle: string | null;
      lectureCount: number;
      dppCount: number;
      testCount: number;
    } | null;
  }>;
  /** This batch's classes, in the shape of the app-wide schedule calendar. */
  calendarSchedules: ScheduleItem[];
  /** Collected material for the All PDFs tab — see BatchPdfLibrary. */
  classNotes: ClassNoteEntry[];
  dpps: DppEntry[];
  tests: TestEntry[];
  allTeachers: Array<{ id: string; employeeCode: string; department: string; user: { name: string } }>;
  allStudents: Array<{ id: string; enrollmentNumber: string; class: string | null; user: { name: string; email: string } }>;
  canUpdate: boolean;
  canManageEnrollment: boolean;
  canManageSchedule: boolean;
  isSuperAdmin?: boolean;
  /** Active students in the batch (the list itself is only sent to those who manage enrolments). */
  activeStudentCount?: number;
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
  calendarSchedules,
  classNotes,
  dpps,
  tests,
  allTeachers,
  allStudents,
  canUpdate,
  canManageEnrollment,
  canManageSchedule,
  isSuperAdmin = false,
  activeStudentCount,
}: BatchDetailClientProps) {
  const searchParams = useSearchParams();
  const VALID_TABS = ["flow", "pdfs", "materials", "timetable", "test-series", "teachers", "students", "notifications"] as const;
  const requestedTab = searchParams.get("tab");
  const initialTab = (VALID_TABS as readonly string[]).includes(requestedTab || "")
    ? (requestedTab as (typeof VALID_TABS)[number])
    : "flow";

  const [showImportModal, setShowImportModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"flow" | "pdfs" | "materials" | "timetable" | "test-series" | "teachers" | "students" | "notifications">(initialTab);
  const [blockedBannerDismissed, setBlockedBannerDismissed] = useState(false);
  const blockedReason =
    searchParams.get("blocked") === "1"
      ? searchParams.get("reason") || "That class isn't accessible right now."
      : null;

  /**
   * The chapters actually imported into this batch, de-duplicated.
   *
   * A batch has no direct link to a chapter — importing a master chapter
   * creates one schedule per session, all pointing at the same chapter. So
   * the same chapter appears many times in `schedules` and has to be
   * collapsed here, carrying its session count along.
   */
  const importedChapters = (() => {
    const byId = new Map<
      string,
      {
        id: string;
        chapterId: string | null;
        title: string;
        status: string;
        subjectTitle: string;
        lectureCount: number;
        dppCount: number;
        testCount: number;
        sessionCount: number;
      }
    >();

    for (const s of schedules) {
      if (!s.chapter) continue;
      const existing = byId.get(s.chapter.id);
      if (existing) {
        existing.sessionCount += 1;
        continue;
      }
      byId.set(s.chapter.id, {
        id: s.chapter.id,
        chapterId: s.chapter.chapterId,
        title: s.chapter.title,
        status: s.chapter.status,
        // Prefer the chapter's own subject; fall back to whatever the
        // schedule row recorded, which is free text.
        subjectTitle: s.chapter.subjectTitle || s.subject || "General",
        lectureCount: s.chapter.lectureCount,
        dppCount: s.chapter.dppCount,
        testCount: s.chapter.testCount,
        sessionCount: 1,
      });
    }

    return Array.from(byId.values());
  })();

  const activeEnrollmentsCount = activeStudentCount ?? enrollments.filter((e) => e.status === "ACTIVE").length;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {blockedReason && !blockedBannerDismissed && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 px-4 py-3 text-xs sm:text-sm text-amber-800 dark:text-amber-200">
          <span className="material-symbols-outlined text-base mt-0.5">info</span>
          <p className="flex-1">{blockedReason}</p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setBlockedBannerDismissed(true)}
            className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-100"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}
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
            {cleanBatchName(batch.name)}
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
                {cleanBatchName(batch.targetExam)}
              </span>
            )}
            {batch.course && (
              <span className="text-xs text-on-surface-variant">· {cleanBatchName(batch.course.title)}</span>
            )}
            <span className="text-xs text-on-surface-variant font-mono">
              · {activeEnrollmentsCount} / {batch.capacity ?? "Unlimited"} Students
            </span>
          </div>

          {batch.description && (
            <p className="text-xs text-on-surface-variant mt-3 max-w-3xl leading-relaxed whitespace-pre-line break-words">
              {formatDescriptionText(batch.description)}
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
          Content ({importedChapters.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("pdfs")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "pdfs"
              ? "bg-primary text-on-primary shadow-sm"
              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
          }`}
        >
          <span className="material-symbols-outlined text-base">picture_as_pdf</span>
          All PDFs ({classNotes.length + dpps.length + tests.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("materials")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "materials"
              ? "bg-primary text-on-primary shadow-sm"
              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
          }`}
        >
          <span className="material-symbols-outlined text-base">folder</span>
          Syllabus &amp; Schedule
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
          Schedule ({schedules.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("test-series")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "test-series"
              ? "bg-primary text-on-primary shadow-sm"
              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
          }`}
        >
          <span className="material-symbols-outlined text-base">quiz</span>
          Test Series
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
        <button
          type="button"
          onClick={() => setActiveTab("notifications")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "notifications"
              ? "bg-primary text-on-primary shadow-sm"
              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
          }`}
        >
          <span className="material-symbols-outlined text-base">campaign</span>
          Notifications
        </button>
      </div>

      {/* Tab 1: Content — master chapters imported into this batch */}
      {activeTab === "flow" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-headline-md text-headline-md font-bold text-on-surface">
                Batch Content
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Master chapters imported into this batch. Lectures, DPPs and tests stay on the
                chapter — nothing is duplicated per batch.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="text-primary text-xs font-bold hover:underline flex items-center gap-1 min-h-11"
            >
              <span className="material-symbols-outlined text-sm">add_circle</span>
              Import Another Chapter
            </button>
          </div>

          {importedChapters.length === 0 ? (
            <div className="glass-card rounded-3xl p-8 sm:p-12 text-center text-on-surface-variant space-y-3 border border-dashed border-outline-variant/30">
              <span className="material-symbols-outlined text-4xl text-primary opacity-60">download_for_offline</span>
              <h4 className="font-bold text-sm text-on-surface">No Chapters Imported Yet</h4>
              <p className="text-xs text-on-surface-variant max-w-md mx-auto">
                {schedules.length > 0
                  ? "This batch has sessions on its Schedule, but none of them are linked to a master chapter yet."
                  : "Import a master chapter to bring its lectures, DPPs and tests into this batch."}
              </p>
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="px-6 py-2.5 min-h-11 bg-primary text-on-primary font-bold text-xs rounded-xl shadow hover:opacity-90 transition-all inline-flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                Import Chapter Now
              </button>
            </div>
          ) : (
            <BatchContentBoard chapters={importedChapters} />
          )}
        </div>
      )}

      {/* Tab 2: All PDFs */}
      {activeTab === "pdfs" && (
        <BatchPdfLibrary classNotes={classNotes} dpps={dpps} tests={tests} />
      )}

      {/* Tab 3: Syllabus & Schedule folders */}
      {activeTab === "materials" && (
        <div className="space-y-6">
          <BatchSchedulePdfs batchId={batch.id} schedules={schedules} />
          <BatchFolderManager batchId={batch.id} canDelete={isSuperAdmin} />
        </div>
      )}

      {/* Tab 4: Schedule — the same calendar as the app-wide schedule, limited to this batch */}
      {activeTab === "timetable" && (
        <div className="space-y-6">
          <HorizontalScheduleCalendar
            schedules={calendarSchedules}
            batches={[{ id: batch.id, name: cleanBatchName(batch.name), code: batch.code }]}
            role="TEACHER"
            title="Batch Schedule"
            subtitle={`Only this batch · ${calendarSchedules.length} class${calendarSchedules.length === 1 ? "" : "es"}`}
          />

          {canManageSchedule && (
            <details className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 group" open={false}>
              <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  <span className="material-symbols-outlined text-base text-blue-600">edit_calendar</span>
                  Manage timetable — add, edit or delete a class
                </span>
                <span className="material-symbols-outlined text-slate-400 transition-transform group-open:rotate-180">expand_more</span>
              </summary>
              <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800">
                <BatchScheduleManager
                  batchId={batch.id}
                  schedules={schedules}
                  teachers={teachers.map((t) => ({
                    id: t.teacherId,
                    user: { name: t.teacher.user.name },
                  }))}
                  canManageSchedule={canManageSchedule}
                />
              </div>
            </details>
          )}
        </div>
      )}

      {/* Tab: Test Series Management */}
      {activeTab === "test-series" && (
        <BatchTestSeriesManager
          batchId={batch.id}
          batchName={batch.name}
          canManage={canUpdate}
        />
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
            <ul className={BOX_GRID}>
              {teachers.map((t) => (
                <li key={t.id} className={BOX}>
                  <FacultyCardBody name={t.teacher.user.name} department={t.teacher.department} code={t.teacher.employeeCode} subject={t.subject} />
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
            {canManageEnrollment && (
              <p className="text-xs text-on-surface-variant mt-0.5">
                Manage cohort access, active enrollments, and capacity limits.
              </p>
            )}
          </div>

          {canManageEnrollment ? (
            <BatchEnrollmentManager
              batchId={batch.id}
              enrollments={enrollments}
              allStudents={allStudents}
            />
          ) : (
            // Teachers see how many students the batch has — not who they are.
            <div className="flex items-center gap-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 max-w-sm">
              <span className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl">groups</span>
              </span>
              <div>
                <p className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">{activeEnrollmentsCount}</p>
                <p className="text-xs text-slate-500">
                  students in this batch{batch.capacity ? ` · capacity ${batch.capacity}` : ""}
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Tab 7: Notifications */}
      {activeTab === "notifications" && (
        <BatchNotificationManager
          batchId={batch.id}
          batchName={batch.name}
          canSend={canUpdate}
        />
      )}

      {/* Chapter Import Modal Dialog */}
      {showImportModal && (
        <ChapterImportModal
          batchId={batch.id}
          existingChapterIds={importedChapters.map((c) => c.id)}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </div>
  );
}
