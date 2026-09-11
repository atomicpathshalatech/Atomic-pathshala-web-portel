import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/team/communication/logs — Admin-only (spec section 11 & 13).
 * Server-side authorization, not just a hidden nav link: anyone lacking
 * COMMUNICATION_CENTER_ACCESS gets 403 here regardless of how they got the
 * URL, matching the same rule already enforced for /team/students.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") || "";
    const emailType = searchParams.get("emailType") || "";
    const recipientType = searchParams.get("recipientType") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "50", 10)));

    const where: Prisma.EmailLogWhereInput = {};
    if (search) {
      where.OR = [
        { recipientEmail: { contains: search, mode: "insensitive" } },
        { recipientName: { contains: search, mode: "insensitive" } },
        { subject: { contains: search, mode: "insensitive" } },
      ];
    }
    if (status) where.status = status as never;
    if (emailType) where.emailType = emailType as never;
    if (recipientType) where.recipientType = recipientType as never;

    const [total, logs] = await Promise.all([
      prisma.emailLog.count({ where }),
      prisma.emailLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          template: { select: { name: true } },
          campaign: { select: { name: true } },
        },
      }),
    ]);

    return apiSuccess({
      logs,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
