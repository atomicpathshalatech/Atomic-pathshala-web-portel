"use client";

import React from "react";
import type { ConversationSummary } from "@/lib/messages/messaging-service";
import { WhatsAppChat } from "@/components/messages/WhatsAppChat";

export function TeamMessagesConsole({
  initialConversations,
  currentUserId,
  currentUserRole,
}: {
  initialConversations: ConversationSummary[];
  currentUserId: string;
  currentUserRole: string;
}) {
  return (
    <div className="flex-1 flex flex-col min-h-0 w-full p-2 sm:p-4">
      <WhatsAppChat
        initialConversations={initialConversations}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
      />
    </div>
  );
}
