import type { Metadata } from "next";
import { EmailTemplatesConsole } from "@/components/team-portal/EmailTemplatesConsole";

export const metadata: Metadata = { title: "Email Templates — Communication Center" };

export default function EmailTemplatesPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Email Templates</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Edit wording without a deploy. System templates (used by registration/enrollment/reset) can be
          edited or deactivated but not deleted — a deactivated one falls back to its built-in default.
        </p>
      </div>
      <EmailTemplatesConsole />
    </div>
  );
}
