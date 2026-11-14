import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { z } from "zod";

export const dynamic = "force-dynamic";

const rejectSchema = z.object({
  reason: z.string().min(5, "Rejection reason is required (min 5 chars)"),
  actionType: z.enum(["REJECTED", "CORRECTION_REQUESTED"]).default("REJECTED"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const canManage =
      (await hasPermission(session.user.id, PERMISSIONS.CONTRACT_CREATE)) ||
      (await hasPermission(session.user.id, PERMISSIONS.TEAM_PORTAL_ACCESS));
    if (!canManage) {
      throw new UnauthorizedError("You do not have permission to manage agreements.");
    }

    const body = await request.json();
    const input = rejectSchema.parse(body);

    const agreement = await prisma.agreement.update({
      where: { id: params.id },
      data: {
        status: input.actionType,
      },
    });

    await prisma.agreementAuditLog.create({
      data: {
        agreementId: agreement.id,
        actorId: session.user.id,
        eventType: input.actionType,
        metadata: {
          reason: input.reason,
          timestamp: new Date().toISOString(),
        },
      },
    });

    return apiSuccess({
      message: `Agreement marked as ${input.actionType}.`,
      status: agreement.status,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
