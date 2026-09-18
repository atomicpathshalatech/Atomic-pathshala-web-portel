import type { Metadata } from "next";
import Link from "next/link";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { DoubtForm } from "@/components/student-portal/DoubtForm";
import { AiDoubtSolver } from "@/components/student/AiDoubtSolver";
import { StudentDoubtList } from "@/components/student-portal/StudentDoubtList";

export const metadata: Metadata = {
  title: "Doubts",
};

export default async function DoubtsPage() {
  const { student } = await requireStudentSession();

  const doubts = await prisma.doubt.findMany({
    where: { studentId: student.id },
    orderBy: { createdAt: "desc" },
    include: { resolvedBy: { select: { name: true } } },
  });

  return (
    <div className="space-y-stack-lg max-w-6xl">
      <header>
        <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface">Doubt Portal</h1>
        <p className="text-body-lg text-on-surface-variant mt-2">
          Stuck on something? Use Atomic AI Tutor for instant step-by-step assistance or ask a faculty expert.
        </p>
      </header>

      <AiDoubtSolver />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_1.3fr] gap-gutter items-start">
        <DoubtForm />

        <div className="space-y-3">
          <h2 className="font-headline-md text-headline-md text-on-surface">Your Doubts</h2>
          <StudentDoubtList initialDoubts={doubts} />
        </div>
      </div>
    </div>
  );
}
