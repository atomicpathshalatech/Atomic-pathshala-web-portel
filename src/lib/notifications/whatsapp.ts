import "server-only";
import { prisma } from "@/lib/db";
import type { NotificationChannel } from "@prisma/client";

export type WhatsAppPayload = {
  toPhone: string;
  templateName?: string;
  body: string;
  mediaUrl?: string;
};

/**
 * Dispatch message via WhatsApp Business API / Webhook.
 * Configurable via WHATSAPP_API_URL / WHATSAPP_API_TOKEN or logs gracefully.
 */
export async function sendWhatsAppMessage(payload: WhatsAppPayload): Promise<{ success: boolean; id?: string }> {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const token = process.env.WHATSAPP_API_TOKEN;

  // Clean phone number (strip whitespace, ensure country code)
  const phone = payload.toPhone.replace(/\D/g, "");
  const formattedPhone = phone.startsWith("91") ? phone : `91${phone}`;

  if (!apiUrl || !token) {
    // In dev / unconfigured environments, log dispatch cleanly for audit
    console.info(`[WhatsApp Dispatch Simulation] To: +${formattedPhone} | Message: ${payload.body}`);
    return { success: true, id: `mock_wa_${Date.now()}` };
  }

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: formattedPhone,
        type: "text",
        text: { body: payload.body },
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      console.error("[WhatsApp API Error]", json);
      return { success: false };
    }

    return { success: true, id: json.messages?.[0]?.id };
  } catch (error) {
    console.error("[WhatsApp Dispatch Exception]", error);
    return { success: false };
  }
}

export type DispatchOptions = {
  userId: string;
  title: string;
  body: string;
  channel?: NotificationChannel | "ALL_CHANNELS";
};

/**
 * Unified notification dispatcher delivering to In-App, WhatsApp, and Email.
 */
export async function dispatchNotification({
  userId,
  title,
  body,
  channel = "IN_APP",
}: DispatchOptions) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, phone: true, email: true, name: true },
  });

  if (!user) return;

  const channelsToSend: NotificationChannel[] =
    channel === "ALL_CHANNELS"
      ? ["IN_APP", "WHATSAPP", "EMAIL"]
      : [channel as NotificationChannel];

  // 1. In-App Notification Record
  if (channelsToSend.includes("IN_APP")) {
    await prisma.notification.create({
      data: {
        userId: user.id,
        title,
        body,
        channel: "IN_APP",
      },
    }).catch(() => {});
  }

  // 2. WhatsApp Dispatch
  if (channelsToSend.includes("WHATSAPP") && user.phone) {
    await sendWhatsAppMessage({
      toPhone: user.phone,
      body: `🔔 *${title}*\n\n${body}\n\n— *Atomic Pathshala*`,
    });
  }

  // 3. Email Record / Dispatch
  if (channelsToSend.includes("EMAIL") && user.email) {
    // In-app log for email channel
    await prisma.notification.create({
      data: {
        userId: user.id,
        title,
        body,
        channel: "EMAIL",
      },
    }).catch(() => {});
  }
}

/**
 * Automated Trigger: Class Starting in 15 Minutes
 */
export async function triggerUpcomingClassAlert(scheduleId: string) {
  const schedule = await prisma.batchSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      batch: {
        include: {
          enrollments: {
            where: { status: "ACTIVE" },
            include: { student: { select: { userId: true } } },
          },
        },
      },
      teacher: { include: { user: { select: { name: true } } } },
    },
  });

  if (!schedule) return;

  const title = `Class Starting in 15 Min: ${schedule.title}`;
  const body = `Your live class with ${schedule.teacher?.user.name || "Faculty"} is about to start at ${schedule.startsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Join your classroom now!`;

  for (const enrollment of schedule.batch.enrollments) {
    await dispatchNotification({
      userId: enrollment.student.userId,
      title,
      body,
      channel: "ALL_CHANNELS",
    });
  }
}

/**
 * Automated Trigger: Test Results Announced
 */
export async function triggerTestResultAlert(attemptId: string) {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      test: true,
      student: { select: { userId: true } },
    },
  });

  if (!attempt || !attempt.score) return;

  const title = `Test Result Declared: ${attempt.test?.name ?? "Test"}`;
  const body = `Your score is ready! You scored ${attempt.score} marks. Check your detailed subject performance and analysis on Atomic Pathshala.`;

  await dispatchNotification({
    userId: attempt.student.userId,
    title,
    body,
    channel: "ALL_CHANNELS",
  });
}
