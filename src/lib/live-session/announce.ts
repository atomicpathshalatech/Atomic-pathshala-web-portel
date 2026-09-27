import "server-only";
import { pusherServer, sessionChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";

/**
 * Tells students a class is LIVE: the realtime state push plus the
 * "Live Now" notification. Called only once the class really is live — at
 * Start Class for room/mapped classes, and from the YouTube health gate for
 * APP_YOUTUBE classes (never while still connecting).
 */
export async function announceClassLive(input: {
  schedule: { id: string; title: string; batchId: string };
  whiteboardSessionId: string;
  /** Extra channel id clients may be subscribed on (the schedule id). */
  aliasChannelId?: string;
  videoTransport: string;
  youtubeVideoId: string | null;
  startedAt: Date;
}) {
  const now = new Date();
  const livePhasePayload = {
    phase: "LIVE",
    livePhase: "LIVE",
    videoTransport: input.videoTransport,
    youtubeVideoId: input.youtubeVideoId,
    actualStartedAt: input.startedAt.toISOString(),
    serverTime: now.toISOString(),
  };
  const configPayload = { videoTransport: input.videoTransport, youtubeVideoId: input.youtubeVideoId };
  try {
    await pusherServer.trigger(sessionChannel(input.whiteboardSessionId), WB_EVENTS.LIVE_PHASE_CHANGED, livePhasePayload);
    await pusherServer.trigger(sessionChannel(input.whiteboardSessionId), WB_EVENTS.CONFIG_UPDATED, configPayload);
    if (input.aliasChannelId && input.aliasChannelId !== input.whiteboardSessionId) {
      await pusherServer.trigger(sessionChannel(input.aliasChannelId), WB_EVENTS.LIVE_PHASE_CHANGED, livePhasePayload);
      await pusherServer.trigger(sessionChannel(input.aliasChannelId), WB_EVENTS.CONFIG_UPDATED, configPayload);
    }
  } catch (pushErr) {
    console.warn("Realtime broadcast warning:", pushErr);
  }

  try {
    const { triggerNotificationEvent } = await import("@/lib/notifications/engine");
    const { cancelScheduledNotifications } = await import("@/lib/notifications/scheduler");
    const { NotificationType, NotificationCategory, NotificationPriority } = await import("@/lib/notifications/types");

    // Cancel any future scheduled start alert or 15m reminder to prevent duplicates
    await cancelScheduledNotifications(NotificationType.CLASS_STARTED, input.schedule.id).catch(() => {});
    await cancelScheduledNotifications(NotificationType.CLASS_REMINDER_15_MIN, input.schedule.id).catch(() => {});

    await triggerNotificationEvent({
      eventType: NotificationType.LIVE_CLASS_STARTED,
      category: NotificationCategory.CLASSES,
      priority: NotificationPriority.HIGH,
      entityId: input.schedule.id,
      classId: input.schedule.id,
      batchId: input.schedule.batchId,
      title: `🔴 Live Now: ${input.schedule.title}`,
      body: `Your live class has started. Tap to join now!`,
      deepLink: `/live-class/${input.schedule.id}`,
      actionType: "JOIN_CLASS",
      actionUrl: `/live-class/${input.schedule.id}`,
      metadata: {
        classId: input.schedule.id,
        className: input.schedule.title,
        liveStartedAt: input.startedAt.toISOString(),
        batchId: input.schedule.batchId,
      },
      idempotencyKey: `class-live:${input.schedule.id}`,
    });
  } catch (err) {
    console.error("[LIVE_CLASS_STARTED notification error]", err);
  }
}
