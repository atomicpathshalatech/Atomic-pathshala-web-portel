"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { UserActivityHistoryModal } from "./UserActivityHistoryModal";

interface ActivityLogItem {
  id: string;
  visitorId: string | null;
  userId: string | null;
  userName: string;
  userEmail: string | null;
  userPhotoUrl: string | null;
  userLastLoginAt?: string | null;
  role: string;
  roleLabel: string;
  path: string;
  title: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  ipAddress: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  durationSeconds: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export function ActivityStreamTab() {
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("");
  const [datePreset, setDatePreset] = useState<"ALL" | "TODAY" | "YESTERDAY" | "LAST_7" | "CUSTOM">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeNowCount, setActiveNowCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // User History Modal State
  const [historyModalUser, setHistoryModalUser] = useState<{
    id?: string | null;
    email?: string | null;
    name?: string;
  } | null>(null);

  const applyDatePreset = (preset: "ALL" | "TODAY" | "YESTERDAY" | "LAST_7") => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === "ALL") {
      setDateFilter("");
    } else if (preset === "TODAY") {
      const todayStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      setDateFilter(todayStr);
    } else if (preset === "YESTERDAY") {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const yesterdayStr = yesterday.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      setDateFilter(yesterdayStr);
    } else if (preset === "LAST_7") {
      // Clear specific single date filter and let server query or search handle it
      setDateFilter("");
    }
  };

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (roleFilter !== "ALL") params.set("role", roleFilter);
      if (dateFilter) params.set("date", dateFilter);
      if (searchQuery) params.set("q", searchQuery);
      params.set("limit", "150");

      const res = await fetch(`/api/team/analytics/activity-stream?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setLogs(data.logs || []);
        setActiveNowCount(data.meta?.activeNowCount || 0);
        setTotalCount(data.meta?.totalCount || 0);
      }
    } catch (err) {
      console.error("Failed to load activity stream:", err);
    } finally {
      setLoading(false);
    }
  }, [roleFilter, dateFilter, searchQuery]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh interval (every 10 seconds if enabled)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  const getRoleBadgeColor = (role: string) => {
    const r = role.toUpperCase();
    if (r.includes("SUPER_ADMIN")) return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
    if (r.includes("ADMIN")) return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
    if (r.includes("TEACHER") || r.includes("FACULTY")) return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    if (r.includes("STUDENT")) return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";
  };

  const getActionIcon = (action: string) => {
    const a = action.toUpperCase();
    if (a.includes("ENROLL") || a.includes("BUY")) return "shopping_cart";
    if (a.includes("SEARCH")) return "search";
    if (a.includes("TEST") || a.includes("DPP")) return "quiz";
    if (a.includes("LECTURE") || a.includes("VIDEO")) return "play_circle";
    if (a.includes("LOGIN")) return "login";
    return "visibility";
  };

  // Detailed Date & Time Formatter
  const formatEventDateTime = (iso: string) => {
    const date = new Date(iso);
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);

    const timeStr = date.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const dateStr = date.toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    let relative = "";
    if (diff < 10) relative = "Just now";
    else if (diff < 60) relative = `${diff}s ago`;
    else if (diff < 3600) relative = `${Math.floor(diff / 60)}m ago`;
    else if (diff < 86400) relative = `${Math.floor(diff / 3600)}h ago`;
    else {
      const days = Math.floor(diff / 86400);
      relative = days === 1 ? "1d ago" : `${days}d ago`;
    }

    const fullTooltip = date.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "full",
      timeStyle: "medium",
    });

    return {
      dateStr,
      timeStr,
      relative,
      fullTooltip,
    };
  };

  const formatLastLogin = (iso: string | null | undefined) => {
    if (!iso) return null;
    const d = new Date(iso);
    const datePart = d.toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const timePart = d.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    return `${datePart}, ${timePart}`;
  };

  // Group logs by Date (Asia/Kolkata YYYY-MM-DD)
  const groupedLogs = useMemo(() => {
    const groups: {
      dateKey: string;
      dateLabel: string;
      items: ActivityLogItem[];
    }[] = [];

    const map = new Map<string, ActivityLogItem[]>();
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterdayDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

    for (const log of logs) {
      const d = new Date(log.createdAt);
      const key = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(log);
    }

    map.forEach((items, key) => {
      if (!items || items.length === 0 || !items[0]) return;
      const d = new Date(items[0].createdAt);
      const formatted = d.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      let label = formatted;
      if (key === todayStr) label = `Today — ${formatted}`;
      else if (key === yesterdayStr) label = `Yesterday — ${formatted}`;

      groups.push({
        dateKey: key,
        dateLabel: label,
        items,
      });
    });

    return groups;
  }, [logs]);

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Role Filter */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl">
            {(["ALL", "STAFF", "TEACHER", "STUDENT", "GUEST"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  roleFilter === r
                    ? "bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                {r === "ALL" ? "All Users" : r === "STAFF" ? "Staff/Admins" : r === "GUEST" ? "Guests" : r}
              </button>
            ))}
          </div>

          {/* Search, Live Refresh */}
          <div className="flex items-center gap-2 flex-1 md:max-w-md">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                search
              </span>
              <input
                type="text"
                placeholder="Search user, email, path, IP, test ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                autoRefresh
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
              {autoRefresh ? "Live" : "Paused"}
            </button>

            <button
              onClick={fetchLogs}
              disabled={loading}
              className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 transition-colors"
              title="Refresh now"
            >
              <span className={`material-symbols-outlined text-sm ${loading ? "animate-spin" : ""}`}>
                refresh
              </span>
            </button>
          </div>
        </div>

        {/* Date Filter & Presets Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">calendar_month</span>
              <span>Filter Date:</span>
            </span>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl">
              <button
                onClick={() => applyDatePreset("ALL")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  datePreset === "ALL" && !dateFilter
                    ? "bg-white dark:bg-slate-700 text-primary dark:text-white shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                All Dates
              </button>
              <button
                onClick={() => applyDatePreset("TODAY")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  datePreset === "TODAY"
                    ? "bg-white dark:bg-slate-700 text-primary dark:text-white shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                Today
              </button>
              <button
                onClick={() => applyDatePreset("YESTERDAY")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  datePreset === "YESTERDAY"
                    ? "bg-white dark:bg-slate-700 text-primary dark:text-white shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                Yesterday
              </button>
            </div>

            {/* Custom Date Picker */}
            <div className="flex items-center gap-1.5 ml-1">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => {
                  setDatePreset("CUSTOM");
                  setDateFilter(e.target.value);
                }}
                className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {dateFilter && (
                <button
                  onClick={() => applyDatePreset("ALL")}
                  className="text-xs text-primary font-bold hover:underline"
                >
                  Clear Date
                </button>
              )}
            </div>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-900 dark:text-white">{logs.length}</strong> events across{" "}
            <strong className="text-slate-900 dark:text-white">{groupedLogs.length}</strong>{" "}
            {groupedLogs.length === 1 ? "date" : "dates"}
          </div>
        </div>
      </div>

      {/* Stream Metrics Header */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {activeNowCount} {activeNowCount === 1 ? "person" : "people"} online right now
          </span>{" "}
          (unique visitors in last 5 minutes)
        </div>
        <div>
          Total events recorded: <span className="font-semibold text-slate-800 dark:text-slate-200">{totalCount}</span>
        </div>
      </div>

      {/* Activity Timeline List (Grouped by Date) */}
      <div className="space-y-6">
        {loading && logs.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-3xl animate-spin text-primary">
              progress_activity
            </span>
            <p className="text-xs font-medium">Connecting to live activity stream...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">
              radar
            </span>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No activity recorded for this filter</p>
            <p className="text-xs text-slate-500">As users browse or check pages, telemetry events with full dates will appear here.</p>
          </div>
        ) : (
          groupedLogs.map((group) => (
            <div
              key={group.dateKey}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
            >
              {/* Date Header Divider */}
              <div className="bg-slate-50 dark:bg-slate-800/70 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-base">calendar_today</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {group.dateLabel}
                  </span>
                </div>
                <span className="text-[11px] font-bold text-slate-500 bg-white dark:bg-slate-700 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-600">
                  {group.items.length} {group.items.length === 1 ? "action recorded" : "actions recorded"}
                </span>
              </div>

              {/* Event items for this date */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {group.items.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const dt = formatEventDateTime(log.createdAt);
                  const lastLoginStr = formatLastLogin(log.userLastLoginAt);

                  return (
                    <div
                      key={log.id}
                      className={`p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                        isExpanded ? "bg-slate-50/60 dark:bg-slate-800/30" : ""
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        {/* User & Action Details */}
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 overflow-hidden text-slate-600 dark:text-slate-300 font-bold text-xs">
                            {log.userPhotoUrl ? (
                              <img src={log.userPhotoUrl} alt={log.userName} className="w-full h-full object-cover" />
                            ) : (
                              log.userName.charAt(0).toUpperCase()
                            )}
                          </div>

                          <div className="space-y-1.5 min-w-0">
                            {/* User Header with Role, Email & Last Login */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-bold text-slate-900 dark:text-white">
                                {log.userName}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${getRoleBadgeColor(
                                  log.role
                                )}`}
                              >
                                {log.roleLabel || log.role}
                              </span>
                              {log.userEmail && (
                                <span className="text-[11px] text-slate-400 truncate max-w-[200px]">
                                  ({log.userEmail})
                                </span>
                              )}

                              {/* Last Login Badge */}
                              {lastLoginStr && (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200/80 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300"
                                  title={`Official Last Login: ${lastLoginStr}`}
                                >
                                  <span className="material-symbols-outlined text-[11px]">login</span>
                                  <span>Last Login: {lastLoginStr}</span>
                                </span>
                              )}

                              {/* Audit User History Button */}
                              {log.userId && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setHistoryModalUser({
                                      id: log.userId,
                                      email: log.userEmail,
                                      name: log.userName,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 border border-amber-200 text-[10px] font-bold text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300 transition cursor-pointer"
                                  title={`View complete date-wise audit trail for ${log.userName}`}
                                >
                                  <span className="material-symbols-outlined text-[12px]">history</span>
                                  <span>Audit History</span>
                                </button>
                              )}
                            </div>

                            {/* What they checked */}
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="material-symbols-outlined text-sm text-primary shrink-0">
                                {getActionIcon(log.action)}
                              </span>
                              <span className="font-semibold text-slate-700 dark:text-slate-200">
                                {log.action}
                              </span>
                              <span className="text-slate-400">&rarr;</span>
                              <span className="font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded truncate max-w-[260px] md:max-w-md">
                                {log.path}
                              </span>
                              {log.title && (
                                <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium truncate max-w-[280px]">
                                  &bull; &quot;{log.title}&quot;
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Metadata & Timestamp (Prominent Date & Time) */}
                        <div className="flex flex-col sm:items-end gap-1 shrink-0 pt-1 sm:pt-0">
                          {/* Date and Time clearly displayed */}
                          <div
                            className="inline-flex items-center gap-1.5 text-xs text-slate-800 dark:text-slate-200 font-bold"
                            title={dt.fullTooltip}
                          >
                            <span className="material-symbols-outlined text-xs text-primary">calendar_today</span>
                            <span className="text-slate-900 dark:text-white">{dt.dateStr}</span>
                            <span className="text-slate-300 dark:text-slate-600">&bull;</span>
                            <span className="material-symbols-outlined text-xs text-slate-400">schedule</span>
                            <span className="font-mono">{dt.timeStr}</span>
                            <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 text-[10px] font-bold text-slate-500">
                              {dt.relative}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span>{log.city || log.country || "India"}</span>
                            <span>&bull;</span>
                            <span className="capitalize">{log.deviceType?.toLowerCase() || "desktop"}</span>
                            <span>&bull;</span>
                            <span>{log.browser || "browser"}</span>
                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="ml-1 text-primary hover:underline text-[10px] font-bold cursor-pointer"
                            >
                              {isExpanded ? "Hide" : "Details"}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Technical Fingerprint */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-100/50 dark:bg-slate-800/40 p-3 rounded-xl">
                          <div>
                            <p className="font-semibold text-slate-700 dark:text-slate-300">Exact Event Timestamp</p>
                            <p className="text-slate-600 dark:text-slate-400 font-mono text-[11px] mt-0.5">
                              {dt.fullTooltip}
                            </p>
                            <p className="font-semibold text-slate-700 dark:text-slate-300 mt-2">Technical Fingerprint</p>
                            <p className="text-slate-500 text-[11px] font-mono mt-0.5">
                              IP: {log.ipAddress || "—"} | OS: {log.os || "—"} | Browser: {log.browser || "—"}
                            </p>
                            <p className="text-slate-500 text-[11px] font-mono">
                              Visitor ID: {log.visitorId || "—"}
                            </p>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-700 dark:text-slate-300">Dwell &amp; Context</p>
                            <p className="text-slate-500 text-[11px] mt-0.5">
                              Duration on Page: {log.durationSeconds > 0 ? `${log.durationSeconds}s` : "Instant Action"}
                            </p>
                            {lastLoginStr && (
                              <p className="text-indigo-600 dark:text-indigo-400 font-mono text-[11px] mt-1">
                                User Last Login: {lastLoginStr}
                              </p>
                            )}
                            {log.metadata && Object.keys(log.metadata).length > 0 && (
                              <pre className="text-[10px] font-mono text-slate-600 dark:text-slate-400 mt-2 bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700 overflow-x-auto">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* User Activity History Modal */}
      {historyModalUser && (
        <UserActivityHistoryModal
          userId={historyModalUser.id}
          email={historyModalUser.email}
          userName={historyModalUser.name}
          isOpen={Boolean(historyModalUser)}
          onClose={() => setHistoryModalUser(null)}
        />
      )}
    </div>
  );
}
