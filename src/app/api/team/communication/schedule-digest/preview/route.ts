import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getWhatsAppSettings } from "@/lib/whatsapp/settings";
import {
  buildTomorrowStudentDigests,
  generateScheduleEmailHtml,
  generateScheduleWhatsAppMessage,
  generateScheduleSmsText,
} from "@/lib/notifications/class-schedule-notifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const canRead =
    (await hasPermission(session.user.id, PERMISSIONS.WHATSAPP_READ)) ||
    (await hasPermission(session.user.id, PERMISSIONS.STUDENT_READ_ANY));

  if (!canRead) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId") || undefined;
  const targetDay = (searchParams.get("targetDay") as "tomorrow" | "today") || "tomorrow";
  const dateStr = searchParams.get("date");

  const referenceDate = dateStr ? new Date(dateStr) : new Date();

  try {
    const [scheduleData, waSettings] = await Promise.all([
      buildTomorrowStudentDigests({
        referenceDate,
        targetDay,
        filterBatchId: batchId,
      }),
      getWhatsAppSettings(),
    ]);

    const { digests, schedules, dateFormatted, dateKey, targetDayLabel } = scheduleData;
    const sampleDigest = digests[0] || null;

    let sampleWhatsApp = "";
    let sampleEmailHtml = "";
    let sampleSms = "";

    if (sampleDigest) {
      sampleWhatsApp = generateScheduleWhatsAppMessage(sampleDigest);
      sampleEmailHtml = generateScheduleEmailHtml(sampleDigest);
      sampleSms = generateScheduleSmsText(sampleDigest);
    }

    const emailRecipientsCount = digests.filter((d) => d.email && d.email.includes("@")).length;
    const phoneRecipientsCount = digests.filter((d) => Boolean(d.phone)).length;

    // Check channel health
    const channelStatus = {
      email: {
        configured: Boolean(process.env.RESEND_API_KEY),
        from: process.env.MAIL_FROM || "Atomic Pathshala <noreply@atomicpathshala.in>",
      },
      whatsapp: {
        configured: Boolean(waSettings.apiKey),
        provider: waSettings.provider || "INTERAKT",
      },
      sms: {
        configured: Boolean(process.env.MSG91_AUTHKEY || process.env.MSG91_WIDGET_AUTHKEY || process.env.TWILIO_ACCOUNT_SID),
      },
    };

    return NextResponse.json({
      success: true,
      data: {
        dateFormatted,
        dateKey,
        targetDayLabel,
        totalClasses: schedules.length,
        totalStudents: digests.length,
        emailRecipientsCount,
        phoneRecipientsCount,
        channelStatus,
        schedules: schedules.map((s) => ({
          id: s.id,
          title: s.title,
          subject: s.subject,
          batchName: s.batch?.name,
          chapterTitle: s.chapter?.title || s.topic,
          lectureTitle: s.lecture?.title || s.title,
          teacherName: s.teacher?.displayName || s.teacher?.user?.name,
          startsAt: s.startsAt,
          endsAt: s.endsAt,
          youtubeUrl: s.youtubeUrl,
        })),
        sampleDigest,
        sampleWhatsApp,
        sampleEmailHtml,
        sampleSms,
      },
    });
  } catch (err: any) {
    console.error("[SCHEDULE_DIGEST_PREVIEW_ERR]", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to load preview" },
      { status: 500 }
    );
  }
}
