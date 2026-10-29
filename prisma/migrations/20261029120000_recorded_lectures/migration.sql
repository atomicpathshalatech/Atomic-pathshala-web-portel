-- Recorded lectures in a separate R2 account, teacher "About" and lecture summaries.
-- New tables and enums only; existing tables (lectures, batches) are not altered.

DO $$ BEGIN
  CREATE TYPE "RecordedUploadStatus" AS ENUM ('PENDING', 'UPLOADING', 'VERIFYING', 'READY', 'FAILED', 'ABORTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LectureSummaryStatus" AS ENUM ('DRAFT', 'APPROVED', 'PUBLISHED', 'SUPERSEDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "recorded_lecture_media" (
    "id" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "storageNamespace" TEXT NOT NULL DEFAULT 'recorded-r2',
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalFileName" TEXT,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "durationSec" INTEGER,
    "thumbnailKey" TEXT,
    "uploadStatus" "RecordedUploadStatus" NOT NULL DEFAULT 'PENDING',
    "multipartUploadId" TEXT,
    "partSizeBytes" INTEGER,
    "uploadError" TEXT,
    "uploadStartedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "batchId" TEXT,
    "lectureNumber" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "additionalNotes" TEXT,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "recorded_lecture_media_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "recorded_lecture_media_lectureId_key" ON "recorded_lecture_media"("lectureId");
CREATE UNIQUE INDEX IF NOT EXISTS "recorded_lecture_media_objectKey_key" ON "recorded_lecture_media"("objectKey");
CREATE INDEX IF NOT EXISTS "recorded_lecture_media_batchId_idx" ON "recorded_lecture_media"("batchId");
CREATE INDEX IF NOT EXISTS "recorded_lecture_media_uploadStatus_idx" ON "recorded_lecture_media"("uploadStatus");

DO $$ BEGIN
  ALTER TABLE "recorded_lecture_media" ADD CONSTRAINT "recorded_lecture_media_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "lectures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "recorded_lecture_media" ADD CONSTRAINT "recorded_lecture_media_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "lecture_abouts" (
    "id" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lecture_abouts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "lecture_abouts_lectureId_key" ON "lecture_abouts"("lectureId");

DO $$ BEGIN
  ALTER TABLE "lecture_abouts" ADD CONSTRAINT "lecture_abouts_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "lectures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "lecture_summaries" (
    "id" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "aboutRevision" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'English',
    "status" "LectureSummaryStatus" NOT NULL DEFAULT 'DRAFT',
    "outdated" BOOLEAN NOT NULL DEFAULT false,
    "aiProvider" TEXT,
    "aiModel" TEXT,
    "generatedAt" TIMESTAMP(3),
    "generatedById" TEXT,
    "editedById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lecture_summaries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "lecture_summaries_lectureId_revision_key" ON "lecture_summaries"("lectureId", "revision");
CREATE INDEX IF NOT EXISTS "lecture_summaries_lectureId_status_idx" ON "lecture_summaries"("lectureId", "status");

DO $$ BEGIN
  ALTER TABLE "lecture_summaries" ADD CONSTRAINT "lecture_summaries_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "lectures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
