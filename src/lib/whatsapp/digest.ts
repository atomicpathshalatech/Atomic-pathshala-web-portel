import {
  getTomorrowKolkataBounds,
  sendTomorrowClassSchedules,
  buildTomorrowStudentDigests,
} from "@/lib/notifications/class-schedule-notifier";

export { getTomorrowKolkataBounds };

/**
 * Generate and dispatch consolidated next-day class digests (Email, WhatsApp, SMS fallback)
 * for all active students across all classes.
 */
export async function generateNextDayStudentDigests(referenceDate: Date = new Date()): Promise<{
  totalStudents: number;
  digestsQueued: number;
  dateStr: string;
  emailsSent?: number;
  smsSent?: number;
}> {
  const result = await sendTomorrowClassSchedules({
    referenceDate,
  });

  return {
    totalStudents: result.totalStudents,
    digestsQueued: result.whatsAppQueued,
    emailsSent: result.emailsSent,
    smsSent: result.smsSent,
    dateStr: result.dateStr,
  };
}
