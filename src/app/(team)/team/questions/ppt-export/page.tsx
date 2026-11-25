import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { QuestionPptExporterClient } from "@/components/team-portal/QuestionPptExporterClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Question ID to PPT | Atomic Pathshala",
};

export default async function QuestionPptExportPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const allowed = await hasPermission(session.user.id, PERMISSIONS.QUESTION_READ);
  if (!allowed) redirect("/team");

  return <QuestionPptExporterClient userName={session.user.name || "Teacher"} />;
}
