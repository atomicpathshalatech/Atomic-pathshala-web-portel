import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { BilingualQuestionForm } from "@/components/team-portal/BilingualQuestionForm";

export const metadata: Metadata = {
  title: "Create Question (Bilingual)",
};

export default async function NewBilingualQuestionPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canCreate = await hasPermission(session.user.id, PERMISSIONS.QUESTION_CREATE);
  if (!canCreate) redirect("/team/questions");

  const subjects = await prisma.subject.findMany({
    include: { chapters: { select: { id: true, title: true } } },
    orderBy: { title: "asc" },
  });

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary">Create Question (Bilingual)</h1>
        <p className="text-on-surface-variant font-body-md mt-1">
          Add a question in Hindi, English, or both — the full Question Bank v2 model (PYQ source, question
          code, topic/sub-topic).
        </p>
      </div>
      <BilingualQuestionForm subjects={subjects} />
    </div>
  );
}
