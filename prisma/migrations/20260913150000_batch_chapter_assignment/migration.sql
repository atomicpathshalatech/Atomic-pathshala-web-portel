-- Hand-trimmed from a full `prisma migrate diff` (which also picked up
-- large unrelated pending drift elsewhere in the schema - a StudyMaterial
-- refactor, study_plans/coach_conversations tables, a users.roleId FK
-- drop+recreate - none of that is part of this change and is deliberately
-- NOT included here, matching this project's established migration
-- convention). This migration only adds the batch_chapters table, the
-- explicit chapter->batch assignment junction that fixes the cross-batch
-- content leakage bug (a Chapter previously had no batch scoping at all).

CREATE TABLE "batch_chapters" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_chapters_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "batch_chapters_batchId_idx" ON "batch_chapters"("batchId");

CREATE INDEX "batch_chapters_chapterId_idx" ON "batch_chapters"("chapterId");

CREATE UNIQUE INDEX "batch_chapters_batchId_chapterId_key" ON "batch_chapters"("batchId", "chapterId");

ALTER TABLE "batch_chapters" ADD CONSTRAINT "batch_chapters_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "batch_chapters" ADD CONSTRAINT "batch_chapters_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
