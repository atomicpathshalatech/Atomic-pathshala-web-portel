import { prisma } from "@/lib/db";
import { WhatsAppMessageType } from "@prisma/client";
import { queueWhatsAppMessage } from "./engine";
import { sanitizeIndianPhoneNumber } from "./provider";
import { getWhatsAppSettings } from "./settings";

/**
 * Scan for upcoming classes and enqueue teacher reminders based on admin setting (15 or 30 min).
 */
export async function processTeacherClassReminders(): Promise<{ remindersQueued: number }> {
  const settings = await getWhatsAppSettings();
  if (!settings.teacherReminderEnabled) {
    return { remindersQueued: 0 };
  }

  const windowMinutes = settings.teacherReminderMinutes || 30;
  const now = new Date();

  // Find classes starting between (now + windowMinutes - 5 min) and (now + windowMinutes + 5 min)
  const windowStart = new Date(now.getTime() + (windowMinutes - 5) * 60_000);
  const windowEnd = new Date(now.getTime() + (windowMinutes + 5) * 60_000);

  const schedules = await prisma.batchSchedule.findMany({
    where: {
      startsAt: {
        gte: windowStart,
        lte: windowEnd,
      },
      status: "SCHEDULED",
      isTest: false,
      teacherId: { not: null },
    },
    include: {
      teacher: { include: { user: true } },
      batch: true,
      chapter: true,
    },
  });

  let remindersQueued = 0;
  const timeFmt = (d: Date) =>
    d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });

  for (const s of schedules) {
    if (!s.teacher?.user?.phone) continue;

    const { isValid, formattedE164 } = sanitizeIndianPhoneNumber(s.teacher.user.phone);
    if (!isValid) continue;

    const durationMin =
      s.durationMinutes || Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / 60_000);
    const teacherName = s.teacher.user.name || "Educator";
    const classTitle = s.topic || s.chapter?.title || s.title;
    const startTimeStr = timeFmt(s.startsAt);

    let body = `*ATOMIC PATHSHALA — TEACHER CLASS REMINDER*\n\n`;
    body += `Dear ${teacherName},\n`;
    body += `Your class is starting in *${windowMinutes} minutes*.\n\n`;
    body += `📚 *Subject:* ${s.subject || "Academic"}\n`;
    body += `📖 *Topic:* ${classTitle}\n`;
    body += `👥 *Batch:* ${s.batch.name}\n`;
    body += `⏰ *Start Time:* ${startTimeStr} (${durationMin} min)\n`;
    if (s.youtubeUrl) {
      body += `🔗 *YouTube Link:* ${s.youtubeUrl}\n`;
    }
    body += `\nPlease launch your live classroom session and verify your audio/video setup.\n\n_Atomic Pathshala Operations_`;

    const idempotencyKey = `teacher:${s.teacher.id}:reminder_${windowMinutes}m:${s.id}`;

    await queueWhatsAppMessage({
      recipientPhone: formattedE164,
      recipientName: teacherName,
      messageType: WhatsAppMessageType.TEACHER_CLASS_REMINDER,
      bodyText: body,
      idempotencyKey,
      metadata: {
        scheduleId: s.id,
        teacherId: s.teacher.id,
        windowMinutes,
      },
    });

    remindersQueued++;
  }

  return { remindersQueued };
}

/**
 * Scan for upcoming doubt booking slots and enqueue 1-hour reminders to students and teachers.
 */
export async function processDoubtReminders(): Promise<{ remindersQueued: number }> {
  const settings = await getWhatsAppSettings();
  if (!settings.doubtReminderEnabled) {
    return { remindersQueued: 0 };
  }

  const windowMinutes = settings.doubtReminderMinutes || 60;
  const now = new Date();

  // Find bookings with slot starting in ~60 mins
  const windowStart = new Date(now.getTime() + (windowMinutes - 10) * 60_000);
  const windowEnd = new Date(now.getTime() + (windowMinutes + 5) * 60_000);

  const bookings = await prisma.doubtBooking.findMany({
    where: {
      status: "CONFIRMED",
      slot: {
        startTime: {
          gte: windowStart,
          lte: windowEnd,
        },
      },
    },
    include: {
      slot: true,
      student: { include: { user: true } },
      teacher: { include: { user: true } },
    },
  });

  let remindersQueued = 0;
  const timeFmt = (d: Date) =>
    d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });

  for (const b of bookings) {
    const startTimeStr = timeFmt(b.slot.startTime);
    const studentName = b.student.user.name || "Student";
    const teacherName = b.teacher.user.name || "Faculty";
    const topicStr = b.topic || "Academic Doubt";

    // 1. Student Reminder
    if (b.student.user.phone) {
      const { isValid, formattedE164 } = sanitizeIndianPhoneNumber(b.student.user.phone);
      if (isValid) {
        const studentBody = `*ATOMIC PATHSHALA — DOUBT SESSION REMINDER*\n\nDear ${studentName},\nYour 1-on-1 doubt session is starting in *1 hour* at *${startTimeStr}*.\n\n*Faculty:* ${teacherName}\n*Topic:* ${topicStr}\n\nPlease join your doubt desk on time with your questions ready.\n\n_Team Atomic Pathshala_`;

        await queueWhatsAppMessage({
          recipientPhone: formattedE164,
          recipientName: studentName,
          messageType: WhatsAppMessageType.DOUBT_REMINDER,
          bodyText: studentBody,
          idempotencyKey: `student:${b.studentId}:doubt_remind_${windowMinutes}m:${b.id}`,
          metadata: { bookingId: b.id },
        });
        remindersQueued++;
      }
    }

    // 2. Teacher Reminder
    if (b.teacher.user.phone) {
      const { isValid, formattedE164 } = sanitizeIndianPhoneNumber(b.teacher.user.phone);
      if (isValid) {
        const teacherBody = `*ATOMIC PATHSHALA — DOUBT SESSION REMINDER*\n\nDear ${teacherName},\nYou have a 1-on-1 doubt session starting in *1 hour* at *${startTimeStr}*.\n\n*Student:* ${studentName}\n*Topic:* ${topicStr}\n\nPlease check your faculty portal.\n\n_Team Atomic Pathshala_`;

        await queueWhatsAppMessage({
          recipientPhone: formattedE164,
          recipientName: teacherName,
          messageType: WhatsAppMessageType.DOUBT_REMINDER,
          bodyText: teacherBody,
          idempotencyKey: `teacher:${b.teacherId}:doubt_remind_${windowMinutes}m:${b.id}`,
          metadata: { bookingId: b.id },
        });
        remindersQueued++;
      }
    }
  }

  return { remindersQueued };
}
