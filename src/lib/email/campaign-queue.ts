import "server-only";
import { prisma } from "@/lib/db";
import { sendQueuedLog } from "./dispatch";
import { renderTemplate } from "./render";
import type { RecipientGroupType, RecipientType } from "@prisma/client";

export type ResolvedRecipient = {
  userId: string;
  name: string;
  email: string;
  recipientType: RecipientType;
};

/**
 * Spec section 6: "Do NOT send bulk emails immediately after clicking
 * Select All" — this resolves WHO the campaign would reach; queueCampaign()
 * (below) is the separate step that actually commits to sending, called
 * only after the admin has seen the count and confirmed.
 */
export async function resolveCampaignRecipients(
  group: RecipientGroupType,
  filter: { batchId?: string; teacherId?: string; userIds?: string[] } = {}
): Promise<ResolvedRecipient[]> {
  switch (group) {
    case "ALL_STUDENTS":
    case "CUSTOM_FILTER_STUDENTS": {
      const students = await prisma.student.findMany({
        where: buildStudentWhere(group === "CUSTOM_FILTER_STUDENTS" ? filter : {}),
        select: { userId: true, user: { select: { name: true, email: true } } },
      });
      return students
        .filter((s) => s.user.email)
        .map((s) => ({ userId: s.userId, name: s.user.name, email: s.user.email, recipientType: "STUDENT" as const }));
    }
    case "SELECTED_STUDENTS": {
      if (!filter.userIds?.length) return [];
      const students = await prisma.student.findMany({
        where: { userId: { in: filter.userIds } },
        select: { userId: true, user: { select: { name: true, email: true } } },
      });
      return students
        .filter((s) => s.user.email)
        .map((s) => ({ userId: s.userId, name: s.user.name, email: s.user.email, recipientType: "STUDENT" as const }));
    }
    case "BATCH": {
      if (!filter.batchId) return [];
      const enrollments = await prisma.batchEnrollment.findMany({
        where: { batchId: filter.batchId, status: "ACTIVE" },
        select: { student: { select: { userId: true, user: { select: { name: true, email: true } } } } },
      });
      return enrollments
        .filter((e) => e.student.user.email)
        .map((e) => ({
          userId: e.student.userId,
          name: e.student.user.name,
          email: e.student.user.email,
          recipientType: "STUDENT" as const,
        }));
    }
    case "TEACHER": {
      if (!filter.teacherId) return [];
      const enrollments = await prisma.batchEnrollment.findMany({
        where: { status: "ACTIVE", batch: { teachers: { some: { teacherId: filter.teacherId } } } },
        select: { student: { select: { userId: true, user: { select: { name: true, email: true } } } } },
      });
      const byUser = new Map<string, ResolvedRecipient>();
      for (const e of enrollments) {
        if (!e.student.user.email) continue;
        byUser.set(e.student.userId, {
          userId: e.student.userId,
          name: e.student.user.name,
          email: e.student.user.email,
          recipientType: "STUDENT",
        });
      }
      return [...byUser.values()];
    }
    case "ALL_STAFF":
    case "CUSTOM_FILTER_STAFF": {
      const staff = await prisma.user.findMany({
        where: { role: { name: { notIn: ["STUDENT", "PARENT"] } }, status: "ACTIVE" },
        select: { id: true, name: true, email: true },
      });
      return staff.map((u) => ({ userId: u.id, name: u.name, email: u.email, recipientType: "STAFF" as const }));
    }
    case "SELECTED_STAFF": {
      if (!filter.userIds?.length) return [];
      const staff = await prisma.user.findMany({ where: { id: { in: filter.userIds } }, select: { id: true, name: true, email: true } });
      return staff.map((u) => ({ userId: u.id, name: u.name, email: u.email, recipientType: "STAFF" as const }));
    }
    default:
      return [];
  }
}

function buildStudentWhere(filter: { batchId?: string }) {
  return {
    user: { status: "ACTIVE" as const },
    ...(filter.batchId ? { batchEnrollments: { some: { batchId: filter.batchId, status: "ACTIVE" as const } } } : {}),
  };
}

