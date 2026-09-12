import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { resolveDoubtBookingCaller } from "@/lib/doubt-booking/access";
import { pusherServer, doubtBookingChannel } from "@/lib/realtime/pusher-server";

/**
 * Booking detail for the join/status screen — same generic 404 for "no
 * such booking" and "not yours" so a booking id can't be used to
 * enumerate other students' bookings.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const caller = await resolveDoubtBookingCaller(session.user.id, params.id);
    if (!caller.role) return apiError("Booking not found.", 404);

    return apiSuccess({
      id: caller.booking.id,
      status: caller.booking.status,
      slot: {
        startTime: caller.booking.slot.startTime,
        endTime: caller.booking.slot.endTime,
      },
      role: caller.role,
      counterpart:
        caller.role === "STUDENT"
          ? { name: caller.booking.teacher.user.name, photoUrl: caller.booking.teacher.user.photoUrl }
          : { name: caller.booking.student.user.name, photoUrl: caller.booking.student.user.photoUrl },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Cancel a booking — only the booked student, the assigned teacher, or an
 * authorized admin can cancel it (resolved from the session, never a
 * client-supplied role). The slot reopens for other students; a cancelled
 * booking can never be joined (see the join route's status check).
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const caller = await resolveDoubtBookingCaller(session.user.id, params.id);
    if (!caller.role) return apiError("Booking not found.", 404);
    if (caller.booking.status !== "CONFIRMED") {
      return apiError("This booking is already cancelled or completed.", 409);
    }

    let reason: string | undefined;
    try {
      const body = await request.json();
      if (typeof body?.reason === "string") reason = body.reason.slice(0, 300);
    } catch {
      // no body — fine, reason stays undefined
    }

    const newStatus = caller.role === "STUDENT" ? "CANCELLED_BY_STUDENT" : "CANCELLED_BY_TEACHER";

    await prisma.$transaction([
      prisma.doubtBooking.update({
        where: { id: caller.booking.id },
        data: { status: newStatus, cancelReason: reason },
      }),
      prisma.doubtSlot.update({
        where: { id: caller.booking.slotId },
        data: { status: "OPEN" },
      }),
    ]);

    try {
      await pusherServer.trigger(doubtBookingChannel(caller.booking.id), "doubt-booking-cancelled", {
        bookingId: caller.booking.id,
      });
    } catch (err) {
      console.error("[doubt-booking] cancel notify error:", err);
    }

    return apiSuccess({ cancelled: true });
  } catch (error) {
    return handleApiError(error);
  }
}
