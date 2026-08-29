"use client";

import { useAiChatUser } from "@/components/ai-chat/AiChatUserContext";
import { ScheduleManager } from "@/components/ai-chat/ScheduleManager";
import { StudentSchedule } from "@/components/ai-chat/StudentSchedule";

export function ScheduleGate() {
  const { user } = useAiChatUser();

  if (user.isScheduleManager) {
    return <ScheduleManager />;
  }

  return <StudentSchedule />;
}
