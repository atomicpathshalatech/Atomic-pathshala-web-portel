"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { getPusherClient } from "@/lib/realtime/pusher-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export interface RealtimeNotificationItem {
  id: string;
  title: string;
  body: string;
  type: string;
  deepLink?: string | null;
  createdAt: string;
  metadata?: any;
}

export function useRealtimeNotifications() {
  const { data: session } = useSession();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [latestNotification, setLatestNotification] = useState<RealtimeNotificationItem | null>(null);

  // Fetch initial unread count on mount
  useEffect(() => {
    if (!session?.user?.id) return;

    fetch("/api/notifications/unread-count")
      .then((res) => res.json())
      .then((data) => {
        if (typeof data?.data?.count === "number") {
          setUnreadCount(data.data.count);
        }
      })
      .catch(() => {});
  }, [session?.user?.id]);

  // Subscribe to user private channel on Pusher
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    const client = getPusherClient();
    const channelName = `private-user-${userId}`;
    const channel = client.subscribe(channelName);

    // 1. New notification received in realtime
    channel.bind("notification:new", (item: RealtimeNotificationItem & { unreadCount?: number }) => {
      setLatestNotification(item);
      if (typeof item.unreadCount === "number") {
        setUnreadCount(item.unreadCount);
      } else {
        setUnreadCount((c) => c + 1);
      }

      // Show in-app interactive toast notification
      toast(item.title, {
        description: item.body,
        duration: 6000,
        action: item.deepLink
          ? {
              label: "Open",
              onClick: () => router.push(item.deepLink!),
            }
          : undefined,
      });

      // Dispatch window event so open feeds update immediately without full reload
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("atomic:notification_received", { detail: item }));
      }
    });

    // 2. Unread count update
    channel.bind("notification:unread_count", (data: { unreadCount: number }) => {
      if (typeof data.unreadCount === "number") {
        setUnreadCount(data.unreadCount);
      }
    });

    // 3. Class live now alert
    channel.bind("class:live_now", (data: { classId: string; title: string; deepLink: string }) => {
      toast(`🔴 Class is LIVE: ${data.title}`, {
        description: "Your live class has started. Join now!",
        duration: 10000,
        action: {
          label: "Join Now",
          onClick: () => router.push(data.deepLink || `/live-class/${data.classId}`),
        },
      });
    });

    return () => {
      channel.unbind_all();
      client.unsubscribe(channelName);
    };
  }, [session?.user?.id, router]);

  const decrementUnread = useCallback(() => {
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const resetUnread = useCallback(() => {
    setUnreadCount(0);
  }, []);

  return { unreadCount, latestNotification, decrementUnread, resetUnread };
}
