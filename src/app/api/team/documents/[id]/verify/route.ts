import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { documentVerifySchema } from "@/lib/validation/document";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.DOCUMENT_VERIFY);

    const input = documentVerifySchema.parse(await request.json());

    if (input.status === "REJECTED" && !input.rejectionNote) {
      return apiError("A rejection note is required when rejecting a document.", 422);
    }

    const document = await prisma.teacherDocument.findUnique({ where: { id } });
    if (!document) return apiError("Document not found.", 404);

    const updated = await prisma.$transaction(async (tx) => {
      const doc = await tx.teacherDocument.update({
        where: { id },
        data: {
          status: input.status,
          rejectionNote: input.status === "REJECTED" ? input.rejectionNote : null,
          verifiedById: session.user.id,
          verifiedAt: new Date(),
        },
      });

      // If every required document type for this teacher is now VERIFIED,
      // advance them out of document review into the contract stage.
      if (input.status === "VERIFIED") {
        const REQUIRED_TYPES = ["GOVT_ID_FRONT", "PAN_CARD", "PHOTO"] as const;
        const verifiedCount = await tx.teacherDocument.count({
          where: { teacherId: doc.teacherId, type: { in: [...REQUIRED_TYPES] }, status: "VERIFIED" },
        });
        if (verifiedCount >= REQUIRED_TYPES.length) {
          await tx.teacher.updateMany({
            where: { id: doc.teacherId, onboardingStatus: "PENDING_REVIEW" },
            data: { onboardingStatus: "PENDING_CONTRACT" },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: input.status === "VERIFIED" ? "DOCUMENT_VERIFIED" : "DOCUMENT_REJECTED",
          entityType: "TeacherDocument",
          entityId: doc.id,
        },
      });

      return doc;
    });

    return apiSuccess({ document: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
