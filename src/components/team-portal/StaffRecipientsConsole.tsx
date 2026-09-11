"use client";

import { useEffect, useState, useCallback } from "react";

type Row = {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  staffId: string | null;
  roleLabel: string;
  department: string | null;
  accountStatus: string;
  dob: string | null;
  joinedAt: string;
};

export function StaffRecipientsConsole() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [roles, setRoles] = useState<{ name: string; label: string }[]>([]);
  const [search, setSearch] = useState("");
  const [roleName, setRoleName] = useState("");
  const [accountStatus, setAccountStatus] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (roleName) params.set("roleName", roleName);
    if (accountStatus) params.set("accountStatus", accountStatus);
    params.set("limit", "100");
    const res = await fetch(`/api/team/communication/recipients/staff?${params}`);
    const json = await res.json();
    if (json.success) {
      setRows(json.data.staff);
      setTotal(json.data.pagination.total);
      setRoles(json.data.filterOptions.roles);
    }
    setLoading(false);
  }, [search, roleName, accountStatus]);

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
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name/email…" className="flex-1 min-w-[200px] px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
        <select value={roleName} onChange={(e) => setRoleName(e.target.value)} className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
          <option value="">All roles</option>
          {roles.map((r) => <option key={r.name} value={r.name}>{r.label}</option>)}
        </select>
        <select value={accountStatus} onChange={(e) => setAccountStatus(e.target.value)} className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
          <option value="">Active/Inactive: all</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{total} staff · {selected.size} selected</span>
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
              <th className="px-3 py-2 font-medium">Staff</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Department</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No staff match.</td></tr>}
            {rows.map((r) => (
              <tr key={r.userId}>
                <td className="px-3 py-2"><input type="checkbox" checked={selected.has(r.userId)} onChange={() => toggle(r.userId)} /></td>
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-900 dark:text-white">{r.name}</div>
                  <div className="text-xs text-slate-500">{r.email}</div>
                </td>
                <td className="px-3 py-2 text-xs">{r.roleLabel}</td>
                <td className="px-3 py-2 text-xs">{r.department ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{r.accountStatus}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{new Date(r.joinedAt).toLocaleDateString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
