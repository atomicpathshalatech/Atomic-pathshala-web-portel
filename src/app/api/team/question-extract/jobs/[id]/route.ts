import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_READ);

    const job = await prisma.extractionJob.findUnique({
      where: { id: params.id },
      include: {
        createdBy: { select: { name: true, email: true } },
      },
    });

    if (!job) return apiError("Extraction job not found.", 404);

    return apiSuccess({ job });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_DELETE);

    const existing = await prisma.extractionJob.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Extraction job not found.", 404);

    await prisma.extractionJob.delete({ where: { id: params.id } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "EXTRACTION_JOB_DELETE",
        entityType: "ExtractionJob",
        entityId: params.id,
      },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
