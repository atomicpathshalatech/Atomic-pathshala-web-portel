-- Recorded lectures: chosen students per chapter and batch; one playback device per student.
-- New tables only.

CREATE TABLE IF NOT EXISTS "recorded_chapter_access" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "selectedOnly" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "recorded_chapter_access_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "recorded_chapter_access_batchId_chapterId_key" ON "recorded_chapter_access"("batchId", "chapterId");

CREATE TABLE IF NOT EXISTS "recorded_chapter_viewers" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recorded_chapter_viewers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "recorded_chapter_viewers_batchId_chapterId_studentId_key" ON "recorded_chapter_viewers"("batchId", "chapterId", "studentId");
CREATE INDEX IF NOT EXISTS "recorded_chapter_viewers_studentId_idx" ON "recorded_chapter_viewers"("studentId");

CREATE TABLE IF NOT EXISTS "recorded_playback_sessions" (
    "studentId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recorded_playback_sessions_pkey" PRIMARY KEY ("studentId")
);
