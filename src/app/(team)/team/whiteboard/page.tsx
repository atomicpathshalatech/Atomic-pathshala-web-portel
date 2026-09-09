import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export const metadata: Metadata = {
  title: "Whiteboard — Atomic Pathshala",
};

/**
 * The "Whiteboard" nav item used to redirect into /team/live-studio, which
 * only worked if you had a Teacher profile AND an assigned live class AND
 * were inside its T-15 window — otherwise it silently bounced to
 * /team/my-schedule. It now opens the Whiteboard Test Lab: the real
 * classroom engine, always available, with no scheduling.
 */
export default async function TeamWhiteboardPage({
  searchParams,
}: {
  searchParams?: { scheduleId?: string; lectureId?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canAccess = await hasPermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);
  if (!canAccess) redirect("/team");

  // A real class was explicitly requested — keep the existing live-class path.
  const realId = searchParams?.scheduleId || searchParams?.lectureId;
  if (realId) redirect(`/team/live-class/${realId}`);

  redirect("/team/whiteboard/test");
}
