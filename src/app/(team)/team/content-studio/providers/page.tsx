"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, AlertTriangle, Plus, ShieldCheck, RefreshCw } from "lucide-react";

interface ProviderRow {
  id: string;
  provider: string;
  modality: string;
  modelId: string;
  displayName: string;
  envKeyRef: string;
  priority: number;
  isEnabled: boolean;
  isDefault: boolean;
  inputCostPer1M: number;
  outputCostPer1M: number;
  unitCostUsd: number;
  envConfigured: boolean;
  persisted?: boolean;
}

interface BudgetRow {
  id: string;
  scopeType: string;
  scopeId: string;
  dailyLimitUsd: number;
  monthlyLimitUsd: number;
  hardStop: boolean;
  isActive: boolean;
}

export default function ContentStudioProvidersPage() {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [usingDefaults, setUsingDefaults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Provider form
  const [provider, setProvider] = useState("GEMINI");
  const [modality, setModality] = useState("TEXT");
  const [taskType, setTaskType] = useState("GENERAL");
  const [modelId, setModelId] = useState("gemini-3-flash-preview");
  const [displayName, setDisplayName] = useState("Gemini 3 Flash Preview");
  const [envKeyRef, setEnvKeyRef] = useState("GEMINI_API_KEY");
  const [priority, setPriority] = useState(10);
  const [timeoutMs, setTimeoutMs] = useState(30000);
  const [isDefault, setIsDefault] = useState(true);

  // Budget form
  const [scopeType, setScopeType] = useState("GLOBAL");
  const [scopeId, setScopeId] = useState("GLOBAL");
  const [dailyLimitUsd, setDailyLimitUsd] = useState(25);
  const [monthlyLimitUsd, setMonthlyLimitUsd] = useState(500);
  const [hardStop, setHardStop] = useState(true);

  const loadAll = async () => {
    setLoading(true);
    setErr(null);
    try {
      const [pRes, bRes] = await Promise.all([
        fetch("/api/team/content-studio/providers"),
        fetch("/api/team/content-studio/budgets"),
      ]);
      const [pJson, bJson] = await Promise.all([pRes.json(), bRes.json()]);
      if (pJson.success) {
        setProviders(pJson.data.providers || []);
        setUsingDefaults(Boolean(pJson.data.usingDefaults));
      }
      if (bJson.success) {
        setBudgets(bJson.data.limits || []);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load provider config");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleSaveProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/team/content-studio/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          modality,
          taskType,
          modelId,
          displayName,
          envKeyRef,
          priority: Number(priority),
          timeoutMs: Number(timeoutMs),
          isEnabled: true,
          isDefault,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to save provider");
      setMsg(`Saved provider route ${provider} (${modelId})`);
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save provider");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/team/content-studio/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scopeType,
          scopeId,
          dailyLimitUsd: Number(dailyLimitUsd),
          monthlyLimitUsd: Number(monthlyLimitUsd),
          hardStop,
          isActive: true,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to save budget");
      setMsg(`Saved budget limit for ${scopeType}:${scopeId}`);
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save budget");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/team/content-studio"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Content Studio
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-on-surface">
            AI Provider Router & Cost Budgets
          </h1>
          <p className="text-sm text-on-surface-variant">
            Configure multi-provider routing, fallback priority, and spending limits. Raw API keys remain server-side only.
          </p>
        </div>

        <button
          onClick={loadAll}
          className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm font-medium text-on-surface hover:bg-surface-container"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {msg && (
        <div className="rounded-lg border border-tertiary/30 bg-tertiary-fixed px-4 py-2.5 text-sm text-on-tertiary-fixed">
          {msg}
        </div>
      )}
      {err && (
        <div className="rounded-lg border border-error/30 bg-error-container px-4 py-2.5 text-sm text-on-error-container">
          {err}
        </div>
      )}

      {usingDefaults && (
        <div className="rounded-lg border border-primary/20 bg-primary-fixed/40 px-4 py-3 text-xs text-on-primary-fixed">
          Showing built-in default provider routing. Save any provider below to persist custom DB overrides.
        </div>
      )}

      {/* Provider Table */}
      <div className="rounded-xl border border-outline-variant/60 bg-surface shadow-sm overflow-hidden">
        <div className="border-b border-outline-variant/50 px-5 py-3.5">
          <h2 className="text-base font-semibold text-on-surface">Configured Provider Routes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-container text-xs font-semibold uppercase text-on-surface-variant">
              <tr>
                <th className="px-4 py-3">Modality</th>
                <th className="px-4 py-3">Provider / Model</th>
                <th className="px-4 py-3">Env Key Ref</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Key Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {providers.map((p) => (
                <tr key={p.id} className="hover:bg-surface-container-low">
                  <td className="px-4 py-3 text-xs font-semibold text-primary">{p.modality}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-on-surface">
                      {p.displayName}{" "}
                      {p.isDefault && (
                        <span className="ml-1 rounded bg-primary-fixed px-1.5 py-0.5 text-[10px] font-semibold text-on-primary-fixed">
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-on-surface-variant">
                      {p.provider} · <code>{p.modelId}</code>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <code className="rounded bg-surface-container-high px-1.5 py-0.5">{p.envKeyRef}</code>
                  </td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">{p.priority}</td>
                  <td className="px-4 py-3">
                    {p.envConfigured ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-tertiary">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Configured
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-error">
                        <AlertTriangle className="h-3.5 w-3.5" /> Env Missing
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Update Provider + Budget Forms */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleSaveProvider}
          className="rounded-xl border border-outline-variant/60 bg-surface p-5 shadow-sm space-y-4"
        >
          <div className="flex items-center gap-2 text-base font-semibold text-on-surface">
            <Plus className="h-4 w-4 text-primary" />
            Add / Override Provider Route
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              >
                <option value="GEMINI">GEMINI</option>
                <option value="OPENAI">OPENAI</option>
                <option value="XAI_GROK">XAI_GROK</option>
                <option value="GROQ">GROQ</option>
                <option value="ANTHROPIC">ANTHROPIC</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Modality</label>
              <select
                value={modality}
                onChange={(e) => setModality(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              >
                <option value="TEXT">TEXT</option>
                <option value="IMAGE">IMAGE</option>
                <option value="VOICE">VOICE</option>
                <option value="MUSIC">MUSIC</option>
                <option value="VIDEO">VIDEO</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Task Type</label>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              >
                <option value="GENERAL">GENERAL</option>
                <option value="RESEARCH">RESEARCH</option>
                <option value="TOPIC_ANALYSIS">TOPIC_ANALYSIS</option>
                <option value="SCRIPT_WRITING">SCRIPT_WRITING</option>
                <option value="SEO">SEO</option>
                <option value="CHEMISTRY_VERIFICATION">CHEMISTRY_VERIFICATION</option>
                <option value="THUMBNAIL_PROMPT">THUMBNAIL_PROMPT</option>
                <option value="CONTENT_PLANNING">CONTENT_PLANNING</option>
                <option value="SUMMARIZATION">SUMMARIZATION</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Timeout (ms)</label>
              <input
                type="number"
                value={timeoutMs}
                onChange={(e) => setTimeoutMs(Number(e.target.value))}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Model ID</label>
              <input
                type="text"
                required
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Display Name</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Env Key Name</label>
              <input
                type="text"
                required
                value={envKeyRef}
                onChange={(e) => setEnvKeyRef(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Priority (lower = first)</label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-on-surface">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            Set as default for this modality
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary/90 disabled:opacity-50"
          >
            Save Provider Route
          </button>
        </form>

        <form
          onSubmit={handleSaveBudget}
          className="rounded-xl border border-outline-variant/60 bg-surface p-5 shadow-sm space-y-4"
        >
          <div className="flex items-center gap-2 text-base font-semibold text-on-surface">
            <ShieldCheck className="h-4 w-4 text-tertiary" />
            AI Budget Guardrails
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Scope Type</label>
              <select
                value={scopeType}
                onChange={(e) => setScopeType(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              >
                <option value="GLOBAL">GLOBAL</option>
                <option value="ROLE">ROLE</option>
                <option value="USER">USER</option>
                <option value="PROJECT">PROJECT</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Scope ID</label>
              <input
                type="text"
                required
                value={scopeId}
                onChange={(e) => setScopeId(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Daily Limit (USD)</label>
              <input
                type="number"
                step="0.5"
                value={dailyLimitUsd}
                onChange={(e) => setDailyLimitUsd(Number(e.target.value))}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Monthly Limit (USD)</label>
              <input
                type="number"
                step="1"
                value={monthlyLimitUsd}
                onChange={(e) => setMonthlyLimitUsd(Number(e.target.value))}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-on-surface">
            <input
              type="checkbox"
              checked={hardStop}
              onChange={(e) => setHardStop(e.target.checked)}
            />
            Enforce hard stop when limit is reached
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-tertiary px-4 py-2 text-sm font-semibold text-on-tertiary hover:bg-tertiary/90 disabled:opacity-50"
          >
            Save Budget Limit
          </button>

          {budgets.length > 0 && (
            <div className="pt-2 border-t border-outline-variant/40 space-y-1.5">
              <div className="text-xs font-semibold text-on-surface-variant">Active Limits</div>
              {budgets.map((b) => (
                <div key={b.id} className="flex items-center justify-between text-xs text-on-surface">
                  <span>
                    <strong>{b.scopeType}</strong>:{b.scopeId}
                  </span>
                  <span>
                    ${b.dailyLimitUsd}/day · ${b.monthlyLimitUsd}/mo {b.hardStop ? "(Hard Stop)" : "(Soft)"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
