"use client";

import { useState } from "react";

type Row = {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  studentIdCode: string | null;
  requestedAt: string;
  reason: string | null;
};

export function AccountDeletionsList({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (row: Row, action: "erase" | "cancel") => {
    const ok =
      action === "erase"
        ? confirm(`Erase ${row.name}'s personal data permanently? This cannot be undone.`)
        : confirm(`Switch ${row.name}'s account back on (cancel the deletion)?`);
    if (!ok) return;
    setBusy(row.userId);
    try {
      const res = await fetch(`/api/team/account-deletions/${row.userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed");
      setRows((r) => r.filter((x) => x.userId !== row.userId));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  if (rows.length === 0) {
    return <p className="rounded-2xl border border-outline-variant/30 bg-surface p-8 text-center text-sm text-on-surface-variant">No pending requests.</p>;
  }

  return (
    <ul className="divide-y divide-outline-variant/20 overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface">
      {rows.map((r) => {
        const days = Math.floor((Date.now() - new Date(r.requestedAt).getTime()) / 86_400_000);
        return (
          <li key={r.userId} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-on-surface">
                {r.name} {r.studentIdCode && <span className="font-mono text-xs text-on-surface-variant">· {r.studentIdCode}</span>}
              </p>
              <p className="truncate text-xs text-on-surface-variant">
                {r.email}
                {r.phone ? ` · ${r.phone}` : ""}
              </p>
              <p className={`text-xs ${days >= 25 ? "font-bold text-red-600" : "text-on-surface-variant"}`}>
                Requested {new Date(r.requestedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })} · {days} day{days === 1 ? "" : "s"} ago
              </p>
              {r.reason && <p className="mt-1 text-xs italic text-on-surface-variant">“{r.reason}”</p>}
            </div>
            <button
              type="button"
              disabled={busy === r.userId}
              onClick={() => act(r, "cancel")}
              className="rounded-lg border border-outline-variant/40 px-3 py-1.5 text-xs font-bold text-on-surface-variant disabled:opacity-50"
            >
              Restore
            </button>
            <button
              type="button"
              disabled={busy === r.userId}
              onClick={() => act(r, "erase")}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              Erase data
            </button>
          </li>
        );
      })}
    </ul>
  );
}
