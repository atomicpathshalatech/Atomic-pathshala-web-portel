import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { QuestionReportsWorkspace } from "@/components/team-portal/QuestionReportsWorkspace";

export const metadata: Metadata = {
  title: "Question Reports",
};

export default async function QuestionReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.QUESTION_READ);
  if (!canRead) redirect("/team");

  const canResolve = await hasPermission(session.user.id, PERMISSIONS.QUESTION_VERIFY);

  return <QuestionReportsWorkspace canResolve={canResolve} currentUserId={session.user.id} />;
}
