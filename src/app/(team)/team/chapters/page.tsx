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
  title: "Chapters Master & Subject Curriculum",
};

const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300",
  LECTURES_IN_PROGRESS: "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-500/20",
  LECTURES_COMPLETE: "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-500/20",
  TESTS_PENDING: "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-500/20",
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

  const andConditions: Prisma.ChapterWhereInput[] = [];

  const selectedCourse = searchParams.course || searchParams.courseId;
  const selectedSubject = searchParams.subject || searchParams.subjectId;

  if (selectedCourse) {
    if (selectedCourse === "Class 11th (NEET)") {
      andConditions.push({
        subject: {
          course: {
            OR: [
              { title: { contains: "11", mode: "insensitive" } },
              { title: { contains: "Class 11", mode: "insensitive" } },
            ],
          },
        },
      });
    } else if (selectedCourse === "Class 12th (NEET)") {
      andConditions.push({
        subject: {
          course: {
            OR: [
              { title: { contains: "12", mode: "insensitive" } },
              { title: { contains: "Class 12", mode: "insensitive" } },
            ],
          },
        },
      });
    } else if (selectedCourse === "NEET Dropper") {
      andConditions.push({
        subject: {
          course: {
            OR: [
              { title: { contains: "Dropper", mode: "insensitive" } },
              { title: { contains: "Repeater", mode: "insensitive" } },
            ],
          },
        },
      });
    } else if (selectedCourse === "Foundation (Class 9th & 10th)") {
      andConditions.push({
        subject: {
          course: {
            OR: [
              { title: { contains: "Foundation", mode: "insensitive" } },
              { title: { contains: "9", mode: "insensitive" } },
              { title: { contains: "10", mode: "insensitive" } },
            ],
          },
        },
      });
    } else if (selectedCourse === "JEE Main + Advanced") {
      andConditions.push({
        subject: {
          course: {
            OR: [
              { title: { contains: "JEE", mode: "insensitive" } },
              { title: { contains: "Engineering", mode: "insensitive" } },
            ],
          },
        },
      });
    } else {
      andConditions.push({
        subject: {
          OR: [
            { courseId: selectedCourse },
            { course: { title: { contains: selectedCourse, mode: "insensitive" } } },
          ],
        },
      });
    }
  }

  if (selectedSubject) {
    if (selectedSubject === "Physics") {
      andConditions.push({
        subject: { title: { contains: "Physics", mode: "insensitive" } },
      });
    } else if (selectedSubject === "Chemistry") {
      andConditions.push({
        subject: {
          OR: [
            { title: { contains: "Chem", mode: "insensitive" } },
            { title: { in: ["Chemistry", "Organic Chemistry", "Inorganic Chemistry", "Physical Chemistry"] } },
          ],
        },
      });
    } else if (selectedSubject === "Biology") {
      andConditions.push({
        subject: {
          OR: [
            { title: { contains: "Bio", mode: "insensitive" } },
            { title: { contains: "Botan", mode: "insensitive" } },
            { title: { contains: "Zool", mode: "insensitive" } },
            { title: { in: ["Biology", "Botany", "Zoology"] } },
          ],
        },
      });
    } else if (selectedSubject === "Mathematics") {
      andConditions.push({
        subject: { title: { contains: "Math", mode: "insensitive" } },
      });
    } else if (selectedSubject === "Science") {
      andConditions.push({
        subject: { title: { contains: "Science", mode: "insensitive" } },
      });
    } else {
      andConditions.push({
        subjectId: selectedSubject,
      });
    }
  }

  if (searchParams.medium && ["HINDI", "ENGLISH", "HINGLISH"].includes(searchParams.medium)) {
    andConditions.push({
      medium: searchParams.medium as "HINDI" | "ENGLISH" | "HINGLISH",
    });
  }

  if (searchParams.status && searchParams.status in STATUS_TONE) {
    andConditions.push({
      status: searchParams.status as ChapterStatus,
    });
  }

  const whereClause: Prisma.ChapterWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

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

  // Group chapters by Subject box layout as requested
  type SubjectGroup = {
    subjectId: string;
    subjectTitle: string;
    courseTitle: string;
    chapters: typeof chapters;
    totalLectures: number;
    totalDpps: number;
    totalTests: number;
  };

  const subjectMap = new Map<string, SubjectGroup>();

  for (const ch of chapters) {
    const sId = ch.subjectId || "general_subject";
    const sTitle = ch.subject?.title || "General Subject";
    const cTitle = ch.subject?.course?.title || "Academic Program";

    if (!subjectMap.has(sId)) {
      subjectMap.set(sId, {
        subjectId: sId,
        subjectTitle: sTitle,
        courseTitle: cTitle,
        chapters: [],
        totalLectures: 0,
        totalDpps: 0,
        totalTests: 0,
      });
    }

    const group = subjectMap.get(sId)!;
    group.chapters.push(ch);
    group.totalLectures += ch._count.lectures;
    group.totalDpps += ch._count.dpps;
    group.totalTests += ch._count.tests;
  }

  const subjectGroups = Array.from(subjectMap.values());

  const activeTab = searchParams.status || "ALL";

  return (
    <div className="space-y-6 max-w-6xl font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Chapters Master</h1>
          <p className="text-xs text-slate-500 mt-1">
            Author curriculum roadmaps, manage subject chapters in folder rows, and review chapters for batch import.
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

      {/* Filter Toolbar */}
      <form className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl flex flex-wrap items-center gap-3" method="get">
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

      {/* ========================================================================= */}
      {/* SUBJECT BOXES WITH LINE-TYPE FOLDER CHAPTER ROWS */}
      {/* ========================================================================= */}
      {subjectGroups.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400 space-y-3">
          <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-700">
            menu_book
          </span>
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">No Chapters Created Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Create your first chapter to start organizing subjects, lectures, DPPs, and practice tests.
          </p>
          {canCreate && (
            <Link
              href="/team/chapters/new"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-blue-600 text-white text-xs font-bold shadow-md hover:bg-blue-500 transition"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              <span>Create New Chapter</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {subjectGroups.map((group) => (
            <div
              key={group.subjectId}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden"
            >
              {/* 1. Subject Header Box */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
                    <span className="material-symbols-outlined text-xl">menu_book</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                        {group.subjectTitle}
                      </h2>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        Subject
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {group.courseTitle}
                    </p>
                  </div>
                </div>

                {/* Subject Aggregate Stats */}
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                    {group.chapters.length} {group.chapters.length === 1 ? "Chapter" : "Chapters"}
                  </span>
                  <span className="hidden sm:inline-flex px-2 py-1 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-semibold text-[11px]">
                    {group.totalLectures} Lecs
                  </span>
                  <span className="hidden sm:inline-flex px-2 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                    {group.totalTests} Tests
                  </span>
                </div>
              </div>

              {/* 2. Chapters Line-Type Folder Rows (Simple clean line list format) */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 p-2 sm:p-3">
                {group.chapters.map((ch, chIdx) => {
                  const facultyName =
                    ch.lectures[0]?.teacher?.user?.name || "Faculty Assigned";

                  return (
                    <div
                      key={ch.id}
                      className="group flex flex-col md:flex-row md:items-center justify-between p-3 sm:px-4 sm:py-3.5 rounded-2xl hover:bg-slate-50/90 dark:hover:bg-slate-800/40 transition gap-2 sm:gap-4"
                    >
                      {/* Left: Folder Icon + Chapter Name & ID Code */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0 group-hover:bg-blue-50 group-hover:text-blue-600 transition">
                          <span className="material-symbols-outlined text-lg">folder_open</span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-bold text-slate-400">
                              #{chIdx + 1}
                            </span>
                            <Link
                              href={`/team/chapters/${ch.id}`}
                              className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition truncate"
                            >
                              {ch.title}
                            </Link>
                            {ch.chapterId && (
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {ch.chapterId}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span>Medium: <strong className="text-slate-600 dark:text-slate-300 font-semibold">{ch.medium}</strong></span>
                            <span>&middot;</span>
                            <span>{facultyName}</span>
                            <span>&middot;</span>
                            <span className="font-mono text-[10px]">ID: {ch.id.slice(0, 8)}</span>
                          </p>
                        </div>
                      </div>

                      {/* Middle: Content Roadmap Pills */}
                      <div className="flex items-center gap-1.5 font-mono text-[11px] shrink-0 pl-11 md:pl-0">
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold" title="Lectures">
                          {ch._count.lectures} Lecs
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold" title="DPPs">
                          {ch._count.dpps} DPPs
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-bold" title="Tests">
                          {ch._count.tests} Tests
                        </span>
                      </div>

                      {/* Right: Status Badge & Open Button */}
                      <div className="flex items-center justify-between md:justify-end gap-2 shrink-0 pl-11 md:pl-0">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block ${
                            STATUS_TONE[ch.status] || "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {ch.status.replaceAll("_", " ")}
                        </span>

                        {ch.status === "UNDER_REVIEW" && canReview ? (
                          <Link
                            href={`/team/chapters/${ch.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-sm transition"
                          >
                            <span className="material-symbols-outlined text-xs">fact_check</span>
                            <span>Review</span>
                          </Link>
                        ) : (
                          <Link
                            href={`/team/chapters/${ch.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-600 hover:text-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs transition shadow-2xs"
                          >
                            <span>Open</span>
                            <span className="material-symbols-outlined text-xs">arrow_forward</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
