import { prisma } from "@/lib/db";
import { WhatsAppMessageType, WhatsAppQueueStatus } from "@prisma/client";
import { sendWhatsAppMessage, sanitizeIndianPhoneNumber } from "./provider";
import { getWhatsAppSettings } from "./settings";

export interface QueueMessageOptions {
  recipientPhone: string;
  recipientName?: string | null;
  messageType: WhatsAppMessageType;
  templateName?: string | null;
  templateData?: Record<string, any> | null;
  bodyText: string;
  idempotencyKey: string;
  scheduledFor?: Date;
  metadata?: Record<string, any> | null;
}

/**
 * Enqueue a message with strict idempotency.
 * If a message with the same idempotency key already exists, returns the existing record.
 */
export async function queueWhatsAppMessage(options: QueueMessageOptions) {
  const { isValid, cleanPhone, formattedE164 } = sanitizeIndianPhoneNumber(options.recipientPhone);
  const targetPhone = isValid ? formattedE164 : options.recipientPhone;

  try {
    const existing = await prisma.whatsAppMessageQueue.findUnique({
      where: { idempotencyKey: options.idempotencyKey },
    });

    if (existing) {
      return { queueItem: existing, isNew: false };
    }

    const queueItem = await prisma.whatsAppMessageQueue.create({
      data: {
        recipientPhone: targetPhone,
        recipientName: options.recipientName || null,
        messageType: options.messageType,
        templateName: options.templateName || null,
        templateData: options.templateData || undefined,
        bodyText: options.bodyText,
        idempotencyKey: options.idempotencyKey,
        scheduledFor: options.scheduledFor || new Date(),
        status: WhatsAppQueueStatus.PENDING,
        metadata: options.metadata || undefined,
      },
    });

    // Also auto-upsert into WhatsAppContact for analytics & campaign mapping
    if (isValid) {
      await prisma.whatsAppContact.upsert({
        where: { phone: targetPhone },
        update: {
          cleanPhone,
          name: options.recipientName || undefined,
        },
        create: {
          phone: targetPhone,
          cleanPhone,
          name: options.recipientName || "Contact",
          source: "STUDENT_SYNC",
        },
      }).catch((e) => console.warn("[WHATSAPP_CONTACT_UPSERT_WARN]", e));
    }

    return { queueItem, isNew: true };
  } catch (error: any) {
    // Catch unique constraint race condition
    if (error?.code === "P2002") {
      const existing = await prisma.whatsAppMessageQueue.findUnique({
        where: { idempotencyKey: options.idempotencyKey },
      });
      return { queueItem: existing, isNew: false };
    }
    throw error;
  }
}

/**
 * Background worker to dispatch pending messages from WhatsApp queue.
 */
