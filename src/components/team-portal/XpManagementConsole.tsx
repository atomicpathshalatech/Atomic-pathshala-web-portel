"use client";

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

type TabKey = "dashboard" | "rules" | "students" | "ledger" | "analytics";

interface DashboardStats {
  totalXpAwarded: number;
  totalSuccessfulTransactions: number;
  totalActiveStudents: number;
  activeRewardRules: number;
  failedTransactions: number;
  pendingTransactions: number;
  blockedDuplicates: number;
  todayXp: number;
  weekXp: number;
  monthXp: number;
}

interface RewardRule {
  id: string;
  activityName: string;
  displayLabel: string;
  description: string | null;
  category: string;
  xpPoints: number;
  triggerEvent: string;
  frequencyLimit: string;
  dailyLimit: number | null;
  weeklyLimit: number | null;
  maxRewardsLifetime: number | null;
  effectiveStartDate: string | null;
  effectiveEndDate: string | null;
  isActive: boolean;
  version: number;
  versions?: {
    id: string;
    version: number;
    xpPoints: number;
    displayLabel: string;
    changeReason: string | null;
    createdAt: string;
    createdBy?: { name: string; email: string } | null;
  }[];
  _count?: { transactions: number };
}

interface StudentItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  xpBalance: number;
  level: number;
  rank: number;
  lifetimeEarned: number;
  totalDeducted: number;
  streakDays: number;
  longestStreakDays: number;
  lastActivityDate: string | null;
  batches: { id: string; name: string; code: string }[];
}

interface TransactionItem {
  id: string;
  studentId: string;
  studentName: string;
  studentPhone: string | null;
  activity: string;
  rewardLabel: string;
  amount: number;
  ruleId: string | null;
  ruleVersion: number | null;
  idempotencyKey: string | null;
  status: "SUCCESSFUL" | "PENDING" | "FAILED" | "REVERSED";
  balanceBefore: number;
  balanceAfter: number;
  failureReason: string | null;
  adjustmentReason: string | null;
  adjustedBy: string | null;
  createdAt: string;
}

