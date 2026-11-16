import type { Metadata } from "next";
import { requireStudentSession } from "@/lib/auth/session";
import { PyqPractice } from "@/components/student/PyqPractice";

export const metadata: Metadata = {
  title: "PYQ Practice",
};

export default async function PyqPracticePage() {
  await requireStudentSession();
  return (
    <div className="mx-auto max-w-3xl">
      <PyqPractice />
    </div>
  );
}
