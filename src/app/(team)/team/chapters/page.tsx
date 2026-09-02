import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import type { ChapterStatus } from "@prisma/client";

export const metadata: Metadata = {
  title: "Chapters",
};

const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-outline-variant/30 text-on-surface-variant",
  LECTURES_IN_PROGRESS: "bg-secondary-container text-on-secondary-container",
  LECTURES_COMPLETE: "bg-secondary-container text-on-secondary-container",
  TESTS_PENDING: "bg-primary-container text-on-primary-container",
  READY_TO_PUBLISH: "bg-primary-container text-on-primary-container",
  SUBMITTED: "bg-secondary-container text-on-secondary-container",
  UNDER_REVIEW: "bg-secondary-container text-on-secondary-container",
  APPROVED: "bg-tertiary-container text-on-tertiary-container",
  REJECTED: "bg-error-container text-on-error-container",
  CHANGES_REQUESTED: "bg-error-container text-on-error-container",
  PUBLISHED: "bg-tertiary-container text-on-tertiary-container",
  ARCHIVED: "bg-outline-variant/30 text-on-surface-variant",
};

export default async function ChaptersListPage({
  searchParams,
}: {
  searchParams: { subjectId?: string; courseId?: string; medium?: string; status?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.CHAPTER_READ);
  if (!canRead) redirect("/team");

  const canCreate = await hasPermission(session.user.id, PERMISSIONS.CHAPTER_CREATE);
  const canReview = await hasPermission(session.user.id, PERMISSIONS.CHAPTER_REVIEW);

  const whereClause: {
    subjectId?: string;
    subject?: { courseId: string };
    medium?: "HINDI" | "ENGLISH" | "HINGLISH";
    status?: ChapterStatus;
  } = {};

  if (searchParams.subjectId) {
    whereClause.subjectId = searchParams.subjectId;
  }
  if (searchParams.courseId) {
    whereClause.subject = { courseId: searchParams.courseId };
  }
  if (searchParams.medium && ["HINDI", "ENGLISH", "HINGLISH"].includes(searchParams.medium)) {
    whereClause.medium = searchParams.medium as "HINDI" | "ENGLISH" | "HINGLISH";
  }
  if (searchParams.status && searchParams.status in STATUS_TONE) {
    whereClause.status = searchParams.status as ChapterStatus;
  }

  const [chapters, courses, subjects, totalChapters] = await Promise.all([
    prisma.chapter.findMany({
      where: whereClause,
      include: {
        subject: { include: { course: true } },
        _count: { select: { lectures: true, dpps: true, tests: true } },
      },
      orderBy: [{ subjectId: "asc" }, { order: "asc" }],
    }),
    prisma.course.findMany({ orderBy: { title: "asc" } }),
    prisma.subject.findMany({ include: { course: true }, orderBy: { title: "asc" } }),
    prisma.chapter.count(),
  ]);

  return (
    <div className="space-y-stack-lg max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">Chapters</h1>
          <p className="text-on-surface-variant font-body-md mt-1">
            {totalChapters} chapter{totalChapters === 1 ? "" : "s"} total across academic programs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canReview && (
            <Link
              href="/team/chapters?status=UNDER_REVIEW"
              className="flex items-center gap-2 border border-primary/40 text-primary px-5 py-3 rounded-xl font-label-md hover:bg-primary/10 transition-all"
            >
              <span className="material-symbols-outlined">fact_check</span>
              Review Queue
            </Link>
          )}
          {canCreate && (
            <Link
              href="/team/chapters/new"
              className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-label-md shadow-lg hover:shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined">add_circle</span>
              Create Chapter
            </Link>
          )}
        </div>
      </div>

      <form className="glass-card p-4 rounded-xl flex flex-wrap items-center gap-3" method="get">
        <select
          name="courseId"
          defaultValue={searchParams.courseId ?? ""}
          className="bg-surface-container-low rounded-lg border border-outline-variant/30 px-3 py-2 text-label-md"
        >
          <option value="">All Courses / Exams</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>

        <select
          name="subjectId"
          defaultValue={searchParams.subjectId ?? ""}
          className="bg-surface-container-low rounded-lg border border-outline-variant/30 px-3 py-2 text-label-md"
        >
          <option value="">All Subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} ({s.course.title})
            </option>
          ))}
        </select>

        <select
          name="medium"
          defaultValue={searchParams.medium ?? ""}
          className="bg-surface-container-low rounded-lg border border-outline-variant/30 px-3 py-2 text-label-md"
        >
          <option value="">All Mediums</option>
          <option value="ENGLISH">English</option>
          <option value="HINDI">Hindi (हिंदी)</option>
          <option value="HINGLISH">Hinglish</option>
        </select>

        <select
          name="status"
          defaultValue={searchParams.status ?? ""}
          className="bg-surface-container-low rounded-lg border border-outline-variant/30 px-3 py-2 text-label-md"
        >
          <option value="">All Statuses</option>
          {Object.keys(STATUS_TONE).map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </select>

        <button type="submit" className="px-5 py-2 bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 transition-opacity">
          Filter
        </button>

        {(searchParams.courseId || searchParams.subjectId || searchParams.medium || searchParams.status) && (
          <Link href="/team/chapters" className="px-3 py-2 text-label-md text-on-surface-variant hover:text-primary">
            Reset
          </Link>
        )}
      </form>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low border-b border-outline-variant/30">
              <tr>
                <th className="px-6 py-4 font-label-md text-on-surface-variant">Chapter</th>
                <th className="px-6 py-4 font-label-md text-on-surface-variant">Subject / Course</th>
                <th className="px-6 py-4 font-label-md text-on-surface-variant">Medium</th>
                <th className="px-6 py-4 font-label-md text-on-surface-variant">Lectures / DPPs / Tests</th>
                <th className="px-6 py-4 font-label-md text-on-surface-variant">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {chapters.map((c) => (
                <tr key={c.id} className="hover:bg-surface-container-lowest/50 transition-colors group">
                  <td className="px-6 py-5 max-w-md">
                    <Link href={`/team/chapters/${c.id}`} className="font-label-md text-on-surface hover:text-primary">
                      {c.title}
                    </Link>
                    <p className="text-label-sm font-mono text-outline-variant">{c.chapterId ?? "—"}</p>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="font-label-md text-primary">{c.subject.title}</span>
                      <span className="text-label-sm text-on-surface-variant">{c.subject.course?.title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-label-sm">
                    <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface text-xs font-medium">
                      {c.medium === "HINDI" ? "Hindi" : c.medium === "HINGLISH" ? "Hinglish" : "English"}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-label-sm">
                    {c._count.lectures} / {c._count.dpps} / {c._count.tests}
                  </td>
                  <td className="px-6 py-5">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        STATUS_TONE[c.status] ?? "bg-outline-variant/30 text-on-surface-variant"
                      }`}
                    >
                      {c.status.replaceAll("_", " ")}
                    </span>
                  </td>
                </tr>
              ))}

              {chapters.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-on-surface-variant font-body-md">
                    No chapters match these filters yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
