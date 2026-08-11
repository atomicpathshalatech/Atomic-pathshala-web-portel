import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { QuestionForm } from "@/components/team-portal/QuestionForm";

export const metadata: Metadata = {
  title: "Create Question",
};

export default async function NewQuestionPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canCreate = await hasPermission(session.user.id, PERMISSIONS.QUESTION_CREATE);
  if (!canCreate) redirect("/team/questions");

  const subjects = await prisma.subject.findMany({
    include: { chapters: { select: { id: true, title: true } } },
    orderBy: { title: "asc" },
  });

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary">Create Question</h1>
        <p className="text-on-surface-variant font-body-md mt-1">Add a new question to the bank.</p>
      </div>
      <QuestionForm subjects={subjects} />
    </div>
  );
}
