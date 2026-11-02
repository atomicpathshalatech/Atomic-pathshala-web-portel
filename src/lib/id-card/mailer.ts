import "server-only";
import type { GlobalRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { dispatchEmail } from "@/lib/email/dispatch";
import { getAppBaseUrl } from "@/lib/email/app-url";
import { cardHtml, loadCard } from "./data";
import { idCardEmail, type IdCardEmailMode } from "./email";
import { openCardPrinter } from "./pdf";

type Kind = "STUDENT" | "TEAM";
const NON_TEAM = ["STUDENT", "PARENT", "GUEST"] as GlobalRole[];
/** Counted as done; FAILED / SKIPPED sends are tried again. */
const DONE = ["SENT", "DELIVERED", "SENDING", "QUEUED"] as const;

export type PendingIdCardEmail = { userId: string; name: string; email: string; mode: IdCardEmailMode; key: string };

/**
 * Who still needs an ID-card email: the card (with the PDF) once there is a
 * photo, or the "photo missing" note once while there isn't. Each is sent at
 * most once per person (EmailLog idempotency key), so the daily job, a
 * re-click of "Send" and a retry can never send twice. Someone who got the
 * photo note and then uploads a photo becomes due for the card.
 */
export async function pendingIdCardEmails(kind: Kind, opts: { registeredBefore?: Date } = {}): Promise<PendingIdCardEmail[]> {
  const createdAt = opts.registeredBefore ? { lte: opts.registeredBefore } : undefined;
  const people =
    kind === "STUDENT"
      ? (
          await prisma.student.findMany({
            where: { status: { not: "DROPPED" }, user: { status: "ACTIVE", ...(createdAt ? { createdAt } : {}) } },
            orderBy: { createdAt: "asc" },
            select: { userId: true, user: { select: { name: true, email: true, photoUrl: true } } },
          })
        ).map((s) => ({ id: s.userId, ...s.user }))
      : await prisma.user.findMany({
          where: { status: "ACTIVE", role: { name: { notIn: NON_TEAM } }, ...(createdAt ? { createdAt } : {}) },
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true, email: true, photoUrl: true },
        });

  const done = new Set(
    (
      await prisma.emailLog.findMany({
        where: { idempotencyKey: { startsWith: `idcard:` }, status: { in: [...DONE] } },
        select: { idempotencyKey: true },
      })
    ).map((r) => r.idempotencyKey)
  );

  const out: PendingIdCardEmail[] = [];
  for (const p of people) {
    if (!p.email || !p.email.includes("@")) continue;
    const mode: IdCardEmailMode = p.photoUrl ? "card" : "nophoto";
    const key = `idcard:${mode}:${kind}:${p.id}`;
    if (!done.has(key)) out.push({ userId: p.id, name: p.name, email: p.email, mode, key });
  }
  return out;
}

export type IdCardSendResult = { cards: number; reminders: number; failed: number; skipped: string[]; remaining: number };

/**
 * Sends the next batch of due ID-card emails, stopping at `limit` or the
 * deadline (serverless time limit). `skip`: people already found not ready
 * (e.g. a team member still waiting for HR details) — not tried again in
 * this run. Paced for the mail provider's rate limit.
 */
export async function sendIdCardEmails(
  kind: Kind,
  opts: { limit: number; deadlineMs: number; registeredBefore?: Date; skip?: string[] }
): Promise<IdCardSendResult> {
  const started = Date.now();
  const skipSet = new Set(opts.skip ?? []);
  const due = (await pendingIdCardEmails(kind, { registeredBefore: opts.registeredBefore })).filter((p) => !skipSet.has(p.userId));
  const baseUrl = getAppBaseUrl();
  const result: IdCardSendResult = { cards: 0, reminders: 0, failed: 0, skipped: [], remaining: 0 };
  let printer: Awaited<ReturnType<typeof openCardPrinter>> | null = null;
  let processed = 0;

  try {
    for (const p of due) {
      if (processed >= opts.limit || Date.now() - started > opts.deadlineMs) break;
      processed++;
      const mail = idCardEmail({ mode: p.mode, kind, name: p.name, baseUrl });
      let attachments: { filename: string; content: Buffer }[] | undefined;

      if (p.mode === "card") {
        const loaded = await loadCard(kind, p.userId);
        // Not ready (team details HR hasn't filled, revoked, not eligible, cards not set up): try another day.
        if (!loaded?.model || loaded.model.revoked) {
          result.skipped.push(p.userId);
          continue;
        }
        printer ??= await openCardPrinter();
        const pdf = await printer.render(cardHtml(loaded.model, "pdf"));
        const safe = p.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "card";
        attachments = [{ filename: `Atomic-Pathshala-ID-${safe}.pdf`, content: pdf }];
      }

      const sent = await dispatchEmail({
        idempotencyKey: p.key,
        to: p.email,
        recipientName: p.name,
        recipientUserId: p.userId,
        recipientType: kind === "TEAM" ? "STAFF" : "STUDENT",
        emailType: "OTHER",
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        attachments,
      });
      if (sent.outcome === "sent") {
        if (p.mode === "card") result.cards++;
        else result.reminders++;
      } else if (sent.outcome === "failed") {
        result.failed++;
      }
      // Resend allows ~2 requests per second.
      await new Promise((r) => setTimeout(r, 550));
    }
  } finally {
    await printer?.close();
  }

  result.remaining = Math.max(0, due.length - processed);
  return result;
}
