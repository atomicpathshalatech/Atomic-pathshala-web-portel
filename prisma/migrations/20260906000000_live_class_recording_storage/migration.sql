-- Adds the two columns needed to locate a finished recording once LiveKit
-- Egress uploads it to R2. recordingEgressId / recordingStatus already exist
-- on whiteboard_sessions (added in 20260905170345_live_class_and_platform_schema_sync)
-- but nothing tracked WHERE the finished file ended up or how long it is -
-- both only become known when the egress webhook fires on completion, so
-- they're separate nullable columns rather than reusing recordingVideoId
-- (which is the YouTube-VOD-id slot, a different provider/shape entirely).

ALTER TABLE "whiteboard_sessions" ADD COLUMN IF NOT EXISTS "recordingStorageKey" TEXT;
ALTER TABLE "whiteboard_sessions" ADD COLUMN IF NOT EXISTS "recordingDurationSeconds" INTEGER;
