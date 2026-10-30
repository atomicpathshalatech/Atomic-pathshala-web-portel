import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/rbac/guard";
import { RecordedChaptersManager } from "@/components/recorded-lectures/RecordedChaptersManager";

export const metadata: Metadata = {
  title: "Recorded Lectures — Atomic Pathshala",
};

/**
 * Recorded lectures are private to the Super Admin: no other team member
 * (Admin or teacher) sees this page or the lectures. Chapters first
 * (create a chapter → add it to batches → choose students → add lectures).
 */
export default async function RecordedLecturesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!(await isSuperAdminUser(session.user.id))) redirect("/team");
  return <RecordedChaptersManager />;
}
