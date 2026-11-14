import "server-only";
import { prisma } from "@/lib/db";
import nodemailer from "nodemailer";

export type AgreementEmailType =
  | "INVITATION"
  | "REMINDER"
  | "EDUCATOR_SIGNED_NOTIFICATION"
  | "DIRECTOR_SIGNED_NOTIFICATION"
  | "FINAL_EXECUTED"
  | "REJECTED"
  | "TEST";

export type SendAgreementEmailInput = {
  agreementId?: string;
  recipientEmail: string;
  recipientName: string;
  emailType: AgreementEmailType;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
};

export type SendAgreementEmailResult = {
  delivered: boolean;
  provider: "resend" | "smtp" | "none";
  messageId?: string;
  error?: string;
  logId?: string;
};

/**
 * Resolves the official sender address for Agreements.
 * Priority:
 * 1. AGREEMENT_MAIL_FROM (e.g. "Atomic Pathshala Agreements <agreements@atomicpathshala.in>")
 * 2. MAIL_FROM (e.g. "Atomic Pathshala <noreply@atomicpathshala.in>")
 * 3. Fallback standard
 */
export function getAgreementSender(): string {
  return (
    process.env.AGREEMENT_MAIL_FROM?.trim() ||
    process.env.MAIL_FROM?.trim() ||
    "Atomic Pathshala Agreements <agreements@atomicpathshala.in>"
  );
}

/**
 * Universal dual-transport transactional mailer:
 * 1. Attempts Resend HTTP API if RESEND_API_KEY is configured.
 * 2. If Resend fails or is unconfigured, attempts SMTP via Nodemailer (if SMTP_HOST is configured).
 * 3. Records every delivery attempt, provider message ID, and exact failure reason in AgreementEmailLog.
 */
export async function sendAgreementEmail(
  input: SendAgreementEmailInput
): Promise<SendAgreementEmailResult> {
  const from = getAgreementSender();
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const smtpHost = process.env.SMTP_HOST?.trim();

  let logId: string | undefined;

  // 1. Create preliminary AgreementEmailLog row if agreementId is provided
  if (input.agreementId) {
    try {
      const log = await prisma.agreementEmailLog.create({
        data: {
          agreementId: input.agreementId,
          recipient: input.recipientEmail,
          emailType: input.emailType,
          status: "SENDING",
          sentAt: new Date(),
        },
        select: { id: true },
      });
      logId = log.id;
    } catch (e) {
      console.warn("[agreements-email] Failed to pre-log email event:", e);
    }
  }

  // 2. Try Resend if key is present
  if (resendKey) {
    try {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [input.recipientEmail],
          subject: input.subject,
          html: input.html,
          text: input.text,
          ...(input.attachments?.length
            ? {
                attachments: input.attachments.map((a) => ({
                  filename: a.filename,
                  content: a.content.toString("base64"),
                })),
              }
            : {}),
        }),
      });

      const resBody = await resendRes.json().catch(() => ({}));

      if (resendRes.ok && resBody?.id) {
        if (logId) {
          await prisma.agreementEmailLog.update({
            where: { id: logId },
            data: {
              status: "DELIVERED",
              providerMessageId: String(resBody.id),
              deliveredAt: new Date(),
            },
          }).catch(() => {});
        }
        return {
          delivered: true,
          provider: "resend",
          messageId: String(resBody.id),
          logId,
        };
      }

      console.warn(
        `[agreements-email] Resend returned HTTP ${resendRes.status}:`,
        resBody
      );
    } catch (resendErr: any) {
      console.warn("[agreements-email] Resend exception:", resendErr?.message);
    }
  }

  // 3. Fallback to SMTP if SMTP_HOST is configured
  if (smtpHost) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
        auth: {
          user: process.env.SMTP_USER || "",
          pass: process.env.SMTP_PASSWORD || "",
        },
      });

      const info = await transporter.sendMail({
        from,
        to: input.recipientEmail,
        subject: input.subject,
        html: input.html,
        text: input.text,
        attachments: input.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });

      if (logId) {
        await prisma.agreementEmailLog.update({
          where: { id: logId },
          data: {
            status: "DELIVERED",
            providerMessageId: info.messageId,
            deliveredAt: new Date(),
          },
        }).catch(() => {});
      }

      return {
        delivered: true,
        provider: "smtp",
        messageId: info.messageId,
        logId,
      };
    } catch (smtpErr: any) {
      console.error("[agreements-email] SMTP transport error:", smtpErr);
      const errMsg = smtpErr?.message || "SMTP error";
      if (logId) {
        await prisma.agreementEmailLog.update({
          where: { id: logId },
          data: {
            status: "FAILED",
            errorCode: smtpErr?.code || "SMTP_FAIL",
            errorMessage: errMsg,
          },
        }).catch(() => {});
      }
      return {
        delivered: false,
        provider: "smtp",
        error: errMsg,
        logId,
      };
    }
  }

  // 4. Neither succeeded or configured
  const failReason = !resendKey && !smtpHost
    ? "No transactional email provider configured. Please provide RESEND_API_KEY or SMTP credentials."
    : "Configured email providers rejected transmission. Check Resend domain verification or SMTP credentials.";

  if (logId) {
    await prisma.agreementEmailLog.update({
      where: { id: logId },
      data: {
        status: "FAILED",
        errorCode: "NO_VALID_PROVIDER",
        errorMessage: failReason,
      },
    }).catch(() => {});
  }

  return {
    delivered: false,
    provider: "none",
    error: failReason,
    logId,
  };
}
