-- Whiteboard Test Lab: an always-open practice classroom for Admin/Teacher
-- that reuses the real live-class engine but is not a scheduled class.

ALTER TABLE "batch_schedules" ADD COLUMN IF NOT EXISTS "isTest" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "whiteboard_sessions" ADD COLUMN IF NOT EXISTS "isTest" BOOLEAN NOT NULL DEFAULT false;

-- Fast lookup for "exclude test rows from student feeds / analytics".
CREATE INDEX IF NOT EXISTS "batch_schedules_isTest_idx" ON "batch_schedules" ("isTest");
