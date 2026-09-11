import "server-only";
import { prisma } from "@/lib/db";
import { sendWhatsAppMessage } from "@/lib/notifications/whatsapp";
import { pickBirthdayTemplate, pickBirthdayCreative } from "./templates";
import { getTodaySpecial, todaySpecialTargets } from "./today-special";
import type { BirthdaySubject } from "./subjects";

const MAX_ATTEMPTS = 3;

export type BirthdaySendOutcome =
  | { status: "SENT"; logId: string }
  | { status: "SKIPPED"; reason: string; logId: string | null }
  | { status: "FAILED"; reason: string; logId: string }
  | { status: "DUPLICATE"; logId: string };

/**
 * One subject, one calendar year, one send — enforced by the
 * @@unique([subjectType, subjectId, year]) constraint on BirthdaySendLog,
 * the same "claim the row first" idempotency pattern as lib/email/dispatch.ts.
 *
 * `force` (admin "Force Send") bypasses the duplicate check by deleting any
 * existing row for this subject+year first — every force-send is still
 * logged, with triggerType "FORCE" recording that it happened.
 */
export async function sendBirthdayWish(
  subject: BirthdaySubject,
  options: { triggerType?: "AUTOMATIC" | "MANUAL" | "FORCE"; testPhone?: string } = {}
): Promise<BirthdaySendOutcome> {
  const year = new Date().getFullYear();
  const triggerType = options.triggerType ?? "AUTOMATIC";
  const isTest = Boolean(options.testPhone);

  if (!isTest && !subject.whatsappNumber) {
    const skipped = await prisma.birthdaySendLog
      .create({
        data: {
          subjectType: subject.subjectType,
          subjectId: subject.subjectId,
          subjectName: subject.name,
          year,
          category: subject.category,
          board: subject.board,
          status: "SKIPPED",
          failureReason: "NO_WHATSAPP_NUMBER",
          triggerType,
        },
      })
      .catch(() => null); // if even this collides on the unique key, something already recorded this subject/year — fine, nothing more to do
    return { status: "SKIPPED", reason: "NO_WHATSAPP_NUMBER", logId: skipped?.id ?? null };
  }

  let logId: string;
  if (triggerType === "FORCE" && !isTest) {
    await prisma.birthdaySendLog.deleteMany({
      where: { subjectType: subject.subjectType, subjectId: subject.subjectId, year },
    });
  }

  if (!isTest) {
    try {
      const created = await prisma.birthdaySendLog.create({
        data: {
          subjectType: subject.subjectType,
          subjectId: subject.subjectId,
          subjectName: subject.name,
          year,
          category: subject.category,
          board: subject.board,
          whatsappNumber: subject.whatsappNumber,
          status: "PROCESSING",
          triggerType,
        },
      });
      logId = created.id;
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") {
        const existing = await prisma.birthdaySendLog.findUnique({
          where: { subjectType_subjectId_year: { subjectType: subject.subjectType, subjectId: subject.subjectId, year } },
        });
        return { status: "DUPLICATE", logId: existing?.id ?? "" };
      }
      throw err;
    }
  } else {
    logId = "test";
  }

  try {
    const isStaff = subject.subjectType === "TEACHER";
    const { id: templateId, messageText } = await pickBirthdayTemplate(subject.category, subject.board, isStaff);
    const creative = await pickBirthdayCreative(subject.category, subject.subjectType, subject.subjectId);

    let body = messageText.replace(/\[Student Name\]|\{\{student_name\}\}|\{\{staff_name\}\}/gi, subject.name).replace(/\[Institute Name\]|\{\{institute_name\}\}/gi, "Atomic Pathshala");

    // Section 14: combine with Today Special when one is active and targets this subject.
    const special = await getTodaySpecial();
    let todaySpecialId: string | null = null;
    if (special && todaySpecialTargets(special, { class: undefined, targetExam: undefined, board: subject.board })) {
      todaySpecialId = special.id;
      body += `\n\n────────────\n⭐ TODAY'S SPECIAL\n\n${special.title}\n${special.content}\n────────────`;
    }

    if (creative?.imageUrl) {
      body += `\n\n${creative.imageUrl}`; // WhatsApp text API here — image URL appended as a link; a media-capable send is a follow-up once a real WhatsApp Business API is connected.
    }

    const result = await sendWithRetry(isTest ? options.testPhone! : subject.whatsappNumber!, body);

    if (!isTest) {
      await prisma.birthdaySendLog.update({
        where: { id: logId },
        data: {
          status: result.success ? "SENT" : "FAILED",
          templateId,
          creativeId: creative?.id ?? null,
          todaySpecialId,
          providerMessageId: result.id ?? null,
          failureReason: result.success ? null : "WHATSAPP_SEND_FAILED",
          retryCount: result.attempts - 1,
          sentAt: result.success ? new Date() : null,
        },
      });
    }

    return result.success
      ? { status: "SENT", logId }
      : { status: "FAILED", reason: "WHATSAPP_SEND_FAILED", logId };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "UNKNOWN";
    if (!isTest) {
      await prisma.birthdaySendLog
        .update({ where: { id: logId }, data: { status: "FAILED", failureReason: reason } })
        .catch(() => {});
    }
    console.error("[birthday] send threw:", err);
    return { status: "FAILED", reason, logId };
  }
}

async function sendWithRetry(
  phone: string,
  body: string
): Promise<{ success: boolean; id?: string; attempts: number }> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await sendWhatsAppMessage({ toPhone: phone, body });
    if (result.success) return { success: true, id: result.id, attempts: attempt };
    if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
  return { success: false, attempts: MAX_ATTEMPTS };
}
