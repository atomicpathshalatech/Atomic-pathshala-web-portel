import "server-only";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { sendSms } from "@/lib/sms";
import { queueWhatsAppMessage, processWhatsAppQueue } from "@/lib/whatsapp/engine";
import { sanitizeIndianPhoneNumber } from "@/lib/whatsapp/provider";
import { getWhatsAppSettings } from "@/lib/whatsapp/settings";
import { WhatsAppMessageType } from "@prisma/client";

export interface ClassScheduleItem {
  id: string;
  batchId: string;
  batchName: string;
  subject: string;
  chapterTitle: string;
  lectureTitle: string;
  teacherName: string;
  startsAt: Date;
  endsAt: Date;
  durationMinutes: number;
  appWatchUrl: string;
  youtubeUrl: string | null;
  notes?: string | null;
}

export interface StudentScheduleDigest {
  studentId: string;
  userId: string;
  studentName: string;
  email: string | null;
  phone: string | null;
  batchNames: string[];
  classes: ClassScheduleItem[];
  dateFormatted: string;
  dateKey: string;
  targetDayLabel: "Today" | "Tomorrow";
}

export interface ScheduleDispatchResult {
  dateStr: string;
  targetDayLabel: "Today" | "Tomorrow";
  totalClasses: number;
  totalStudents: number;
  emailsSent: number;
  emailsFailed: number;
  whatsAppQueued: number;
  smsSent: number;
  smsFailed: number;
  inAppCreated: number;
  details: Array<{
    studentName: string;
    email: string | null;
    phone: string | null;
    classCount: number;
    emailStatus: "SENT" | "FAILED" | "SKIPPED";
    whatsAppStatus: "QUEUED" | "SKIPPED" | "FAILED";
    smsStatus: "SENT" | "FAILED" | "SKIPPED";
  }>;
}

/**
 * Get start and end dates for a target day ("tomorrow" | "today") in Asia/Kolkata timezone
 */
export function getKolkataDateBounds(
  target: "tomorrow" | "today" | Date = "tomorrow",
  referenceDate: Date = new Date()
): {
  startOfDay: Date;
  endOfDay: Date;
  dateFormatted: string;
  dateKey: string;
  dayName: string;
  targetDayLabel: "Today" | "Tomorrow";
  // Backwards compatibility aliases
  startOfTomorrow: Date;
  endOfTomorrow: Date;
  tomorrowDateFormatted: string;
  tomorrowDateKey: string;
} {
  const istFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
  });

  const parts = istFormatter.formatToParts(referenceDate);
  const year = parseInt(parts.find((p) => p.type === "year")!.value, 10);
  const month = parseInt(parts.find((p) => p.type === "month")!.value, 10) - 1;
  const day = parseInt(parts.find((p) => p.type === "day")!.value, 10);

  const dayOffset = target === "today" ? 0 : target === "tomorrow" ? 1 : 0;
  const targetIST = target instanceof Date ? target : new Date(Date.UTC(year, month, day + dayOffset));

  const tYear = targetIST.getUTCFullYear();
  const tMonth = targetIST.getUTCMonth();
  const tDay = targetIST.getUTCDate();

  // IST is UTC+5:30 -> 00:00:00 IST is previous day 18:30:00 UTC
  const startOfDay = new Date(Date.UTC(tYear, tMonth, tDay, 0, 0, 0) - 5.5 * 3600 * 1000);
  // 23:59:59.999 IST
  const endOfDay = new Date(Date.UTC(tYear, tMonth, tDay, 23, 59, 59, 999) - 5.5 * 3600 * 1000);

  const displayFormatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const dateFormatted = displayFormatter.format(startOfDay);
  const dateKey = `${tYear}-${String(tMonth + 1).padStart(2, "0")}-${String(tDay).padStart(2, "0")}`;

  const dayFormatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
  });
  const dayName = dayFormatter.format(startOfDay);
  const targetDayLabel: "Today" | "Tomorrow" = target === "today" ? "Today" : "Tomorrow";

  return {
    startOfDay,
    endOfDay,
    dateFormatted,
    dateKey,
    dayName,
    targetDayLabel,
    startOfTomorrow: startOfDay,
    endOfTomorrow: endOfDay,
    tomorrowDateFormatted: dateFormatted,
    tomorrowDateKey: dateKey,
  };
}

