import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { processChunkForJob } from "@/lib/extraction/chunk-pipeline";

export const maxDuration = 120;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_CREATE);

    const body = await request.json().catch(() => ({}));
    const chunkIndex = typeof body.chunkIndex === "number" ? body.chunkIndex : 0;

    const result = await processChunkForJob(params.id, chunkIndex);

    return apiSuccess(result);
  } catch (err) {
    return handleApiError(err);
  }
}
