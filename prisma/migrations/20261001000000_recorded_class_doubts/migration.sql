-- AlterTable
ALTER TABLE "doubts" ADD COLUMN "batchScheduleId" TEXT,
ADD COLUMN "videoTimestampSec" INTEGER,
ADD COLUMN "studentVoiceUrl" TEXT,
ADD COLUMN "studentVoiceDurationSec" INTEGER;

-- CreateIndex
CREATE INDEX "doubts_batchScheduleId_idx" ON "doubts"("batchScheduleId");

-- AddForeignKey
ALTER TABLE "doubts" ADD CONSTRAINT "doubts_batchScheduleId_fkey" FOREIGN KEY ("batchScheduleId") REFERENCES "batch_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
