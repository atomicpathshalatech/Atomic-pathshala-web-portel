-- CreateEnum
CREATE TYPE "LiveClassPhase" AS ENUM ('SCHEDULED', 'PREPARING', 'WAITING_FOR_STREAM', 'LIVE', 'ENDING', 'ENDED', 'PROCESSING_RECORDING', 'RECORDED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "VideoTransport" AS ENUM ('LIVEKIT', 'YOUTUBE', 'BOTH');

-- CreateEnum
CREATE TYPE "PollSessionStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- AlterEnum
ALTER TYPE "DoubtStatus" ADD VALUE 'ASSIGNED';

-- AlterTable: WhiteboardSession — state machine + video transport + YouTube linkage
ALTER TABLE "whiteboard_sessions"
  ADD COLUMN "livePhase" "LiveClassPhase" NOT NULL DEFAULT 'SCHEDULED',
  ADD COLUMN "videoTransport" "VideoTransport" NOT NULL DEFAULT 'LIVEKIT',
  ADD COLUMN "youtubeBroadcastId" TEXT,
  ADD COLUMN "youtubeStreamId" TEXT,
  ADD COLUMN "youtubeVideoId" TEXT,
  ADD COLUMN "youtubeLiveChatId" TEXT,
  ADD COLUMN "youtubeStatus" TEXT,
  ADD COLUMN "recordingVideoId" TEXT,
  ADD COLUMN "peakViewers" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "whiteboard_sessions_livePhase_idx" ON "whiteboard_sessions"("livePhase");

-- AlterTable: WhiteboardMessage — moderation/structure fields
ALTER TABLE "whiteboard_messages"
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "pinnedAt" TIMESTAMP(3),
  ADD COLUMN "isSystemMessage" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isAnnouncement" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "flaggedAsQuestion" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "parentMessageId" TEXT;

-- CreateIndex
CREATE INDEX "whiteboard_messages_whiteboardSessionId_pinnedAt_idx" ON "whiteboard_messages"("whiteboardSessionId", "pinnedAt");

-- AddForeignKey (self-relation: replies)
ALTER TABLE "whiteboard_messages" ADD CONSTRAINT "whiteboard_messages_parentMessageId_fkey" FOREIGN KEY ("parentMessageId") REFERENCES "whiteboard_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "chat_reactions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chat_reactions_messageId_userId_emoji_key" ON "chat_reactions"("messageId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "chat_reactions_messageId_idx" ON "chat_reactions"("messageId");

-- AddForeignKey
ALTER TABLE "chat_reactions" ADD CONSTRAINT "chat_reactions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "whiteboard_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "live_class_attendances" (
    "id" TEXT NOT NULL,
    "whiteboardSessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "reconnectCount" INTEGER NOT NULL DEFAULT 0,
    "activeDurationSec" INTEGER NOT NULL DEFAULT 0,
    "interactionCount" INTEGER NOT NULL DEFAULT 0,
    "quizParticipated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "live_class_attendances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "live_class_attendances_whiteboardSessionId_studentId_key" ON "live_class_attendances"("whiteboardSessionId", "studentId");

-- CreateIndex
CREATE INDEX "live_class_attendances_whiteboardSessionId_idx" ON "live_class_attendances"("whiteboardSessionId");

-- AddForeignKey
ALTER TABLE "live_class_attendances" ADD CONSTRAINT "live_class_attendances_whiteboardSessionId_fkey" FOREIGN KEY ("whiteboardSessionId") REFERENCES "whiteboard_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_class_attendances" ADD CONSTRAINT "live_class_attendances_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "poll_sessions" (
    "id" TEXT NOT NULL,
    "whiteboardSessionId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "anonymous" BOOLEAN NOT NULL DEFAULT true,
    "status" "PollSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "poll_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "poll_sessions_whiteboardSessionId_idx" ON "poll_sessions"("whiteboardSessionId");

-- CreateIndex
CREATE INDEX "poll_sessions_status_idx" ON "poll_sessions"("status");

-- AddForeignKey
ALTER TABLE "poll_sessions" ADD CONSTRAINT "poll_sessions_whiteboardSessionId_fkey" FOREIGN KEY ("whiteboardSessionId") REFERENCES "whiteboard_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "poll_responses" (
    "id" TEXT NOT NULL,
    "pollSessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "selectedOption" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "poll_responses_pollSessionId_studentId_key" ON "poll_responses"("pollSessionId", "studentId");

-- CreateIndex
CREATE INDEX "poll_responses_pollSessionId_idx" ON "poll_responses"("pollSessionId");

-- AddForeignKey
ALTER TABLE "poll_responses" ADD CONSTRAINT "poll_responses_pollSessionId_fkey" FOREIGN KEY ("pollSessionId") REFERENCES "poll_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_responses" ADD CONSTRAINT "poll_responses_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Doubt — optional live-class scoping
ALTER TABLE "doubts"
  ADD COLUMN "whiteboardSessionId" TEXT,
  ADD COLUMN "sourceMessageId" TEXT;

-- CreateIndex
CREATE INDEX "doubts_whiteboardSessionId_idx" ON "doubts"("whiteboardSessionId");

-- AddForeignKey
ALTER TABLE "doubts" ADD CONSTRAINT "doubts_whiteboardSessionId_fkey" FOREIGN KEY ("whiteboardSessionId") REFERENCES "whiteboard_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubts" ADD CONSTRAINT "doubts_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES "whiteboard_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
