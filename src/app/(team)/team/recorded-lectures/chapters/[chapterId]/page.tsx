import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/rbac/guard";
import { RecordedChapterView } from "@/components/recorded-lectures/RecordedChapterView";

export const metadata: Metadata = {
  title: "Recorded Lecture Chapter — Atomic Pathshala",
};

export default async function RecordedChapterPage({ params }: { params: { chapterId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  // Recorded lectures are private to the Super Admin.
  if (!(await isSuperAdminUser(session.user.id))) redirect("/team");
  return <RecordedChapterView chapterId={params.chapterId} />;
}
