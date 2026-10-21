import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { resolveDoubtBookingCaller } from "@/lib/doubt-booking/access";
import { createDoubtSessionToken, doubtBookingRoomName, doubtSlotRoomName } from "@/lib/livekit/server";
import { doubtBookingChannel } from "@/lib/realtime/pusher-server";

/**
 * Mints a LiveKit token scoped to this booking's room (the slot's shared
 * room for a group session). Knowing
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

    // A group slot is one call for every booked student; a 1:1 slot keeps
    // its private per-booking room.
    const roomName =
      caller.booking.slot.capacity > 1
        ? doubtSlotRoomName(caller.booking.slot.id)
        : doubtBookingRoomName(caller.booking.id);
    const token = await createDoubtSessionToken({ identity, name, roomName });
    const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL || "";

    return apiSuccess({
      token,
      serverUrl,
      roomName,
      channel: doubtBookingChannel(caller.booking.id),
      role: caller.role,
      booking: {
        id: caller.booking.id,
        topic: caller.booking.topic,
        description: caller.booking.description,
        attachmentUrls: caller.booking.attachmentUrls,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
