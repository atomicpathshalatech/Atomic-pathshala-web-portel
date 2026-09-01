/*
  Warnings:

  - A unique constraint covering the columns `[chapterId]` on the table `chapters` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `chapters` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ChapterStatus" AS ENUM ('DRAFT', 'LECTURES_IN_PROGRESS', 'LECTURES_COMPLETE', 'TESTS_PENDING', 'READY_TO_PUBLISH', 'PUBLISHED', 'ARCHIVED');

-- AlterEnum
ALTER TYPE "XPReason" ADD VALUE 'LECTURE_COMPLETED';

-- AlterTable
ALTER TABLE "batch_schedules" ADD COLUMN     "previousEndsAt" TIMESTAMP(3),
ADD COLUMN     "previousStartsAt" TIMESTAMP(3),
ADD COLUMN     "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rescheduledAt" TIMESTAMP(3),
ADD COLUMN     "rescheduledById" TEXT;

-- AlterTable
ALTER TABLE "chapters" ADD COLUMN     "chapterId" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "ChapterStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "dpps" ADD COLUMN     "chapterId" TEXT;

-- AlterTable
ALTER TABLE "tests" ADD COLUMN     "chapterId" TEXT;

-- CreateTable
CREATE TABLE "teacher_follows" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lecture_progress" (
    "id" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lecture_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teacher_follows_teacherId_idx" ON "teacher_follows"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_follows_studentId_teacherId_key" ON "teacher_follows"("studentId", "teacherId");

-- CreateIndex
CREATE INDEX "lecture_progress_studentId_idx" ON "lecture_progress"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "lecture_progress_lectureId_studentId_key" ON "lecture_progress"("lectureId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_chapterId_key" ON "chapters"("chapterId");

-- CreateIndex
CREATE INDEX "chapters_status_idx" ON "chapters"("status");

-- CreateIndex
CREATE INDEX "dpps_chapterId_idx" ON "dpps"("chapterId");

-- CreateIndex
CREATE INDEX "tests_chapterId_idx" ON "tests"("chapterId");

-- AddForeignKey
ALTER TABLE "teacher_follows" ADD CONSTRAINT "teacher_follows_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_follows" ADD CONSTRAINT "teacher_follows_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dpps" ADD CONSTRAINT "dpps_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecture_progress" ADD CONSTRAINT "lecture_progress_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "lectures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecture_progress" ADD CONSTRAINT "lecture_progress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
