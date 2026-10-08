import React from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { QuestionFullReviewWorkspace } from "@/components/team-portal/QuestionFullReviewWorkspace";

export const metadata: Metadata = {
  title: "Question Review & AI Audit Workspace | Atomic Pathshala",
};

export default async function QuestionReviewPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: {
    subject?: string;
    chapter?: string;
    topic?: string;
    difficulty?: string;
    type?: string;
    status?: string;
    assignedToId?: string;
    correctionStatus?: string;
    fromDashboard?: string;
  };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.QUESTION_READ);
  if (!canRead) redirect("/team");

  const question = await prisma.question.findUnique({
    where: { id: params.id },
    include: {
      translations: true,
      assets: true,
      createdBy: { select: { id: true, name: true, email: true } },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!question) notFound();

  // Query sibling questions for sequential next/preview navigation
  const siblingWhere: any = {};
  const filterSubject = searchParams?.subject && searchParams.subject !== "ALL" ? searchParams.subject : question.subject;
  if (filterSubject) {
    siblingWhere.subject = { equals: filterSubject, mode: "insensitive" };
  }

  const filterChapter = searchParams?.chapter && searchParams.chapter !== "ALL" ? searchParams.chapter : question.chapter;
  if (filterChapter) {
    const cleanChapter = filterChapter
      .replace(/^\[class\s*\d+\]\s*/i, "")
      .replace(/^ch\s*\d+:\s*/i, "")
      .replace(/^\d+[\.:\s-]+/i, "")
      .trim();
    siblingWhere.OR = [
      { chapter: { contains: cleanChapter, mode: "insensitive" } },
      { category: { contains: cleanChapter, mode: "insensitive" } },
    ];
  }

  if (searchParams?.status && searchParams.status !== "ALL") {
    siblingWhere.status = searchParams.status;
  }

  if (searchParams?.difficulty && searchParams.difficulty !== "ALL") {
    siblingWhere.difficulty = searchParams.difficulty;
  }

  if (searchParams?.type && searchParams.type !== "ALL") {
    siblingWhere.type = searchParams.type;
  }

  if (searchParams?.assignedToId && searchParams.assignedToId !== "ALL") {
    if (searchParams.assignedToId === "ME") {
      siblingWhere.assignedToId = session.user.id;
    } else if (searchParams.assignedToId === "UNASSIGNED") {
      siblingWhere.assignedToId = null;
    } else {
      siblingWhere.assignedToId = searchParams.assignedToId;
    }
  }

  if (searchParams?.correctionStatus && searchParams.correctionStatus !== "ALL") {
    siblingWhere.correctionStatus = searchParams.correctionStatus;
  }

  let siblingRecords = await prisma.question.findMany({
    where: siblingWhere,
    select: {
      id: true,
      questionCode: true,
      subject: true,
      chapter: true,
      topic: true,
      difficulty: true,
      type: true,
      status: true,
      aiVerified: true,
      aiAuditScore: true,
      translations: {
        select: {
          statement: true,
          language: true,
        },
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
    take: 500,
  });

  // Fallback if current question not in filtered set
  let currentIdx = siblingRecords.findIndex((q) => q.id === question.id);
  if (currentIdx === -1) {
    const fallbackRecords = await prisma.question.findMany({
      where: {
        subject: { equals: question.subject, mode: "insensitive" },
        ...(question.chapter
          ? {
              OR: [
                { chapter: { contains: question.chapter, mode: "insensitive" } },
                { category: { contains: question.chapter, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        questionCode: true,
        subject: true,
        chapter: true,
        topic: true,
        difficulty: true,
        type: true,
        status: true,
        aiVerified: true,
        aiAuditScore: true,
        translations: {
          select: {
            statement: true,
            language: true,
          },
          take: 1,
        },
      },
      orderBy: { createdAt: "asc" },
      take: 500,
    });
    const fallbackIdx = fallbackRecords.findIndex((q) => q.id === question.id);
    if (fallbackIdx !== -1) {
      siblingRecords = fallbackRecords;
      currentIdx = fallbackIdx;
    } else {
      // Prepend or append current question as fallback item
      siblingRecords = [
        {
          id: question.id,
          questionCode: question.questionCode,
          subject: question.subject,
          chapter: question.chapter,
          topic: question.topic,
          difficulty: question.difficulty,
          type: question.type,
          status: question.status,
          aiVerified: question.aiVerified,
          aiAuditScore: question.aiAuditScore,
          translations: question.translations?.slice(0, 1).map((t) => ({
            statement: t.statement,
            language: t.language,
          })) || [],
        },
        ...siblingRecords,
      ];
      currentIdx = 0;
    }
  }

  const prevQuestion = currentIdx > 0 ? siblingRecords[currentIdx - 1] : null;
  const nextQuestion = currentIdx >= 0 && currentIdx < siblingRecords.length - 1 ? siblingRecords[currentIdx + 1] : null;

  // Construct query string to preserve active filter context across next/prev navigation
  const queryParams = new URLSearchParams();
  if (searchParams) {
    Object.entries(searchParams).forEach(([k, v]) => {
      if (v) queryParams.set(k, String(v));
    });
  }
  const queryParamsString = queryParams.toString();

  const formattedSiblings = siblingRecords.map((s) => ({
    id: s.id,
    questionCode: s.questionCode,
    subject: s.subject,
    chapter: s.chapter,
    topic: s.topic,
    difficulty: s.difficulty,
    type: s.type,
    status: s.status,
    aiVerified: s.aiVerified,
    aiAuditScore: s.aiAuditScore,
    statementSnippet: s.translations?.[0]?.statement?.slice(0, 80) || "",
  }));

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <QuestionFullReviewWorkspace
        question={question as any}
        currentUserId={session.user.id}
        userRole={typeof session.user.role === "string" ? session.user.role : "STAFF"}
        currentIndex={currentIdx >= 0 ? currentIdx + 1 : 1}
        totalCount={siblingRecords.length}
        prevQuestionId={prevQuestion?.id || null}
        nextQuestionId={nextQuestion?.id || null}
        siblingQuestions={formattedSiblings}
        queryParamsString={queryParamsString}
      />
    </div>
  );
}
