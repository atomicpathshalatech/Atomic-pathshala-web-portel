import {
  NotificationType,
  NotificationCategory,
  NotificationPriority,
  NotificationStatus,
  NotificationChannel,
  DevicePlatform,
  ScheduledNotificationStatus,
  NotificationTargetType,
} from "@prisma/client";

export {
  NotificationType,
  NotificationCategory,
  NotificationPriority,
  NotificationStatus,
  NotificationChannel,
  DevicePlatform,
  ScheduledNotificationStatus,
  NotificationTargetType,
};

export interface NotificationPayload {
  title: string;
  body: string;
  deepLink?: string;
  category?: NotificationCategory;
  priority?: NotificationPriority | "normal" | "high" | "low" | "urgent";
  icon?: string;
  image?: string;
  actionType?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
  data?: Record<string, string>;
}

export interface EventTriggerInput {
  eventType: NotificationType;
  category?: NotificationCategory;
  priority?: NotificationPriority | "normal" | "high" | "low" | "urgent";
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
  icon?: string;
  image?: string;
  actionType?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
  recipientUserIds?: string[];
  scheduledFor?: Date;
  expiresAt?: Date;
  channel?: NotificationChannel | "ALL";
  idempotencyKey?: string;
  createdById?: string;
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
