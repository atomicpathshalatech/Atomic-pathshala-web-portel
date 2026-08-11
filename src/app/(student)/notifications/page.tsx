import type { Metadata } from "next";
import { NotificationFeed } from "@/components/student-portal/NotificationFeed";

export const metadata: Metadata = {
  title: "Notifications",
};

export default function NotificationsPage() {
  return <NotificationFeed />;
}
