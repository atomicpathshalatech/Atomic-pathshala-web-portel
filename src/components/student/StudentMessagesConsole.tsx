"use client";

import React from "react";
import type { ConversationSummary } from "@/lib/messages/messaging-service";
import { WhatsAppChat } from "@/components/messages/WhatsAppChat";

export function StudentMessagesConsole({
  initialConversations,
  currentUserId,
}: {
  initialConversations: ConversationSummary[];
  currentUserId: string;
}) {
  return (
    <div className="w-full max-w-7xl mx-auto p-2 sm:p-4">
      <WhatsAppChat
        initialConversations={initialConversations}
        currentUserId={currentUserId}
        currentUserRole="STUDENT"
      />
    </div>
  );
}
