import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Admin-only management of the APP channel's ingest stream pool — one slot
 * per App YouTube class that can be live at the same time.
 *
 * GET  → pool status (slot count, which classes hold leases). Never returns keys.
 * POST { action: "provision", size }  → create slots up to `size` (~50 quota units each)
 * POST { action: "rotate", streamId } → replace an idle slot's key (~100 units)
 */
const postSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("provision"), size: z.number().int().min(1).max(10) }),
  z.object({ action: z.literal("rotate"), streamId: z.string().min(1) }),
]);

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new UnauthorizedError();
  await requirePermission(session.user.id, PERMISSIONS.LIVE_CLASS_ADMIN);
  return session.user.id;
}

export async function GET() {
  try {
    await requireAdmin();
    const { poolStatus } = await import("@/lib/youtube/stream-pool");
    return apiSuccess(await poolStatus());
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAdmin();
    const input = postSchema.parse(await request.json());
    const pool = await import("@/lib/youtube/stream-pool");
    const { prisma } = await import("@/lib/db");

    if (input.action === "provision") {
      const created = await pool.provisionPool(input.size);
      await prisma.auditLog.create({
        data: { userId, action: "STREAM_POOL_PROVISIONED", entityType: "YoutubeIngestStream", entityId: "APP", metadata: { size: input.size, created } },
      });
      return apiSuccess({ created, ...(await pool.poolStatus()) });
    }

    await pool.rotateIdleStream(input.streamId);
    await prisma.auditLog.create({
      data: { userId, action: "STREAM_POOL_KEY_ROTATED", entityType: "YoutubeIngestStream", entityId: input.streamId, metadata: {} },
    });
    return apiSuccess(await pool.poolStatus());
  } catch (error) {
    const { classifyYoutubeError, describeYoutubeError } = await import("@/lib/youtube/errors");
    const kind = classifyYoutubeError(error);
    if (["QUOTA", "RATE_LIMIT", "PERMISSION", "AUTH_REVOKED", "AUTH_EXPIRED", "NETWORK", "BACKEND"].includes(kind)) {
      return apiError(describeYoutubeError(error), 502, { code: `YOUTUBE_${kind}` });
    }
    if (error instanceof Error && /Only an idle/.test(error.message)) return apiError(error.message, 409);
    return handleApiError(error);
  }
}
