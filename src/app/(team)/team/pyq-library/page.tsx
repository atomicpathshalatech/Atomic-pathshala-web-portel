import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { Suspense } from "react";
import { PyqLibraryWorkspace } from "@/components/pyq/PyqLibraryWorkspace";

export const metadata: Metadata = { title: "PYQ Library" };

export default async function PyqLibraryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!(await hasPermission(session.user.id, PERMISSIONS.QUESTION_READ))) redirect("/team");
  const [canImport, canBuildModules] = await Promise.all([
    hasPermission(session.user.id, PERMISSIONS.QUESTION_IMPORT),
    hasPermission(session.user.id, PERMISSIONS.MODULE_UPDATE),
  ]);
  return (
    <Suspense fallback={<p className="p-4 text-sm text-slate-500">Loading PYQ Library…</p>}>
      <PyqLibraryWorkspace canImport={canImport} canBuildModules={canBuildModules} />
    </Suspense>
  );
}
