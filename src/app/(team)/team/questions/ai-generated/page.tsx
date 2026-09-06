import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { AiQuestionStudio } from "@/components/ai-question-generator/AiQuestionStudio";

export const metadata: Metadata = {
  title: "AI Generated Questions — Universal NEET Engine",
  description:
    "Generate, validate, and publish production-grade NCERT NEET questions from PDF documents and syllabus taxonomy.",
};

export default async function AiGeneratedQuestionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canCreate = await hasPermission(session.user.id, PERMISSIONS.QUESTION_CREATE);
  if (!canCreate) redirect("/team/questions");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <AiQuestionStudio />
    </div>
  );
}
