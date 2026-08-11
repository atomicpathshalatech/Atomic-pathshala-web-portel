import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { DoubtDeskWorkspace } from "@/components/team-portal/DoubtDeskWorkspace";

export const metadata: Metadata = {
  title: "Doubt Desk",
};

export default async function DoubtDeskPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.DOUBT_READ);
  if (!canRead) redirect("/team");

  const canResolve = await hasPermission(session.user.id, PERMISSIONS.DOUBT_RESOLVE);

  return <DoubtDeskWorkspace canResolve={canResolve} />;
}
