-- Study Material module library: Class/Exam + Subject + NCERT/custom chapter
-- + Language + Module Type + PDF. Chapter path is driven by the NCERT
-- catalogue in code, so no FK to the DB `chapters` table.

DO $$ BEGIN
  CREATE TYPE "StudyMaterialType" AS ENUM (
    'MODULE', 'SHORT_NOTES', 'MIND_MAP', 'FORMULA_SHEET',
    'NCERT_HIGHLIGHTED', 'NCERT_EXEMPLAR', 'NEET_PYQ', 'JEE_PYQ'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- If an earlier form of this enum already exists, make sure the PYQ values are present.
ALTER TYPE "StudyMaterialType" ADD VALUE IF NOT EXISTS 'NEET_PYQ';
ALTER TYPE "StudyMaterialType" ADD VALUE IF NOT EXISTS 'JEE_PYQ';

DO $$ BEGIN
  CREATE TYPE "StudyMaterialClassExam" AS ENUM ('CLASS_11', 'CLASS_12', 'NEET', 'JEE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "StudyMaterialLanguage" AS ENUM ('HINDI', 'ENGLISH');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "study_materials" (
  "id"              TEXT NOT NULL,
  "classExam"       "StudyMaterialClassExam" NOT NULL,
  "subject"         TEXT NOT NULL,
  "ncertChapterId"  TEXT,
  "chapterTitle"    TEXT NOT NULL,
  "chapterClass"    INTEGER,
  "isCustomChapter" BOOLEAN NOT NULL DEFAULT false,
  "language"        "StudyMaterialLanguage" NOT NULL,
  "type"            "StudyMaterialType" NOT NULL,
  "title"           TEXT NOT NULL,
  "fileUrl"         TEXT NOT NULL,
  "fileName"        TEXT NOT NULL,
  "sizeBytes"       INTEGER NOT NULL DEFAULT 0,
  "mimeType"        TEXT NOT NULL DEFAULT 'application/pdf',
  "allowDownload"   BOOLEAN NOT NULL DEFAULT true,
  "isPublished"     BOOLEAN NOT NULL DEFAULT true,
  "order"           INTEGER NOT NULL DEFAULT 0,
  "createdById"     TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "study_materials_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "study_materials_classExam_subject_language_idx"
  ON "study_materials" ("classExam", "subject", "language");
CREATE INDEX IF NOT EXISTS "study_materials_classExam_subject_ncertChapterId_idx"
  ON "study_materials" ("classExam", "subject", "ncertChapterId");
CREATE INDEX IF NOT EXISTS "study_materials_classExam_language_type_idx"
  ON "study_materials" ("classExam", "language", "type");
