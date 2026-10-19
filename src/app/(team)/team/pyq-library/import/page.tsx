import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { PyqImportForm } from "@/components/pyq/PyqImportForm";

export const metadata: Metadata = { title: "Import PYQ PDF" };

export default async function PyqImportPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!(await hasPermission(session.user.id, PERMISSIONS.QUESTION_IMPORT))) redirect("/team");
  return <PyqImportForm />;
}
