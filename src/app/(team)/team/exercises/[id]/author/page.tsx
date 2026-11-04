import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ExerciseQuestionAuthor } from "@/components/exercises/ExerciseQuestionAuthor";

export const metadata: Metadata = {
  title: "Add New Question — Exercise Builder",
};

/**
 * Exercise Builder → "Add New Question": the same question editor as a test's
 * (paste / image extraction, AI solution, translation check, metadata), with
 * the subject and chapter fixed to the exercise and the topic to its part.
 * Each saved question goes into the Question Bank and into this exercise.
 */
export default async function ExerciseAuthorPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { section?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!(await hasPermission(session.user.id, PERMISSIONS.QUESTION_CREATE))) redirect(`/team/exercises/${params.id}`);

  const exercise = await prisma.exercise.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      subject: true,
      chapter: true,
      exerciseType: true,
      sections: { orderBy: { order: "asc" }, select: { id: true, title: true, topic: true, subTopic: true } },
      _count: { select: { questions: true } },
    },
  });
  if (!exercise) notFound();

  const section = exercise.sections.find((s) => s.id === searchParams.section) ?? null;

  return (
    <ExerciseQuestionAuthor
      exercise={{
        id: exercise.id,
        title: exercise.title,
        subject: exercise.subject,
        chapter: exercise.chapter,
        exerciseType: exercise.exerciseType,
        questionCount: exercise._count.questions,
      }}
      sections={exercise.sections}
      initialSectionId={section?.id ?? null}
    />
  );
}
