-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MCQ', 'INTEGER');

-- CreateEnum
CREATE TYPE "DifficultyLevel" AS ENUM ('EASY', 'MEDIUM', 'HARD', 'ADVANCED');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('PENDING', 'VERIFIED', 'FLAGGED');

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL DEFAULT 'MCQ',
    "optionA" TEXT,
    "optionB" TEXT,
    "optionC" TEXT,
    "optionD" TEXT,
    "correctOption" TEXT NOT NULL,
    "explanation" TEXT,
    "marksCorrect" INTEGER NOT NULL DEFAULT 4,
    "marksIncorrect" INTEGER NOT NULL DEFAULT -1,
    "difficulty" "DifficultyLevel" NOT NULL DEFAULT 'MEDIUM',
    "status" "QuestionStatus" NOT NULL DEFAULT 'PENDING',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subjectId" TEXT,
    "chapterId" TEXT,
    "createdById" TEXT NOT NULL,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "questions_subjectId_idx" ON "questions"("subjectId");

-- CreateIndex
CREATE INDEX "questions_chapterId_idx" ON "questions"("chapterId");

-- CreateIndex
CREATE INDEX "questions_status_idx" ON "questions"("status");

-- CreateIndex
CREATE INDEX "questions_difficulty_idx" ON "questions"("difficulty");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
