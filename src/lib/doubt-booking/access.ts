import "server-only";
import { prisma } from "@/lib/db";

export type DoubtBookingCaller =
  | { role: "STUDENT"; booking: NonNullable<Awaited<ReturnType<typeof loadBooking>>> }
  | { role: "TEACHER"; booking: NonNullable<Awaited<ReturnType<typeof loadBooking>>> }
  | { role: "ADMIN"; booking: NonNullable<Awaited<ReturnType<typeof loadBooking>>> }
  | { role: null; booking: null };

function loadBooking(bookingId: string) {
  return prisma.doubtBooking.findUnique({
    where: { id: bookingId },
    include: {
      slot: true,
      student: { include: { user: { select: { id: true, name: true, photoUrl: true } } } },
      teacher: { include: { user: { select: { id: true, name: true, photoUrl: true } } } },
    },
  });
}

/**
 * Resolves whether the signed-in caller is the booked student, the
 * assigned teacher, or an authorized admin (support/moderation override,
 * same BATCH_UPDATE permission pattern resolveWhiteboardAccess already
 * uses) — NEVER from a client-supplied role. Callers should return the
 * same generic 404 for both "no such booking" and "not yours" so a
 * booking id can't be used to enumerate other students' bookings.
 */
export async function resolveDoubtBookingCaller(
  userId: string,
  bookingId: string
): Promise<DoubtBookingCaller> {
  const booking = await loadBooking(bookingId);
  if (!booking) return { role: null, booking: null };

  if (booking.student.userId === userId) return { role: "STUDENT", booking };
  if (booking.teacher.userId === userId) return { role: "TEACHER", booking };

  const { hasPermission } = await import("@/lib/rbac/guard");
  const { PERMISSIONS } = await import("@/lib/rbac/permissions");
  const isAdmin = await hasPermission(userId, PERMISSIONS.BATCH_UPDATE);
  if (isAdmin) return { role: "ADMIN", booking };

  return { role: null, booking: null };
}
