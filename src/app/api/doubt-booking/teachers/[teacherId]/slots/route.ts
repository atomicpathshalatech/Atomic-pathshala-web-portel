import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { hasAnyBatchAccess } from "@/lib/batch/entitlement";

/** A specific teacher's future OPEN slots — only what's actually bookable. */
export async function GET(_request: NextRequest, { params }: { params: { teacherId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const entitled = await hasAnyBatchAccess(session.user.id);
    if (!entitled) {
      throw new ForbiddenError("An active batch enrollment or subscription is required to book a doubt session.");
    }

    const slots = await prisma.doubtSlot.findMany({
      where: { teacherId: params.teacherId, status: "OPEN", startTime: { gt: new Date() } },
      orderBy: { startTime: "asc" },
      select: { id: true, date: true, startTime: true, endTime: true },
    });

    return apiSuccess({ slots });
  } catch (error) {
    return handleApiError(error);
  }
}
