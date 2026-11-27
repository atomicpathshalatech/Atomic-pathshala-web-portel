"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Sparkles,
  DollarSign,
  Sliders,
  FolderKanban,
  RefreshCw,
  GitCompare,
  AlertCircle,
  Clock,
  RotateCcw,
  XCircle,
  ArrowRight,
  Lightbulb,
  TrendingUp,
} from "lucide-react";

interface ProjectItem {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  status: string;
  topic?: string | null;
  subject?: string | null;
  platform?: string | null;
  language: string;
  updatedAt: string;
  owner: { id: string; name: string | null; email: string | null };
  manager?: { id: string; name: string | null; email: string | null } | null;
  _count: { scripts: number; assets: number; jobs: number };
}

interface AssetItem {
  id: string;
  title: string | null;
  assetType: string;
  publicUrl: string | null;
  createdAt: string;
  project?: { id: string; title: string } | null;
}

interface IdeaItem {
  id: string;
  title: string;
  topic: string;
  source: string;
  status: string;
}

interface JobItem {
  id: string;
  taskType: string;
  provider: string | null;
  model: string | null;
  status: string;
  progress: number;
  errorMessage: string | null;
  createdAt: string;
}

interface UsageLogItem {
  id: string;
  feature: string;
  provider: string;
  model: string;
  ok: boolean;
  costUsd: number | null;
  durationMs: number | null;
  createdAt: string;
}

interface ManagerOption {
  id: string;
  name: string | null;
  email: string | null;
}

const PROJECT_TYPES = [
  { value: "YOUTUBE_VIDEO", label: "YouTube Video" },
  { value: "YOUTUBE_SHORT", label: "YouTube Short" },
  { value: "INSTAGRAM_REEL", label: "Instagram Reel" },
  { value: "MOTIVATIONAL_VIDEO", label: "Motivational Video" },
  { value: "BATCH_LAUNCH", label: "Batch Launch" },
  { value: "LECTURE", label: "Lecture" },
  { value: "THUMBNAIL", label: "Thumbnail" },
  { value: "CINEMATIC_PROMO", label: "Cinematic Promotional Video" },
  { value: "SLIDE_DECK", label: "Educational Slide Presentation" },
];

