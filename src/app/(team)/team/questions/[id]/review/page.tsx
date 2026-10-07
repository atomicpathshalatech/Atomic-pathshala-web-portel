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
}: {
  params: { id: string };
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

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <QuestionFullReviewWorkspace
        question={question as any}
        currentUserId={session.user.id}
        userRole={typeof session.user.role === "string" ? session.user.role : "STAFF"}
      />
    </div>
  );
}
