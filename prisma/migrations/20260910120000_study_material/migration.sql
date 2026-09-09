-- Study Material: downloadable chapter resources (modules, short notes,
-- mind maps, formula sheets, highlighted NCERT, NCERT exemplar).

DO $$ BEGIN
  CREATE TYPE "StudyMaterialType" AS ENUM (
    'MODULE', 'SHORT_NOTES', 'MIND_MAP', 'FORMULA_SHEET', 'NCERT_HIGHLIGHTED', 'NCERT_EXEMPLAR'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "study_materials" (
  "id"            TEXT NOT NULL,
  "chapterId"     TEXT NOT NULL,
  "type"          "StudyMaterialType" NOT NULL,
  "title"         TEXT NOT NULL,
  "fileUrl"       TEXT NOT NULL,
  "fileName"      TEXT NOT NULL,
  "sizeBytes"     INTEGER NOT NULL DEFAULT 0,
  "mimeType"      TEXT NOT NULL DEFAULT 'application/pdf',
  "allowDownload" BOOLEAN NOT NULL DEFAULT true,
  "isPublished"   BOOLEAN NOT NULL DEFAULT true,
  "order"         INTEGER NOT NULL DEFAULT 0,
  "createdById"   TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "study_materials_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "study_materials_chapterId_idx" ON "study_materials" ("chapterId");
CREATE INDEX IF NOT EXISTS "study_materials_chapterId_type_idx" ON "study_materials" ("chapterId", "type");

DO $$ BEGIN
  ALTER TABLE "study_materials"
    ADD CONSTRAINT "study_materials_chapterId_fkey"
    FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
