-- Hand-trimmed from a full `prisma migrate diff` (which also picked up
-- unrelated pending drift elsewhere in the schema - study_materials,
-- coach_conversations, users.roleId FK - none of that is part of this
-- change and is deliberately NOT included here). This migration only adds
-- the YouTube recording-archive columns to whiteboard_sessions.

ALTER TABLE "whiteboard_sessions" ADD COLUMN     "youtubeArchiveLastError" TEXT,
ADD COLUMN     "youtubeArchiveMetadataSnapshot" JSONB,
ADD COLUMN     "youtubeArchiveProcessedAt" TIMESTAMP(3),
ADD COLUMN     "youtubeArchiveStatus" TEXT NOT NULL DEFAULT 'NOT_ENABLED',
ADD COLUMN     "youtubeArchiveThumbnailError" TEXT,
ADD COLUMN     "youtubeArchiveThumbnailStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN     "youtubeArchiveUploadAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "youtubeArchiveUploadOffset" BIGINT,
ADD COLUMN     "youtubeArchiveUploadSessionUrl" TEXT,
ADD COLUMN     "youtubeArchiveUploadStartedAt" TIMESTAMP(3),
ADD COLUMN     "youtubeArchiveUploadedAt" TIMESTAMP(3),
ADD COLUMN     "youtubeArchiveVideoId" TEXT,
ADD COLUMN     "youtubeArchiveVideoUrl" TEXT;

CREATE INDEX "whiteboard_sessions_youtubeArchiveStatus_idx" ON "whiteboard_sessions"("youtubeArchiveStatus");
