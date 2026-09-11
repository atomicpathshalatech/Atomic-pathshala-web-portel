import type { Metadata } from "next";
import { BirthdayTodayConsole } from "@/components/team-portal/BirthdayTodayConsole";

export const metadata: Metadata = {
  title: "Birthday Automation — Communication Center",
};

export default function BirthdayAutomationPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">🎂 Birthday Automation</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Today&apos;s birthdays, resolved to the right category (NEET/JEE/Class/Board/General) from
          each student&apos;s active batch, with send status. The daily job runs automatically at
          9:00 AM IST — use Send / Force Send here for anything that needs a manual nudge.
        </p>
      </div>
      <BirthdayTodayConsole />
    </div>
  );
}
