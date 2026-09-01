-- CreateEnum
CREATE TYPE "AtomicBatch" AS ENUM ('SELECTION_PRO', 'SELECTION_1_0', 'ARAMBH', 'MANZIL', 'UDAAN', 'NO_BATCH');

-- CreateEnum
CREATE TYPE "AccessPlan" AS ENUM ('FREE', 'BASIC', 'PRO', 'LIFETIME');

-- CreateEnum
CREATE TYPE "AccessType" AS ENUM ('FREE_TRIAL', 'BASIC_PLAN', 'PRO_PLAN', 'ATOMIC_BATCH_FREE', 'LIFETIME_ACCESS');

-- CreateEnum
CREATE TYPE "AccessStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('IMAGE', 'PDF', 'AUDIO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('LOCAL', 'SUPABASE', 'S3');

-- CreateEnum
CREATE TYPE "QuestionSource" AS ENUM ('AI_GENERATED', 'ATOMIC_TEST_PORTAL', 'MANUAL');

-- CreateEnum
CREATE TYPE "AiChatSubscriptionStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'EXPIRED');

-- CreateTable
CREATE TABLE "ai_chat_user_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT,
    "className" TEXT,
    "atomicBatch" "AtomicBatch" NOT NULL DEFAULT 'NO_BATCH',
    "target" TEXT NOT NULL DEFAULT 'NEET',
    "board" TEXT,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'hinglish',
    "preferredTeachers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "strongChapters" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "weakChapters" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "favoriteSubject" TEXT,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" TIMESTAMP(3),
    "learningPreferences" JSONB,
    "recentActivity" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_chat_user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "language" TEXT NOT NULL DEFAULT 'hinglish',
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "pushNotifications" BOOLEAN NOT NULL DEFAULT true,
    "privacyMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_chat_user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_memory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "facts" JSONB NOT NULL DEFAULT '[]',
    "studyContext" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "ai_chat_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chat_password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_atomic_id_sequence" (
    "id" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_chat_atomic_id_sequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'hinglish',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ai_chat_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "ai_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_stored_files" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "provider" "StorageProvider" NOT NULL DEFAULT 'LOCAL',
    "storageKey" TEXT NOT NULL,
    "publicUrl" TEXT,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "checksum" TEXT,
    "extractedText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chat_stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_message_attachments" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "storedFileId" TEXT,
    "kind" "AttachmentKind" NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT,
    "extractedText" TEXT,

    CONSTRAINT "ai_chat_message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT,
    "providerCustomerId" TEXT,
    "providerPlanId" TEXT,
    "status" "AiChatSubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "plan" "AccessPlan" NOT NULL DEFAULT 'BASIC',
    "accessType" "AccessType" NOT NULL DEFAULT 'BASIC_PLAN',
    "accessStatus" "AccessStatus" NOT NULL DEFAULT 'ACTIVE',
    "grantedByUserId" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "batchId" TEXT,
    "courseId" TEXT,
    "enrollmentId" TEXT,
    "externalEnrollmentId" TEXT,
    "syncSource" TEXT,
    "metadata" JSONB,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_chat_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_user_access" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "plan" "AccessPlan" NOT NULL DEFAULT 'FREE',
    "accessType" "AccessType" NOT NULL DEFAULT 'FREE_TRIAL',
    "status" "AccessStatus" NOT NULL DEFAULT 'EXPIRED',
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "batchId" TEXT,
    "courseId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chat_user_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_courses" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_chat_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_batches" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "schedule" JSONB,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_chat_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_enrollments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "batchId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "externalEnrollmentId" TEXT,
    "syncSource" TEXT NOT NULL DEFAULT 'manual',
    "syncedAt" TIMESTAMP(3),
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chat_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_batch_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "courseId" TEXT,
    "enrollmentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "externalMemberId" TEXT,
    "syncSource" TEXT NOT NULL DEFAULT 'manual',
    "syncedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_chat_batch_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_test_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT,
    "testName" TEXT NOT NULL,
    "subject" TEXT,
    "score" DOUBLE PRECISION,
    "maxScore" DOUBLE PRECISION,
    "answers" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "ai_chat_test_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_usage_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "event" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chat_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_guest_usage" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_chat_guest_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_class_schedules" (
    "id" TEXT NOT NULL,
    "batch" "AtomicBatch" NOT NULL,
    "classDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT,
    "subject" TEXT NOT NULL,
    "teacherName" TEXT,
    "teacherPhotoUrl" TEXT,
    "topic" TEXT NOT NULL,
    "youtubeLink" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_chat_class_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_quiz_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "topic" TEXT,
    "totalQuestions" INTEGER NOT NULL,
    "correct" INTEGER NOT NULL,
    "wrong" INTEGER NOT NULL,
    "unattempted" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "accuracy" INTEGER NOT NULL,
    "timeTakenSec" INTEGER,
    "breakdown" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chat_quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_answer_reports" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "questionBankId" TEXT,
    "questionText" TEXT NOT NULL,
    "answerText" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chat_answer_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_question_bank" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "chapter" TEXT,
    "topic" TEXT,
    "text" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,
    "difficulty" TEXT,
    "language" TEXT NOT NULL DEFAULT 'english',
    "source" "QuestionSource" NOT NULL DEFAULT 'AI_GENERATED',
    "contentHash" TEXT NOT NULL,
    "externalRefId" TEXT,
    "timesUsed" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_chat_question_bank_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_chat_user_profiles_userId_key" ON "ai_chat_user_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_chat_user_preferences_userId_key" ON "ai_chat_user_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_memory_userId_key" ON "ai_memory"("userId");

-- CreateIndex
CREATE INDEX "ai_chat_accounts_userId_idx" ON "ai_chat_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_chat_accounts_provider_providerAccountId_key" ON "ai_chat_accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_chat_sessions_sessionToken_key" ON "ai_chat_sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "ai_chat_sessions_userId_idx" ON "ai_chat_sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_chat_password_reset_tokens_tokenHash_key" ON "ai_chat_password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "ai_chat_password_reset_tokens_userId_expiresAt_idx" ON "ai_chat_password_reset_tokens"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "ai_chat_conversations_userId_updatedAt_idx" ON "ai_chat_conversations"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "ai_chat_conversations_userId_deletedAt_idx" ON "ai_chat_conversations"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "ai_chat_messages_conversationId_createdAt_idx" ON "ai_chat_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ai_chat_stored_files_storageKey_key" ON "ai_chat_stored_files"("storageKey");

-- CreateIndex
CREATE INDEX "ai_chat_stored_files_ownerId_createdAt_idx" ON "ai_chat_stored_files"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_chat_message_attachments_messageId_idx" ON "ai_chat_message_attachments"("messageId");

-- CreateIndex
CREATE INDEX "ai_chat_message_attachments_storedFileId_idx" ON "ai_chat_message_attachments"("storedFileId");

-- CreateIndex
CREATE INDEX "ai_chat_subscriptions_userId_status_idx" ON "ai_chat_subscriptions"("userId", "status");

-- CreateIndex
CREATE INDEX "ai_chat_subscriptions_userId_accessStatus_endsAt_idx" ON "ai_chat_subscriptions"("userId", "accessStatus", "endsAt");

-- CreateIndex
CREATE INDEX "ai_chat_subscriptions_batchId_accessStatus_idx" ON "ai_chat_subscriptions"("batchId", "accessStatus");

-- CreateIndex
CREATE INDEX "ai_chat_subscriptions_courseId_accessStatus_idx" ON "ai_chat_subscriptions"("courseId", "accessStatus");

-- CreateIndex
CREATE INDEX "ai_chat_subscriptions_externalEnrollmentId_idx" ON "ai_chat_subscriptions"("externalEnrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_chat_subscriptions_provider_providerCustomerId_key" ON "ai_chat_subscriptions"("provider", "providerCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_chat_user_access_userId_key" ON "ai_chat_user_access"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_chat_user_access_subscriptionId_key" ON "ai_chat_user_access"("subscriptionId");

-- CreateIndex
CREATE INDEX "ai_chat_user_access_status_plan_expiresAt_idx" ON "ai_chat_user_access"("status", "plan", "expiresAt");

-- CreateIndex
CREATE INDEX "ai_chat_user_access_batchId_idx" ON "ai_chat_user_access"("batchId");

-- CreateIndex
CREATE INDEX "ai_chat_user_access_courseId_idx" ON "ai_chat_user_access"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_chat_courses_slug_key" ON "ai_chat_courses"("slug");

-- CreateIndex
CREATE INDEX "ai_chat_batches_courseId_idx" ON "ai_chat_batches"("courseId");

-- CreateIndex
CREATE INDEX "ai_chat_enrollments_batchId_idx" ON "ai_chat_enrollments"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_chat_enrollments_userId_courseId_key" ON "ai_chat_enrollments"("userId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_chat_enrollments_syncSource_externalEnrollmentId_key" ON "ai_chat_enrollments"("syncSource", "externalEnrollmentId");

-- CreateIndex
CREATE INDEX "ai_chat_batch_memberships_batchId_status_idx" ON "ai_chat_batch_memberships"("batchId", "status");

-- CreateIndex
CREATE INDEX "ai_chat_batch_memberships_userId_status_idx" ON "ai_chat_batch_memberships"("userId", "status");

-- CreateIndex
CREATE INDEX "ai_chat_batch_memberships_courseId_idx" ON "ai_chat_batch_memberships"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_chat_batch_memberships_userId_batchId_key" ON "ai_chat_batch_memberships"("userId", "batchId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_chat_batch_memberships_syncSource_externalMemberId_key" ON "ai_chat_batch_memberships"("syncSource", "externalMemberId");

-- CreateIndex
CREATE INDEX "ai_chat_test_attempts_userId_startedAt_idx" ON "ai_chat_test_attempts"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "ai_chat_test_attempts_courseId_idx" ON "ai_chat_test_attempts"("courseId");

-- CreateIndex
CREATE INDEX "ai_chat_usage_events_event_createdAt_idx" ON "ai_chat_usage_events"("event", "createdAt");

-- CreateIndex
CREATE INDEX "ai_chat_usage_events_userId_createdAt_idx" ON "ai_chat_usage_events"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ai_chat_guest_usage_guestId_key" ON "ai_chat_guest_usage"("guestId");

-- CreateIndex
CREATE INDEX "ai_chat_guest_usage_ip_idx" ON "ai_chat_guest_usage"("ip");

-- CreateIndex
CREATE INDEX "ai_chat_class_schedules_batch_classDate_idx" ON "ai_chat_class_schedules"("batch", "classDate");

-- CreateIndex
CREATE INDEX "ai_chat_quiz_attempts_userId_createdAt_idx" ON "ai_chat_quiz_attempts"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_chat_quiz_attempts_userId_subject_idx" ON "ai_chat_quiz_attempts"("userId", "subject");

-- CreateIndex
CREATE INDEX "ai_chat_answer_reports_createdAt_idx" ON "ai_chat_answer_reports"("createdAt");

-- CreateIndex
CREATE INDEX "ai_chat_answer_reports_questionBankId_idx" ON "ai_chat_answer_reports"("questionBankId");

-- CreateIndex
CREATE INDEX "ai_chat_answer_reports_status_idx" ON "ai_chat_answer_reports"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ai_chat_question_bank_contentHash_key" ON "ai_chat_question_bank"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "ai_chat_question_bank_externalRefId_key" ON "ai_chat_question_bank"("externalRefId");

-- CreateIndex
CREATE INDEX "ai_chat_question_bank_subject_chapter_topic_idx" ON "ai_chat_question_bank"("subject", "chapter", "topic");

-- CreateIndex
CREATE INDEX "ai_chat_question_bank_source_idx" ON "ai_chat_question_bank"("source");

-- AddForeignKey
ALTER TABLE "ai_chat_user_profiles" ADD CONSTRAINT "ai_chat_user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_user_preferences" ADD CONSTRAINT "ai_chat_user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_memory" ADD CONSTRAINT "ai_memory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_accounts" ADD CONSTRAINT "ai_chat_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_sessions" ADD CONSTRAINT "ai_chat_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_password_reset_tokens" ADD CONSTRAINT "ai_chat_password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_conversations" ADD CONSTRAINT "ai_chat_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_messages" ADD CONSTRAINT "ai_chat_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_stored_files" ADD CONSTRAINT "ai_chat_stored_files_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_message_attachments" ADD CONSTRAINT "ai_chat_message_attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ai_chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_message_attachments" ADD CONSTRAINT "ai_chat_message_attachments_storedFileId_fkey" FOREIGN KEY ("storedFileId") REFERENCES "ai_chat_stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_subscriptions" ADD CONSTRAINT "ai_chat_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_subscriptions" ADD CONSTRAINT "ai_chat_subscriptions_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_subscriptions" ADD CONSTRAINT "ai_chat_subscriptions_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ai_chat_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_subscriptions" ADD CONSTRAINT "ai_chat_subscriptions_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "ai_chat_courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_subscriptions" ADD CONSTRAINT "ai_chat_subscriptions_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "ai_chat_enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_user_access" ADD CONSTRAINT "ai_chat_user_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_user_access" ADD CONSTRAINT "ai_chat_user_access_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "ai_chat_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_user_access" ADD CONSTRAINT "ai_chat_user_access_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ai_chat_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_user_access" ADD CONSTRAINT "ai_chat_user_access_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "ai_chat_courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_batches" ADD CONSTRAINT "ai_chat_batches_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "ai_chat_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_enrollments" ADD CONSTRAINT "ai_chat_enrollments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_enrollments" ADD CONSTRAINT "ai_chat_enrollments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "ai_chat_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_enrollments" ADD CONSTRAINT "ai_chat_enrollments_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ai_chat_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_batch_memberships" ADD CONSTRAINT "ai_chat_batch_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_batch_memberships" ADD CONSTRAINT "ai_chat_batch_memberships_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ai_chat_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_batch_memberships" ADD CONSTRAINT "ai_chat_batch_memberships_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "ai_chat_courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_batch_memberships" ADD CONSTRAINT "ai_chat_batch_memberships_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "ai_chat_enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_test_attempts" ADD CONSTRAINT "ai_chat_test_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_test_attempts" ADD CONSTRAINT "ai_chat_test_attempts_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "ai_chat_courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_usage_events" ADD CONSTRAINT "ai_chat_usage_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_quiz_attempts" ADD CONSTRAINT "ai_chat_quiz_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_answer_reports" ADD CONSTRAINT "ai_chat_answer_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_answer_reports" ADD CONSTRAINT "ai_chat_answer_reports_questionBankId_fkey" FOREIGN KEY ("questionBankId") REFERENCES "ai_chat_question_bank"("id") ON DELETE SET NULL ON UPDATE CASCADE;
