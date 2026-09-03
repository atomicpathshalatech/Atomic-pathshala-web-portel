import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { AtomicQuestionEditor } from "@/components/questions/AtomicQuestionEditor";

export const metadata: Metadata = {
  title: "Edit Question — Unified Engine",
};

export default async function EditQuestionPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canUpdate = await hasPermission(session.user.id, PERMISSIONS.QUESTION_UPDATE);
  if (!canUpdate) redirect("/team/questions");

  const question = await prisma.question.findUnique({
    where: { id: params.id },
    include: {
      translations: true,
      assets: true,
    },
  });

  if (!question) notFound();

  const refAsset = question.assets.find((a) => a.type === "REFERENCE");
  const solAsset = question.assets.find((a) => a.type === "SOLUTION");

  const initialQuestion = {
    ...question,
    referenceImageUrl: refAsset?.publicUrl || question.imageUrl,
    solutionImageUrl: solAsset?.publicUrl || null,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <AtomicQuestionEditor
        questionId={question.id}
        initialQuestion={initialQuestion}
        onCancelHref="/team/questions"
      />
    </div>
  );
}
