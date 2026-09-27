import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { createSimulcastGroup, SimulcastGroupError } from "@/lib/live-session/simulcast";

const createSchema = z.object({
  scheduleIds: z.array(z.string().min(1)).min(2).max(20),
  note: z.string().max(500).optional(),
});

/**
 * Admin-only: explicitly link several batch schedules so they are taught as
 * ONE live class (one room, one video; starting/ending moves all of them).
 * Without a group every schedule is its own independent class.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LIVE_CLASS_ADMIN);

    const input = createSchema.parse(await request.json());
    const group = await createSimulcastGroup({ ...input, createdById: session.user.id });
    return apiSuccess({ group }, 201);
  } catch (error) {
    if (error instanceof SimulcastGroupError) return apiError(error.message, error.status);
    return handleApiError(error);
  }
}
