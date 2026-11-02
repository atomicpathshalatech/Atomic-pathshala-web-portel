import "server-only";
import { randomBytes } from "crypto";
import type { GlobalRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { dispatchEmail } from "@/lib/email/dispatch";
import { getAppBaseUrl } from "@/lib/email/app-url";
import { uploadFile } from "@/lib/storage";
import { sendWhatsAppMessage, sanitizeIndianPhoneNumber } from "@/lib/whatsapp/provider";
import { cardHtml, loadCard } from "./data";
import { idCardEmail, idCardWhatsApp, type IdCardEmailMode } from "./email";
import { openCardPrinter } from "./pdf";

type Kind = "STUDENT" | "TEAM";
export type IdCardChannel = "email" | "whatsapp";
const NON_TEAM = ["STUDENT", "PARENT", "GUEST"] as GlobalRole[];
/** Counted as done; failed / skipped sends are tried again. */
const EMAIL_DONE = ["SENT", "DELIVERED", "SENDING", "QUEUED"] as const;
// SKIPPED = the contact replied STOP; never message them again.
const WA_DONE = ["SENT", "DELIVERED", "READ", "PROCESSING", "SKIPPED"] as const;

/** Approved WhatsApp templates for ID cards (DOCUMENT header + body {{1}} name, {{2}} link), when set up. */
export function idCardWhatsAppTemplates() {
  return {
    card: process.env.WHATSAPP_IDCARD_TEMPLATE?.trim() || null,
    nophoto: process.env.WHATSAPP_IDCARD_PHOTO_TEMPLATE?.trim() || null,
  };
}

export type PendingIdCard = { userId: string; name: string; to: string; mode: IdCardEmailMode; key: string };

/**
 * Who still needs an ID card on this channel: the card once there is a
 * photo, or the "photo missing" note once while there isn't. Each is sent at
 * most once per person per channel (EmailLog / WhatsApp queue idempotency
 * key), so the daily job, a re-click of "Send" and a retry never send twice.
 * Someone who got the photo note and then uploads a photo becomes due for
 * the card.
 */
export async function pendingIdCards(kind: Kind, channel: IdCardChannel, opts: { registeredBefore?: Date } = {}): Promise<PendingIdCard[]> {
  const createdAt = opts.registeredBefore ? { lte: opts.registeredBefore } : undefined;
  const people =
    kind === "STUDENT"
      ? (
          await prisma.student.findMany({
            where: { status: { not: "DROPPED" }, user: { status: "ACTIVE", ...(createdAt ? { createdAt } : {}) } },
            orderBy: { createdAt: "asc" },
            select: { userId: true, user: { select: { name: true, email: true, phone: true, photoUrl: true } } },
          })
        ).map((s) => ({ id: s.userId, ...s.user }))
      : await prisma.user.findMany({
          where: { status: "ACTIVE", role: { name: { notIn: NON_TEAM } }, ...(createdAt ? { createdAt } : {}) },
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true, email: true, phone: true, photoUrl: true },
        });

  const prefix = channel === "email" ? "idcard:" : "idcard-wa:";
  const done = new Set(
    channel === "email"
      ? (
          await prisma.emailLog.findMany({
            where: { idempotencyKey: { startsWith: prefix }, status: { in: [...EMAIL_DONE] } },
            select: { idempotencyKey: true },
          })
        ).map((r) => r.idempotencyKey)
      : (
          await prisma.whatsAppMessageQueue.findMany({
            where: { idempotencyKey: { startsWith: prefix }, status: { in: [...WA_DONE] } },
            select: { idempotencyKey: true },
          })
        ).map((r) => r.idempotencyKey)
  );

  const out: PendingIdCard[] = [];
  for (const p of people) {
    let to: string | null = null;
    if (channel === "email") to = p.email && p.email.includes("@") ? p.email : null;
    else {
      const ph = sanitizeIndianPhoneNumber(p.phone ?? "");
      to = ph.isValid ? ph.formattedE164 : null;
    }
    if (!to) continue;
    const mode: IdCardEmailMode = p.photoUrl ? "card" : "nophoto";
    const key = `${prefix}${mode}:${kind}:${p.id}`;
    if (!done.has(key)) out.push({ userId: p.id, name: p.name, to, mode, key });
  }
  return out;
}

/** Backwards-compatible name for the email channel. */
export const pendingIdCardEmails = (kind: Kind, opts: { registeredBefore?: Date } = {}) => pendingIdCards(kind, "email", opts);

export type IdCardSendResult = { cards: number; reminders: number; failed: number; skipped: string[]; remaining: number; lastError?: string };

