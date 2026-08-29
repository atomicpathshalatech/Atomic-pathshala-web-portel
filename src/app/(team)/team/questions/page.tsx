import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { QuestionStatusActions } from "@/components/team-portal/QuestionStatusActions";
import { toLegacyQuestion } from "@/lib/questions/legacy";

export const metadata: Metadata = {
  title: "Question Bank",
};

export default async function QuestionBankPage({
  searchParams,
}: {
  searchParams: { search?: string; status?: string; difficulty?: string; page?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.QUESTION_READ);
  if (!canRead) redirect("/team");

  const canCreate = await hasPermission(session.user.id, PERMISSIONS.QUESTION_CREATE);
  const canVerify = await hasPermission(session.user.id, PERMISSIONS.QUESTION_VERIFY);

  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = 20;

  const where = {
    ...(searchParams.search
      ? { translations: { some: { statement: { contains: searchParams.search, mode: "insensitive" as const } } } }
      : {}),
    ...(searchParams.status === "PUBLISHED" ? { isPublished: true } : {}),
    ...(searchParams.status === "PENDING" ? { isPublished: false } : {}),
    ...(searchParams.difficulty
      ? { difficulty: searchParams.difficulty as "EASY" | "MEDIUM" | "HARD" }
      : {}),
  };

  const [questions, total, publishedCounts, subjectCount] = await Promise.all([
    prisma.question.findMany({
      where,
      include: { translations: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.question.count({ where }),
    prisma.question.groupBy({ by: ["isPublished"], _count: true }),
    prisma.subject.count(),
  ]);

  const totalQuestions = await prisma.question.count();
  const countFor = (isPublished: boolean) =>
    publishedCounts.find((s) => s.isPublished === isPublished)?._count ?? 0;

  const rows = questions.map((q) => ({ ...toLegacyQuestion(q), difficultyRaw: q.difficulty }));

  return (
    <div className="space-y-stack-lg max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">Question Bank</h1>
          <p className="text-on-surface-variant font-body-md mt-1">
            {totalQuestions} question{totalQuestions === 1 ? "" : "s"} total.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/team/questions/new"
            className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-label-md shadow-lg hover:shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined">add_circle</span>
            Create Question
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-gutter">
        <div className="glass-card p-6 rounded-2xl">
          <p className="text-on-surface-variant font-label-md mb-1">Published</p>
          <h3 className="text-[28px] font-bold text-tertiary">{countFor(true)}</h3>
        </div>
        <div className="glass-card p-6 rounded-2xl">
          <p className="text-on-surface-variant font-label-md mb-1">Unpublished</p>
          <h3 className="text-[28px] font-bold text-primary">{countFor(false)}</h3>
        </div>
      </div>

      {subjectCount === 0 && (
        <div className="rounded-xl bg-primary-container/10 border border-primary/20 px-4 py-3 text-label-sm font-label-sm text-on-surface-variant">
          No subjects/chapters exist yet, so new questions are being saved unclassified. Add
          subjects via the Content Team module once it&apos;s built to enable classification.
        </div>
      )}

      {/* Filters */}
      <form className="glass-card p-4 rounded-xl flex flex-wrap items-center gap-4" method="get">
        <input
          name="search"
          defaultValue={searchParams.search}
          placeholder="Search question text..."
          className="flex-1 min-w-[200px] bg-surface-container-low rounded-lg border border-outline-variant/30 px-3 py-2 text-label-md"
        />
        <select
          name="status"
          defaultValue={searchParams.status ?? ""}
          className="bg-surface-container-low rounded-lg border border-outline-variant/30 px-3 py-2 text-label-md"
        >
          <option value="">All Status</option>
          <option value="PENDING">Unpublished</option>
          <option value="PUBLISHED">Published</option>
        </select>
        <select
          name="difficulty"
          defaultValue={searchParams.difficulty ?? ""}
          className="bg-surface-container-low rounded-lg border border-outline-variant/30 px-3 py-2 text-label-md"
        >
          <option value="">All Difficulty</option>
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </select>
        <button type="submit" className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md">
          Apply
        </button>
      </form>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low border-b border-outline-variant/30">
              <tr>
                <th className="px-6 py-4 font-label-md text-on-surface-variant">Question Preview</th>
                <th className="px-6 py-4 font-label-md text-on-surface-variant">Subject/Topic</th>
                <th className="px-6 py-4 font-label-md text-on-surface-variant">Difficulty</th>
                <th className="px-6 py-4 font-label-md text-on-surface-variant">Status</th>
                <th className="px-6 py-4 font-label-md text-on-surface-variant text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {rows.map((q) => (
                <tr key={q.id} className="hover:bg-surface-container-lowest/50 transition-colors group">
                  <td className="px-6 py-5 max-w-md">
                    <p className="line-clamp-2">{q.body}</p>
                    <span className="text-label-sm text-outline-variant">ID: {q.id.slice(0, 10)}</span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="font-label-md text-primary">{q.subject ?? "Unclassified"}</span>
                      {q.chapter && <span className="text-label-sm text-on-surface-variant">{q.chapter}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-label-sm">{q.difficultyRaw}</td>
                  <td className="px-6 py-5">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        q.isPublished
                          ? "bg-tertiary-container text-on-tertiary-container"
                          : "bg-primary-container text-on-primary-container"
                      }`}
                    >
                      {q.isPublished ? "Published" : "Unpublished"}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/team/questions/${q.id}/edit`} className="p-1 hover:text-primary" title="Edit">
                        <span className="material-symbols-outlined">edit</span>
                      </Link>
                      {canVerify && <QuestionStatusActions questionId={q.id} isPublished={q.isPublished} />}
                    </div>
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-on-surface-variant font-body-md">
                    No questions match these filters yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 bg-surface-container-low/50 flex items-center justify-between">
          <p className="text-label-sm text-on-surface-variant">
            Showing {rows.length === 0 ? 0 : (page - 1) * pageSize + 1}-
            {(page - 1) * pageSize + rows.length} of {total} questions
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={{ pathname: "/team/questions", query: { ...searchParams, page: page - 1 } }}
                className="px-3 py-1 border border-outline-variant rounded hover:bg-white transition-all text-sm"
              >
                Prev
              </Link>
            )}
            {page * pageSize < total && (
              <Link
                href={{ pathname: "/team/questions", query: { ...searchParams, page: page + 1 } }}
                className="px-3 py-1 border border-outline-variant rounded hover:bg-white transition-all text-sm"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