export async function processWhatsAppQueue(batchSize: number = 25) {
  const now = new Date();

  // Find pending or retryable failed messages
  const items = await prisma.whatsAppMessageQueue.findMany({
    where: {
      status: { in: [WhatsAppQueueStatus.PENDING, WhatsAppQueueStatus.PROCESSING] },
      scheduledFor: { lte: now },
      attempts: { lt: 3 },
    },
    take: batchSize,
    orderBy: { scheduledFor: "asc" },
  });

  if (items.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  let succeeded = 0;
  let failed = 0;

  for (const item of items) {
    // Atomically claim the item
    const claim = await prisma.whatsAppMessageQueue.updateMany({
      where: { id: item.id, status: item.status },
      data: { status: WhatsAppQueueStatus.PROCESSING, attempts: { increment: 1 } },
    });

    if (claim.count === 0) continue;

    try {
      const result = await sendWhatsAppMessage({
        to: item.recipientPhone,
        recipientName: item.recipientName || undefined,
        templateName: item.templateName || undefined,
        templateParams: item.templateData as any,
        bodyText: item.bodyText,
        idempotencyKey: item.idempotencyKey,
        metadata: item.metadata as any,
      });

      if (result.success) {
        await prisma.whatsAppMessageQueue.update({
          where: { id: item.id },
          data: {
            status: WhatsAppQueueStatus.SENT,
            sentAt: new Date(),
            providerResponse: result.rawResponse || undefined,
            errorMessage: null,
          },
        });
        succeeded++;
      } else {
        const isFinalAttempt = item.attempts + 1 >= item.maxAttempts;
        await prisma.whatsAppMessageQueue.update({
          where: { id: item.id },
          data: {
            status: isFinalAttempt ? WhatsAppQueueStatus.FAILED : WhatsAppQueueStatus.PENDING,
            failedAt: new Date(),
            errorMessage: result.error || "Unknown dispatch failure",
            providerResponse: result.rawResponse || undefined,
            scheduledFor: new Date(Date.now() + (item.attempts + 1) * 2 * 60_000), // exponential retry
          },
        });
        failed++;
      }
    } catch (err: any) {
      await prisma.whatsAppMessageQueue.update({
        where: { id: item.id },
        data: {
          status: WhatsAppQueueStatus.FAILED,
          failedAt: new Date(),
          errorMessage: err.message || "Queue processor exception",
        },
      });
      failed++;
    }
  }

  return { processed: items.length, succeeded, failed };
}

/**
 * Event Trigger: Reschedule Notification to enrolled students & assigned teacher
 */
export async function triggerClassRescheduledWhatsApp(
  scheduleId: string,
  oldStartsAt: Date,
  _oldEndsAt: Date
) {
  const settings = await getWhatsAppSettings();
  if (!settings.rescheduleAlertEnabled) return;

  const schedule = await prisma.batchSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      batch: {
        include: {
          enrollments: {
            where: { status: "ACTIVE" },
            include: { student: { include: { user: true } } },
          },
        },
      },
      teacher: { include: { user: true } },
    },
  });

  if (!schedule) return;

  const dateFmt = (d: Date) =>
    d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });
  const timeFmt = (d: Date) =>
    d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });

  const oldTimeStr = `${dateFmt(oldStartsAt)} at ${timeFmt(oldStartsAt)}`;
  const newTimeStr = `${dateFmt(schedule.startsAt)} at ${timeFmt(schedule.startsAt)}`;
  const teacherName = schedule.teacher?.user?.name || "Faculty";
  const classTitle = schedule.topic || schedule.title;

  const studentMessage = `*ATOMIC PATHSHALA — CLASS RESCHEDULED*\n\nDear Student,\nYour live class has been rescheduled.\n\n*Class:* ${classTitle}\n*Subject:* ${schedule.subject || "General"}\n*Teacher:* ${teacherName}\n*Old Time:* ${oldTimeStr}\n*New Time:* ${newTimeStr}\n*Batch:* ${schedule.batch.name}\n${schedule.youtubeUrl ? `*Join Link:* ${schedule.youtubeUrl}\n` : ""}\nPlease join 5 minutes prior to start time.\n\n_Team Atomic Pathshala_`;

  // 1. Queue message for all active students in batch
  for (const enrollment of schedule.batch.enrollments) {
    const studentUser = enrollment.student.user;
    if (!studentUser.phone) continue;

    const { isValid } = sanitizeIndianPhoneNumber(studentUser.phone);
    if (!isValid) continue;

    await queueWhatsAppMessage({
      recipientPhone: studentUser.phone,
      recipientName: studentUser.name,
      messageType: WhatsAppMessageType.CLASS_RESCHEDULED,
      bodyText: studentMessage,
      idempotencyKey: `student:${enrollment.studentId}:rescheduled:${schedule.id}:${schedule.startsAt.getTime()}`,
      metadata: { scheduleId: schedule.id, batchId: schedule.batchId },
    });
  }

  // 2. Queue message for Teacher
  if (schedule.teacher?.user?.phone) {
    const teacherMessage = `*ATOMIC PATHSHALA — CLASS RESCHEDULED*\n\nDear ${teacherName},\nYour class has been rescheduled:\n\n*Class:* ${classTitle}\n*Batch:* ${schedule.batch.name}\n*Old Time:* ${oldTimeStr}\n*New Time:* ${newTimeStr}\n${schedule.youtubeUrl ? `*YouTube Link:* ${schedule.youtubeUrl}\n` : ""}\nPlease ensure your teaching setup is ready.`;

    await queueWhatsAppMessage({
      recipientPhone: schedule.teacher.user.phone,
      recipientName: teacherName,
      messageType: WhatsAppMessageType.CLASS_RESCHEDULED,
      bodyText: teacherMessage,
      idempotencyKey: `teacher:${schedule.teacher.id}:rescheduled:${schedule.id}:${schedule.startsAt.getTime()}`,
      metadata: { scheduleId: schedule.id, teacherId: schedule.teacher.id },
    });
  }
}

/**
 * Event Trigger: Class Cancellation notification to enrolled students
 */
