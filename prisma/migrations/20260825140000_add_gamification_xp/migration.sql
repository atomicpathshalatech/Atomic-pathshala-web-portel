-- CreateEnum
CREATE TYPE "XPReason" AS ENUM ('TEST_COMPLETED', 'DPP_COMPLETED', 'QUIZ_CORRECT_ANSWER', 'LIVE_CLASS_ATTENDANCE', 'DAILY_LOGIN_STREAK', 'DOUBT_RESOLVED', 'OTHER');

-- AlterTable: Student — gamification cache fields
ALTER TABLE "students"
  ADD COLUMN "xp" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "level" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "currentStreakDays" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "longestStreakDays" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastActivityDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "students_xp_idx" ON "students"("xp");

-- CreateTable
CREATE TABLE "xp_events" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" "XPReason" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "xp_events_studentId_createdAt_idx" ON "xp_events"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "xp_events_createdAt_idx" ON "xp_events"("createdAt");

-- AddForeignKey
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
