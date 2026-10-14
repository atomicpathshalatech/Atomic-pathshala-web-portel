-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "bloomLevel" TEXT,
ADD COLUMN     "importance" TEXT,
ADD COLUMN     "keySkill" TEXT,
ADD COLUMN     "solveTime" TEXT;

-- CreateTable
CREATE TABLE "question_collections" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_collection_items" (
    "collectionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "addedById" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_collection_items_pkey" PRIMARY KEY ("collectionId","questionId")
);

-- CreateIndex
CREATE INDEX "question_collections_name_idx" ON "question_collections"("name");

-- CreateIndex
CREATE INDEX "question_collection_items_questionId_idx" ON "question_collection_items"("questionId");

-- AddForeignKey
ALTER TABLE "question_collection_items" ADD CONSTRAINT "question_collection_items_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "question_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_collection_items" ADD CONSTRAINT "question_collection_items_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

