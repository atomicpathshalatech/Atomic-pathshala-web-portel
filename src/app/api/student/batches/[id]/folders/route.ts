import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { buildFolderTree } from "@/lib/batch/folders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The published part of a batch's material tree, for an enrolled student.
 *
 * Separate from the staff endpoint on purpose: this one never provisions a
 * root folder, never reveals unpublished branches, and requires an ACTIVE
 * enrolment rather than a permission. Reusing the staff route with a flag
 * would put "am I allowed to see this" behind a boolean that is easy to get
 * wrong later.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Please sign in.", 401);

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!student) return apiError("Student profile not found.", 403);

    const enrolled = await prisma.batchEnrollment.count({
      where: { studentId: student.id, batchId: params.id, status: "ACTIVE" },
    });
    if (enrolled === 0) return apiError("Enrol in this batch to see its material.", 403);

    const folders = await prisma.batchFolder.findMany({
      where: { batchId: params.id },
      include: { files: { orderBy: [{ order: "asc" }, { createdAt: "desc" }] } },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });

    return apiSuccess({ tree: buildFolderTree(folders, true) });
  } catch (error) {
    return handleApiError(error);
  }
}
