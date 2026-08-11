import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return apiError("Not authenticated", 401);
    }

    const result = await prisma.notification.updateMany({
      where: { userId: session.user.id, isRead: false },
      data: { isRead: true },
    });

    return apiSuccess({ updated: result.count });
  } catch (error) {
    return handleApiError(error);
  }
}
