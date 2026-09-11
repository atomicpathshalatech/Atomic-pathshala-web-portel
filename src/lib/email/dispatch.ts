import "server-only";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import type { EmailCategory, RecipientType } from "@prisma/client";

export type DispatchEmailInput = {
  /**
   * Stable, globally-unique event key — the actual duplicate-prevention
   * mechanism (a DB unique constraint on EmailLog.idempotencyKey). Build it
   * from something that can only happen once per real-world event:
   *   registration:<userId>
   *   password_reset:<resetEventId>
   *   enrollment:<enrollmentId>
   *   birthday:<subjectType>:<subjectId>:<year>
   *   campaign:<campaignId>:<recipientUserId>
   * A retried request, a page refresh, a queue redelivery, or a double
   * click all resolve to the same key, so only the first attempt sends.
   */
  idempotencyKey: string;
  to: string;
  recipientName: string;
  recipientUserId?: string | null;
  recipientType: RecipientType;
  emailType: EmailCategory;
  subject: string;
  html: string;
  text?: string;
  templateId?: string | null;
  campaignId?: string | null;
};

export type DispatchEmailResult =
  | { outcome: "sent"; logId: string }
  | { outcome: "duplicate"; logId: string | null }
  | { outcome: "failed"; logId: string | null; reason: string };

/**
 * The one path every user-facing email should go through: registration
 * credentials, password reset, enrollment, staff invitations, bulk
 * campaigns, birthday wishes. sendMail() (Resend) is still the actual
 * transport underneath — this wraps it with the two things the spec calls
 * out as a "centralized system" rather than "separate hard-coded email
 * functions": an idempotency guarantee, and a permanent EmailLog row.
 *
 * Never throws. A caller mid-registration or mid-enrollment must not have
 * that transaction fail because the mail provider hiccuped (see the
 * "Error Handling" requirement) — every failure mode here resolves to a
 * normal return value instead.
 */
export async function dispatchEmail(input: DispatchEmailInput): Promise<DispatchEmailResult> {
  let logId: string;
  try {
    const created = await prisma.emailLog.create({
      data: {
        idempotencyKey: input.idempotencyKey,
        recipientUserId: input.recipientUserId ?? null,
        recipientName: input.recipientName,
        recipientEmail: input.to,
        recipientType: input.recipientType,
        emailType: input.emailType,
        templateId: input.templateId ?? null,
        campaignId: input.campaignId ?? null,
        subject: input.subject,
        status: "SENDING",
      },
      select: { id: true },
    });
    logId = created.id;
  } catch (err: unknown) {
    if (isUniqueConstraintError(err)) {
      console.info(`[email] duplicate suppressed for idempotency key: ${input.idempotencyKey}`);
      const existing = await prisma.emailLog
        .findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true } })
        .catch(() => null);
      return { outcome: "duplicate", logId: existing?.id ?? null };
    }
    console.error("[email] could not create EmailLog row — sending nothing:", err);
    return { outcome: "failed", logId: null, reason: "LOG_CREATE_ERROR" };
  }

  try {
    const result = await sendMail({ to: input.to, subject: input.subject, html: input.html, text: input.text });
    if (result.delivered) {
      await prisma.emailLog
        .update({ where: { id: logId }, data: { status: "SENT", sentAt: new Date() } })
        .catch((e) => console.error("[email] failed to mark log SENT:", e));
      return { outcome: "sent", logId };
    }
    const reason = result.reason ?? "UNKNOWN";
    await prisma.emailLog
      .update({ where: { id: logId }, data: { status: "FAILED", failureReason: reason } })
      .catch((e) => console.error("[email] failed to mark log FAILED:", e));
    return { outcome: "failed", logId, reason };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "UNKNOWN";
    await prisma.emailLog
      .update({ where: { id: logId }, data: { status: "FAILED", failureReason: reason } })
      .catch(() => {});
    console.error("[email] sendMail threw:", err);
    return { outcome: "failed", logId, reason };
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}
