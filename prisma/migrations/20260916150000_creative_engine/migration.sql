-- Dynamic Educator Creative & Auto-Thumbnail System
-- Hand-trimmed from `prisma migrate diff`: the raw diff also included
-- pre-existing, unrelated drift (study_plans/study_plan_tasks/
-- coach_conversations/coach_messages declared in schema.prisma but never
-- migrated; a DROP/ADD of users_roleId_fkey Prisma re-normalizes after any
-- schema change; notification_*.updatedAt DROP DEFAULT noise from another
-- migration) — none of that belongs here, so only the statements for the
-- creative system are kept.

-- CreateEnum
CREATE TYPE "CreativeType" AS ENUM ('BATCH', 'TEST_SERIES', 'CHAPTER', 'LECTURE', 'LECTURE_START_SLIDE');

-- CreateEnum
CREATE TYPE "CreativeStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "CreativeBackgroundKind" AS ENUM ('SOLID', 'GRADIENT', 'IMAGE');

-- AlterTable
ALTER TABLE "batches" ADD COLUMN     "thumbnailIsAuto" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "teachers" ADD COLUMN     "creativeAssetVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "creativePngHasAlpha" BOOLEAN,
ADD COLUMN     "creativePngHeight" INTEGER,
ADD COLUMN     "creativePngSizeBytes" INTEGER,
ADD COLUMN     "creativePngUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "creativePngUrl" TEXT,
ADD COLUMN     "creativePngWidth" INTEGER;

-- AlterTable
ALTER TABLE "test_series" ADD COLUMN     "thumbnailIsAuto" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "test_series_teachers" (
    "id" TEXT NOT NULL,
    "testSeriesId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subject" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_series_teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creative_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CreativeType" NOT NULL,
    "layoutConfig" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creative_backgrounds" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "CreativeBackgroundKind" NOT NULL,
    "value" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creative_backgrounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_creatives" (
    "id" TEXT NOT NULL,
    "type" "CreativeType" NOT NULL,
    "sourceEntityType" TEXT NOT NULL,
    "sourceEntityId" TEXT NOT NULL,
    "templateId" TEXT,
    "backgroundId" TEXT,
    "assetUrl" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "sourceVersionHash" TEXT,
    "status" "CreativeStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_creatives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "test_series_teachers_teacherId_idx" ON "test_series_teachers"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "test_series_teachers_testSeriesId_teacherId_subject_key" ON "test_series_teachers"("testSeriesId", "teacherId", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "creative_templates_key_key" ON "creative_templates"("key");

-- CreateIndex
CREATE INDEX "creative_templates_type_idx" ON "creative_templates"("type");

-- CreateIndex
CREATE INDEX "generated_creatives_sourceEntityType_sourceEntityId_idx" ON "generated_creatives"("sourceEntityType", "sourceEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "generated_creatives_type_sourceEntityId_key" ON "generated_creatives"("type", "sourceEntityId");

-- AddForeignKey
ALTER TABLE "test_series_teachers" ADD CONSTRAINT "test_series_teachers_testSeriesId_fkey" FOREIGN KEY ("testSeriesId") REFERENCES "test_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_series_teachers" ADD CONSTRAINT "test_series_teachers_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_creatives" ADD CONSTRAINT "generated_creatives_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "creative_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_creatives" ADD CONSTRAINT "generated_creatives_backgroundId_fkey" FOREIGN KEY ("backgroundId") REFERENCES "creative_backgrounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
