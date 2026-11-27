"use client";

import React, { useEffect, useState } from "react";
import {
  Film,
  Sparkles,
  RefreshCw,
  XCircle,
  Download,
  ArrowUp,
  ArrowDown,
  DollarSign,
} from "lucide-react";
import {
  CAMERA_MOVEMENTS,
  LIGHTING_STYLES,
  VideoProviderCapabilities,
} from "@/lib/ai-studio/video/capabilities";

interface ProviderWithStatus extends VideoProviderCapabilities {
  configured: boolean;
}

interface SceneRow {
  id: string;
  orderIndex: number;
  title: string;
  durationSec: number;
  visualPrompt: string | null;
  cameraDirection: string | null;
  videoAssetId: string | null;
}

interface VideoGenRow {
  id: string;
  sceneId: string | null;
  mode: string;
  prompt: string;
  aspectRatio: string;
  durationSec: number;
  provider: string;
  model: string;
  status: string;
  progress: number;
  costUsd: number | null;
  videoUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
}

interface RefImageRow {
  id: string;
  title: string | null;
  publicUrl: string | null;
}

export function VideoStudioTab({ projectId }: { projectId: string }) {
  const [providers, setProviders] = useState<ProviderWithStatus[]>([]);
  const [scenes, setScenes] = useState<SceneRow[]>([]);
  const [generations, setGenerations] = useState<VideoGenRow[]>([]);
  const [refImages, setRefImages] = useState<RefImageRow[]>([]);

  const [provider, setProvider] = useState("RUNWAY");
  const [model, setModel] = useState("gen4_turbo");
  const [mode, setMode] = useState<"TEXT_TO_VIDEO" | "IMAGE_TO_VIDEO" | "REFERENCE_BASED" | "EXTEND">("TEXT_TO_VIDEO");
  const [selectedSceneId, setSelectedSceneId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [durationSec, setDurationSec] = useState(5);
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [cameraMovement, setCameraMovement] = useState("Static");
  const [lighting, setLighting] = useState("Cinematic Warm");
  const [environment, setEnvironment] = useState("");
  const [mood, setMood] = useState("");

  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadData = async () => {
    const res = await fetch(`/api/team/content-studio/projects/${projectId}/video`);
    const json = await res.json();
    if (json.success) {
      setProviders(json.data.providers || []);
      setScenes(json.data.scenes || []);
      setGenerations(json.data.generations || []);
      setRefImages(json.data.referenceImages || []);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const activeCap = providers.find((p) => p.provider === provider);
  const activeModelMeta = activeCap?.models.find((m) => m.id === model) || activeCap?.models[0];
  const estimatedCostUsd =
    activeModelMeta?.costPerSecUsd !== null && activeModelMeta?.costPerSecUsd !== undefined
      ? (activeModelMeta.costPerSecUsd * durationSec).toFixed(3)
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setBusy("submit");
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/team/content-studio/projects/${projectId}/video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId: selectedSceneId || undefined,
          provider,
          model,
          mode,
          prompt,
          aspectRatio,
          durationSec: Number(durationSec),
          referenceImageUrl: referenceImageUrl || undefined,
          cameraMovement: activeCap?.supportsCameraControls ? cameraMovement : undefined,
          lighting: activeCap?.supportsLightingControls ? lighting : undefined,
          environment: environment || undefined,
          mood: mood || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Video job submission failed");
      setMsg("Video generation job queued asynchronously. Poll status below.");
      await loadData();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Video job submission failed");
    } finally {
      setBusy(null);
    }
  };

  const handlePatch = async (action: "POLL" | "CANCEL" | "REORDER_SCENES", payload: Record<string, unknown>) => {
    setBusy(action);
    setErr(null);
    try {
      const res = await fetch(`/api/team/content-studio/projects/${projectId}/video`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      if (res.ok) await loadData();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      {msg && <div className="rounded-lg bg-tertiary-fixed px-4 py-2 text-sm text-on-tertiary-fixed">{msg}</div>}
      {err && <div className="rounded-lg bg-error-container px-4 py-2 text-sm text-on-error-container">{err}</div>}

      {/* Pre-generation Form */}
      <form onSubmit={handleSubmit} className="rounded-xl border border-outline-variant/60 bg-surface p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-on-surface flex items-center gap-2">
            <Film className="h-4 w-4 text-primary" /> Cinematic AI Video Studio
          </h2>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-3 py-1 text-xs font-medium">
            <DollarSign className="h-3.5 w-3.5 text-primary" />
            {estimatedCostUsd !== null ? `Est. $${estimatedCostUsd} (${durationSec}s)` : "Provider billing applies"}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
          <select
            value={provider}
            onChange={(e) => {
              const p = providers.find((pr) => pr.provider === e.target.value);
              setProvider(e.target.value);
              if (p?.models[0]) setModel(p.models[0].id);
              if (p?.durations[0]) setDurationSec(p.durations[0]);
            }}
            className="rounded-lg border border-outline-variant bg-surface px-2 py-2 text-xs"
          >
            {providers.map((p) => (
              <option key={p.provider} value={p.provider}>
                {p.label} {p.configured ? "✓" : "(Env Missing)"}
              </option>
            ))}
          </select>

          <select value={model} onChange={(e) => setModel(e.target.value)} className="rounded-lg border border-outline-variant bg-surface px-2 py-2 text-xs">
            {(activeCap?.models || []).map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>

          <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="rounded-lg border border-outline-variant bg-surface px-2 py-2 text-xs">
            <option value="TEXT_TO_VIDEO">Text to Video</option>
            {activeCap?.supportsImageToVideo && <option value="IMAGE_TO_VIDEO">Image to Video</option>}
            {activeCap?.supportsReferenceConsistency && <option value="REFERENCE_BASED">Reference Consistency</option>}
            {activeCap?.supportsExtend && <option value="EXTEND">Extend Clip</option>}
          </select>

          <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="rounded-lg border border-outline-variant bg-surface px-2 py-2 text-xs">
            {(activeCap?.aspectRatios || ["16:9", "9:16"]).map((ar) => (
              <option key={ar} value={ar}>{ar}</option>
            ))}
          </select>

          <select value={durationSec} onChange={(e) => setDurationSec(Number(e.target.value))} className="rounded-lg border border-outline-variant bg-surface px-2 py-2 text-xs">
            {(activeCap?.durations || [5]).map((d) => (
              <option key={d} value={d}>{d} seconds</option>
            ))}
          </select>
        </div>

        {/* Capability-gated Cinematic Controls */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          {activeCap?.supportsCameraControls && (
            <select value={cameraMovement} onChange={(e) => setCameraMovement(e.target.value)} className="rounded-lg border border-outline-variant bg-surface px-2 py-2 text-xs">
              {CAMERA_MOVEMENTS.map((c) => (
                <option key={c} value={c}>Camera: {c}</option>
              ))}
            </select>
          )}
          {activeCap?.supportsLightingControls && (
            <select value={lighting} onChange={(e) => setLighting(e.target.value)} className="rounded-lg border border-outline-variant bg-surface px-2 py-2 text-xs">
              {LIGHTING_STYLES.map((l) => (
                <option key={l} value={l}>Lighting: {l}</option>
              ))}
            </select>
          )}
          <input type="text" value={environment} onChange={(e) => setEnvironment(e.target.value)} placeholder="Environment (e.g. Modern Chemistry Lab)" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-xs" />
          <input type="text" value={mood} onChange={(e) => setMood(e.target.value)} placeholder="Mood (e.g. Inspiring, Epic)" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-xs" />
        </div>

        {activeCap?.supportsImageToVideo && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <select
              value={referenceImageUrl}
              onChange={(e) => setReferenceImageUrl(e.target.value)}
              className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-xs"
            >
              <option value="">Reference Image from Project Assets (Optional)</option>
              {refImages.map((img) => (
                <option key={img.id} value={img.publicUrl || ""}>{img.title || img.id}</option>
              ))}
            </select>
            <input
              type="text"
              value={referenceImageUrl}
              onChange={(e) => setReferenceImageUrl(e.target.value)}
              placeholder="Or paste Reference Image URL..."
              className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-xs"
            />
          </div>
        )}

        <textarea
          rows={3}
          required
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the cinematic scene in detail..."
          className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm"
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-on-surface-variant">
            Note: Visual/character consistency across scenes depends on provider model support and reference frames.
          </span>
          <button type="submit" disabled={Boolean(busy)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50">
            <Sparkles className="h-4 w-4" /> {busy === "submit" ? "Submitting Job..." : "Generate Scene Video"}
          </button>
        </div>
      </form>

      {/* Storyboard Scene Sequence */}
      {scenes.length > 0 && (
        <div className="rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm space-y-2">
          <div className="text-sm font-semibold text-on-surface">Storyboard Scene Sequence (Load Prompt to Generate)</div>
          <div className="space-y-2">
            {scenes.map((sc, idx) => (
              <div key={sc.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface-container-low p-2.5 text-xs">
                <div className="min-w-0">
                  <span className="font-bold text-primary mr-2">Scene {sc.orderIndex}: {sc.title}</span>
                  <span className="text-on-surface-variant">({sc.durationSec}s)</span>
                  <p className="text-on-surface-variant truncate">{sc.visualPrompt}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {idx > 0 && (
                    <button
                      onClick={() => {
                        const ids = scenes.map((s) => s.id);
                        const a = ids[idx];
                        const b = ids[idx - 1];
                        if (a && b) {
                          ids[idx] = b;
                          ids[idx - 1] = a;
                          handlePatch("REORDER_SCENES", { orderedSceneIds: ids });
                        }
                      }}
                      className="p-1 rounded hover:bg-surface"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {idx < scenes.length - 1 && (
                    <button
                      onClick={() => {
                        const ids = scenes.map((s) => s.id);
                        const a = ids[idx];
                        const b = ids[idx + 1];
                        if (a && b) {
                          ids[idx] = b;
                          ids[idx + 1] = a;
                          handlePatch("REORDER_SCENES", { orderedSceneIds: ids });
                        }
                      }}
                      className="p-1 rounded hover:bg-surface"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedSceneId(sc.id);
                      setPrompt(sc.visualPrompt || sc.title);
                      if (sc.cameraDirection) setCameraMovement(sc.cameraDirection);
                    }}
                    className="rounded bg-primary-fixed px-2.5 py-1 font-semibold text-on-primary-fixed"
                  >
                    Use Scene
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Async Video Generation Jobs */}
      <div className="rounded-xl border border-outline-variant/60 bg-surface p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-on-surface">Video Generation Jobs ({generations.length})</h3>
          <button onClick={loadData} className="inline-flex items-center gap-1 text-xs text-primary">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
        {generations.length === 0 ? (
          <p className="text-xs text-on-surface-variant">No video generation jobs submitted yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {generations.map((g) => (
              <div key={g.id} className="rounded-lg border border-outline-variant/60 bg-surface-container-low p-3 text-xs space-y-2">
                <div className="flex items-center justify-between font-semibold">
                  <span>{g.provider} · {g.model} ({g.aspectRatio}, {g.durationSec}s)</span>
                  <span className={g.status === "COMPLETED" ? "text-tertiary" : g.status === "FAILED" ? "text-error" : "text-primary"}>
                    {g.status} ({g.progress}%)
                  </span>
                </div>
                <p className="text-on-surface-variant line-clamp-2">{g.prompt}</p>
                {g.errorMessage && <p className="text-error">{g.errorMessage}</p>}
                {g.videoUrl && (
                  <video controls src={g.videoUrl} className="w-full rounded-lg max-h-52 bg-black" />
                )}
                <div className="flex gap-3 pt-1">
                  {(g.status === "QUEUED" || g.status === "PROCESSING") && (
                    <>
                      <button onClick={() => handlePatch("POLL", { videoGenId: g.id })} className="inline-flex items-center gap-1 text-primary font-semibold hover:underline">
                        <RefreshCw className="h-3 w-3" /> Poll Status
                      </button>
                      <button onClick={() => handlePatch("CANCEL", { videoGenId: g.id })} className="inline-flex items-center gap-1 text-error hover:underline">
                        <XCircle className="h-3 w-3" /> Cancel
                      </button>
                    </>
                  )}
                  {g.videoUrl && (
                    <a href={g.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      <Download className="h-3 w-3" /> Download MP4
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
