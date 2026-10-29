-- AI pass over recorded lectures (transcript, board notes, translations, AI voice)
-- and the source of a lecture summary. New table + one new column with a default.

DO $$ BEGIN
  CREATE TYPE "LectureAiStatus" AS ENUM ('QUEUED', 'TRANSFERRING', 'AI_PREPARING', 'TRANSCRIBING', 'TRANSLATING', 'VOICING', 'READY', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "lecture_summaries" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'ABOUT';

CREATE TABLE IF NOT EXISTS "lecture_ai_jobs" (
    "id" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "status" "LectureAiStatus" NOT NULL DEFAULT 'QUEUED',
    "stepNote" TEXT,
    "keyIndex" INTEGER NOT NULL DEFAULT 0,
    "geminiUploadUrl" TEXT,
    "uploadedBytes" BIGINT NOT NULL DEFAULT 0,
    "geminiFileName" TEXT,
    "geminiFileUri" TEXT,
    "sourceLanguage" TEXT NOT NULL DEFAULT 'English',
    "targetLanguages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "durationSec" INTEGER,
    "windowSec" INTEGER NOT NULL DEFAULT 600,
    "windowsDone" INTEGER NOT NULL DEFAULT 0,
    "windowsTotal" INTEGER NOT NULL DEFAULT 0,
    "segments" JSONB NOT NULL DEFAULT '[]',
    "board" JSONB NOT NULL DEFAULT '[]',
    "translations" JSONB NOT NULL DEFAULT '{}',
    "voice" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "retryAt" TIMESTAMP(3),
    "lockedUntil" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "ttsAudioSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "requestedById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lecture_ai_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "lecture_ai_jobs_lectureId_key" ON "lecture_ai_jobs"("lectureId");
CREATE INDEX IF NOT EXISTS "lecture_ai_jobs_status_idx" ON "lecture_ai_jobs"("status");

DO $$ BEGIN
  ALTER TABLE "lecture_ai_jobs" ADD CONSTRAINT "lecture_ai_jobs_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "lectures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
