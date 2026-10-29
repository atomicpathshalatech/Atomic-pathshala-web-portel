import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { RecordedLecturesManager } from "@/components/recorded-lectures/RecordedLecturesManager";
import { RecordedChaptersManager } from "@/components/recorded-lectures/RecordedChaptersManager";

export const metadata: Metadata = {
  title: "Recorded Lectures — Atomic Pathshala",
};

export default async function RecordedLecturesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const [manage, read] = await Promise.all([
    hasPermission(session.user.id, PERMISSIONS.RECORDED_LECTURE_MANAGE),
    hasPermission(session.user.id, PERMISSIONS.LECTURE_READ),
  ]);
  if (!manage && !read) redirect("/team");
  // Admins: chapters first (create a chapter → add it to batches → add lectures).
  // Teachers: their own recorded lectures, to write the About and summary.
  return manage ? <RecordedChaptersManager /> : <RecordedLecturesManager />;
}
