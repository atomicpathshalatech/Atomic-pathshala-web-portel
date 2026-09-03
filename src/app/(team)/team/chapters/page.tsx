import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { Prisma, type ChapterStatus } from "@prisma/client";

export const metadata: Metadata = {
  title: "Chapters",
};

const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300",
  LECTURES_IN_PROGRESS: "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-500/20",
  LECTURES_COMPLETE: "bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20",
  TESTS_PENDING: "bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 border border-purple-500/20",
  READY_TO_PUBLISH: "bg-cyan-50 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20",
  SUBMITTED: "bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-500/30",
  UNDER_REVIEW: "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/40 animate-pulse",
  APPROVED: "bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold",
  REJECTED: "bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border border-rose-500/20",
  CHANGES_REQUESTED: "bg-orange-50 dark:bg-orange-950 text-orange-600 dark:text-orange-400 border border-orange-500/20",
  PUBLISHED: "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold",
  ARCHIVED: "bg-slate-100 dark:bg-slate-800 text-slate-500",
};

export default async function ChaptersListPage({
  searchParams,
}: {
  searchParams: {
    subjectId?: string;
    courseId?: string;
    course?: string;
    subject?: string;
    medium?: string;
    status?: string;
  };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.CHAPTER_READ);
  if (!canRead) redirect("/team");

  const canCreate = await hasPermission(session.user.id, PERMISSIONS.CHAPTER_CREATE);
  const canReview = await hasPermission(session.user.id, PERMISSIONS.CHAPTER_REVIEW);

  const whereClause: Prisma.ChapterWhereInput = {};

  const selectedCourse = searchParams.course || searchParams.courseId;
  const selectedSubject = searchParams.subject || searchParams.subjectId;

  if (selectedCourse) {
    if (selectedCourse === "Class 11th (NEET)") {
      whereClause.subject = {
        course: {
          OR: [
            { title: { contains: "11", mode: "insensitive" } },
            { title: { contains: "Class 11", mode: "insensitive" } },
          ],
        },
      };
    } else if (selectedCourse === "Class 12th (NEET)") {
      whereClause.subject = {
        course: {
          OR: [
            { title: { contains: "12", mode: "insensitive" } },
            { title: { contains: "Class 12", mode: "insensitive" } },
          ],
        },
      };
    } else if (selectedCourse === "NEET Dropper") {
      whereClause.subject = {
        course: {
          OR: [
            { title: { contains: "Dropper", mode: "insensitive" } },
            { title: { contains: "Repeater", mode: "insensitive" } },
          ],
        },
      };
    } else if (selectedCourse === "Foundation (Class 9th & 10th)") {
      whereClause.subject = {
        course: {
          OR: [
            { title: { contains: "Foundation", mode: "insensitive" } },
            { title: { contains: "9", mode: "insensitive" } },
            { title: { contains: "10", mode: "insensitive" } },
          ],
        },
      };
    } else if (selectedCourse === "JEE Main + Advanced") {
      whereClause.subject = {
        course: {
          OR: [
            { title: { contains: "JEE", mode: "insensitive" } },
            { title: { contains: "Engineering", mode: "insensitive" } },
          ],
        },
      };
    } else {
      whereClause.subject = {
        OR: [
          { courseId: selectedCourse },
          { course: { title: { contains: selectedCourse, mode: "insensitive" } } },
        ],
      };
    }
  }

  if (selectedSubject) {
    if (selectedSubject === "Physics") {
      whereClause.subject = {
        ...(whereClause.subject || {}),
        title: { contains: "Physics", mode: "insensitive" },
      };
    } else if (selectedSubject === "Chemistry") {
      whereClause.subject = {
        ...(whereClause.subject || {}),
        OR: [
          { title: { contains: "Chem", mode: "insensitive" } },
          { title: { in: ["Chemistry", "Organic Chemistry", "Inorganic Chemistry", "Physical Chemistry"] } },
        ],
      };
    } else if (selectedSubject === "Biology") {
      whereClause.subject = {
        ...(whereClause.subject || {}),
        OR: [
          { title: { contains: "Bio", mode: "insensitive" } },
          { title: { contains: "Botan", mode: "insensitive" } },
          { title: { contains: "Zool", mode: "insensitive" } },
          { title: { in: ["Biology", "Botany", "Zoology"] } },
        ],
      };
    } else if (selectedSubject === "Mathematics") {
      whereClause.subject = {
        ...(whereClause.subject || {}),
        title: { contains: "Math", mode: "insensitive" },
      };
    } else if (selectedSubject === "Science") {
      whereClause.subject = {
        ...(whereClause.subject || {}),
        title: { contains: "Science", mode: "insensitive" },
      };
    } else {
      whereClause.subjectId = selectedSubject;
    }
  }
  if (searchParams.medium && ["HINDI", "ENGLISH", "HINGLISH"].includes(searchParams.medium)) {
    whereClause.medium = searchParams.medium as "HINDI" | "ENGLISH" | "HINGLISH";
  }
  if (searchParams.status && searchParams.status in STATUS_TONE) {
    whereClause.status = searchParams.status as ChapterStatus;
  }

  const [chapters, totalChapters, underReviewCount, approvedCount] = await Promise.all([
    prisma.chapter.findMany({
      where: whereClause,
      include: {
        subject: { include: { course: true } },
        _count: { select: { lectures: true, dpps: true, tests: true } },
        lectures: {
          take: 1,
          orderBy: { order: "asc" },
          include: { teacher: { include: { user: { select: { name: true } } } } },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { subjectId: "asc" }, { order: "asc" }],
    }),
    prisma.chapter.count(),
    prisma.chapter.count({ where: { status: "UNDER_REVIEW" } }),
    prisma.chapter.count({ where: { status: { in: ["APPROVED", "PUBLISHED"] } } }),
  ]);

  const activeTab = searchParams.status || "ALL";

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Chapters Master</h1>
          <p className="text-xs text-slate-500 mt-1">
            Author curriculum roadmaps, manage weekly schedules, and review chapters for batch timetable import.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canCreate && (
            <Link
              href="/team/chapters/new"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-2xl text-xs font-bold shadow-lg shadow-blue-600/20 transition active:scale-95"
            >
              <span className="material-symbols-outlined text-base">add_circle</span>
              <span>Create Chapter</span>
            </Link>
          )}
        </div>
      </div>

      {/* Admin Review Queue & Status Folder Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
        <Link
          href="/team/chapters"
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === "ALL"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
              : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-blue-500"
          }`}
        >
          <span>All Chapters</span>
          <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">{totalChapters}</span>
        </Link>

        {canReview && (
          <Link
            href="/team/chapters?status=UNDER_REVIEW"
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === "UNDER_REVIEW"
                ? "bg-amber-500 text-black shadow-md shadow-amber-500/20 font-black"
                : "bg-white dark:bg-slate-900 border border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
            }`}
          >
            <span className="material-symbols-outlined text-sm">fact_check</span>
            <span>Review &amp; Verification Queue</span>
            {underReviewCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-black animate-pulse">
                {underReviewCount} Pending
              </span>
            )}
          </Link>
        )}

        <Link
          href="/team/chapters?status=APPROVED"
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === "APPROVED" || activeTab === "PUBLISHED"
              ? "bg-emerald-600 text-white shadow-md"
              : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-emerald-500"
          }`}
        >
          <span className="material-symbols-outlined text-sm">verified</span>
          <span>Approved &amp; Ready for Batch</span>
          <span className="px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20 text-[10px]">{approvedCount}</span>
        </Link>
      </div>

      {/* Filter Toolbar with Exact Requested Course & Subject Options */}
      <form className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl flex flex-wrap items-center gap-3" method="get">
        {/* Course / Exam Dropdown */}
        <select
          name="course"
          defaultValue={selectedCourse ?? ""}
          className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500"
        >
          <option value="">All Courses / Exams</option>
          <option value="Class 11th (NEET)">Class 11th (NEET)</option>
          <option value="Class 12th (NEET)">Class 12th (NEET)</option>
          <option value="NEET Dropper">NEET Dropper</option>
          <option value="Foundation (Class 9th & 10th)">Foundation (Class 9th & 10th)</option>
          <option value="JEE Main + Advanced">JEE Main + Advanced</option>
        </select>

        {/* Subject Dropdown */}
        <select
          name="subject"
          defaultValue={selectedSubject ?? ""}
          className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500"
        >
          <option value="">All Subjects</option>
          <option value="Physics">Physics</option>
          <option value="Chemistry">Chemistry</option>
          <option value="Biology">Biology</option>
          <option value="Mathematics">Mathematics</option>
          <option value="Science">Science</option>
        </select>

        <select
          name="medium"
          defaultValue={searchParams.medium ?? ""}
          className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500"
        >
          <option value="">All Mediums</option>
          <option value="ENGLISH">English</option>
          <option value="HINDI">Hindi (हिंदी)</option>
          <option value="HINGLISH">Hinglish</option>
        </select>

        {activeTab !== "UNDER_REVIEW" && activeTab !== "APPROVED" && (
          <select
            name="status"
            defaultValue={searchParams.status ?? ""}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            {Object.keys(STATUS_TONE).map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        )}

        <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition">
          Apply Filter
        </button>

        {(searchParams.course || searchParams.courseId || searchParams.subject || searchParams.subjectId || searchParams.medium || searchParams.status) && (
          <Link href="/team/chapters" className="px-3 py-2 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white font-medium">
            Reset
          </Link>
        )}
      </form>

      {/* Chapters Table List */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-4">Chapter Title &amp; Faculty</th>
                <th className="px-6 py-4">Subject &amp; Exam</th>
                <th className="px-6 py-4">Medium</th>
                <th className="px-6 py-4">Content Roadmap</th>
                <th className="px-6 py-4">Review Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {chapters.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-700 block mb-2">
                      menu_book
                    </span>
                    No chapters found matching this filter.
                  </td>
                </tr>
              ) : (
                chapters.map((ch) => {
                  const facultyName =
                    ch.lectures[0]?.teacher?.user?.name || "Faculty Assigned";

                  return (
                    <tr key={ch.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="px-6 py-4">
                        <Link href={`/team/chapters/${ch.id}`} className="block group">
                          <p className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition">
                            {ch.title}
                          </p>
                          <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span className="material-symbols-outlined text-xs text-blue-500">person</span>
                            <span>{facultyName}</span>
                            <span>•</span>
                            <span className="font-mono text-[10px]">ID: {ch.id.slice(0, 8)}</span>
                          </p>
                        </Link>
                      </td>

                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-800 dark:text-slate-200">{ch.subject.title}</p>
                        <p className="text-[11px] text-slate-400">{ch.subject.course.title}</p>
                      </td>

                      <td className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">
                        {ch.medium}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold">
                            {ch._count.lectures} Lecs
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 font-bold">
                            {ch._count.dpps} DPPs
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-bold">
                            {ch._count.tests} Tests
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block ${STATUS_TONE[ch.status] || ""}`}>
                          {ch.status.replaceAll("_", " ")}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        {ch.status === "UNDER_REVIEW" && canReview ? (
                          <Link
                            href={`/team/chapters/${ch.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-md transition"
                          >
                            <span className="material-symbols-outlined text-xs">fact_check</span>
                            <span>Review &amp; Accept</span>
                          </Link>
                        ) : (
                          <Link
                            href={`/team/chapters/${ch.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-600 hover:text-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs transition"
                          >
                            <span>Open Studio</span>
                            <span className="material-symbols-outlined text-xs">arrow_forward</span>
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
