import type { Metadata } from "next";
import { TodaySpecialConsole } from "@/components/team-portal/TodaySpecialConsole";

export const metadata: Metadata = { title: "Today Special — Communication Center" };

export default function TodaySpecialPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">🎉 Today Special</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Recurring content for a specific date (year-independent). When a student&apos;s birthday
          falls on an active Today Special that targets them, both combine in the one WhatsApp message.
        </p>
      </div>
      <TodaySpecialConsole />
    </div>
  );
}
