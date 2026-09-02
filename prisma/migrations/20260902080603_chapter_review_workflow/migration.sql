-- AlterTable
ALTER TABLE "chapters"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "learningObjectives" TEXT,
  ADD COLUMN "prerequisites" TEXT;

-- AlterEnum
ALTER TYPE "ChapterStatus" ADD VALUE 'SUBMITTED';
ALTER TYPE "ChapterStatus" ADD VALUE 'UNDER_REVIEW';
ALTER TYPE "ChapterStatus" ADD VALUE 'APPROVED';
ALTER TYPE "ChapterStatus" ADD VALUE 'REJECTED';
ALTER TYPE "ChapterStatus" ADD VALUE 'CHANGES_REQUESTED';

-- CreateEnum
CREATE TYPE "ChapterReviewAction" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

-- CreateTable
CREATE TABLE "chapter_reviews" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "action" "ChapterReviewAction" NOT NULL,
    "comment" TEXT,
    "actorId" TEXT NOT NULL,
    "previousStatus" "ChapterStatus" NOT NULL,
    "newStatus" "ChapterStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chapter_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chapter_reviews_chapterId_idx" ON "chapter_reviews"("chapterId");

-- CreateIndex
CREATE INDEX "chapter_reviews_actorId_idx" ON "chapter_reviews"("actorId");

-- AddForeignKey
ALTER TABLE "chapter_reviews" ADD CONSTRAINT "chapter_reviews_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_reviews" ADD CONSTRAINT "chapter_reviews_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
