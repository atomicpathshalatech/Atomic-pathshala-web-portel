-- CreateEnum
CREATE TYPE "YoutubeChannelKey" AS ENUM ('APP', 'MAIN');

-- CreateEnum
CREATE TYPE "DeliveryMode" AS ENUM ('APP_YOUTUBE', 'MAIN_YOUTUBE', 'EXTERNAL_YOUTUBE', 'LEGACY_LIVEKIT');

-- CreateEnum
CREATE TYPE "LiveSessionState" AS ENUM ('SCHEDULED', 'READY', 'STARTING', 'YOUTUBE_CONNECTING', 'YOUTUBE_ACTIVE', 'LIVE', 'ENDING', 'RECORDING_PROCESSING', 'RECORDING_READY', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "IngestStreamStatus" AS ENUM ('AVAILABLE', 'LEASED', 'DISABLED', 'RETIRED');

-- CreateEnum
CREATE TYPE "StreamLeaseState" AS ENUM ('RESERVED', 'BOUND', 'ACTIVE', 'RELEASING', 'RELEASED', 'FAILED');

-- AlterTable
ALTER TABLE "whiteboard_pages" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "youtube_ingest_streams" (
    "id" TEXT NOT NULL,
    "channel" "YoutubeChannelKey" NOT NULL,
    "youtubeStreamId" TEXT NOT NULL,
    "ingestAddress" TEXT NOT NULL,
    "streamNameEnc" TEXT NOT NULL,
    "keyRotatedAt" TIMESTAMP(3),
    "status" "IngestStreamStatus" NOT NULL DEFAULT 'AVAILABLE',
    "lastReleasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "youtube_ingest_streams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_sessions" (
    "id" TEXT NOT NULL,
    "batchScheduleId" TEXT NOT NULL,
    "occurrence" INTEGER NOT NULL DEFAULT 1,
    "whiteboardSessionId" TEXT,
    "deliveryMode" "DeliveryMode" NOT NULL,
    "state" "LiveSessionState" NOT NULL DEFAULT 'SCHEDULED',
    "stateChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failureReason" TEXT,
    "controllingTeacherId" TEXT NOT NULL,
    "plannedStartsAt" TIMESTAMP(3) NOT NULL,
    "effectiveEndsAt" TIMESTAMP(3) NOT NULL,
    "totalExtendedMinutes" INTEGER NOT NULL DEFAULT 0,
    "actualStartedAt" TIMESTAMP(3),
    "actualEndedAt" TIMESTAMP(3),
    "youtubeChannel" "YoutubeChannelKey",
    "youtubeBroadcastId" TEXT,
    "youtubeVideoId" TEXT,
    "youtubeLifecycle" TEXT,
    "recordingVideoId" TEXT,
    "recordingCheckedAt" TIMESTAMP(3),
    "simulcastGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "live_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stream_leases" (
    "id" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "liveSessionId" TEXT NOT NULL,
    "state" "StreamLeaseState" NOT NULL DEFAULT 'RESERVED',
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stream_leases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encoder_sessions" (
    "id" TEXT NOT NULL,
    "liveSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialsExpireAt" TIMESTAMP(3) NOT NULL,
    "credentialsUsedAt" TIMESTAMP(3),
    "lastHeartbeatAt" TIMESTAMP(3),
    "stoppedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "encoder_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcast_stage_sessions" (
    "id" TEXT NOT NULL,
    "liveSessionId" TEXT NOT NULL,
    "batchScheduleId" TEXT NOT NULL,
    "issuedToUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broadcast_stage_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulcast_groups" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulcast_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "youtube_ingest_streams_youtubeStreamId_key" ON "youtube_ingest_streams"("youtubeStreamId");

-- CreateIndex
CREATE INDEX "youtube_ingest_streams_channel_status_idx" ON "youtube_ingest_streams"("channel", "status");

-- CreateIndex
CREATE UNIQUE INDEX "live_sessions_whiteboardSessionId_key" ON "live_sessions"("whiteboardSessionId");

-- CreateIndex
CREATE INDEX "live_sessions_state_effectiveEndsAt_idx" ON "live_sessions"("state", "effectiveEndsAt");

-- CreateIndex
CREATE INDEX "live_sessions_controllingTeacherId_idx" ON "live_sessions"("controllingTeacherId");

-- CreateIndex
CREATE INDEX "live_sessions_simulcastGroupId_idx" ON "live_sessions"("simulcastGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "live_sessions_batchScheduleId_occurrence_key" ON "live_sessions"("batchScheduleId", "occurrence");

-- CreateIndex
CREATE UNIQUE INDEX "live_sessions_youtubeChannel_youtubeBroadcastId_key" ON "live_sessions"("youtubeChannel", "youtubeBroadcastId");

-- CreateIndex
CREATE INDEX "stream_leases_streamId_state_idx" ON "stream_leases"("streamId", "state");

-- CreateIndex
CREATE INDEX "stream_leases_liveSessionId_idx" ON "stream_leases"("liveSessionId");

-- CreateIndex
CREATE INDEX "stream_leases_state_expiresAt_idx" ON "stream_leases"("state", "expiresAt");

-- CreateIndex
CREATE INDEX "encoder_sessions_liveSessionId_idx" ON "encoder_sessions"("liveSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "broadcast_stage_sessions_tokenHash_key" ON "broadcast_stage_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "broadcast_stage_sessions_liveSessionId_idx" ON "broadcast_stage_sessions"("liveSessionId");

-- AddForeignKey
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_batchScheduleId_fkey" FOREIGN KEY ("batchScheduleId") REFERENCES "batch_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_whiteboardSessionId_fkey" FOREIGN KEY ("whiteboardSessionId") REFERENCES "whiteboard_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_controllingTeacherId_fkey" FOREIGN KEY ("controllingTeacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_simulcastGroupId_fkey" FOREIGN KEY ("simulcastGroupId") REFERENCES "simulcast_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stream_leases" ADD CONSTRAINT "stream_leases_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "youtube_ingest_streams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stream_leases" ADD CONSTRAINT "stream_leases_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "live_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encoder_sessions" ADD CONSTRAINT "encoder_sessions_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "live_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_stage_sessions" ADD CONSTRAINT "broadcast_stage_sessions_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "live_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Invariants Prisma can't express (live-class redesign, step 2)
-- ---------------------------------------------------------------------------

-- A stream never carries two classes: at most one non-terminal lease per stream.
CREATE UNIQUE INDEX "stream_leases_one_active_per_stream"
  ON "stream_leases"("streamId")
  WHERE "state" IN ('RESERVED', 'BOUND', 'ACTIVE', 'RELEASING');

-- A class never holds two streams: at most one non-terminal lease per live session.
CREATE UNIQUE INDEX "stream_leases_one_active_per_session"
  ON "stream_leases"("liveSessionId")
  WHERE "state" IN ('RESERVED', 'BOUND', 'ACTIVE', 'RELEASING');

-- At most one not-yet-ended occurrence per schedule. Once an occurrence has
-- ended (recording processing onward) or was cancelled/failed, a new
-- occurrence may start.
CREATE UNIQUE INDEX "live_sessions_one_open_per_schedule"
  ON "live_sessions"("batchScheduleId")
  WHERE "state" IN ('SCHEDULED', 'READY', 'STARTING', 'YOUTUBE_CONNECTING', 'YOUTUBE_ACTIVE', 'LIVE', 'ENDING');

-- The two channels never mix: APP_YOUTUBE lives on APP, MAIN_YOUTUBE on MAIN,
-- and the channel-less modes carry no channel.
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_delivery_channel_match" CHECK (
  ("deliveryMode" = 'APP_YOUTUBE' AND "youtubeChannel" = 'APP') OR
  ("deliveryMode" = 'MAIN_YOUTUBE' AND "youtubeChannel" = 'MAIN') OR
  ("deliveryMode" IN ('EXTERNAL_YOUTUBE', 'LEGACY_LIVEKIT') AND "youtubeChannel" IS NULL)
);

-- Ingest streams are only ever created on the APP channel.
ALTER TABLE "youtube_ingest_streams" ADD CONSTRAINT "youtube_ingest_streams_app_only" CHECK ("channel" = 'APP');

ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_occurrence_positive" CHECK ("occurrence" >= 1);
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_end_after_start" CHECK ("effectiveEndsAt" > "plannedStartsAt");
