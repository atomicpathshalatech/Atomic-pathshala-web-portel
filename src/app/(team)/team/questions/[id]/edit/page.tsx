import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { QuestionForm } from "@/components/team-portal/QuestionForm";
import { toLegacyQuestion, reverseResolveSubjectChapterIds } from "@/lib/questions/legacy";

export const metadata: Metadata = {
  title: "Edit Question",
};

export default async function EditQuestionPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canUpdate = await hasPermission(session.user.id, PERMISSIONS.QUESTION_UPDATE);
  if (!canUpdate) redirect("/team/questions");

  const [question, subjects] = await Promise.all([
    prisma.question.findUnique({ where: { id: params.id }, include: { translations: true } }),
    prisma.subject.findMany({
      include: { chapters: { select: { id: true, title: true } } },
      orderBy: { title: "asc" },
    }),
  ]);

  if (!question) notFound();

  const legacy = toLegacyQuestion(question);
  const { subjectId, chapterId } = await reverseResolveSubjectChapterIds(
    prisma,
    legacy.subject,
    legacy.chapter
  );

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary">Edit Question</h1>
        <p className="text-on-surface-variant font-body-md mt-1">
          Editing will not change its publish status.
        </p>
      </div>
      <QuestionForm
        subjects={subjects}
        questionId={question.id}
        initialData={{
          body: legacy.body,
          type: legacy.type,
          optionA: legacy.optionA || undefined,
          optionB: legacy.optionB || undefined,
          optionC: legacy.optionC || undefined,
          optionD: legacy.optionD || undefined,
          correctOption: legacy.correctOption,
          explanation: legacy.explanation || undefined,
          difficulty: legacy.difficulty as "EASY" | "MEDIUM" | "HARD",
          tags: legacy.tags,
          subjectId,
          chapterId,
        }}
      />
    </div>
  );
}
