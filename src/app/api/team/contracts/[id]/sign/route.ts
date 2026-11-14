import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { countersignDirector } from "@/lib/agreements/agreement-service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const signSchema = z.object({
  signedName: z.string().min(2, "Full legal name is required"),
  signatureDataUrl: z.string().optional(),
  agreeTerms: z.boolean().default(true),
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

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const userAgent = request.headers.get("user-agent") || undefined;

    // Check new Agreement model
    const agreement = await prisma.agreement.findUnique({
      where: { id: params.id },
      include: { educator: true },
    });

    if (agreement) {
      // If director is signing
      const result = await countersignDirector({
        agreementId: agreement.id,
        directorUserId: session.user.id,
        directorSignedName: input.signedName,
        signatureDataUrl: input.signatureDataUrl,
        signatureMethod: input.signatureDataUrl ? "ELECTRONIC_DRAWN" : "ELECTRONIC_TYPED",
        ipAddress: ip,
        userAgent,
      });
      return apiSuccess({ success: true, result });
    }

    // Fallback to legacy Contract update
    const legacyContract = await prisma.contract.findUnique({
      where: { id: params.id },
      include: { teacher: true },
    });
    if (!legacyContract) return apiError("Contract not found.", 404);

    const updated = await prisma.contract.update({
      where: { id: legacyContract.id },
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
        entityId: legacyContract.id,
        metadata: {
          signerName: input.signedName,
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
