"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Trash2, Play, RefreshCw } from "lucide-react";
import { PlanTab } from "@/components/team-portal/content-studio/PlanTab";
import { ScriptStudioTab } from "@/components/team-portal/content-studio/ScriptStudioTab";
import { StoryboardTab } from "@/components/team-portal/content-studio/StoryboardTab";
import { VoiceStudioTab } from "@/components/team-portal/content-studio/VoiceStudioTab";
import { MusicStudioTab } from "@/components/team-portal/content-studio/MusicStudioTab";
import { ThumbnailStudioTab } from "@/components/team-portal/content-studio/ThumbnailStudioTab";
import { VideoStudioTab } from "@/components/team-portal/content-studio/VideoStudioTab";
import { VideoEditorTab } from "@/components/team-portal/content-studio/VideoEditorTab";
import { SeoStudioTab } from "@/components/team-portal/content-studio/SeoStudioTab";
import { SlideStudioTab } from "@/components/team-portal/content-studio/SlideStudioTab";

const TABS = [
  "Overview",
  "Plan",
  "Research",
  "Script",
  "Storyboard",
  "Voice",
  "Music",
  "Video",
  "Editor",
  "Thumbnail",
  "SEO",
  "Slides",
  "Assets",
  "History",
] as const;

const STATUSES = [
  "IDEA",
  "RESEARCHING",
  "PLANNED",
  "SCRIPT_READY",
  "PRODUCTION",
  "EDITING",
  "REVIEW",
  "APPROVED",
  "PUBLISHED",
  "ARCHIVED",
];

interface ProjectDetail {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  topic: string | null;
  subject: string | null;
  chapter: string | null;
  targetAudience: string | null;
  platform: string | null;
  objective: string | null;
  language: string;
  owner: { name: string | null; email: string | null };
  manager: { name: string | null; email: string | null } | null;
  assets: Array<{ id: string; title: string | null; assetType: string; publicUrl: string | null; createdAt: string }>;
  scripts: Array<{ id: string; isActive: boolean; bodyMarkdown?: string }>;
  jobs: Array<{ id: string; taskType: string; provider: string | null; model: string | null; status: string; progress: number; errorMessage: string | null; outputPayload: Record<string, unknown> | null; createdAt: string }>;
  histories: Array<{ id: string; entityType: string; changeSummary: string | null; createdAt: string }>;
}

