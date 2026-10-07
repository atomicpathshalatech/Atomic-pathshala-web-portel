import { prisma } from "@/lib/db";
import { MetaParsedStatus } from "./parser";
import { WhatsAppQueueStatus } from "@prisma/client";

/**
 * Handles message delivery status callbacks from Meta WhatsApp Cloud API.
 * Updates message queue and campaign recipient records.
 */
export async function processWhatsAppStatusUpdate(statusEvent: MetaParsedStatus) {
  const { wamId, recipientPhone, status, timestamp, errorCode, errorMessage } = statusEvent;

  try {
    // 1. Update WhatsAppMessageQueue if wamId matches providerResponse or idempotencyKey
    const queueStatusMap: Record<string, WhatsAppQueueStatus> = {
      sent: WhatsAppQueueStatus.SENT,
      delivered: WhatsAppQueueStatus.DELIVERED,
      read: WhatsAppQueueStatus.READ,
      failed: WhatsAppQueueStatus.FAILED,
    };

    const targetStatus = queueStatusMap[status];

    if (targetStatus) {
      // Find queue item by wamId or recent recipient matching
      const queueItem = await prisma.whatsAppMessageQueue.findFirst({
        where: {
          OR: [
            { providerResponse: { path: ["messageId"], equals: wamId } },
            { providerResponse: { path: ["id"], equals: wamId } },
            { idempotencyKey: { contains: wamId } },
          ],
        },
      });

      if (queueItem) {
        await prisma.whatsAppMessageQueue.update({
          where: { id: queueItem.id },
          data: {
            status: targetStatus,
            ...(status === "delivered" && { deliveredAt: timestamp }),
            ...(status === "failed" && {
              failedAt: timestamp,
              errorMessage: errorMessage || `Meta error code: ${errorCode || "UNKNOWN"}`,
            }),
          },
        });
      }
    }

    // 2. Update WhatsAppCampaignRecipient if wamId matches queueMessageId
    const recipient = await prisma.whatsAppCampaignRecipient.findFirst({
      where: {
        OR: [
          { queueMessageId: wamId },
          { phone: recipientPhone },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    if (recipient && targetStatus) {
      await prisma.whatsAppCampaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: targetStatus,
          ...(status === "delivered" && { deliveredAt: timestamp }),
          ...(status === "failed" && { errorMessage: errorMessage || `Error ${errorCode}` }),
        },
      });
    }

    return { success: true };
  } catch (err) {
    console.error("[WHATSAPP_STATUS_UPDATE_ERROR]", err);
    return { success: false, error: err };
  }
}
