"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { BroadcastManager } from "@/components/team-portal/BroadcastManager";

interface Batch {
  id: string;
  name: string;
  code: string;
}

interface AdminNotificationHubProps {
  canSend: boolean;
  batches: Batch[];
  initialBroadcasts: any[];
}

export function AdminNotificationHub({
  canSend,
  batches,
  initialBroadcasts,
}: AdminNotificationHubProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "broadcast" | "scheduler" | "queue" | "templates" | "rules" | "logs"
  >("overview");

  // Analytics Stats
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Scheduled Queue
  const [scheduledJobs, setScheduledJobs] = useState<any[]>([]);
  const [loadingScheduled, setLoadingScheduled] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);

  // Automation Rules
  const [rules, setRules] = useState<any[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);

  // Delivery Logs
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const [totalLogPages, setTotalLogPages] = useState(1);

  // New Scheduled / Custom Notification Form State
  const [scheduleForm, setScheduleForm] = useState({
    title: "",
    message: "",
    category: "ACADEMIC",
    priority: "NORMAL",
    targetType: "ALL_STUDENTS", // ALL_STUDENTS, BATCH, USER
    targetId: "",
    actionType: "NONE",
    actionUrl: "",
    executeAt: "",
    soundEnabled: true,
    showPopup: true,
  });
  const [submittingSchedule, setSubmittingSchedule] = useState(false);

  // New Template Form State
  const [templateForm, setTemplateForm] = useState({
    templateName: "",
    category: "ACADEMIC",
    priority: "NORMAL",
    title: "",
    message: "",
    actionType: "",
    actionUrl: "",
    targetAudience: "ALL_STUDENTS",
    isActive: true,
    rotationMessages: "",
  });

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await fetch("/api/team/notifications/analytics");
      const json = await res.json();
      if (json.success) setStats(json.stats);
    } catch {
      // ignore
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchScheduled = useCallback(async () => {
    setLoadingScheduled(true);
    try {
      const res = await fetch("/api/team/notifications/scheduled");
      const json = await res.json();
      if (json.success) setScheduledJobs(json.scheduled);
    } catch {
      toast.error("Failed to load scheduled queue");
    } finally {
      setLoadingScheduled(false);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch("/api/team/notifications/templates");
      const json = await res.json();
      if (json.success) setTemplates(json.templates);
    } catch {
      toast.error("Failed to load templates");
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  const fetchRules = useCallback(async () => {
    setLoadingRules(true);
    try {
      const res = await fetch("/api/team/notifications/rules");
      const json = await res.json();
      if (json.success) setRules(json.rules);
    } catch {
      toast.error("Failed to load rules");
    } finally {
      setLoadingRules(false);
    }
  }, []);

  const fetchLogs = useCallback(async (page = 1) => {
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/team/notifications/logs?page=${page}`);
      const json = await res.json();
      if (json.success) {
        setLogs(json.logs);
        setLogPage(json.page);
        setTotalLogPages(json.totalPages);
      }
    } catch {
      toast.error("Failed to load audit logs");
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (activeTab === "queue") fetchScheduled();
    if (activeTab === "templates") fetchTemplates();
    if (activeTab === "rules") fetchRules();
    if (activeTab === "logs") fetchLogs(1);
  }, [activeTab, fetchScheduled, fetchTemplates, fetchRules, fetchLogs]);

  // Cancel Scheduled Job
  async function handleCancelJob(jobId: string) {
    if (!confirm("Are you sure you want to cancel this scheduled notification?")) return;
    try {
      const res = await fetch("/api/team/notifications/scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, action: "cancel" }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Notification cancelled");
        fetchScheduled();
      } else {
        toast.error(json.error || "Failed to cancel");
      }
    } catch {
      toast.error("Error cancelling notification");
    }
  }

  // Toggle Rule
  async function handleToggleRule(rule: any) {
    try {
      const res = await fetch("/api/team/notifications/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: rule.id,
          isEnabled: !rule.isEnabled,
          priority: rule.priority,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Rule ${!rule.isEnabled ? "enabled" : "disabled"}`);
        setRules((prev) =>
          prev.map((r) => (r.id === rule.id ? { ...r, isEnabled: !rule.isEnabled } : r))
        );
      } else {
        toast.error(json.error || "Failed to update rule");
      }
    } catch {
      toast.error("Error updating rule");
    }
  }

  // Submit Schedule Form
  async function handleSubmitSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduleForm.title.trim() || !scheduleForm.message.trim()) {
      toast.error("Title and message are required");
      return;
    }
    setSubmittingSchedule(true);
    try {
      // Direct broadcast / dispatch or scheduled job
      const isScheduled = !!scheduleForm.executeAt;
      const res = await fetch("/api/team/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: scheduleForm.title,
          body: scheduleForm.message,
          segmentType: scheduleForm.targetType === "BATCH" ? "BATCH" : "ALL",
          segmentValue: scheduleForm.targetType === "BATCH" ? scheduleForm.targetId : null,
          category: scheduleForm.category,
          priority: scheduleForm.priority,
          actionType: scheduleForm.actionType === "NONE" ? null : scheduleForm.actionType,
          actionUrl: scheduleForm.actionUrl || null,
          executeAt: isScheduled ? scheduleForm.executeAt : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(isScheduled ? "Notification scheduled!" : "Notification sent successfully!");
        setScheduleForm({
          title: "",
          message: "",
          category: "ACADEMIC",
          priority: "NORMAL",
          targetType: "ALL_STUDENTS",
          targetId: "",
          actionType: "NONE",
          actionUrl: "",
          executeAt: "",
          soundEnabled: true,
          showPopup: true,
        });
        fetchStats();
      } else {
        toast.error(json.error || "Failed to process notification");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSubmittingSchedule(false);
    }
  }

  // Save / Edit Template
  async function handleSaveTemplate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const rotArray = templateForm.rotationMessages
        ? templateForm.rotationMessages
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      const payload = {
        ...(editingTemplate ? { id: editingTemplate.id } : {}),
        templateName: templateForm.templateName,
        category: templateForm.category,
        priority: templateForm.priority,
        title: templateForm.title,
        message: templateForm.message,
        actionType: templateForm.actionType || null,
        actionUrl: templateForm.actionUrl || null,
        targetAudience: templateForm.targetAudience,
        isActive: templateForm.isActive,
        rotationMessages: rotArray.length > 0 ? rotArray : null,
      };

      const res = await fetch("/api/team/notifications/templates", {
        method: editingTemplate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(editingTemplate ? "Template updated" : "Template created");
        setEditingTemplate(null);
        setTemplateForm({
          templateName: "",
          category: "ACADEMIC",
          priority: "NORMAL",
          title: "",
          message: "",
          actionType: "",
          actionUrl: "",
          targetAudience: "ALL_STUDENTS",
          isActive: true,
          rotationMessages: "",
        });
        fetchTemplates();
      } else {
        toast.error(json.error || "Failed to save template");
      }
    } catch {
      toast.error("Error saving template");
    }
  }

  // Delete Template
  async function handleDeleteTemplate(id: string) {
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      const res = await fetch("/api/team/notifications/templates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Template deleted");
        fetchTemplates();
      } else {
        toast.error(json.error || "Failed to delete");
      }
    } catch {
      toast.error("Error deleting template");
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-3xl">notifications_active</span>
            Notification & Pop-up Control Center
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Real-time multi-channel delivery, automated class/test lifecycle triggers, scheduled broadcasts, and audit logs.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("scheduler")}
            className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-xl text-sm font-semibold shadow-md hover:bg-primary/90 transition-all"
          >
            <span className="material-symbols-outlined text-sm">schedule_send</span>
            Schedule Alert
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-outline-variant/30 gap-2 overflow-x-auto pb-1">
        {[
          { id: "overview", label: "Overview & Quick Stats", icon: "dashboard" },
          { id: "broadcast", label: "Multi-Channel Broadcast", icon: "campaign" },
          { id: "scheduler", label: "Custom Notification", icon: "edit_calendar" },
          { id: "queue", label: "Scheduled Queue", icon: "pending_actions" },
          { id: "templates", label: "Message Templates", icon: "auto_stories" },
          { id: "rules", label: "Automation Rules", icon: "tune" },
          { id: "logs", label: "Delivery & Audit Logs", icon: "manage_search" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30"
            }`}
          >
            <span className="material-symbols-outlined text-base">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW & QUICK STATS */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card p-5 rounded-2xl border border-outline-variant/30 space-y-2">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Sent</span>
                <span className="material-symbols-outlined text-primary text-xl">send</span>
              </div>
              <p className="text-2xl font-bold text-on-surface">
                {loadingStats ? "..." : (stats?.totalNotifications ?? 0).toLocaleString()}
              </p>
              <p className="text-xs text-on-surface-variant">
                +{stats?.sentToday ?? 0} dispatched today
              </p>
            </div>

            <div className="glass-card p-5 rounded-2xl border border-outline-variant/30 space-y-2">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="text-xs font-semibold uppercase tracking-wider">Engagement Click Rate</span>
                <span className="material-symbols-outlined text-emerald-500 text-xl">ads_click</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600">
                {loadingStats ? "..." : stats?.clickRate ?? "0.0%"}
              </p>
              <p className="text-xs text-on-surface-variant">
                {stats?.clickedDeliveries ?? 0} interactive actions taken
              </p>
            </div>

            <div className="glass-card p-5 rounded-2xl border border-outline-variant/30 space-y-2">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="text-xs font-semibold uppercase tracking-wider">Active Scheduled</span>
                <span className="material-symbols-outlined text-amber-500 text-xl">schedule</span>
              </div>
              <p className="text-2xl font-bold text-on-surface">
                {loadingStats ? "..." : stats?.scheduledCount ?? 0}
              </p>
              <p className="text-xs text-on-surface-variant">Waiting in delivery queue</p>
            </div>

            <div className="glass-card p-5 rounded-2xl border border-outline-variant/30 space-y-2">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="text-xs font-semibold uppercase tracking-wider">Active Rules</span>
                <span className="material-symbols-outlined text-indigo-500 text-xl">rule</span>
              </div>
              <p className="text-2xl font-bold text-on-surface">
                {loadingStats ? "..." : stats?.activeRulesCount ?? 15}
              </p>
              <p className="text-xs text-on-surface-variant">Automated trigger flows live</p>
            </div>
          </div>

          {/* Quick Actions & System Status Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Quick Summary */}
            <div className="glass-card p-6 rounded-2xl border border-outline-variant/30 space-y-4">
              <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">bolt</span>
                Autonomous Event Pipelines
              </h3>
              <div className="space-y-3 text-sm text-on-surface-variant">
                <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-outline-variant/20">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-medium text-on-surface">Live Class & 15m Alerts</span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                    Active
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-outline-variant/20">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-medium text-on-surface">Test Scheduled & Launch Alerts</span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                    Active
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-outline-variant/20">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-medium text-on-surface">DPP, PDF & Material Upload Triggers</span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                    Active
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-outline-variant/20">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-medium text-on-surface">Daily Morning Motivation Rotation</span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                    Active (Daily 07:00)
                  </span>
                </div>
              </div>
            </div>

            {/* Top Interactive Actions Breakdown */}
            <div className="glass-card p-6 rounded-2xl border border-outline-variant/30 space-y-4">
              <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-xl">bar_chart</span>
                Top Student Interactions
              </h3>
              {stats?.actionStats && stats.actionStats.length > 0 ? (
                <div className="space-y-3">
                  {stats.actionStats.map((a: any) => (
                    <div key={a.action} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-on-surface">{a.action.replace(/_/g, " ")}</span>
                        <span className="text-primary">{a.count} clicks</span>
                      </div>
                      <div className="w-full bg-surface-variant/40 rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{
                            width: `${Math.min(100, Math.max(10, (a.count / (stats.totalDeliveries || 1)) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-on-surface-variant py-8 text-center">
                  No interactive clicks logged yet. Clicks are logged in real-time when students tap notification buttons.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MULTI-CHANNEL BROADCAST */}
      {activeTab === "broadcast" && (
        <BroadcastManager
          canSend={canSend}
          batches={batches}
          initialBroadcasts={initialBroadcasts}
        />
      )}

      {/* TAB 3: CUSTOM NOTIFICATION & SCHEDULER */}
      {activeTab === "scheduler" && (
        <div className="glass-card p-6 rounded-2xl border border-outline-variant/30 max-w-3xl space-y-6">
          <div>
            <h2 className="text-lg font-bold text-on-surface">Compose Custom Notification</h2>
            <p className="text-xs text-on-surface-variant mt-1">
              Send immediately or schedule for a specific date and time with custom action buttons and pop-up priority.
            </p>
          </div>

          <form onSubmit={handleSubmitSchedule} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-on-surface">Title</label>
              <input
                type="text"
                required
                value={scheduleForm.title}
                onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })}
                placeholder="e.g. Important Update Regarding Tomorrow's Chemistry Session"
                className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-on-surface">Message Body</label>
              <textarea
                required
                rows={4}
                value={scheduleForm.message}
                onChange={(e) => setScheduleForm({ ...scheduleForm, message: e.target.value })}
                placeholder="Enter complete notification message text..."
                className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-on-surface">Category</label>
                <select
                  value={scheduleForm.category}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, category: e.target.value })}
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="ACADEMIC">Academic</option>
                  <option value="CLASS">Class</option>
                  <option value="TEST">Test</option>
                  <option value="MATERIAL">Study Material</option>
                  <option value="OFFER">Special Offer</option>
                  <option value="MOTIVATION">Daily Motivation</option>
                  <option value="SYSTEM">System Announcement</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-on-surface">Priority</label>
                <select
                  value={scheduleForm.priority}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, priority: e.target.value })}
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High (Triggers Sound)</option>
                  <option value="URGENT">Urgent (Modal Pop-up & High Priority)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-on-surface">Target Audience</label>
                <select
                  value={scheduleForm.targetType}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, targetType: e.target.value, targetId: "" })}
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="ALL_STUDENTS">All Active Students</option>
                  <option value="BATCH">Specific Batch Only</option>
                </select>
              </div>
            </div>

            {scheduleForm.targetType === "BATCH" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-on-surface">Select Batch</label>
                <select
                  required
                  value={scheduleForm.targetId}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, targetId: e.target.value })}
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select a batch...</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-on-surface">Action Button Type</label>
                <select
                  value={scheduleForm.actionType}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, actionType: e.target.value })}
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="NONE">No Button (Dismissible Only)</option>
                  <option value="JOIN_CLASS">Join Live Class</option>
                  <option value="ATTEMPT_TEST">Attempt Test</option>
                  <option value="VIEW_DPP">View DPP</option>
                  <option value="DOWNLOAD_PDF">Open PDF Document</option>
                  <option value="OPEN_BATCH">Go to Batch Portal</option>
                  <option value="CLAIM_OFFER">Claim Offer</option>
                  <option value="VIEW_ANNOUNCEMENT">View Announcement</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-on-surface">Action Redirect URL (Optional)</label>
                <input
                  type="text"
                  value={scheduleForm.actionUrl}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, actionUrl: e.target.value })}
                  placeholder="e.g. /student/batches or https://..."
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-on-surface">
                Schedule Execution Date & Time (Leave empty to send immediately)
              </label>
              <input
                type="datetime-local"
                value={scheduleForm.executeAt}
                onChange={(e) => setScheduleForm({ ...scheduleForm, executeAt: e.target.value })}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex items-center gap-6 pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-on-surface">
                <input
                  type="checkbox"
                  checked={scheduleForm.showPopup}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, showPopup: e.target.checked })}
                  className="rounded border-outline-variant text-primary focus:ring-primary"
                />
                Show In-App Pop-up Toast
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-on-surface">
                <input
                  type="checkbox"
                  checked={scheduleForm.soundEnabled}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, soundEnabled: e.target.checked })}
                  className="rounded border-outline-variant text-primary focus:ring-primary"
                />
                Play Audio Alert Chime
              </label>
            </div>

            <button
              type="submit"
              disabled={submittingSchedule}
              className="bg-primary text-on-primary font-semibold text-sm px-6 py-3 rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">
                {scheduleForm.executeAt ? "schedule" : "send"}
              </span>
              {submittingSchedule
                ? "Processing..."
                : scheduleForm.executeAt
                ? "Schedule Notification"
                : "Send Broadcast Now"}
            </button>
          </form>
        </div>
      )}

      {/* TAB 4: SCHEDULED QUEUE */}
      {activeTab === "queue" && (
        <div className="glass-card rounded-2xl border border-outline-variant/30 overflow-hidden">
          <div className="p-5 border-b border-outline-variant/20 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-on-surface text-base">Pending & Scheduled Jobs</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Automatically processed by the server scheduler when the target time is reached.
              </p>
            </div>
            <button
              onClick={fetchScheduled}
              className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-variant/30 transition-all"
              title="Refresh queue"
            >
              <span className="material-symbols-outlined text-base">refresh</span>
            </button>
          </div>

          {loadingScheduled ? (
            <div className="p-12 text-center text-sm text-on-surface-variant">Loading scheduled jobs...</div>
          ) : scheduledJobs.length === 0 ? (
            <div className="p-12 text-center text-sm text-on-surface-variant">
              No pending scheduled notifications in queue.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-variant/20 text-xs uppercase text-on-surface-variant font-semibold">
                  <tr>
                    <th className="py-3 px-4">Event / Type</th>
                    <th className="py-3 px-4">Target Audience</th>
                    <th className="py-3 px-4">Scheduled For</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {scheduledJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-surface-variant/10 transition-colors">
                      <td className="py-3 px-4 font-medium text-on-surface">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary text-base">alarm</span>
                          <span>{job.eventType.replace(/_/g, " ")}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-on-surface-variant text-xs">
                        {job.targetType === "BATCH" ? `Batch: ${job.targetId}` : job.targetType}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-on-surface">
                        {new Date(job.executeAt).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            job.status === "PENDING"
                              ? "bg-amber-100 text-amber-800"
                              : job.status === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {job.status === "PENDING" && (
                          <button
                            onClick={() => handleCancelJob(job.id)}
                            className="text-xs font-medium text-error hover:underline"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: MESSAGE TEMPLATES */}
      {activeTab === "templates" && (
        <div className="space-y-6">
          {/* Create / Edit Template Form */}
          <div className="glass-card p-6 rounded-2xl border border-outline-variant/30 space-y-4">
            <h3 className="font-bold text-on-surface text-base">
              {editingTemplate ? "Edit Template" : "Create New Template"}
            </h3>

            <form onSubmit={handleSaveTemplate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-on-surface">Template Identifier Name</label>
                  <input
                    type="text"
                    required
                    value={templateForm.templateName}
                    onChange={(e) => setTemplateForm({ ...templateForm, templateName: e.target.value })}
                    placeholder="e.g. daily_motivation_morning"
                    className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-on-surface">Category</label>
                  <select
                    value={templateForm.category}
                    onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
                    className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="ACADEMIC">Academic</option>
                    <option value="CLASS">Class</option>
                    <option value="TEST">Test</option>
                    <option value="MATERIAL">Study Material</option>
                    <option value="OFFER">Special Offer</option>
                    <option value="MOTIVATION">Daily Motivation</option>
                    <option value="SYSTEM">System</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-on-surface">
                  Notification Title (Supports {"{{student_name}}"}, {"{{class_title}}"})
                </label>
                <input
                  type="text"
                  required
                  value={templateForm.title}
                  onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })}
                  placeholder="e.g. Morning Boost for {{student_name}} 🌟"
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-on-surface">
                  Message Body / Template Text
                </label>
                <textarea
                  required
                  rows={3}
                  value={templateForm.message}
                  onChange={(e) => setTemplateForm({ ...templateForm, message: e.target.value })}
                  placeholder="Your daily study focus starts now! Make today count."
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Motivation Rotation Messages */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-on-surface">
                  Rotation Messages (One per line — used for daily automated rotations)
                </label>
                <textarea
                  rows={3}
                  value={templateForm.rotationMessages}
                  onChange={(e) => setTemplateForm({ ...templateForm, rotationMessages: e.target.value })}
                  placeholder="Focus on the journey, not the destination.&#10;Consistent effort leads to outstanding NEET results.&#10;Every hour spent solving problems compounds."
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="bg-primary text-on-primary font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-primary/90 transition-all"
                >
                  {editingTemplate ? "Update Template" : "Create Template"}
                </button>
                {editingTemplate && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTemplate(null);
                      setTemplateForm({
                        templateName: "",
                        category: "ACADEMIC",
                        priority: "NORMAL",
                        title: "",
                        message: "",
                        actionType: "",
                        actionUrl: "",
                        targetAudience: "ALL_STUDENTS",
                        isActive: true,
                        rotationMessages: "",
                      });
                    }}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-on-surface-variant hover:bg-surface-variant/30"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Templates List */}
          <div className="glass-card rounded-2xl border border-outline-variant/30 overflow-hidden">
            <div className="p-5 border-b border-outline-variant/20">
              <h3 className="font-bold text-on-surface text-base">Configured Templates</h3>
            </div>
            {loadingTemplates ? (
              <div className="p-12 text-center text-sm text-on-surface-variant">Loading templates...</div>
            ) : templates.length === 0 ? (
              <div className="p-12 text-center text-sm text-on-surface-variant">No custom templates created yet.</div>
            ) : (
              <div className="divide-y divide-outline-variant/20">
                {templates.map((tpl) => (
                  <div key={tpl.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-on-surface">{tpl.templateName}</span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {tpl.category}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-on-surface">{tpl.title}</p>
                      <p className="text-xs text-on-surface-variant">{tpl.message}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingTemplate(tpl);
                          setTemplateForm({
                            templateName: tpl.templateName,
                            category: tpl.category,
                            priority: tpl.priority,
                            title: tpl.title,
                            message: tpl.message,
                            actionType: tpl.actionType || "",
                            actionUrl: tpl.actionUrl || "",
                            targetAudience: tpl.targetAudience,
                            isActive: tpl.isActive,
                            rotationMessages: Array.isArray(tpl.rotationMessages)
                              ? tpl.rotationMessages.join("\n")
                              : "",
                          });
                        }}
                        className="text-xs font-semibold text-primary hover:underline px-2 py-1"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(tpl.id)}
                        className="text-xs font-semibold text-error hover:underline px-2 py-1"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: AUTOMATION RULES */}
      {activeTab === "rules" && (
        <div className="glass-card rounded-2xl border border-outline-variant/30 overflow-hidden">
          <div className="p-5 border-b border-outline-variant/20">
            <h3 className="font-bold text-on-surface text-base">Automatic Event Trigger Rules</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Control which system events automatically dispatch notifications to enrolled students.
            </p>
          </div>

          {loadingRules ? (
            <div className="p-12 text-center text-sm text-on-surface-variant">Loading automation rules...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-variant/20 text-xs uppercase text-on-surface-variant font-semibold">
                  <tr>
                    <th className="py-3 px-4">Event Trigger</th>
                    <th className="py-3 px-4">Default Priority</th>
                    <th className="py-3 px-4">Channels</th>
                    <th className="py-3 px-4 text-right">Status / Toggle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {rules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-surface-variant/10 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-on-surface">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary text-base">tune</span>
                          <span>{rule.eventType.replace(/_/g, " ")}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            rule.priority === "URGENT"
                              ? "bg-red-100 text-red-700"
                              : rule.priority === "HIGH"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {rule.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-on-surface-variant">
                        {Array.isArray(rule.channels) ? rule.channels.join(", ") : "IN_APP, PUSH"}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleToggleRule(rule)}
                          className={`text-xs font-bold px-3 py-1 rounded-full transition-all ${
                            rule.isEnabled
                              ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                              : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                          }`}
                        >
                          {rule.isEnabled ? "ACTIVE" : "DISABLED"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 7: DELIVERY & AUDIT LOGS */}
      {activeTab === "logs" && (
        <div className="glass-card rounded-2xl border border-outline-variant/30 overflow-hidden">
          <div className="p-5 border-b border-outline-variant/20 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-on-surface text-base">Audit & Delivery Trail</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Real-time delivery status, user reads, and interactive button clicks.
              </p>
            </div>
            <button
              onClick={() => fetchLogs(logPage)}
              className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-variant/30 transition-all"
              title="Refresh logs"
            >
              <span className="material-symbols-outlined text-base">refresh</span>
            </button>
          </div>

          {loadingLogs ? (
            <div className="p-12 text-center text-sm text-on-surface-variant">Loading audit logs...</div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-sm text-on-surface-variant">No delivery logs recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-variant/20 text-xs uppercase text-on-surface-variant font-semibold">
                  <tr>
                    <th className="py-3 px-4">Notification</th>
                    <th className="py-3 px-4">Recipient</th>
                    <th className="py-3 px-4">Channel</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-surface-variant/10 transition-colors">
                      <td className="py-3 px-4 font-medium text-on-surface max-w-xs truncate">
                        {log.notification?.title || "Notification"}
                      </td>
                      <td className="py-3 px-4 text-xs text-on-surface-variant">
                        {log.user?.name || log.user?.email || "Student"}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-on-surface">{log.channel}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            log.status === "CLICKED"
                              ? "bg-purple-100 text-purple-800"
                              : log.status === "READ"
                              ? "bg-blue-100 text-blue-800"
                              : log.status === "DELIVERED"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-on-surface-variant">
                        {new Date(log.createdAt).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {totalLogPages > 1 && (
                <div className="p-4 border-t border-outline-variant/20 flex items-center justify-between">
                  <span className="text-xs text-on-surface-variant">
                    Page {logPage} of {totalLogPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={logPage <= 1}
                      onClick={() => fetchLogs(logPage - 1)}
                      className="px-3 py-1 rounded-lg text-xs font-semibold border border-outline-variant/30 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      disabled={logPage >= totalLogPages}
                      onClick={() => fetchLogs(logPage + 1)}
                      className="px-3 py-1 rounded-lg text-xs font-semibold border border-outline-variant/30 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
