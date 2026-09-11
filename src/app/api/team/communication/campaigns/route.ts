import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { resolveCampaignRecipients, queueCampaign, processEmailQueue } from "@/lib/email/campaign-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);

    const campaigns = await prisma.emailCampaign.findMany({
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { name: true } }, template: { select: { name: true } } },
    });
    return apiSuccess({ campaigns });
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({
  name: z.string().trim().min(2).max(150),
  recipientGroup: z.enum([
    "ALL_STUDENTS",
    "ALL_STAFF",
    "SELECTED_STUDENTS",
    "SELECTED_STAFF",
    "BATCH",
    "TEACHER",
    "CUSTOM_FILTER_STUDENTS",
    "CUSTOM_FILTER_STAFF",
  ]),
  batchId: z.string().optional(),
  teacherId: z.string().optional(),
  userIds: z.array(z.string()).optional(),
  subject: z.string().trim().min(2).max(200),
  bodyHtml: z.string().trim().min(10),
  templateId: z.string().optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable(),
  /** Explicit confirmation from the UI's confirm screen — required, not implied by making the POST call. */
  confirmedRecipientCount: z.number().int().nonnegative(),
});

/**
 * POST /api/team/communication/campaigns — creates the campaign and, unless
 * scheduled for later, queues every recipient right now (never sends
 * inline/synchronously in this request — see lib/email/campaign-queue.ts).
 * `confirmedRecipientCount` must match what preview returned; a mismatch
 * (state changed between preview and confirm) is rejected rather than
 * silently sending to a different count than what the admin approved.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);

    const input = schema.parse(await req.json());
    const filter = { batchId: input.batchId, teacherId: input.teacherId, userIds: input.userIds };
    const recipients = await resolveCampaignRecipients(input.recipientGroup, filter);

    if (recipients.length !== input.confirmedRecipientCount) {
      return apiError(
        `Recipient count changed since you previewed this send (was ${input.confirmedRecipientCount}, now ${recipients.length}). Preview again before sending.`,
        409
      );
    }
    if (recipients.length === 0) {
      return apiError("No recipients match this selection.", 422);
    }

    const isScheduled = Boolean(input.scheduledAt && new Date(input.scheduledAt).getTime() > Date.now());

    const campaign = await prisma.emailCampaign.create({
      data: {
        name: input.name,
        recipientGroup: input.recipientGroup,
        recipientFilter: filter,
        recipientCount: recipients.length,
        subject: input.subject,
        bodyHtml: input.bodyHtml,
        templateId: input.templateId || null,
        status: isScheduled ? "SCHEDULED" : "PROCESSING",
        scheduledAt: isScheduled ? new Date(input.scheduledAt!) : null,
        createdById: session.user.id,
      },
    });

    if (!isScheduled) {
      await queueCampaign(campaign.id, recipients, campaign.subject, campaign.bodyHtml, campaign.templateId);
      // Send the first batch inline (bounded to 25, a few seconds at most)
      // so a small campaign's admin sees real progress immediately, then
      // let api/cron/email-campaigns/process pick up the rest. Awaited
      // deliberately — a serverless function's background work is not
      // guaranteed to keep running once the response is sent, so a true
      // "fire and forget" here could silently never happen.
      await processEmailQueue(25).catch((err) => console.error("[campaign] immediate queue kick failed:", err));
    }

    return apiSuccess({ campaign }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
