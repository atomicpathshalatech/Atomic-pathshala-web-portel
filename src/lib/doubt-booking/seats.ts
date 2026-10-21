import "server-only";
import { prisma } from "@/lib/db";

/** Students per slot a teacher may publish. 1 = the original 1:1 session. */
export const MAX_DOUBT_SLOT_CAPACITY = 20;

/**
 * Takes one seat in an OPEN slot. One conditional UPDATE: Postgres
 * serializes concurrent UPDATEs to the same row, so when two students race
 * for the last seat exactly one sees a row back — the other gets false and a
 * clean 409, never an over-filled slot. The slot flips to BOOKED when the
 * seat taken was the last one.
 */
export async function claimDoubtSlotSeat(slotId: string): Promise<boolean> {
  const rows = await prisma.$executeRaw`
    UPDATE "doubt_slots"
    SET "bookedCount" = "bookedCount" + 1,
        "status" = (CASE WHEN "bookedCount" + 1 >= "capacity" THEN 'BOOKED' ELSE 'OPEN' END)::"DoubtSlotStatus",
        "updatedAt" = NOW()
    WHERE "id" = ${slotId} AND "status" = 'OPEN' AND "bookedCount" < "capacity"`;
  return rows > 0;
}

/**
 * Gives a seat back when a booking is cancelled. A cancelled slot stays
 * cancelled; otherwise it is OPEN again because at least one seat is free.
 */
export async function releaseDoubtSlotSeat(slotId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "doubt_slots"
    SET "bookedCount" = GREATEST("bookedCount" - 1, 0),
        "status" = (CASE WHEN "status" = 'CANCELLED' THEN 'CANCELLED' ELSE 'OPEN' END)::"DoubtSlotStatus",
        "updatedAt" = NOW()
    WHERE "id" = ${slotId}`;
}
