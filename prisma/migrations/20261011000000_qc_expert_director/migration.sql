-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "qcHash" TEXT,
ADD COLUMN     "qcReviewedAt" TIMESTAMP(3),
ADD COLUMN     "qcStatus" TEXT DEFAULT 'UNREVIEWED';

-- CreateTable
CREATE TABLE "qc_reviews" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'gemini',
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "storedAnswer" TEXT,
    "derivedAnswer" TEXT,
    "answerMatches" BOOLEAN,
    "result" JSONB NOT NULL,
    "calcChecks" JSONB,
    "references" JSONB,
    "modelConfidence" DOUBLE PRECISION,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "expertReviewId" TEXT,
    "runById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qc_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qc_findings" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" TEXT,
    "proposedCorrection" JSONB,
    "directorDecision" TEXT,
    "directorReason" TEXT,
    "finalAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qc_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qc_corrections" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "findingId" TEXT,
    "contentHash" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "language" TEXT,
    "originalValue" TEXT,
    "proposedValue" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "appliedVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qc_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_logs" (
    "id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "questionId" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "durationMs" INTEGER,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "qc_reviews_questionId_agent_idx" ON "qc_reviews"("questionId", "agent");

-- CreateIndex
CREATE INDEX "qc_reviews_contentHash_idx" ON "qc_reviews"("contentHash");

-- CreateIndex
CREATE INDEX "qc_reviews_status_idx" ON "qc_reviews"("status");

-- CreateIndex
CREATE INDEX "qc_findings_questionId_idx" ON "qc_findings"("questionId");

-- CreateIndex
CREATE INDEX "qc_findings_reviewId_idx" ON "qc_findings"("reviewId");

-- CreateIndex
CREATE INDEX "qc_findings_category_idx" ON "qc_findings"("category");

-- CreateIndex
CREATE INDEX "qc_corrections_questionId_idx" ON "qc_corrections"("questionId");

-- CreateIndex
CREATE INDEX "qc_corrections_status_idx" ON "qc_corrections"("status");

-- CreateIndex
CREATE INDEX "ai_usage_logs_feature_createdAt_idx" ON "ai_usage_logs"("feature", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_logs_questionId_idx" ON "ai_usage_logs"("questionId");

-- CreateIndex
CREATE INDEX "questions_qcStatus_idx" ON "questions"("qcStatus");

-- AddForeignKey
ALTER TABLE "qc_reviews" ADD CONSTRAINT "qc_reviews_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_findings" ADD CONSTRAINT "qc_findings_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "qc_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_findings" ADD CONSTRAINT "qc_findings_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_corrections" ADD CONSTRAINT "qc_corrections_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_corrections" ADD CONSTRAINT "qc_corrections_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "qc_findings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

