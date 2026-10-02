import { notFound, redirect } from "next/navigation";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { ensureDppTest } from "@/lib/dpp/dpp-test";

export const dynamic = "force-dynamic";

/**
 * Opens a chapter DPP in the exam room: syncs its backing test (same
 * questions, in order) and sends the student to the regular attempt page —
 * or straight to the result if they've already submitted it.
 */
export default async function DppAttemptPage({ params }: { params: { id: string } }) {
  const { session } = await requireStudentSession();
  const student = await prisma.student.findUnique({ where: { userId: session.user.id }, select: { id: true, status: true } });
  if (!student || student.status !== "ACTIVE") redirect("/dpp");

  const dpp = await prisma.dpp.findUnique({ where: { id: params.id }, select: { id: true, status: true } });
  if (!dpp) notFound();
  if (dpp.status !== "PUBLISHED" && dpp.status !== "ACTIVE") redirect("/dpp");

  const backing = await ensureDppTest(dpp.id);
  if (!backing || !backing.published) redirect("/dpp");

  const attempt = await prisma.attempt.findUnique({
    where: { testId_studentId: { testId: backing.testId, studentId: student.id } },
    select: { status: true },
  });
  if (attempt && attempt.status !== "IN_PROGRESS") redirect(`/tests/${backing.testId}/result`);
  redirect(`/tests/${backing.testId}/attempt`);
}
