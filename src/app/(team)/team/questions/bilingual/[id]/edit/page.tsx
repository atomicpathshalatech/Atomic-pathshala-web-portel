import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { BilingualQuestionForm } from "@/components/team-portal/BilingualQuestionForm";
import { reverseResolveSubjectChapterIds } from "@/lib/questions/legacy";
import type { BilingualQuestionInput } from "@/lib/validation/question-v2";

export const metadata: Metadata = {
  title: "Edit Question",
};

type OptionsJson = Partial<Record<"A" | "B" | "C" | "D", string>>;

export default async function EditBilingualQuestionPage({ params }: { params: { id: string } }) {
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

  const { subjectId, chapterId } = await reverseResolveSubjectChapterIds(prisma, question.subject, question.chapter);

  const initialData: Partial<BilingualQuestionInput> = {
    type: question.type,
    difficulty: question.difficulty,
    subjectId,
    chapterId,
    topic: question.topic ?? "",
    subTopic: question.subTopic ?? "",
    category: question.category ?? "",
    pyqSource: question.pyqSource ?? "",
    questionCode: question.questionCode ?? "",
    tags: question.tags ? question.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    translations: question.translations.map((t) => {
      const options = (t.options as OptionsJson | null) ?? {};
      return {
        language: t.language as "HINDI" | "ENGLISH",
        statement: t.statement,
        optionA: options.A ?? "",
        optionB: options.B ?? "",
        optionC: options.C ?? "",
        optionD: options.D ?? "",
        correctOptionIds: (t.correctOptionIds as string[] | null) ?? [],
        solution: t.solution ?? "",
      };
    }),
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary">Edit Question</h1>
      </div>
      <BilingualQuestionForm subjects={subjects} initialData={initialData} questionId={question.id} />
    </div>
  );
}
