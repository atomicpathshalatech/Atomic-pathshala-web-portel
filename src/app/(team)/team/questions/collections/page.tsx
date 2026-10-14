import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { QuestionCollectionsWorkspace } from "@/components/team-portal/question-review/QuestionCollectionsWorkspace";

export const metadata: Metadata = {
  title: "Question Collections",
};

export default async function QuestionCollectionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!(await hasPermission(session.user.id, PERMISSIONS.QUESTION_READ))) redirect("/team");
  const canEdit = await hasPermission(session.user.id, PERMISSIONS.QUESTION_UPDATE);
  return <QuestionCollectionsWorkspace canEdit={canEdit} />;
}
