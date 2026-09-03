import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { QuestionManagementTable } from "@/components/team-portal/QuestionManagementTable";
import { Plus, Languages } from "lucide-react";

export const metadata: Metadata = {
  title: "Question Bank & Assessment Management",
};

export default async function QuestionBankPage({
  searchParams,
}: {
  searchParams: {
    search?: string;
    subject?: string;
    topic?: string;
    subTopic?: string;
    difficulty?: string;
    type?: string;
    status?: string;
    createdById?: string;
    reviewedById?: string;
    editedById?: string;
    page?: string;
  };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.QUESTION_READ);
  if (!canRead) redirect("/team");

  const canCreate = await hasPermission(session.user.id, PERMISSIONS.QUESTION_CREATE);
  const canVerify = await hasPermission(session.user.id, PERMISSIONS.QUESTION_VERIFY);

  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = 20;

  // Build Filter Query
  const where: any = {};

  if (searchParams.search) {
    where.OR = [
      { questionCode: { contains: searchParams.search, mode: "insensitive" } },
      { tags: { contains: searchParams.search, mode: "insensitive" } },
      { translations: { some: { statement: { contains: searchParams.search, mode: "insensitive" } } } },
      { translations: { some: { solution: { contains: searchParams.search, mode: "insensitive" } } } },
    ];
  }

  if (searchParams.subject && searchParams.subject !== "ALL") {
    where.subject = { equals: searchParams.subject, mode: "insensitive" };
  }

  if (searchParams.topic && searchParams.topic !== "ALL") {
    where.OR = [
      { topic: { contains: searchParams.topic, mode: "insensitive" } },
      { chapter: { contains: searchParams.topic, mode: "insensitive" } },
    ];
  }

  if (searchParams.subTopic && searchParams.subTopic !== "ALL") {
    where.subTopic = { contains: searchParams.subTopic, mode: "insensitive" };
  }

  if (searchParams.difficulty && searchParams.difficulty !== "ALL") {
    where.difficulty = searchParams.difficulty as any;
  }

  if (searchParams.type && searchParams.type !== "ALL") {
    where.type = searchParams.type as any;
  }

  if (searchParams.status && searchParams.status !== "ALL") {
    if (searchParams.status === "PUBLISHED") {
      where.isPublished = true;
      where.status = "PUBLISHED";
    } else {
      where.status = searchParams.status;
    }
  }

  if (searchParams.createdById && searchParams.createdById !== "ALL") {
    where.createdById = searchParams.createdById;
  }

  if (searchParams.reviewedById && searchParams.reviewedById !== "ALL") {
    where.OR = [
      { review1ById: searchParams.reviewedById },
      { review2ById: searchParams.reviewedById },
      { publishedById: searchParams.reviewedById },
    ];
  }

  if (searchParams.editedById && searchParams.editedById !== "ALL") {
    where.editedById = searchParams.editedById;
  }

  const [
    questions,
    total,
    publishedCount,
    review1Count,
    review2Count,
    draftCount,
    usersList,
  ] = await Promise.all([
    prisma.question.findMany({
      where,
      include: {
        translations: true,
        createdBy: { select: { id: true, name: true, email: true } },
        editedBy: { select: { id: true, name: true, email: true } },
        review1By: { select: { id: true, name: true, email: true } },
        review2By: { select: { id: true, name: true, email: true } },
        publishedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.question.count({ where }),
    prisma.question.count({ where: { status: "PUBLISHED" } }),
    prisma.question.count({ where: { status: "REVIEW_1" } }),
    prisma.question.count({ where: { status: "REVIEW_2" } }),
    prisma.question.count({ where: { status: "DRAFT" } }),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
  ]);

  const totalQuestions = publishedCount + review1Count + review2Count + draftCount;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-extrabold text-2xl text-slate-900 dark:text-white tracking-tight">
            Question Bank
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {totalQuestions} questions total · Structured 2-stage verification workflow.
          </p>
        </div>

        {canCreate && (
          <div className="flex items-center gap-3">
            <Link
              href="/team/question-bank-hierarchical"
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2.5 rounded-full font-bold text-xs hover:opacity-95 transition-all shadow-md shadow-indigo-500/20"
              title="Hierarchical Question Bank with Class, Subject, Chapter, Topic taxonomy and Revision Hub"
            >
              <span className="material-symbols-outlined text-base">account_tree</span>
              <span>Hierarchy &amp; Revision Hub</span>
            </Link>
            <Link
              href="/team/questions/new"
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-full font-bold text-xs shadow-md shadow-blue-500/20 hover:bg-blue-500 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create Question</span>
            </Link>
          </div>
        )}
      </div>

      {/* Main Question Management Table & Filters */}
      <QuestionManagementTable
        questions={questions.map((q) => ({
          ...q,
          isBilingual: q.translations.length > 1 || Boolean(q.questionCode) || Boolean(q.pyqSource),
        }))}
        totalCount={total}
        currentPage={page}
        pageSize={pageSize}
        counts={{
          total: totalQuestions,
          published: publishedCount,
          review1: review1Count,
          review2: review2Count,
          draft: draftCount,
        }}
        usersList={usersList}
        canCreate={canCreate}
        canVerify={canVerify}
        currentUserId={session.user.id}
      />
    </div>
  );
}
