"use client";

import { useEffect, useState } from "react";

type Campaign = {
  id: string;
  name: string;
  recipientGroup: string;
  recipientCount: number;
  subject: string;
  status: string;
  sentCount: number;
  failedCount: number;
  scheduledAt: string | null;
  createdAt: string;
  createdBy: { name: string } | null;
};

const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  SCHEDULED: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  PROCESSING: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  PARTIALLY_FAILED: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  CANCELLED: "bg-slate-100 text-slate-500 dark:bg-slate-800",
};

export function CampaignsConsole() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/team/communication/campaigns")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setCampaigns(j.data.campaigns);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="text-sm text-slate-400 py-6 text-center">Loading…</div>;
  if (campaigns.length === 0) return <div className="text-sm text-slate-400 py-6 text-center">No campaigns yet — compose one to get started.</div>;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs text-slate-500 dark:text-slate-400">
          <tr>
            <th className="px-3 py-2 font-medium">Campaign</th>
            <th className="px-3 py-2 font-medium">Recipients</th>
            <th className="px-3 py-2 font-medium">Sent / Failed</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {campaigns.map((c) => (
            <tr key={c.id}>
              <td className="px-3 py-2">
                <div className="font-medium text-slate-900 dark:text-white">{c.name}</div>
                <div className="text-xs text-slate-500">{c.recipientGroup} · by {c.createdBy?.name ?? "—"}</div>
              </td>
              <td className="px-3 py-2">{c.recipientCount}</td>
              <td className="px-3 py-2">
                <span className="text-emerald-600">{c.sentCount}</span> / <span className="text-rose-500">{c.failedCount}</span>
              </td>
              <td className="px-3 py-2">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_TONE[c.status] ?? ""}`}>{c.status}</span>
              </td>
              <td className="px-3 py-2 text-xs text-slate-500">
                {new Date(c.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
