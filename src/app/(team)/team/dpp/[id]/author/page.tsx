import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { DualColumnQuestionStudio } from "@/components/questions/DualColumnQuestionStudio";

export const metadata: Metadata = {
  title: "DPP Question Authoring Studio — Atomic Pathshala",
};

export default async function DppAuthorPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.DPP_READ);
  if (!canRead) redirect("/team/dpp");

  const dpp = await prisma.dpp.findUnique({
    where: { id: params.id },
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
  });

  if (!dpp) notFound();

  const subjects = [
    {
      name: dpp.subject || "Subject",
      count: dpp.questions.length,
      total: dpp.questionTargetCount || 15,
    },
  ];

  return (
    <DualColumnQuestionStudio
      mode="dpp"
      title={`${dpp.name} (${dpp.code})`}
      dppId={dpp.id}
      totalQuestionsCount={dpp.questionTargetCount || 15}
      subjects={subjects}
      backHref={`/team/dpp/${dpp.id}`}
    />
  );
}
