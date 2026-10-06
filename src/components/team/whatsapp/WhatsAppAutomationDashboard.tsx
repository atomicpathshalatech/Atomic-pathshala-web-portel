"use client";

import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  Users,
  Send,
  Settings,
  Clock,
  CheckCircle2,
  AlertCircle,
  Upload,
  RefreshCw,
  Search,
  Plus,
  Play,
  Pause,
  Filter,
  FileSpreadsheet,
  Check,
  AlertTriangle,
  RotateCw,
  Copy,
} from "lucide-react";

interface WhatsAppAutomationDashboardProps {
  initialSettings: any;
  batches: Array<{ id: string; name: string }>;
  canManage: boolean;
}

export function WhatsAppAutomationDashboard({
  initialSettings,
  batches,
  canManage,
}: WhatsAppAutomationDashboardProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "contacts" | "campaigns" | "settings">("overview");
  const [settings, setSettings] = useState(initialSettings);
  const [savingSettings, setSavingSettings] = useState(false);

  // Queue State
  const [queueItems, setQueueItems] = useState<any[]>([]);
  const [queueStats, setQueueStats] = useState<any>({ total: 0, pending: 0, sent: 0, failed: 0 });
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueSearch, setQueueSearch] = useState("");
  const [queueStatusFilter, setQueueStatusFilter] = useState("");

  // Contacts State
  const [contacts, setContacts] = useState<any[]>([]);
  const [contactsTotal, setContactsTotal] = useState(0);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importDryRunResult, setImportDryRunResult] = useState<any>(null);
  const [importing, setImporting] = useState(false);

  // Campaigns State
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [showCreateCampaignModal, setShowCreateCampaignModal] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    description: "",
    templateName: "live_class_broadcast",
    targetBatchId: "",
    targetTags: "",
  });
  const [campaignPreview, setCampaignPreview] = useState<{ totalAudience: number } | null>(null);

  // Load Queue Items
  const fetchQueue = async () => {
    setQueueLoading(true);
    try {
      const query = new URLSearchParams();
      if (queueSearch) query.set("search", queueSearch);
      if (queueStatusFilter) query.set("status", queueStatusFilter);
      const res = await fetch(`/api/team/whatsapp/queue?${query.toString()}`);
      const data = await res.json();
      if (data?.data) {
        setQueueItems(data.data.items || []);
        setQueueStats(data.data.stats || { total: 0, pending: 0, sent: 0, failed: 0 });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setQueueLoading(false);
    }
  };

  // Load Contacts
  const fetchContacts = async () => {
    setContactsLoading(true);
    try {
      const query = new URLSearchParams();
      if (contactSearch) query.set("search", contactSearch);
      const res = await fetch(`/api/team/whatsapp/contacts?${query.toString()}`);
      const data = await res.json();
      if (data?.data) {
        setContacts(data.data.contacts || []);
        setContactsTotal(data.data.pagination?.total || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setContactsLoading(false);
    }
  };

  // Load Campaigns
  const fetchCampaigns = async () => {
    setCampaignsLoading(true);
    try {
      const res = await fetch("/api/team/whatsapp/campaigns");
      const data = await res.json();
      if (data?.data?.campaigns) {
        setCampaigns(data.data.campaigns);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCampaignsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "overview") fetchQueue();
    if (activeTab === "contacts") fetchContacts();
    if (activeTab === "campaigns") fetchCampaigns();
  }, [activeTab]);

  // Retry Failed Queue Item
  const handleRetryItem = async (id: string) => {
    try {
      const res = await fetch(`/api/team/whatsapp/queue/${id}/retry`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        alert("Message dispatched successfully");
        fetchQueue();
      } else {
        alert(data.error?.message || "Failed to retry message");
      }
    } catch (err: any) {
      alert(err.message || "Retry failed");
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch("/api/team/whatsapp/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (res.ok) {
        alert("WhatsApp automation settings updated!");
      } else {
        alert(data.error?.message || "Failed to update settings");
      }
    } catch (err: any) {
      alert(err.message || "Save settings failed");
    } finally {
      setSavingSettings(false);
    }
  };

  // CSV Import Parse & Preview
  const handleParseAndPreviewImport = async (dryRun: boolean) => {
    setImporting(true);
    try {
      // Parse CSV or TSV lines
      const lines = csvText.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) {
        alert("Please paste contact data or CSV content");
        setImporting(false);
        return;
      }

      const parsedRows: any[] = [];
      const firstLine = lines[0] ?? "";
      const firstLineLower = firstLine.toLowerCase();
      const hasHeader = firstLineLower.includes("phone") || firstLineLower.includes("mobile");
      const startIndex = hasHeader ? 1 : 0;

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const parts = line.split(/[\t,]/).map((p) => p.trim());
        const p0 = parts[0] ?? "";
        const p1 = parts[1] ?? "";
        const p2 = parts[2] ?? null;

        if (parts.length === 1 && p0) {
          parsedRows.push({ phone: p0 });
        } else if (parts.length >= 2) {
          // If second item looks like phone digits
          if (/\d{5,}/.test(p1)) {
            parsedRows.push({ name: p0, phone: p1, email: p2 });
          } else {
            parsedRows.push({ phone: p0, name: p1, email: p2 });
          }
        }
      }

      const res = await fetch("/api/team/whatsapp/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsedRows, dryRun }),
      });

      const data = await res.json();
      if (res.ok) {
        if (dryRun) {
          setImportDryRunResult(data.data);
        } else {
          alert(data.data?.message || "Import completed successfully");
          setShowImportModal(false);
          setCsvText("");
          setImportDryRunResult(null);
          fetchContacts();
        }
      } else {
        alert(data.error?.message || "Import failed");
      }
    } catch (err: any) {
      alert(err.message || "Import exception");
    } finally {
      setImporting(false);
    }
  };

  // Preview Campaign Audience
  const handlePreviewCampaignAudience = async () => {
    try {
      const tags = newCampaign.targetTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch("/api/team/whatsapp/campaigns/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetBatchId: newCampaign.targetBatchId || null,
          targetTags: tags,
        }),
      });
      const data = await res.json();
      if (data?.data) {
        setCampaignPreview(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Create Campaign
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const tags = newCampaign.targetTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch("/api/team/whatsapp/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCampaign.name,
          description: newCampaign.description,
          templateName: newCampaign.templateName,
          targetBatchId: newCampaign.targetBatchId || null,
          targetTags: tags,
        }),
      });

      if (res.ok) {
        setShowCreateCampaignModal(false);
        setNewCampaign({
          name: "",
          description: "",
          templateName: "live_class_broadcast",
          targetBatchId: "",
          targetTags: "",
        });
        setCampaignPreview(null);
        fetchCampaigns();
      }
    } catch (err: any) {
      alert(err.message || "Campaign create failed");
    }
  };

  // Start Campaign Broadcast
  const handleStartCampaign = async (campaignId: string) => {
    if (!confirm("Are you sure you want to broadcast this campaign to the target audience now?")) return;
    try {
      const res = await fetch(`/api/team/whatsapp/campaigns/${campaignId}/send`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        alert(data.data?.message || "Campaign broadcast started!");
        fetchCampaigns();
      } else {
        alert(data.error?.message || "Failed to start campaign");
      }
    } catch (err: any) {
      alert(err.message || "Broadcast failed");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">WhatsApp Automation & Broadcast</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                10:00 PM next-day digest, 15/30m teacher reminders, reschedule alerts & bulk contact campaigns
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === "overview"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            Message Queue
          </button>
          <button
            onClick={() => setActiveTab("contacts")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === "contacts"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            Contacts & Import
          </button>
          <button
            onClick={() => setActiveTab("campaigns")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === "campaigns"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            Campaigns
          </button>
          {canManage && (
            <button
              onClick={() => setActiveTab("settings")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === "settings"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Automation Settings
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: OVERVIEW & QUEUE LOGS */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Logged</span>
              <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{queueStats.total}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Pending in Queue</span>
              <div className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{queueStats.pending}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Successfully Delivered</span>
              <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{queueStats.sent}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Failed / Retrying</span>
              <div className="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400">{queueStats.failed}</div>
            </div>
          </div>

          {/* Queue Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search phone, recipient or message text..."
                value={queueSearch}
                onChange={(e) => setQueueSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchQueue()}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={queueStatusFilter}
                onChange={(e) => {
                  setQueueStatusFilter(e.target.value);
                  setTimeout(fetchQueue, 50);
                }}
                className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">PENDING</option>
                <option value="SENT">SENT</option>
                <option value="FAILED">FAILED</option>
              </select>

              <button
                onClick={fetchQueue}
                disabled={queueLoading}
                className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <RefreshCw className={`w-4 h-4 ${queueLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Queue Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Recipient</th>
                    <th className="py-3 px-4">Event Type</th>
                    <th className="py-3 px-4">Message Preview</th>
                    <th className="py-3 px-4">Scheduled / Sent At</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {queueItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No messages in queue
                      </td>
                    </tr>
                  ) : (
                    queueItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">{item.recipientName || "—"}</div>
                          <div className="text-slate-400 font-mono text-[11px]">{item.recipientPhone}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {item.messageType}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <p className="truncate text-slate-600 dark:text-slate-300" title={item.bodyText}>
                            {item.bodyText}
                          </p>
                          {item.errorMessage && (
                            <p className="text-[10px] text-rose-500 truncate mt-0.5" title={item.errorMessage}>
                              Error: {item.errorMessage}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {item.sentAt
                            ? new Date(item.sentAt).toLocaleString("en-IN")
                            : `Sched: ${new Date(item.scheduledFor).toLocaleString("en-IN")}`}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                              item.status === "SENT"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                : item.status === "FAILED"
                                  ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                                  : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {item.status} ({item.attempts} retries)
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {item.status === "FAILED" && (
                            <button
                              onClick={() => handleRetryItem(item.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 rounded-lg transition-colors"
                            >
                              <RotateCw className="w-3 h-3" />
                              Retry
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONTACTS & IMPORT */}
      {activeTab === "contacts" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search contact name, phone..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchContacts()}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
              >
                <Upload className="w-4 h-4" />
                Import Contacts (CSV / Google Sheets)
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Contact Name</th>
                    <th className="py-3 px-4">Phone Number (+91)</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Batch</th>
                    <th className="py-3 px-4">Tags</th>
                    <th className="py-3 px-4">Added On</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {contacts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No contacts found. Use &apos;Import Contacts&apos; to load contacts.
                      </td>
                    </tr>
                  ) : (
                    contacts.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{c.name}</td>
                        <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">{c.phone}</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {c.source}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{c.batch?.name || "—"}</td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1 flex-wrap">
                            {c.tags?.map((t: string) => (
                              <span
                                key={t}
                                className="px-1.5 py-0.5 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300 rounded text-[10px]"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {new Date(c.createdAt).toLocaleDateString("en-IN")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CAMPAIGNS */}
      {activeTab === "campaigns" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Active & Past Broadcast Campaigns</h2>
            <button
              onClick={() => setShowCreateCampaignModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Campaign
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.length === 0 ? (
              <div className="col-span-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400">
                No campaigns created yet. Click &apos;Create Campaign&apos; to schedule a broadcast.
              </div>
            ) : (
              campaigns.map((camp) => (
                <div
                  key={camp.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        {camp.templateName}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          camp.status === "COMPLETED"
                            ? "bg-emerald-50 text-emerald-700"
                            : camp.status === "RUNNING"
                              ? "bg-amber-50 text-amber-700 animate-pulse"
                              : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {camp.status}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white mt-3">{camp.name}</h3>
                    {camp.description && <p className="text-xs text-slate-500 mt-1">{camp.description}</p>}

                    <div className="grid grid-cols-3 gap-2 mt-4 text-center bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl">
                      <div>
                        <span className="block text-[10px] text-slate-400">Audience</span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{camp.totalAudience}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-emerald-500">Delivered</span>
                        <span className="text-xs font-bold text-emerald-600">{camp.sentCount}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-rose-500">Failed</span>
                        <span className="text-xs font-bold text-rose-600">{camp.failedCount}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      Created: {new Date(camp.createdAt).toLocaleDateString("en-IN")}
                    </span>
                    {camp.status === "DRAFT" && (
                      <button
                        onClick={() => handleStartCampaign(camp.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Start Broadcast
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: AUTOMATION SETTINGS */}
      {activeTab === "settings" && canManage && (
        <form onSubmit={handleSaveSettings} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6 max-w-4xl">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Central Automation Triggers & Schedule</h2>
            <p className="text-xs text-slate-500">Configure automated student class digests, teacher alerts and doubt reminders</p>
          </div>

          <div className="space-y-4 divide-y divide-slate-100 dark:divide-slate-800">
            {/* 10 PM Digest Setting */}
            <div className="pt-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Next-Day Student Class Digest (10:00 PM IST)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sends ONE consolidated WhatsApp message per student listing all tomorrow&apos;s classes with timings, faculty & YouTube links.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.digestEnabled}
                onChange={(e) => setSettings({ ...settings, digestEnabled: e.target.checked })}
                className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 mt-1 cursor-pointer"
              />
            </div>

            {/* Teacher Reminder Setting */}
            <div className="pt-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Teacher Class Reminder</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automated alert to teacher before class with batch name, start time and YouTube link.
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs text-slate-600 dark:text-slate-400">Reminder Timing:</span>
                  <select
                    value={settings.teacherReminderMinutes}
                    onChange={(e) => setSettings({ ...settings, teacherReminderMinutes: parseInt(e.target.value, 10) })}
                    className="px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <option value={15}>15 Minutes Before Class</option>
                    <option value={30}>30 Minutes Before Class (Default)</option>
                  </select>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.teacherReminderEnabled}
                onChange={(e) => setSettings({ ...settings, teacherReminderEnabled: e.target.checked })}
                className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 mt-1 cursor-pointer"
              />
            </div>

            {/* Reschedule Alert */}
            <div className="pt-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Class Rescheduled Instant Alert</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dispatches immediate WhatsApp alert to all enrolled students with old time, new time and YouTube link when timing changes.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.rescheduleAlertEnabled}
                onChange={(e) => setSettings({ ...settings, rescheduleAlertEnabled: e.target.checked })}
                className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 mt-1 cursor-pointer"
              />
            </div>

            {/* Doubt Booking & Reminder */}
            <div className="pt-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Doubt Session Booking & 1-Hour Reminder</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sends instant confirmation upon slot booking + automatic reminder 60 minutes before doubt session begins.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.doubtConfirmationEnabled}
                onChange={(e) => setSettings({ ...settings, doubtConfirmationEnabled: e.target.checked })}
                className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 mt-1 cursor-pointer"
              />
            </div>

            {/* Provider Configuration */}
            <div className="pt-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">WhatsApp Provider Credentials</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Provider Service</label>
                  <select
                    value={settings.provider}
                    onChange={(e) => setSettings({ ...settings, provider: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    <option value="INTERAKT">Interakt API (Recommended)</option>
                    <option value="AISENSY">AiSensy API</option>
                    <option value="META">Meta WhatsApp Cloud API</option>
                    <option value="MOCK">Development Mock (Console / Dry-run)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">API Key / Secret Token</label>
                  <input
                    type="password"
                    placeholder="Paste WhatsApp API Key"
                    value={settings.apiKey || ""}
                    onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={savingSettings}
              className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-colors"
            >
              {savingSettings ? "Saving Settings..." : "Save Automation Settings"}
            </button>
          </div>
        </form>
      )}

      {/* Modal: Bulk Import Contacts */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Import Contacts (CSV / Google Sheets)</h3>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <p className="text-xs text-slate-500">
                Paste columns directly from Google Sheets or Excel (Name, Phone, Email) or raw 10-digit Indian numbers.
              </p>

              <textarea
                rows={8}
                placeholder={`Example format:\nRahul Sharma, 9876543210, rahul@example.com\nAnanya Verma, 9811223344\n+919988776655`}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="w-full p-3 font-mono text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
              />

              {importDryRunResult && (
                <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl space-y-2 border border-slate-200 dark:border-slate-700">
                  <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Validation Preview
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="bg-white dark:bg-slate-800 p-2 rounded-lg">
                      <span className="block text-[10px] text-slate-400">Total Rows</span>
                      <span className="font-bold">{importDryRunResult.totalRows}</span>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-2 rounded-lg">
                      <span className="block text-[10px] text-emerald-500">New Valid</span>
                      <span className="font-bold text-emerald-600">{importDryRunResult.newCount}</span>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-2 rounded-lg">
                      <span className="block text-[10px] text-amber-500">Duplicates (Skipped)</span>
                      <span className="font-bold text-amber-600">{importDryRunResult.duplicateCount}</span>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-2 rounded-lg">
                      <span className="block text-[10px] text-rose-500">Invalid</span>
                      <span className="font-bold text-rose-600">{importDryRunResult.invalidCount}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={importing || !csvText.trim()}
                  onClick={() => handleParseAndPreviewImport(true)}
                  className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl"
                >
                  Preview & Validate
                </button>
                <button
                  type="button"
                  disabled={importing || !csvText.trim()}
                  onClick={() => handleParseAndPreviewImport(false)}
                  className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm"
                >
                  {importing ? "Importing..." : "Confirm & Import Contacts"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Campaign */}
      {showCreateCampaignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Create Broadcast Campaign</h3>
              <button onClick={() => setShowCreateCampaignModal(false)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. NEET 2026 Live Revision Marathon"
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Template Name *
                </label>
                <select
                  value={newCampaign.templateName}
                  onChange={(e) => setNewCampaign({ ...newCampaign, templateName: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  <option value="live_class_broadcast">live_class_broadcast (Class announcement & YouTube link)</option>
                  <option value="exam_reminder">exam_reminder (Test Series & DPP reminder)</option>
                  <option value="general_announcement">general_announcement (Important updates)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target Batch
                  </label>
                  <select
                    value={newCampaign.targetBatchId}
                    onChange={(e) => setNewCampaign({ ...newCampaign, targetBatchId: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    <option value="">All Batches (Global)</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Filter Tags
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. neet-2026, dropper"
                    value={newCampaign.targetTags}
                    onChange={(e) => setNewCampaign({ ...newCampaign, targetTags: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              {campaignPreview && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between">
                  <span>Targeted Recipients:</span>
                  <span className="font-bold text-sm">{campaignPreview.totalAudience} contacts</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handlePreviewCampaignAudience}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 rounded-lg"
                >
                  Calculate Audience
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateCampaignModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm"
                  >
                    Create Draft
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