/**
 * Commits a campaign: writes one QUEUED EmailLog row per recipient
 * (idempotencyKey `campaign:<campaignId>:<userId>` — re-running this for
 * the same campaign is a no-op via `skipDuplicates`, so a retried "Confirm
 * Send" click can't double-queue). Nothing is sent yet — see processQueue().
 */
export async function queueCampaign(
  campaignId: string,
  recipients: ResolvedRecipient[],
  subject: string,
  bodyHtml: string,
  templateId: string | null
) {
  if (recipients.length === 0) return { queued: 0 };

  const rows = recipients.map((r) => ({
    idempotencyKey: `campaign:${campaignId}:${r.userId}`,
    recipientUserId: r.userId,
    recipientName: r.name,
    recipientEmail: r.email,
    recipientType: r.recipientType,
    emailType: "PROMOTIONAL" as const,
    templateId,
    campaignId,
    subject: renderTemplate(subject, { recipient_name: r.name }),
    status: "QUEUED" as const,
  }));

  const result = await prisma.emailLog.createMany({ data: rows, skipDuplicates: true });
  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: { recipientCount: recipients.length },
  });
  return { queued: result.count };
}

/**
 * Phase 1 of the cron job: any SCHEDULED campaign whose time has come gets
 * its recipients resolved and queued right now (recipients are resolved at
 * activation time, not at "Schedule" time, so someone who enrolled in the
 * meantime is correctly included/excluded).
 */
export async function activateDueScheduledCampaigns(): Promise<{ activated: number }> {
  const due = await prisma.emailCampaign.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
  });

  for (const campaign of due) {
    const filter = (campaign.recipientFilter as { batchId?: string; teacherId?: string; userIds?: string[] } | null) ?? {};
    const recipients = await resolveCampaignRecipients(campaign.recipientGroup, filter);
    await prisma.emailCampaign.update({ where: { id: campaign.id }, data: { status: "PROCESSING" } });
    await queueCampaign(campaign.id, recipients, campaign.subject, campaign.bodyHtml, campaign.templateId);
  }

  return { activated: due.length };
}

/**
 * The queue processor (spec section 10: "use a proper backend email queue",
 * "must not block the admin interface"). Sends up to `limit` QUEUED rows
 * across all in-flight campaigns per invocation — called from
 * api/cron/email-campaigns/process (Vercel Cron) and also fired once,
 * fire-and-forget, right after a campaign is queued so small sends start
 * immediately instead of waiting for the next cron tick.
 */
export async function processEmailQueue(limit = 25): Promise<{ sent: number; failed: number }> {
  const batch = await prisma.emailLog.findMany({
    where: { status: "QUEUED", campaignId: { not: null } },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: { campaign: { select: { bodyHtml: true } } },
  });

  let sent = 0;
  let failed = 0;
  const touchedCampaigns = new Set<string>();

  for (const row of batch) {
    if (row.campaignId) touchedCampaigns.add(row.campaignId);
    const html = renderTemplate(row.campaign?.bodyHtml ?? "", { recipient_name: row.recipientName });
    const result = await sendQueuedLog(row.id, row.recipientEmail, row.subject, html);
    if (result.outcome === "sent") sent++;
    else failed++;
  }

  for (const campaignId of touchedCampaigns) {
    await syncCampaignStats(campaignId);
  }

  return { sent, failed };
}

async function syncCampaignStats(campaignId: string) {
  const [sentCount, failedCount, queuedCount, total] = await Promise.all([
    prisma.emailLog.count({ where: { campaignId, status: { in: ["SENT", "DELIVERED"] } } }),
    prisma.emailLog.count({ where: { campaignId, status: { in: ["FAILED", "BOUNCED"] } } }),
    prisma.emailLog.count({ where: { campaignId, status: { in: ["QUEUED", "SENDING"] } } }),
    prisma.emailLog.count({ where: { campaignId } }),
  ]);

  const status = queuedCount > 0 ? "PROCESSING" : failedCount === 0 ? "COMPLETED" : sentCount > 0 ? "PARTIALLY_FAILED" : "PARTIALLY_FAILED";

  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: { sentCount, failedCount, status: total > 0 ? status : "DRAFT" },
  });
}
