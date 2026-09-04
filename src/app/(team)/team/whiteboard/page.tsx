import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export const metadata: Metadata = {
  title: "Live Classroom Studio — Atomic Pathshala",
};

export default async function TeamWhiteboardPage({
  searchParams,
}: {
  searchParams?: { scheduleId?: string; lectureId?: string; chapterId?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canAccess = await hasPermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);
  if (!canAccess) redirect("/team");

  const query = new URLSearchParams();
  if (searchParams?.scheduleId) query.set("scheduleId", searchParams.scheduleId);
  if (searchParams?.lectureId) query.set("lectureId", searchParams.lectureId);
  if (searchParams?.chapterId) query.set("chapterId", searchParams.chapterId);

  const qs = query.toString();
  redirect(qs ? `/team/live-studio?${qs}` : "/team/live-studio");
}
