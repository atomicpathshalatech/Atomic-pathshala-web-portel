"use client";

import { Bot } from "lucide-react";

export function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-atomic-blue text-white dark:bg-atomic-blue-light">
        <Bot className="h-4 w-4" />
      </div>
      <div className="message-assistant flex items-center gap-1.5 rounded-2xl rounded-tl-sm px-4 py-3">
        <span className="h-2 w-2 animate-bounce rounded-full bg-atomic-orange [animation-delay:0ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-atomic-orange [animation-delay:150ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-atomic-orange [animation-delay:300ms]" />
      </div>
    </div>
  );
}
