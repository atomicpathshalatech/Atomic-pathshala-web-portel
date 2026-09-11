import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { generateCreative } from "@/lib/creative/engine";

export const runtime = "nodejs";

/**
 * GET — the auto-generated lecture-start slide for a scheduled class (spec
 * section 10), independent of the "Start Class" action itself so a
 * pre-join/lobby screen can show it before the teacher actually starts
 * teaching. Cached by the engine — calling this repeatedly (e.g. on every
 * lobby page load) does not re-render unless the underlying data changed.
 */
export async function GET(_req: NextRequest, { params }: { params: { scheduleId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const result = await generateCreative("LECTURE_START_SLIDE", params.scheduleId);
    if (!result.ok) return apiError(result.reason, 422);

    return apiSuccess({ url: result.assetUrl });
  } catch (error) {
    return handleApiError(error);
  }
}
