/*
  Warnings:

  - The values [MCQ] on the enum `QuestionType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `body` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the column `chapterId` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the column `correctOption` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the column `explanation` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the column `marksCorrect` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the column `marksIncorrect` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the column `optionA` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the column `optionB` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the column `optionC` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the column `optionD` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the column `subjectId` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the column `verifiedAt` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the column `verifiedById` on the `questions` table. All the data in the column will be lost.
  - The `difficulty` column on the `questions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `title` on the `tests` table. All the data in the column will be lost.
  - You are about to drop the `test_attempt_answers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `test_attempts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `test_questions` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[questionCode]` on the table `questions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code]` on the table `tests` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `subject` to the `questions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `tests` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "LanguageMode" AS ENUM ('HINDI', 'ENGLISH', 'BOTH');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED');

-- CreateEnum
CREATE TYPE "ModuleStatus" AS ENUM ('DRAFT', 'PROCESSING', 'REVIEW_REQUIRED', 'READY', 'PUBLISHED', 'ARCHIVED', 'FAILED');

-- CreateEnum
CREATE TYPE "ModulePdfType" AS ENUM ('DIGITAL', 'SCANNED', 'HYBRID', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ModuleElementType" AS ENUM ('TEXT', 'HEADING', 'SUBHEADING', 'PARAGRAPH', 'QUESTION', 'OPTION', 'SOLUTION', 'IMAGE', 'DIAGRAM', 'EQUATION', 'CHEMICAL_EQUATION', 'CHEMICAL_STRUCTURE', 'TABLE', 'SHAPE', 'LINE', 'RECTANGLE', 'CIRCLE', 'ARROW', 'TEXT_BOX', 'PAGE_BACKGROUND', 'HEADER', 'FOOTER', 'WATERMARK', 'PAGE_NUMBER');

-- CreateEnum
CREATE TYPE "ProcessingStage" AS ENUM ('UPLOADING', 'ANALYZING', 'EXTRACTING', 'OCR_PROCESSING', 'RECONSTRUCTING_LAYOUT', 'GENERATING_PREVIEW', 'READY_FOR_REVIEW', 'FAILED');

-- AlterEnum
ALTER TYPE "GlobalRole" ADD VALUE 'SUB_ADMIN';

-- AlterEnum
BEGIN;
CREATE TYPE "QuestionType_new" AS ENUM ('SINGLE_CORRECT', 'MULTIPLE_CORRECT', 'INTEGER', 'NUMERICAL', 'STATEMENT_BASED', 'MATCH_COLUMN', 'ASSERTION_REASON');
ALTER TABLE "questions" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "questions" ALTER COLUMN "type" TYPE "QuestionType_new" USING ("type"::text::"QuestionType_new");
ALTER TYPE "QuestionType" RENAME TO "QuestionType_old";
ALTER TYPE "QuestionType_new" RENAME TO "QuestionType";
DROP TYPE "QuestionType_old";
ALTER TABLE "questions" ALTER COLUMN "type" SET DEFAULT 'SINGLE_CORRECT';
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TestStatus" ADD VALUE 'PENDING_APPROVAL';
ALTER TYPE "TestStatus" ADD VALUE 'UNDER_REVIEW';
ALTER TYPE "TestStatus" ADD VALUE 'APPROVED';

-- DropForeignKey
ALTER TABLE "questions" DROP CONSTRAINT "questions_chapterId_fkey";

-- DropForeignKey
ALTER TABLE "questions" DROP CONSTRAINT "questions_createdById_fkey";

-- DropForeignKey
ALTER TABLE "questions" DROP CONSTRAINT "questions_subjectId_fkey";

-- DropForeignKey
ALTER TABLE "questions" DROP CONSTRAINT "questions_verifiedById_fkey";

-- DropForeignKey
ALTER TABLE "test_attempt_answers" DROP CONSTRAINT "test_attempt_answers_attemptId_fkey";

-- DropForeignKey
ALTER TABLE "test_attempt_answers" DROP CONSTRAINT "test_attempt_answers_questionId_fkey";

-- DropForeignKey
ALTER TABLE "test_attempts" DROP CONSTRAINT "test_attempts_studentId_fkey";

-- DropForeignKey
ALTER TABLE "test_attempts" DROP CONSTRAINT "test_attempts_testId_fkey";

-- DropForeignKey
ALTER TABLE "test_questions" DROP CONSTRAINT "test_questions_questionId_fkey";

-- DropForeignKey
ALTER TABLE "test_questions" DROP CONSTRAINT "test_questions_testId_fkey";

-- DropIndex
DROP INDEX "questions_chapterId_idx";

-- DropIndex
DROP INDEX "questions_status_idx";

-- DropIndex
DROP INDEX "questions_subjectId_idx";

-- AlterTable
ALTER TABLE "questions" DROP COLUMN "body",
DROP COLUMN "chapterId",
DROP COLUMN "correctOption",
DROP COLUMN "explanation",
DROP COLUMN "marksCorrect",
DROP COLUMN "marksIncorrect",
DROP COLUMN "optionA",
DROP COLUMN "optionB",
DROP COLUMN "optionC",
DROP COLUMN "optionD",
DROP COLUMN "status",
DROP COLUMN "subjectId",
DROP COLUMN "updatedAt",
DROP COLUMN "verifiedAt",
DROP COLUMN "verifiedById",
ADD COLUMN     "category" TEXT,
ADD COLUMN     "chapter" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "publishedById" TEXT,
ADD COLUMN     "pyqSource" TEXT,
ADD COLUMN     "questionCode" TEXT,
ADD COLUMN     "solution" TEXT,
ADD COLUMN     "subTopic" TEXT,
ADD COLUMN     "subject" TEXT NOT NULL,
ADD COLUMN     "topic" TEXT,
ADD COLUMN     "usageCount" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "type" SET DEFAULT 'SINGLE_CORRECT',
DROP COLUMN "difficulty",
ADD COLUMN     "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
ALTER COLUMN "tags" DROP NOT NULL,
ALTER COLUMN "tags" DROP DEFAULT,
ALTER COLUMN "tags" SET DATA TYPE TEXT,
ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "tests" DROP COLUMN "title",
ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "closeTime" TIMESTAMP(3),
ADD COLUMN     "code" TEXT,
ADD COLUMN     "correctMarks" DOUBLE PRECISION NOT NULL DEFAULT 4,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "examType" TEXT,
ADD COLUMN     "incorrectMarks" DOUBLE PRECISION NOT NULL DEFAULT -1,
ADD COLUMN     "languageMode" "LanguageMode" NOT NULL DEFAULT 'BOTH',
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "negativeMarkingEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "openTime" TIMESTAMP(3),
ADD COLUMN     "questionFormat" TEXT NOT NULL DEFAULT 'OBJECTIVE',
ADD COLUMN     "testSeriesId" TEXT,
ADD COLUMN     "testType" TEXT,
ALTER COLUMN "batchScheduleId" DROP NOT NULL,
ALTER COLUMN "createdById" DROP NOT NULL;

-- DropTable
DROP TABLE "test_attempt_answers";

-- DropTable
DROP TABLE "test_attempts";

-- DropTable
DROP TABLE "test_questions";

-- DropEnum
DROP TYPE "DifficultyLevel";

-- DropEnum
DROP TYPE "QuestionStatus";

-- DropEnum
DROP TYPE "TestAttemptStatus";

-- CreateTable
CREATE TABLE "test_series" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "targetBatch" TEXT,
    "className" TEXT,
    "course" TEXT,
    "examType" TEXT,
    "tags" TEXT,
    "thumbnailUrl" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "subject" TEXT NOT NULL,
    "targetCount" INTEGER NOT NULL DEFAULT 0,
    "marksPerQuestion" DOUBLE PRECISION,
    "negativeMarks" DOUBLE PRECISION,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "section_questions" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "marksOverride" DOUBLE PRECISION,
    "negativeMarksOverride" DOUBLE PRECISION,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "section_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempts" (
    "id" TEXT NOT NULL,
    "testId" TEXT,
    "dppId" TEXT,
    "studentId" TEXT NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION,
    "rank" INTEGER,
    "integrityScore" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_answers" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOptionIds" JSONB NOT NULL DEFAULT '[]',
    "isCorrect" BOOLEAN,
    "timeTakenSec" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attempt_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_violations" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attempt_violations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_versions" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "editedById" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "changeType" TEXT NOT NULL DEFAULT 'EDIT',
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "question_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_reports" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "testId" TEXT,
    "reasonTags" TEXT NOT NULL,
    "comment" TEXT,
    "screenshotUrl" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "reportedById" TEXT NOT NULL,
    "claimedById" TEXT,
    "claimedAt" TIMESTAMP(3),
    "teacherNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "question_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_template_sections" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "targetCount" INTEGER NOT NULL,
    "marksPerQuestion" DOUBLE PRECISION,
    "negativeMarks" DOUBLE PRECISION,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "test_template_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dpps" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "chapter" TEXT NOT NULL,
    "facultyName" TEXT,
    "difficulty" TEXT NOT NULL DEFAULT 'MEDIUM',
    "languageMode" "LanguageMode" NOT NULL DEFAULT 'BOTH',
    "description" TEXT,
    "tags" TEXT,
    "instructions" TEXT,
    "estimatedTimeMin" INTEGER NOT NULL DEFAULT 30,
    "correctMarks" DOUBLE PRECISION NOT NULL DEFAULT 4,
    "incorrectMarks" DOUBLE PRECISION NOT NULL DEFAULT -1,
    "negativeMarkingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "questionTargetCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "level" INTEGER,
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dpps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dpp_questions" (
    "id" TEXT NOT NULL,
    "dppId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "dpp_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookmarks" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rank_trend_points" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "marks" INTEGER NOT NULL,
    "expectedRank" INTEGER NOT NULL,
    "year" INTEGER NOT NULL DEFAULT 2026,
    "confidence" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rank_trend_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "college_allotments" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "round" TEXT NOT NULL DEFAULT 'Round 1',
    "rank" INTEGER NOT NULL,
    "quota" TEXT NOT NULL,
    "instituteName" TEXT NOT NULL,
    "course" TEXT NOT NULL,
    "allottedCategory" TEXT NOT NULL,
    "candidateCategory" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "college_allotments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceHash" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "browser" TEXT,
    "os" TEXT,
    "timezone" TEXT,
    "screenRes" TEXT,
    "ipAddress" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_config" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "policy" TEXT NOT NULL DEFAULT 'SINGLE_SESSION',

    CONSTRAINT "security_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_translations" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctOptionIds" JSONB NOT NULL,
    "solution" TEXT,

    CONSTRAINT "question_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT,
    "class" TEXT,
    "batch" TEXT,
    "chapter" TEXT,
    "facultyName" TEXT,
    "academicYear" TEXT,
    "status" "ModuleStatus" NOT NULL DEFAULT 'DRAFT',
    "pdfType" "ModulePdfType" NOT NULL DEFAULT 'UNKNOWN',
    "originalFileUrl" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "originalFileSize" INTEGER NOT NULL,
    "pageCount" INTEGER,
    "rightsConfirmedById" TEXT,
    "rightsConfirmedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "brandProfileId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_pages" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "pdfType" "ModulePdfType" NOT NULL DEFAULT 'UNKNOWN',
    "referenceImageUrl" TEXT,
    "elements" JSONB NOT NULL DEFAULT '[]',
    "ocrConfidence" DOUBLE PRECISION,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_assets" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sourcePage" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_versions" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "fontFamily" TEXT,
    "websiteUrl" TEXT,
    "tagline" TEXT,
    "headerConfig" JSONB NOT NULL DEFAULT '{}',
    "footerConfig" JSONB NOT NULL DEFAULT '{}',
    "watermarkConfig" JSONB NOT NULL DEFAULT '{}',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_jobs" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "stage" "ProcessingStage" NOT NULL DEFAULT 'UPLOADING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "processing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_exports" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "versionId" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "quality" TEXT NOT NULL DEFAULT 'STANDARD',
    "includedFrontPage" BOOLEAN NOT NULL DEFAULT true,
    "includedWatermark" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "test_series_code_key" ON "test_series"("code");

-- CreateIndex
CREATE INDEX "sections_testId_idx" ON "sections"("testId");

-- CreateIndex
CREATE INDEX "section_questions_sectionId_idx" ON "section_questions"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "section_questions_sectionId_questionId_key" ON "section_questions"("sectionId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "section_questions_sectionId_order_key" ON "section_questions"("sectionId", "order");

-- CreateIndex
CREATE INDEX "attempts_testId_idx" ON "attempts"("testId");

-- CreateIndex
CREATE INDEX "attempts_studentId_idx" ON "attempts"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "attempts_testId_studentId_key" ON "attempts"("testId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "attempts_dppId_studentId_key" ON "attempts"("dppId", "studentId");

-- CreateIndex
CREATE INDEX "attempt_answers_attemptId_idx" ON "attempt_answers"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_answers_attemptId_questionId_key" ON "attempt_answers"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "attempt_violations_attemptId_idx" ON "attempt_violations"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "question_versions_questionId_versionNumber_key" ON "question_versions"("questionId", "versionNumber");

-- CreateIndex
CREATE INDEX "question_reports_questionId_idx" ON "question_reports"("questionId");

-- CreateIndex
CREATE INDEX "question_reports_status_idx" ON "question_reports"("status");

-- CreateIndex
CREATE INDEX "test_template_sections_templateId_idx" ON "test_template_sections"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "dpps_code_key" ON "dpps"("code");

-- CreateIndex
CREATE INDEX "dpp_questions_dppId_idx" ON "dpp_questions"("dppId");

-- CreateIndex
CREATE UNIQUE INDEX "bookmarks_studentId_questionId_key" ON "bookmarks"("studentId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "rank_trend_points_category_marks_year_key" ON "rank_trend_points"("category", "marks", "year");

-- CreateIndex
CREATE INDEX "college_allotments_year_rank_idx" ON "college_allotments"("year", "rank");

-- CreateIndex
CREATE INDEX "college_allotments_year_course_allottedCategory_idx" ON "college_allotments"("year", "course", "allottedCategory");

-- CreateIndex
CREATE INDEX "device_sessions_userId_idx" ON "device_sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "question_translations_questionId_language_key" ON "question_translations"("questionId", "language");

-- CreateIndex
CREATE UNIQUE INDEX "modules_code_key" ON "modules"("code");

-- CreateIndex
CREATE UNIQUE INDEX "module_pages_moduleId_pageNumber_key" ON "module_pages"("moduleId", "pageNumber");

-- CreateIndex
CREATE INDEX "module_assets_moduleId_idx" ON "module_assets"("moduleId");

-- CreateIndex
CREATE INDEX "module_versions_moduleId_idx" ON "module_versions"("moduleId");

-- CreateIndex
CREATE INDEX "processing_jobs_moduleId_idx" ON "processing_jobs"("moduleId");

-- CreateIndex
CREATE INDEX "module_exports_moduleId_idx" ON "module_exports"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "questions_questionCode_key" ON "questions"("questionCode");

-- CreateIndex
CREATE INDEX "questions_subject_idx" ON "questions"("subject");

-- CreateIndex
CREATE INDEX "questions_difficulty_idx" ON "questions"("difficulty");

-- CreateIndex
CREATE INDEX "questions_isPublished_idx" ON "questions"("isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "tests_code_key" ON "tests"("code");

-- CreateIndex
CREATE INDEX "tests_testSeriesId_idx" ON "tests"("testSeriesId");

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_testSeriesId_fkey" FOREIGN KEY ("testSeriesId") REFERENCES "test_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_testId_fkey" FOREIGN KEY ("testId") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_questions" ADD CONSTRAINT "section_questions_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_questions" ADD CONSTRAINT "section_questions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_testId_fkey" FOREIGN KEY ("testId") REFERENCES "tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_dppId_fkey" FOREIGN KEY ("dppId") REFERENCES "dpps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_violations" ADD CONSTRAINT "attempt_violations_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_versions" ADD CONSTRAINT "question_versions_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_versions" ADD CONSTRAINT "question_versions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_templates" ADD CONSTRAINT "test_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_template_sections" ADD CONSTRAINT "test_template_sections_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "test_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dpps" ADD CONSTRAINT "dpps_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dpp_questions" ADD CONSTRAINT "dpp_questions_dppId_fkey" FOREIGN KEY ("dppId") REFERENCES "dpps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dpp_questions" ADD CONSTRAINT "dpp_questions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_translations" ADD CONSTRAINT "question_translations_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "brand_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_pages" ADD CONSTRAINT "module_pages_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_assets" ADD CONSTRAINT "module_assets_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_versions" ADD CONSTRAINT "module_versions_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_profiles" ADD CONSTRAINT "brand_profiles_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_exports" ADD CONSTRAINT "module_exports_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
