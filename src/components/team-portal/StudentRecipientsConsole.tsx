"use client";

import { useEffect, useState, useCallback } from "react";

type Row = {
  studentId: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  studentIdCode: string;
  dob: string;
  accountStatus: string;
  registeredAt: string;
  batches: string[];
};

export function StudentRecipientsConsole() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [batches, setBatches] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [batchId, setBatchId] = useState("");
  const [accountStatus, setAccountStatus] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (batchId) params.set("batchId", batchId);
    if (accountStatus) params.set("accountStatus", accountStatus);
    params.set("limit", "100");
    const res = await fetch(`/api/team/communication/recipients/students?${params}`);
    const json = await res.json();
    if (json.success) {
      setRows(json.data.students);
      setTotal(json.data.pagination.total);
      setBatches(json.data.filterOptions.batches);
    }
    setLoading(false);
  }, [search, batchId, accountStatus]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function selectAll() {
    setSelected(new Set(rows.map((r) => r.userId)));
  }
  function clearSelection() {
    setSelected(new Set());
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name/email/ID…" className="flex-1 min-w-[200px] px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
        <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
          <option value="">All batches</option>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={accountStatus} onChange={(e) => setAccountStatus(e.target.value)} className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
          <option value="">Active/Inactive: all</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{total} students · {selected.size} selected</span>
        <div className="flex gap-2">
          <button onClick={selectAll} className="underline">Select all on page</button>
          <button onClick={clearSelection} className="underline">Clear</button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2"><input type="checkbox" checked={selected.size === rows.length && rows.length > 0} onChange={(e) => (e.target.checked ? selectAll() : clearSelection())} /></th>
              <th className="px-3 py-2 font-medium">Student</th>
              <th className="px-3 py-2 font-medium">Student ID</th>
              <th className="px-3 py-2 font-medium">Batch</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Registered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No students match.</td></tr>}
            {rows.map((r) => (
              <tr key={r.studentId}>
                <td className="px-3 py-2"><input type="checkbox" checked={selected.has(r.userId)} onChange={() => toggle(r.userId)} /></td>
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-900 dark:text-white">{r.name}</div>
                  <div className="text-xs text-slate-500">{r.email}</div>
                </td>
                <td className="px-3 py-2 text-xs">{r.studentIdCode}</td>
                <td className="px-3 py-2 text-xs">{r.batches.join(", ") || "—"}</td>
                <td className="px-3 py-2 text-xs">{r.accountStatus}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{new Date(r.registeredAt).toLocaleDateString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