export default function ProjectWorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Edit fields
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("IDEA");
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [objective, setObjective] = useState("");

  // Quick async AI job runner
  const [jobPrompt, setJobPrompt] = useState("");
  const [jobTaskType, setJobTaskType] = useState("RESEARCH");
  const [runningJob, setRunningJob] = useState(false);

  const loadProject = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/team/content-studio/projects/${params.id}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to load project");
      const p: ProjectDetail = json.data.project;
      setProject(p);
      setTitle(p.title);
      setStatus(p.status);
      setTopic(p.topic || "");
      setSubject(p.subject || "");
      setObjective(p.objective || "");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error loading project");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch(`/api/team/content-studio/projects/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, status, topic: topic || null, subject: subject || null, objective: objective || null }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Update failed");
      setMsg("Project updated");
      await loadProject();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this project permanently? This requires Content Studio Delete permission.")) return;
    setErr(null);
    try {
      const res = await fetch(`/api/team/content-studio/projects/${params.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Delete failed");
      router.push("/team/content-studio");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const handleEnqueueJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobPrompt.trim()) return;
    setRunningJob(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/team/content-studio/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: params.id,
          modality: "TEXT",
          taskType: jobTaskType,
          prompt: jobPrompt,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to enqueue job");
      setJobPrompt("");
      setMsg(`Job ${json.data.job.id} queued. Refresh in a moment to view output.`);
      await loadProject();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to enqueue job");
    } finally {
      setRunningJob(false);
    }
  };

  if (loading && !project) {
    return <div className="p-6 text-sm text-on-surface-variant">Loading project workspace...</div>;
  }
  if (!project) {
    return (
      <div className="p-6">
        <Link href="/team/content-studio" className="text-sm text-primary hover:underline">
          ← Back to Content Studio
        </Link>
        <p className="mt-4 text-sm text-error">{err || "Project not found"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/team/content-studio" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Studio Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-on-surface">{project.title}</h1>
          <p className="text-xs text-on-surface-variant">
            {project.type} · {project.platform || "YOUTUBE"} · Owner: {project.owner?.name || project.owner?.email}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadProject}
            className="inline-flex items-center gap-1 rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-xs font-medium"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1 rounded-lg border border-error/40 bg-error-container px-3 py-1.5 text-xs font-semibold text-on-error-container"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </div>

      {msg && <div className="rounded-lg bg-tertiary-fixed px-4 py-2 text-sm text-on-tertiary-fixed">{msg}</div>}
      {err && <div className="rounded-lg bg-error-container px-4 py-2 text-sm text-on-error-container">{err}</div>}

      {/* 12-Tab Workspace Bar */}
      <div className="flex flex-wrap gap-1.5 border-b border-outline-variant/60 pb-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === tab
                ? "bg-primary text-on-primary"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "Overview" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <form onSubmit={handleSave} className="rounded-xl border border-outline-variant/60 bg-surface p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-on-surface">Project Details & Workflow</h2>
            <div>
              <label className="block text-xs text-on-surface-variant mb-1">Project Name</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-on-surface-variant mb-1">Topic</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-on-surface-variant mb-1">Content Objective</label>
              <textarea
                rows={2}
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Changes"}
            </button>
          </form>

          <div className="space-y-4">
            <form onSubmit={handleEnqueueJob} className="rounded-xl border border-outline-variant/60 bg-surface p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-semibold text-on-surface">Run Async AI Generation Job</h2>
              <select
                value={jobTaskType}
                onChange={(e) => setJobTaskType(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              >
                <option value="RESEARCH">Research</option>
                <option value="TOPIC_ANALYSIS">Topic Analysis</option>
                <option value="CONTENT_PLANNING">Content Planning</option>
                <option value="SCRIPT_WRITING">Script Writing</option>
                <option value="SEO">SEO</option>
                <option value="THUMBNAIL_PROMPT">Thumbnail Prompt</option>
                <option value="SUMMARIZATION">Summarization</option>
              </select>
              <textarea
                rows={3}
                required
                value={jobPrompt}
                onChange={(e) => setJobPrompt(e.target.value)}
                placeholder="Enter prompt for this project..."
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={runningJob}
                className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-on-secondary disabled:opacity-50"
              >
                <Play className="h-4 w-4" /> {runningJob ? "Queueing..." : "Queue AI Job"}
              </button>
            </form>

            <div className="rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-on-surface mb-2">Project Jobs ({project.jobs.length})</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {project.jobs.map((j) => (
                  <div key={j.id} className="rounded-lg bg-surface-container-low p-2.5 text-xs">
                    <div className="flex justify-between font-semibold">
                      <span>{j.taskType} ({j.provider || "auto"})</span>
                      <span>{j.status} · {j.progress}%</span>
                    </div>
                    {j.outputPayload && typeof j.outputPayload.text === "string" && (
                      <p className="mt-1 text-on-surface-variant whitespace-pre-wrap line-clamp-4">
                        {j.outputPayload.text}
                      </p>
                    )}
                    {j.errorMessage && <p className="mt-1 text-error">{j.errorMessage}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "Assets" && (
        <div className="rounded-xl border border-outline-variant/60 bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-on-surface">Project Assets ({project.assets.length})</h2>
            <Link href="/team/content-studio/assets" className="text-xs font-medium text-primary hover:underline">
              Open Full Asset Library →
            </Link>
          </div>
          {project.assets.length === 0 ? (
            <p className="text-xs text-on-surface-variant">No assets linked to this project yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {project.assets.map((a) => (
                <div key={a.id} className="rounded-lg border border-outline-variant/50 p-3 text-xs">
                  <div className="font-semibold text-on-surface truncate">{a.title || "Untitled"}</div>
                  <div className="text-on-surface-variant mt-0.5">{a.assetType}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "History" && (
        <div className="rounded-xl border border-outline-variant/60 bg-surface p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-on-surface mb-3">Version & Activity History</h2>
          <div className="space-y-2">
            {project.histories.map((h) => (
              <div key={h.id} className="flex items-center justify-between border-b border-outline-variant/40 pb-2 text-xs">
                <div>
                  <span className="font-semibold text-primary mr-2">{h.entityType}</span>
                  <span className="text-on-surface">{h.changeSummary || "Updated"}</span>
                </div>
                <span className="text-on-surface-variant">{new Date(h.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "Plan" && (
        <PlanTab
          projectId={project.id}
          defaultTopic={project.topic || project.title}
          defaultSubject={project.subject}
          defaultChapter={project.chapter}
        />
      )}

      {activeTab === "Script" && (
        <ScriptStudioTab
          projectId={project.id}
          defaultTopic={project.topic || project.title}
        />
      )}

      {activeTab === "Storyboard" && (
        <StoryboardTab
          projectId={project.id}
          activeScriptId={project.scripts?.find((s) => s.isActive)?.id || project.scripts?.[0]?.id}
        />
      )}

      {activeTab === "Voice" && (
        <VoiceStudioTab
          projectId={project.id}
          activeScriptId={project.scripts?.find((s) => s.isActive)?.id || project.scripts?.[0]?.id}
          activeScriptText={project.scripts?.find((s) => s.isActive)?.bodyMarkdown || project.scripts?.[0]?.bodyMarkdown}
        />
      )}

      {activeTab === "Music" && <MusicStudioTab projectId={project.id} />}

      {activeTab === "Thumbnail" && (
        <ThumbnailStudioTab
          projectId={project.id}
          defaultTopic={project.topic || project.title}
          defaultSubject={project.subject}
        />
      )}

      {activeTab === "SEO" && (
        <SeoStudioTab
          projectId={project.id}
          defaultTopic={project.topic || project.title}
          defaultSubject={project.subject}
          defaultChapter={project.chapter}
          activeScriptText={project.scripts?.find((s) => s.isActive)?.bodyMarkdown || project.scripts?.[0]?.bodyMarkdown}
        />
      )}

      {activeTab === "Video" && <VideoStudioTab projectId={project.id} />}

      {activeTab === "Editor" && (
        <VideoEditorTab
          projectId={project.id}
          activeScriptText={project.scripts?.find((s) => s.isActive)?.bodyMarkdown || project.scripts?.[0]?.bodyMarkdown}
        />
      )}

      {activeTab === "Slides" && (
        <SlideStudioTab
          projectId={project.id}
          projectTitle={project.title}
          projectTopic={project.topic}
          projectSubject={project.subject}
          projectChapter={project.chapter}
          projectLanguage={project.language}
        />
      )}

      {activeTab !== "Overview" &&
        activeTab !== "Plan" &&
        activeTab !== "Script" &&
        activeTab !== "Storyboard" &&
        activeTab !== "Voice" &&
        activeTab !== "Music" &&
        activeTab !== "Thumbnail" &&
        activeTab !== "SEO" &&
        activeTab !== "Video" &&
        activeTab !== "Editor" &&
        activeTab !== "Slides" &&
        activeTab !== "Assets" &&
        activeTab !== "History" && (
        <div className="rounded-xl border border-outline-variant/60 bg-surface p-8 text-center">
          <h2 className="text-base font-semibold text-on-surface">{activeTab} Workspace Module</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            This workspace tab is wired to the Content Project and ready for its dedicated studio module in upcoming phases.
          </p>
        </div>
      )}
    </div>
  );
}
