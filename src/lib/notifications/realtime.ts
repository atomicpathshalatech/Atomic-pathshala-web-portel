import { pusherServer } from "@/lib/realtime/pusher-server";

export const NOTIFICATION_CHANNELS = {
  user: (userId: string) => `private-user-${userId}`,
  batch: (batchId: string) => `private-batch-${batchId}`,
};

export const NOTIFICATION_EVENTS = {
  NEW: "notification:new",
  UNREAD_COUNT: "notification:unread_count",
  CLASS_LIVE_NOW: "class:live_now",
  TEST_LIVE_NOW: "test:live_now",
} as const;

/**
 * Publishes an in-app realtime event to a specific user's private notification channel.
 */
export async function sendUserRealtimeNotification(
  userId: string,
  payload: {
    id: string;
    title: string;
    body: string;
    type: string;
    deepLink?: string | null;
    createdAt: string;
    unreadCount?: number;
    metadata?: any;
  }
): Promise<boolean> {
  try {
    const channel = NOTIFICATION_CHANNELS.user(userId);
    await pusherServer.trigger(channel, NOTIFICATION_EVENTS.NEW, payload);

    if (typeof payload.unreadCount === "number") {
      await pusherServer.trigger(channel, NOTIFICATION_EVENTS.UNREAD_COUNT, {
        unreadCount: payload.unreadCount,
      });
    }
    return true;
  } catch (error) {
    console.warn(`[Pusher Realtime Warning] Could not send to user ${userId}:`, error);
    return false;
  }
}

/**
 * Publishes a batch-wide in-app realtime event (e.g. for live updates).
 */
export async function sendBatchRealtimeNotification(
  batchId: string,
  event: string,
  data: any
): Promise<boolean> {
  try {
    const channel = NOTIFICATION_CHANNELS.batch(batchId);
    await pusherServer.trigger(channel, event, data);
    return true;
  } catch (error) {
    console.warn(`[Pusher Realtime Warning] Could not send to batch ${batchId}:`, error);
    return false;
  }
}
