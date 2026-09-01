import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { DualColumnQuestionStudio } from "@/components/questions/DualColumnQuestionStudio";

export const metadata: Metadata = {
  title: "Test Question Authoring Studio — Atomic Pathshala",
};

export default async function TestAuthorPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canEdit = await hasPermission(session.user.id, PERMISSIONS.TEST_UPDATE);
  if (!canEdit) redirect("/team/tests");

  const test = await prisma.test.findUnique({
    where: { id: params.id },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: {
          questions: {
            orderBy: { order: "asc" },
            include: {
              question: {
                include: { translations: true },
              },
            },
          },
        },
      },
    },
  });

  if (!test) notFound();

  const subjects = test.sections.map((sec) => ({
    name: sec.name || "Section",
    count: sec.questions.length,
    total: 45,
  }));

  const totalQuestions = test.sections.reduce(
    (acc) => acc + 45,
    0
  );

  return (
    <DualColumnQuestionStudio
      mode="test"
      title={test.name || "Minor Test"}
      testId={test.id}
      totalQuestionsCount={totalQuestions || 180}
      subjects={subjects.length > 0 ? subjects : undefined}
      backHref={`/team/tests/${test.id}`}
    />
  );
}
