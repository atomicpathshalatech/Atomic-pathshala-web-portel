-- Idempotent: written so it also completes on a database that already has
-- some or all of these objects (e.g. created by `prisma db push` before
-- this migration ran). Every statement is IF NOT EXISTS / duplicate-safe.

-- AlterTable
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "contentFingerprint" TEXT;

-- AlterTable
ALTER TABLE "extraction_jobs" ADD COLUMN IF NOT EXISTS "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "hasAnswerKey" BOOLEAN,
ADD COLUMN IF NOT EXISTS "hasSolutions" BOOLEAN,
ADD COLUMN IF NOT EXISTS "isPyqImport" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "language" TEXT,
ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "paper" TEXT,
ADD COLUMN IF NOT EXISTS "pyqExamId" TEXT,
ADD COLUMN IF NOT EXISTS "session" TEXT,
ADD COLUMN IF NOT EXISTS "shift" TEXT,
ADD COLUMN IF NOT EXISTS "sourceReference" TEXT,
ADD COLUMN IF NOT EXISTS "yearMode" TEXT NOT NULL DEFAULT 'SINGLE';

-- AlterTable
ALTER TABLE "extracted_questions" ADD COLUMN IF NOT EXISTS "chapterCandidates" JSONB,
ADD COLUMN IF NOT EXISTS "contentFingerprint" TEXT,
ADD COLUMN IF NOT EXISTS "duplicateDecision" TEXT,
ADD COLUMN IF NOT EXISTS "duplicateOfQuestionId" TEXT,
ADD COLUMN IF NOT EXISTS "duplicateScore" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "extractionMethod" TEXT,
ADD COLUMN IF NOT EXISTS "metadataMethod" TEXT,
ADD COLUMN IF NOT EXISTS "needsChapterReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "pyqExamId" TEXT,
ADD COLUMN IF NOT EXISTS "pyqPaper" TEXT,
ADD COLUMN IF NOT EXISTS "pyqSession" TEXT,
ADD COLUMN IF NOT EXISTS "pyqShift" TEXT,
ADD COLUMN IF NOT EXISTS "reviewDecision" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "reviewedById" TEXT,
ADD COLUMN IF NOT EXISTS "sectionLabel" TEXT,
ADD COLUMN IF NOT EXISTS "sourceKey" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "pyq_exams" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "canonicalType" TEXT NOT NULL DEFAULT 'OTHER',
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "legacyCode" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pyq_exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pyq_occurrences" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "year" INTEGER,
    "session" TEXT,
    "shift" TEXT,
    "paper" TEXT,
    "questionNumber" TEXT,
    "sourceLabel" TEXT,
    "sourceReference" TEXT,
    "sourcePage" INTEGER,
    "extractionJobId" TEXT,
    "extractedQuestionId" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "detectionMethod" TEXT NOT NULL DEFAULT 'MANUAL',
    "occurrenceKey" TEXT NOT NULL,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pyq_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "question_modules" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "subject" TEXT,
    "chapter" TEXT,
    "displayFormat" TEXT NOT NULL DEFAULT 'ANSWER_KEY_END',
    "showSourceLabels" BOOLEAN NOT NULL DEFAULT true,
    "pageSize" TEXT NOT NULL DEFAULT 'A4',
    "coverPage" BOOLEAN NOT NULL DEFAULT true,
    "contentsPage" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "question_module_sections" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "pageBreakBefore" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_module_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "question_module_items" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "kind" TEXT NOT NULL DEFAULT 'QUESTION',
    "questionId" TEXT,
    "occurrenceId" TEXT,
    "content" JSONB,
    "presentation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_module_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "question_module_exports" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "pageCount" INTEGER,
    "warnings" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_module_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "pyq_exams_slug_key" ON "pyq_exams"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pyq_exams_canonicalType_idx" ON "pyq_exams"("canonicalType");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "pyq_occurrences_extractedQuestionId_key" ON "pyq_occurrences"("extractedQuestionId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "pyq_occurrences_occurrenceKey_key" ON "pyq_occurrences"("occurrenceKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pyq_occurrences_examId_year_idx" ON "pyq_occurrences"("examId", "year");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pyq_occurrences_questionId_idx" ON "pyq_occurrences"("questionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pyq_occurrences_verificationStatus_examId_year_idx" ON "pyq_occurrences"("verificationStatus", "examId", "year");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pyq_occurrences_extractionJobId_idx" ON "pyq_occurrences"("extractionJobId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "question_modules_createdById_idx" ON "question_modules"("createdById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "question_module_sections_moduleId_order_idx" ON "question_module_sections"("moduleId", "order");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "question_module_items_sectionId_order_idx" ON "question_module_items"("sectionId", "order");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "question_module_items_questionId_idx" ON "question_module_items"("questionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "question_module_exports_moduleId_idx" ON "question_module_exports"("moduleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "questions_contentFingerprint_idx" ON "questions"("contentFingerprint");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "questions_subject_chapter_idx" ON "questions"("subject", "chapter");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "extracted_questions_jobId_reviewDecision_idx" ON "extracted_questions"("jobId", "reviewDecision");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "extracted_questions_contentFingerprint_idx" ON "extracted_questions"("contentFingerprint");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "extracted_questions_jobId_sourceKey_key" ON "extracted_questions"("jobId", "sourceKey");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "extraction_jobs" ADD CONSTRAINT "extraction_jobs_pyqExamId_fkey" FOREIGN KEY ("pyqExamId") REFERENCES "pyq_exams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "extracted_questions" ADD CONSTRAINT "extracted_questions_pyqExamId_fkey" FOREIGN KEY ("pyqExamId") REFERENCES "pyq_exams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "pyq_occurrences" ADD CONSTRAINT "pyq_occurrences_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "pyq_occurrences" ADD CONSTRAINT "pyq_occurrences_examId_fkey" FOREIGN KEY ("examId") REFERENCES "pyq_exams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "pyq_occurrences" ADD CONSTRAINT "pyq_occurrences_extractionJobId_fkey" FOREIGN KEY ("extractionJobId") REFERENCES "extraction_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "question_module_sections" ADD CONSTRAINT "question_module_sections_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "question_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "question_module_items" ADD CONSTRAINT "question_module_items_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "question_module_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "question_module_items" ADD CONSTRAINT "question_module_items_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "question_module_exports" ADD CONSTRAINT "question_module_exports_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "question_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ---------------------------------------------------------------------------
-- Seed the three standard exams. Alias keys are lower-case letters/digits
-- only (src/lib/pyq/exams.ts normalizeExamKey). Unknown exams are never
-- folded into these — an import creates its own exam row instead.
-- ---------------------------------------------------------------------------
INSERT INTO "pyq_exams" ("id", "slug", "name", "canonicalType", "aliases", "legacyCode", "sortOrder", "isActive", "createdAt", "updatedAt") VALUES
  ('pyqexam_neet_ug', 'neet-ug', 'NEET UG', 'NEET_UG', ARRAY['neet','neetug','neetugexam','aipmt','cbseaipmt','aipmtneet'], 'NEET', 10, true, now(), now()),
  ('pyqexam_jee_main', 'jee-main', 'JEE Main', 'JEE_MAIN', ARRAY['jeemain','jeemains','jeemainexam','aieee','jeemainsexam'], 'JEE_MAINS', 20, true, now(), now()),
  ('pyqexam_jee_adv', 'jee-advanced', 'JEE Advanced', 'JEE_ADVANCED', ARRAY['jeeadvanced','jeeadv','iitjee','iitjeeadvanced','jeeadvance'], 'JEE_ADVANCED', 30, true, now(), now())
-- A row with the same slug may already exist (created before this migration
-- ran): keep its id and data, only fill in the standard aliases and type.
ON CONFLICT ("slug") DO UPDATE SET
  "aliases" = ARRAY(SELECT DISTINCT a FROM unnest("pyq_exams"."aliases" || EXCLUDED."aliases") AS a),
  "canonicalType" = EXCLUDED."canonicalType",
  "legacyCode" = COALESCE("pyq_exams"."legacyCode", EXCLUDED."legacyCode"),
  "sortOrder" = LEAST("pyq_exams"."sortOrder", EXCLUDED."sortOrder"),
  "updatedAt" = now();

-- Any other legacy Question.pyqExam value gets its own exam (kept as written).
INSERT INTO "pyq_exams" ("id", "slug", "name", "canonicalType", "aliases", "legacyCode", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT 'pyqexam_legacy_' || md5(v.code), 'legacy-' || lower(regexp_replace(v.code, '[^A-Za-z0-9]+', '-', 'g')), v.code, 'OTHER',
       ARRAY[lower(regexp_replace(v.code, '[^A-Za-z0-9]+', '', 'g'))], v.code, 100, true, now(), now()
FROM (SELECT DISTINCT trim("pyqExam") AS code FROM "questions" WHERE "pyqExam" IS NOT NULL AND trim("pyqExam") <> '') v
WHERE NOT EXISTS (
  SELECT 1 FROM "pyq_exams" e
  WHERE e."legacyCode" = v.code OR lower(regexp_replace(v.code, '[^A-Za-z0-9]+', '', 'g')) = ANY(e."aliases")
)
ON CONFLICT ("slug") DO NOTHING;

-- Backfill one occurrence per legacy-tagged question. Published questions
-- were tagged by staff in the editor, so their tag counts as verified; the
-- rest stay UNVERIFIED until someone confirms them in the PYQ Library.
INSERT INTO "pyq_occurrences" ("id", "questionId", "examId", "year", "session", "questionNumber", "sourceLabel",
  "verificationStatus", "detectionMethod", "occurrenceKey", "createdAt", "updatedAt")
SELECT 'pyqocc_' || md5(q."id"), q."id", e."id", q."pyqYear", NULLIF(trim(q."pyqMonth"), ''), NULLIF(trim(q."pyqQuestionNumber"), ''), q."pyqSource",
  CASE WHEN q."isPublished" OR q."status" = 'PUBLISHED' THEN 'VERIFIED' ELSE 'UNVERIFIED' END,
  'LEGACY_BACKFILL',
  q."id" || '|' || e."id" || '|' || coalesce(q."pyqYear"::text, '') || '|' ||
    lower(regexp_replace(trim(coalesce(q."pyqMonth", '')), '\s+', ' ', 'g')) || '|' || '' || '|' || '' || '|' ||
    lower(regexp_replace(trim(coalesce(q."pyqQuestionNumber", '')), '\s+', ' ', 'g')),
  now(), now()
FROM "questions" q
JOIN LATERAL (
  SELECT e."id" FROM "pyq_exams" e
  WHERE e."legacyCode" = trim(q."pyqExam") OR lower(regexp_replace(trim(q."pyqExam"), '[^A-Za-z0-9]+', '', 'g')) = ANY(e."aliases")
  ORDER BY e."sortOrder" LIMIT 1
) e ON true
WHERE q."pyqExam" IS NOT NULL AND trim(q."pyqExam") <> ''
ON CONFLICT ("occurrenceKey") DO NOTHING;
