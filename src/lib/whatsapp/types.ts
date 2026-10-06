export type WhatsAppProviderType = "MOCK" | "INTERAKT" | "GUPSHUP" | "META" | "AISENSY";

export interface WhatsAppSendParams {
  to: string; // phone number e.g. +919876543210
  recipientName?: string;
  templateName?: string;
  templateParams?: Record<string, string | number>;
  bodyText: string;
  mediaUrl?: string;
  idempotencyKey: string;
  metadata?: Record<string, any>;
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  status: "SENT" | "FAILED" | "SKIPPED";
  provider: WhatsAppProviderType;
  error?: string;
  rawResponse?: any;
}

export interface WhatsAppAutomationSettingsData {
  digestEnabled: boolean;
  digestSendTime: string; // e.g. "22:00"
  teacherReminderEnabled: boolean;
  teacherReminderMinutes: number; // 15 or 30
  rescheduleAlertEnabled: boolean;
  cancelAlertEnabled: boolean;
  doubtConfirmationEnabled: boolean;
  doubtReminderEnabled: boolean;
  doubtReminderMinutes: number; // 60
  provider: WhatsAppProviderType;
  apiKey?: string | null;
  apiSecret?: string | null;
  phoneNumberId?: string | null;
}

export interface StudentTomorrowClassItem {
  id: string;
  title: string;
  subject?: string | null;
  topic?: string | null;
  teacherName: string;
  startsAt: Date;
  endsAt: Date;
  durationMinutes: number;
  youtubeUrl?: string | null;
  batchName: string;
}

export interface StudentTomorrowScheduleDigest {
  studentId: string;
  studentName: string;
  phone: string;
  dateStr: string;
  classes: StudentTomorrowClassItem[];
}
