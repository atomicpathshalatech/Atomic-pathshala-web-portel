import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { WhatsAppMessageType, WhatsAppQueueStatus } from "@prisma/client";
import { queueWhatsAppMessage } from "@/lib/whatsapp/engine";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHATSAPP_CAMPAIGN_MANAGE);

    const campaign = await prisma.whatsAppCampaign.findUnique({
      where: { id: params.id },
    });

    if (!campaign) {
      return apiError("Campaign not found", 404);
    }

    if (campaign.status === "RUNNING" || campaign.status === "COMPLETED") {
      return apiError(`Campaign is already in status ${campaign.status}`, 400);
    }

    // Mark campaign as RUNNING
    await prisma.whatsAppCampaign.update({
      where: { id: params.id },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
      },
    });

    // Query all matching target contacts
    const where: any = { status: "ACTIVE" };
    if (campaign.targetBatchId) where.batchId = campaign.targetBatchId;
    if (Array.isArray(campaign.targetTags) && campaign.targetTags.length > 0) {
      where.tags = { hasSome: campaign.targetTags };
    }

    const contacts = await prisma.whatsAppContact.findMany({
      where,
      select: { id: true, name: true, phone: true },
    });

    let queuedCount = 0;

    for (const contact of contacts) {
      const idempotencyKey = `campaign:${campaign.id}:contact:${contact.id}`;

      // Enqueue message into central WhatsApp engine
      const queueRes = await queueWhatsAppMessage({
        recipientPhone: contact.phone,
        recipientName: contact.name,
        messageType: WhatsAppMessageType.CAMPAIGN_BROADCAST,
        templateName: campaign.templateName,
        templateData: campaign.templateParams as any,
        bodyText: `Broadcast from campaign ${campaign.name}`,
        idempotencyKey,
        metadata: {
          campaignId: campaign.id,
          contactId: contact.id,
        },
      });

      // Insert or upsert recipient record
      await prisma.whatsAppCampaignRecipient.upsert({
        where: {
          campaignId_phone: {
            campaignId: campaign.id,
            phone: contact.phone,
          },
        },
        update: {
          queueMessageId: queueRes?.queueItem?.id || null,
          status: WhatsAppQueueStatus.PENDING,
        },
        create: {
          campaignId: campaign.id,
          contactId: contact.id,
          phone: contact.phone,
          name: contact.name,
          queueMessageId: queueRes?.queueItem?.id || null,
          status: WhatsAppQueueStatus.PENDING,
        },
      });

      queuedCount++;
    }

    // Update campaign totalAudience and sentCount target
    await prisma.whatsAppCampaign.update({
      where: { id: params.id },
      data: {
        totalAudience: queuedCount,
      },
    });

    return apiSuccess({
      success: true,
      campaignId: campaign.id,
      queuedRecipients: queuedCount,
      message: `Campaign started. ${queuedCount} recipients queued for dispatch.`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