/** One WhatsApp send, logged in the WhatsApp queue table under its idempotency key (status PROCESSING → SENT / FAILED). */
async function sendOneWhatsApp(
  p: PendingIdCard,
  msg: { text: string; params: Record<string, string> },
  template: string | null,
  document?: { url: string; filename: string }
): Promise<{ ok: boolean; error?: string }> {
  const optedOut = await prisma.whatsAppContact
    .findUnique({ where: { phone: p.to }, select: { status: true } })
    .then((c) => c?.status === "OPTED_OUT")
    .catch(() => false);
  const row = await prisma.whatsAppMessageQueue.upsert({
    where: { idempotencyKey: p.key },
    create: {
      recipientPhone: p.to,
      recipientName: p.name,
      messageType: "CUSTOM",
      templateName: template,
      templateData: template ? msg.params : undefined,
      bodyText: msg.text,
      idempotencyKey: p.key,
      status: optedOut ? "SKIPPED" : "PROCESSING",
      attempts: 1,
      metadata: { purpose: "ID_CARD", mode: p.mode, userId: p.userId, ...(document ? { document: document.filename } : {}) },
    },
    update: { status: optedOut ? "SKIPPED" : "PROCESSING", attempts: { increment: 1 } },
  });
  if (optedOut) return { ok: false, error: "Opted out of WhatsApp (STOP)" };

  const res = await sendWhatsAppMessage({
    to: p.to,
    recipientName: p.name,
    templateName: template ?? undefined,
    templateParams: template ? msg.params : undefined,
    bodyText: msg.text,
    document,
    idempotencyKey: p.key,
  });
  await prisma.whatsAppMessageQueue.update({
    where: { id: row.id },
    data: res.success
      ? { status: "SENT", sentAt: new Date(), errorMessage: null, providerResponse: res.rawResponse ?? undefined }
      : { status: "FAILED", failedAt: new Date(), errorMessage: res.error ?? "Send failed", providerResponse: res.rawResponse ?? undefined },
  });
  return { ok: res.success, error: res.error };
}

/**
 * Sends the next batch of due ID cards on one channel, stopping at `limit`
 * or the deadline (serverless time limit). `skip`: people already found not
 * ready in this run (e.g. a team member still waiting for HR details).
 * Email: the PDF is attached. WhatsApp: the PDF is put on storage under a
 * random, unguessable name and sent as a document.
 */
export async function sendIdCards(
  kind: Kind,
  channel: IdCardChannel,
  opts: { limit: number; deadlineMs: number; registeredBefore?: Date; skip?: string[] }
): Promise<IdCardSendResult> {
  const started = Date.now();
  const skipSet = new Set(opts.skip ?? []);
  const due = (await pendingIdCards(kind, channel, { registeredBefore: opts.registeredBefore })).filter((p) => !skipSet.has(p.userId));
  const baseUrl = getAppBaseUrl();
  const templates = idCardWhatsAppTemplates();
  const result: IdCardSendResult = { cards: 0, reminders: 0, failed: 0, skipped: [], remaining: 0 };
  let printer: Awaited<ReturnType<typeof openCardPrinter>> | null = null;
  let processed = 0;

  try {
    for (const p of due) {
      if (processed >= opts.limit || Date.now() - started > opts.deadlineMs) break;
      processed++;
      let pdf: { filename: string; content: Buffer } | null = null;

      if (p.mode === "card") {
        const loaded = await loadCard(kind, p.userId);
        // Not ready (team details HR hasn't filled, revoked, not eligible, cards not set up): try another day.
        if (!loaded?.model || loaded.model.revoked) {
          result.skipped.push(p.userId);
          continue;
        }
        printer ??= await openCardPrinter();
        const safe = p.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "card";
        pdf = { filename: `Atomic-Pathshala-ID-${safe}.pdf`, content: await printer.render(cardHtml(loaded.model, "pdf")) };
      }

      let ok: boolean;
      if (channel === "email") {
        const mail = idCardEmail({ mode: p.mode, kind, name: p.name, baseUrl });
        const sent = await dispatchEmail({
          idempotencyKey: p.key,
          to: p.to,
          recipientName: p.name,
          recipientUserId: p.userId,
          recipientType: kind === "TEAM" ? "STAFF" : "STUDENT",
          emailType: "OTHER",
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          attachments: pdf ? [pdf] : undefined,
        });
        if (sent.outcome === "duplicate") continue;
        ok = sent.outcome === "sent";
        if (!ok && sent.outcome === "failed") result.lastError = sent.reason;
        // Resend allows ~2 requests per second.
        await new Promise((r) => setTimeout(r, 550));
      } else {
        let document: { url: string; filename: string } | undefined;
        if (pdf) {
          const url = await uploadFile({ key: `id-cards/wa/${randomBytes(16).toString("hex")}.pdf`, body: pdf.content, contentType: "application/pdf" });
          document = { url, filename: pdf.filename };
        }
        const res = await sendOneWhatsApp(p, idCardWhatsApp({ mode: p.mode, kind, name: p.name, baseUrl }), p.mode === "card" ? templates.card : templates.nophoto, document);
        ok = res.ok;
        if (!ok) result.lastError = res.error;
        await new Promise((r) => setTimeout(r, 300));
      }

      if (ok) {
        if (p.mode === "card") result.cards++;
        else result.reminders++;
      } else {
        result.failed++;
      }
    }
  } finally {
    await printer?.close();
  }

  result.remaining = Math.max(0, due.length - processed);
  return result;
}

/** Backwards-compatible name for the email channel. */
export const sendIdCardEmails = (kind: Kind, opts: { limit: number; deadlineMs: number; registeredBefore?: Date; skip?: string[] }) =>
  sendIdCards(kind, "email", opts);
