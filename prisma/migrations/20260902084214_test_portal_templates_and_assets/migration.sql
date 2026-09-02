-- AlterTable
ALTER TABLE "test_series" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT';

-- CreateIndex
CREATE INDEX "test_series_status_idx" ON "test_series"("status");

-- AlterTable
ALTER TABLE "tests" ADD COLUMN "templateId" TEXT;

-- CreateIndex
CREATE INDEX "tests_templateId_idx" ON "tests"("templateId");

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "test_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "question_assets" (
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
CREATE INDEX "question_assets_questionId_idx" ON "question_assets"("questionId");

-- AddForeignKey
ALTER TABLE "question_assets" ADD CONSTRAINT "question_assets_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_assets" ADD CONSTRAINT "question_assets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
