-- CreateEnum
CREATE TYPE "WhiteboardSessionStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "QuizSessionStatus" AS ENUM ('ACTIVE', 'REVEALED', 'CLOSED');

-- CreateEnum
CREATE TYPE "HandRaiseStatus" AS ENUM ('PENDING', 'RESOLVED');

-- CreateTable
CREATE TABLE "whiteboard_sessions" (
    "id" TEXT NOT NULL,
    "batchScheduleId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "WhiteboardSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "activePageNumber" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whiteboard_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whiteboard_pages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "background" TEXT NOT NULL DEFAULT 'blank',
    "objects" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whiteboard_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_sessions" (
    "id" TEXT NOT NULL,
    "whiteboardSessionId" TEXT NOT NULL,
    "questionText" TEXT,
    "isQuickQuiz" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB NOT NULL,
    "correctOption" TEXT,
    "timeLimitSec" INTEGER NOT NULL DEFAULT 30,
    "status" "QuizSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revealedAt" TIMESTAMP(3),

    CONSTRAINT "quiz_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_responses" (
    "id" TEXT NOT NULL,
    "quizSessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "selectedOption" TEXT NOT NULL,
    "responseTimeMs" INTEGER NOT NULL,
    "isCorrect" BOOLEAN,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hand_raise_events" (
    "id" TEXT NOT NULL,
    "whiteboardSessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "HandRaiseStatus" NOT NULL DEFAULT 'PENDING',
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "hand_raise_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whiteboard_sessions_batchScheduleId_key" ON "whiteboard_sessions"("batchScheduleId");

-- CreateIndex
CREATE INDEX "whiteboard_sessions_teacherId_idx" ON "whiteboard_sessions"("teacherId");

-- CreateIndex
CREATE INDEX "whiteboard_sessions_status_idx" ON "whiteboard_sessions"("status");

-- CreateIndex
CREATE INDEX "whiteboard_pages_sessionId_idx" ON "whiteboard_pages"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "whiteboard_pages_sessionId_pageNumber_key" ON "whiteboard_pages"("sessionId", "pageNumber");

-- CreateIndex
CREATE INDEX "quiz_sessions_whiteboardSessionId_idx" ON "quiz_sessions"("whiteboardSessionId");

-- CreateIndex
CREATE INDEX "quiz_sessions_status_idx" ON "quiz_sessions"("status");

-- CreateIndex
CREATE INDEX "quiz_responses_quizSessionId_idx" ON "quiz_responses"("quizSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_responses_quizSessionId_studentId_key" ON "quiz_responses"("quizSessionId", "studentId");

-- CreateIndex
CREATE INDEX "hand_raise_events_whiteboardSessionId_status_idx" ON "hand_raise_events"("whiteboardSessionId", "status");

-- AddForeignKey
ALTER TABLE "whiteboard_sessions" ADD CONSTRAINT "whiteboard_sessions_batchScheduleId_fkey" FOREIGN KEY ("batchScheduleId") REFERENCES "batch_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whiteboard_sessions" ADD CONSTRAINT "whiteboard_sessions_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whiteboard_pages" ADD CONSTRAINT "whiteboard_pages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "whiteboard_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_sessions" ADD CONSTRAINT "quiz_sessions_whiteboardSessionId_fkey" FOREIGN KEY ("whiteboardSessionId") REFERENCES "whiteboard_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_responses" ADD CONSTRAINT "quiz_responses_quizSessionId_fkey" FOREIGN KEY ("quizSessionId") REFERENCES "quiz_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_responses" ADD CONSTRAINT "quiz_responses_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hand_raise_events" ADD CONSTRAINT "hand_raise_events_whiteboardSessionId_fkey" FOREIGN KEY ("whiteboardSessionId") REFERENCES "whiteboard_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hand_raise_events" ADD CONSTRAINT "hand_raise_events_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
