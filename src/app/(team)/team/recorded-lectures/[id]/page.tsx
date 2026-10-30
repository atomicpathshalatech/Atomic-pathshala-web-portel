import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/rbac/guard";
import { RecordedLectureEditor } from "@/components/recorded-lectures/RecordedLectureEditor";

export const metadata: Metadata = {
  title: "Recorded Lecture — Atomic Pathshala",
};

/** Super Admin only (recorded lectures are private); the APIs the editor loads from check the same. */
export default async function RecordedLecturePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!(await isSuperAdminUser(session.user.id))) redirect("/team");
  return <RecordedLectureEditor lectureId={params.id} />;
}
