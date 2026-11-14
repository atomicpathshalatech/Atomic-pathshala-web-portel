"use client";

import React, { useEffect, useState } from "react";
import {
  FiCpu,
  FiServer,
  FiActivity,
  FiDollarSign,
  FiCheckCircle,
  FiAlertTriangle,
  FiRefreshCw,
  FiLayers,
  FiZap,
  FiShield,
  FiPlay,
} from "react-icons/fi";

interface ProjectData {
  id: string;
  name: string;
  assignedRole: string;
  maskedKey: string;
  billingType: string;
  enabled: boolean;
  isHealthy: boolean;
  failureReason?: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  activeInFlightRequests: number;
  lastSuccessAt?: number;
  lastFailureAt?: number;
}

interface ModelData {
  id: string;
  displayName: string;
  tier: string;
  contextWindowTokens: number;
  inputPricePerMillionUsd: number;
  outputPricePerMillionUsd: number;
  enabled: boolean;
}

interface QueueData {
  pendingTasks: number;
  activeConcurrency: number;
  maxConcurrency: number;
  totalQueued: number;
  totalProcessed: number;
  peakQueueDepth: number;
}

interface CacheData {
  hits: number;
  misses: number;
  inFlightDeduplicated: number;
  tokensSaved: number;
  cachedEntriesCount: number;
}

interface TelemetryEntry {
  timestamp: number;
  workload: string;
  model: string;
  project: string;
  durationMs: number;
  costInr: number;
  ok: boolean;
  errorCode?: string;
}

