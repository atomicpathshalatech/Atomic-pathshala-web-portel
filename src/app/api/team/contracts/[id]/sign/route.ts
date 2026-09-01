import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { z } from "zod";

const signSchema = z.object({
  signedName: z.string().min(2, "Full legal name is required"),
  signatureDataUrl: z.string().optional(),
  agreeTerms: z.boolean().refine((val) => val === true, {
    message: "You must accept and agree to the contractual terms.",
  }),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const body = await request.json();
    const input = signSchema.parse(body);

    const contract = await prisma.contract.findUnique({
      where: { id: params.id },
      include: { teacher: { include: { user: true } } },
    });
    if (!contract) return apiError("Contract not found.", 404);

    const isOwner = contract.teacher.userId === session.user.id;
    const canSignSelf = isOwner && (await requirePermission(session.user.id, PERMISSIONS.CONTRACT_SIGN_SELF).then(() => true).catch(() => false));
    const canSignAny = await requirePermission(session.user.id, PERMISSIONS.CONTRACT_CREATE).then(() => true).catch(() => false);

    if (!canSignSelf && !canSignAny) {
      throw new UnauthorizedError("You do not have permission to execute this agreement.");
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "106.216.229.13";

    const updated = await prisma.contract.update({
      where: { id: contract.id },
      data: {
        status: "SIGNED",
        signedAt: new Date(),
        signedName: input.signedName,
        signatureIp: ip,
      },
      include: { teacher: { include: { user: true } } },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CONTRACT_SIGNED",
        entityType: "Contract",
        entityId: contract.id,
        metadata: {
          signerName: input.signedName,
          signerRole: isOwner ? "Educator" : "Authorized Signatory",
          ip,
          timestamp: new Date().toISOString(),
        },
      },
    });

    return apiSuccess({ contract: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
