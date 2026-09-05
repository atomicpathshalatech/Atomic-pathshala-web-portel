-- AlterEnum
ALTER TYPE "HandRaiseStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "HandRaiseStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "HandRaiseStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "HandRaiseStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- AlterTable: whiteboard_sessions (live-class control room fields)
ALTER TABLE "whiteboard_sessions"
  ADD COLUMN IF NOT EXISTS "scheduledStart" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "scheduledEnd" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "actualStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "actualEndedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT,
  ADD COLUMN IF NOT EXISTS "totalExtendedMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "extensionHistory" JSONB,
  ADD COLUMN IF NOT EXISTS "presentationUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "presentationName" TEXT,
  ADD COLUMN IF NOT EXISTS "presentationType" TEXT,
  ADD COLUMN IF NOT EXISTS "classroomTheme" TEXT NOT NULL DEFAULT 'LIGHT',
  ADD COLUMN IF NOT EXISTS "cameraShape" TEXT NOT NULL DEFAULT 'SQUARE',
  ADD COLUMN IF NOT EXISTS "cameraPosition" TEXT NOT NULL DEFAULT 'UPPER_RIGHT',
  ADD COLUMN IF NOT EXISTS "lastHeartbeatAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "recordingEgressId" TEXT,
  ADD COLUMN IF NOT EXISTS "recordingStatus" TEXT NOT NULL DEFAULT 'NONE';

-- AlterTable: hand_raise_events (participation-type + approval tracking)
ALTER TABLE "hand_raise_events"
  ADD COLUMN IF NOT EXISTS "requestType" TEXT NOT NULL DEFAULT 'CHAT',
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "liveKitGranted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: lectures (scheduling fields)
ALTER TABLE "lectures"
  ADD COLUMN IF NOT EXISTS "scheduledDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "startTime" TEXT,
  ADD COLUMN IF NOT EXISTS "endTime" TEXT,
  ADD COLUMN IF NOT EXISTS "durationMin" INTEGER DEFAULT 60;
ALTER TABLE "lectures" ALTER COLUMN "videoUrl" SET DEFAULT '';

