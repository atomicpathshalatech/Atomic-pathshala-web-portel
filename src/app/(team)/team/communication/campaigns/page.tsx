import type { Metadata } from "next";
import Link from "next/link";
import { CampaignsConsole } from "@/components/team-portal/CampaignsConsole";

export const metadata: Metadata = { title: "Campaigns — Communication Center" };

export default function CampaignsPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Campaigns</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Every bulk send, with delivery stats.</p>
        </div>
        <Link href="/team/communication/compose" className="px-3 py-2 text-sm font-semibold rounded-lg bg-primary text-white">
          Compose Email
        </Link>
      </div>
      <CampaignsConsole />
    </div>
  );
}
