import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { canManageTest } from "@/lib/test-engine/access";
import { TestReviewClient, type ReviewQuestion } from "@/components/team-portal/TestReviewClient";

export const metadata: Metadata = {
  title: "Review Test (Laptop & Mobile Mode) | Atomic Pathshala",
};

export default async function TestReviewPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.TEST_READ);
  if (!canRead) redirect("/team");

  const test = await prisma.test.findUnique({
    where: { id: params.id },
    include: {
      testSeries: { select: { id: true, name: true } },
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

  const manageable = await canManageTest(session.user.id, test.batchScheduleId);
  if (!manageable) redirect("/team/tests");

  // Flatten and normalize questions for review
  const questions: ReviewQuestion[] = [];

  for (const section of test.sections) {
    for (const sq of section.questions) {
      const q = sq.question;
      const enTrans = q.translations.find((t) => t.language === "ENGLISH") || q.translations[0];
      const hiTrans = q.translations.find((t) => t.language === "HINDI");

      const enOpts = (enTrans?.options as Record<string, string>) || {};
      const hiOpts = (hiTrans?.options as Record<string, string>) || {};

      let correctKeys: string[] = [];
      if (Array.isArray(enTrans?.correctOptionIds)) {
        correctKeys = (enTrans.correctOptionIds as string[]).map((k) => String(k).trim().toUpperCase());
      } else if (typeof enTrans?.correctOptionIds === "string") {
        try {
          const parsed = JSON.parse(enTrans.correctOptionIds);
          if (Array.isArray(parsed)) correctKeys = parsed.map((k) => String(k).trim().toUpperCase());
          else correctKeys = [String(enTrans.correctOptionIds).trim().toUpperCase()];
        } catch {
          correctKeys = [String(enTrans.correctOptionIds).trim().toUpperCase()];
        }
      }

      questions.push({
        id: q.id,
        order: sq.order,
        subject: section.subject || q.subject || "General",
        bodyEn: enTrans?.statement || "",
        bodyHi: hiTrans?.statement || null,
        optionsEn: enOpts,
        optionsHi: hiOpts,
        correctOptionKeys: correctKeys,
        solutionEn: enTrans?.solution || null,
        solutionHi: hiTrans?.solution || null,
        marks: sq.marksOverride ?? section.marksPerQuestion ?? test.correctMarks ?? 4,
        negativeMarks: sq.negativeMarksOverride ?? section.negativeMarks ?? test.incorrectMarks ?? -1,
      });
    }
  }

  return (
    <div className="p-2 sm:p-4">
      <TestReviewClient
        test={{
          id: test.id,
          name: test.name,
          code: test.code,
          durationMin: test.durationMin,
          testSeriesId: test.testSeriesId,
          testSeriesName: test.testSeries?.name,
          examType: test.examType,
          questions,
        }}
      />
    </div>
  );
}
