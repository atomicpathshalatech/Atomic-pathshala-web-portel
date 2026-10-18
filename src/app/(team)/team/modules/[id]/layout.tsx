import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ModuleModeTabs } from "@/components/team-portal/ModuleModeTabs";

/** Every module page (original PDF editing, blocks, design) shares the mode tabs and the access check. */
export default async function ModuleLayout({ children, params }: { children: React.ReactNode; params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !(await hasPermission(session.user.id, PERMISSIONS.MODULE_READ))) notFound();
  const m = await prisma.module.findUnique({ where: { id: params.id }, select: { title: true } });
  if (!m) notFound();
  return (
    <div>
      <ModuleModeTabs moduleId={params.id} title={m.title} />
      {children}
    </div>
  );
}
