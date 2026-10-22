-- Practice re-attempts of a test / DPP / chapter test (the first attempt stays in "attempts").
CREATE TABLE IF NOT EXISTS "test_reattempts" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "answers" JSONB NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION,
    CONSTRAINT "test_reattempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "test_reattempts_studentId_idx" ON "test_reattempts"("studentId");
CREATE UNIQUE INDEX IF NOT EXISTS "test_reattempts_testId_studentId_attemptNumber_key" ON "test_reattempts"("testId", "studentId", "attemptNumber");

DO $$ BEGIN
  ALTER TABLE "test_reattempts" ADD CONSTRAINT "test_reattempts_testId_fkey" FOREIGN KEY ("testId") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "test_reattempts" ADD CONSTRAINT "test_reattempts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