export default function AICenterPage() {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [models, setModels] = useState<ModelData[]>([]);
  const [queue, setQueue] = useState<QueueData | null>(null);
  const [cache, setCache] = useState<CacheData | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryEntry[]>([]);
  const [todaySummary, setTodaySummary] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"projects" | "models" | "queue" | "telemetry" | "guide">("projects");
  const [testingProject, setTestingProject] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/team/ai-infrastructure");
      const json = await res.json();
      if (json.success) {
        setProjects(json.data.projects || []);
        setModels(json.data.models || []);
        setQueue(json.data.queue || null);
        setCache(json.data.cache || null);
        setTelemetry(json.data.telemetry || []);
        setTodaySummary(json.data.todaySummary || null);
      }
    } catch (e) {
      console.error("Failed to load AI infrastructure data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleToggleProject = async (projectId: string, current: boolean) => {
    try {
      await fetch("/api/team/ai-infrastructure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_project", payload: { projectId, enabled: !current } }),
      });
      fetchStats();
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleModel = async (modelId: string, current: boolean) => {
    try {
      await fetch("/api/team/ai-infrastructure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_model", payload: { modelId, enabled: !current } }),
      });
      fetchStats();
    } catch (e) {
      console.error(e);
    }
  };

  const handleTestProject = async (projectId: string) => {
    try {
      setTestingProject(projectId);
      setTestResult(null);
      const res = await fetch("/api/team/ai-infrastructure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test_project", payload: { projectId } }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setTestResult({
          id: projectId,
          ok: json.data.healthy,
          msg: json.data.healthy ? `✓ Response in ${json.data.latencyMs}ms: "${json.data.reply}"` : `✗ ${json.data.error}`,
        });
      }
    } catch (e: any) {
      setTestResult({ id: projectId, ok: false, msg: e.message });
    } finally {
      setTestingProject(null);
      fetchStats();
    }
  };

  const handleClearCache = async () => {
    if (!confirm("Clear in-memory AI response cache?")) return;
    await fetch("/api/team/ai-infrastructure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear_cache" }),
    });
    fetchStats();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-blue-600 text-white shadow-sm">
              <FiCpu className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Gemini AI Infrastructure &amp; Quota Control Center
              </h1>
              <p className="text-sm text-slate-500">
                Centralized gateway, multi-project failover, adaptive model routing, and cost optimization.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchStats}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 shadow-sm transition"
          >
            <FiRefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
            Refresh Telemetry
          </button>
          <button
            onClick={handleClearCache}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-200 text-slate-700 transition"
          >
            Clear Cache ({cache?.cachedEntriesCount ?? 0})
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Projects */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Healthy Project Fleet</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              {projects.filter((p) => p.isHealthy && p.enabled).length} / {projects.length}
            </h3>
            <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
              <FiCheckCircle className="w-3.5 h-3.5" /> High availability ready
            </p>
          </div>
          <span className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <FiServer className="w-6 h-6" />
          </span>
        </div>

        {/* Total Today Calls */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today&apos;s Requests</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              {todaySummary?.totalCalls?.toLocaleString() ?? 0}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Failed: <span className="font-semibold text-rose-600">{todaySummary?.failedCalls ?? 0}</span>
            </p>
          </div>
          <span className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <FiActivity className="w-6 h-6" />
          </span>
        </div>

        {/* Cache Savings */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cache Hits / Saved</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{cache?.hits ?? 0} hits</h3>
            <p className="text-xs text-indigo-600 font-medium mt-1 flex items-center gap-1">
              <FiZap className="w-3.5 h-3.5" /> {cache?.tokensSaved?.toLocaleString() ?? 0} tokens saved
            </p>
          </div>
          <span className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <FiZap className="w-6 h-6" />
          </span>
        </div>

        {/* Queue Concurrency */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Concurrency</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              {queue?.activeConcurrency ?? 0} / {queue?.maxConcurrency ?? 6}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Pending in Queue: <span className="font-semibold text-amber-600">{queue?.pendingTasks ?? 0}</span>
            </p>
          </div>
          <span className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <FiLayers className="w-6 h-6" />
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab("projects")}
          className={`pb-3 border-b-2 transition ${
            activeTab === "projects"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Project &amp; Credential Registry ({projects.length})
        </button>
        <button
          onClick={() => setActiveTab("models")}
          className={`pb-3 border-b-2 transition ${
            activeTab === "models"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Intelligent Model Router ({models.length})
        </button>
        <button
          onClick={() => setActiveTab("queue")}
          className={`pb-3 border-b-2 transition ${
            activeTab === "queue"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Request Queue &amp; Scheduler
        </button>
        <button
          onClick={() => setActiveTab("telemetry")}
          className={`pb-3 border-b-2 transition ${
            activeTab === "telemetry"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Recent Live Telemetry ({telemetry.length})
        </button>
        <button
          onClick={() => setActiveTab("guide")}
          className={`pb-3 border-b-2 transition ${
            activeTab === "guide"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Google Cloud Billing &amp; Quota Guide
        </button>
      </div>

      {/* Tab 1: Project & Credential Registry */}
      {activeTab === "projects" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Configured Google Cloud Projects</h2>
            <span className="text-xs text-slate-500">
              Zero-quota and depleted projects are automatically isolated to prevent 429 stalls.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((proj) => (
              <div
                key={proj.id}
                className={`bg-white rounded-xl border p-5 shadow-xs transition ${
                  proj.isHealthy && proj.enabled
                    ? "border-slate-200 hover:border-blue-300"
                    : "border-rose-200 bg-rose-50/20"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        proj.isHealthy && proj.enabled
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {proj.isHealthy && proj.enabled ? "HEALTHY" : "RESTRICTED / BLOCKED"}
                    </span>
                    <h3 className="font-bold text-slate-900 text-base mt-2">{proj.name}</h3>
                    <p className="text-xs font-mono text-slate-500 mt-0.5">Key: {proj.maskedKey}</p>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={proj.enabled}
                      onChange={() => handleToggleProject(proj.id, proj.enabled)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Assigned Workload:</span>
                    <span className="font-semibold text-slate-700">{proj.assignedRole}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Billing Category:</span>
                    <span className="font-semibold text-slate-700">{proj.billingType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Active In-Flight:</span>
                    <span className="font-semibold text-blue-600">{proj.activeInFlightRequests} / 3 concurrent</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Request Stats:</span>
                    <span className="text-slate-700">
                      {proj.successfulRequests} success / {proj.failedRequests} fail
                    </span>
                  </div>
                </div>

                {proj.failureReason && (
                  <div className="mt-3 p-2 bg-rose-50 border border-rose-200 rounded text-[11px] text-rose-700 font-medium">
                    {proj.failureReason}
                  </div>
                )}

                {testResult?.id === proj.id && (
                  <div
                    className={`mt-3 p-2 rounded text-[11px] font-mono ${
                      testResult.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
                    }`}
                  >
                    {testResult.msg}
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => handleTestProject(proj.id)}
                    disabled={testingProject === proj.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold transition"
                  >
                    <FiPlay className="w-3 h-3 text-blue-600" />
                    {testingProject === proj.id ? "Pinging..." : "Test Ping"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Intelligent Model Router */}
      {activeTab === "models" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-slate-900">Model Routing Catalog</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Low-cost tasks use Flash Lite; complex multi-step problems use Flash Preview. Gemini 3.8-flash (503 hang) is blacklisted.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Model Name</th>
                  <th className="py-3 px-4">Complexity Tier</th>
                  <th className="py-3 px-4">Context Window</th>
                  <th className="py-3 px-4">Input / Output Price (per 1M)</th>
                  <th className="py-3 px-4">Est. Cost / Question</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {models.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900">{m.displayName}</span>
                      <p className="text-xs font-mono text-slate-400">{m.id}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                          m.tier === "LOW_COST"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : m.tier === "BALANCED"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-purple-50 text-purple-700 border border-purple-200"
                        }`}
                      >
                        {m.tier}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600">
                      {m.contextWindowTokens.toLocaleString()} tokens
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-600">
                      ${m.inputPricePerMillionUsd} / ${m.outputPricePerMillionUsd}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-slate-800">
                      ~0.05p – 0.15p (₹0.0005)
                    </td>
                    <td className="py-3 px-4 text-right">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={m.enabled}
                          onChange={() => handleToggleModel(m.id, m.enabled)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Request Queue */}
      {activeTab === "queue" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900">Concurrency &amp; Rate-Limit Governor</h2>
            <p className="text-xs text-slate-500">
              Restricts concurrent requests sent to Google to prevent transient 429 rate limit errors.
            </p>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 font-medium">Max Server Concurrency:</span>
                <span className="font-bold text-blue-600">{queue?.maxConcurrency ?? 6} parallel calls</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 font-medium">Active In-Flight Calls:</span>
                <span className="font-bold text-slate-800">{queue?.activeConcurrency ?? 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 font-medium">Tasks Queued in Memory:</span>
                <span className="font-bold text-amber-600">{queue?.pendingTasks ?? 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 font-medium">Peak Queue Depth:</span>
                <span className="font-bold text-slate-800">{queue?.peakQueueDepth ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900">Priority Lane Architecture</h2>
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="font-bold text-emerald-800">Priority 1 (Interactive Highest):</p>
                <p className="text-emerald-700 mt-0.5">
                  Student Question Practice &amp; AI Tutor Doubts. Bypasses background queue, guaranteed immediate execution.
                </p>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="font-bold text-blue-800">Priority 2 &amp; 3 (Standard):</p>
                <p className="text-blue-700 mt-0.5">Test Portal question creation, single-question AI enhancement.</p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="font-bold text-amber-800">Priority 4 (Background Batches):</p>
                <p className="text-amber-700 mt-0.5">
                  Multi-page PDF extraction, OCR ingestion, lecture summaries. Automatically yields to students.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Telemetry */}
      {activeTab === "telemetry" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-900">Recent Live Invocations</h2>
            <p className="text-xs text-slate-500 mt-0.5">Real-time log of the last 50 gateway calls across the cluster.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Workload</th>
                  <th className="py-3 px-4">Model</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Latency</th>
                  <th className="py-3 px-4">Tokens</th>
                  <th className="py-3 px-4">Cost</th>
                  <th className="py-3 px-4 text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {telemetry.map((t, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 text-slate-500">{new Date(t.timestamp).toLocaleTimeString()}</td>
                    <td className="py-2.5 px-4 font-sans font-semibold text-slate-800">{t.workload}</td>
                    <td className="py-2.5 px-4 text-blue-600">{t.model}</td>
                    <td className="py-2.5 px-4 text-slate-600">{t.project}</td>
                    <td className="py-2.5 px-4 text-slate-700">{t.durationMs}ms</td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {t.inputTokens} in / {t.outputTokens} out
                    </td>
                    <td className="py-2.5 px-4 text-slate-800 font-semibold">₹{t.costInr.toFixed(4)}</td>
                    <td className="py-2.5 px-4 text-right">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.ok ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {t.ok ? "SUCCESS" : t.errorCode || "FAILED"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Google Cloud Billing & Quota Guide */}
      {activeTab === "guide" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Google Cloud Billing &amp; Quota Increase Checklist</h2>
            <p className="text-xs text-slate-500 mt-1">
              Follow these official steps in Google Cloud Console / Google AI Studio to unlock higher RPM &amp; TPM quotas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="border border-slate-200 rounded-xl p-5 space-y-3 bg-slate-50/50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <FiShield className="text-blue-600" /> 1. Link Payment Method in Google AI Studio
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Free-tier keys have an absolute daily cap (often 20 to 50 requests per day) and 15 RPM.
                To convert any project to Paid Tier (Pay-As-You-Go):
              </p>
              <ol className="list-decimal list-inside text-xs space-y-1.5 text-slate-700">
                <li>Go to <strong>https://aistudio.google.com/app/plan_information</strong></li>
                <li>Click <strong>Set up billing</strong> or <strong>Add payment method</strong>.</li>
                <li>Link an active Google Cloud Billing Account.</li>
                <li>Paid tier increases rate limits to <strong>1,000 to 2,000 RPM</strong> and eliminates daily caps.</li>
              </ol>
            </div>

            <div className="border border-slate-200 rounded-xl p-5 space-y-3 bg-slate-50/50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <FiAlertTriangle className="text-amber-600" /> 2. Resolving Zero-Quota Projects (`quota_limit_value: 0`)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                If an API key returns <code>quota_limit_value: 0</code> (e.g. project numbers 401168136295 and 239005724824):
              </p>
              <ol className="list-decimal list-inside text-xs space-y-1.5 text-slate-700">
                <li>Open <strong>Google Cloud Console &gt; IAM &amp; Admin &gt; Quotas</strong>.</li>
                <li>Filter by Service: <code>Generative Language API</code>.</li>
                <li>Select <code>Generate Content API requests per minute</code>.</li>
                <li>Check if the regional quota is set to 0. Click <strong>Edit Quotas</strong> and request 15 or 100 RPM.</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
