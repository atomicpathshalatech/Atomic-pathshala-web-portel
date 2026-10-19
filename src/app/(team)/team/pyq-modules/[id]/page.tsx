import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { QuestionModuleEditor } from "@/components/pyq/QuestionModuleEditor";

export const metadata: Metadata = { title: "Question Module" };

export default async function QuestionModulePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!(await hasPermission(session.user.id, PERMISSIONS.MODULE_READ))) redirect("/team");
  const canEdit = await hasPermission(session.user.id, PERMISSIONS.MODULE_UPDATE);
  return <QuestionModuleEditor moduleId={params.id} canEdit={canEdit} />;
}
