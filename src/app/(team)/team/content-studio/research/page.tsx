"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  TrendingUp,
  Users,
  Clock,
  Sparkles,
  ExternalLink,
  Plus,
  RefreshCw,
  Bookmark,
  FolderPlus,
  FileText,
  Zap,
  X,
} from "lucide-react";

interface SourceItem {
  title: string;
  url: string;
  publishedAt: string;
  sourceType: string;
  channelName?: string | null;
  views?: number | null;
}

interface OpportunityRow {
  id: string;
  topic: string;
  category: string;
  opportunityType: string;
  recommendedFormat: string;
  opportunityScore: number;
  scoreBreakdown: Record<string, number>;
  whyThisTopic: string;
  researchSummary: string;
  suggestedAngle: string | null;
  suggestedTitles: string[] | null;
  audienceFit: string | null;
  publishingTiming: string | null;
  sources: SourceItem[];
  competitorRefs: SourceItem[] | null;
  status: string;
  projectId: string | null;
  researchedAt: string;
}

interface CompetitorChannelRow {
  id: string;
  name: string;
  channelId: string;
  channelUrl: string;
  group: string;
  category: string;
  language: string;
  isActive: boolean;
  lastScannedAt: string | null;
  _count: { videos: number };
}

interface CompetitorVideoRow {
  id: string;
  title: string;
  url: string;
  publishedAt: string;
  views: number | null;
  viewVelocity: number | null;
  engagementRate: number | null;
  format: string;
  titlePattern: string | null;
  competitorChannel: { name: string; group: string };
}

const CATEGORIES = ["NEET", "JEE", "BOARDS", "MOTIVATIONAL", "EDUCATIONAL_NEWS"] as const;
const GROUPS = [
  "NEET_CHEMISTRY",
  "NEET_BIOLOGY",
  "NEET_PHYSICS",
  "HINDI_MEDIUM",
  "ENGLISH_MEDIUM",
  "MOTIVATION",
  "GENERAL_EDTECH",
] as const;

