"use client";

import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Users,
  Kanban,
  Clock,
  PhoneCall,
  Calendar,
  DollarSign,
  GraduationCap,
  Plus,
  Upload,
  Download,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import type {
  CrmLead,
  CrmDashboardMetrics,
  CounsellorOption,
  CourseOption,
  BatchOption,
} from "./types";
import { LeadDetailDrawer } from "./LeadDetailDrawer";
import { AddLeadModal } from "./AddLeadModal";
import { ImportCsvModal } from "./ImportCsvModal";

interface EnterpriseCrmPortalProps {
  initialMetrics: CrmDashboardMetrics;
  initialLeads: CrmLead[];
  counselors: CounsellorOption[];
  courses: CourseOption[];
  batches: BatchOption[];
  canUpdate: boolean;
  canAssign: boolean;
}

export function EnterpriseCrmPortal({
  initialMetrics,
  initialLeads,
  counselors,
  courses,
  batches,
  canUpdate,
  canAssign,
}: EnterpriseCrmPortalProps) {
  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "leads" | "kanban" | "followups" | "calling" | "counselling" | "campaigns" | "admissions"
  >("dashboard");

  // Metrics & Leads State
  const [metrics, setMetrics] = useState<CrmDashboardMetrics>(initialMetrics);
  const [leads, setLeads] = useState<CrmLead[]>(initialLeads);
  const [loadingLeads, setLoadingLeads] = useState(false);

  // Search & Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [counsellorFilter, setCounsellorFilter] = useState("ALL");
  const [examFilter, setExamFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(initialMetrics.kpis.totalLeads);

  // Bulk Selection
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkAssignee, setBulkAssignee] = useState("");

  // Modals & Drawer
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Follow-ups state
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [followUpFilter, setFollowUpFilter] = useState<"all" | "today" | "overdue" | "upcoming">("today");

  // Counselling sessions state
  const [counsellingSessions, setCounsellingSessions] = useState<any[]>([]);

  // Campaigns state
  const [campaigns, setCampaigns] = useState<any[]>(initialMetrics.campaigns || []);

  // Fetch metrics & leads when filters change
  useEffect(() => {
    fetchLeads();
  }, [search, statusFilter, priorityFilter, sourceFilter, counsellorFilter, examFilter, page]);

  useEffect(() => {
    if (activeTab === "dashboard") {
      refreshMetrics();
    } else if (activeTab === "followups") {
      fetchFollowUps();
    } else if (activeTab === "counselling") {
      fetchCounselling();
    } else if (activeTab === "campaigns") {
      fetchCampaigns();
    }
  }, [activeTab, followUpFilter]);

  async function refreshMetrics() {
    try {
      const res = await fetch("/api/crm/dashboard");
      const json = await res.json();
      if (json.success) {
        setMetrics(json.data);
      }
    } catch {
      // silent
    }
  }

  async function fetchLeads() {
    setLoadingLeads(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (priorityFilter !== "ALL") params.set("priority", priorityFilter);
      if (sourceFilter !== "ALL") params.set("source", sourceFilter);
      if (counsellorFilter !== "ALL") params.set("assignedUserId", counsellorFilter);
      if (examFilter !== "ALL") params.set("targetExam", examFilter);
      params.set("page", String(page));
      params.set("limit", "25");

      const res = await fetch(`/api/crm/leads?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setLeads(json.data.leads);
        setTotalPages(json.data.pagination.totalPages);
        setTotalCount(json.data.pagination.total);
      }
    } catch {
      toast.error("Could not fetch leads");
    } finally {
      setLoadingLeads(false);
    }
  }

  async function fetchFollowUps() {
    try {
      const res = await fetch(`/api/crm/followups?dateFilter=${followUpFilter}`);
      const json = await res.json();
      if (json.success) {
        setFollowUps(json.data.followUps);
      }
    } catch {
      toast.error("Failed to fetch follow-ups");
    }
  }

  async function fetchCounselling() {
    try {
      const res = await fetch("/api/crm/counselling");
      const json = await res.json();
      if (json.success) {
        setCounsellingSessions(json.data.sessions);
      }
    } catch {
      toast.error("Failed to fetch counselling sessions");
    }
  }

  async function fetchCampaigns() {
    try {
      const res = await fetch("/api/crm/campaigns");
      const json = await res.json();
      if (json.success) {
        setCampaigns(json.data.campaigns);
      }
    } catch {
      // silent
    }
  }

  async function handleBulkAssign() {
    if (selectedLeadIds.length === 0) {
      toast.error("Please select at least one lead");
      return;
    }
    try {
      const res = await fetch("/api/crm/leads/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadIds: selectedLeadIds,
          assignedUserId: bulkAssignee || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Successfully assigned ${selectedLeadIds.length} leads!`);
        setSelectedLeadIds([]);
        fetchLeads();
        refreshMetrics();
      } else {
        toast.error(json.error || "Bulk assignment failed");
      }
    } catch {
      toast.error("Error performing bulk assignment");
    }
  }

  async function handleCompleteFollowUp(id: string) {
    try {
      const res = await fetch(`/api/crm/followups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED", outcome: "Task completed by counsellor" }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Follow-up marked as completed");
        fetchFollowUps();
        refreshMetrics();
      }
    } catch {
      toast.error("Error updating follow-up");
    }
  }

  // Toggle select all
  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedLeadIds(leads.map((l) => l.id));
    } else {
      setSelectedLeadIds([]);
    }
  }

  function handleSelectLead(id: string, checked: boolean) {
    if (checked) {
      setSelectedLeadIds((prev) => [...prev, id]);
    } else {
      setSelectedLeadIds((prev) => prev.filter((i) => i !== id));
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-outline-variant/20">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary text-white">
              Enterprise CRM
            </span>
            <span className="text-xs text-on-surface-variant font-mono">v2.0 • EdTech Operations</span>
          </div>
          <h1 className="text-2xl font-bold text-on-surface mt-1">Atomic Pathshala — Growth & CRM</h1>
          <p className="text-xs text-on-surface-variant">
            Centralized lead acquisition, counsellor calling, follow-ups, campaigns, and LMS admission pipeline.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-outline-variant/30 bg-surface hover:bg-surface-container transition"
          >
            <Upload className="w-3.5 h-3.5 text-primary" />
            Import CSV
          </button>
          <a
            href="/api/crm/leads/export"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-outline-variant/30 bg-surface hover:bg-surface-container transition"
          >
            <Download className="w-3.5 h-3.5 text-primary" />
            Export CSV
          </a>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-primary text-white hover:bg-primary/90 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add New Lead
          </button>
        </div>
      </div>

      {/* Main CRM Navigation Bar */}
      <div className="flex items-center gap-2 border-b border-outline-variant/20 overflow-x-auto pb-1 bg-surface-container-lowest p-1.5 rounded-xl">
        {[
          { id: "dashboard", label: "CRM Dashboard", icon: LayoutDashboard },
          { id: "leads", label: "All Leads", icon: Users },
          { id: "kanban", label: "Pipeline (Kanban)", icon: Kanban },
          { id: "followups", label: `Follow-ups (${metrics.kpis.followUpsDueToday})`, icon: Clock },
          { id: "calling", label: "Calling Center", icon: PhoneCall },
          { id: "counselling", label: "Counselling Desk", icon: Calendar },
          { id: "campaigns", label: "Campaigns & ROAS", icon: DollarSign },
          { id: "admissions", label: `Admissions (${metrics.kpis.enrolled})`, icon: GraduationCap },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition whitespace-nowrap ${
                active
                  ? "bg-primary text-white shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: DASHBOARD */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Key KPI Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Total Leads", value: metrics.kpis.totalLeads, color: "text-blue-600", bg: "bg-blue-500/10" },
              { label: "New Today", value: metrics.kpis.newToday, color: "text-emerald-600", bg: "bg-emerald-500/10" },
              { label: "Hot Leads", value: metrics.kpis.hotLeads, color: "text-red-600", bg: "bg-red-500/10" },
              { label: "Unassigned", value: metrics.kpis.unassigned, color: "text-amber-600", bg: "bg-amber-500/10" },
              { label: "Due Follow-ups", value: metrics.kpis.followUpsDueToday, color: "text-indigo-600", bg: "bg-indigo-500/10" },
              { label: "Total Enrolled", value: metrics.kpis.enrolled, color: "text-green-700", bg: "bg-green-600/10" },
            ].map((kpi, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-outline-variant/20 bg-surface shadow-xs space-y-1">
                <span className="text-[11px] font-semibold text-on-surface-variant block">{kpi.label}</span>
                <span className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</span>
              </div>
            ))}
          </div>

          {/* Secondary Operational Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl border border-outline-variant/20 bg-surface flex items-center justify-between">
              <div>
                <span className="text-xs text-on-surface-variant font-medium">Conversion Rate</span>
                <p className="text-xl font-bold text-primary">{metrics.kpis.conversionRate}</p>
              </div>
              <TrendingUp className="w-7 h-7 text-primary/40" />
            </div>
            <div className="p-4 rounded-xl border border-outline-variant/20 bg-surface flex items-center justify-between">
              <div>
                <span className="text-xs text-on-surface-variant font-medium">Counselling Scheduled</span>
                <p className="text-xl font-bold text-amber-700">{metrics.kpis.counsellingScheduled}</p>
              </div>
              <Calendar className="w-7 h-7 text-amber-500/40" />
            </div>
            <div className="p-4 rounded-xl border border-outline-variant/20 bg-surface flex items-center justify-between">
              <div>
                <span className="text-xs text-on-surface-variant font-medium">Overdue Follow-ups</span>
                <p className="text-xl font-bold text-red-600">{metrics.kpis.overdueFollowUps}</p>
              </div>
              <AlertCircle className="w-7 h-7 text-red-500/40" />
            </div>
            <div className="p-4 rounded-xl border border-outline-variant/20 bg-surface flex items-center justify-between">
              <div>
                <span className="text-xs text-on-surface-variant font-medium">Active Counsellors</span>
                <p className="text-xl font-bold text-emerald-600">{counselors.length}</p>
              </div>
              <UserCheck className="w-7 h-7 text-emerald-500/40" />
            </div>
          </div>

          {/* Conversion Funnel & Source Distribution Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Funnel Card */}
            <div className="p-5 rounded-2xl border border-outline-variant/20 bg-surface space-y-4">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Student Acquisition Funnel
              </h3>
              <div className="space-y-3 pt-2">
                {metrics.funnel.map((f, i) => {
                  const maxCount = metrics.funnel[0]?.count || 1;
                  const pct = Math.max(8, Math.round((f.count / maxCount) * 100));
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-on-surface">{f.stage}</span>
                        <span className="text-primary font-bold">{f.count} students</span>
                      </div>
                      <div className="w-full bg-surface-container rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Source Distribution Card */}
            <div className="p-5 rounded-2xl border border-outline-variant/20 bg-surface space-y-4">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" /> Acquisition Source Breakdown
              </h3>
              <div className="grid grid-cols-2 gap-3 pt-2">
                {metrics.sourceCounts.map((sc, i) => (
                  <div key={i} className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/20">
                    <span className="text-[11px] font-medium text-on-surface-variant uppercase">{sc.source}</span>
                    <p className="text-lg font-bold text-on-surface mt-0.5">{sc.count} leads</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Counsellor Performance Board */}
          <div className="p-5 rounded-2xl border border-outline-variant/20 bg-surface space-y-4">
            <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-primary" /> Counsellor Productivity & Performance Board
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-outline-variant/20 text-on-surface-variant font-bold uppercase">
                    <th className="py-2.5 px-3">Counsellor Name</th>
                    <th className="py-2.5 px-3">Assigned Active Leads</th>
                    <th className="py-2.5 px-3">Calls Made</th>
                    <th className="py-2.5 px-3">Counselling Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {metrics.counselorPerformance.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-on-surface-variant">
                        No counsellor activity logged yet.
                      </td>
                    </tr>
                  ) : (
                    metrics.counselorPerformance.map((cp) => (
                      <tr key={cp.id} className="hover:bg-surface-container/50">
                        <td className="py-2.5 px-3 font-semibold text-on-surface">{cp.name}</td>
                        <td className="py-2.5 px-3 font-bold text-blue-600">{cp.assignedLeads}</td>
                        <td className="py-2.5 px-3 font-bold text-emerald-600">{cp.callsMade}</td>
                        <td className="py-2.5 px-3 font-bold text-primary">{cp.counsellingCompleted}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ALL LEADS TABLE */}
      {activeTab === "leads" && (
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="p-4 rounded-2xl border border-outline-variant/20 bg-surface space-y-3">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-on-surface-variant" />
                <input
                  type="text"
                  placeholder="Search by student name, phone number, email, or Lead ID..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-outline-variant/30 bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="text-xs p-2 rounded-xl border border-outline-variant/30 bg-surface font-semibold"
                >
                  <option value="ALL">All Stages</option>
                  <option value="NEW_LEAD">New Lead</option>
                  <option value="FIRST_CALL_PENDING">First Call Pending</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="INTERESTED">Interested</option>
                  <option value="HIGHLY_INTERESTED">Highly Interested</option>
                  <option value="COUNSELLING_SCHEDULED">Counselling Scheduled</option>
                  <option value="DEMO_ATTENDED">Demo Attended</option>
                  <option value="PAYMENT_PENDING">Payment Pending</option>
                  <option value="ADMISSION_CONFIRMED">Admission Confirmed</option>
                  <option value="ENROLLED">Enrolled</option>
                  <option value="NOT_INTERESTED">Not Interested</option>
                  <option value="LOST">Lost</option>
                </select>

                <select
                  value={priorityFilter}
                  onChange={(e) => {
                    setPriorityFilter(e.target.value);
                    setPage(1);
                  }}
                  className="text-xs p-2 rounded-xl border border-outline-variant/30 bg-surface font-semibold"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="HOT">🔥 Hot Leads</option>
                  <option value="WARM">⚡ Warm Leads</option>
                  <option value="COLD">❄️ Cold Leads</option>
                </select>

                <select
                  value={examFilter}
                  onChange={(e) => {
                    setExamFilter(e.target.value);
                    setPage(1);
                  }}
                  className="text-xs p-2 rounded-xl border border-outline-variant/30 bg-surface"
                >
                  <option value="ALL">All Exams</option>
                  <option value="NEET">NEET</option>
                  <option value="JEE">JEE</option>
                  <option value="BOARDS">Boards</option>
                </select>

                <select
                  value={counsellorFilter}
                  onChange={(e) => {
                    setCounsellorFilter(e.target.value);
                    setPage(1);
                  }}
                  className="text-xs p-2 rounded-xl border border-outline-variant/30 bg-surface"
                >
                  <option value="ALL">All Counsellors</option>
                  <option value="UNASSIGNED">Unassigned Only</option>
                  {counselors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bulk Selection Bar */}
            {selectedLeadIds.length > 0 && (
              <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-between text-xs flex-wrap gap-2 animate-in fade-in">
                <span className="font-bold text-primary">
                  {selectedLeadIds.length} lead{selectedLeadIds.length > 1 ? "s" : ""} selected
                </span>

                <div className="flex items-center gap-2">
                  <select
                    value={bulkAssignee}
                    onChange={(e) => setBulkAssignee(e.target.value)}
                    className="text-xs p-1.5 rounded-lg border border-primary/30 bg-surface"
                  >
                    <option value="">Assign to Counsellor...</option>
                    {counselors.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleBulkAssign}
                    className="px-3 py-1.5 bg-primary text-white font-bold rounded-lg hover:bg-primary/90"
                  >
                    Apply Bulk Assignment
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Leads Data Table */}
          <div className="rounded-2xl border border-outline-variant/20 bg-surface overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container-low border-b border-outline-variant/20 text-on-surface-variant uppercase font-bold tracking-wider">
                  <tr>
                    <th className="py-3 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={leads.length > 0 && selectedLeadIds.length === leads.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded"
                      />
                    </th>
                    <th className="py-3 px-3">Student Name & ID</th>
                    <th className="py-3 px-3">Contact</th>
                    <th className="py-3 px-3">Academic Target</th>
                    <th className="py-3 px-3">Stage & Status</th>
                    <th className="py-3 px-3">Score</th>
                    <th className="py-3 px-3">Counsellor</th>
                    <th className="py-3 px-3">Next Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {loadingLeads ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-on-surface-variant">
                        Loading leads from database...
                      </td>
                    </tr>
                  ) : leads.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-on-surface-variant font-medium">
                        No leads found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    leads.map((lead) => {
                      const isSelected = selectedLeadIds.includes(lead.id);
                      return (
                        <tr
                          key={lead.id}
                          className={`hover:bg-surface-container/40 transition cursor-pointer ${
                            isSelected ? "bg-primary/5" : ""
                          }`}
                          onClick={() => setSelectedLeadId(lead.id)}
                        >
                          <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => handleSelectLead(lead.id, e.target.checked)}
                              className="rounded"
                            />
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-on-surface hover:text-primary transition block">
                              {lead.name}
                            </span>
                            <span className="text-[10px] font-mono text-on-surface-variant">
                              {lead.leadCode}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <p className="font-semibold text-on-surface">{lead.phone}</p>
                            <p className="text-[10px] text-on-surface-variant truncate max-w-[140px]">
                              {lead.email || lead.city || "—"}
                            </p>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-on-surface">
                              {lead.targetExam || "NEET"} · {lead.studentClass || "12th"}
                            </span>
                            <span className="text-[10px] text-on-surface-variant block">
                              {lead.medium || "Hindi"} Medium
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide inline-block ${
                                lead.status === "ENROLLED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : lead.status === "PAYMENT_PENDING"
                                  ? "bg-amber-100 text-amber-800"
                                  : lead.status === "COUNSELLING_SCHEDULED"
                                  ? "bg-purple-100 text-purple-800"
                                  : lead.status === "HOT" || lead.priority === "HOT"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-surface-container-high text-on-surface-variant"
                              }`}
                            >
                              {lead.status.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-black ${
                                lead.score >= 70
                                  ? "bg-red-50 text-red-700"
                                  : lead.score >= 40
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {lead.score} pts
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-on-surface font-medium block">
                              {lead.assignedUser?.name || "Unassigned"}
                            </span>
                          </td>
                          <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1.5">
                              <a
                                href={`tel:${lead.phone}`}
                                title="Click to call"
                                className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                              >
                                <PhoneCall className="w-3.5 h-3.5" />
                              </a>
                              <a
                                href={`https://wa.me/${lead.cleanPhone}`}
                                target="_blank"
                                rel="noreferrer"
                                title="Open WhatsApp"
                                className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-3 bg-surface-container-low border-t border-outline-variant/20 flex items-center justify-between text-xs">
              <span className="text-on-surface-variant font-medium">
                Showing {leads.length} of {totalCount} total leads
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded border border-outline-variant/30 hover:bg-surface disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-bold text-on-surface">
                  Page {page} of {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-1.5 rounded border border-outline-variant/30 hover:bg-surface disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PIPELINE KANBAN */}
      {activeTab === "kanban" && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-[1200px]">
            {[
              { id: "NEW_LEAD", label: "New Leads", color: "border-blue-500" },
              { id: "CONTACTED", label: "Contacted / In Call", color: "border-cyan-500" },
              { id: "INTERESTED", label: "Interested", color: "border-amber-500" },
              { id: "COUNSELLING_SCHEDULED", label: "Counselling", color: "border-purple-500" },
              { id: "PAYMENT_PENDING", label: "Payment Pending", color: "border-orange-500" },
              { id: "ENROLLED", label: "Enrolled (LMS)", color: "border-emerald-500" },
            ].map((col) => {
              const colLeads = leads.filter(
                (l) => l.status === col.id || (col.id === "CONTACTED" && l.status === "FIRST_CALL_PENDING")
              );
              return (
                <div
                  key={col.id}
                  className="flex-1 bg-surface-container-low rounded-2xl p-3 border border-outline-variant/20 min-w-[220px] flex flex-col space-y-3"
                >
                  <div className={`border-t-2 ${col.color} pt-2 flex items-center justify-between`}>
                    <h4 className="text-xs font-bold text-on-surface">{col.label}</h4>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-surface text-on-surface-variant">
                      {colLeads.length}
                    </span>
                  </div>

                  <div className="space-y-2 flex-1 overflow-y-auto max-h-[600px]">
                    {colLeads.map((l) => (
                      <div
                        key={l.id}
                        onClick={() => setSelectedLeadId(l.id)}
                        className="p-3 bg-surface rounded-xl border border-outline-variant/20 shadow-xs hover:border-primary/50 transition cursor-pointer space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-on-surface">{l.name}</span>
                          <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                            {l.score} pts
                          </span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant font-mono">{l.phone}</p>
                        <div className="flex items-center justify-between text-[10px] text-on-surface-variant pt-1 border-t border-outline-variant/10">
                          <span>{l.targetExam || "NEET"}</span>
                          <span className="text-primary font-medium">{l.assignedUser?.name || "Unassigned"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: FOLLOW-UPS & TASKS */}
      {activeTab === "followups" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {[
              { id: "today", label: "Due Today" },
              { id: "overdue", label: "Overdue" },
              { id: "upcoming", label: "Upcoming" },
              { id: "all", label: "All Tasks" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFollowUpFilter(f.id as any)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg ${
                  followUpFilter === f.id
                    ? "bg-primary text-white"
                    : "bg-surface border border-outline-variant/20 text-on-surface-variant"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-outline-variant/20 bg-surface divide-y divide-outline-variant/10">
            {followUps.length === 0 ? (
              <p className="p-8 text-center text-xs text-on-surface-variant">No follow-ups in this queue.</p>
            ) : (
              followUps.map((fu: any) => (
                <div key={fu.id} className="p-4 flex items-center justify-between gap-4 flex-wrap hover:bg-surface-container/30">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-on-surface">{fu.title}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          fu.priority === "HOT"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {fu.priority}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant">
                      Student: <b>{fu.lead?.name}</b> ({fu.lead?.phone}) · Scheduled:{" "}
                      {new Date(fu.scheduledAt).toLocaleString("en-IN")}
                    </p>
                    {fu.description && (
                      <p className="text-xs text-on-surface-variant/80">{fu.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedLeadId(fu.leadId)}
                      className="px-3 py-1.5 rounded-lg border border-outline-variant/30 text-xs font-medium hover:bg-surface-container"
                    >
                      Open Lead
                    </button>
                    {fu.status === "PENDING" && (
                      <button
                        onClick={() => handleCompleteFollowUp(fu.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                      >
                        Mark Completed
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 5: CALLING CENTER */}
      {activeTab === "calling" && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-outline-variant/20 bg-surface space-y-2">
            <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-primary" /> Integrated Counsellor Calling Center
            </h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Click any student row to trigger instant click-to-call, record call outcomes (Connected, Busy, Switched Off, Interested), and automatically queue the next follow-up.
            </p>
          </div>

          <div className="rounded-2xl border border-outline-variant/20 bg-surface overflow-hidden">
            <div className="p-4 border-b border-outline-variant/20 font-bold text-xs text-on-surface">
              Calling Queue (High Intent Leads)
            </div>
            <div className="divide-y divide-outline-variant/10">
              {leads.slice(0, 15).map((l) => (
                <div key={l.id} className="p-4 flex items-center justify-between gap-4 hover:bg-surface-container/30">
                  <div>
                    <h4 className="text-xs font-bold text-on-surface">{l.name}</h4>
                    <p className="text-[11px] text-on-surface-variant">
                      {l.phone} · {l.targetExam || "NEET"} · Priority: {l.priority}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedLeadId(l.id)}
                    className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 flex items-center gap-1.5"
                  >
                    <PhoneCall className="w-3.5 h-3.5" /> Call & Log Notes
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: COUNSELLING DESK */}
      {activeTab === "counselling" && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-outline-variant/20 bg-surface space-y-2">
            <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" /> Academic Counselling & Demo Sessions Desk
            </h3>
            <p className="text-xs text-on-surface-variant">
              Manage scheduled 1-on-1 parent & student counselling meetings, demo class recommendations, and batch alignments.
            </p>
          </div>

          <div className="rounded-2xl border border-outline-variant/20 bg-surface divide-y divide-outline-variant/10">
            {counsellingSessions.length === 0 ? (
              <p className="p-8 text-center text-xs text-on-surface-variant">No counselling sessions scheduled.</p>
            ) : (
              counsellingSessions.map((cs: any) => (
                <div key={cs.id} className="p-4 flex items-center justify-between gap-4 hover:bg-surface-container/30">
                  <div className="space-y-1">
                    <span className="font-bold text-xs text-on-surface">{cs.lead?.name}</span>
                    <p className="text-xs text-on-surface-variant">
                      Date: <b>{new Date(cs.scheduledAt).toLocaleString("en-IN")}</b> · Mode: {cs.mode}
                    </p>
                    {cs.counsellingNotes && (
                      <p className="text-xs text-on-surface-variant/80">{cs.counsellingNotes}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedLeadId(cs.leadId)}
                    className="px-3 py-1.5 rounded-lg border border-outline-variant/30 text-xs font-semibold hover:bg-surface"
                  >
                    View Details
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 7: CAMPAIGNS & ROAS */}
      {activeTab === "campaigns" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {campaigns.map((camp: any) => (
              <div key={camp.id} className="p-5 rounded-2xl border border-outline-variant/20 bg-surface space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 uppercase">
                    {camp.platform}
                  </span>
                  <span className="text-xs font-bold text-emerald-600">Active</span>
                </div>
                <h4 className="font-bold text-xs text-on-surface">{camp.name}</h4>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-on-surface-variant text-[10px]">Total Spend:</span>
                    <p className="font-bold text-on-surface">₹{camp.spend?.toLocaleString("en-IN") || 0}</p>
                  </div>
                  <div>
                    <span className="text-on-surface-variant text-[10px]">Cost Per Lead:</span>
                    <p className="font-bold text-primary">₹{camp.cpl || 0}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 8: ADMISSIONS (LMS SYNC) */}
      {activeTab === "admissions" && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-outline-variant/20 bg-surface space-y-2">
            <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-primary" /> LMS Enrolled Students
            </h3>
            <p className="text-xs text-on-surface-variant">
              Every confirmed admission here is natively linked to the student LMS portal with active batch enrollments.
            </p>
          </div>

          <div className="rounded-2xl border border-outline-variant/20 bg-surface divide-y divide-outline-variant/10">
            {leads.filter((l) => l.isConverted || l.status === "ENROLLED").map((l) => (
              <div key={l.id} className="p-4 flex items-center justify-between gap-4 hover:bg-surface-container/30">
                <div>
                  <h4 className="text-xs font-bold text-on-surface">{l.name}</h4>
                  <p className="text-[11px] text-on-surface-variant">
                    {l.phone} · Enrolled in: <b>{l.targetBatch?.name || "Selection Pro Batch"}</b>
                  </p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Enrolled Active
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals & Drawer */}
      <LeadDetailDrawer
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onLeadUpdated={() => {
          fetchLeads();
          refreshMetrics();
        }}
        counselors={counselors}
        courses={courses}
        batches={batches}
      />

      <AddLeadModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onLeadCreated={() => {
          fetchLeads();
          refreshMetrics();
        }}
        counselors={counselors}
        courses={courses}
        batches={batches}
      />

      <ImportCsvModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={() => {
          fetchLeads();
          refreshMetrics();
        }}
      />
    </div>
  );
}
