import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { sendMail } from "@/lib/mail";
import { sendSms } from "@/lib/sms";
import { queueWhatsAppMessage, processWhatsAppQueue } from "@/lib/whatsapp/engine";
import { sanitizeIndianPhoneNumber } from "@/lib/whatsapp/provider";
import { WhatsAppMessageType } from "@prisma/client";
import {
  sendTomorrowClassSchedules,
  buildTomorrowStudentDigests,
  generateScheduleEmailHtml,
  generateScheduleEmailText,
  generateScheduleWhatsAppMessage,
  generateScheduleSmsText,
  StudentScheduleDigest,
} from "@/lib/notifications/class-schedule-notifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const canManage =
    (await hasPermission(session.user.id, PERMISSIONS.WHATSAPP_MANAGE)) ||
    (await hasPermission(session.user.id, PERMISSIONS.STUDENT_UPDATE));

  if (!canManage) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "send_all"; // "send_all" | "send_batch" | "send_test"
    const batchId = body.batchId || undefined;
    const targetDay = (body.targetDay as "tomorrow" | "today") || "tomorrow";
    const force = Boolean(body.force);
    const dateStr = body.date;
    const channels = body.channels || { email: true, whatsapp: true, sms: true };

    const referenceDate = dateStr ? new Date(dateStr) : new Date();

    // 1. ACTION: SEND TEST TO CURRENT STAFF MEMBER
    if (action === "send_test") {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, name: true, email: true, phone: true },
      });

      if (!user) {
        return NextResponse.json({ message: "User not found" }, { status: 404 });
      }

      const { digests, schedules, dateFormatted, dateKey, targetDayLabel } =
        await buildTomorrowStudentDigests({
          referenceDate,
          targetDay,
          filterBatchId: batchId,
        });

      // Use actual schedule or mock preview if 0 scheduled
      let testClasses = digests[0]?.classes || [];
      if (testClasses.length === 0) {
        testClasses = [
          {
            id: "test-schedule-1",
            batchId: "batch-demo",
            batchName: "Selection Pro Batch",
            subject: "Chemistry",
            chapterTitle: "Chemical Bonding & Molecular Structure",
            lectureTitle: "Lecture 02 — Hybridisation & VSEPR Theory",
            teacherName: "Dr. Firoz Ali",
            startsAt: new Date(Date.now() + 10 * 3600 * 1000),
            endsAt: new Date(Date.now() + 11.5 * 3600 * 1000),
            durationMinutes: 90,
            appWatchUrl: "https://ap.atomicpathshala.in/watch/demo",
            youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          },
          {
            id: "test-schedule-2",
            batchId: "batch-demo",
            batchName: "Selection Pro Batch",
            subject: "Biology",
            chapterTitle: "Cell Biology & Division",
            lectureTitle: "Lecture 05 — Mitosis & Meiosis Detailed",
            teacherName: "Sonu Bhaiya",
            startsAt: new Date(Date.now() + 12 * 3600 * 1000),
            endsAt: new Date(Date.now() + 13.5 * 3600 * 1000),
            durationMinutes: 90,
            appWatchUrl: "https://ap.atomicpathshala.in/watch/demo-2",
            youtubeUrl: null,
          },
        ];
      }

      const testDigest: StudentScheduleDigest = {
        studentId: `test-staff-${user.id}`,
        userId: user.id,
        studentName: user.name || "Faculty Member",
        email: user.email,
        phone: user.phone,
        batchNames: ["Preview Test Track"],
        classes: testClasses,
        dateFormatted,
        dateKey,
        targetDayLabel,
      };

      const testResults: { email?: any; whatsapp?: any; sms?: any } = {};

      // Test Email
      if (channels.email !== false && user.email) {
        const html = generateScheduleEmailHtml(testDigest);
        const text = generateScheduleEmailText(testDigest);
        const emailRes = await sendMail({
          to: user.email,
          subject: `[TEST] ${targetDayLabel}'s Class Schedule (${dateFormatted})`,
          html,
          text,
        });
        testResults.email = emailRes;
      }

      // Test WhatsApp
      if (channels.whatsapp !== false && user.phone) {
        const { isValid, formattedE164 } = sanitizeIndianPhoneNumber(user.phone);
        if (isValid) {
          const waText = generateScheduleWhatsAppMessage(testDigest);
          const qRes = await queueWhatsAppMessage({
            recipientPhone: formattedE164,
            recipientName: user.name,
            messageType: WhatsAppMessageType.STUDENT_CLASS_DIGEST,
            bodyText: waText,
            idempotencyKey: `test-schedule-wa:${user.id}:${Date.now()}`,
          });
          await processWhatsAppQueue(5).catch(() => {});
          testResults.whatsapp = { queued: true, queueItem: qRes.queueItem };
        } else {
          testResults.whatsapp = { error: "Invalid phone format" };
        }
      }

      // Test SMS
      if (channels.sms === true && user.phone) {
        const smsText = generateScheduleSmsText(testDigest);
        const smsRes = await sendSms({
          to: user.phone,
          text: smsText,
        });
        testResults.sms = smsRes;
      }

      return NextResponse.json({
        success: true,
        action: "send_test",
        recipient: { name: user.name, email: user.email, phone: user.phone },
        results: testResults,
      });
    }

    // 2. ACTION: SEND ALL OR BATCH
    const result = await sendTomorrowClassSchedules({
      referenceDate,
      targetDay,
      filterBatchId: batchId,
      force,
      channels,
    });

    return NextResponse.json({
      success: true,
      action,
      result,
    });
  } catch (err: any) {
    console.error("[SCHEDULE_DIGEST_TRIGGER_ERR]", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to trigger schedule digest" },
      { status: 500 }
    );
  }
}
