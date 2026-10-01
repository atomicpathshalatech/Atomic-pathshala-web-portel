import type { Metadata } from "next";
import { requireStudentSession } from "@/lib/auth/session";
import { loadMyDoubts } from "@/lib/doubts/my-doubts";
import { MyDoubtsView } from "@/components/student-portal/MyDoubtsView";

export const metadata: Metadata = {
  title: "My Doubts",
};

export default async function DoubtsPage() {
  const { student } = await requireStudentSession();
  const items = await loadMyDoubts(student.id, student.user.id);
  return <MyDoubtsView items={items} />;
}
