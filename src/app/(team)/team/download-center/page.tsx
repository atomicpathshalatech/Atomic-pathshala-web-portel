import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { DownloadCenterClient } from "@/components/team-portal/DownloadCenterClient";

export const metadata: Metadata = {
  title: "Download Center & Resource Hub",
};

export default async function DownloadCenterPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  await requirePermission(session.user.id, PERMISSIONS.TEAM_PORTAL_ACCESS);

  const initialLogs = await prisma.resourceAuditLog.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return (
    <div className="space-y-6">
      <DownloadCenterClient initialLogs={initialLogs} />
    </div>
  );
}
