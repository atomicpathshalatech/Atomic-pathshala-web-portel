import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { resolveDoubtBookingCaller } from "@/lib/doubt-booking/access";
import { createDoubtSessionToken, doubtBookingRoomName } from "@/lib/livekit/server";
import { doubtBookingChannel } from "@/lib/realtime/pusher-server";

/**
 * Mints a LiveKit token scoped to this one booking's private room. Knowing
 * a booking id is NOT enough to join — resolveDoubtBookingCaller re-derives
 * the caller's relationship to this specific booking from the session on
 * every call; a student who isn't the booked one (or an unrelated teacher)
 * gets the same generic 404 a nonexistent booking id would, never a token.
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const caller = await resolveDoubtBookingCaller(session.user.id, params.id);
    if (!caller.role) return apiError("Booking not found.", 404);
    if (caller.booking.status !== "CONFIRMED") {
      return apiError("This session is not currently joinable.", 409);
    }

    const identity = session.user.id;
    const name =
      caller.role === "STUDENT"
        ? caller.booking.student.user.name
        : caller.role === "TEACHER"
          ? caller.booking.teacher.user.name
          : "Admin";

    const roomName = doubtBookingRoomName(caller.booking.id);
    const token = await createDoubtSessionToken({ identity, name, roomName });

    return apiSuccess({
      token,
      roomName,
      channel: doubtBookingChannel(caller.booking.id),
      role: caller.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
