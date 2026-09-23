"use client";

import React, { useState, useEffect, useCallback } from "react";

interface JourneyStep {
  path: string;
  title: string;
  time: string;
  action: string;
}

interface VisitorLead {
  visitorKey: string;
  visitorId: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  isRegistered: boolean;
  ipAddress: string;
  city: string;
  country: string;
  deviceType: string;
  browser: string;
  pageViewsCount: number;
  uniquePagesCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  intentScore: number;
  intentTier: "HOT" | "WARM" | "COLD";
  targetExamInterest: string;
  hasViewedPricing: boolean;
  hasClickedEnroll: boolean;
  hasViewedCourse: boolean;
  dropOffPage: string;
  journeySteps: JourneyStep[];
}

export function VisitorFunnelTab() {
  const [leads, setLeads] = useState<VisitorLead[]>([]);
  const [summary, setSummary] = useState({
    totalUniqueVisitors: 0,
    hotLeadsCount: 0,
    warmLeadsCount: 0,
  });
  const [filter, setFilter] = useState("ALL"); // ALL, HIGH_INTENT, WARM
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedLeadKey, setExpandedLeadKey] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter !== "ALL") params.set("filter", filter);
      if (searchQuery) params.set("q", searchQuery);

      const res = await fetch(`/api/team/analytics/visitors-leads?${params.toString()}`);
      const json = await res.json();
      if (json.ok) {
        setLeads(json.leads || []);
        setSummary(json.summary);
      }
    } catch (err) {
      console.error("Failed to load visitor leads data:", err);
    } finally {
      setLoading(false);
    }
  }, [filter, searchQuery]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const getIntentBadge = (tier: "HOT" | "WARM" | "COLD", score: number) => {
    if (tier === "HOT") {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center gap-1">
          <span>🔥</span> HOT PROSPECT ({score}%)
        </span>
      );
    }
    if (tier === "WARM") {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
          <span>⚡</span> WARM LEAD ({score}%)
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
        EXPLORING ({score}%)
      </span>
    );
  };

  const formatRelativeTime = (iso: string) => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* KPI Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400">
            <span className="material-symbols-outlined text-2xl">local_fire_department</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{summary.hotLeadsCount}</p>
            <p className="text-xs text-slate-500 font-medium">High-Intent Purchase Leads</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <span className="material-symbols-outlined text-2xl">bolt</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{summary.warmLeadsCount}</p>
            <p className="text-xs text-slate-500 font-medium">Warm Course Inquirers</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-2xl">travel_explore</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{summary.totalUniqueVisitors}</p>
            <p className="text-xs text-slate-500 font-medium">Tracked Unique Visitors</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl">
          {(["ALL", "HIGH_INTENT", "WARM"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === f
                  ? "bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              {f === "ALL" ? "All Visitors" : f === "HIGH_INTENT" ? "🔥 Hot Leads Only" : "⚡ Warm Leads"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              search
            </span>
            <input
              type="text"
              placeholder="Search city, IP, email, exam..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <button
            onClick={fetchLeads}
            disabled={loading}
            className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 transition-colors"
          >
            <span className={`material-symbols-outlined text-sm ${loading ? "animate-spin" : ""}`}>
              refresh
            </span>
          </button>
        </div>
      </div>

      {/* Leads List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-3xl animate-spin text-primary">
              progress_activity
            </span>
            <p className="text-xs font-medium">Analyzing visitor journeys and buying signals...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">
              person_search
            </span>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No leads recorded yet</p>
            <p className="text-xs text-slate-500">As visitors browse courses and checkout funnels, lead intelligence will populate automatically.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {leads.map((lead) => {
              const isExpanded = expandedLeadKey === lead.visitorKey;

              return (
                <div key={lead.visitorKey} className="p-4 transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Visitor Identification */}
                    <div className="flex items-center gap-3 min-w-[260px]">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-700 dark:text-slate-200">
                        {lead.userName ? lead.userName.charAt(0).toUpperCase() : "G"}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                            {lead.userName || `Visitor ${lead.ipAddress}`}
                          </h4>
                          {getIntentBadge(lead.intentTier, lead.intentScore)}
                        </div>
                        <p className="text-xs text-slate-500">
                          {lead.userEmail || lead.ipAddress} • {lead.city}, {lead.country}
                        </p>
                      </div>
                    </div>

                    {/* Interest & Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        <p className="text-slate-400 font-medium text-[10px]">Target Exam Interest</p>
                        <p className="font-bold text-primary mt-0.5">{lead.targetExamInterest}</p>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        <p className="text-slate-400 font-medium text-[10px]">Funnel Status</p>
                        <p className="font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                          {lead.hasClickedEnroll ? "Clicked Enroll" : lead.hasViewedPricing ? "Viewed Pricing" : "Viewed Courses"}
                        </p>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        <p className="text-slate-400 font-medium text-[10px]">Pages Explored</p>
                        <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                          {lead.uniquePagesCount} pages ({lead.pageViewsCount} views)
                        </p>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        <p className="text-slate-400 font-medium text-[10px]">Last Active</p>
                        <p className="font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                          {formatRelativeTime(lead.lastSeenAt)}
                        </p>
                      </div>
                    </div>

                    {/* Action button */}
                    <div className="flex items-center justify-end shrink-0">
                      <button
                        onClick={() => setExpandedLeadKey(isExpanded ? null : lead.visitorKey)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          isExpanded
                            ? "bg-primary text-white shadow-md"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">
                          {isExpanded ? "expand_less" : "route"}
                        </span>
                        <span>{isExpanded ? "Hide Journey" : "View Journey"}</span>
                      </button>
                    </div>
                  </div>

                  {/* 5-Step Journey Visualizer */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-4 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-primary text-sm">conversion_path</span>
                          Visitor Navigation Journey & Exit Point
                        </h5>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Device: {lead.deviceType} • Browser: {lead.browser}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {lead.journeySteps.map((step, idx) => (
                          <React.Fragment key={idx}>
                            <div className="bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-2">
                              <span className="font-mono text-[10px] text-slate-400">{step.time}</span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                                {step.path}
                              </span>
                              {idx === lead.journeySteps.length - 1 && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                                  Exit Point
                                </span>
                              )}
                            </div>
                            {idx < lead.journeySteps.length - 1 && (
                              <span className="text-slate-400 material-symbols-outlined text-sm">
                                arrow_forward
                              </span>
                            )}
                          </React.Fragment>
                        ))}
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
