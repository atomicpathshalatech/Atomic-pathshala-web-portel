import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { WhiteboardCanvas } from "@/components/shared/WhiteboardCanvas";

export const metadata: Metadata = {
  title: "Whiteboard",
};

export default async function TeamWhiteboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canAccess = await hasPermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);
  if (!canAccess) redirect("/team");

  const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
  if (!teacher) {
    // Permission granted but no Teacher profile (shouldn't normally happen for
    // roles holding WHITEBOARD_ACCESS, but fail safe like the rest of the portal).
    redirect("/team");
  }

  const boards = await prisma.whiteboardBoard.findMany({
    where: { teacherId: teacher.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, thumbnailDataUrl: true, updatedAt: true },
  });

  return (
    <div className="space-y-stack-md">
      <div>
        <h1 className="font-headline-lg text-headline-lg">Whiteboard</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Your personal practice and session board.
        </p>
      </div>

      <WhiteboardCanvas
        apiBasePath="/api/team/whiteboard"
        initialBoards={boards.map((b) => ({
          id: b.id,
          title: b.title,
          thumbnailDataUrl: b.thumbnailDataUrl,
          updatedAt: b.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
