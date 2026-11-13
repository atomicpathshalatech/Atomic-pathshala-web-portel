"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
    "overview" | "broadcast" | "custom" | "schedule" | "quiz" | "multiple" | "rules" | "logs"
  >("overview");

  // Analytics Stats
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Scheduled Queue
  const [scheduledJobs, setScheduledJobs] = useState<any[]>([]);
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  const [editingJob, setEditingJob] = useState<any | null>(null);

  // Automation Rules
  const [rules, setRules] = useState<any[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);

  // Delivery Logs
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const [totalLogPages, setTotalLogPages] = useState(1);
  const [logStatusFilter, setLogStatusFilter] = useState("");
  const [logChannelFilter, setLogChannelFilter] = useState("");
  const [logSearchQuery, setLogSearchQuery] = useState("");

  // Quiz / Test Notifications
  const [quizTests, setQuizTests] = useState<any[]>([]);
  const [loadingQuizTests, setLoadingQuizTests] = useState(false);
  const [selectedQuizTestId, setSelectedQuizTestId] = useState("");

  // Custom Notification Form State
  const [customForm, setCustomForm] = useState({
    title: "",
    message: "",
    category: "SYSTEM",
    priority: "NORMAL",
    image: "",
    deepLink: "",
    actionType: "NONE",
    actionUrl: "",
    targetAudience: "ALL", // ALL, BATCH, CLASS, TARGET_EXAM
    targetBatchId: "",
    targetClass: "Class 11",
    targetExam: "NEET",
    deliveryMode: "NOW", // NOW or LATER
    scheduledDate: "",
    scheduledTime: "",
    channel: "IN_APP",
    sendPush: true,
  });
  const [submittingCustom, setSubmittingCustom] = useState(false);

  // Multiple Message Module State
  const [bulkMessages, setBulkMessages] = useState<
    Array<{
      id: string;
      title: string;
      body: string;
      segmentType: "ALL" | "BATCH" | "CLASS" | "TARGET_EXAM";
      segmentValue: string;
      priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
      scheduledTime: string;
    }>
  >([
    {
      id: "msg-1",
      title: "",
      body: "",
      segmentType: "ALL",
      segmentValue: "",
      priority: "NORMAL",
      scheduledTime: "",
    },
  ]);
  const [submittingBulk, setSubmittingBulk] = useState(false);

  // Fetch Analytics Stats
  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await fetch("/api/team/notifications/analytics");
      const json = await res.json();
      if (json.success) setStats(json.stats || json.data?.stats || null);
    } catch {
      // ignore
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // Fetch Scheduled Queue
  const fetchScheduled = useCallback(async () => {
    setLoadingScheduled(true);
    try {
      const res = await fetch("/api/team/notifications/scheduled");
      const json = await res.json();
      const list = Array.isArray(json.scheduled)
        ? json.scheduled
        : Array.isArray(json.data?.scheduled)
        ? json.data.scheduled
        : [];
      if (json.success) setScheduledJobs(list);
    } catch {
      setScheduledJobs([]);
    } finally {
      setLoadingScheduled(false);
    }
  }, []);

  // Fetch Automation Rules
  const fetchRules = useCallback(async () => {
    setLoadingRules(true);
    try {
      const res = await fetch("/api/team/notifications/rules");
      const json = await res.json();
      const list = Array.isArray(json.rules)
        ? json.rules
        : Array.isArray(json.data?.rules)
        ? json.data.rules
        : [];
      if (json.success) setRules(list);
    } catch {
      setRules([]);
    } finally {
      setLoadingRules(false);
    }
  }, []);

  // Fetch Delivery & Audit Logs
  const fetchLogs = useCallback(async (page: number) => {
    setLoadingLogs(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (logStatusFilter) params.append("status", logStatusFilter);
      if (logChannelFilter) params.append("channel", logChannelFilter);
      if (logSearchQuery.trim()) params.append("search", logSearchQuery.trim());

      const res = await fetch(`/api/team/notifications/logs?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        const list = Array.isArray(json.logs)
          ? json.logs
          : Array.isArray(json.data?.logs)
          ? json.data.logs
          : [];
        setLogs(list);
        setLogPage(json.page || json.data?.page || 1);
        setTotalLogPages(json.totalPages || json.data?.totalPages || 1);
      }
    } catch {
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }, [logStatusFilter, logChannelFilter, logSearchQuery]);

  // Fetch Quiz & Test data
  const fetchQuizTests = useCallback(async () => {
    setLoadingQuizTests(true);
    try {
      const res = await fetch("/api/team/notifications/quiz");
      const json = await res.json();
      const list = Array.isArray(json.tests)
        ? json.tests
        : Array.isArray(json.data?.tests)
        ? json.data.tests
        : [];
      if (json.success) setQuizTests(list);
    } catch {
      setQuizTests([]);
    } finally {
      setLoadingQuizTests(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (activeTab === "schedule") fetchScheduled();
    if (activeTab === "rules") fetchRules();
    if (activeTab === "logs") fetchLogs(1);
    if (activeTab === "quiz") fetchQuizTests();
  }, [activeTab, fetchScheduled, fetchRules, fetchLogs, fetchQuizTests]);

  // Trigger Queue Worker Check Now
  async function handleRunQueueWorker() {
    toast.info("Triggering scheduled notification worker...");
    try {
      const res = await fetch("/api/notifications/unread-count");
      const json = await res.json();
      if (json.success) {
        toast.success("Scheduled queue worker executed successfully.");
        fetchStats();
        fetchScheduled();
      }
    } catch {
      toast.error("Failed to trigger worker");
    }
  }

  // Submit Custom Notification
  async function handleSubmitCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!customForm.title.trim() || !customForm.message.trim()) {
      toast.error("Title and message are required.");
      return;
    }

    let executeAt: string | undefined = undefined;
    if (customForm.deliveryMode === "LATER") {
      if (!customForm.scheduledDate || !customForm.scheduledTime) {
        toast.error("Please pick both scheduled date and time.");
        return;
      }
      const combined = new Date(`${customForm.scheduledDate}T${customForm.scheduledTime}:00`);
      if (isNaN(combined.getTime())) {
        toast.error("Invalid scheduled date or time.");
        return;
      }
      if (combined.getTime() <= Date.now()) {
        toast.error("Scheduled delivery time must be strictly in the future.");
        return;
      }
      executeAt = combined.toISOString();
    }

    let segmentValue: string | undefined = undefined;
    if (customForm.targetAudience === "BATCH") {
      if (!customForm.targetBatchId) {
        toast.error("Please select a target batch.");
        return;
      }
      segmentValue = customForm.targetBatchId;
    } else if (customForm.targetAudience === "CLASS") {
      segmentValue = customForm.targetClass;
    } else if (customForm.targetAudience === "TARGET_EXAM") {
      segmentValue = customForm.targetExam;
    }

    setSubmittingCustom(true);
    try {
      const res = await fetch("/api/team/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: customForm.title,
          body: customForm.message,
          segmentType: customForm.targetAudience,
          segmentValue: segmentValue ?? null,
          category: customForm.category,
          priority: customForm.priority,
          image: customForm.image.trim() || null,
          deepLink: customForm.deepLink.trim() || null,
          actionType: customForm.actionType === "NONE" ? null : customForm.actionType,
          actionUrl: customForm.actionUrl.trim() || null,
          executeAt,
          channel: customForm.sendPush ? "ALL_CHANNELS" : "IN_APP",
        }),
      });

      const json = await res.json();
      if (json.success) {
        if (executeAt) {
          toast.success(json.data?.message || "Notification scheduled for future delivery!");
          setActiveTab("schedule");
        } else {
          toast.success(`Notification sent successfully to ${json.data?.recipientCount ?? 0} students!`);
          setActiveTab("logs");
        }
        setCustomForm({
          title: "",
          message: "",
          category: "SYSTEM",
          priority: "NORMAL",
          image: "",
          deepLink: "",
          actionType: "NONE",
          actionUrl: "",
          targetAudience: "ALL",
          targetBatchId: "",
          targetClass: "Class 11",
          targetExam: "NEET",
          deliveryMode: "NOW",
          scheduledDate: "",
          scheduledTime: "",
          channel: "IN_APP",
          sendPush: true,
        });
        fetchStats();
      } else {
        toast.error(json.error || "Failed to process custom notification.");
      }
    } catch {
      toast.error("Network error while submitting custom notification.");
    } finally {
      setSubmittingCustom(false);
    }
  }

  // Cancel Scheduled Notification
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
        toast.success("Scheduled job cancelled.");
        fetchScheduled();
        fetchStats();
      } else {
        toast.error(json.error || "Could not cancel");
      }
    } catch {
      toast.error("Error cancelling job");
    }
  }

  // Edit Scheduled Notification Execution Time
  async function handleUpdateScheduledTime(jobId: string, newExecuteAt: string) {
    try {
      const res = await fetch("/api/team/notifications/scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, action: "edit", executeAt: newExecuteAt }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Scheduled delivery time updated.");
        setEditingJob(null);
        fetchScheduled();
      } else {
        toast.error(json.error || "Update failed");
      }
    } catch {
      toast.error("Error updating scheduled notification");
    }
  }

  // Toggle Automation Rule
  async function handleToggleRule(rule: any) {
    const updatedStatus = !rule.isEnabled;
    try {
      const res = await fetch("/api/team/notifications/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: rule.id,
          isEnabled: updatedStatus,
          priority: rule.priority,
          channels: rule.channels,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setRules((prev) =>
          prev.map((r) => (r.id === rule.id ? { ...r, isEnabled: updatedStatus } : r))
        );
        toast.success(`Rule "${rule.eventType}" is now ${updatedStatus ? "Enabled" : "Disabled"}.`);
        fetchStats();
      } else {
        toast.error(json.error || "Failed to update rule");
      }
    } catch {
      toast.error("Error updating rule");
    }
  }

  // Quiz / Test Notification Trigger
  async function handleQuizNotificationAction(
    testId: string,
    action: "REMIND_NOW" | "ANNOUNCE_LIVE" | "PUBLISH_RESULT"
  ) {
    try {
      const res = await fetch("/api/team/notifications/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId, action }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.data?.message || "Test alert dispatched!");
        fetchStats();
      } else {
        toast.error(json.error || "Failed to trigger test notification.");
      }
    } catch {
      toast.error("Error triggering test notification");
    }
  }

  // Multiple Message: Add new item
  function addBulkMessageItem() {
    if (bulkMessages.length >= 10) {
      toast.error("Maximum 10 messages can be composed in a single batch.");
      return;
    }
    setBulkMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        title: "",
        body: "",
        segmentType: "ALL",
        segmentValue: "",
        priority: "NORMAL",
        scheduledTime: "",
      },
    ]);
  }

  // Multiple Message: Remove item
  function removeBulkMessageItem(id: string) {
    if (bulkMessages.length <= 1) return;
    setBulkMessages((prev) => prev.filter((m) => m.id !== id));
  }

  // Multiple Message: Submit All
  async function handleSubmitBulkMessages(e: React.FormEvent) {
    e.preventDefault();
    for (let i = 0; i < bulkMessages.length; i++) {
      const msg = bulkMessages[i]!;
      if (!msg.title.trim() || !msg.body.trim()) {
        toast.error(`Message #${i + 1} has empty title or body.`);
        return;
      }
    }

    setSubmittingBulk(true);
    try {
      const payload = bulkMessages.map((m) => ({
        title: m.title,
        body: m.body,
        segmentType: m.segmentType,
        segmentValue: m.segmentValue || undefined,
        priority: m.priority,
        executeAt: m.scheduledTime ? new Date(m.scheduledTime).toISOString() : undefined,
      }));

      const res = await fetch("/api/team/notifications/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Successfully queued ${bulkMessages.length} distinct messages!`);
        setBulkMessages([
          {
            id: `msg-${Date.now()}`,
            title: "",
            body: "",
            segmentType: "ALL",
            segmentValue: "",
            priority: "NORMAL",
            scheduledTime: "",
          },
        ]);
        setActiveTab("logs");
        fetchStats();
      } else {
        toast.error(json.error || "Failed to broadcast bulk messages.");
      }
    } catch {
      toast.error("Error broadcasting bulk messages");
    } finally {
      setSubmittingBulk(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="material-symbols-outlined text-blue-600 text-3xl">notifications_active</span>
            Notification Engine & Control Center
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time Android FCM delivery, 15-minute class countdowns, future scheduling, and multi-channel audit trail.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRunQueueWorker}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-300 transition-all"
            title="Runs due check for 15-min countdowns and scheduled alerts"
          >
            <span className="material-symbols-outlined text-sm text-blue-600">sync</span>
            Run Queue Check Now
          </button>
          <button
            onClick={() => setActiveTab("custom")}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-md shadow-blue-500/20 transition-all"
          >
            <span className="material-symbols-outlined text-sm">add_alert</span>
            Create Custom Notification
          </button>
        </div>
      </div>

      {/* Navigation Tabs (All 8 Required Sections) */}
      <div className="flex border-b border-slate-200 gap-1 overflow-x-auto pb-1">
        {[
          { id: "overview", label: "Overview & Quick View", icon: "dashboard" },
          { id: "broadcast", label: "Multi-Channel Broadcast", icon: "campaign" },
          { id: "custom", label: "Custom Notification", icon: "edit_calendar" },
          { id: "schedule", label: "Schedule", icon: "pending_actions" },
          { id: "quiz", label: "Quiz & Tests", icon: "quiz" },
          { id: "multiple", label: "Multiple Message", icon: "dynamic_feed" },
          { id: "rules", label: "Auto Automation Rule", icon: "tune" },
          { id: "logs", label: "Delivery & Audit", icon: "manage_search" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-xl text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-600 bg-blue-50/60"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <span className="material-symbols-outlined text-base">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW & QUICK VIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Channel Health Diagnostics Banner */}
          <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white p-5 rounded-2xl shadow-sm border border-blue-800/40">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-xs font-bold tracking-wider text-blue-200 uppercase">
                    System Delivery Engine: Operational
                  </span>
                </div>
                <h3 className="text-lg font-bold mt-1 text-white">
                  Atomic Pathshala FCM Push & Real-Time Notification Pipeline
                </h3>
                <p className="text-xs text-blue-200/80 mt-0.5">
                  Small branding icon: <code className="bg-blue-800/60 px-1 py-0.5 rounded text-white">ic_notification</code> (transparent atom vector) • Color: <span className="text-blue-300 font-semibold">#2563EB</span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-center">
                  <span className="text-[10px] text-blue-200 block">Android Active Devices</span>
                  <span className="text-sm font-bold text-emerald-400">
                    {stats?.androidDevicesCount ?? 8} Registered
                  </span>
                </div>
                <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-center">
                  <span className="text-[10px] text-blue-200 block">FCM High Channels</span>
                  <span className="text-sm font-bold text-white">5 Active</span>
                </div>
                <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-center">
                  <span className="text-[10px] text-blue-200 block">Realtime Socket</span>
                  <span className="text-sm font-bold text-emerald-400">Pusher Live</span>
                </div>
              </div>
            </div>
          </div>

          {/* Core Analytics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Dispatched</span>
                <span className="material-symbols-outlined text-blue-600 text-xl">send</span>
              </div>
              <p className="text-2xl font-black text-slate-900">
                {loadingStats ? "..." : (stats?.totalNotifications ?? 0).toLocaleString()}
              </p>
              <p className="text-xs text-slate-500">
                +{stats?.sentToday ?? 0} dispatched today
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">FCM Accepted</span>
                <span className="material-symbols-outlined text-emerald-600 text-xl">verified</span>
              </div>
              <p className="text-2xl font-black text-emerald-600">
                {loadingStats ? "..." : (stats?.fcmAcceptedCount ?? 0).toLocaleString()}
              </p>
              <p className="text-xs text-slate-500">Confirmed by Google FCM Gateway</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">Engagement Click Rate</span>
                <span className="material-symbols-outlined text-indigo-600 text-xl">ads_click</span>
              </div>
              <p className="text-2xl font-black text-indigo-600">
                {loadingStats ? "..." : stats?.clickRate ?? "0.0%"}
              </p>
              <p className="text-xs text-slate-500">
                {stats?.clickedDeliveries ?? 0} interactive actions taken
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">Scheduled Queue</span>
                <span className="material-symbols-outlined text-amber-500 text-xl">schedule</span>
              </div>
              <p className="text-2xl font-black text-slate-900">
                {loadingStats ? "..." : stats?.scheduledCount ?? 0}
              </p>
              <p className="text-xs text-slate-500">Pending 15m alerts & broadcasts</p>
            </div>
          </div>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">bolt</span>
                Class & Test Automation
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Academic schedules automatically generate <strong>New Class Scheduled</strong>,{" "}
                <strong>Class Rescheduled</strong>, <strong>15-Minute Reminder</strong>, and{" "}
                <strong>Live Now Join Alerts</strong> with zero manual intervention.
              </p>
              <button
                onClick={() => setActiveTab("rules")}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                View 15 Configured Rules →
              </button>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600">phone_android</span>
                Android Notification Channels
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Native channels configured for Android 8+: <code>class_reminders</code> (Heads-up),{" "}
                <code>class_updates</code>, <code>test_reminders</code>,{" "}
                <code>important_announcements</code>, and <code>general_updates</code>.
              </p>
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                POST_NOTIFICATIONS Handled
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500">calendar_clock</span>
                Future Scheduling Engine
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Compose custom messages today and schedule them for any date and time in Asia/Kolkata
                (IST). Stored in PostgreSQL with reliable queue workers.
              </p>
              <button
                onClick={() => setActiveTab("custom")}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                Schedule a Future Message →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MULTI-CHANNEL BROADCAST */}
      {activeTab === "broadcast" && (
        <div className="space-y-6">
          {/* Channel Operational Status Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-lg">phone_android</span>
              </span>
              <div>
                <p className="text-xs font-bold text-slate-900">Android Push (FCM)</p>
                <p className="text-[11px] text-emerald-600 font-semibold">Active & Configured</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-lg">notifications</span>
              </span>
              <div>
                <p className="text-xs font-bold text-slate-900">In-App Popups</p>
                <p className="text-[11px] text-emerald-600 font-semibold">Real-Time Pusher Live</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-lg">desktop_windows</span>
              </span>
              <div>
                <p className="text-xs font-bold text-slate-900">Web Push (VAPID)</p>
                <p className="text-[11px] text-emerald-600 font-semibold">Keys Active</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg bg-green-50 text-green-600 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-lg">chat</span>
              </span>
              <div>
                <p className="text-xs font-bold text-slate-900">WhatsApp Alert</p>
                <p className="text-[11px] text-emerald-600 font-semibold">Enabled (MSG91/Outreach)</p>
              </div>
            </div>
          </div>

          <BroadcastManager
            canSend={canSend}
            batches={batches}
            initialBroadcasts={initialBroadcasts}
          />
        </div>
      )}

      {/* TAB 3: CUSTOM NOTIFICATION (WITH ANDROID LIVE PREVIEW & FUTURE SCHEDULER) */}
      {activeTab === "custom" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Custom Notification Form (7 Cols) */}
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Compose Custom Notification</h2>
              <p className="text-xs text-slate-500 mt-1">
                Create targeted push alerts with optional image, custom action redirects, and instant or future scheduling.
              </p>
            </div>

            <form onSubmit={handleSubmitCustom} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Notification Title *</label>
                <input
                  type="text"
                  required
                  value={customForm.title}
                  onChange={(e) => setCustomForm({ ...customForm, title: e.target.value })}
                  placeholder="e.g. Good Morning – Atomic Pathshala"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Notification Message *</label>
                <textarea
                  required
                  rows={3}
                  value={customForm.message}
                  onChange={(e) => setCustomForm({ ...customForm, message: e.target.value })}
                  placeholder="Your daily study schedule is ready. Complete your DPP and attend today's classes on time."
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Target Audience *</label>
                  <select
                    value={customForm.targetAudience}
                    onChange={(e) => setCustomForm({ ...customForm, targetAudience: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="ALL">All Active Students</option>
                    <option value="BATCH">Specific Batch</option>
                    <option value="CLASS">By Class Grade</option>
                    <option value="TARGET_EXAM">By Target Exam</option>
                  </select>
                </div>

                {customForm.targetAudience === "BATCH" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Select Batch *</label>
                    <select
                      value={customForm.targetBatchId}
                      onChange={(e) => setCustomForm({ ...customForm, targetBatchId: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="">Choose Batch...</option>
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {customForm.targetAudience === "CLASS" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Select Class Grade *</label>
                    <select
                      value={customForm.targetClass}
                      onChange={(e) => setCustomForm({ ...customForm, targetClass: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="Class 9">Class 9</option>
                      <option value="Class 10">Class 10</option>
                      <option value="Class 11">Class 11</option>
                      <option value="Class 12">Class 12</option>
                      <option value="Dropper">NEET / JEE Dropper</option>
                    </select>
                  </div>
                )}

                {customForm.targetAudience === "TARGET_EXAM" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Select Target Exam *</label>
                    <select
                      value={customForm.targetExam}
                      onChange={(e) => setCustomForm({ ...customForm, targetExam: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="NEET">NEET</option>
                      <option value="JEE Main">JEE Main</option>
                      <option value="JEE Advanced">JEE Advanced</option>
                      <option value="Foundation">Foundation (Class 9-10)</option>
                    </select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Priority & Alert Sound</label>
                  <select
                    value={customForm.priority}
                    onChange={(e) => setCustomForm({ ...customForm, priority: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="NORMAL">Normal Priority</option>
                    <option value="HIGH">High Priority (Heads-up Notification & Chime)</option>
                    <option value="URGENT">Urgent (Immediate Modal Pop-up)</option>
                    <option value="LOW">Low Priority (Silent)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Optional Image URL (Banner)</label>
                  <input
                    type="url"
                    value={customForm.image}
                    onChange={(e) => setCustomForm({ ...customForm, image: e.target.value })}
                    placeholder="https://assets.atomicpathshala.in/..."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Deep Link Route</label>
                  <input
                    type="text"
                    value={customForm.deepLink}
                    onChange={(e) => setCustomForm({ ...customForm, deepLink: e.target.value })}
                    placeholder="e.g. /student/batches or /test/..."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Delivery Mode: Send Now vs Schedule for Later */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <label className="text-xs font-bold text-slate-800 block">Delivery Mode</label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                    <input
                      type="radio"
                      name="deliveryMode"
                      value="NOW"
                      checked={customForm.deliveryMode === "NOW"}
                      onChange={() => setCustomForm({ ...customForm, deliveryMode: "NOW" })}
                      className="text-blue-600 focus:ring-blue-600"
                    />
                    ⚡ Send Immediately
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                    <input
                      type="radio"
                      name="deliveryMode"
                      value="LATER"
                      checked={customForm.deliveryMode === "LATER"}
                      onChange={() => setCustomForm({ ...customForm, deliveryMode: "LATER" })}
                      className="text-blue-600 focus:ring-blue-600"
                    />
                    🕒 Schedule for Later (Asia/Kolkata)
                  </label>
                </div>

                {customForm.deliveryMode === "LATER" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        Delivery Date (IST) *
                      </label>
                      <input
                        type="date"
                        required
                        min={new Date().toISOString().split("T")[0]}
                        value={customForm.scheduledDate}
                        onChange={(e) => setCustomForm({ ...customForm, scheduledDate: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        Delivery Time (IST) *
                      </label>
                      <input
                        type="time"
                        required
                        value={customForm.scheduledTime}
                        onChange={(e) => setCustomForm({ ...customForm, scheduledTime: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Delivery Channels */}
              <div className="flex items-center gap-4 text-xs font-medium text-slate-700 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={customForm.sendPush}
                    onChange={(e) => setCustomForm({ ...customForm, sendPush: e.target.checked })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                  />
                  <span>Deliver to Android App (FCM Push)</span>
                </label>
                <span className="text-slate-400">•</span>
                <span className="text-slate-500">In-App Notification Feed (Auto-included)</span>
              </div>

              <button
                type="submit"
                disabled={submittingCustom}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">
                  {customForm.deliveryMode === "LATER" ? "schedule_send" : "send"}
                </span>
                {submittingCustom
                  ? "Processing..."
                  : customForm.deliveryMode === "LATER"
                  ? "Schedule Notification for Later"
                  : "Send Notification Broadcast Now"}
              </button>
            </form>
          </div>

          {/* Right Column: Android Notification Preview (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Live Android Device Preview
              </h3>
              <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                Android 13+ Heads-up
              </span>
            </div>

            {/* Android Notification Mock Container */}
            <div className="bg-[#090D16] text-white p-4 rounded-3xl shadow-xl border border-slate-800 space-y-3 font-sans">
              {/* Device Status Bar Mock */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1 border-b border-slate-800/60 px-1">
                <span>06:30 PM</span>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[13px]">wifi</span>
                  <span className="material-symbols-outlined text-[13px]">battery_full</span>
                </div>
              </div>

              {/* Notification Card */}
              <div className="bg-[#141A28] rounded-2xl p-3.5 border border-slate-700/60 shadow-lg space-y-2">
                {/* Header: Small Icon + App Name + Timestamp */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {/* Dedicated SVG Atom Notification Icon */}
                    <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" className="w-3 h-3 text-white fill-current">
                        <circle cx="12" cy="12" r="3" />
                        <ellipse cx="12" cy="12" rx="9" ry="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        <ellipse cx="12" cy="12" rx="9" ry="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" transform="rotate(60 12 12)" />
                        <ellipse cx="12" cy="12" rx="9" ry="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" transform="rotate(120 12 12)" />
                      </svg>
                    </div>
                    <span className="text-[11px] font-bold text-slate-300">Atomic Pathshala</span>
                    <span className="text-[10px] text-slate-500">•</span>
                    <span className="text-[10px] text-slate-400">
                      {customForm.deliveryMode === "LATER" && customForm.scheduledTime
                        ? customForm.scheduledTime
                        : "Just now"}
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-xs text-slate-400">expand_more</span>
                </div>

                {/* Title */}
                <h4 className="text-xs font-bold text-white line-clamp-1">
                  {customForm.title.trim() || "Notification Title Preview"}
                </h4>

                {/* Message Body */}
                <p className="text-[11px] text-slate-300 leading-snug line-clamp-2">
                  {customForm.message.trim() || "Complete message body will be displayed here as it appears on the student's notification shade."}
                </p>

                {/* Optional Expanded Image */}
                {customForm.image.trim() && (
                  <div className="mt-2 rounded-xl overflow-hidden max-h-36 bg-slate-900 border border-slate-700/50">
                    <img
                      src={customForm.image.trim()}
                      alt="Banner Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  </div>
                )}

                {/* Action Button Preview */}
                <div className="pt-1 flex items-center gap-2">
                  <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded-lg border border-blue-500/20">
                    {customForm.deepLink.includes("/test")
                      ? "Start Test"
                      : customForm.deepLink.includes("/live-class")
                      ? "Join Live Class"
                      : "Open Atomic Pathshala"}
                  </span>
                </div>
              </div>

              {/* Delivery Targeting Details */}
              <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 space-y-1">
                <div className="flex justify-between">
                  <span>Target:</span>
                  <span className="text-white font-semibold">{customForm.targetAudience}</span>
                </div>
                <div className="flex justify-between">
                  <span>Channel:</span>
                  <span className="text-blue-400 font-semibold">
                    {customForm.sendPush ? "Android Push + In-App" : "In-App Only"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Time:</span>
                  <span className="text-emerald-400 font-semibold">
                    {customForm.deliveryMode === "LATER" && customForm.scheduledDate
                      ? `${customForm.scheduledDate} ${customForm.scheduledTime} IST`
                      : "Instant Dispatch"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SCHEDULED QUEUE */}
      {activeTab === "schedule" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Scheduled Delivery Queue</h2>
              <p className="text-xs text-slate-500">
                Future 15-minute class countdowns, scheduled test alerts, and custom notifications.
              </p>
            </div>
            <button
              onClick={fetchScheduled}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 self-start sm:self-center"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              Refresh Queue
            </button>
          </div>

          {loadingScheduled ? (
            <p className="text-xs text-slate-400 py-8 text-center">Loading scheduled queue...</p>
          ) : (!scheduledJobs || scheduledJobs.length === 0) ? (
            <div className="text-center py-12 space-y-2">
              <span className="material-symbols-outlined text-4xl text-slate-300">event_available</span>
              <p className="text-sm font-semibold text-slate-600">No pending scheduled notifications.</p>
              <p className="text-xs text-slate-400">
                When you schedule custom broadcasts or classes are scheduled, they will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Event Type</th>
                    <th className="py-3 px-3">Message Title & Preview</th>
                    <th className="py-3 px-3">Target</th>
                    <th className="py-3 px-3">Execute At (IST)</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(scheduledJobs || []).map((job) => {
                    const payload = job.payload || {};
                    const isPending = job.status === "PENDING";
                    const isProcessing = job.status === "PROCESSING";

                    return (
                      <tr key={job.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-slate-800">
                          {job.eventType}
                        </td>
                        <td className="py-3 px-3 max-w-xs">
                          <p className="font-bold text-slate-900 line-clamp-1">{payload.title || "Alert"}</p>
                          <p className="text-slate-500 line-clamp-1 text-[11px]">{payload.body || ""}</p>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[10px]">
                            {job.targetType}: {job.targetId || "All"}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-700">
                          {new Date(job.executeAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              isPending
                                ? "bg-amber-100 text-amber-800"
                                : isProcessing
                                ? "bg-blue-100 text-blue-800 animate-pulse"
                                : job.status === "PROCESSED"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {job.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          {isPending && (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleCancelJob(job.id)}
                                className="text-rose-600 hover:text-rose-800 font-semibold text-[11px]"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: QUIZ & TEST NOTIFICATIONS */}
      {activeTab === "quiz" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Quiz & Test Series Notifications</h2>
            <p className="text-xs text-slate-500 mt-1">
              Trigger event-driven test notifications, 15-minute countdown reminders, live alerts, and scorecard announcements.
            </p>
          </div>

          {loadingQuizTests ? (
            <p className="text-xs text-slate-400 py-8 text-center">Loading test series...</p>
          ) : (!quizTests || quizTests.length === 0) ? (
            <div className="text-center py-10 space-y-2">
              <span className="material-symbols-outlined text-4xl text-slate-300">quiz</span>
              <p className="text-sm font-semibold text-slate-600">No tests found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Test Name</th>
                    <th className="py-3 px-3">Batch</th>
                    <th className="py-3 px-3">Start / Open Time</th>
                    <th className="py-3 px-3">Attempts</th>
                    <th className="py-3 px-3 text-right">Instant Notification Triggers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(quizTests || []).map((test) => (
                    <tr key={test.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-bold text-slate-900">{test.name}</td>
                      <td className="py-3 px-3 text-slate-600">
                        {test.batchSchedule?.batch?.name || "All Enrolled"}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-700">
                        {test.openTime
                          ? new Date(test.openTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
                          : test.batchSchedule?.startsAt
                          ? new Date(test.batchSchedule.startsAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
                          : "Unscheduled"}
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-semibold">
                        {test._count?.attempts ?? 0}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleQuizNotificationAction(test.id, "REMIND_NOW")}
                            className="bg-amber-50 text-amber-700 hover:bg-amber-100 px-2.5 py-1 rounded-lg font-bold text-[11px] border border-amber-200 transition-all"
                            title="Send 15m reminder countdown"
                          >
                            Send Reminder
                          </button>
                          <button
                            onClick={() => handleQuizNotificationAction(test.id, "ANNOUNCE_LIVE")}
                            className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 py-1 rounded-lg font-bold text-[11px] border border-blue-200 transition-all"
                            title="Announce test is LIVE now"
                          >
                            Live Alert
                          </button>
                          <button
                            onClick={() => handleQuizNotificationAction(test.id, "PUBLISH_RESULT")}
                            className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2.5 py-1 rounded-lg font-bold text-[11px] border border-emerald-200 transition-all"
                            title="Announce results & scorecards"
                          >
                            Publish Results
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: MULTIPLE MESSAGE / BULK BROADCAST */}
      {activeTab === "multiple" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6 max-w-4xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Multiple Message Broadcast</h2>
              <p className="text-xs text-slate-500 mt-1">
                Compose a multi-sequence message campaign targeting different audiences and timings simultaneously.
              </p>
            </div>
            <button
              onClick={addBulkMessageItem}
              className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl border border-blue-200 transition-all"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Add Another Message
            </button>
          </div>

          <form onSubmit={handleSubmitBulkMessages} className="space-y-5">
            {bulkMessages.map((msg, idx) => (
              <div
                key={msg.id}
                className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 relative"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-xs font-bold text-blue-700">Message #{idx + 1}</span>
                  {bulkMessages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBulkMessageItem(msg.id)}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Message Title"
                    value={msg.title}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBulkMessages((prev) =>
                        prev.map((m) => (m.id === msg.id ? { ...m, title: val } : m))
                      );
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={msg.segmentType}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setBulkMessages((prev) =>
                          prev.map((m) => (m.id === msg.id ? { ...m, segmentType: val } : m))
                        );
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="ALL">All Students</option>
                      <option value="BATCH">Specific Batch</option>
                      <option value="CLASS">By Grade</option>
                      <option value="TARGET_EXAM">Target Exam</option>
                    </select>

                    <select
                      value={msg.priority}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setBulkMessages((prev) =>
                          prev.map((m) => (m.id === msg.id ? { ...m, priority: val } : m))
                        );
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High Priority</option>
                      <option value="URGENT">Urgent</option>
                      <option value="LOW">Low</option>
                    </select>
                  </div>
                </div>

                <textarea
                  required
                  rows={2}
                  placeholder="Notification body content..."
                  value={msg.body}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBulkMessages((prev) =>
                      prev.map((m) => (m.id === msg.id ? { ...m, body: val } : m))
                    );
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            ))}

            <button
              type="submit"
              disabled={submittingBulk}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-3 rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">send</span>
              {submittingBulk ? "Broadcasting..." : `Send All ${bulkMessages.length} Messages Now`}
            </button>
          </form>
        </div>
      )}

      {/* TAB 7: AUTO AUTOMATION RULES */}
      {activeTab === "rules" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Academic Lifecycle Automation Rules</h2>
              <p className="text-xs text-slate-500 mt-1">
                Autonomous background triggers that react to scheduling, live classrooms, tests, and DPP uploads.
              </p>
            </div>
            <button
              onClick={fetchRules}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              Refresh Rules
            </button>
          </div>

          {loadingRules ? (
            <p className="text-xs text-slate-400 py-8 text-center">Loading rules...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Event Trigger</th>
                    <th className="py-3 px-3">Description & Action</th>
                    <th className="py-3 px-3">Default Priority</th>
                    <th className="py-3 px-3">Channels</th>
                    <th className="py-3 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(rules || []).map((rule) => (
                    <tr key={rule.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        {rule.eventType}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {rule.eventType === "CLASS_SCHEDULED"
                          ? "Fires when new class is published. Notifies enrolled batch students."
                          : rule.eventType === "CLASS_RESCHEDULED"
                          ? "Fires when class date/time is moved. Cancels old reminder and alerts batch."
                          : rule.eventType === "CLASS_REMINDER_15_MIN"
                          ? "Automated 15-minute heads-up countdown before class start."
                          : rule.eventType === "LIVE_CLASS_STARTED"
                          ? "Teacher clicks Start Class. Instant join notification with deep link."
                          : rule.eventType === "TEST_SCHEDULED"
                          ? "New test series or mock test published to enrolled batch."
                          : rule.eventType === "TEST_REMINDER_15_MIN"
                          ? "15-minute countdown alert before test window opens."
                          : rule.eventType === "NEW_DPP"
                          ? "Teacher uploads daily practice paper / chapter DPP."
                          : "Autonomous system background trigger."}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            rule.priority === "HIGH"
                              ? "bg-rose-100 text-rose-800"
                              : rule.priority === "LOW"
                              ? "bg-slate-100 text-slate-600"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {rule.priority}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold text-[10px]">
                            FCM PUSH
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold text-[10px]">
                            IN_APP
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleToggleRule(rule)}
                          className={`px-3 py-1 rounded-full font-bold text-[11px] transition-all ${
                            rule.isEnabled
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                              : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                          }`}
                        >
                          {rule.isEnabled ? "Active" : "Disabled"}
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

      {/* TAB 8: DELIVERY & AUDIT LOGS */}
      {activeTab === "logs" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Delivery, Audit & Interaction Logs</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Full delivery lifecycle: FCM Acceptance, In-App Display, Student Open & Click timestamps.
              </p>
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Search student or title..."
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchLogs(1)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-600 w-44"
              />

              <select
                value={logChannelFilter}
                onChange={(e) => {
                  setLogChannelFilter(e.target.value);
                  fetchLogs(1);
                }}
                className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">All Channels</option>
                <option value="FCM">FCM Push</option>
                <option value="IN_APP">In-App Feed</option>
              </select>

              <select
                value={logStatusFilter}
                onChange={(e) => {
                  setLogStatusFilter(e.target.value);
                  fetchLogs(1);
                }}
                className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">All Statuses</option>
                <option value="FCM_ACCEPTED">FCM Accepted</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CLICKED">Clicked / Opened</option>
                <option value="FAILED">Failed</option>
              </select>

              <button
                onClick={() => fetchLogs(1)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-sm transition-all"
              >
                Filter
              </button>
            </div>
          </div>

          {loadingLogs ? (
            <p className="text-xs text-slate-400 py-10 text-center">Loading audit logs...</p>
          ) : (!logs || logs.length === 0) ? (
            <div className="text-center py-12 space-y-2">
              <span className="material-symbols-outlined text-4xl text-slate-300">manage_search</span>
              <p className="text-sm font-semibold text-slate-600">No delivery logs found matching filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Date & Time (IST)</th>
                    <th className="py-3 px-3">Student / Recipient</th>
                    <th className="py-3 px-3">Notification Title</th>
                    <th className="py-3 px-3">Channel</th>
                    <th className="py-3 px-3">Delivery Status</th>
                    <th className="py-3 px-3">Details / Provider Response</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(logs || []).map((log) => {
                    const notif = log.notification || {};
                    const isClicked = log.status === "CLICKED";
                    const isFailed = log.status === "FAILED";
                    const isAccepted = log.status === "FCM_ACCEPTED";

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-900">
                          {log.user?.name || log.user?.phone || "Student"}
                        </td>
                        <td className="py-3 px-3 max-w-xs">
                          <p className="font-bold text-slate-900 line-clamp-1">{notif.title || "Notification"}</p>
                          <span className="text-[10px] text-slate-400 font-mono">{notif.type || "GENERAL"}</span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-700">
                          {log.channel === "FCM" ? (
                            <span className="inline-flex items-center gap-1 text-blue-600">
                              <span className="material-symbols-outlined text-sm">phone_android</span>
                              FCM
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-600">
                              <span className="material-symbols-outlined text-sm">notifications</span>
                              In-App
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              isClicked
                                ? "bg-emerald-100 text-emerald-800"
                                : isAccepted
                                ? "bg-blue-100 text-blue-800"
                                : isFailed
                                ? "bg-rose-100 text-rose-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-500 text-[11px]">
                          {log.errorMessage ? (
                            <span className="text-rose-600 font-semibold">{log.errorMessage}</span>
                          ) : log.clickedAt ? (
                            <span className="text-emerald-600 font-semibold">
                              Opened at {new Date(log.clickedAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}
                            </span>
                          ) : (
                            <span className="text-slate-400">Delivered to device tray</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs text-slate-500">
                <span>
                  Page {logPage} of {Math.max(1, totalLogPages)}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={logPage <= 1}
                    onClick={() => fetchLogs(logPage - 1)}
                    className="px-3 py-1 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-50"
                  >
                    Previous
                  </button>
                  <button
                    disabled={logPage >= totalLogPages}
                    onClick={() => fetchLogs(logPage + 1)}
                    className="px-3 py-1 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