export async function triggerClassCancelledWhatsApp(scheduleId: string) {
  const settings = await getWhatsAppSettings();
  if (!settings.cancelAlertEnabled) return;

  const schedule = await prisma.batchSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      batch: {
        include: {
          enrollments: {
            where: { status: "ACTIVE" },
            include: { student: { include: { user: true } } },
          },
        },
      },
      teacher: { include: { user: true } },
    },
  });

  if (!schedule) return;

  const dateFmt = (d: Date) =>
    d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });
  const timeFmt = (d: Date) =>
    d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });

  const scheduledTimeStr = `${dateFmt(schedule.startsAt)} at ${timeFmt(schedule.startsAt)}`;
  const teacherName = schedule.teacher?.user?.name || "Faculty";
  const classTitle = schedule.topic || schedule.title;

  const message = `*ATOMIC PATHSHALA — CLASS CANCELLED*\n\nDear Student,\nYour scheduled class has been cancelled.\n\n*Class:* ${classTitle}\n*Subject:* ${schedule.subject || "General"}\n*Teacher:* ${teacherName}\n*Scheduled Time:* ${scheduledTimeStr}\n*Batch:* ${schedule.batch.name}\n\nWe apologize for the inconvenience. Revised timetable will be updated soon.\n\n_Team Atomic Pathshala_`;

  for (const enrollment of schedule.batch.enrollments) {
    const studentUser = enrollment.student.user;
    if (!studentUser.phone) continue;

    const { isValid } = sanitizeIndianPhoneNumber(studentUser.phone);
    if (!isValid) continue;

    await queueWhatsAppMessage({
      recipientPhone: studentUser.phone,
      recipientName: studentUser.name,
      messageType: WhatsAppMessageType.CLASS_CANCELLED,
      bodyText: message,
      idempotencyKey: `student:${enrollment.studentId}:cancelled:${schedule.id}`,
      metadata: { scheduleId: schedule.id, batchId: schedule.batchId },
    });
  }
}

/**
 * Event Trigger: Doubt Booking confirmation to student & teacher
 */
export async function triggerDoubtBookingWhatsApp(bookingId: string) {
  const settings = await getWhatsAppSettings();
  if (!settings.doubtConfirmationEnabled) return;

  const booking = await prisma.doubtBooking.findUnique({
    where: { id: bookingId },
    include: {
      slot: true,
      student: { include: { user: true } },
      teacher: { include: { user: true } },
    },
  });

  if (!booking) return;

  const dateFmt = (d: Date) =>
    d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });
  const timeFmt = (d: Date) =>
    d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });

  const slotTimeStr = `${dateFmt(booking.slot.startTime)} at ${timeFmt(booking.slot.startTime)}`;
  const studentName = booking.student.user.name || "Student";
  const teacherName = booking.teacher.user.name || "Faculty";

  // 1. Student Confirmation
  if (booking.student.user.phone) {
    const studentMsg = `*ATOMIC PATHSHALA — DOUBT SESSION CONFIRMED*\n\nDear ${studentName},\nYour 1-on-1 doubt session is confirmed.\n\n*Faculty:* ${teacherName}\n*Date & Time:* ${slotTimeStr}\n*Topic:* ${booking.topic || "General Academic Doubt"}\n\nPlease keep your questions ready.\n\n_Team Atomic Pathshala_`;

    await queueWhatsAppMessage({
      recipientPhone: booking.student.user.phone,
      recipientName: studentName,
      messageType: WhatsAppMessageType.DOUBT_CONFIRMATION,
      bodyText: studentMsg,
      idempotencyKey: `student:${booking.studentId}:doubt_booked:${booking.id}`,
      metadata: { bookingId: booking.id },
    });
  }

  // 2. Teacher Notification
  if (booking.teacher.user.phone) {
    const teacherMsg = `*ATOMIC PATHSHALA — NEW DOUBT SESSION*\n\nDear ${teacherName},\nA student has booked a doubt slot with you:\n\n*Student:* ${studentName}\n*Date & Time:* ${slotTimeStr}\n*Topic:* ${booking.topic || "General Doubt"}\n\nPlease check your faculty portal for details.`;

    await queueWhatsAppMessage({
      recipientPhone: booking.teacher.user.phone,
      recipientName: teacherName,
      messageType: WhatsAppMessageType.DOUBT_CONFIRMATION,
      bodyText: teacherMsg,
      idempotencyKey: `teacher:${booking.teacherId}:doubt_booked:${booking.id}`,
      metadata: { bookingId: booking.id },
    });
  }
}
