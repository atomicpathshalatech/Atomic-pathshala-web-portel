import { NotificationType, NotificationChannel, DevicePlatform, ScheduledNotificationStatus, NotificationTargetType } from "@prisma/client";

export { NotificationType, NotificationChannel, DevicePlatform, ScheduledNotificationStatus, NotificationTargetType };

export interface NotificationPayload {
  title: string;
  body: string;
  deepLink?: string;
  metadata?: Record<string, any>;
  data?: Record<string, string>;
  priority?: "normal" | "high";
}

export interface EventTriggerInput {
  eventType: NotificationType;
  entityId?: string;
  batchId?: string;
  courseId?: string;
  chapterId?: string;
  classId?: string;
  testId?: string;
  dppId?: string;
  title: string;
  body: string;
  deepLink?: string;
  metadata?: Record<string, any>;
  recipientUserIds?: string[];
  scheduledFor?: Date;
  expiresAt?: Date;
  priority?: "normal" | "high";
  channel?: NotificationChannel | "ALL";
  idempotencyKey?: string;
}

export interface PushResult {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
}

export interface EngineDispatchResult {
  dispatchedCount: number;
  scheduled: boolean;
  skipped: boolean;
  reason?: string;
}
