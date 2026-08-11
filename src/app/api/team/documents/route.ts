import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { documentUploadSchema } from "@/lib/validation/document";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/** Self-service: the signed-in teacher's own KYC documents. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.DOCUMENT_READ_SELF);

    const teacher = await prisma.teacher.findUnique({
      where: { userId: session!.user.id },
      select: { id: true },
    });
    if (!teacher) return apiError("No faculty profile found for this account.", 404);

    const documents = await prisma.teacherDocument.findMany({
      where: { teacherId: teacher.id },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess({ documents });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.DOCUMENT_UPLOAD_SELF);

    const teacher = await prisma.teacher.findUnique({
      where: { userId: session.user.id },
      select: { id: true, onboardingStatus: true },
    });
    if (!teacher) return apiError("No faculty profile found for this account.", 404);

    const input = documentUploadSchema.parse(await request.json());

    const document = await prisma.$transaction(async (tx) => {
      // Re-upload of a previously rejected/pending doc of the same type
      // replaces it rather than piling up duplicates.
      const existing = await tx.teacherDocument.findFirst({
        where: { teacherId: teacher.id, type: input.type, status: { not: "VERIFIED" } },
      });
      const doc = existing
        ? await tx.teacherDocument.update({
            where: { id: existing.id },
            data: {
              fileUrl: input.fileUrl,
              fileName: input.fileName,
              status: "PENDING",
              rejectionNote: null,
              verifiedById: null,
              verifiedAt: null,
            },
          })
        : await tx.teacherDocument.create({
            data: {
              teacherId: teacher.id,
              type: input.type,
              fileUrl: input.fileUrl,
              fileName: input.fileName,
            },
          });

      if (teacher.onboardingStatus === "PENDING_DOCUMENTS") {
        await tx.teacher.update({
          where: { id: teacher.id },
          data: { onboardingStatus: "PENDING_REVIEW" },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "DOCUMENT_UPLOADED",
          entityType: "TeacherDocument",
          entityId: doc.id,
          metadata: { type: input.type },
        },
      });

      return doc;
    });

    return apiSuccess({ document }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
