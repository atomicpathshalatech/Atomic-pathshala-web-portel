-- Group doubt sessions: a slot can hold more than one booking.
ALTER TABLE "doubt_slots" ADD COLUMN IF NOT EXISTS "capacity" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "doubt_slots" ADD COLUMN IF NOT EXISTS "bookedCount" INTEGER NOT NULL DEFAULT 0;

-- Existing slots: count their active bookings (at most one each today).
UPDATE "doubt_slots" s
SET "bookedCount" = sub.n
FROM (
  SELECT "slotId", COUNT(*)::int AS n
  FROM "doubt_bookings"
  WHERE "status" IN ('CONFIRMED', 'COMPLETED', 'NO_SHOW')
  GROUP BY "slotId"
) sub
WHERE sub."slotId" = s."id";

-- One slot, many bookings.
DROP INDEX IF EXISTS "doubt_bookings_slotId_key";
CREATE INDEX IF NOT EXISTS "doubt_bookings_slotId_idx" ON "doubt_bookings"("slotId");
