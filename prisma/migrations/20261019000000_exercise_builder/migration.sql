-- Exercise Builder: practice exercises built from the question bank (sections,
-- questions, PDF exports, student attempts). Additive only, and safe to run on a
-- database where these objects already exist (e.g. made by prisma db push).
-- CreateTable
CREATE TABLE IF NOT EXISTS "exercises" (
    "id" TEXT NOT NULL,
    "exerciseCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "subject" TEXT NOT NULL,
    "chapter" TEXT NOT NULL,
    "topic" TEXT,
    "subTopic" TEXT,
    "description" TEXT,
    "instructions" TEXT,
    "exerciseType" TEXT NOT NULL DEFAULT 'TOPIC_WISE',
    "organizationMode" TEXT NOT NULL DEFAULT 'TOPIC_WISE',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "languageMode" TEXT NOT NULL DEFAULT 'BILINGUAL',
    "layoutSettings" JSONB,
    "answerKeyMode" TEXT NOT NULL DEFAULT 'END_OF_DOCUMENT',
    "solutionMode" TEXT NOT NULL DEFAULT 'END_OF_DOCUMENT',
    "defaultMarks" DOUBLE PRECISION NOT NULL DEFAULT 4.0,
    "defaultNegativeMarks" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "testId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "exercise_sections" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "topic" TEXT,
    "subTopic" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "pageBreakBefore" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercise_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "exercise_questions" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "sectionId" TEXT,
    "questionId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "marks" DOUBLE PRECISION,
    "negativeMarks" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercise_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "exercise_exports" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "exportType" TEXT NOT NULL DEFAULT 'PDF',
    "language" TEXT NOT NULL DEFAULT 'BILINGUAL',
    "format" TEXT NOT NULL DEFAULT 'FULL_WITH_SOLUTIONS',
    "storageKey" TEXT,
    "downloadUrl" TEXT,
    "fileSize" INTEGER,
    "pageCount" INTEGER,
    "warnings" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercise_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "exercise_attempts" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'PRACTICE',
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalMarks" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "incorrectCount" INTEGER NOT NULL DEFAULT 0,
    "unattemptedCount" INTEGER NOT NULL DEFAULT 0,
    "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timeSpentSeconds" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "exercise_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "exercise_attempt_answers" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOption" TEXT,
    "numericalAnswer" DOUBLE PRECISION,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "marksAwarded" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timeSpentSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercise_attempt_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "exercises_exerciseCode_key" ON "exercises"("exerciseCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "exercises_subject_chapter_idx" ON "exercises"("subject", "chapter");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "exercises_status_idx" ON "exercises"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "exercises_createdById_idx" ON "exercises"("createdById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "exercise_sections_exerciseId_order_idx" ON "exercise_sections"("exerciseId", "order");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "exercise_questions_exerciseId_displayOrder_idx" ON "exercise_questions"("exerciseId", "displayOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "exercise_questions_sectionId_displayOrder_idx" ON "exercise_questions"("sectionId", "displayOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "exercise_questions_questionId_idx" ON "exercise_questions"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "exercise_questions_exerciseId_questionId_key" ON "exercise_questions"("exerciseId", "questionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "exercise_exports_exerciseId_idx" ON "exercise_exports"("exerciseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "exercise_attempts_exerciseId_userId_idx" ON "exercise_attempts"("exerciseId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "exercise_attempts_userId_status_idx" ON "exercise_attempts"("userId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "exercise_attempt_answers_attemptId_idx" ON "exercise_attempt_answers"("attemptId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "exercise_attempt_answers_questionId_idx" ON "exercise_attempt_answers"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "exercise_attempt_answers_attemptId_questionId_key" ON "exercise_attempt_answers"("attemptId", "questionId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "exercises" ADD CONSTRAINT "exercises_testId_fkey" FOREIGN KEY ("testId") REFERENCES "tests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "exercises" ADD CONSTRAINT "exercises_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "exercise_sections" ADD CONSTRAINT "exercise_sections_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "exercise_questions" ADD CONSTRAINT "exercise_questions_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "exercise_questions" ADD CONSTRAINT "exercise_questions_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "exercise_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "exercise_questions" ADD CONSTRAINT "exercise_questions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "exercise_exports" ADD CONSTRAINT "exercise_exports_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "exercise_attempt_answers" ADD CONSTRAINT "exercise_attempt_answers_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "exercise_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "exercise_attempt_answers" ADD CONSTRAINT "exercise_attempt_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

