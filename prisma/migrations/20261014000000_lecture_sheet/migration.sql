-- CreateTable
CREATE TABLE "lecture_sheet_rows" (
    "scheduleId" TEXT NOT NULL,
    "rowNumber" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lecture_sheet_rows_pkey" PRIMARY KEY ("scheduleId")
);

-- CreateTable
CREATE TABLE "lecture_video_mappings" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT,
    "lectureRef" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "videoId" TEXT,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "source" TEXT NOT NULL,
    "previousUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lecture_video_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lecture_sheet_rows_status_idx" ON "lecture_sheet_rows"("status");

-- CreateIndex
CREATE INDEX "lecture_video_mappings_scheduleId_idx" ON "lecture_video_mappings"("scheduleId");

-- CreateIndex
CREATE INDEX "lecture_video_mappings_createdAt_idx" ON "lecture_video_mappings"("createdAt");

-- AddForeignKey
ALTER TABLE "lecture_sheet_rows" ADD CONSTRAINT "lecture_sheet_rows_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "batch_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecture_video_mappings" ADD CONSTRAINT "lecture_video_mappings_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "batch_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

