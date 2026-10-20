"use client";

import React, { useState, useEffect } from "react";

interface ActionItem {
  id: string;
  action: string;
  path: string;
  title: string;
  time: string;
  createdAt: string;
  durationSeconds: number;
  ipAddress: string | null;
  city: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  metadata: Record<string, unknown> | null;
}

interface DateHistoryItem {
  date: string;
  label: string;
  formattedDate: string;
  totalActions: number;
  firstActiveTime: string | null;
  lastActiveTime: string | null;
  checkedPages: string[];
  actions: ActionItem[];
}

interface UserHistoryData {
  user: {
    id: string;
    name: string;
    email: string;
    photoUrl: string | null;
    roleName: string;
    roleLabel: string;
    lastLoginAt: string | null;
    registeredAt: string;
    department: string | null;
    employeeCode: string | null;
  };
  sessions: {
    id: string;
    deviceName: string;
    deviceCategory: string;
    ipAddress: string | null;
    browser: string | null;
    os: string | null;
    lastActiveAt: string;
    createdAt: string;
  }[];
  totalLogsCount: number;
  totalActiveDays: number;
  dateHistory: DateHistoryItem[];
}

interface UserActivityHistoryModalProps {
  userId?: string | null;
  email?: string | null;
  userName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function UserActivityHistoryModal({
  userId,
  email,
  userName,
  isOpen,
  onClose,
}: UserActivityHistoryModalProps) {
  const [data, setData] = useState<UserHistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");

  useEffect(() => {
    if (!isOpen || (!userId && !email)) return;

    async function loadHistory() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (userId) params.set("userId", userId);
        else if (email) params.set("email", email);
        params.set("limit", "500");

        const res = await fetch(`/api/team/analytics/user-history?${params.toString()}`);
        const json = await res.json();
        if (json.ok) {
          setData(json);
          // Automatically expand the most recent date
          if (json.dateHistory && json.dateHistory.length > 0) {
            setExpandedDate(json.dateHistory[0].date);
          }
        } else {
          setError(json.error || "Failed to load user activity history");
        }
      } catch (err: any) {
        setError(err.message || "Network error loading history");
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, [isOpen, userId, email]);

  if (!isOpen) return null;

  const formatFullDateTime = (iso: string | null) => {
    if (!iso) return "No login recorded yet";
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-xs">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-5 shrink-0 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center font-black text-primary text-base shrink-0 overflow-hidden">
              {data?.user?.photoUrl ? (
                <img src={data.user.photoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                (data?.user?.name || userName || "U").charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {data?.user?.name || userName || "User Audit"}
                </h3>
                {data?.user?.roleLabel && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-primary/10 text-primary border border-primary/20">
                    {data.user.roleLabel}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">{data?.user?.email || email}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-3">
              <span className="material-symbols-outlined text-4xl animate-spin text-primary">
                progress_activity
              </span>
              <p className="text-sm font-semibold">Auditing user logs across all dates...</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
              <span className="material-symbols-outlined text-3xl mb-1">error</span>
              <p className="text-sm font-bold">{error}</p>
            </div>
          ) : !data ? null : (
            <>
              {/* Highlight Cards: Last Login & Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Last Login Card */}
                <div className="sm:col-span-1 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                  <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
                    <span className="material-symbols-outlined text-base">login</span>
                    <span>Last Login Timestamp</span>
                  </div>
                  <p className="mt-2 text-sm font-black text-slate-900 dark:text-white font-mono">
                    {formatFullDateTime(data.user.lastLoginAt)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">Official auth login record</p>
                </div>

                {/* Total Active Days */}
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                    <span className="material-symbols-outlined text-base">calendar_month</span>
                    <span>Active Days Logged</span>
                  </div>
                  <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                    {data.totalActiveDays} <span className="text-xs font-normal text-slate-500">distinct dates</span>
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">Days with verified activity</p>
                </div>

                {/* Total Actions Recorded */}
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-xs font-bold">
                    <span className="material-symbols-outlined text-base">analytics</span>
                    <span>Total Pages / Actions</span>
                  </div>
                  <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                    {data.totalLogsCount} <span className="text-xs font-normal text-slate-500">events audited</span>
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">Navigation &amp; feature checks</p>
                </div>
              </div>

              {/* Active Devices / Sessions */}
              {data.sessions && data.sessions.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/30">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    Known Devices &amp; IPs:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {data.sessions.map((sess) => (
                      <span
                        key={sess.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 shadow-2xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 font-mono"
                      >
                        <span className="material-symbols-outlined text-xs text-slate-400">devices</span>
                        <span>{sess.deviceName}</span>
                        {sess.ipAddress && <span className="text-slate-400">• {sess.ipAddress}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Search Within User's Actions */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">history_toggle_off</span>
                  <span>Date-by-Date Activity Breakdown (What they checked &amp; when)</span>
                </h4>

                <div className="relative w-56">
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                    search
                  </span>
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filter pages, tests, dates..."
                    className="w-full pl-7 pr-2.5 py-1 text-xs rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Date-by-Date Accordions */}
              {data.dateHistory.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 border border-dashed rounded-2xl">
                  No page activity telemetry logs recorded yet for this user.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.dateHistory
                    .filter((day) => {
                      if (!searchFilter.trim()) return true;
                      const q = searchFilter.toLowerCase();
                      return (
                        day.formattedDate.toLowerCase().includes(q) ||
                        day.checkedPages.some((p) => p.toLowerCase().includes(q)) ||
                        day.actions.some((a) => a.path.toLowerCase().includes(q) || a.title?.toLowerCase().includes(q))
                      );
                    })
                    .map((day) => {
                      const isExpanded = expandedDate === day.date;
                      return (
                        <div
                          key={day.date}
                          className="rounded-2xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden transition"
                        >
                          {/* Day Header Row */}
                          <div
                            onClick={() => setExpandedDate(isExpanded ? null : day.date)}
                            className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40 select-none transition"
                          >
                            <div className="flex items-center gap-3">
                              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xs shrink-0">
                                <span className="material-symbols-outlined text-base">calendar_today</span>
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h5 className="font-bold text-sm text-slate-900 dark:text-white">
                                    {day.label}
                                  </h5>
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                    {day.totalActions} {day.totalActions === 1 ? "action" : "actions"}
                                  </span>
                                </div>

                                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 font-mono">
                                  {day.firstActiveTime && (
                                    <span>
                                      First active (Login): <strong className="text-slate-800 dark:text-slate-200">{day.firstActiveTime}</strong>
                                    </span>
                                  )}
                                  {day.lastActiveTime && (
                                    <>
                                      <span>&bull;</span>
                                      <span>
                                        Last active: <strong className="text-slate-800 dark:text-slate-200">{day.lastActiveTime}</strong>
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Summary of checked items */}
                            <div className="flex items-center gap-2 text-right">
                              <div className="hidden lg:block max-w-xs text-right">
                                <p className="text-[11px] text-slate-400 truncate">
                                  Checked: {day.checkedPages.slice(0, 3).join(", ")}
                                </p>
                              </div>
                              <span className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                <span className="material-symbols-outlined text-sm">
                                  {isExpanded ? "expand_less" : "expand_more"}
                                </span>
                              </span>
                            </div>
                          </div>

                          {/* Expanded Action List for this Date */}
                          {isExpanded && (
                            <div className="border-t border-slate-100 p-4 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/40 space-y-2">
                              <div className="flex items-center justify-between text-[11px] text-slate-400 uppercase font-bold tracking-wider px-1 pb-1">
                                <span>Time &amp; Action</span>
                                <span>Page Checked / Duration</span>
                              </div>

                              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                                {day.actions.map((act) => (
                                  <div
                                    key={act.id}
                                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-200/80 bg-white text-xs dark:border-slate-800 dark:bg-slate-900 shadow-2xs hover:border-slate-300 transition"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="font-mono text-[11px] font-bold text-primary shrink-0">
                                        {act.time}
                                      </span>
                                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300 shrink-0 uppercase">
                                        {act.action}
                                      </span>
                                      <span className="font-mono text-slate-800 dark:text-slate-200 truncate font-semibold">
                                        {act.path}
                                      </span>
                                      {act.title && act.title !== act.path && (
                                        <span className="text-slate-400 truncate hidden md:inline text-[11px]">
                                          • &quot;{act.title}&quot;
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0 text-right">
                                      {act.durationSeconds > 0 && (
                                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                                          {act.durationSeconds}s on page
                                        </span>
                                      )}
                                      <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                                        {act.browser} • {act.deviceType}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-100 dark:border-slate-800 p-4 bg-slate-50/70 dark:bg-slate-800/40 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-5 py-2 text-xs font-bold text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 transition"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
}
