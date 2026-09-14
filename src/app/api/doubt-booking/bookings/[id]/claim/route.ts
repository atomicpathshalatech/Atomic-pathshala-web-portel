import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { pusherServer, doubtBookingChannel } from "@/lib/realtime/pusher-server";

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    if (!teacher) {
      const { hasPermission } = await import("@/lib/rbac/guard");
      const { PERMISSIONS } = await import("@/lib/rbac/permissions");
      const isAdmin = await hasPermission(session.user.id, PERMISSIONS.BATCH_UPDATE);
      if (!isAdmin) {
        throw new ForbiddenError("Only teachers or authorized faculty can accept doubts.");
      }
    }

    const teacherId = teacher?.id || session.user.id;

    const existing = await prisma.doubtBooking.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Booking not found.", 404);

    if (existing.claimedByTeacherId && existing.claimedByTeacherId !== teacherId) {
      return apiError("This doubt has already been accepted by another teacher.", 409);
    }

    // Atomic claim to prevent double-claiming
    const claim = await prisma.doubtBooking.updateMany({
      where: {
        id: params.id,
        status: "CONFIRMED",
        OR: [{ claimedByTeacherId: null }, { claimedByTeacherId: teacherId }],
      },
      data: {
        claimedByTeacherId: teacherId,
        claimedAt: new Date(),
      },
    });

    if (claim.count === 0) {
      return apiError("Could not claim this doubt. It may have already been accepted or cancelled.", 409);
    }

    const updated = await prisma.doubtBooking.findUnique({
      where: { id: params.id },
      include: {
        slot: true,
        student: { include: { user: { select: { name: true, email: true, photoUrl: true } } } },
        teacher: { include: { user: { select: { name: true, email: true } } } },
      },
    });

    try {
      await pusherServer.trigger(doubtBookingChannel(params.id), "doubt-booking-claimed", {
        bookingId: params.id,
        claimedByTeacherId: teacherId,
      });
    } catch (err) {
      console.error("[doubt-booking:claim] pusher notify error:", err);
    }

    return apiSuccess({ booking: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
