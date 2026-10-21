import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { resolveDoubtBookingCaller } from "@/lib/doubt-booking/access";
import { releaseDoubtSlotSeat } from "@/lib/doubt-booking/seats";
import { pusherServer, doubtBookingChannel } from "@/lib/realtime/pusher-server";

type GroupDoubt = {
  bookingId: string;
  studentName: string;
  photoUrl: string | null;
  topic: string | null;
  description: string | null;
  attachmentUrls: string[];
};

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

    // Group slot: the teacher (or admin) sees every booked student's doubt;
    // a student only learns how many are joining, not the others' questions.
    const slot = caller.booking.slot;
    let group: { capacity: number; bookedCount: number; doubts?: GroupDoubt[] } | null = null;
    if (slot.capacity > 1) {
      group = { capacity: slot.capacity, bookedCount: slot.bookedCount };
      if (caller.role !== "STUDENT") {
        const rows = await prisma.doubtBooking.findMany({
          where: { slotId: slot.id, status: { in: ["CONFIRMED", "COMPLETED"] } },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            topic: true,
            description: true,
            attachmentUrls: true,
            student: { select: { user: { select: { name: true, photoUrl: true } } } },
          },
        });
        group.doubts = rows.map((r) => ({
          bookingId: r.id,
          studentName: r.student.user.name,
          photoUrl: r.student.user.photoUrl,
          topic: r.topic,
          description: r.description,
          attachmentUrls: r.attachmentUrls,
        }));
      }
    }

    return apiSuccess({
      group,
      id: caller.booking.id,
      status: caller.booking.status,
      slot: {
        startTime: caller.booking.slot.startTime,
        endTime: caller.booking.slot.endTime,
      },
      topic: caller.booking.topic,
      description: caller.booking.description,
      attachmentUrls: caller.booking.attachmentUrls,
      voiceAnswerUrl: caller.booking.voiceAnswerUrl,
      voiceDurationSec: caller.booking.voiceDurationSec,
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

    // Only the booking that is still CONFIRMED gives its seat back, so a
    // double-tapped cancel can't free two seats.
    const cancelled = await prisma.doubtBooking.updateMany({
      where: { id: caller.booking.id, status: "CONFIRMED" },
      data: { status: newStatus, cancelReason: reason },
    });
    if (cancelled.count > 0) await releaseDoubtSlotSeat(caller.booking.slotId);

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

/**
 * Update a booking with teacher voice answer / notes.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const caller = await resolveDoubtBookingCaller(session.user.id, params.id);
    if (!caller.role || (caller.role !== "TEACHER" && caller.role !== "ADMIN")) {
      return apiError("Only the assigned teacher or admin can update voice answers or notes.", 403);
    }

    const body = await request.json();
    const voiceAnswerUrl = typeof body?.voiceAnswerUrl === "string" ? body.voiceAnswerUrl : undefined;
    const voiceDurationSec = typeof body?.voiceDurationSec === "number" ? Math.round(body.voiceDurationSec) : undefined;
    const teacherNotes = typeof body?.teacherNotes === "string" ? body.teacherNotes.slice(0, 2000) : undefined;

    const updated = await prisma.doubtBooking.update({
      where: { id: caller.booking.id },
      data: {
        ...(voiceAnswerUrl !== undefined ? { voiceAnswerUrl } : {}),
        ...(voiceDurationSec !== undefined ? { voiceDurationSec } : {}),
        ...(teacherNotes !== undefined ? { teacherNotes } : {}),
      },
    });

    return apiSuccess({ booking: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
