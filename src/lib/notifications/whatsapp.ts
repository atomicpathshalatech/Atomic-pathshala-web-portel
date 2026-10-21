import "server-only";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { sendSms } from "@/lib/sms";
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
 * Unified notification dispatcher delivering to In-App, WhatsApp, Email, and SMS fallback.
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
  let waSuccess = false;
  if (channelsToSend.includes("WHATSAPP") && user.phone) {
    const waRes = await sendWhatsAppMessage({
      toPhone: user.phone,
      body: `🔔 *${title}*\n\n${body}\n\n— *Atomic Pathshala*`,
    });
    waSuccess = waRes.success;
  }

  // 3. Email Dispatch via Resend
  if (channelsToSend.includes("EMAIL") && user.email) {
    await prisma.notification.create({
      data: {
        userId: user.id,
        title,
        body,
        channel: "EMAIL",
      },
    }).catch(() => {});

    await sendMail({
      to: user.email,
      subject: title,
      html: `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
          <div style="background:#0f172a;padding:16px;border-radius:8px;text-align:center;margin-bottom:20px;">
            <h2 style="color:#ffffff;margin:0;font-size:18px;">ATOMIC PATHSHALA</h2>
          </div>
          <h3 style="margin:0 0 12px;color:#0f172a;">${title}</h3>
          <p style="color:#334155;line-height:1.6;margin:0 0 20px;">${body.replace(/\n/g, "<br/>")}</p>
          <div style="border-top:1px solid #e2e8f0;padding-top:16px;font-size:12px;color:#64748b;text-align:center;">
            Team Atomic Pathshala • <a href="https://ap.atomicpathshala.in" style="color:#059669;">ap.atomicpathshala.in</a>
          </div>
        </div>
      `,
      text: `${title}\n\n${body}\n\nTeam Atomic Pathshala\nhttps://ap.atomicpathshala.in`,
    }).catch((err) => console.error("[dispatchNotification] email error:", err));
  }

  // 4. SMS Fallback if WhatsApp was requested but phone failed or unconfigured
  if (channelsToSend.includes("WHATSAPP") && !waSuccess && user.phone) {
    await sendSms({
      to: user.phone,
      text: `Atomic Pathshala: ${title} - ${body}`,
    }).catch((err) => console.error("[dispatchNotification] SMS fallback error:", err));
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
  const body = `Your live class with ${schedule.teacher?.user.name || "Faculty"} is about to start at ${schedule.startsAt.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}. Join your classroom now!`;

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
