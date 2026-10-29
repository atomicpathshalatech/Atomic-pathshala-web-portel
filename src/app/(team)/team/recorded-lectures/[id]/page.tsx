import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { RecordedLectureEditor } from "@/components/recorded-lectures/RecordedLectureEditor";

export const metadata: Metadata = {
  title: "Recorded Lecture — Atomic Pathshala",
};

/** Access (manager, or this lecture's own teacher) is enforced by the API the editor loads from. */
export default async function RecordedLecturePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  return <RecordedLectureEditor lectureId={params.id} />;
}
