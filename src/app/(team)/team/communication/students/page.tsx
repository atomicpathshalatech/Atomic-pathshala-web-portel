import type { Metadata } from "next";
import { StudentRecipientsConsole } from "@/components/team-portal/StudentRecipientsConsole";

export const metadata: Metadata = { title: "Student Recipients — Communication Center" };

export default function StudentRecipientsPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Students</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          The centralized student recipient list — search, filter, select. To email a selection,
          use Compose Email.
        </p>
      </div>
      <StudentRecipientsConsole />
    </div>
  );
}
