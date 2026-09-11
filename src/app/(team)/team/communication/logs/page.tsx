import type { Metadata } from "next";
import { EmailLogsConsole } from "@/components/team-portal/EmailLogsConsole";

export const metadata: Metadata = {
  title: "Email Logs — Communication Center",
};

export default function EmailLogsPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Email Logs</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Every email the app has sent or attempted — registration credentials, password resets,
          enrollment confirmations, staff invitations, and campaigns.
        </p>
      </div>
      <EmailLogsConsole />
    </div>
  );
}
