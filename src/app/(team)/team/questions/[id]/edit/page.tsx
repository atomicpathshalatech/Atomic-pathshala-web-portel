import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { QuestionForm } from "@/components/team-portal/QuestionForm";

export const metadata: Metadata = {
  title: "Edit Question",
};

export default async function EditQuestionPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canUpdate = await hasPermission(session.user.id, PERMISSIONS.QUESTION_UPDATE);
  if (!canUpdate) redirect("/team/questions");

  const [question, subjects] = await Promise.all([
    prisma.question.findUnique({ where: { id: params.id } }),
    prisma.subject.findMany({
      include: { chapters: { select: { id: true, title: true } } },
      orderBy: { title: "asc" },
    }),
  ]);

  if (!question) notFound();

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary">Edit Question</h1>
        <p className="text-on-surface-variant font-body-md mt-1">
          Editing will not change its verification status.
        </p>
      </div>
      <QuestionForm
        subjects={subjects}
        questionId={question.id}
        initialData={{
          body: question.body,
          type: question.type,
          optionA: question.optionA ?? undefined,
          optionB: question.optionB ?? undefined,
          optionC: question.optionC ?? undefined,
          optionD: question.optionD ?? undefined,
          correctOption: question.correctOption,
          explanation: question.explanation ?? undefined,
          marksCorrect: question.marksCorrect,
          marksIncorrect: question.marksIncorrect,
          difficulty: question.difficulty,
          tags: question.tags,
          subjectId: question.subjectId ?? "",
          chapterId: question.chapterId ?? "",
        }}
      />
    </div>
  );
}
