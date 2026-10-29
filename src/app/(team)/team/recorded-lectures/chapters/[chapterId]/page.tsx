import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { RecordedChapterView } from "@/components/recorded-lectures/RecordedChapterView";

export const metadata: Metadata = {
  title: "Recorded Lecture Chapter — Atomic Pathshala",
};

export default async function RecordedChapterPage({ params }: { params: { chapterId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!(await hasPermission(session.user.id, PERMISSIONS.RECORDED_LECTURE_MANAGE))) redirect("/team/recorded-lectures");
  return <RecordedChapterView chapterId={params.chapterId} />;
}
