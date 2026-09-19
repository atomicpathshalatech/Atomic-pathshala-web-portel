-- CreateEnum
CREATE TYPE "ClassroomPhase" AS ENUM ('SCHEDULED', 'PREPARING', 'LIVE', 'ENDED', 'PROCESSING_RECORDING', 'RECORDED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "ClassroomHandRaiseStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClassroomStreamMethod" AS ENUM ('BROWSER_RELAY', 'EXTERNAL_ENCODER');

-- AlterTable
ALTER TABLE "doubts" ADD COLUMN     "classroomSessionId" TEXT,
ADD COLUMN     "sourceClassroomMessageId" TEXT;

-- CreateTable
CREATE TABLE "classroom_sessions" (
    "id" TEXT NOT NULL,
    "batchScheduleId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "phase" "ClassroomPhase" NOT NULL DEFAULT 'SCHEDULED',
    "chatEnabled" BOOLEAN NOT NULL DEFAULT true,
    "handRaiseEnabled" BOOLEAN NOT NULL DEFAULT true,
    "streamMethod" "ClassroomStreamMethod",
    "relayPath" TEXT,
    "relayWhipUrl" TEXT,
    "youtubeBroadcastId" TEXT,
    "youtubeStreamId" TEXT,
    "youtubeVideoId" TEXT,
    "youtubeLiveChatId" TEXT,
    "youtubeStatus" TEXT,
    "youtubeIngestUrl" TEXT,
    "youtubeStreamKey" TEXT,
    "recordingVideoId" TEXT,
    "recordingStatus" TEXT DEFAULT 'NOT_AVAILABLE',
    "peakViewers" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classroom_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classroom_messages" (
    "id" TEXT NOT NULL,
    "classroomSessionId" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "pinnedAt" TIMESTAMP(3),
    "flaggedAsQuestion" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "classroom_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classroom_hand_raises" (
    "id" TEXT NOT NULL,
    "classroomSessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "ClassroomHandRaiseStatus" NOT NULL DEFAULT 'PENDING',
    "requestType" TEXT NOT NULL DEFAULT 'CHAT',
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "imageUrl" TEXT,

    CONSTRAINT "classroom_hand_raises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classroom_attendances" (
    "id" TEXT NOT NULL,
    "classroomSessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "reconnectCount" INTEGER NOT NULL DEFAULT 0,
    "activeDurationSec" INTEGER NOT NULL DEFAULT 0,
    "interactionCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "classroom_attendances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "classroom_sessions_batchScheduleId_key" ON "classroom_sessions"("batchScheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "classroom_sessions_relayPath_key" ON "classroom_sessions"("relayPath");

-- CreateIndex
CREATE INDEX "classroom_sessions_teacherId_idx" ON "classroom_sessions"("teacherId");

-- CreateIndex
CREATE INDEX "classroom_messages_classroomSessionId_createdAt_idx" ON "classroom_messages"("classroomSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "classroom_hand_raises_classroomSessionId_status_idx" ON "classroom_hand_raises"("classroomSessionId", "status");

-- CreateIndex
CREATE INDEX "classroom_attendances_classroomSessionId_idx" ON "classroom_attendances"("classroomSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "classroom_attendances_classroomSessionId_studentId_key" ON "classroom_attendances"("classroomSessionId", "studentId");

-- CreateIndex
CREATE INDEX "doubts_classroomSessionId_idx" ON "doubts"("classroomSessionId");

-- AddForeignKey
ALTER TABLE "classroom_sessions" ADD CONSTRAINT "classroom_sessions_batchScheduleId_fkey" FOREIGN KEY ("batchScheduleId") REFERENCES "batch_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classroom_sessions" ADD CONSTRAINT "classroom_sessions_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classroom_messages" ADD CONSTRAINT "classroom_messages_classroomSessionId_fkey" FOREIGN KEY ("classroomSessionId") REFERENCES "classroom_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classroom_hand_raises" ADD CONSTRAINT "classroom_hand_raises_classroomSessionId_fkey" FOREIGN KEY ("classroomSessionId") REFERENCES "classroom_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classroom_hand_raises" ADD CONSTRAINT "classroom_hand_raises_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classroom_attendances" ADD CONSTRAINT "classroom_attendances_classroomSessionId_fkey" FOREIGN KEY ("classroomSessionId") REFERENCES "classroom_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classroom_attendances" ADD CONSTRAINT "classroom_attendances_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubts" ADD CONSTRAINT "doubts_classroomSessionId_fkey" FOREIGN KEY ("classroomSessionId") REFERENCES "classroom_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubts" ADD CONSTRAINT "doubts_sourceClassroomMessageId_fkey" FOREIGN KEY ("sourceClassroomMessageId") REFERENCES "classroom_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

