import { prisma } from "@/lib/db";
import { MetaParsedMessage } from "./parser";
import { sanitizeIndianPhoneNumber } from "./provider";
import { WhatsAppInboundStatus } from "@prisma/client";

export type DetectedWhatsAppIntent =
  | "CLASS_LINK"
  | "RECORDING"
  | "NOTES"
  | "DPP"
  | "TESTS"
  | "FEES_ENROLLMENT"
  | "LOGIN_SUPPORT"
  | "DOUBT_SUPPORT"
  | "FACULTY_QUERY"
  | "HUMAN_ESCALATION"
  | "GENERAL_SUPPORT";

/**
 * Keyword & regex classifier for educational / student support intents.
 * Extensible for future AI / LLM routing.
 */
export function classifyWhatsAppIntent(bodyText?: string, buttonPayload?: string): DetectedWhatsAppIntent {
  const text = `${bodyText || ""} ${buttonPayload || ""}`.toLowerCase().trim();

  if (!text) return "GENERAL_SUPPORT";

  if (/(human|agent|representative|call me|talk to|manager|escalate|urgent|contact number)/i.test(text)) {
    return "HUMAN_ESCALATION";
  }

  if (/(live class|class link|join class|today class|tomorrow class|schedule|timing|zoom|livekit|when is class)/i.test(text)) {
    return "CLASS_LINK";
  }

  if (/(recording|recorded|replay|missed class|video lecture|watch class|past lecture)/i.test(text)) {
    return "RECORDING";
  }

  if (/(notes|pdf|handout|formula sheet|study material|chapter notes|ncert notes)/i.test(text)) {
    return "NOTES";
  }

  if (/(dpp|daily practice|homework|dpp solution|practice sheet)/i.test(text)) {
    return "DPP";
  }

  if (/(test|exam|mock test|quiz|test series|score|rank|answer key|result)/i.test(text)) {
    return "TESTS";
  }

  if (/(fee|fees|payment|pay|razorpay|enroll|buy batch|coupon|discount|price|admission|receipt)/i.test(text)) {
    return "FEES_ENROLLMENT";
  }

  if (/(login|otp|password|cannot login|app not working|error|crash|phone number change)/i.test(text)) {
    return "LOGIN_SUPPORT";
  }

  if (/(doubt|question|explain|solution help|math doubt|physics doubt|chemistry doubt|bio doubt)/i.test(text)) {
    return "DOUBT_SUPPORT";
  }

  if (/(teacher|faculty|sir|maam|tutor|mentor)/i.test(text)) {
    return "FACULTY_QUERY";
  }

  return "GENERAL_SUPPORT";
}

/**
 * Ingests and processes an incoming WhatsApp message.
 * Maps student, contact, intent, and records inbound audit trail.
 */
export async function processInboundWhatsAppMessage(msg: MetaParsedMessage) {
  const { isValid, cleanPhone, formattedE164 } = sanitizeIndianPhoneNumber(msg.fromPhone);
  const normalizedPhone = isValid ? formattedE164 : msg.fromPhone;

  // 1. Identify or link Student by phone number
  let linkedStudentId: string | null = null;
  if (isValid) {
    const student = await prisma.student.findFirst({
      where: {
        user: {
          phone: { contains: cleanPhone },
        },
      },
      select: { id: true, userId: true, user: { select: { name: true, phone: true } } },
    }).catch(() => null);

    if (student) {
      linkedStudentId = student.id;
    }
  }

  // 2. Identify or upsert WhatsAppContact
  let linkedContactId: string | null = null;
  try {
    const contact = await prisma.whatsAppContact.upsert({
      where: { phone: normalizedPhone },
      update: {
        name: msg.senderName || undefined,
        cleanPhone: cleanPhone || undefined,
        studentId: linkedStudentId || undefined,
      },
      create: {
        phone: normalizedPhone,
        cleanPhone: cleanPhone || normalizedPhone,
        name: msg.senderName || "WhatsApp User",
        source: "STUDENT_SYNC",
        studentId: linkedStudentId,
      },
      select: { id: true },
    });
    linkedContactId = contact.id;
  } catch (err) {
    console.warn("[WHATSAPP_CONTACT_LINK_WARN]", err);
  }

  // 3. Classify intent
  const detectedIntent = classifyWhatsAppIntent(msg.bodyText, msg.buttonPayload);

  // 4. Record Inbound Message
  const inboundRecord = await prisma.whatsAppInboundMessage.create({
    data: {
      wamId: msg.wamId,
      fromPhone: normalizedPhone,
      senderName: msg.senderName || null,
      messageType: msg.type,
      bodyText: msg.bodyText || null,
      contextWamId: msg.contextWamId || null,
      mediaUrl: msg.mediaUrl || null,
      rawPayload: msg.raw,
      status: WhatsAppInboundStatus.RECEIVED,
      detectedIntent,
      contactId: linkedContactId,
      studentId: linkedStudentId,
      processedAt: new Date(),
    },
  });

  return {
    inboundRecord,
    detectedIntent,
    linkedStudentId,
    linkedContactId,
  };
}
