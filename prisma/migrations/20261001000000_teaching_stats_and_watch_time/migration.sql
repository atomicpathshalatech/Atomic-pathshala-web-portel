-- CreateTable
CREATE TABLE "youtube_video_stats" (
    "videoId" TEXT NOT NULL,
    "durationSec" INTEGER,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT,
    "error" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "youtube_video_stats_pkey" PRIMARY KEY ("videoId")
);

-- CreateTable
CREATE TABLE "video_watches" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "contentKey" TEXT NOT NULL,
    "lectureId" TEXT,
    "batchScheduleId" TEXT,
    "watchedSec" INTEGER NOT NULL DEFAULT 0,
    "lastPositionSec" INTEGER NOT NULL DEFAULT 0,
    "durationSec" INTEGER,
    "firstWatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastWatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_watches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "video_watches_lectureId_idx" ON "video_watches"("lectureId");

-- CreateIndex
CREATE INDEX "video_watches_batchScheduleId_idx" ON "video_watches"("batchScheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "video_watches_studentId_contentKey_key" ON "video_watches"("studentId", "contentKey");

-- AddForeignKey
ALTER TABLE "video_watches" ADD CONSTRAINT "video_watches_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_watches" ADD CONSTRAINT "video_watches_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "lectures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_watches" ADD CONSTRAINT "video_watches_batchScheduleId_fkey" FOREIGN KEY ("batchScheduleId") REFERENCES "batch_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
