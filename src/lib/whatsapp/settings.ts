import { prisma } from "@/lib/db";
import { WhatsAppAutomationSettingsData, WhatsAppProviderType } from "./types";

const DEFAULT_SETTINGS: WhatsAppAutomationSettingsData = {
  digestEnabled: true,
  digestSendTime: "22:00",
  teacherReminderEnabled: true,
  teacherReminderMinutes: 30,
  rescheduleAlertEnabled: true,
  cancelAlertEnabled: true,
  doubtConfirmationEnabled: true,
  doubtReminderEnabled: true,
  doubtReminderMinutes: 60,
  provider: "INTERAKT",
  apiKey: process.env.WHATSAPP_API_KEY || null,
  apiSecret: process.env.WHATSAPP_API_SECRET || null,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || null,
};

export async function getWhatsAppSettings(): Promise<WhatsAppAutomationSettingsData> {
  try {
    const settings = await prisma.whatsAppAutomationSetting.findUnique({
      where: { id: "singleton" },
    });

    if (!settings) {
      return DEFAULT_SETTINGS;
    }

    return {
      digestEnabled: settings.digestEnabled,
      digestSendTime: settings.digestSendTime,
      teacherReminderEnabled: settings.teacherReminderEnabled,
      teacherReminderMinutes: settings.teacherReminderMinutes,
      rescheduleAlertEnabled: settings.rescheduleAlertEnabled,
      cancelAlertEnabled: settings.cancelAlertEnabled,
      doubtConfirmationEnabled: settings.doubtConfirmationEnabled,
      doubtReminderEnabled: settings.doubtReminderEnabled,
      doubtReminderMinutes: settings.doubtReminderMinutes,
      provider: (settings.provider as WhatsAppProviderType) || (process.env.WHATSAPP_PROVIDER as WhatsAppProviderType) || "INTERAKT",
      apiKey: settings.apiKey || process.env.WHATSAPP_API_KEY || null,
      apiSecret: settings.apiSecret || process.env.WHATSAPP_API_SECRET || null,
      phoneNumberId: settings.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || null,
    };
  } catch (error) {
    console.warn("[WHATSAPP_SETTINGS_FETCH_ERROR]", error);
    return DEFAULT_SETTINGS;
  }
}

export async function updateWhatsAppSettings(
  data: Partial<WhatsAppAutomationSettingsData>,
  userId: string
): Promise<WhatsAppAutomationSettingsData> {
  const updated = await prisma.whatsAppAutomationSetting.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      digestEnabled: data.digestEnabled ?? true,
      digestSendTime: data.digestSendTime ?? "22:00",
      teacherReminderEnabled: data.teacherReminderEnabled ?? true,
      teacherReminderMinutes: data.teacherReminderMinutes ?? 30,
      rescheduleAlertEnabled: data.rescheduleAlertEnabled ?? true,
      cancelAlertEnabled: data.cancelAlertEnabled ?? true,
      doubtConfirmationEnabled: data.doubtConfirmationEnabled ?? true,
      doubtReminderEnabled: data.doubtReminderEnabled ?? true,
      doubtReminderMinutes: data.doubtReminderMinutes ?? 60,
      provider: data.provider ?? "INTERAKT",
      apiKey: data.apiKey,
      apiSecret: data.apiSecret,
      phoneNumberId: data.phoneNumberId,
      updatedById: userId,
    },
    update: {
      ...(data.digestEnabled !== undefined && { digestEnabled: data.digestEnabled }),
      ...(data.digestSendTime !== undefined && { digestSendTime: data.digestSendTime }),
      ...(data.teacherReminderEnabled !== undefined && { teacherReminderEnabled: data.teacherReminderEnabled }),
      ...(data.teacherReminderMinutes !== undefined && { teacherReminderMinutes: data.teacherReminderMinutes }),
      ...(data.rescheduleAlertEnabled !== undefined && { rescheduleAlertEnabled: data.rescheduleAlertEnabled }),
      ...(data.cancelAlertEnabled !== undefined && { cancelAlertEnabled: data.cancelAlertEnabled }),
      ...(data.doubtConfirmationEnabled !== undefined && { doubtConfirmationEnabled: data.doubtConfirmationEnabled }),
      ...(data.doubtReminderEnabled !== undefined && { doubtReminderEnabled: data.doubtReminderEnabled }),
      ...(data.doubtReminderMinutes !== undefined && { doubtReminderMinutes: data.doubtReminderMinutes }),
      ...(data.provider !== undefined && { provider: data.provider }),
      ...(data.apiKey !== undefined && { apiKey: data.apiKey }),
      ...(data.apiSecret !== undefined && { apiSecret: data.apiSecret }),
      ...(data.phoneNumberId !== undefined && { phoneNumberId: data.phoneNumberId }),
      updatedById: userId,
    },
  });

  return {
    digestEnabled: updated.digestEnabled,
    digestSendTime: updated.digestSendTime,
    teacherReminderEnabled: updated.teacherReminderEnabled,
    teacherReminderMinutes: updated.teacherReminderMinutes,
    rescheduleAlertEnabled: updated.rescheduleAlertEnabled,
    cancelAlertEnabled: updated.cancelAlertEnabled,
    doubtConfirmationEnabled: updated.doubtConfirmationEnabled,
    doubtReminderEnabled: updated.doubtReminderEnabled,
    doubtReminderMinutes: updated.doubtReminderMinutes,
    provider: (updated.provider as WhatsAppProviderType) || "INTERAKT",
    apiKey: updated.apiKey,
    apiSecret: updated.apiSecret,
    phoneNumberId: updated.phoneNumberId,
  };
}
