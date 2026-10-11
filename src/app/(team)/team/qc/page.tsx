import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { QcWorkspace } from "@/components/team-portal/QcWorkspace";

export const metadata: Metadata = {
  title: "Question QC",
};

export default async function QuestionQcPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canView = await hasPermission(session.user.id, PERMISSIONS.QUESTION_VERIFY);
  if (!canView) redirect("/team");

  const canApply = await hasPermission(session.user.id, PERMISSIONS.QUESTION_APPROVE);

  return <QcWorkspace canApply={canApply} />;
}
