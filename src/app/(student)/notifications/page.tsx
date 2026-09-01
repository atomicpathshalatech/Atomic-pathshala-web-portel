import type { Metadata } from "next";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { NotificationFeed } from "@/components/student/NotificationFeed";

export const metadata: Metadata = {
  title: "Notifications",
};

export default async function NotificationsPage() {
  const { session } = await requireStudentSession();

  const rawNotifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const initial = rawNotifications.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  }));

  return <NotificationFeed initial={initial} />;
}
