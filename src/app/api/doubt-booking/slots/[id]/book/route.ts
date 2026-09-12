import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { hasAnyBatchAccess } from "@/lib/batch/entitlement";
import { pusherServer, doubtBookingChannel } from "@/lib/realtime/pusher-server";

/**
 * Student books an OPEN slot. Race-safe: two students hitting this at the
 * same instant for the same slot must not both succeed. The claim is a
 * conditional updateMany (status must still be OPEN) — Postgres serializes
 * concurrent UPDATEs to the same row, so only one caller ever sees count:1;
 * the loser sees count:0 and gets a clean 409, never a duplicate booking.
 * Mirrors the exact reclaim pattern already used by email dispatch
 * idempotency (src/lib/email/dispatch.ts's reclaimFailedLog) and by
 * activateBatchOrder (src/server/services/batch-order-service.ts) for the
 * same "only the first claimant wins" problem.
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
    if (!student) throw new ForbiddenError("Only students can book a doubt session.");

    const entitled = await hasAnyBatchAccess(session.user.id);
    if (!entitled) {
      throw new ForbiddenError("An active batch enrollment or subscription is required to book a doubt session.");
    }

    const slot = await prisma.doubtSlot.findUnique({ where: { id: params.id } });
    if (!slot) return apiError("Slot not found.", 404);
    if (slot.startTime <= new Date()) return apiError("This slot has already passed.", 409);

    const claim = await prisma.doubtSlot.updateMany({
      where: { id: slot.id, status: "OPEN" },
      data: { status: "BOOKED" },
    });
    if (claim.count === 0) {
      return apiError("This slot was just booked by someone else. Please pick another.", 409);
    }

    const booking = await prisma.doubtBooking.create({
      data: { slotId: slot.id, studentId: student.id, teacherId: slot.teacherId, status: "CONFIRMED" },
    });

    try {
      await pusherServer.trigger(doubtBookingChannel(booking.id), "doubt-booking-confirmed", {
        bookingId: booking.id,
      });
    } catch (err) {
      console.error("[doubt-booking] confirm notify error:", err);
    }

    return apiSuccess({ booking }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