export function getTomorrowKolkataBounds(referenceDate: Date = new Date()) {
  return getKolkataDateBounds("tomorrow", referenceDate);
}

/**
 * Format IST Time e.g. "09:00 AM"
 */
export function formatTimeIST(date: Date): string {
  return date.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Clean & normalize YouTube URL
 */
export function normalizeYouTubeUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  // If it's a 11-char video ID (e.g. dQw4w9WgXcQ)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return `https://www.youtube.com/watch?v=${trimmed}`;
  }
  return `https://${trimmed}`;
}

/**
 * Build consolidated student digests for a given date range
 */
export async function buildTomorrowStudentDigests(options?: {
  referenceDate?: Date;
  targetDay?: "tomorrow" | "today";
  filterBatchId?: string;
}): Promise<{
  digests: StudentScheduleDigest[];
  schedules: any[];
  dateFormatted: string;
  dateKey: string;
  targetDayLabel: "Today" | "Tomorrow";
}> {
  const target = options?.targetDay || "tomorrow";
  const { startOfDay, endOfDay, dateFormatted, dateKey, targetDayLabel } =
    getKolkataDateBounds(target, options?.referenceDate);

  const baseUrl = (
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://ap.atomicpathshala.in"
  ).replace(/\/$/, "");

  // 1. Fetch all schedules for target date
  const schedules = await prisma.batchSchedule.findMany({
    where: {
      startsAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
      status: { in: ["SCHEDULED", "LIVE"] },
      isTest: false,
      ...(options?.filterBatchId ? { batchId: options.filterBatchId } : {}),
    },
    include: {
      batch: true,
      teacher: { include: { user: { select: { name: true, phone: true, email: true } } } },
      chapter: true,
      lecture: true,
      liveWhiteboardSession: { select: { youtubeVideoId: true } },
    },
    orderBy: { startsAt: "asc" },
  });

  if (schedules.length === 0) {
    return {
      digests: [],
      schedules: [],
      dateFormatted,
      dateKey,
      targetDayLabel,
    };
  }

  // 2. Map batch IDs to their schedules
  const batchSchedulesMap = new Map<string, typeof schedules>();
  for (const s of schedules) {
    const list = batchSchedulesMap.get(s.batchId) || [];
    list.push(s);
    batchSchedulesMap.set(s.batchId, list);
  }

  const relevantBatchIds = Array.from(batchSchedulesMap.keys());

  // 3. Fetch active enrollments for these batches
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

  // 4. Group by student
  const studentDigestMap = new Map<string, StudentScheduleDigest>();

  for (const enrollment of enrollments) {
    const student = enrollment.student;
    const studentUser = student.user;

    const batchSchedules = batchSchedulesMap.get(enrollment.batchId) || [];
    if (batchSchedules.length === 0) continue;

    let digest = studentDigestMap.get(student.id);
    if (!digest) {
      digest = {
        studentId: student.id,
        userId: studentUser.id,
        studentName: studentUser.name || "Student",
        email: studentUser.email?.trim() || null,
        phone: studentUser.phone?.trim() || student.emergencyContact?.trim() || null,
        batchNames: [enrollment.batch.name],
        classes: [],
        dateFormatted,
        dateKey,
        targetDayLabel,
      };
      studentDigestMap.set(student.id, digest);
    } else {
      if (!digest.batchNames.includes(enrollment.batch.name)) {
        digest.batchNames.push(enrollment.batch.name);
      }
    }

    for (const s of batchSchedules) {
      if (!digest.classes.some((c) => c.id === s.id)) {
        const durationMin =
          s.durationMinutes || Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / 60_000);

        const ytUrl =
          normalizeYouTubeUrl(s.youtubeUrl) ||
          (s.liveWhiteboardSession?.youtubeVideoId
            ? `https://www.youtube.com/watch?v=${s.liveWhiteboardSession.youtubeVideoId}`
            : null);

        const chapterName = s.chapter?.title?.trim() || s.topic?.trim() || "General Academic";
        const lectureName = s.lecture?.title?.trim() || s.title?.trim() || "Scheduled Lecture";
        const subjectName = s.subject?.trim() || "Academic";
        const facultyName =
          s.teacher?.displayName?.trim() || s.teacher?.user?.name?.trim() || "Atomic Faculty";

        digest.classes.push({
          id: s.id,
          batchId: s.batchId,
          batchName: enrollment.batch.name,
          subject: subjectName,
          chapterTitle: chapterName,
          lectureTitle: lectureName,
          teacherName: facultyName,
          startsAt: s.startsAt,
          endsAt: s.endsAt,
          durationMinutes: durationMin,
          appWatchUrl: `${baseUrl}/watch/${s.id}`,
          youtubeUrl: ytUrl,
          notes: s.notes,
        });
      }
    }
  }

  // Sort classes chronologically for each student
  const digests = Array.from(studentDigestMap.values());
  for (const d of digests) {
    d.classes.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }

  return {
    digests,
    schedules,
    dateFormatted,
    dateKey,
    targetDayLabel,
  };
}

