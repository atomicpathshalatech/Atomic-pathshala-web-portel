import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { apiSuccess, handleApiError } from "@/lib/api/response";

/** The calling user's own device sessions — active first, most recent
 * first within each group. Self-service only; no other user's rows are
 * ever reachable through this route. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const sessions = await prisma.deviceSession.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return apiSuccess({ sessions });
  } catch (error) {
    return handleApiError(error);
  }
}
