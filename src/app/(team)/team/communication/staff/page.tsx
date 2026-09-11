import type { Metadata } from "next";
import { StaffRecipientsConsole } from "@/components/team-portal/StaffRecipientsConsole";

export const metadata: Metadata = { title: "Staff Recipients — Communication Center" };

export default function StaffRecipientsPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Staff / Team Members</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Kept separate from the student list — search, filter, select.
        </p>
      </div>
      <StaffRecipientsConsole />
    </div>
  );
}