/**
 * Generate Structured WhatsApp Message Text
 */
export function generateScheduleWhatsAppMessage(digest: StudentScheduleDigest): string {
  const dayHeader = digest.targetDayLabel === "Today" ? "Today's Class Schedule" : "Tomorrow's Class Schedule";

  let msg = `🔔 *ATOMIC PATHSHALA*\n`;
  msg += `*${dayHeader}*\n\n`;
  msg += `📅 *${digest.dateFormatted}*\n`;
  msg += `👤 Dear *${digest.studentName}*,\n`;
  msg += `Here is your complete class schedule for ${digest.targetDayLabel.toLowerCase()}:\n\n`;

  digest.classes.forEach((c, index) => {
    const startTime = formatTimeIST(c.startsAt);
    const endTime = formatTimeIST(c.endsAt);

    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📚 *Subject:* *${c.subject.toUpperCase()}*\n`;
    msg += `📖 *Chapter:* ${c.chapterTitle}\n`;
    msg += `🎬 *Lecture:* ${c.lectureTitle}\n`;
    msg += `👨‍🏫 *Faculty:* ${c.teacherName}\n`;
    msg += `⏰ *Timing:* *${startTime} – ${endTime}* (${c.durationMinutes} min)\n\n`;

    msg += `📱 *Watch on Atomic App / Web:*\n${c.appWatchUrl}\n`;

    if (c.youtubeUrl) {
      msg += `\n🔴 *Watch on YouTube:*\n${c.youtubeUrl}\n`;
    }

    if (index === digest.classes.length - 1) {
      msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    }
  });

  msg += `💡 *Important Guidelines:*\n`;
  msg += `• Please join 5 minutes before the class begins.\n`;
  msg += `• Keep your notes, NCERT textbook, and formula sheets handy.\n`;
  msg += `• You can ask your live doubts directly during the session.\n\n`;
  msg += `Wish you great learning!\n`;
  msg += `— *Team Atomic Pathshala*\n`;
  msg += `🌐 https://ap.atomicpathshala.in`;

  return msg;
}

/**
 * Generate Responsive HTML Email
 */
export function generateScheduleEmailHtml(digest: StudentScheduleDigest): string {
  const subjectColors: Record<string, { bg: string; text: string; border: string }> = {
    chemistry: { bg: "#ecfdf5", text: "#065f46", border: "#10b981" },
    physics: { bg: "#eff6ff", text: "#1e40af", border: "#3b82f6" },
    biology: { bg: "#f5f3ff", text: "#5b21b6", border: "#8b5cf6" },
    botany: { bg: "#f0fdf4", text: "#166534", border: "#22c55e" },
    zoology: { bg: "#faf5ff", text: "#6b21a8", border: "#a855f7" },
    mathematics: { bg: "#fffbeb", text: "#92400e", border: "#f59e0b" },
  };

  const dayHeader = digest.targetDayLabel === "Today" ? "Today's Live Classes" : "Tomorrow's Live Classes";

  const classCardsHtml = digest.classes
    .map((c) => {
      const startTime = formatTimeIST(c.startsAt);
      const endTime = formatTimeIST(c.endsAt);
      const subKey = c.subject.toLowerCase();
      const theme = subjectColors[subKey] || { bg: "#f8fafc", text: "#1e293b", border: "#64748b" };

      const youtubeButton = c.youtubeUrl
        ? `
        <a href="${c.youtubeUrl}" target="_blank" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:8px 16px;border-radius:6px;margin-left:8px;margin-top:8px;">
          🔴 Watch on YouTube
        </a>`
        : "";

      return `
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-left:5px solid ${theme.border};border-radius:8px;padding:18px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <span style="background:${theme.bg};color:${theme.text};font-weight:700;font-size:12px;padding:4px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:0.5px;">
            ${c.subject}
          </span>
          <span style="font-size:13px;font-weight:600;color:#0f172a;background:#f1f5f9;padding:4px 8px;border-radius:6px;">
            ⏰ ${startTime} – ${endTime} (${c.durationMinutes} min)
          </span>
        </div>

        <h3 style="margin:6px 0 4px 0;font-size:16px;color:#0f172a;font-weight:700;">
          ${c.lectureTitle}
        </h3>
        <p style="margin:0 0 10px 0;font-size:14px;color:#475569;">
          📖 <strong style="color:#1e293b;">Chapter:</strong> ${c.chapterTitle}
        </p>

        <div style="font-size:13px;color:#64748b;margin-bottom:14px;">
          👨‍🏫 <strong style="color:#334155;">Faculty:</strong> ${c.teacherName} • <span style="color:#64748b;">${c.batchName}</span>
        </div>

        <div style="margin-top:12px;border-top:1px dashed #e2e8f0;padding-top:12px;">
          <a href="${c.appWatchUrl}" target="_blank" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:8px 18px;border-radius:6px;margin-top:8px;">
            📱 Join on Atomic Portal / App
          </a>
          ${youtubeButton}
        </div>
      </div>
      `;
    })
    .join("");

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${dayHeader} — Atomic Pathshala</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:24px 0;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -2px rgba(0,0,0,0.1);">
            
            <!-- Header Banner -->
            <tr>
              <td style="background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%);padding:28px 24px;text-align:center;">
                <h1 style="color:#ffffff;margin:0 0 6px 0;font-size:22px;font-weight:800;letter-spacing:0.5px;">
                  ATOMIC PATHSHALA
                </h1>
                <p style="color:#94a3b8;margin:0;font-size:13px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">
                  ${dayHeader} & Lecture Schedule
                </p>
                <div style="margin-top:14px;display:inline-block;background:#059669;color:#ffffff;padding:5px 14px;border-radius:20px;font-size:13px;font-weight:700;">
                  📅 ${digest.dateFormatted}
                </div>
              </td>
            </tr>

            <!-- Body Content -->
            <tr>
              <td style="padding:24px 24px 12px 24px;">
                <p style="font-size:16px;color:#0f172a;margin:0 0 12px 0;">
                  Hello <strong>${digest.studentName}</strong>,
                </p>
                <p style="font-size:14px;color:#475569;margin:0 0 20px 0;line-height:1.5;">
                  Your classes for ${digest.targetDayLabel.toLowerCase()} have been scheduled. Please find the complete subject-wise details and direct joining links below:
                </p>

                <!-- Class Cards -->
                ${classCardsHtml}

                <!-- Important Instructions Box -->
                <div style="background:#f1f5f9;border-left:4px solid #0284c7;border-radius:6px;padding:14px 16px;margin:20px 0;font-size:13px;color:#334155;line-height:1.5;">
                  <strong>💡 Pro Tips:</strong>
                  <ul style="margin:8px 0 0 0;padding-left:18px;">
                    <li>Be ready 5 minutes before scheduled start time.</li>
                    <li>Keep your NCERT textbook, notebooks, and pens ready.</li>
                    <li>Click the link above to watch seamlessly on your phone, tablet or laptop.</li>
                  </ul>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#f8fafc;padding:20px 24px;text-align:center;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
                <p style="margin:0 0 6px 0;font-weight:600;color:#334155;">
                  Atomic Pathshala — Structured Preparation for NEET & JEE
                </p>
                <p style="margin:0 0 8px 0;">
                  For any support or query, contact academic coordinator or visit 
                  <a href="https://ap.atomicpathshala.in" style="color:#059669;text-decoration:none;font-weight:600;">ap.atomicpathshala.in</a>
                </p>
                <p style="margin:0;font-size:11px;color:#94a3b8;">
                  © ${new Date().getFullYear()} Atomic Pathshala. All rights reserved.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}

/**
 * Generate Plain Text Email Fallback
 */
export function generateScheduleEmailText(digest: StudentScheduleDigest): string {
  const dayHeader = digest.targetDayLabel === "Today" ? "TODAY'S CLASS SCHEDULE" : "TOMORROW'S CLASS SCHEDULE";
  let text = `ATOMIC PATHSHALA - ${dayHeader}\n`;
  text += `Date: ${digest.dateFormatted}\n`;
  text += `Hello ${digest.studentName},\n\n`;
  text += `Here is your schedule for ${digest.targetDayLabel.toLowerCase()}:\n\n`;

  digest.classes.forEach((c, index) => {
    const startTime = formatTimeIST(c.startsAt);
    const endTime = formatTimeIST(c.endsAt);
    text += `${index + 1}. [${c.subject}] ${c.lectureTitle}\n`;
    text += `   Chapter: ${c.chapterTitle}\n`;
    text += `   Faculty: ${c.teacherName}\n`;
    text += `   Time: ${startTime} - ${endTime} (${c.durationMinutes} min)\n`;
    text += `   Portal Watch Link: ${c.appWatchUrl}\n`;
    if (c.youtubeUrl) {
      text += `   YouTube Watch Link: ${c.youtubeUrl}\n`;
    }
    text += `\n`;
  });

  text += `Please join 5 minutes before class.\n\nTeam Atomic Pathshala\nhttps://ap.atomicpathshala.in`;
  return text;
}

/**
 * Generate SMS Text Message
 */
export function generateScheduleSmsText(digest: StudentScheduleDigest): string {
  const classSummary = digest.classes
    .map((c) => `${c.subject} at ${formatTimeIST(c.startsAt)}`)
    .join(", ");

  const firstLink = digest.classes[0]?.appWatchUrl || "https://ap.atomicpathshala.in/dashboard";
  const dayLabel = digest.targetDayLabel;

  return `Atomic Pathshala: ${dayLabel}'s Schedule (${digest.dateFormatted}) for ${digest.studentName}: ${classSummary}. Watch live: ${firstLink} - Atomic Pathshala`;
}

/**
 * The Master Class Schedule Dispatcher
 * Dispatches via Email, WhatsApp, and SMS Fallback.
 */
export async function sendTomorrowClassSchedules(options?: {
  referenceDate?: Date;
  targetDay?: "tomorrow" | "today";
  filterBatchId?: string;
  force?: boolean;
  channels?: {
    email?: boolean;
    whatsapp?: boolean;
    sms?: boolean;
  };
}): Promise<ScheduleDispatchResult> {
  const emailEnabled = options?.channels?.email !== false;
  const whatsappEnabled = options?.channels?.whatsapp !== false;
  const smsEnabled = options?.channels?.sms !== false;

  const { digests, schedules, dateFormatted, dateKey, targetDayLabel } = await buildTomorrowStudentDigests({
    referenceDate: options?.referenceDate,
    targetDay: options?.targetDay,
    filterBatchId: options?.filterBatchId,
  });

  const result: ScheduleDispatchResult = {
    dateStr: dateFormatted,
    targetDayLabel,
    totalClasses: schedules.length,
    totalStudents: digests.length,
    emailsSent: 0,
    emailsFailed: 0,
    whatsAppQueued: 0,
    smsSent: 0,
    smsFailed: 0,
    inAppCreated: 0,
    details: [],
  };

  if (digests.length === 0) {
    return result;
  }

  for (const digest of digests) {
    let emailStatus: "SENT" | "FAILED" | "SKIPPED" = "SKIPPED";
    let whatsAppStatus: "QUEUED" | "SKIPPED" | "FAILED" = "SKIPPED";
    let smsStatus: "SENT" | "FAILED" | "SKIPPED" = "SKIPPED";

    // 1. In-App Notification (Always created so students see it on their portal/app)
    try {
      await prisma.notification.create({
        data: {
          userId: digest.userId,
          title: `📅 ${digest.targetDayLabel}'s Class Schedule (${digest.dateFormatted})`,
          body: `You have ${digest.classes.length} live class(es) scheduled for ${digest.targetDayLabel.toLowerCase()}. Check your subjects and join on time!`,
          channel: "IN_APP",
        },
      });
      result.inAppCreated++;
    } catch {
      // Non-fatal
    }

    // 2. EMAIL CHANNEL (If mail is available, send rich email to student)
    if (emailEnabled && digest.email && digest.email.includes("@")) {
      const emailHtml = generateScheduleEmailHtml(digest);
      const emailText = generateScheduleEmailText(digest);
      const emailSubject = `📅 ${digest.targetDayLabel}'s Class Schedule — Atomic Pathshala (${digest.dateFormatted})`;
      const idempotencyKey = `class-schedule:email:${digest.studentId}:${digest.dateKey}`;

      try {
        let alreadySent = false;
        if (!options?.force) {
          const existing = await prisma.emailLog.findUnique({
            where: { idempotencyKey },
            select: { status: true },
          });
          if (existing && existing.status === "SENT") {
            alreadySent = true;
          }
        }

        if (!alreadySent) {
          const sendRes = await sendMail({
            to: digest.email,
            subject: emailSubject,
            html: emailHtml,
            text: emailText,
          });

          await prisma.emailLog
            .upsert({
              where: { idempotencyKey },
              update: {
                status: sendRes.delivered ? "SENT" : "FAILED",
                failureReason: sendRes.reason || null,
                sentAt: sendRes.delivered ? new Date() : null,
              },
              create: {
                idempotencyKey,
                recipientUserId: digest.userId,
                recipientName: digest.studentName,
                recipientEmail: digest.email,
                recipientType: "STUDENT",
                emailType: "ANNOUNCEMENT",
                subject: emailSubject,
                status: sendRes.delivered ? "SENT" : "FAILED",
                failureReason: sendRes.reason || null,
                sentAt: sendRes.delivered ? new Date() : null,
              },
            })
            .catch((e) => console.warn("[EMAIL_LOG_UPSERT_WARN]", e));

          if (sendRes.delivered) {
            emailStatus = "SENT";
            result.emailsSent++;
          } else {
            emailStatus = "FAILED";
            result.emailsFailed++;
          }
        } else {
          emailStatus = "SENT";
          result.emailsSent++;
        }
      } catch (err: any) {
        console.error(`[EMAIL_DISPATCH_ERR] to ${digest.email}:`, err);
        emailStatus = "FAILED";
        result.emailsFailed++;
      }
    }

    // 3. WHATSAPP CHANNEL (If WhatsApp number is available, send WhatsApp message)
    let whatsAppSuccess = false;
    if (whatsappEnabled && digest.phone) {
      const { isValid, formattedE164 } = sanitizeIndianPhoneNumber(digest.phone);
      if (isValid) {
        const waText = generateScheduleWhatsAppMessage(digest);
        const waIdempotencyKey = `class-schedule:whatsapp:${digest.studentId}:${digest.dateKey}`;

        try {
          const queueRes = await queueWhatsAppMessage({
            recipientPhone: formattedE164,
            recipientName: digest.studentName,
            messageType: WhatsAppMessageType.STUDENT_CLASS_DIGEST,
            bodyText: waText,
            idempotencyKey: waIdempotencyKey,
            metadata: {
              studentId: digest.studentId,
              dateKey: digest.dateKey,
              classCount: digest.classes.length,
            },
          });

          if (queueRes?.queueItem) {
            whatsAppStatus = "QUEUED";
            whatsAppSuccess = true;
            result.whatsAppQueued++;
          }
        } catch (err: any) {
          console.error(`[WHATSAPP_QUEUE_ERR] for ${digest.phone}:`, err);
          whatsAppStatus = "FAILED";
        }
      }
    }

    // 4. SMS / TEXT MESSAGE CHANNEL (Fallback)
    if (smsEnabled && digest.phone && (!whatsAppSuccess || whatsAppStatus === "FAILED")) {
      const smsText = generateScheduleSmsText(digest);
      try {
        const smsRes = await sendSms({
          to: digest.phone,
          text: smsText,
        });

        if (smsRes.delivered) {
          smsStatus = "SENT";
          result.smsSent++;
        } else {
          smsStatus = "FAILED";
          result.smsFailed++;
        }
      } catch (err: any) {
        console.error(`[SMS_DISPATCH_ERR] to ${digest.phone}:`, err);
        smsStatus = "FAILED";
        result.smsFailed++;
      }
    }

    result.details.push({
      studentName: digest.studentName,
      email: digest.email,
      phone: digest.phone,
      classCount: digest.classes.length,
      emailStatus,
      whatsAppStatus,
      smsStatus,
    });
  }

  // Trigger worker to process any newly queued WhatsApp messages
  if (result.whatsAppQueued > 0) {
    try {
      await processWhatsAppQueue(50);
    } catch (e) {
      console.warn("[PROCESS_WHATSAPP_QUEUE_TRIGGER_WARN]", e);
    }
  }

  return result;
}
