import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Client-triggered activity tracking (currently just SEARCH — batch views
 * and payment events are recorded server-side, closer to where they
 * actually happen, since those pages/routes already run on the server).
 * See src/lib/crm/lead-category.ts for how these events drive automatic
 * lead categorization.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("UNAUTHENTICATED");

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!student) return apiError("Not a student account.", 403);

    const body = await request.json();
    const searchQuery = typeof body?.searchQuery === "string" ? body.searchQuery.trim().slice(0, 200) : "";
    if (!searchQuery) return apiError("searchQuery is required.", 400);

    await prisma.studentActivityEvent.create({
      data: { studentId: student.id, type: "SEARCH", searchQuery },
    });

    return apiSuccess({ tracked: true });
  } catch (error) {
    return handleApiError(error);
  }
}
