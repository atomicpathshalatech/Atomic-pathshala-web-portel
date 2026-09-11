-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CLASS_STARTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LIVE_CLASS_STARTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TEST_STARTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_DPP';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_PDF';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_PPT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_STUDY_MATERIAL';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'OFFER_CREATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PROMOTIONAL_SCHEDULED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DAILY_MOTIVATION';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CUSTOM_SCHEDULED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BATCH_NOTIFICATION';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SYSTEM_ANNOUNCEMENT';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "NotificationCategory" AS ENUM ('CLASSES', 'TESTS', 'STUDY_MATERIAL', 'OFFERS', 'MOTIVATION', 'SYSTEM');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PROCESSING', 'SENT', 'PARTIALLY_SENT', 'FAILED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable notifications
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "category" "NotificationCategory" NOT NULL DEFAULT 'SYSTEM';
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "icon" TEXT;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "image" TEXT;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "actionType" TEXT;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "actionUrl" TEXT;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "entityType" TEXT;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "entityId" TEXT;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "batchId" TEXT;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "courseId" TEXT;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "status" "NotificationStatus" NOT NULL DEFAULT 'SENT';
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "clickedAt" TIMESTAMP(3);
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "notifications_category_idx" ON "notifications"("category");
CREATE INDEX IF NOT EXISTS "notifications_batchId_idx" ON "notifications"("batchId");

-- AlterTable notification_preferences
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "studyMaterial" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "offers" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "motivation" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "soundEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable notification_deliveries
CREATE TABLE IF NOT EXISTS "notification_deliveries" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable notification_templates
CREATE TABLE IF NOT EXISTS "notification_templates" (
    "id" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL DEFAULT 'SYSTEM',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "icon" TEXT,
    "image" TEXT,
    "actionType" TEXT,
    "actionUrl" TEXT,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "targetAudience" TEXT NOT NULL DEFAULT 'ALL_STUDENTS',
    "schedule" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rotationMessages" JSONB,
    "currentRotationIndex" INTEGER NOT NULL DEFAULT 0,
    "restartOnComplete" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable notification_rules
CREATE TABLE IF NOT EXISTS "notification_rules" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "channels" JSONB,
    "templateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable notification_action_logs
CREATE TABLE IF NOT EXISTS "notification_action_logs" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT,
    "studentId" TEXT,
    "userId" TEXT NOT NULL,
    "classId" TEXT,
    "testId" TEXT,
    "batchId" TEXT,
    "actionType" TEXT NOT NULL,
    "source" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable web_push_subscriptions
CREATE TABLE IF NOT EXISTS "web_push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "web_push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "notification_templates_templateName_key" ON "notification_templates"("templateName");
CREATE UNIQUE INDEX IF NOT EXISTS "notification_rules_eventType_key" ON "notification_rules"("eventType");
CREATE UNIQUE INDEX IF NOT EXISTS "web_push_subscriptions_endpoint_key" ON "web_push_subscriptions"("endpoint");
CREATE INDEX IF NOT EXISTS "web_push_subscriptions_userId_isActive_idx" ON "web_push_subscriptions"("userId", "isActive");
CREATE INDEX IF NOT EXISTS "notification_deliveries_notificationId_idx" ON "notification_deliveries"("notificationId");
CREATE INDEX IF NOT EXISTS "notification_deliveries_userId_status_idx" ON "notification_deliveries"("userId", "status");
CREATE INDEX IF NOT EXISTS "notification_action_logs_userId_actionType_idx" ON "notification_action_logs"("userId", "actionType");
CREATE INDEX IF NOT EXISTS "notification_action_logs_classId_idx" ON "notification_action_logs"("classId");
CREATE INDEX IF NOT EXISTS "notification_action_logs_batchId_idx" ON "notification_action_logs"("batchId");
CREATE INDEX IF NOT EXISTS "notification_action_logs_timestamp_idx" ON "notification_action_logs"("timestamp");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "notification_rules" ADD CONSTRAINT "notification_rules_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "web_push_subscriptions" ADD CONSTRAINT "web_push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
