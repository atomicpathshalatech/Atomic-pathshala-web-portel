"use client";

import { Clock3 } from "lucide-react";
import { useEffect, useState } from "react";

interface QuizTimerProps {
  initialSeconds: number;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function QuizTimer({ initialSeconds }: QuizTimerProps) {
  const [remaining, setRemaining] = useState(initialSeconds);

  useEffect(() => {
    setRemaining(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (remaining <= 0) return;

    const interval = window.setInterval(() => {
      setRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [remaining]);

  const expired = remaining === 0;
  const urgent = remaining > 0 && remaining <= 10;

  return (
    <div
      className={`flex items-center justify-between gap-3 border-l-4 px-3 py-2 text-xs font-semibold ${
        expired
          ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
          : urgent
            ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300"
            : "border-atomic-blue bg-blue-50 text-atomic-blue dark:bg-blue-950/30 dark:text-blue-200"
      }`}
      aria-live="polite"
    >
      <span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4" /> Quiz timer</span>
      <span>{expired ? "Time is up" : formatTime(remaining)}</span>
    </div>
  );
}
