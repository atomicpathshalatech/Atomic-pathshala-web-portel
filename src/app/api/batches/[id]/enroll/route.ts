import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { enrollInFreeBatch } from "@/server/services/batch-order-service";

/**
 * Direct self-enrollment endpoint for free batches (price === 0).
 * Student calls this to immediately join a free batch without going
 * through a payment gateway. Idempotent: multiple clicks return existing
 * active enrollment cleanly without duplicating records.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("You must be logged in as a student to enroll.", 401);
    }

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
    });

    if (!student) {
      return apiError("Student profile not found for this account.", 404);
    }

    const result = await enrollInFreeBatch(student.id, params.id);
    return apiSuccess(result, 200);
  } catch (error) {
    return handleApiError(error);
  }
}
