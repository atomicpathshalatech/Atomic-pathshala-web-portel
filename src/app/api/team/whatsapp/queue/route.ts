import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { Prisma, WhatsAppQueueStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHATSAPP_READ);

    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status") as WhatsAppQueueStatus | null;
    const type = searchParams.get("type");
    const search = searchParams.get("search")?.trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.WhatsAppMessageQueueWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (type) {
      where.messageType = type as any;
    }

    if (search) {
      where.OR = [
        { recipientPhone: { contains: search } },
        { recipientName: { contains: search, mode: "insensitive" } },
        { bodyText: { contains: search, mode: "insensitive" } },
        { errorMessage: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total, pendingCount, sentCount, failedCount] = await Promise.all([
      prisma.whatsAppMessageQueue.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.whatsAppMessageQueue.count({ where }),
      prisma.whatsAppMessageQueue.count({ where: { status: "PENDING" } }),
      prisma.whatsAppMessageQueue.count({ where: { status: "SENT" } }),
      prisma.whatsAppMessageQueue.count({ where: { status: "FAILED" } }),
    ]);

    return apiSuccess({
      items,
      stats: {
        total,
        pending: pendingCount,
        sent: sentCount,
        failed: failedCount,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
