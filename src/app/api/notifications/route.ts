import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return apiError("Not authenticated", 401);
    }

    // Bounded: the in-app feed only ever renders recent items. An
    // unbounded findMany here grew without limit for long-lived accounts.
    const notifications = await prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return apiSuccess({ notifications });
  } catch (error) {
    return handleApiError(error);
  }
}
