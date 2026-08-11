import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return apiError("Not authenticated", 401);
    }

    const notification = await prisma.notification.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true },
    });

    if (!notification || notification.userId !== session.user.id) {
      return apiError("Notification not found", 404);
    }

    await prisma.notification.update({
      where: { id: params.id },
      data: { isRead: true },
    });

    return apiSuccess({ id: params.id });
  } catch (error) {
    return handleApiError(error);
  }
}
