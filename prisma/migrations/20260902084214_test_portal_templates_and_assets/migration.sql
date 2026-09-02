-- This migration is written defensively (IF NOT EXISTS / existence checks
-- before ADD CONSTRAINT) because test_series.status was found to already
-- exist in production when this migration first ran (P3018) — evidence
-- that an earlier out-of-band change (a `prisma db push` or manual ALTER)
-- created it without ever recording a migration. Idempotent here so this
-- file is safe to (re)apply regardless of exactly which of these columns/
-- table/constraints already exist, while still being correct as the sole
-- source of truth for a fresh database built from migration history.

-- AlterTable
ALTER TABLE "test_series" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'DRAFT';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "test_series_status_idx" ON "test_series"("status");

-- AlterTable
ALTER TABLE "tests" ADD COLUMN IF NOT EXISTS "templateId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tests_templateId_idx" ON "tests"("templateId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tests_templateId_fkey') THEN
    ALTER TABLE "tests" ADD CONSTRAINT "tests_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "test_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "question_assets" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'REFERENCE',
    "storageKey" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "checksum" TEXT,
    "ocrText" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "question_assets_questionId_idx" ON "question_assets"("questionId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'question_assets_questionId_fkey') THEN
    ALTER TABLE "question_assets" ADD CONSTRAINT "question_assets_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'question_assets_createdById_fkey') THEN
    ALTER TABLE "question_assets" ADD CONSTRAINT "question_assets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
