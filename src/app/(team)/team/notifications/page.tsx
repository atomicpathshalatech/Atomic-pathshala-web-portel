import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { AdminNotificationHub } from "@/components/team-portal/AdminNotificationHub";

export const metadata: Metadata = {
  title: "Notifications Control Center | Atomic Pathshala",
};

export default async function TeamNotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.NOTIFICATION_READ);
  if (!canRead) redirect("/team");

  const canSend = await hasPermission(session.user.id, PERMISSIONS.NOTIFICATION_SEND);

  const [batches, broadcasts] = await Promise.all([
    prisma.batch.findMany({
      where: { status: { in: ["UPCOMING", "ACTIVE"] } },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    prisma.notificationBroadcast.findMany({
      include: { sentBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  return (
    <div className="space-y-6 max-w-6xl">
      <AdminNotificationHub
        canSend={canSend}
        batches={batches}
        initialBroadcasts={broadcasts.map((b) => ({
          id: b.id,
          title: b.title,
          body: b.body,
          segmentType: b.segmentType,
          segmentValue: b.segmentValue,
          recipientCount: b.recipientCount,
          sentByName: b.sentBy?.name ?? "Admin",
          createdAt: b.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}

