import { prisma } from "@/lib/db";
import { WhatsAppMessageType } from "@prisma/client";
import { queueWhatsAppMessage } from "./engine";
import { sanitizeIndianPhoneNumber } from "./provider";
import { getWhatsAppSettings } from "./settings";
import { StudentTomorrowScheduleDigest } from "./types";

/**
 * Get start and end dates for tomorrow in Asia/Kolkata timezone
 */
export function getTomorrowKolkataBounds(referenceDate: Date = new Date()): {
  startOfTomorrow: Date;
  endOfTomorrow: Date;
  tomorrowDateFormatted: string;
  tomorrowDateKey: string;
} {
  // Convert referenceDate to IST string
  const istFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = istFormatter.formatToParts(referenceDate);
  const year = parseInt(parts.find((p) => p.type === "year")!.value, 10);
  const month = parseInt(parts.find((p) => p.type === "month")!.value, 10) - 1;
  const day = parseInt(parts.find((p) => p.type === "day")!.value, 10);

  // Tomorrow in IST (+1 day)
  const tomorrowIST = new Date(Date.UTC(year, month, day + 1));
  const tYear = tomorrowIST.getUTCFullYear();
  const tMonth = tomorrowIST.getUTCMonth();
  const tDay = tomorrowIST.getUTCDate();

  // IST is UTC+5:30 -> 00:00 IST is previous day 18:30 UTC
  const startOfTomorrow = new Date(Date.UTC(tYear, tMonth, tDay, 0, 0, 0) - 5.5 * 3600 * 1000);
  // 23:59:59.999 IST
  const endOfTomorrow = new Date(Date.UTC(tYear, tMonth, tDay, 23, 59, 59, 999) - 5.5 * 3600 * 1000);

  const displayFormatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const tomorrowDateFormatted = displayFormatter.format(startOfTomorrow);
  const tomorrowDateKey = `${tYear}-${String(tMonth + 1).padStart(2, "0")}-${String(tDay).padStart(2, "0")}`;

  return {
    startOfTomorrow,
    endOfTomorrow,
    tomorrowDateFormatted,
    tomorrowDateKey,
  };
}

/**
 * Generate and enqueue consolidated next-day class digests for all active students.
 */
export async function generateNextDayStudentDigests(referenceDate: Date = new Date()): Promise<{
  totalStudents: number;
  digestsQueued: number;
  dateStr: string;
}> {
  const settings = await getWhatsAppSettings();
  if (!settings.digestEnabled) {
    return { totalStudents: 0, digestsQueued: 0, dateStr: "DIGEST_DISABLED" };
  }

  const { startOfTomorrow, endOfTomorrow, tomorrowDateFormatted, tomorrowDateKey } =
    getTomorrowKolkataBounds(referenceDate);

  // 1. Fetch all classes scheduled for tomorrow across all batches
  const schedules = await prisma.batchSchedule.findMany({
    where: {
      startsAt: {
        gte: startOfTomorrow,
        lte: endOfTomorrow,
      },
      status: { in: ["SCHEDULED", "LIVE"] },
      isTest: false,
    },
    include: {
      batch: true,
      teacher: { include: { user: true } },
      chapter: true,
    },
    orderBy: { startsAt: "asc" },
  });

  if (schedules.length === 0) {
    return { totalStudents: 0, digestsQueued: 0, dateStr: tomorrowDateFormatted };
  }

  // 2. Map batch IDs to their schedules
  const batchSchedulesMap = new Map<string, typeof schedules>();
  for (const s of schedules) {
    const list = batchSchedulesMap.get(s.batchId) || [];
    list.push(s);
    batchSchedulesMap.set(s.batchId, list);
  }

  const relevantBatchIds = Array.from(batchSchedulesMap.keys());

  // 3. Fetch all active student enrollments in these batches
  const enrollments = await prisma.batchEnrollment.findMany({
    where: {
      batchId: { in: relevantBatchIds },
      status: "ACTIVE",
    },
    include: {
      student: {
        include: {
          user: true,
        },
      },
      batch: true,
    },
  });

  // 4. Group classes by student
  const studentDigestMap = new Map<string, StudentTomorrowScheduleDigest>();

  for (const enrollment of enrollments) {
    const student = enrollment.student;
    const studentUser = student.user;
    if (!studentUser.phone) continue;

    const { isValid, formattedE164 } = sanitizeIndianPhoneNumber(studentUser.phone);
    if (!isValid) continue;

    const batchSchedules = batchSchedulesMap.get(enrollment.batchId) || [];

    let digest = studentDigestMap.get(student.id);
    if (!digest) {
      digest = {
        studentId: student.id,
        studentName: studentUser.name || "Student",
        phone: formattedE164,
        dateStr: tomorrowDateFormatted,
        classes: [],
      };
      studentDigestMap.set(student.id, digest);
    }

    for (const s of batchSchedules) {
      // Prevent duplicate class entries if student is enrolled in overlapping tracks
      if (!digest.classes.some((c) => c.id === s.id)) {
        const durationMin =
          s.durationMinutes || Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / 60_000);
        digest.classes.push({
          id: s.id,
          title: s.title,
          subject: s.subject || "Academic",
          topic: s.topic || s.chapter?.title || s.title,
          teacherName: s.teacher?.user?.name || "Faculty",
          startsAt: s.startsAt,
          endsAt: s.endsAt,
          durationMinutes: durationMin,
          youtubeUrl: s.youtubeUrl,
          batchName: enrollment.batch.name,
        });
      }
    }
  }

  // Sort classes for each student chronologically
  for (const digest of Array.from(studentDigestMap.values())) {
    digest.classes.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }

  // 5. Build consolidated message and enqueue for each student
  let digestsQueued = 0;
  const timeFmt = (d: Date) =>
    d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });

  for (const digest of Array.from(studentDigestMap.values())) {
    if (digest.classes.length === 0) continue;

    let body = `*ATOMIC PATHSHALA*\n*Tomorrow's Class Schedule*\n\n📅 *${tomorrowDateFormatted}*\n\n`;

    digest.classes.forEach((c, index) => {
      const startTime = timeFmt(c.startsAt);
      const endTime = timeFmt(c.endsAt);
      body += `⏰ *${startTime} – ${endTime}* (${c.durationMinutes} min)\n`;
      body += `📚 *${c.subject}*\n`;
      body += `📖 *${c.topic}*\n`;
      body += `👨‍🏫 Teacher: ${c.teacherName}\n`;
      if (c.youtubeUrl) {
        body += `🔗 Join: ${c.youtubeUrl}\n`;
      }
      if (index < digest.classes.length - 1) {
        body += `-------------------------\n`;
      }
    });

    body += `\n_Please be ready 5 minutes before class starts. Happy learning!_\n\n_Team Atomic Pathshala_`;

    const idempotencyKey = `student:${digest.studentId}:digest:${tomorrowDateKey}`;

    await queueWhatsAppMessage({
      recipientPhone: digest.phone,
      recipientName: digest.studentName,
      messageType: WhatsAppMessageType.STUDENT_CLASS_DIGEST,
      bodyText: body,
      idempotencyKey,
      metadata: {
        studentId: digest.studentId,
        dateKey: tomorrowDateKey,
        classCount: digest.classes.length,
      },
    });

    digestsQueued++;
  }

  return {
    totalStudents: studentDigestMap.size,
    digestsQueued,
    dateStr: tomorrowDateFormatted,
  };
}
