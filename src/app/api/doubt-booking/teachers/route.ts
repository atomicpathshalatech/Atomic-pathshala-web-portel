import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { hasAnyBatchAccess } from "@/lib/batch/entitlement";

/** Teachers currently offering at least one future open doubt-session slot. */
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const entitled = await hasAnyBatchAccess(session.user.id);
    if (!entitled) {
      throw new ForbiddenError("An active batch enrollment or subscription is required to book a doubt session.");
    }

    const teachers = await prisma.teacher.findMany({
      where: { doubtSlots: { some: { status: "OPEN", startTime: { gt: new Date() } } } },
      select: {
        id: true,
        department: true,
        subjects: true,
        bio: true,
        user: { select: { name: true, photoUrl: true } },
      },
    });

    return apiSuccess({ teachers });
  } catch (error) {
    return handleApiError(error);
  }
}
