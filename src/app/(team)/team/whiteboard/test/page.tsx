import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getOrCreateTestLab } from "@/lib/whiteboard/test-lab";
import { TestLabHarness } from "@/components/whiteboard/TestLabHarness";

export const metadata: Metadata = {
  title: "Whiteboard Test Lab — Atomic Pathshala",
};

/**
 * Whiteboard Test Lab — enter the real classroom engine (same components,
 * same /api/whiteboard/sessions/* routes, same Pusher realtime) with no
 * scheduling. Admin + Teacher only (WHITEBOARD_ACCESS).
 */
export default async function WhiteboardTestLabPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canAccess = await hasPermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);
  if (!canAccess) redirect("/team");

  const { scheduleId, whiteboardSessionId } = await getOrCreateTestLab(session.user.id);
  const schedule = await prisma.batchSchedule.findUnique({
    where: { id: scheduleId },
    select: { endsAt: true },
  });

  return (
    <TestLabHarness
      batchScheduleId={scheduleId}
      whiteboardSessionId={whiteboardSessionId}
      currentUserId={session.user.id}
      endsAtIso={(schedule?.endsAt ?? new Date(Date.now() + 3600_000)).toISOString()}
    />
  );
}
