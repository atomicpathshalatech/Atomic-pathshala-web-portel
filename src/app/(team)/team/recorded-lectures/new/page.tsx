import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { RecordedLectureCreateForm } from "@/components/recorded-lectures/RecordedLectureCreateForm";

export const metadata: Metadata = {
  title: "Upload Recorded Lecture — Atomic Pathshala",
};

/** A lecture is always added inside a chapter: /team/recorded-lectures/new?chapterId=… */
export default async function NewRecordedLecturePage({ searchParams }: { searchParams: { chapterId?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!(await hasPermission(session.user.id, PERMISSIONS.RECORDED_LECTURE_MANAGE))) redirect("/team/recorded-lectures");
  if (!searchParams.chapterId) redirect("/team/recorded-lectures");
  return <RecordedLectureCreateForm chapterId={searchParams.chapterId} />;
}
