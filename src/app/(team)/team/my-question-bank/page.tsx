import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { MyAssignedQuestionsDashboard } from "@/components/team/questions/MyAssignedQuestionsDashboard";

export const metadata: Metadata = {
  title: "My Assigned Questions | Atomic Pathshala",
  description: "Review and verify the questions assigned to you.",
};

export const dynamic = "force-dynamic";

export default async function MyQuestionBankPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.QUESTION_READ);
  if (!canRead) redirect("/team");

  const targetUserId = session.user.id;

  // Source of truth counts for teacher question assignments
  const completedCondition = {
    assignedToId: targetUserId,
    OR: [
      { correctionStatus: { in: ["SUBMITTED", "APPROVED", "COMPLETED"] } },
      { status: "PUBLISHED" },
      { correctionSubmittedAt: { not: null } },
    ],
  };

  const pendingCondition = {
    assignedToId: targetUserId,
    AND: [
      {
        OR: [
          { correctionStatus: { in: ["ASSIGNED", "IN_CORRECTION", "REWORK", "NONE"] } },
          { correctionStatus: null },
        ],
      },
      { status: { not: "PUBLISHED" } },
      { correctionSubmittedAt: null },
    ],
  };

  const [totalAssigned, completedCount, pendingCount, initialQuestions] = await Promise.all([
    prisma.question.count({ where: { assignedToId: targetUserId } }),
    prisma.question.count({ where: completedCondition }),
    prisma.question.count({ where: pendingCondition }),
    prisma.question.findMany({
      where: pendingCondition,
      select: {
        id: true,
        questionCode: true,
        subject: true,
        chapter: true,
        topic: true,
        subTopic: true,
        type: true,
        difficulty: true,
        status: true,
        correctionStatus: true,
        correctionNotes: true,
        correctionSubmittedAt: true,
        assignedAt: true,
        createdAt: true,
        review1Status: true,
        review2Status: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        assignedBy: { select: { id: true, name: true } },
        translations: {
          select: {
            id: true,
            language: true,
            statement: true,
            options: true,
            correctOptionIds: true,
            solution: true,
          },
        },
      },
      orderBy: { assignedAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <MyAssignedQuestionsDashboard
        initialQuestions={initialQuestions as any}
        initialTotalAssigned={totalAssigned}
        initialPendingCount={pendingCount}
        initialCompletedCount={completedCount}
        currentUserId={session.user.id}
      />
    </div>
  );
}