export function XpManagementConsole() {
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [loading, setLoading] = useState(false);

  // Dashboard State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTx, setRecentTx] = useState<any[]>([]);

  // Rules State
  const [rules, setRules] = useState<RewardRule[]>([]);
  const [editingRule, setEditingRule] = useState<RewardRule | null>(null);
  const [isCreateRuleOpen, setIsCreateRuleOpen] = useState(false);
  const [ruleFormData, setRuleFormData] = useState({
    activityName: "",
    displayLabel: "",
    description: "",
    category: "CORRECT_ANSWER",
    xpPoints: 10,
    triggerEvent: "EVENT_TRIGGER",
    frequencyLimit: "UNLIMITED",
    dailyLimit: "",
    isActive: true,
    changeReason: "Rule update",
  });

  // Students State
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentPage, setStudentPage] = useState(1);
  const [studentTotalPages, setStudentTotalPages] = useState(1);
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<any | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Ledger State
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerStatus, setLedgerStatus] = useState("");
  const [ledgerActivity, setLedgerActivity] = useState("");
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerTotalPages, setLedgerTotalPages] = useState(1);
  const [activityOptions, setActivityOptions] = useState<string[]>([]);

  // Manual Adjust Modal State
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustTargetStudent, setAdjustTargetStudent] = useState<StudentItem | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

  // Analytics State
  const [analyticsData, setAnalyticsData] = useState<any | null>(null);

  // 1. Fetch Dashboard Data
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/gamification/xp/dashboard");
      const json = await res.json();
      if (json.success) {
        setStats(json.data.stats);
        setRecentTx(json.data.recentTransactions);
      } else {
        toast.error(json.error || "Failed to load dashboard metrics");
      }
    } catch {
      toast.error("Network error loading dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Fetch Rules
  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/gamification/xp/rules");
      const json = await res.json();
      if (json.success) {
        setRules(json.data.rules);
      } else {
        toast.error(json.error || "Failed to load reward rules");
      }
    } catch {
      toast.error("Network error loading rules");
    } finally {
      setLoading(false);
    }
  }, []);

  // 3. Fetch Students
  const loadStudents = useCallback(async (page = 1, search = "") => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page), limit: "15" });
      if (search) query.append("search", search);
      const res = await fetch(`/api/admin/gamification/xp/students?${query.toString()}`);
      const json = await res.json();
      if (json.success) {
        setStudents(json.data.students);
        setStudentTotalPages(json.data.pagination.totalPages);
        setStudentPage(json.data.pagination.page);
      } else {
        toast.error(json.error || "Failed to load students");
      }
    } catch {
      toast.error("Network error loading students");
    } finally {
      setLoading(false);
    }
  }, []);

  // 4. Fetch Ledger
  const loadLedger = useCallback(async (page = 1, search = "", status = "", activity = "") => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) query.append("search", search);
      if (status) query.append("status", status);
      if (activity) query.append("activity", activity);
      const res = await fetch(`/api/admin/gamification/xp/transactions?${query.toString()}`);
      const json = await res.json();
      if (json.success) {
        setTransactions(json.data.transactions);
        setActivityOptions(json.data.activities || []);
        setLedgerTotalPages(json.data.pagination.totalPages);
        setLedgerPage(json.data.pagination.page);
      } else {
        toast.error(json.error || "Failed to load ledger transactions");
      }
    } catch {
      toast.error("Network error loading transactions");
    } finally {
      setLoading(false);
    }
  }, []);

  // 5. Fetch Analytics
  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/gamification/xp/analytics");
      const json = await res.json();
      if (json.success) {
        setAnalyticsData(json.data);
      } else {
        toast.error(json.error || "Failed to load analytics");
      }
    } catch {
      toast.error("Network error loading analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial tab loading
  useEffect(() => {
    if (activeTab === "dashboard") loadDashboard();
    if (activeTab === "rules") loadRules();
    if (activeTab === "students") loadStudents(1, studentSearch);
    if (activeTab === "ledger") loadLedger(1, ledgerSearch, ledgerStatus, ledgerActivity);
    if (activeTab === "analytics") loadAnalytics();
  }, [activeTab, loadDashboard, loadRules, loadStudents, loadLedger, loadAnalytics]);

  // Load single student full detail drawer
  const openStudentDetail = async (studentId: string) => {
    setIsDetailLoading(true);
    setSelectedStudentDetail(null);
    try {
      const res = await fetch(`/api/admin/gamification/xp/students/${studentId}`);
      const json = await res.json();
      if (json.success) {
        setSelectedStudentDetail(json.data.student);
      } else {
        toast.error(json.error || "Could not load student details");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setIsDetailLoading(false);
    }
  };

  // Rule Save / Edit Handler
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleFormData.displayLabel.trim()) {
      toast.error("Display label is required.");
      return;
    }

    try {
      if (editingRule) {
        // Update existing rule
        const res = await fetch(`/api/admin/gamification/xp/rules/${editingRule.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayLabel: ruleFormData.displayLabel,
            description: ruleFormData.description,
            category: ruleFormData.category,
            xpPoints: Number(ruleFormData.xpPoints),
            frequencyLimit: ruleFormData.frequencyLimit,
            dailyLimit: ruleFormData.dailyLimit ? Number(ruleFormData.dailyLimit) : null,
            isActive: ruleFormData.isActive,
            changeReason: ruleFormData.changeReason || "Admin configuration update",
          }),
        });
        const json = await res.json();
        if (json.success) {
          toast.success(`Rule '${ruleFormData.displayLabel}' updated (version ${json.data.rule.version})`);
          setEditingRule(null);
          loadRules();
        } else {
          toast.error(json.error || "Update failed");
        }
      } else {
        // Create new rule
        const res = await fetch("/api/admin/gamification/xp/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            activityName: ruleFormData.activityName.toUpperCase().replace(/\s+/g, "_"),
            displayLabel: ruleFormData.displayLabel,
            description: ruleFormData.description,
            category: ruleFormData.category,
            xpPoints: Number(ruleFormData.xpPoints),
            triggerEvent: ruleFormData.triggerEvent,
            frequencyLimit: ruleFormData.frequencyLimit,
            dailyLimit: ruleFormData.dailyLimit ? Number(ruleFormData.dailyLimit) : null,
            isActive: ruleFormData.isActive,
          }),
        });
        const json = await res.json();
        if (json.success) {
          toast.success(`Reward rule '${json.data.rule.displayLabel}' created successfully!`);
          setIsCreateRuleOpen(false);
          loadRules();
        } else {
          toast.error(json.error || "Creation failed");
        }
      }
    } catch {
      toast.error("Operation failed");
    }
  };

  // Toggle Rule Status
  const handleToggleRuleStatus = async (rule: RewardRule) => {
    try {
      const res = await fetch(`/api/admin/gamification/xp/rules/${rule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isActive: !rule.isActive,
          changeReason: rule.isActive ? "Deactivated from Super Admin Panel" : "Re-activated from Super Admin Panel",
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Rule is now ${!rule.isActive ? "ACTIVE" : "INACTIVE"}`);
        loadRules();
      } else {
        toast.error(json.error || "Toggle failed");
      }
    } catch {
      toast.error("Network error");
    }
  };

  // Manual Adjustment Submit
  const handleExecuteAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTargetStudent) return;
    if (adjustAmount === 0) {
      toast.error("Amount cannot be zero");
      return;
    }
    if (!adjustReason || adjustReason.trim().length < 3) {
      toast.error("Please enter a valid reason for the adjustment");
      return;
    }

    setIsSubmittingAdjust(true);
    try {
      const res = await fetch("/api/admin/gamification/xp/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: adjustTargetStudent.id,
          amount: Number(adjustAmount),
          reason: adjustReason.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.data.message || "Adjustment applied successfully!");
        setAdjustModalOpen(false);
        setAdjustReason("");
        setAdjustAmount(0);
        setAdjustTargetStudent(null);
        if (activeTab === "students") loadStudents(studentPage, studentSearch);
        if (selectedStudentDetail) openStudentDetail(selectedStudentDetail.id);
      } else {
        toast.error(json.error || "Adjustment failed");
      }
    } catch {
      toast.error("Network error processing adjustment");
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-amber-500/10 via-primary/5 to-surface border border-amber-500/20 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500 text-amber-950 font-bold flex items-center justify-center shadow-lg">
              <span className="material-symbols-outlined text-3xl">military_tech</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
                  XP &amp; Gamification Engine
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-700 border border-amber-500/30 uppercase tracking-wider">
                  Super Admin
                </span>
              </div>
              <p className="text-sm text-on-surface-variant mt-1">
                Centralized rule configuration, atomic transaction ledger, auditable adjustments &amp; leaderboard governance.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (activeTab === "dashboard") loadDashboard();
                if (activeTab === "rules") loadRules();
                if (activeTab === "students") loadStudents(studentPage, studentSearch);
                if (activeTab === "ledger") loadLedger(ledgerPage, ledgerSearch, ledgerStatus, ledgerActivity);
                if (activeTab === "analytics") loadAnalytics();
                toast.info("Refreshed latest data");
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-surface border border-outline-variant/40 hover:bg-surface-container-high transition shadow-sm text-on-surface"
            >
              <span className="material-symbols-outlined text-base">refresh</span>
              Refresh
            </button>
            <button
              onClick={() => {
                setRuleFormData({
                  activityName: "",
                  displayLabel: "",
                  description: "",
                  category: "CORRECT_ANSWER",
                  xpPoints: 10,
                  triggerEvent: "EVENT_TRIGGER",
                  frequencyLimit: "UNLIMITED",
                  dailyLimit: "",
                  isActive: true,
                  changeReason: "New rule",
                });
                setIsCreateRuleOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-on-primary hover:bg-primary/90 transition shadow-md"
            >
              <span className="material-symbols-outlined text-base">add_circle</span>
              New Reward Rule
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-outline-variant/20">
          {[
            { key: "dashboard", label: "XP Dashboard", icon: "dashboard" },
            { key: "rules", label: "Reward Rules", icon: "tune" },
            { key: "students", label: "Student Accounts", icon: "school" },
            { key: "ledger", label: "Transaction Ledger", icon: "receipt_long" },
            { key: "analytics", label: "Analytics & Reports", icon: "analytics" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabKey)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab.key
                  ? "bg-primary text-on-primary shadow-sm"
                  : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high border border-outline-variant/30"
              }`}
            >
              <span className="material-symbols-outlined text-base">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: DASHBOARD */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card rounded-2xl p-5 border border-outline-variant/30 bg-surface">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="text-xs font-bold uppercase tracking-wider">Total XP Awarded</span>
                <span className="material-symbols-outlined text-primary">stars</span>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-on-surface mt-2">
                {stats?.totalXpAwarded.toLocaleString() ?? "..."}
              </p>
              <p className="text-xs text-on-surface-variant mt-1">Across all confirmed activities</p>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-outline-variant/30 bg-surface">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="text-xs font-bold uppercase tracking-wider">Active Students</span>
                <span className="material-symbols-outlined text-emerald-600">group</span>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-on-surface mt-2">
                {stats?.totalActiveStudents ?? "..."}
              </p>
              <p className="text-xs text-on-surface-variant mt-1">Students with active XP balances</p>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-outline-variant/30 bg-surface">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="text-xs font-bold uppercase tracking-wider">Active Rules</span>
                <span className="material-symbols-outlined text-blue-600">rule</span>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-on-surface mt-2">
                {stats?.activeRewardRules ?? "..."}
              </p>
              <p className="text-xs text-on-surface-variant mt-1">Active reward engines</p>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-outline-variant/30 bg-surface">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="text-xs font-bold uppercase tracking-wider">Failed / Blocked</span>
                <span className="material-symbols-outlined text-rose-600">gpp_maybe</span>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-on-surface mt-2">
                {stats?.failedTransactions ?? 0}
              </p>
              <p className="text-xs text-rose-600 font-semibold mt-1">
                {stats?.blockedDuplicates ?? 0} duplicate attempts blocked
              </p>
            </div>
          </div>

          {/* Time Windows Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card rounded-2xl p-5 border border-outline-variant/30 bg-gradient-to-br from-blue-500/5 to-transparent">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Daily XP Awards (Today)</p>
              <p className="text-2xl font-black text-on-surface mt-1">{stats?.todayXp.toLocaleString() ?? 0} XP</p>
              <p className="text-xs text-on-surface-variant mt-1">Awarded in last 24h</p>
            </div>
            <div className="glass-card rounded-2xl p-5 border border-outline-variant/30 bg-gradient-to-br from-amber-500/5 to-transparent">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-600">Weekly XP Awards (7 Days)</p>
              <p className="text-2xl font-black text-on-surface mt-1">{stats?.weekXp.toLocaleString() ?? 0} XP</p>
              <p className="text-xs text-on-surface-variant mt-1">Awarded this week</p>
            </div>
            <div className="glass-card rounded-2xl p-5 border border-outline-variant/30 bg-gradient-to-br from-purple-500/5 to-transparent">
              <p className="text-xs font-bold uppercase tracking-wider text-purple-600">Monthly XP Awards (30 Days)</p>
              <p className="text-2xl font-black text-on-surface mt-1">{stats?.monthXp.toLocaleString() ?? 0} XP</p>
              <p className="text-xs text-on-surface-variant mt-1">Awarded this month</p>
            </div>
          </div>

          {/* Recent Live Ledger Feed */}
          <div className="glass-card rounded-3xl p-6 border border-outline-variant/30">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">history</span>
                Live Transaction Stream
              </h2>
              <button
                onClick={() => setActiveTab("ledger")}
                className="text-xs font-bold text-primary hover:underline"
              >
                View Full Ledger &rarr;
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/30 text-xs uppercase tracking-wider text-on-surface-variant">
                    <th className="py-2.5 px-3">Student</th>
                    <th className="py-2.5 px-3">Activity</th>
                    <th className="py-2.5 px-3">Reward Label</th>
                    <th className="py-2.5 px-3 text-right">Points</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {recentTx.map((tx) => (
                    <tr key={tx.id} className="hover:bg-surface-container-high/40 transition">
                      <td className="py-2.5 px-3 font-semibold text-on-surface">{tx.studentName}</td>
                      <td className="py-2.5 px-3 font-mono text-xs text-on-surface-variant">{tx.activity}</td>
                      <td className="py-2.5 px-3 text-on-surface">{tx.rewardLabel}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                        {tx.amount > 0 ? `+${tx.amount}` : tx.amount} XP
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            tx.status === "SUCCESSFUL"
                              ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-700 border border-rose-500/20"
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-xs text-on-surface-variant">
                        {new Date(tx.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                  {recentTx.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-on-surface-variant">
                        No transactions recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REWARD RULES */}
      {activeTab === "rules" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-on-surface">Configurable XP Reward Rules</h2>
              <p className="text-xs text-on-surface-variant">
                Every XP reward in Atomic Pathshala is governed by these server-verified rules.
              </p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-surface border border-outline-variant/30 text-on-surface-variant">
              {rules.length} Rules Configured
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`glass-card rounded-2xl p-5 border transition flex flex-col justify-between ${
                  rule.isActive
                    ? "border-outline-variant/40 bg-surface shadow-sm"
                    : "border-outline-variant/20 bg-surface/50 opacity-60"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                        {rule.category}
                      </span>
                      <h3 className="font-bold text-base text-on-surface mt-2">{rule.displayLabel}</h3>
                      <p className="font-mono text-xs text-on-surface-variant">{rule.activityName}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-xl text-amber-500">+{rule.xpPoints}</span>
                      <span className="text-xs text-on-surface-variant block">XP</span>
                    </div>
                  </div>

                  <p className="text-xs text-on-surface-variant mt-3 line-clamp-2">
                    {rule.description || "No rule description provided."}
                  </p>

                  <div className="mt-4 pt-3 border-t border-outline-variant/20 space-y-1.5 text-xs">
                    <div className="flex justify-between text-on-surface-variant">
                      <span>Frequency:</span>
                      <span className="font-semibold text-on-surface">{rule.frequencyLimit}</span>
                    </div>
                    <div className="flex justify-between text-on-surface-variant">
                      <span>Daily Cap:</span>
                      <span className="font-semibold text-on-surface">
                        {rule.dailyLimit ? `${rule.dailyLimit} XP/day` : "None"}
                      </span>
                    </div>
                    <div className="flex justify-between text-on-surface-variant">
                      <span>Version:</span>
                      <span className="font-mono font-semibold text-on-surface">v{rule.version}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-outline-variant/20 flex items-center justify-between">
                  <button
                    onClick={() => handleToggleRuleStatus(rule)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      rule.isActive
                        ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
                        : "bg-slate-500/10 text-slate-700 hover:bg-slate-500/20"
                    }`}
                  >
                    {rule.isActive ? "Active" : "Inactive"}
                  </button>
                  <button
                    onClick={() => {
                      setEditingRule(rule);
                      setRuleFormData({
                        activityName: rule.activityName,
                        displayLabel: rule.displayLabel,
                        description: rule.description || "",
                        category: rule.category,
                        xpPoints: rule.xpPoints,
                        triggerEvent: rule.triggerEvent,
                        frequencyLimit: rule.frequencyLimit,
                        dailyLimit: rule.dailyLimit ? String(rule.dailyLimit) : "",
                        isActive: rule.isActive,
                        changeReason: `Modified reward rule v${rule.version + 1}`,
                      });
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-primary text-on-primary hover:bg-primary/90 transition"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                    Edit Rule
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: STUDENT ACCOUNTS */}
      {activeTab === "students" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="w-full sm:w-96 relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-base">
                search
              </span>
              <input
                type="text"
                placeholder="Search by student name, phone, or ID..."
                value={studentSearch}
                onChange={(e) => {
                  setStudentSearch(e.target.value);
                  loadStudents(1, e.target.value);
                }}
                className="w-full pl-9 pr-4 py-2 rounded-xl text-sm bg-surface border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/40 text-on-surface shadow-sm"
              />
            </div>
            <span className="text-xs text-on-surface-variant">Showing active student accounts</span>
          </div>

          <div className="glass-card rounded-3xl border border-outline-variant/30 overflow-hidden shadow-sm bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/30 text-xs uppercase tracking-wider text-on-surface-variant bg-surface-container-low">
                    <th className="py-3 px-4">Rank</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Phone / Contact</th>
                    <th className="py-3 px-4 text-right">XP Balance</th>
                    <th className="py-3 px-4 text-center">Level</th>
                    <th className="py-3 px-4 text-center">Streak</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {students.map((student) => (
                    <tr key={student.id} className="hover:bg-surface-container-high/40 transition">
                      <td className="py-3 px-4 font-bold text-on-surface">
                        <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs">
                          #{student.rank}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-on-surface">{student.name}</p>
                        <p className="text-[11px] text-on-surface-variant font-mono truncate max-w-[200px]">
                          {student.id}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-xs text-on-surface-variant">
                        {student.phone || "No phone registered"}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-amber-600 text-base">
                        {student.xpBalance.toLocaleString()} XP
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-800">
                          Lvl {student.level}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-xs font-bold text-orange-600">
                        🔥 {student.streakDays}d
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => openStudentDetail(student.id)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition border border-outline-variant/40"
                        >
                          Audit Ledger
                        </button>
                        <button
                          onClick={() => {
                            setAdjustTargetStudent(student);
                            setAdjustAmount(0);
                            setAdjustReason("");
                            setAdjustModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 text-amber-950 hover:bg-amber-400 transition"
                        >
                          Adjust XP
                        </button>
                      </td>
                    </tr>
                  ))}
                  {students.length === 0 && !loading && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-on-surface-variant">
                        No students found matching your criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-4 border-t border-outline-variant/20 flex items-center justify-between text-xs text-on-surface-variant">
              <span>
                Page {studentPage} of {studentTotalPages}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={studentPage <= 1}
                  onClick={() => loadStudents(studentPage - 1, studentSearch)}
                  className="px-3 py-1 rounded-lg border border-outline-variant/40 disabled:opacity-40 hover:bg-surface-container-high transition"
                >
                  Previous
                </button>
                <button
                  disabled={studentPage >= studentTotalPages}
                  onClick={() => loadStudents(studentPage + 1, studentSearch)}
                  className="px-3 py-1 rounded-lg border border-outline-variant/40 disabled:opacity-40 hover:bg-surface-container-high transition"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TRANSACTION LEDGER */}
      {activeTab === "ledger" && (
        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-4 border border-outline-variant/30 flex flex-wrap items-center justify-between gap-4 bg-surface">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="Search by student, ID, or label..."
                value={ledgerSearch}
                onChange={(e) => {
                  setLedgerSearch(e.target.value);
                  loadLedger(1, e.target.value, ledgerStatus, ledgerActivity);
                }}
                className="px-3 py-1.5 rounded-xl text-xs bg-surface-container-lowest border border-outline-variant/40 text-on-surface w-64 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <select
                value={ledgerStatus}
                onChange={(e) => {
                  setLedgerStatus(e.target.value);
                  loadLedger(1, ledgerSearch, e.target.value, ledgerActivity);
                }}
                className="px-3 py-1.5 rounded-xl text-xs bg-surface-container-lowest border border-outline-variant/40 text-on-surface focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="SUCCESSFUL">Successful</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
                <option value="REVERSED">Reversed</option>
              </select>

              <select
                value={ledgerActivity}
                onChange={(e) => {
                  setLedgerActivity(e.target.value);
                  loadLedger(1, ledgerSearch, ledgerStatus, e.target.value);
                }}
                className="px-3 py-1.5 rounded-xl text-xs bg-surface-container-lowest border border-outline-variant/40 text-on-surface focus:outline-none max-w-xs"
              >
                <option value="">All Activities</option>
                {activityOptions.map((act) => (
                  <option key={act} value={act}>
                    {act}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => loadLedger(ledgerPage, ledgerSearch, ledgerStatus, ledgerActivity)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface border border-outline-variant/40 hover:bg-surface-container-high transition"
            >
              <span className="material-symbols-outlined text-sm">filter_alt</span>
              Apply Filters
            </button>
          </div>

          <div className="glass-card rounded-3xl border border-outline-variant/30 overflow-hidden shadow-sm bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/30 text-xs uppercase tracking-wider text-on-surface-variant bg-surface-container-low">
                    <th className="py-3 px-3">Tx ID</th>
                    <th className="py-3 px-3">Student Name</th>
                    <th className="py-3 px-3">Activity &amp; Label</th>
                    <th className="py-3 px-3 text-right">Points</th>
                    <th className="py-3 px-3 text-center">Balance Delta</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20 font-mono text-xs">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-surface-container-high/40 transition">
                      <td className="py-3 px-3 text-on-surface-variant font-mono text-[11px] truncate max-w-[120px]">
                        {tx.id}
                      </td>
                      <td className="py-3 px-3 font-sans font-semibold text-on-surface">
                        {tx.studentName}
                        <span className="block text-[10px] text-on-surface-variant font-mono">{tx.studentId}</span>
                      </td>
                      <td className="py-3 px-3 font-sans">
                        <span className="font-bold text-on-surface text-xs block">{tx.rewardLabel}</span>
                        <span className="text-[10px] text-on-surface-variant font-mono">{tx.activity}</span>
                        {tx.adjustmentReason && (
                          <span className="block text-[10.5px] text-amber-700 italic">
                            Reason: {tx.adjustmentReason} (by {tx.adjustedBy || "Admin"})
                          </span>
                        )}
                        {tx.failureReason && (
                          <span className="block text-[10.5px] text-rose-600 font-sans font-bold">
                            Failure: {tx.failureReason}
                          </span>
                        )}
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-bold text-sm ${
                          tx.amount > 0 ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {tx.amount > 0 ? `+${tx.amount}` : tx.amount} XP
                      </td>
                      <td className="py-3 px-3 text-center text-[11px] text-on-surface-variant">
                        {tx.balanceBefore} &rarr; {tx.balanceAfter}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold ${
                            tx.status === "SUCCESSFUL"
                              ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                              : tx.status === "FAILED"
                              ? "bg-rose-500/10 text-rose-700 border border-rose-500/20"
                              : "bg-amber-500/10 text-amber-700 border border-amber-500/20"
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-[11px] text-on-surface-variant font-sans">
                        {new Date(tx.createdAt).toLocaleDateString()}{" "}
                        {new Date(tx.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && !loading && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-on-surface-variant font-sans">
                        No transactions found matching criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-4 border-t border-outline-variant/20 flex items-center justify-between text-xs text-on-surface-variant">
              <span>
                Page {ledgerPage} of {ledgerTotalPages}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={ledgerPage <= 1}
                  onClick={() => loadLedger(ledgerPage - 1, ledgerSearch, ledgerStatus, ledgerActivity)}
                  className="px-3 py-1 rounded-lg border border-outline-variant/40 disabled:opacity-40 hover:bg-surface-container-high transition"
                >
                  Previous
                </button>
                <button
                  disabled={ledgerPage >= ledgerTotalPages}
                  onClick={() => loadLedger(ledgerPage + 1, ledgerSearch, ledgerStatus, ledgerActivity)}
                  className="px-3 py-1 rounded-lg border border-outline-variant/40 disabled:opacity-40 hover:bg-surface-container-high transition"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ANALYTICS & REPORTS */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Activity-wise Breakdown */}
            <div className="glass-card rounded-3xl p-6 border border-outline-variant/30 bg-surface">
              <h3 className="text-base font-bold text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">pie_chart</span>
                Activity Distribution Breakdown
              </h3>
              <div className="space-y-3">
                {analyticsData?.activityDistribution?.map((item: any) => (
                  <div key={item.activity} className="flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-on-surface">{item.activity}</p>
                      <p className="text-[11px] text-on-surface-variant">{item.count} confirmed awards</p>
                    </div>
                    <span className="font-bold text-emerald-600 text-sm">
                      +{item.totalXp.toLocaleString()} XP
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Batch Comparison */}
            <div className="glass-card rounded-3xl p-6 border border-outline-variant/30 bg-surface">
              <h3 className="text-base font-bold text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">groups</span>
                Batch-Wise XP Comparison
              </h3>
              <div className="space-y-3">
                {analyticsData?.batchComparison?.map((batch: any) => (
                  <div
                    key={batch.id}
                    className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-sm text-on-surface">{batch.name}</p>
                      <p className="text-xs text-on-surface-variant">
                        {batch.studentCount} students · Code: {batch.code}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-primary">{batch.totalXp.toLocaleString()} XP</p>
                      <p className="text-[11px] text-on-surface-variant">Avg: {batch.avgXp} XP/student</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Students Leaderboard Comparison */}
          <div className="glass-card rounded-3xl p-6 border border-outline-variant/30 bg-surface">
            <h3 className="text-base font-bold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-500">trophy</span>
              Authoritative Top Students XP Standing
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              {analyticsData?.topStudents?.map((s: any) => (
                <div
                  key={s.studentId}
                  className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary text-on-primary">
                      #{s.rank}
                    </span>
                    <span className="text-xs font-bold text-orange-600">🔥 {s.streak}d</span>
                  </div>
                  <div className="mt-2">
                    <p className="font-bold text-sm text-on-surface truncate">{s.name}</p>
                    <p className="text-xs text-on-surface-variant">Level {s.level}</p>
                  </div>
                  <p className="text-lg font-black text-amber-600 mt-2">{s.xp.toLocaleString()} XP</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT / CREATE RULE */}
      {(editingRule || isCreateRuleOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="glass-card rounded-3xl p-6 sm:p-8 bg-surface border border-outline-variant/40 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-on-surface">
                {editingRule ? `Edit Rule: ${editingRule.displayLabel}` : "Create New Reward Rule"}
              </h3>
              <button
                onClick={() => {
                  setEditingRule(null);
                  setIsCreateRuleOpen(false);
                }}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-4">
              {!editingRule && (
                <div>
                  <label className="text-xs font-bold text-on-surface uppercase tracking-wider block mb-1">
                    Activity Name (System Key)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. RECORDED_LECTURE"
                    value={ruleFormData.activityName}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, activityName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-sm bg-surface-container-lowest border border-outline-variant/40 text-on-surface uppercase"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-on-surface uppercase tracking-wider block mb-1">
                  Display Label
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Recorded Lecture Completed"
                  value={ruleFormData.displayLabel}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, displayLabel: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-sm bg-surface-container-lowest border border-outline-variant/40 text-on-surface"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface uppercase tracking-wider block mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe when and how this reward is earned..."
                  value={ruleFormData.description}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-sm bg-surface-container-lowest border border-outline-variant/40 text-on-surface"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-on-surface uppercase tracking-wider block mb-1">
                    XP Points
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    required
                    value={ruleFormData.xpPoints}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, xpPoints: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl text-sm bg-surface-container-lowest border border-outline-variant/40 text-on-surface font-bold text-amber-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-on-surface uppercase tracking-wider block mb-1">
                    Frequency Limit
                  </label>
                  <select
                    value={ruleFormData.frequencyLimit}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, frequencyLimit: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-sm bg-surface-container-lowest border border-outline-variant/40 text-on-surface"
                  >
                    <option value="UNLIMITED">UNLIMITED</option>
                    <option value="ONCE_PER_DAY">ONCE_PER_DAY</option>
                    <option value="ONCE_PER_WEEK">ONCE_PER_WEEK</option>
                    <option value="ONCE_PER_EVENT">ONCE_PER_EVENT</option>
                    <option value="ONCE_LIFETIME">ONCE_LIFETIME</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface uppercase tracking-wider block mb-1">
                  Daily Limit (Optional XP Cap)
                </label>
                <input
                  type="number"
                  placeholder="Optional max XP per day"
                  value={ruleFormData.dailyLimit}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, dailyLimit: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-sm bg-surface-container-lowest border border-outline-variant/40 text-on-surface"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface uppercase tracking-wider block mb-1">
                  Reason for Change (Audit Log)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Adjusted points for semester exam motivation"
                  value={ruleFormData.changeReason}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, changeReason: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-sm bg-surface-container-lowest border border-outline-variant/40 text-on-surface"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="ruleActiveCheck"
                  checked={ruleFormData.isActive}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, isActive: e.target.checked })}
                  className="rounded border-outline-variant/40 text-primary focus:ring-primary"
                />
                <label htmlFor="ruleActiveCheck" className="text-xs font-semibold text-on-surface">
                  Rule is Active &amp; Awarding
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => {
                    setEditingRule(null);
                    setIsCreateRuleOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-surface border border-outline-variant/40 hover:bg-surface-container-high transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-on-primary hover:bg-primary/90 transition shadow-md"
                >
                  Save Reward Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MANUAL XP ADJUSTMENT */}
      {adjustModalOpen && adjustTargetStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="glass-card rounded-3xl p-6 sm:p-8 bg-surface border border-outline-variant/40 shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500">tune</span>
                Manual XP Adjustment
              </h3>
              <button onClick={() => setAdjustModalOpen(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 mb-4">
              <p className="text-xs font-bold text-on-surface-variant uppercase">Student</p>
              <p className="font-bold text-on-surface">{adjustTargetStudent.name}</p>
              <p className="text-xs text-on-surface-variant font-mono">Current Balance: {adjustTargetStudent.xpBalance} XP</p>
            </div>

            <form onSubmit={handleExecuteAdjustment} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-on-surface uppercase tracking-wider block mb-1">
                  Adjustment Amount (XP)
                </label>
                <p className="text-[11px] text-on-surface-variant mb-1">
                  Use positive numbers to add XP (e.g. 50), or negative to deduct (e.g. -50).
                </p>
                <input
                  type="number"
                  required
                  placeholder="+50 or -50"
                  value={adjustAmount || ""}
                  onChange={(e) => setAdjustAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl text-base font-bold bg-surface-container-lowest border border-outline-variant/40 text-on-surface"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface uppercase tracking-wider block mb-1">
                  Mandatory Audit Reason
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Explain why this adjustment is being made (e.g. System reconciliation, quiz correction, contest winner)..."
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm bg-surface-container-lowest border border-outline-variant/40 text-on-surface"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                <span className="font-bold text-amber-900 block">Preview Balance Impact:</span>
                <span className="text-amber-800">
                  {adjustTargetStudent.xpBalance} XP &rarr;{" "}
                  <strong>{Math.max(0, adjustTargetStudent.xpBalance + (adjustAmount || 0))} XP</strong>
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-surface border border-outline-variant/40 hover:bg-surface-container-high transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdjust || adjustAmount === 0 || !adjustReason.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-amber-950 hover:bg-amber-400 disabled:opacity-50 transition shadow-md"
                >
                  {isSubmittingAdjust ? "Applying..." : "Confirm & Record Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER: INDIVIDUAL STUDENT AUDIT DETAIL */}
      {selectedStudentDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-surface h-full shadow-2xl p-6 sm:p-8 flex flex-col justify-between overflow-y-auto border-l border-outline-variant/30">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-outline-variant/30">
                <div>
                  <h3 className="text-xl font-bold text-on-surface">{selectedStudentDetail.name}</h3>
                  <p className="text-xs text-on-surface-variant font-mono">{selectedStudentDetail.id}</p>
                </div>
                <button
                  onClick={() => setSelectedStudentDetail(null)}
                  className="text-on-surface-variant hover:text-on-surface"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Student Overview Cards */}
              <div className="grid grid-cols-3 gap-3 my-4">
                <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30">
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase">Current XP</span>
                  <p className="text-xl font-black text-amber-600">{selectedStudentDetail.xpBalance}</p>
                  <span className="text-[10px] text-on-surface-variant">Rank #{selectedStudentDetail.rank}</span>
                </div>
                <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30">
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase">Lifetime Earned</span>
                  <p className="text-xl font-black text-emerald-600">+{selectedStudentDetail.lifetimeEarned}</p>
                  <span className="text-[10px] text-on-surface-variant">All time</span>
                </div>
                <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30">
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase">Total Deducted</span>
                  <p className="text-xl font-black text-rose-600">-{selectedStudentDetail.totalDeducted}</p>
                  <span className="text-[10px] text-on-surface-variant">Redeemed/Adjusted</span>
                </div>
              </div>

              {/* Activity breakdown */}
              <div className="mb-6">
                <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider mb-2">
                  Activity-Wise Breakdown
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {selectedStudentDetail.activityBreakdown?.map((item: any) => (
                    <div
                      key={item.activity}
                      className="p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/20 flex justify-between items-center text-xs"
                    >
                      <span className="font-semibold text-on-surface">{item.activity}</span>
                      <span className="font-bold text-emerald-600">+{item.totalXp} XP ({item.count})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Complete Confirmed Transactions */}
              <div>
                <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider mb-2">
                  Confirmed Transaction History ({selectedStudentDetail.transactions?.length || 0})
                </h4>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {selectedStudentDetail.transactions?.map((t: any) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/20 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-on-surface">{t.rewardLabel}</p>
                        <p className="text-[11px] text-on-surface-variant font-mono">
                          {t.activity} · {new Date(t.createdAt).toLocaleDateString()}
                        </p>
                        {t.adjustmentReason && (
                          <p className="text-[10.5px] text-amber-700 italic">
                            Reason: {t.adjustmentReason} (by {t.adjustedBy || "Admin"})
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <span
                          className={`font-black text-sm block ${
                            t.amount > 0 ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {t.amount > 0 ? `+${t.amount}` : t.amount} XP
                        </span>
                        <span className="text-[10px] text-on-surface-variant">
                          {t.balanceBefore} &rarr; {t.balanceAfter}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-outline-variant/30 flex justify-end">
              <button
                onClick={() => setSelectedStudentDetail(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-surface border border-outline-variant/40 hover:bg-surface-container-high transition"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
