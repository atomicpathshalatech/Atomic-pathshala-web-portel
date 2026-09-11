-- Centralized Email & Communication System + Birthday Automation
-- Hand-trimmed from `prisma migrate diff`: the raw diff also included
-- study_plans/study_plan_tasks/coach_conversations/coach_messages (declared
-- in schema.prisma but never migrated — pre-existing drift, unrelated to
-- this feature) and a DROP/ADD of users_roleId_fkey (Prisma re-normalizing
-- that constraint after new User relations were added — a no-op). Neither
-- belongs in this migration, so only the statements for the new email/
-- birthday tables and the two new nullable columns are kept here.

-- CreateEnum
CREATE TYPE "EmailCategory" AS ENUM ('CREDENTIALS', 'PASSWORD_RESET', 'ENROLLMENT', 'INVITATION', 'BIRTHDAY', 'PROMOTIONAL', 'ANNOUNCEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "RecipientType" AS ENUM ('STUDENT', 'STAFF', 'OTHER');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PROCESSING', 'COMPLETED', 'PARTIALLY_FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RecipientGroupType" AS ENUM ('ALL_STUDENTS', 'ALL_STAFF', 'SELECTED_STUDENTS', 'SELECTED_STAFF', 'BATCH', 'TEACHER', 'CUSTOM_FILTER_STUDENTS', 'CUSTOM_FILTER_STAFF');

-- CreateEnum
CREATE TYPE "BirthdayCategory" AS ENUM ('FOUNDATION9', 'CLASS10', 'CLASS11', 'CLASS12', 'NEET', 'JEE', 'BOARD', 'GENERAL');

-- CreateEnum
CREATE TYPE "BirthdaySendStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "board" TEXT;

-- AlterTable
ALTER TABLE "teachers" ADD COLUMN     "dob" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "EmailCategory" NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "recipientGroup" "RecipientGroupType" NOT NULL,
    "recipientFilter" JSONB,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "templateId" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "recipientName" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientType" "RecipientType" NOT NULL,
    "emailType" "EmailCategory" NOT NULL,
    "templateId" TEXT,
    "campaignId" TEXT,
    "subject" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "failureReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "birthday_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "BirthdayCategory" NOT NULL,
    "board" TEXT,
    "messageText" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "birthday_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "birthday_creatives" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "BirthdayCategory" NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "birthday_creatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "today_specials" (
    "id" TEXT NOT NULL,
    "specialDate" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "targetClass" TEXT,
    "targetExam" TEXT,
    "targetBoard" TEXT,
    "targetBatchId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "today_specials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "birthday_send_logs" (
    "id" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "category" "BirthdayCategory" NOT NULL,
    "board" TEXT,
    "templateId" TEXT,
    "creativeId" TEXT,
    "whatsappNumber" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "status" "BirthdaySendStatus" NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "failureReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "triggerType" TEXT NOT NULL DEFAULT 'AUTOMATIC',
    "todaySpecialId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "birthday_send_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_key_key" ON "email_templates"("key");

-- CreateIndex
CREATE INDEX "email_templates_category_idx" ON "email_templates"("category");

-- CreateIndex
CREATE INDEX "email_campaigns_status_idx" ON "email_campaigns"("status");

-- CreateIndex
CREATE UNIQUE INDEX "email_logs_idempotencyKey_key" ON "email_logs"("idempotencyKey");

-- CreateIndex
CREATE INDEX "email_logs_recipientEmail_idx" ON "email_logs"("recipientEmail");

-- CreateIndex
CREATE INDEX "email_logs_status_idx" ON "email_logs"("status");

-- CreateIndex
CREATE INDEX "email_logs_emailType_idx" ON "email_logs"("emailType");

-- CreateIndex
CREATE INDEX "email_logs_campaignId_idx" ON "email_logs"("campaignId");

-- CreateIndex
CREATE INDEX "birthday_templates_category_idx" ON "birthday_templates"("category");

-- CreateIndex
CREATE INDEX "birthday_creatives_category_idx" ON "birthday_creatives"("category");

-- CreateIndex
CREATE UNIQUE INDEX "today_specials_specialDate_key" ON "today_specials"("specialDate");

-- CreateIndex
CREATE INDEX "birthday_send_logs_status_idx" ON "birthday_send_logs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "birthday_send_logs_subjectType_subjectId_year_key" ON "birthday_send_logs"("subjectType", "subjectId", "year");

-- AddForeignKey
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "email_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "email_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "email_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
