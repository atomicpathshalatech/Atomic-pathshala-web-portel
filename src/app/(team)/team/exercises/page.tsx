import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Plus, Search, BookOpen, GraduationCap, Sparkles, Layers } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getChapterModulesDirectory } from "@/lib/exercises/exercise-service";
import { ChapterModulesGrid } from "@/components/exercises/ChapterModulesGrid";

export const metadata: Metadata = {
  title: "Exercise Builder | Atomic Pathshala",
  description: "Create chapter-wise practice modules",
};

export default async function ExercisesDashboardPage({ searchParams }: { searchParams: { search?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.QUESTION_READ);
  if (!canRead) redirect("/team");

  const canCreate = await hasPermission(session.user.id, PERMISSIONS.QUESTION_CREATE);
  const currentSearch = searchParams.search?.trim() || "";

  const [chapterModules, totalQuestionsCount, attemptedStudents] = await Promise.all([
    getChapterModulesDirectory("ALL", currentSearch),
    prisma.exerciseQuestion.count(),
    // Students who have attempted any exercise, latest first.
    prisma.exerciseAttempt.findMany({
      distinct: ["userId"],
      orderBy: { startedAt: "desc" },
      select: { userId: true, user: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <Sparkles className="h-4 w-4" />
            Coaching Practice Modules
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Exercise Builder</h1>
        </div>
        {canCreate && (
          <Link
            href="/team/exercises/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-amber-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>New Exercise</span>
          </Link>
        )}
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Modules</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <BookOpen className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{chapterModules.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">Chapter modules</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Questions</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <Layers className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{totalQuestionsCount}</p>
          <p className="text-xs text-slate-400 mt-0.5">In all exercises</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Students Attempted</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
              <GraduationCap className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{attemptedStudents.length}</p>
          {attemptedStudents.length > 0 ? (
            <details className="mt-0.5">
              <summary className="cursor-pointer text-xs font-semibold text-purple-600 hover:underline dark:text-purple-400">See names</summary>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto pr-1 text-xs text-slate-700 dark:text-slate-300">
                {attemptedStudents.map((a) => (
                  <li key={a.userId} className="truncate">
                    {a.user?.name || "Unnamed student"}
                  </li>
                ))}
              </ul>
            </details>
          ) : (
            <p className="text-xs text-slate-400 mt-0.5">No attempts yet</p>
          )}
        </div>
      </div>

      {/* Search */}
      <form method="GET" action="/team/exercises" className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            name="search"
            defaultValue={currentSearch}
            placeholder="Search chapter..."
            className="h-9 w-64 rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>
        <button
          type="submit"
          className="h-9 rounded-xl bg-slate-100 px-3.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition"
        >
          Search
        </button>
        {currentSearch && (
          <Link href="/team/exercises" className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white">
            Clear
          </Link>
        )}
      </form>

      {/* Chapter modules: Physics | Chemistry | Biology */}
      {chapterModules.length === 0 && currentSearch ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center text-sm text-slate-500 dark:border-slate-800">
          No chapter matches &ldquo;{currentSearch}&rdquo;.
        </div>
      ) : (
        <ChapterModulesGrid chapterModules={chapterModules} />
      )}
    </div>
  );
}
