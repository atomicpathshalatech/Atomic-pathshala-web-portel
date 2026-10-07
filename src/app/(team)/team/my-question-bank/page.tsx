import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { MyQuestionBankDashboard } from "@/components/team/questions/MyQuestionBankDashboard";

export const metadata: Metadata = {
  title: "My Question Bank | Atomic Pathshala",
};

export default async function MyQuestionBankPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.QUESTION_READ);
  if (!canRead) redirect("/team");

  const isAssignAdmin =
    (await hasPermission(session.user.id, PERMISSIONS.QUESTION_ASSIGN)) ||
    (await hasPermission(session.user.id, PERMISSIONS.QUESTION_APPROVE));

  // Fetch assignments
  const where: any = isAssignAdmin ? {} : { assignedToId: session.user.id };

  const assignments = await prisma.questionAssignment.findMany({
    where,
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      assignedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Calculate live question statistics per assignment
  const assignmentsWithStats = await Promise.all(
    assignments.map(async (a) => {
      const cleanChap = a.chapter
        .replace(/^\[class\s*\d+\]\s*/i, "")
        .replace(/^ch\s*\d+:\s*/i, "")
        .replace(/^\d+[\.:\s-]+/i, "")
        .trim();

      const chapterFilter = {
        subject: { equals: a.subject, mode: "insensitive" as const },
        OR: [
          { chapter: { contains: cleanChap, mode: "insensitive" as const } },
          { category: { contains: cleanChap, mode: "insensitive" as const } },
        ],
      };

      const [
        total,
        aiAudited,
        reviewed,
        pendingReview,
        published,
        revision,
        rework,
        draft,
        review1,
        review2,
      ] = await Promise.all([
        prisma.question.count({ where: chapterFilter }),
        prisma.question.count({
          where: {
            ...chapterFilter,
            aiVerified: true,
          },
        }),
        prisma.question.count({
          where: {
            ...chapterFilter,
            status: { in: ["REVIEW_2", "PUBLISHED"] },
          },
        }),
        prisma.question.count({
          where: {
            ...chapterFilter,
            status: { in: ["DRAFT", "REVIEW_1"] },
          },
        }),
        prisma.question.count({
          where: {
            ...chapterFilter,
            status: "PUBLISHED",
          },
        }),
        prisma.question.count({
          where: {
            ...chapterFilter,
            OR: [
              { status: "REJECTED" },
              { review1Status: "CHANGES_REQUESTED" },
              { review2Status: "CHANGES_REQUESTED" },
            ],
          },
        }),
        prisma.question.count({
          where: {
            ...chapterFilter,
            correctionStatus: "REWORK",
          },
        }),
        prisma.question.count({
          where: {
            ...chapterFilter,
            status: "DRAFT",
          },
        }),
        prisma.question.count({
          where: {
            ...chapterFilter,
            status: "REVIEW_1",
          },
        }),
        prisma.question.count({
          where: {
            ...chapterFilter,
            status: "REVIEW_2",
          },
        }),
      ]);

      return {
        id: a.id,
        title: a.title,
        description: a.description,
        subject: a.subject,
        chapter: a.chapter,
        topic: a.topic,
        targetCount: total || a.targetCount || 0,
        difficulty: a.difficulty,
        status: a.status,
        dueDate: a.dueDate?.toISOString() || null,
        instructions: a.instructions || a.notes,
        notes: a.notes,
        assignedTo: { id: a.assignedTo.id, name: a.assignedTo.name, email: a.assignedTo.email },
        assignedBy: a.assignedBy ? { id: a.assignedBy.id, name: a.assignedBy.name } : undefined,
        createdAt: a.createdAt.toISOString(),
        liveStats: {
          total,
          aiAudited,
          reviewed,
          pendingReview,
          published,
          revision,
          rework,
          draft,
          review1,
          review2,
          rejected: revision,
        },
      };
    })
  );

  // Fetch list of faculty/teachers for admin assignment dropdown
  const facultyList = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { role: { name: { in: ["TEACHER", "QUESTION_TEAM", "ACADEMIC_HEAD", "ADMIN"] } } },
        { department: { contains: "Faculty", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <MyQuestionBankDashboard
        initialAssignments={assignmentsWithStats as any}
        isAssignAdmin={isAssignAdmin}
        currentUserId={session.user.id}
        facultyList={facultyList}
      />
    </div>
  );
}
