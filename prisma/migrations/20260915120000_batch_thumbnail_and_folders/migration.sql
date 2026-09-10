-- Batch cover image (16:9), shown on batch cards.
ALTER TABLE "batches" ADD COLUMN "thumbnailUrl" TEXT;

-- Per-batch material tree: "Syllabus & Schedule" and anything nested under it.
CREATE TABLE "batch_folders" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batch_folders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "batch_folder_files" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "fileAssetId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_folder_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "batch_folders_batchId_idx" ON "batch_folders"("batchId");
CREATE INDEX "batch_folders_parentId_idx" ON "batch_folders"("parentId");
CREATE INDEX "batch_folder_files_folderId_idx" ON "batch_folder_files"("folderId");

-- Deleting a batch takes its folders; deleting a folder takes its subfolders
-- and files. There is no FK to file_assets on purpose — FileAsset carries no
-- back relations anywhere in this schema (StudyMaterial stores its upload the
-- same way), so the asset outlives the listing and is cleaned up separately.
ALTER TABLE "batch_folders" ADD CONSTRAINT "batch_folders_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "batch_folders" ADD CONSTRAINT "batch_folders_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "batch_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "batch_folder_files" ADD CONSTRAINT "batch_folder_files_folderId_fkey"
    FOREIGN KEY ("folderId") REFERENCES "batch_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
