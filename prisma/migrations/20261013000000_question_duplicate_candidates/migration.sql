-- CreateTable
CREATE TABLE "question_duplicate_candidates" (
    "id" TEXT NOT NULL,
    "questionAId" TEXT NOT NULL,
    "questionBId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "sameAnswer" BOOLEAN,
    "note" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_duplicate_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "question_duplicate_candidates_status_category_idx" ON "question_duplicate_candidates"("status", "category");

-- CreateIndex
CREATE INDEX "question_duplicate_candidates_questionBId_idx" ON "question_duplicate_candidates"("questionBId");

-- CreateIndex
CREATE UNIQUE INDEX "question_duplicate_candidates_questionAId_questionBId_key" ON "question_duplicate_candidates"("questionAId", "questionBId");

-- AddForeignKey
ALTER TABLE "question_duplicate_candidates" ADD CONSTRAINT "question_duplicate_candidates_questionAId_fkey" FOREIGN KEY ("questionAId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_duplicate_candidates" ADD CONSTRAINT "question_duplicate_candidates_questionBId_fkey" FOREIGN KEY ("questionBId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

