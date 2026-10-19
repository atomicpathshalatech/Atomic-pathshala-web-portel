import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  Plus,
  Search,
  BookOpen,
  FileCheck,
  GraduationCap,
  Sparkles,
  ArrowRight,
  Filter,
  CheckCircle2,
  Clock,
  Archive,
  Layers,
} from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export const metadata: Metadata = {
  title: "Exercise Builder | Atomic Pathshala",
  description: "Create chapter-wise and topic-wise practice sheets and coaching modules",
};

function subjectBadgeStyle(subject: string) {
  const s = subject.toLowerCase();
  if (s.includes("bio") || s.includes("bot") || s.includes("zoo")) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800";
  }
  if (s.includes("chem")) {
    return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800";
  }
  if (s.includes("phys")) {
    return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800";
  }
  if (s.includes("math")) {
    return "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800";
  }
  return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800";
}

function statusBadgeStyle(status: string) {
  switch (status) {
    case "PUBLISHED":
      return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300";
    case "ARCHIVED":
      return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400";
    default:
      return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300";
  }
}

export default async function ExercisesDashboardPage({
  searchParams,
}: {
  searchParams: { search?: string; status?: string; subject?: string; page?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.QUESTION_READ);
  if (!canRead) redirect("/team");

  const canCreate = await hasPermission(session.user.id, PERMISSIONS.QUESTION_CREATE);

  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = 20;
  const skip = (page - 1) * pageSize;

  const currentStatus = searchParams.status || "ALL";
  const currentSubject = searchParams.subject || "ALL";
  const currentSearch = searchParams.search?.trim() || "";

  const where: any = {};
  if (currentStatus !== "ALL") {
    where.status = currentStatus;
  }
  if (currentSubject !== "ALL") {
    where.subject = { equals: currentSubject, mode: "insensitive" };
  }
  if (currentSearch) {
    where.OR = [
      { title: { contains: currentSearch, mode: "insensitive" } },
      { exerciseCode: { contains: currentSearch, mode: "insensitive" } },
      { chapter: { contains: currentSearch, mode: "insensitive" } },
    ];
  }

  const [exercises, totalCount, statusCounts, totalQuestionsCount, totalAttemptsCount] = await Promise.all([
    prisma.exercise.findMany({
      where,
      include: {
        createdBy: { select: { name: true } },
        _count: {
          select: {
            questions: true,
            sections: true,
            attempts: true,
            exports: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.exercise.count({ where }),
    prisma.exercise.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
    prisma.exerciseQuestion.count(),
    prisma.exerciseAttempt.count(),
  ]);

  const counts: Record<string, number> = { ALL: 0, DRAFT: 0, PUBLISHED: 0, ARCHIVED: 0 };
  let allTotal = 0;
  for (const sc of statusCounts) {
    counts[sc.status] = sc._count.id;
    allTotal += sc._count.id;
  }
  counts.ALL = allTotal;

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Top Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-6 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <Sparkles className="h-4 w-4" />
            Coaching Practice Modules
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Exercise Builder
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Create chapter-wise and topic-wise practice sheets, coaching modules, and printable PDFs with answer keys.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/team/exercises/new"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Exercise
          </Link>
        )}
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Exercises</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <BookOpen className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{counts.ALL}</p>
          <p className="text-xs text-slate-400 mt-0.5">Across all subjects</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Published Sheets</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <FileCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{counts.PUBLISHED || 0}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">Live for practice & PDF</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Curated Questions</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{totalQuestionsCount}</p>
          <p className="text-xs text-slate-400 mt-0.5">Assigned to exercises</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Student Attempts</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
              <GraduationCap className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{totalAttemptsCount}</p>
          <p className="text-xs text-slate-400 mt-0.5">Online practice completions</p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {[
            { key: "ALL", label: "All Exercises", count: counts.ALL },
            { key: "DRAFT", label: "Drafts", count: counts.DRAFT || 0 },
            { key: "PUBLISHED", label: "Published", count: counts.PUBLISHED || 0 },
            { key: "ARCHIVED", label: "Archived", count: counts.ARCHIVED || 0 },
          ].map((tab) => {
            const isActive = currentStatus === tab.key;
            const queryParams = new URLSearchParams();
            if (tab.key !== "ALL") queryParams.set("status", tab.key);
            if (currentSubject !== "ALL") queryParams.set("subject", currentSubject);
            if (currentSearch) queryParams.set("search", currentSearch);

            return (
              <Link
                key={tab.key}
                href={`/team/exercises?${queryParams.toString()}`}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                {tab.label}
                <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-[10px] font-semibold dark:bg-slate-700">
                  {tab.count}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Search & Subject filter */}
        <form method="GET" action="/team/exercises" className="flex items-center gap-2">
          {currentStatus !== "ALL" && <input type="hidden" name="status" value={currentStatus} />}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              name="search"
              defaultValue={currentSearch}
              placeholder="Search exercise or chapter..."
              className="h-9 w-60 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <select
            name="subject"
            defaultValue={currentSubject}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            <option value="ALL">All Subjects</option>
            <option value="Biology">Biology</option>
            <option value="Chemistry">Chemistry</option>
            <option value="Physics">Physics</option>
            <option value="Mathematics">Mathematics</option>
          </select>
          <button
            type="submit"
            className="h-9 rounded-lg bg-slate-100 px-3 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Filter
          </button>
        </form>
      </div>

      {/* Exercises List / Grid */}
      {exercises.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center dark:border-slate-800">
          <BookOpen className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
          <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">No exercises found</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {currentSearch || currentStatus !== "ALL" || currentSubject !== "ALL"
              ? "Try adjusting your filters or search terms."
              : "Get started by creating your first chapter-wise exercise practice sheet."}
          </p>
          {canCreate && (
            <div className="mt-6">
              <Link
                href="/team/exercises/new"
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"
              >
                <Plus className="h-4 w-4" />
                Create First Exercise
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {exercises.map((ex) => (
            <div
              key={ex.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-amber-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                {/* Subject & Status */}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${subjectBadgeStyle(
                      ex.subject
                    )}`}
                  >
                    {ex.subject}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${statusBadgeStyle(
                      ex.status
                    )}`}
                  >
                    {ex.status}
                  </span>
                </div>

                {/* Title & Code */}
                <div className="mt-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                    <span>{ex.exerciseCode}</span>
                    <span>&bull;</span>
                    <span>{ex.exerciseType.replace(/_/g, " ")}</span>
                  </div>
                  <h3 className="mt-1 text-base font-bold text-slate-900 line-clamp-1 dark:text-white">
                    {ex.title}
                  </h3>
                  <p className="mt-0.5 text-xs font-medium text-slate-500 line-clamp-1 dark:text-slate-400">
                    Chapter: {ex.chapter}
                  </p>
                </div>

                {/* Metrics */}
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center dark:border-slate-800/80">
                  <div className="rounded-md bg-slate-50 py-1.5 dark:bg-slate-800/50">
                    <span className="block text-sm font-bold text-slate-900 dark:text-white">
                      {ex._count.questions}
                    </span>
                    <span className="block text-[10px] text-slate-400 uppercase">Questions</span>
                  </div>
                  <div className="rounded-md bg-slate-50 py-1.5 dark:bg-slate-800/50">
                    <span className="block text-sm font-bold text-slate-900 dark:text-white">
                      {ex._count.sections}
                    </span>
                    <span className="block text-[10px] text-slate-400 uppercase">Sections</span>
                  </div>
                  <div className="rounded-md bg-slate-50 py-1.5 dark:bg-slate-800/50">
                    <span className="block text-sm font-bold text-slate-900 dark:text-white">
                      {ex._count.attempts}
                    </span>
                    <span className="block text-[10px] text-slate-400 uppercase">Attempts</span>
                  </div>
                </div>
              </div>

              {/* Bottom Action */}
              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                <span className="text-[11px] text-slate-400">
                  {ex.languageMode === "HINDI_ONLY"
                    ? "Hindi Only"
                    : ex.languageMode === "ENGLISH_ONLY"
                    ? "English Only"
                    : "Bilingual (EN + HI)"}
                </span>
                <Link
                  href={`/team/exercises/${ex.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-500 dark:text-amber-400"
                >
                  Open Builder
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} exercises
          </p>
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Link
                href={`/team/exercises?page=${page - 1}&status=${currentStatus}&subject=${currentSubject}&search=${currentSearch}`}
                className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                Previous
              </Link>
            )}
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={`/team/exercises?page=${page + 1}&status=${currentStatus}&subject=${currentSubject}&search=${currentSearch}`}
                className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
