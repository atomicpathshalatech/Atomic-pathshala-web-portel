import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NotificationFeed } from "@/components/student/NotificationFeed";

export const metadata: Metadata = {
  title: "Notifications | Atomic Pathshala",
};

export default async function UniversalNotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const rawNotifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const initial = rawNotifications.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    type: n.type,
    category: n.category,
    priority: n.priority,
    actionType: n.actionType,
    actionUrl: n.actionUrl,
    deepLink: n.deepLink,
    metadata: n.metadata,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  }));

  const userRole = (session.user as any)?.role || "STUDENT";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-3 sm:p-6">
      <NotificationFeed initial={initial} userRole={userRole} />
    </div>
  );
}