export default function ContentStudioDashboardPage() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [ideas, setIdeas] = useState<IdeaItem[]>([]);
  const [activeJobs, setActiveJobs] = useState<JobItem[]>([]);
  const [failedJobs, setFailedJobs] = useState<JobItem[]>([]);
  const [generations, setGenerations] = useState<UsageLogItem[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [canViewCosts, setCanViewCosts] = useState(false);
  const [monthUsage, setMonthUsage] = useState<{ calls: number; costUsd: number | null; costInr: number | null }>({
    calls: 0,
    costUsd: null,
    costInr: null,
  });

  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create form fields
  const [title, setTitle] = useState("");
  const [type, setType] = useState("YOUTUBE_VIDEO");
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [platform, setPlatform] = useState("YOUTUBE");
  const [language, setLanguage] = useState("en");
  const [objective, setObjective] = useState("");
  const [managerId, setManagerId] = useState("");

  const loadOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/team/content-studio/overview");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load Content Studio");
      }
      const d = json.data;
      setProjects(d.recentProjects || []);
      setAssets(d.recentAssets || []);
      setIdeas(d.savedIdeas || []);
      setActiveJobs(d.activeJobs || []);
      setFailedJobs(d.failedJobs || []);
      setGenerations(d.recentGenerations || []);
      setManagers(d.managers || []);
      setCanViewCosts(Boolean(d.canViewCosts));
      setMonthUsage(d.monthUsage || { calls: 0, costUsd: null, costInr: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Content Studio");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/team/content-studio/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          type,
          topic: topic || undefined,
          subject: subject || undefined,
          chapter: chapter || undefined,
          targetAudience: targetAudience || undefined,
          platform,
          language,
          objective: objective || undefined,
          managerId: managerId || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to create project");
      setTitle("");
      setTopic("");
      setSubject("");
      setChapter("");
      setTargetAudience("");
      setObjective("");
      setShowCreate(false);
      await loadOverview();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  const handleJobAction = async (jobId: string, action: "retry" | "cancel") => {
    try {
      const res = await fetch(`/api/team/content-studio/jobs/${jobId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) await loadOverview();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-4 w-4" />
            Atomic AI Content Studio
          </div>
          <h1 className="mt-1 text-2xl font-bold text-on-surface">Studio Dashboard</h1>
          <p className="text-sm text-on-surface-variant">
            Manage content projects, AI generations, assets, and multi-provider workflows.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadOverview}
            className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm font-medium text-on-surface hover:bg-surface-container"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            href="/team/content-studio/research"
            className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm font-medium text-on-surface hover:bg-surface-container"
          >
            <TrendingUp className="h-4 w-4" />
            Research
          </Link>
          <Link
            href="/team/content-studio/analytics"
            className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm font-medium text-on-surface hover:bg-surface-container"
          >
            Analytics AI
          </Link>
          <Link
            href="/team/content-studio/assets"
            className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm font-medium text-on-surface hover:bg-surface-container"
          >
            Asset Library
          </Link>
          <Link
            href="/team/content-studio/compare"
            className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm font-medium text-on-surface hover:bg-surface-container"
          >
            <GitCompare className="h-4 w-4" />
            Compare AI
          </Link>
          <Link
            href="/team/content-studio/providers"
            className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm font-medium text-on-surface hover:bg-surface-container"
          >
            <Sliders className="h-4 w-4" />
            AI Router
          </Link>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Create New Project
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-error/30 bg-error-container px-4 py-3 text-sm text-on-error-container">
          {error}
        </div>
      )}

      {/* KPI Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-on-surface-variant">
            <span>Recent Projects</span>
            <FolderKanban className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold text-on-surface">{projects.length}</p>
          <p className="mt-1 text-xs text-on-surface-variant">{ideas.length} saved content ideas</p>
        </div>

        <div className="rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-on-surface-variant">
            <span>Active / Failed Jobs</span>
            <Clock className="h-4 w-4 text-secondary" />
          </div>
          <p className="mt-2 text-2xl font-bold text-on-surface">
            {activeJobs.length} <span className="text-sm font-normal text-error">/ {failedJobs.length} failed</span>
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">Async generation queue</p>
        </div>

        <div className="rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-on-surface-variant">
            <span>Recent Assets</span>
            <Sparkles className="h-4 w-4 text-tertiary" />
          </div>
          <p className="mt-2 text-2xl font-bold text-on-surface">{assets.length}</p>
          <Link href="/team/content-studio/assets" className="mt-1 inline-block text-xs text-primary hover:underline">
            Open Asset Library →
          </Link>
        </div>

        <div className="rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-on-surface-variant">
            <span>AI Usage (This Month)</span>
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold text-on-surface">{monthUsage.calls} calls</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {canViewCosts && monthUsage.costUsd !== null
              ? `Est. $${monthUsage.costUsd.toFixed(4)} (₹${(monthUsage.costInr ?? 0).toFixed(2)})`
              : "Cost visibility restricted"}
          </p>
        </div>
      </div>

      {/* Create New Project Form */}
      {showCreate && (
        <form
          onSubmit={handleCreateProject}
          className="rounded-xl border border-primary/30 bg-surface-container-low p-5 shadow-sm space-y-4"
        >
          <h2 className="text-base font-semibold text-on-surface">Create New Content Project</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Project Name *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Organic Chemistry Aldol Condensation One-Shot"
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Content Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              >
                {PROJECT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Topic</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Aldol Condensation"
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Chemistry / Physics / Bio"
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Chapter</label>
              <input
                type="text"
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
                placeholder="Aldehydes & Ketones"
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Target Audience</label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="JEE / NEET 2027"
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Platform</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              >
                <option value="YOUTUBE">YouTube</option>
                <option value="INSTAGRAM">Instagram</option>
                <option value="APP">Atomic Pathshala App</option>
                <option value="WEB">Website / Blog</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="hinglish">Hinglish</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Assigned Manager</label>
              <select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              >
                <option value="">Default / Unassigned</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Content Objective</label>
              <input
                type="text"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Leads / Conceptual clarity"
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-on-primary disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Project"}
            </button>
          </div>
        </form>
      )}

      {/* Main Grid: Recent Projects + Jobs/Generations */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-outline-variant/60 bg-surface shadow-sm overflow-hidden">
          <div className="border-b border-outline-variant/50 px-5 py-3.5 flex items-center justify-between">
            <h2 className="text-base font-semibold text-on-surface">Recent Content Projects</h2>
            <span className="text-xs text-on-surface-variant">Click a project to open Workspace</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-sm text-on-surface-variant">Loading projects...</div>
          ) : projects.length === 0 ? (
            <div className="p-8 text-center text-sm text-on-surface-variant">
              No projects yet. Create your first content project above.
            </div>
          ) : (
            <div className="divide-y divide-outline-variant/40">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/team/content-studio/projects/${p.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-surface-container-low transition"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-on-surface truncate">{p.title}</span>
                      <span className="rounded-full bg-primary-fixed px-2 py-0.5 text-[10px] font-semibold text-on-primary-fixed">
                        {p.status}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-on-surface-variant">
                      {p.type} · {p.platform || "YOUTUBE"} · {p.subject || p.topic || "General"} · Manager:{" "}
                      {p.manager?.name || p.owner?.name || "—"}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-on-surface-variant" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Jobs & Recent AI Generations */}
        <div className="space-y-6">
          <div className="rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-on-surface mb-3">Active & Failed Jobs</h2>
            {activeJobs.length === 0 && failedJobs.length === 0 ? (
              <p className="text-xs text-on-surface-variant">No active or failed generation jobs.</p>
            ) : (
              <div className="space-y-2.5">
                {[...activeJobs, ...failedJobs].slice(0, 6).map((j) => (
                  <div
                    key={j.id}
                    className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between font-medium">
                      <span>{j.taskType}</span>
                      <span className={j.status === "FAILED" ? "text-error" : "text-primary"}>
                        {j.status} ({j.progress}%)
                      </span>
                    </div>
                    {j.errorMessage && (
                      <div className="mt-1 flex items-center gap-1 text-error line-clamp-1">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        {j.errorMessage}
                      </div>
                    )}
                    <div className="mt-2 flex gap-2">
                      {j.status === "FAILED" && (
                        <button
                          onClick={() => handleJobAction(j.id, "retry")}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <RotateCcw className="h-3 w-3" /> Retry
                        </button>
                      )}
                      {(j.status === "QUEUED" || j.status === "PROCESSING") && (
                        <button
                          onClick={() => handleJobAction(j.id, "cancel")}
                          className="inline-flex items-center gap-1 text-error hover:underline"
                        >
                          <XCircle className="h-3 w-3" /> Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-on-surface mb-3">Recent AI Generations</h2>
            {generations.length === 0 ? (
              <p className="text-xs text-on-surface-variant">No AI generations logged yet.</p>
            ) : (
              <div className="space-y-2">
                {generations.slice(0, 5).map((g) => (
                  <div key={g.id} className="flex items-center justify-between text-xs">
                    <div className="min-w-0">
                      <div className="font-medium text-on-surface truncate">
                        {g.provider} · {g.model}
                      </div>
                      <div className="text-on-surface-variant truncate">{g.feature}</div>
                    </div>
                    <span className={g.ok ? "text-tertiary font-medium" : "text-error font-medium"}>
                      {g.ok ? (g.costUsd !== null ? `$${g.costUsd.toFixed(4)}` : "OK") : "ERR"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Saved Ideas & Recent Assets */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-on-surface mb-3">
            <Lightbulb className="h-4 w-4 text-primary" /> Saved Content Ideas
          </div>
          {ideas.length === 0 ? (
            <p className="text-xs text-on-surface-variant">No saved ideas yet (Phase 02 Research will populate this).</p>
          ) : (
            <div className="space-y-2">
              {ideas.map((i) => (
                <div key={i.id} className="flex items-center justify-between text-xs border-b border-outline-variant/30 pb-2">
                  <span className="font-medium text-on-surface">{i.title}</span>
                  <span className="text-on-surface-variant">{i.source}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-on-surface">Recent Assets</span>
            <Link href="/team/content-studio/assets" className="text-xs text-primary hover:underline">
              View All
            </Link>
          </div>
          {assets.length === 0 ? (
            <p className="text-xs text-on-surface-variant">No assets uploaded or generated yet.</p>
          ) : (
            <div className="space-y-2">
              {assets.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-center justify-between text-xs border-b border-outline-variant/30 pb-2">
                  <span className="font-medium text-on-surface truncate">{a.title || "Untitled"}</span>
                  <span className="rounded bg-surface-container-high px-1.5 py-0.5 text-[10px]">{a.assetType}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
