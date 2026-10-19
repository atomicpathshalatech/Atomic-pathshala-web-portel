import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { QuestionModuleList } from "@/components/pyq/QuestionModuleList";

export const metadata: Metadata = { title: "Question Modules" };

export default async function QuestionModulesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!(await hasPermission(session.user.id, PERMISSIONS.MODULE_READ))) redirect("/team");
  const [canCreate, canDelete] = await Promise.all([
    hasPermission(session.user.id, PERMISSIONS.MODULE_CREATE),
    hasPermission(session.user.id, PERMISSIONS.MODULE_DELETE),
  ]);
  return <QuestionModuleList canCreate={canCreate} canDelete={canDelete} />;
}