export default function ContentStudioResearchPage() {
  const [tab, setTab] = useState<"opportunities" | "competitors" | "automation">("opportunities");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("NEET");
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [latestResearchedAt, setLatestResearchedAt] = useState<string | null>(null);
  const [selectedOpp, setSelectedOpp] = useState<OpportunityRow | null>(null);

  const [channels, setChannels] = useState<CompetitorChannelRow[]>([]);
  const [videos, setVideos] = useState<CompetitorVideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningResearch, setRunningResearch] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Add competitor form
  const [chName, setChName] = useState("");
  const [chUrl, setChUrl] = useState("");
  const [chGroup, setChGroup] = useState<(typeof GROUPS)[number]>("NEET_CHEMISTRY");
  const [chCategory, setChCategory] = useState<(typeof CATEGORIES)[number]>("NEET");
  const [chLang, setChLang] = useState("hi");

  // Automation form
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoFreq, setAutoFreq] = useState("DAILY");
  const [autoCron, setAutoCron] = useState("0 6 * * *");
  const [autoLastRun, setAutoLastRun] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setErr(null);
    try {
      const [oppRes, compRes, autoRes] = await Promise.all([
        fetch(`/api/team/content-studio/research?category=${category}`),
        fetch("/api/team/content-studio/competitors"),
        fetch("/api/team/content-studio/research/automation"),
      ]);
      const [oppJson, compJson, autoJson] = await Promise.all([
        oppRes.json(),
        compRes.json(),
        autoRes.json(),
      ]);
      if (oppJson.success) {
        setOpportunities(oppJson.data.opportunities || []);
        setLatestResearchedAt(oppJson.data.latestResearchedAt || null);
      }
      if (compJson.success) {
        setChannels(compJson.data.channels || []);
        setVideos(compJson.data.recentVideos || []);
      }
      if (autoJson.success && autoJson.data.config) {
        const cfg = autoJson.data.config;
        setAutoEnabled(Boolean(cfg.isEnabled));
        setAutoFreq(cfg.frequency || "DAILY");
        setAutoCron(cfg.scheduleCron || "0 6 * * *");
        setAutoLastRun(cfg.lastRunAt || null);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load research data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const handleRunResearch = async () => {
    setRunningResearch(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/team/content-studio/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, language: chLang }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Research failed");
      setMsg(
        json.data.opportunities?.length > 0
          ? `Found ${json.data.opportunities.length} opportunities from ${json.data.sourceCount} real sources.`
          : json.data.message || "No new opportunities found."
      );
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Research failed");
    } finally {
      setRunningResearch(false);
    }
  };

  const handleTopicAction = async (oppId: string, action: string) => {
    setActionBusy(`${oppId}:${action}`);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch(`/api/team/content-studio/opportunities/${oppId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Action failed");
      setMsg(`Action ${action} completed.`);
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActionBusy(null);
    }
  };

  const handleAddCompetitor = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/team/content-studio/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: chName,
          channelUrl: chUrl,
          group: chGroup,
          category: chCategory,
          language: chLang,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to add channel");
      setChName("");
      setChUrl("");
      setMsg(`Added competitor channel: ${json.data.channel.name}`);
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to add channel");
    }
  };

  const handleScanCompetitors = async (channelId?: string) => {
    setScanning(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/team/content-studio/competitors/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(channelId ? { channelId } : {}),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Scan failed");
      setMsg(`Scanned ${json.data.results?.length || 0} channel(s).`);
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const handleSaveAutomation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/team/content-studio/research/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isEnabled: autoEnabled,
          frequency: autoFreq,
          scheduleCron: autoCron,
          categories: [...CATEGORIES],
          languages: ["hi", "en"],
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to save automation");
      setMsg("Research automation settings saved.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save automation");
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/team/content-studio" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Content Studio
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-on-surface">
            Trend Research & Competitor Intelligence
          </h1>
          <p className="text-sm text-on-surface-variant">
            Source-backed topic opportunities from YouTube feeds, official education news & competitor velocity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm font-medium"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button
            onClick={handleRunResearch}
            disabled={runningResearch}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" /> {runningResearch ? "Researching..." : `Scan ${category} Sources`}
          </button>
        </div>
      </div>

      {msg && <div className="rounded-lg bg-tertiary-fixed px-4 py-2.5 text-sm text-on-tertiary-fixed">{msg}</div>}
      {err && <div className="rounded-lg bg-error-container px-4 py-2.5 text-sm text-on-error-container">{err}</div>}

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/60 pb-2">
        <div className="flex gap-2">
          <button
            onClick={() => setTab("opportunities")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
              tab === "opportunities" ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" /> Today&apos;s Top Opportunities
          </button>
          <button
            onClick={() => setTab("competitors")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
              tab === "competitors" ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"
            }`}
          >
            <Users className="h-3.5 w-3.5" /> Competitor Channels ({channels.length})
          </button>
          <button
            onClick={() => setTab("automation")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
              tab === "automation" ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"
            }`}
          >
            <Clock className="h-3.5 w-3.5" /> Daily Automation
          </button>
        </div>

        {latestResearchedAt && (
          <span className="text-xs text-on-surface-variant">
            Latest scan: {new Date(latestResearchedAt).toLocaleString()}
          </span>
        )}
      </div>

      {/* TAB 1: OPPORTUNITIES */}
      {tab === "opportunities" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    category === c
                      ? "bg-secondary text-on-secondary"
                      : "bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  {c.replace("_", " ")}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-on-surface-variant">
              Opportunity Score is an explainable Studio heuristic (not an official YouTube score).
            </span>
          </div>

          {opportunities.length === 0 ? (
            <div className="rounded-xl border border-outline-variant/60 bg-surface p-8 text-center text-sm text-on-surface-variant">
              No opportunities scanned for <strong>{category}</strong> yet. Click &ldquo;Scan {category} Sources&rdquo; above to fetch real sources.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {opportunities.map((opp) => (
                <div key={opp.id} className="rounded-xl border border-outline-variant/60 bg-surface p-5 shadow-sm flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        <span className="rounded bg-primary-fixed px-2 py-0.5 text-[10px] font-semibold text-on-primary-fixed">
                          {opp.opportunityType.replace("_", " ")}
                        </span>
                        <span className="rounded bg-surface-container-high px-2 py-0.5 text-[10px] font-semibold text-on-surface">
                          {opp.recommendedFormat.replace("_", " ")}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-bold text-primary">{opp.opportunityScore}/100</div>
                        <div className="text-[10px] text-on-surface-variant">
                          {new Date(opp.researchedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <h3 className="mt-2 text-base font-bold text-on-surface">{opp.topic}</h3>
                    <p className="mt-1 text-xs text-on-surface-variant">{opp.whyThisTopic}</p>

                    {opp.suggestedAngle && (
                      <p className="mt-2 rounded-lg bg-surface-container-low p-2 text-xs text-on-surface">
                        <strong>Angle:</strong> {opp.suggestedAngle}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                      {(opp.sources || []).slice(0, 2).map((s, i) => (
                        <a
                          key={i}
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {s.sourceType} ({new Date(s.publishedAt).toLocaleDateString()})
                        </a>
                      ))}
                      <button onClick={() => setSelectedOpp(opp)} className="text-secondary font-semibold hover:underline">
                        Score Breakdown & Details →
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 border-t border-outline-variant/40 pt-3 text-xs">
                    <button
                      onClick={() => handleTopicAction(opp.id, "SAVE_IDEA")}
                      disabled={Boolean(actionBusy)}
                      className="inline-flex items-center gap-1 rounded-lg border border-outline-variant px-2.5 py-1 hover:bg-surface-container"
                    >
                      <Bookmark className="h-3 w-3" /> Save Idea
                    </button>
                    <button
                      onClick={() => handleTopicAction(opp.id, "CREATE_PROJECT")}
                      disabled={Boolean(actionBusy)}
                      className="inline-flex items-center gap-1 rounded-lg border border-outline-variant px-2.5 py-1 hover:bg-surface-container"
                    >
                      <FolderPlus className="h-3 w-3" /> Create Project
                    </button>
                    <button
                      onClick={() => handleTopicAction(opp.id, "GENERATE_SCRIPT")}
                      disabled={Boolean(actionBusy)}
                      className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 font-semibold text-on-primary"
                    >
                      <FileText className="h-3 w-3" /> Generate Script
                    </button>
                    <button
                      onClick={() => handleTopicAction(opp.id, "GENERATE_SHORTS")}
                      disabled={Boolean(actionBusy)}
                      className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1 font-semibold text-on-secondary"
                    >
                      <Zap className="h-3 w-3" /> Shorts Script
                    </button>
                    {opp.projectId && (
                      <Link href={`/team/content-studio/projects/${opp.projectId}`} className="ml-auto text-primary font-semibold hover:underline self-center">
                        Open Project →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: COMPETITORS */}
      {tab === "competitors" && (
        <div className="space-y-6">
          <form onSubmit={handleAddCompetitor} className="rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-on-surface flex items-center gap-1.5">
                <Plus className="h-4 w-4 text-primary" /> Add Competitor YouTube Channel
              </h2>
              <button
                type="button"
                onClick={() => handleScanCompetitors()}
                disabled={scanning}
                className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-on-secondary disabled:opacity-50"
              >
                {scanning ? "Scanning..." : "Scan All Active Channels"}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
              <input
                type="text"
                required
                value={chName}
                onChange={(e) => setChName(e.target.value)}
                placeholder="Channel Name"
                className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm"
              />
              <input
                type="text"
                required
                value={chUrl}
                onChange={(e) => setChUrl(e.target.value)}
                placeholder="YouTube URL or UC... ID"
                className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm sm:col-span-2"
              />
              <select
                value={chGroup}
                onChange={(e) => setChGroup(e.target.value as (typeof GROUPS)[number])}
                className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm"
              >
                {GROUPS.map((g) => (
                  <option key={g} value={g}>{g.replace("_", " ")}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <select
                  value={chCategory}
                  onChange={(e) => setChCategory(e.target.value as (typeof CATEGORIES)[number])}
                  className="flex-1 rounded-lg border border-outline-variant bg-surface px-2 py-1.5 text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <button type="submit" className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-on-primary">
                  Add
                </button>
              </div>
            </div>
          </form>

          <div className="rounded-xl border border-outline-variant/60 bg-surface shadow-sm overflow-hidden">
            <div className="border-b border-outline-variant/50 px-4 py-3 text-sm font-semibold">
              Tracked Channels ({channels.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container uppercase text-on-surface-variant">
                  <tr>
                    <th className="px-4 py-2.5">Channel</th>
                    <th className="px-4 py-2.5">Group</th>
                    <th className="px-4 py-2.5">Category</th>
                    <th className="px-4 py-2.5">Videos</th>
                    <th className="px-4 py-2.5">Last Scanned</th>
                    <th className="px-4 py-2.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {channels.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-2.5 font-medium">
                        <a href={c.channelUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          {c.name}
                        </a>
                      </td>
                      <td className="px-4 py-2.5">{c.group}</td>
                      <td className="px-4 py-2.5">{c.category}</td>
                      <td className="px-4 py-2.5">{c._count.videos}</td>
                      <td className="px-4 py-2.5">
                        {c.lastScannedAt ? new Date(c.lastScannedAt).toLocaleString() : "Never"}
                      </td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => handleScanCompetitors(c.id)} className="text-primary font-semibold hover:underline">
                          Scan
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-outline-variant/60 bg-surface shadow-sm overflow-hidden">
            <div className="border-b border-outline-variant/50 px-4 py-3 text-sm font-semibold">
              Recent Competitor Videos ({videos.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container uppercase text-on-surface-variant">
                  <tr>
                    <th className="px-4 py-2.5">Video</th>
                    <th className="px-4 py-2.5">Channel</th>
                    <th className="px-4 py-2.5">Format</th>
                    <th className="px-4 py-2.5">Views</th>
                    <th className="px-4 py-2.5">Velocity (/hr)</th>
                    <th className="px-4 py-2.5">Published</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {videos.map((v) => (
                    <tr key={v.id}>
                      <td className="px-4 py-2.5 font-medium max-w-xs truncate">
                        <a href={v.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          {v.title}
                        </a>
                      </td>
                      <td className="px-4 py-2.5">{v.competitorChannel.name}</td>
                      <td className="px-4 py-2.5">{v.format}</td>
                      <td className="px-4 py-2.5">{v.views !== null ? v.views.toLocaleString() : "—"}</td>
                      <td className="px-4 py-2.5">{v.viewVelocity !== null ? `${v.viewVelocity}/hr` : "—"}</td>
                      <td className="px-4 py-2.5">{new Date(v.publishedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AUTOMATION */}
      {tab === "automation" && (
        <form onSubmit={handleSaveAutomation} className="max-w-xl rounded-xl border border-outline-variant/60 bg-surface p-5 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-on-surface">Daily / Weekly Research Automation</h2>
          <p className="text-xs text-on-surface-variant">
            Triggered via <code>/api/cron/content-studio/research</code> (CRON_SECRET protected).
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoEnabled} onChange={(e) => setAutoEnabled(e.target.checked)} />
            Enable Automated Competitor & Topic Scans
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-on-surface-variant mb-1">Frequency</label>
              <select value={autoFreq} onChange={(e) => setAutoFreq(e.target.value)} className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm">
                <option value="DAILY">DAILY</option>
                <option value="WEEKLY">WEEKLY</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-on-surface-variant mb-1">Cron Schedule</label>
              <input type="text" value={autoCron} onChange={(e) => setAutoCron(e.target.value)} className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
            </div>
          </div>
          {autoLastRun && (
            <div className="text-xs text-on-surface-variant">Last automated run: {new Date(autoLastRun).toLocaleString()}</div>
          )}
          <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary">
            Save Automation Settings
          </button>
        </form>
      )}

      {/* TOPIC DETAIL MODAL */}
      {selectedOpp && (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl bg-surface p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-xs font-semibold text-primary">{selectedOpp.category} · {selectedOpp.opportunityType}</span>
                <h2 className="text-lg font-bold text-on-surface">{selectedOpp.topic}</h2>
              </div>
              <button onClick={() => setSelectedOpp(null)}><X className="h-5 w-5" /></button>
            </div>

            <p className="text-sm text-on-surface">{selectedOpp.researchSummary}</p>

            <div className="rounded-lg bg-surface-container p-3 space-y-2">
              <div className="text-xs font-semibold text-on-surface">
                Explainable Score Breakdown ({selectedOpp.opportunityScore}/100)
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(selectedOpp.scoreBreakdown || {}).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-on-surface-variant capitalize">{k.replace(/([A-Z])/g, " $1")}</span>
                    <span className="font-semibold text-on-surface">{v}/10</span>
                  </div>
                ))}
              </div>
            </div>

            {selectedOpp.suggestedTitles && selectedOpp.suggestedTitles.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-on-surface mb-1">Suggested Title Ideas</div>
                <ul className="list-disc pl-5 text-xs text-on-surface-variant space-y-1">
                  {selectedOpp.suggestedTitles.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div className="text-xs font-semibold text-on-surface mb-1">Verified Sources & Timestamps</div>
              <div className="space-y-1.5">
                {(selectedOpp.sources || []).map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-xs border-b border-outline-variant/30 pb-1">
                    <a href={s.url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate max-w-md">
                      {s.title}
                    </a>
                    <span className="text-on-surface-variant shrink-0 ml-2">
                      {new Date(s.publishedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
