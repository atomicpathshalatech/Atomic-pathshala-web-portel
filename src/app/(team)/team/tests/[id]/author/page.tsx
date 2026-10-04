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
                include: {
                  translations: true,
                  assets: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!test) notFound();

  const subjects = test.sections.map((sec) => {
    const isBio = sec.name?.toLowerCase().includes("bio") || sec.subject?.toLowerCase().includes("bio");
    const baseTarget = sec.targetCount && sec.targetCount > 0 ? sec.targetCount : isBio ? 90 : 45;
    const totalCount = baseTarget;
    return {
      name: sec.name || sec.subject || "Section",
      count: Math.min(sec.questions.length, totalCount),
      total: totalCount,
      sectionId: sec.id,
    };
  });

  const initialQuestions: import("@/components/questions/DualColumnQuestionStudio").QuestionEntry[] = [];
  let currentSectionOffset = 1;

  for (let sIdx = 0; sIdx < test.sections.length; sIdx++) {
    const sec = test.sections[sIdx];
    const secObj = subjects[sIdx];
    if (!sec || !secObj) continue;
    const sectionStart = currentSectionOffset;

    sec.questions.slice(0, secObj.total).forEach((sq, qIdx) => {
      const q = sq.question;
      const trEn = q.translations.find((t) => t.language === "ENGLISH");
      const trHi = q.translations.find((t) => t.language === "HINDI");
      const optEn = (trEn?.options as any) || {};
      const optHi = (trHi?.options as any) || {};
      const correct = (trEn?.correctOptionIds as any)?.[0] || (trHi?.correctOptionIds as any)?.[0] || "A";

      const slotOffset = typeof sq.order === "number" && sq.order > 0 ? sq.order - 1 : qIdx;
      if (slotOffset >= secObj.total) return;
      const slotNumber = sectionStart + slotOffset;

      const refAsset = q.assets?.find((a: any) => a.type === "REFERENCE" || a.type === "FIGURE");
      const resolvedImg = q.imageUrl || refAsset?.publicUrl || undefined;

      initialQuestions.push({
        id: q.id,
        questionCode: q.questionCode || undefined,
        questionNumber: slotNumber,
        subject: sec.name || q.subject,
        chapter: q.chapter || "",
        topic: q.topic || "",
        subTopic: q.subTopic || "",
        difficulty: q.difficulty as any,
        type: q.type as any,
        marks: 4,
        negativeMarks: 1,
        statementHi: trHi?.statement || "",
        statementEn: trEn?.statement || "",
        optionAHi: optHi.A || "",
        optionAEn: optEn.A || "",
        optionBHi: optHi.B || "",
        optionBEn: optEn.B || "",
        optionCHi: optHi.C || "",
        optionCEn: optEn.C || "",
        optionDHi: optHi.D || "",
        optionDEn: optEn.D || "",
        correctOption: correct,
        solutionHi: trHi?.solution || "",
        solutionEn: trEn?.solution || "",
        imageUrl: resolvedImg,
        referenceImageUrl: (q as any).referenceImageUrl || undefined,
        camDrawData: (q as any).camDrawData || undefined,
        isSaved: true,
      });
    });

    currentSectionOffset += secObj.total;
  }

  const totalQuestions = subjects.reduce(
    (acc, s) => acc + s.total,
    0
  );

  const isPublished = (test.status as string) === "APPROVED" || (test.status as string) === "PUBLISHED" || (test.status as string) === "ACTIVE";

  return (
    <DualColumnQuestionStudio
      mode="test"
      title={test.name || "Minor Test"}
      testId={test.id}
      totalQuestionsCount={totalQuestions || 180}
      subjects={subjects.length > 0 ? subjects : undefined}
      initialQuestions={initialQuestions.length > 0 ? initialQuestions : undefined}
      backHref={`/team/tests/${test.id}`}
      isPublished={isPublished}
    />
  );
}