-- AlterTable: questions (Draft -> Review1 -> Review2 -> Published workflow + NCERT mapping)
ALTER TABLE "questions"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "editedById" TEXT,
  ADD COLUMN IF NOT EXISTS "review1Status" TEXT,
  ADD COLUMN IF NOT EXISTS "review1ById" TEXT,
  ADD COLUMN IF NOT EXISTS "review1At" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "review1Notes" TEXT,
  ADD COLUMN IF NOT EXISTS "review2Status" TEXT,
  ADD COLUMN IF NOT EXISTS "review2ById" TEXT,
  ADD COLUMN IF NOT EXISTS "review2At" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "review2Notes" TEXT,
  ADD COLUMN IF NOT EXISTS "ncertClass" TEXT,
  ADD COLUMN IF NOT EXISTS "ncertBook" TEXT,
  ADD COLUMN IF NOT EXISTS "ncertChapter" TEXT,
  ADD COLUMN IF NOT EXISTS "ncertSection" TEXT,
  ADD COLUMN IF NOT EXISTS "ncertPage" TEXT,
  ADD COLUMN IF NOT EXISTS "ncertLine" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_editedById_fkey') THEN
    ALTER TABLE "questions" ADD CONSTRAINT "questions_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_review1ById_fkey') THEN
    ALTER TABLE "questions" ADD CONSTRAINT "questions_review1ById_fkey" FOREIGN KEY ("review1ById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_review2ById_fkey') THEN
    ALTER TABLE "questions" ADD CONSTRAINT "questions_review2ById_fkey" FOREIGN KEY ("review2ById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable: chapter_notices
CREATE TABLE IF NOT EXISTS "chapter_notices" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'ANNOUNCEMENT',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "authorName" TEXT NOT NULL DEFAULT 'Faculty',
    "authorRole" TEXT NOT NULL DEFAULT 'TEACHER',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapter_notices_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "chapter_notices_chapterId_idx" ON "chapter_notices"("chapterId");
CREATE INDEX IF NOT EXISTS "chapter_notices_chapterId_isPinned_createdAt_idx" ON "chapter_notices"("chapterId", "isPinned", "createdAt");

-- CreateTable: neet_rank_datasets
CREATE TABLE IF NOT EXISTS "neet_rank_datasets" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'v1.0',
    "title" TEXT NOT NULL,
    "sourceDocument" TEXT NOT NULL DEFAULT 'Official NTA NEET (UG)-2026 Re-exam Result PDF',
    "totalPages" INTEGER NOT NULL DEFAULT 15,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "neet_rank_datasets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "neet_rank_datasets_year_key" ON "neet_rank_datasets"("year");

-- CreateTable: neet_rank_references
CREATE TABLE IF NOT EXISTS "neet_rank_references" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "neetRank" INTEGER NOT NULL,
    "marks" DOUBLE PRECISION NOT NULL,
    "percentile" DOUBLE PRECISION,
    "candidateCount" INTEGER,
    "sourcePage" INTEGER NOT NULL DEFAULT 14,
    "confidence" TEXT NOT NULL DEFAULT 'EXACT',
    "isExactReference" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "neet_rank_references_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "neet_rank_references_datasetId_marks_idx" ON "neet_rank_references"("datasetId", "marks");
CREATE INDEX IF NOT EXISTS "neet_rank_references_datasetId_neetRank_idx" ON "neet_rank_references"("datasetId", "neetRank");

-- CreateTable: neet_category_rank_references
CREATE TABLE IF NOT EXISTS "neet_category_rank_references" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "categoryRank" INTEGER,
    "neetRank" INTEGER NOT NULL,
    "marks" DOUBLE PRECISION,
    "percentile" DOUBLE PRECISION,
    "state" TEXT,
    "gender" TEXT,
    "sourcePage" INTEGER NOT NULL DEFAULT 9,
    "confidence" TEXT NOT NULL DEFAULT 'EXACT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "neet_category_rank_references_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "neet_category_rank_references_datasetId_category_neetRank_idx" ON "neet_category_rank_references"("datasetId", "category", "neetRank");

-- CreateTable: neet_marks_brackets
CREATE TABLE IF NOT EXISTS "neet_marks_brackets" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "marksFrom" DOUBLE PRECISION NOT NULL,
    "marksTo" DOUBLE PRECISION NOT NULL,
    "candidateCount" INTEGER NOT NULL,
    "cumulativeCandidates" INTEGER,
    "sourcePage" INTEGER NOT NULL DEFAULT 14,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "neet_marks_brackets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "neet_marks_brackets_datasetId_marksFrom_marksTo_idx" ON "neet_marks_brackets"("datasetId", "marksFrom", "marksTo");

-- CreateTable: test_attempt_analyses
CREATE TABLE IF NOT EXISTS "test_attempt_analyses" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "attempted" INTEGER NOT NULL,
    "unattempted" INTEGER NOT NULL,
    "correct" INTEGER NOT NULL,
    "incorrect" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "maxMarks" DOUBLE PRECISION NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "timeTakenSec" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "totalTestParticipants" INTEGER DEFAULT 1,
    "topperScore" DOUBLE PRECISION,
    "gapTopperMarks" DOUBLE PRECISION,
    "percentile" DOUBLE PRECISION,
    "neetEquivalentScore" DOUBLE PRECISION,
    "estimatedNeetAir" INTEGER,
    "estimatedNeetAirMin" INTEGER,
    "estimatedNeetAirMax" INTEGER,
    "neetAirConfidence" TEXT DEFAULT 'ESTIMATED',
    "estimatedCategoryRank" INTEGER,
    "estimatedCategoryRankMin" INTEGER,
    "estimatedCategoryRankMax" INTEGER,
    "neetDatasetYear" INTEGER DEFAULT 2026,
    "neetPredictionSource" TEXT,
    "subjectStats" JSONB NOT NULL,
    "questionTypeStats" JSONB NOT NULL,
    "conceptStats" JSONB NOT NULL,
    "chapterStats" JSONB NOT NULL,
    "errorBreakdown" JSONB NOT NULL,
    "ncertPlan" JSONB NOT NULL,
    "actionPlan" JSONB NOT NULL,
    "questionReviews" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_attempt_analyses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "test_attempt_analyses_attemptId_key" ON "test_attempt_analyses"("attemptId");
CREATE INDEX IF NOT EXISTS "test_attempt_analyses_studentId_createdAt_idx" ON "test_attempt_analyses"("studentId", "createdAt");
CREATE INDEX IF NOT EXISTS "test_attempt_analyses_testId_idx" ON "test_attempt_analyses"("testId");

-- CreateTable: platform_resources
CREATE TABLE IF NOT EXISTS "platform_resources" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT,
    "targetId" TEXT NOT NULL,
    "downloadUrl" TEXT,
    "format" TEXT,
    "sizeBytes" INTEGER,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "deletedReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_resources_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "platform_resources_resourceId_key" ON "platform_resources"("resourceId");
CREATE INDEX IF NOT EXISTS "platform_resources_resourceId_idx" ON "platform_resources"("resourceId");
CREATE INDEX IF NOT EXISTS "platform_resources_type_idx" ON "platform_resources"("type");
CREATE INDEX IF NOT EXISTS "platform_resources_targetId_idx" ON "platform_resources"("targetId");
CREATE INDEX IF NOT EXISTS "platform_resources_isDeleted_idx" ON "platform_resources"("isDeleted");

-- CreateTable: resource_audit_logs
CREATE TABLE IF NOT EXISTS "resource_audit_logs" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT,
    "action" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "resource_audit_logs_resourceId_idx" ON "resource_audit_logs"("resourceId");
CREATE INDEX IF NOT EXISTS "resource_audit_logs_userId_idx" ON "resource_audit_logs"("userId");
CREATE INDEX IF NOT EXISTS "resource_audit_logs_action_idx" ON "resource_audit_logs"("action");

-- CreateTable: revision_items
CREATE TABLE IF NOT EXISTS "revision_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fullPath" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revision_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "revision_items_userId_entityType_entityId_key" ON "revision_items"("userId", "entityType", "entityId");
CREATE INDEX IF NOT EXISTS "revision_items_userId_idx" ON "revision_items"("userId");
CREATE INDEX IF NOT EXISTS "revision_items_active_idx" ON "revision_items"("active");

-- CreateTable: revision_sessions
CREATE TABLE IF NOT EXISTS "revision_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "revisionItemId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'ALL',
    "totalQuestions" INTEGER NOT NULL,
    "attempted" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "incorrect" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revision_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "revision_sessions_userId_idx" ON "revision_sessions"("userId");
CREATE INDEX IF NOT EXISTS "revision_sessions_revisionItemId_idx" ON "revision_sessions"("revisionItemId");

-- CreateTable: revision_question_attempts
CREATE TABLE IF NOT EXISTS "revision_question_attempts" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "userAnswer" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revision_question_attempts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "revision_question_attempts_sessionId_idx" ON "revision_question_attempts"("sessionId");
CREATE INDEX IF NOT EXISTS "revision_question_attempts_questionId_idx" ON "revision_question_attempts"("questionId");

-- CreateTable: revision_nodes_seen
CREATE TABLE IF NOT EXISTS "revision_nodes_seen" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revision_nodes_seen_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "revision_nodes_seen_userId_entityType_entityId_key" ON "revision_nodes_seen"("userId", "entityType", "entityId");
CREATE INDEX IF NOT EXISTS "revision_nodes_seen_userId_idx" ON "revision_nodes_seen"("userId");

-- CreateTable: extraction_jobs
CREATE TABLE IF NOT EXISTS "extraction_jobs" (
    "id" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "startNumber" INTEGER NOT NULL DEFAULT 1,
    "endNumber" INTEGER NOT NULL DEFAULT 180,
    "expectedCount" INTEGER NOT NULL DEFAULT 180,
    "extractedCount" INTEGER NOT NULL DEFAULT 0,
    "verifiedCount" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "missingCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentStep" TEXT,
    "reportJson" JSONB,
    "examName" TEXT,
    "year" TEXT,
    "subject" TEXT,
    "chapter" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extraction_jobs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "extraction_jobs_sourceName_idx" ON "extraction_jobs"("sourceName");
CREATE INDEX IF NOT EXISTS "extraction_jobs_status_idx" ON "extraction_jobs"("status");
CREATE INDEX IF NOT EXISTS "extraction_jobs_createdById_idx" ON "extraction_jobs"("createdById");

-- CreateTable: extracted_questions
CREATE TABLE IF NOT EXISTS "extracted_questions" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "questionIndex" INTEGER NOT NULL,
    "originalNumber" INTEGER NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourcePdfUrl" TEXT NOT NULL,
    "sourcePdfName" TEXT NOT NULL,
    "sourcePage" INTEGER NOT NULL DEFAULT 1,
    "statement" TEXT NOT NULL,
    "statementHi" TEXT,
    "options" JSONB NOT NULL,
    "correctAnswer" TEXT NOT NULL DEFAULT 'A',
    "answerKeySource" TEXT,
    "solution" TEXT,
    "solutionHi" TEXT,
    "hasTable" BOOLEAN NOT NULL DEFAULT false,
    "tablesJson" JSONB,
    "hasImage" BOOLEAN NOT NULL DEFAULT false,
    "imagesJson" JSONB,
    "imageUrl" TEXT,
    "hasEquation" BOOLEAN NOT NULL DEFAULT false,
    "subject" TEXT NOT NULL DEFAULT 'General',
    "chapter" TEXT,
    "topic" TEXT,
    "subTopic" TEXT,
    "questionType" TEXT NOT NULL DEFAULT 'SINGLE_CORRECT',
    "difficulty" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'VERIFIED',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 95.0,
    "confidenceBreakdown" JSONB,
    "reviewReasons" JSONB,
    "originalSnapshot" JSONB NOT NULL,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "draftQuestionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extracted_questions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "extracted_questions_jobId_idx" ON "extracted_questions"("jobId");
CREATE INDEX IF NOT EXISTS "extracted_questions_status_idx" ON "extracted_questions"("status");
CREATE INDEX IF NOT EXISTS "extracted_questions_sourceName_idx" ON "extracted_questions"("sourceName");
CREATE INDEX IF NOT EXISTS "extracted_questions_originalNumber_idx" ON "extracted_questions"("originalNumber");

-- CreateTable: file_assets
CREATE TABLE IF NOT EXISTS "file_assets" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL DEFAULT 'r2',
    "bucket" TEXT NOT NULL DEFAULT 'atomic-pathshala',
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "visibility" TEXT NOT NULL DEFAULT 'PROTECTED',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_assets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "file_assets_storageKey_key" ON "file_assets"("storageKey");
CREATE INDEX IF NOT EXISTS "file_assets_ownerId_idx" ON "file_assets"("ownerId");
CREATE INDEX IF NOT EXISTS "file_assets_fileType_idx" ON "file_assets"("fileType");
CREATE INDEX IF NOT EXISTS "file_assets_status_idx" ON "file_assets"("status");
CREATE INDEX IF NOT EXISTS "file_assets_visibility_idx" ON "file_assets"("visibility");

-- CreateTable: video_assets
CREATE TABLE IF NOT EXISTS "video_assets" (
    "id" TEXT NOT NULL,
    "lectureId" TEXT,
    "liveClassId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'publitio',
    "providerVideoId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "durationSeconds" INTEGER,
    "thumbnailUrl" TEXT,
    "hlsUrl" TEXT,
    "mp4Url" TEXT,
    "playbackMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_assets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "video_assets_lectureId_idx" ON "video_assets"("lectureId");
CREATE INDEX IF NOT EXISTS "video_assets_liveClassId_idx" ON "video_assets"("liveClassId");
CREATE INDEX IF NOT EXISTS "video_assets_provider_idx" ON "video_assets"("provider");
CREATE INDEX IF NOT EXISTS "video_assets_status_idx" ON "video_assets"("status");

-- CreateTable: live_classes
CREATE TABLE IF NOT EXISTS "live_classes" (
    "id" TEXT NOT NULL,
    "lectureId" TEXT,
    "batchScheduleId" TEXT,
    "roomName" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "classType" TEXT NOT NULL DEFAULT 'APP_LIVE',
    "youtubeVideoId" TEXT,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "recordingStatus" TEXT NOT NULL DEFAULT 'NONE',
    "recordingVideoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "live_classes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "live_classes_batchScheduleId_key" ON "live_classes"("batchScheduleId");
CREATE UNIQUE INDEX IF NOT EXISTS "live_classes_roomName_key" ON "live_classes"("roomName");
CREATE INDEX IF NOT EXISTS "live_classes_teacherId_idx" ON "live_classes"("teacherId");
CREATE INDEX IF NOT EXISTS "live_classes_status_idx" ON "live_classes"("status");
CREATE INDEX IF NOT EXISTS "live_classes_classType_idx" ON "live_classes"("classType");
CREATE INDEX IF NOT EXISTS "live_classes_scheduledStart_idx" ON "live_classes"("scheduledStart");

-- CreateTable: whiteboard_snapshots
CREATE TABLE IF NOT EXISTS "whiteboard_snapshots" (
    "id" TEXT NOT NULL,
    "liveClassId" TEXT NOT NULL,
    "r2FileId" TEXT NOT NULL,
    "snapshotType" TEXT NOT NULL DEFAULT 'FINAL',
    "pageCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whiteboard_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "whiteboard_snapshots_liveClassId_idx" ON "whiteboard_snapshots"("liveClassId");
CREATE INDEX IF NOT EXISTS "whiteboard_snapshots_r2FileId_idx" ON "whiteboard_snapshots"("r2FileId");

-- CreateTable: live_chat_messages
CREATE TABLE IF NOT EXISTS "live_chat_messages" (
    "id" TEXT NOT NULL,
    "liveClassId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL DEFAULT 'STUDENT',
    "message" TEXT NOT NULL,
    "isAnnouncement" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_chat_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "live_chat_messages_liveClassId_idx" ON "live_chat_messages"("liveClassId");
CREATE INDEX IF NOT EXISTS "live_chat_messages_userId_idx" ON "live_chat_messages"("userId");
CREATE INDEX IF NOT EXISTS "live_chat_messages_createdAt_idx" ON "live_chat_messages"("createdAt");

-- AddForeignKey (new tables that reference existing/other new tables)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chapter_notices_chapterId_fkey') THEN
    ALTER TABLE "chapter_notices" ADD CONSTRAINT "chapter_notices_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'neet_rank_references_datasetId_fkey') THEN
    ALTER TABLE "neet_rank_references" ADD CONSTRAINT "neet_rank_references_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "neet_rank_datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'neet_category_rank_references_datasetId_fkey') THEN
    ALTER TABLE "neet_category_rank_references" ADD CONSTRAINT "neet_category_rank_references_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "neet_rank_datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'neet_marks_brackets_datasetId_fkey') THEN
    ALTER TABLE "neet_marks_brackets" ADD CONSTRAINT "neet_marks_brackets_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "neet_rank_datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'test_attempt_analyses_attemptId_fkey') THEN
    ALTER TABLE "test_attempt_analyses" ADD CONSTRAINT "test_attempt_analyses_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'test_attempt_analyses_studentId_fkey') THEN
    ALTER TABLE "test_attempt_analyses" ADD CONSTRAINT "test_attempt_analyses_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platform_resources_createdById_fkey') THEN
    ALTER TABLE "platform_resources" ADD CONSTRAINT "platform_resources_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platform_resources_deletedById_fkey') THEN
    ALTER TABLE "platform_resources" ADD CONSTRAINT "platform_resources_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resource_audit_logs_resourceId_fkey') THEN
    ALTER TABLE "resource_audit_logs" ADD CONSTRAINT "resource_audit_logs_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "platform_resources"("resourceId") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resource_audit_logs_userId_fkey') THEN
    ALTER TABLE "resource_audit_logs" ADD CONSTRAINT "resource_audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'revision_items_userId_fkey') THEN
    ALTER TABLE "revision_items" ADD CONSTRAINT "revision_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'revision_sessions_revisionItemId_fkey') THEN
    ALTER TABLE "revision_sessions" ADD CONSTRAINT "revision_sessions_revisionItemId_fkey" FOREIGN KEY ("revisionItemId") REFERENCES "revision_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'revision_question_attempts_sessionId_fkey') THEN
    ALTER TABLE "revision_question_attempts" ADD CONSTRAINT "revision_question_attempts_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "revision_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'revision_question_attempts_questionId_fkey') THEN
    ALTER TABLE "revision_question_attempts" ADD CONSTRAINT "revision_question_attempts_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'extraction_jobs_createdById_fkey') THEN
    ALTER TABLE "extraction_jobs" ADD CONSTRAINT "extraction_jobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'extracted_questions_jobId_fkey') THEN
    ALTER TABLE "extracted_questions" ADD CONSTRAINT "extracted_questions_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "extraction_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
