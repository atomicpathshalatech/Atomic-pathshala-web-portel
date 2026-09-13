import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { pusherServer, doubtBookingChannel } from "@/lib/realtime/pusher-server";

/**
 * Teacher cancels one of their own slots. If it was already booked, the
 * booking is cancelled too (CANCELLED_BY_TEACHER) rather than left dangling
 * — a student must never be able to "join" a cancelled slot.
 */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    if (!teacher) throw new ForbiddenError();

    const slot = await prisma.doubtSlot.findUnique({
      where: { id: params.id },
      include: { booking: true },
    });
    if (!slot || slot.teacherId !== teacher.id) {
      return apiError("Slot not found.", 404);
    }
    if (slot.status === "CANCELLED") {
      return apiSuccess({ cancelled: true });
    }

    await prisma.$transaction([
      prisma.doubtSlot.update({ where: { id: slot.id }, data: { status: "CANCELLED" } }),
      ...(slot.booking
        ? [
            prisma.doubtBooking.update({
              where: { id: slot.booking.id },
              data: { status: "CANCELLED_BY_TEACHER", cancelReason: "Teacher cancelled the slot." },
            }),
          ]
        : []),
    ]);

    if (slot.booking) {
      try {
        await pusherServer.trigger(doubtBookingChannel(slot.booking.id), "doubt-booking-cancelled", {
          bookingId: slot.booking.id,
        });
      } catch (err) {
        console.error("[doubt-booking] cancellation notify error:", err);
      }
    }

    return apiSuccess({ cancelled: true });
  } catch (error) {
    return handleApiError(error);
  }
}
