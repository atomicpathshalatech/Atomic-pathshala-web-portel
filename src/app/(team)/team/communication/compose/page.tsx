import type { Metadata } from "next";
import { ComposeEmailWizard } from "@/components/team-portal/ComposeEmailWizard";

export const metadata: Metadata = { title: "Compose Email — Communication Center" };

export default function ComposeEmailPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Compose Email</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Recipients → Compose → Confirm → Send. Sends go through a backend queue, not a frontend loop —
          you can leave this page once you confirm.
        </p>
      </div>
      <ComposeEmailWizard />
    </div>
  );
}
