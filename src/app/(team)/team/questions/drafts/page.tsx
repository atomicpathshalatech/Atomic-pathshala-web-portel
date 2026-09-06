import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { AiDraftsFolderView } from "@/components/questions/AiDraftsFolderView";

export const metadata: Metadata = {
  title: "AI Drafts Folder — Auto-Saved Questions Repository",
  description:
    "Review, edit, and approve all AI and OCR auto-saved draft questions in one safe centralized folder.",
};

export const dynamic = "force-dynamic";

export default async function AiDraftsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.QUESTION_READ);
  if (!canRead) redirect("/team");

  const canCreate = await hasPermission(session.user.id, PERMISSIONS.QUESTION_CREATE);
  const canVerify = await hasPermission(session.user.id, PERMISSIONS.QUESTION_VERIFY);

  // Fetch all AI / OCR / Guru drafts
  const drafts = await prisma.question.findMany({
    where: {
      status: "DRAFT",
      OR: [
        { category: { startsWith: "AI" } },
        { category: { contains: "ATOMIC_GURU" } },
        { tags: { contains: "AI_AUTO_DRAFT" } },
        { tags: { contains: "AI_GENERATED" } },
        { tags: { contains: "ATOMIC_GURU" } },
      ],
    },
    include: {
      translations: true,
      assets: true,
      createdBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <AiDraftsFolderView
        initialDrafts={drafts as any}
        canCreate={canCreate}
        canVerify={canVerify}
        currentUserId={session.user.id}
      />
    </div>
  );
}
