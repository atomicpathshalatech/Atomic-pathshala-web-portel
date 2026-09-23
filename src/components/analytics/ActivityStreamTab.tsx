"use client";

import React, { useState, useEffect, useCallback } from "react";

interface ActivityLogItem {
  id: string;
  visitorId: string | null;
  userId: string | null;
  userName: string;
  userEmail: string | null;
  userPhotoUrl: string | null;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [activeNowCount, setActiveNowCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (roleFilter !== "ALL") params.set("role", roleFilter);
      if (dateFilter) params.set("date", dateFilter);
      if (searchQuery) params.set("q", searchQuery);
      params.set("limit", "100");

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

  const formatRelativeTime = (iso: string) => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 5) return "Just now";
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
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

          {/* Date Picker */}
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter("")}
              className="text-xs text-slate-500 hover:text-slate-700 underline"
            >
              Reset Date
            </button>
          )}
        </div>

        {/* Search & Auto-Refresh */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              search
            </span>
            <input
              type="text"
              placeholder="Search user, path, IP, action..."
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
            {autoRefresh ? "Live (10s)" : "Paused"}
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

      {/* Stream Metrics Header */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {activeNowCount} active user{activeNowCount === 1 ? "" : "s"}
          </span>{" "}
          in last 5 minutes
        </div>
        <div>
          Showing <span className="font-semibold text-slate-800 dark:text-slate-200">{logs.length}</span> of{" "}
          <span className="font-semibold text-slate-800 dark:text-slate-200">{totalCount}</span> events
        </div>
      </div>

      {/* Activity Timeline List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-3xl animate-spin text-primary">
              progress_activity
            </span>
            <p className="text-xs font-medium">Connecting to live activity stream...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">
              radar
            </span>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No activity recorded for this filter</p>
            <p className="text-xs text-slate-500">As users browse or interact, telemetry events will appear here in real-time.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {logs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              return (
                <div
                  key={log.id}
                  className={`p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                    isExpanded ? "bg-slate-50/60 dark:bg-slate-800/30" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* User & Action Details */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 overflow-hidden text-slate-600 dark:text-slate-300 font-bold text-xs">
                        {log.userPhotoUrl ? (
                          <img src={log.userPhotoUrl} alt={log.userName} className="w-full h-full object-cover" />
                        ) : (
                          log.userName.charAt(0).toUpperCase()
                        )}
                      </div>

                      <div className="space-y-1 min-w-0">
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
                            <span className="text-[11px] text-slate-400 truncate max-w-[180px]">
                              ({log.userEmail})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <span className="material-symbols-outlined text-sm text-primary shrink-0">
                            {getActionIcon(log.action)}
                          </span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {log.action}
                          </span>
                          <span className="text-slate-400">→</span>
                          <span className="font-mono text-[11px] text-slate-800 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded truncate max-w-[280px] md:max-w-md">
                            {log.path}
                          </span>
                          {log.title && (
                            <span className="text-slate-500 text-[11px] hidden lg:inline truncate max-w-[200px]">
                              • &quot;{log.title}&quot;
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Metadata & Timestamp */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <span className="material-symbols-outlined text-xs">schedule</span>
                        <span>{formatRelativeTime(log.createdAt)}</span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>{log.city || log.country || "India"}</span>
                        <span>•</span>
                        <span className="capitalize">{log.deviceType?.toLowerCase() || "desktop"}</span>
                        <span>•</span>
                        <span>{log.browser || "browser"}</span>
                        <button
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="ml-1 text-primary hover:underline text-[10px] font-semibold"
                        >
                          {isExpanded ? "Hide" : "Details"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Metadata Inspector */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-100/50 dark:bg-slate-800/40 p-3 rounded-xl">
                      <div>
                        <p className="font-semibold text-slate-700 dark:text-slate-300">Technical Fingerprint</p>
                        <p className="text-slate-500 text-[11px] font-mono mt-0.5">
                          IP: {log.ipAddress || "—"} | OS: {log.os || "—"} | Browser: {log.browser || "—"}
                        </p>
                        <p className="text-slate-500 text-[11px] font-mono">
                          Visitor ID: {log.visitorId || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-700 dark:text-slate-300">Dwell & Context</p>
                        <p className="text-slate-500 text-[11px] mt-0.5">
                          Duration on Page: {log.durationSeconds > 0 ? `${log.durationSeconds}s` : "Instant Action"}
                        </p>
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <pre className="text-[10px] font-mono text-slate-600 dark:text-slate-400 mt-1 bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700 overflow-x-auto">
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
        )}
      </div>
    </div>
  );
}
