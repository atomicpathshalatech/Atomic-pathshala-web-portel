"use client";

import React, { useState, useEffect, useCallback } from "react";

interface ActionTrailItem {
  id: string;
  time: string;
  path: string;
  title: string;
  action: string;
  durationSeconds: number;
  ipAddress: string | null;
}

interface StaffPresenceRecord {
  userId: string;
  name: string;
  email: string;
  photoUrl: string | null;
  roleName: string;
  roleLabel: string;
  isTeacher: boolean;
  department: string | null;
  employeeCode: string | null;
  subjects: string[];
  isOnline: boolean;
  totalActionsToday: number;
  totalActiveMinutes: number;
  firstActive: string | null;
  lastActive: string | null;
  ipAddress: string;
  city: string;
  country: string;
  deviceType: string;
  browser: string;
  os: string;
  actionTrail: ActionTrailItem[];
}

export function StaffPresenceTab() {
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0] || "");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [staff, setStaff] = useState<StaffPresenceRecord[]>([]);
  const [summary, setSummary] = useState({ totalStaffCount: 0, activeTodayCount: 0, onlineNowCount: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  const fetchStaffData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("date", date);
      if (typeFilter !== "ALL") params.set("type", typeFilter);
      if (searchQuery) params.set("q", searchQuery);

      const res = await fetch(`/api/team/analytics/staff-presence?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setStaff(data.staff || []);
        setSummary(data.summary || { totalStaffCount: 0, activeTodayCount: 0, onlineNowCount: 0 });
      }
    } catch (err) {
      console.error("Failed to load staff presence data:", err);
    } finally {
      setLoading(false);
    }
  }, [date, typeFilter, searchQuery]);

  useEffect(() => {
    fetchStaffData();
  }, [fetchStaffData]);

  const formatHours = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  };

  const formatTimeOnly = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-6">
      {/* Top Controls & KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <span className="material-symbols-outlined text-2xl">sensors</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{summary.onlineNowCount}</p>
            <p className="text-xs text-slate-500 font-medium">Currently Online Right Now</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-2xl">badge</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{summary.activeTodayCount}</p>
            <p className="text-xs text-slate-500 font-medium">Active On-Duty Today</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <span className="material-symbols-outlined text-2xl">groups</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{summary.totalStaffCount}</p>
            <p className="text-xs text-slate-500 font-medium">Total Registered Staff / Faculty</p>
          </div>
        </div>
      </div>

      {/* Filter and Date Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Date:</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {date !== new Date().toISOString().split("T")[0] && (
              <button
                onClick={() => setDate(new Date().toISOString().split("T")[0] || "")}
                className="text-xs text-primary font-semibold hover:underline"
              >
                Today
              </button>
            )}
          </div>

          {/* Role Types */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl">
            {(["ALL", "TEACHER", "ADMIN", "OPERATIONS"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  typeFilter === t
                    ? "bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                {t === "ALL" ? "All Staff" : t === "TEACHER" ? "Teachers Only" : t}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              search
            </span>
            <input
              type="text"
              placeholder="Search staff name, email, department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <button
            onClick={fetchStaffData}
            disabled={loading}
            className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 transition-colors"
          >
            <span className={`material-symbols-outlined text-sm ${loading ? "animate-spin" : ""}`}>
              refresh
            </span>
          </button>
        </div>
      </div>

      {/* Staff Presence Table / Cards */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-3xl animate-spin text-primary">
              progress_activity
            </span>
            <p className="text-xs font-medium">Auditing staff activity logs for {date}...</p>
          </div>
        ) : staff.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">
              person_off
            </span>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No staff records match criteria</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {staff.map((member) => {
              const isSelected = selectedStaffId === member.userId;
              return (
                <div key={member.userId} className="p-4 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Member Info */}
                    <div className="flex items-center gap-3 min-w-[240px]">
                      <div className="relative">
                        <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 overflow-hidden font-bold text-sm text-slate-700 dark:text-slate-200">
                          {member.photoUrl ? (
                            <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                          ) : (
                            member.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <span
                          className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 ${
                            member.isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-300 dark:bg-slate-600"
                          }`}
                          title={member.isOnline ? "Online Now" : "Offline"}
                        />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">{member.name}</h4>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                            {member.roleLabel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{member.email}</p>
                        {member.department && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Dept: {member.department} {member.employeeCode ? `• (${member.employeeCode})` : ""}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Presence Timestamps */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        <p className="text-slate-400 font-medium text-[10px]">First Active (Login)</p>
                        <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">
                          {formatTimeOnly(member.firstActive)}
                        </p>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        <p className="text-slate-400 font-medium text-[10px]">Last Active</p>
                        <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">
                          {formatTimeOnly(member.lastActive)}
                        </p>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        <p className="text-slate-400 font-medium text-[10px]">Active Duration</p>
                        <p className="font-bold text-primary mt-0.5 font-mono">
                          {member.totalActiveMinutes > 0 ? formatHours(member.totalActiveMinutes) : "0m"}
                        </p>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        <p className="text-slate-400 font-medium text-[10px]">Pages/Actions Today</p>
                        <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">
                          {member.totalActionsToday} actions
                        </p>
                      </div>
                    </div>

                    {/* Device / Location & Action Trail Toggle */}
                    <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0">
                      <div className="text-right text-[11px] text-slate-400 hidden sm:block">
                        <p className="font-medium text-slate-600 dark:text-slate-300">
                          {member.city}, {member.country}
                        </p>
                        <p className="font-mono text-[10px]">{member.ipAddress}</p>
                      </div>

                      <button
                        onClick={() => setSelectedStaffId(isSelected ? null : member.userId)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          isSelected
                            ? "bg-primary text-white shadow-md shadow-primary/20"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">
                          {isSelected ? "expand_less" : "history"}
                        </span>
                        <span>{isSelected ? "Hide Trail" : "Action Trail"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Complete Daily Action Trail Accordion */}
                  {isSelected && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-4 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-primary text-sm">timeline</span>
                          Daily Action Audit Trail for {member.name} ({date})
                        </h5>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Device: {member.deviceType} • Browser: {member.browser} • OS: {member.os}
                        </span>
                      </div>

                      {member.actionTrail.length === 0 ? (
                        <p className="text-xs text-slate-400 py-3 text-center">
                          No page navigation or mutation logs recorded for this staff member on {date}.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
                          {member.actionTrail.map((item, idx) => (
                            <div
                              key={item.id || idx}
                              className="flex items-center justify-between gap-3 text-xs bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/70 dark:border-slate-700/60"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="font-mono text-[11px] text-primary font-bold shrink-0">
                                  {item.time}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                                  {item.action}
                                </span>
                                <span className="font-mono text-slate-800 dark:text-slate-200 truncate">
                                  {item.path}
                                </span>
                                {item.title && item.title !== item.path && (
                                  <span className="text-slate-400 text-[11px] truncate hidden md:inline">
                                    ({item.title})
                                  </span>
                                )}
                              </div>

                              <div className="text-right shrink-0 text-[10px] text-slate-400 font-mono">
                                {item.durationSeconds > 0 ? `${item.durationSeconds}s dwell` : ""}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
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
