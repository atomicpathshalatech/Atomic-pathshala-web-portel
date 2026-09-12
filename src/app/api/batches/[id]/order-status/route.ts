import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * The payment-result screen calls this on mount to render the real,
 * current server state — never trusting a URL param / query string /
 * client callback alone (a manually-opened "success" URL with no real
 * completed order must show the true state, not a fabricated success).
 * Returns the caller's own most recent order for this batch, resolved
 * from the session — never a client-supplied studentId.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return apiError("No student record for this account", 404);

    const order = await prisma.batchOrder.findFirst({
      where: { studentId: student.id, batchId: params.id },
      orderBy: { createdAt: "desc" },
      select: { status: true, amount: true, createdAt: true },
    });

    if (!order) {
      return apiSuccess({ status: "NONE" as const });
    }

    return apiSuccess({ status: order.status, amount: order.amount, createdAt: order.createdAt });
  } catch (error) {
    return handleApiError(error);
  }
}
