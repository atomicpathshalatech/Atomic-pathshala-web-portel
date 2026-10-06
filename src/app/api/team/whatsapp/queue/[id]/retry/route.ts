import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { sendWhatsAppMessage } from "@/lib/whatsapp/provider";
import { WhatsAppQueueStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHATSAPP_MANAGE);

    const item = await prisma.whatsAppMessageQueue.findUnique({
      where: { id: params.id },
    });

    if (!item) {
      return apiError("Message not found in queue", 404);
    }

    const result = await sendWhatsAppMessage({
      to: item.recipientPhone,
      recipientName: item.recipientName || undefined,
      templateName: item.templateName || undefined,
      templateParams: item.templateData as any,
      bodyText: item.bodyText,
      idempotencyKey: `${item.idempotencyKey}:retry:${Date.now()}`,
      metadata: item.metadata as any,
    });

    if (result.success) {
      const updated = await prisma.whatsAppMessageQueue.update({
        where: { id: item.id },
        data: {
          status: WhatsAppQueueStatus.SENT,
          sentAt: new Date(),
          errorMessage: null,
          providerResponse: result.rawResponse || undefined,
          attempts: { increment: 1 },
        },
      });

      return apiSuccess({ success: true, item: updated, message: "Message dispatched successfully" });
    } else {
      const updated = await prisma.whatsAppMessageQueue.update({
        where: { id: item.id },
        data: {
          status: WhatsAppQueueStatus.FAILED,
          failedAt: new Date(),
          errorMessage: result.error || "Retry dispatch failed",
          providerResponse: result.rawResponse || undefined,
          attempts: { increment: 1 },
        },
      });

      return apiError(result.error || "Failed to deliver message via provider", 400, {
        details: { itemId: updated.id, status: updated.status, attempts: updated.attempts },
      });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
