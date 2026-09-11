"use client";

import { useEffect, useState, useCallback } from "react";

type EmailLogRow = {
  id: string;
  recipientName: string;
  recipientEmail: string;
  recipientType: string;
  emailType: string;
  subject: string;
  status: string;
  failureReason: string | null;
  createdAt: string;
  sentAt: string | null;
  template: { name: string } | null;
  campaign: { name: string } | null;
};

const STATUS_TONE: Record<string, string> = {
  SENT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  DELIVERED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  QUEUED: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  SENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  FAILED: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  BOUNCED: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  SKIPPED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export function EmailLogsConsole() {
  const [rows, setRows] = useState<EmailLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [emailType, setEmailType] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (emailType) params.set("emailType", emailType);
    const res = await fetch(`/api/team/communication/logs?${params.toString()}`);
    const json = await res.json();
    if (json.success) {
      setRows(json.data.logs);
      setTotal(json.data.pagination.total);
    }
    setLoading(false);
  }, [search, status, emailType]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search recipient, email, subject..."
          className="flex-1 min-w-[200px] px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          <option value="">All statuses</option>
          {["QUEUED", "SENDING", "SENT", "DELIVERED", "FAILED", "BOUNCED", "SKIPPED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={emailType}
          onChange={(e) => setEmailType(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          <option value="">All types</option>
          {["CREDENTIALS", "PASSWORD_RESET", "ENROLLMENT", "INVITATION", "BIRTHDAY", "PROMOTIONAL", "ANNOUNCEMENT", "OTHER"].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400">{total} email{total === 1 ? "" : "s"}</div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Recipient</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Subject</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">No emails match these filters.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-900 dark:text-white">{r.recipientName}</div>
                  <div className="text-xs text-slate-500">{r.recipientEmail}</div>
                </td>
                <td className="px-3 py-2 text-xs">{r.emailType}</td>
                <td className="px-3 py-2 max-w-xs truncate" title={r.subject}>{r.subject}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_TONE[r.status] ?? ""}`}>
                    {r.status}
                  </span>
                  {r.failureReason && (
                    <div className="text-xs text-rose-500 mt-0.5">{r.failureReason}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">
                  {new Date(r.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
