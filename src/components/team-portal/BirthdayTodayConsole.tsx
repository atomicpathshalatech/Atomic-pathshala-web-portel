"use client";

import { useEffect, useState, useCallback } from "react";

type Row = {
  subjectType: "STUDENT" | "TEACHER";
  subjectId: string;
  name: string;
  dob: string;
  category: string;
  board: string | null;
  activeBatchName: string | null;
  whatsappNumber: string | null;
  status: string;
  sentAt: string | null;
  failureReason: string | null;
  triggerType: string | null;
};

const STATUS_TONE: Record<string, string> = {
  SENT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  PENDING: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  PROCESSING: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  FAILED: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  SKIPPED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export function BirthdayTodayConsole() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/team/communication/birthday/today");
    const json = await res.json();
    if (json.success) setRows(json.data.rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function send(row: Row, force: boolean) {
    const key = `${row.subjectType}:${row.subjectId}`;
    setBusyKey(key);
    try {
      const res = await fetch("/api/team/communication/birthday/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectType: row.subjectType, subjectId: row.subjectId, force }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        if (json?.code === "ALREADY_SENT" || res.status === 409) {
          if (!force && confirm("Birthday message has already been sent to this student today. Force send anyway?")) {
            return send(row, true);
          }
          return;
        }
        alert(json?.error || "Send failed.");
        return;
      }
      await load();
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs text-slate-500 dark:text-slate-400">
          <tr>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Category</th>
            <th className="px-3 py-2 font-medium">Batch</th>
            <th className="px-3 py-2 font-medium">WhatsApp</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {loading && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">Loading…</td></tr>}
          {!loading && rows.length === 0 && (
            <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No birthdays today.</td></tr>
          )}
          {rows.map((r) => {
            const key = `${r.subjectType}:${r.subjectId}`;
            const alreadySent = r.status === "SENT";
            return (
              <tr key={key}>
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-900 dark:text-white">{r.name}</div>
                  <div className="text-xs text-slate-500">{r.subjectType === "STUDENT" ? "Student" : "Staff"}</div>
                </td>
                <td className="px-3 py-2 text-xs">{r.category}{r.board ? ` · ${r.board}` : ""}</td>
                <td className="px-3 py-2 text-xs">{r.activeBatchName ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{r.whatsappNumber ?? <span className="text-rose-500">missing</span>}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_TONE[r.status] ?? ""}`}>
                    {r.status}
                  </span>
                  {r.failureReason && <div className="text-xs text-rose-500 mt-0.5">{r.failureReason}</div>}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => send(r, false)}
                    disabled={busyKey === key || !r.whatsappNumber}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
                  >
                    {busyKey === key ? "Sending…" : alreadySent ? "Force Send" : "Send Birthday Wish"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
