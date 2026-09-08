import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight unread-count endpoint.
 *
 * The notification bell (rendered in every Student/Team shell) previously
 * fetched the FULL `/api/notifications` list — an unbounded `findMany` of
 * every row the user ever received — just to compute `filter(!isRead).length`
 * on the client. This returns a single index-covered `count()` instead
 * (`@@index([userId, isRead])`), turning a multi-KB payload + unbounded scan
 * into a few bytes.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Not authenticated", 401);
    }

    const count = await prisma.notification.count({
      where: { userId: session.user.id, isRead: false },
    });

    return apiSuccess({ count });
  } catch (error) {
    return handleApiError(error);
  }
}
