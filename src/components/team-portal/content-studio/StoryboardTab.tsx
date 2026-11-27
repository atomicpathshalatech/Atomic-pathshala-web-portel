"use client";

import React, { useEffect, useState } from "react";
import { Sparkles, Save } from "lucide-react";

interface SceneRow {
  id: string;
  orderIndex: number;
  title: string;
  durationSec: number;
  narrationText: string | null;
  visualPrompt: string | null;
  requiredImage: string | null;
  requiredVideo: string | null;
  diagramSpec: string | null;
  animationNotes: string | null;
  cameraDirection: string | null;
  textOnScreen: string | null;
  voiceInstructions: string | null;
  musicInstructions: string | null;
}

interface StoryboardRecord {
  id: string;
  version: number;
  aspectRatio: string;
  totalDurationSec: number;
  scenes: SceneRow[];
}

export function StoryboardTab({
  projectId,
  activeScriptId,
}: {
  projectId: string;
  activeScriptId?: string;
}) {
  const [storyboards, setStoryboards] = useState<StoryboardRecord[]>([]);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadStoryboards = async () => {
    const res = await fetch(`/api/team/content-studio/projects/${projectId}/storyboard`);
    const json = await res.json();
    if (json.success) setStoryboards(json.data.storyboards || []);
  };

  useEffect(() => {
    loadStoryboards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleGenerate = async () => {
    if (!activeScriptId) {
      setErr("Create or select an active Script first in the Script tab.");
      return;
    }
    setGenerating(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/team/content-studio/projects/${projectId}/storyboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptId: activeScriptId, aspectRatio }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Storyboard generation failed");
      setMsg("Storyboard generated.");
      await loadStoryboards();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Storyboard generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveScene = async (scene: SceneRow) => {
    setErr(null);
    setMsg(null);
    const res = await fetch(`/api/team/content-studio/projects/${projectId}/storyboard`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sceneId: scene.id,
        title: scene.title,
        durationSec: scene.durationSec,
        narrationText: scene.narrationText || "",
        visualPrompt: scene.visualPrompt || "",
        requiredImage: scene.requiredImage || "",
        requiredVideo: scene.requiredVideo || "",
        diagramSpec: scene.diagramSpec || "",
        animationNotes: scene.animationNotes || "",
        cameraDirection: scene.cameraDirection || "",
        textOnScreen: scene.textOnScreen || "",
        voiceInstructions: scene.voiceInstructions || "",
        musicInstructions: scene.musicInstructions || "",
      }),
    });
    if (res.ok) setMsg(`Saved Scene ${scene.orderIndex}`);
  };

  const current = storyboards[0];

  const updateLocalScene = (sceneId: string, patch: Partial<SceneRow>) => {
    setStoryboards((prev) =>
      prev.map((sb, idx) =>
        idx === 0
          ? { ...sb, scenes: sb.scenes.map((sc) => (sc.id === sceneId ? { ...sc, ...patch } : sc)) }
          : sb
      )
    );
  };

  return (
    <div className="space-y-5">
      {msg && <div className="rounded-lg bg-tertiary-fixed px-4 py-2 text-sm text-on-tertiary-fixed">{msg}</div>}
      {err && <div className="rounded-lg bg-error-container px-4 py-2 text-sm text-on-error-container">{err}</div>}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm">
        <select
          value={aspectRatio}
          onChange={(e) => setAspectRatio(e.target.value)}
          className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-xs"
        >
          <option value="16:9">16:9 (YouTube Landscape)</option>
          <option value="9:16">9:16 (Shorts / Reels)</option>
          <option value="1:1">1:1 (Square)</option>
        </select>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-on-primary disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" /> {generating ? "Generating Scenes..." : "Generate Storyboard from Active Script"}
        </button>
        {current && (
          <span className="ml-auto text-xs text-on-surface-variant">
            v{current.version} · {current.scenes.length} scenes · {current.totalDurationSec}s total
          </span>
        )}
      </div>

      {current && (
        <div className="space-y-4">
          {current.scenes.map((sc) => (
            <div key={sc.id} className="rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <span className="rounded bg-primary-fixed px-2 py-0.5 text-xs text-on-primary-fixed">
                    Scene {sc.orderIndex}
                  </span>
                  <input
                    type="text"
                    value={sc.title}
                    onChange={(e) => updateLocalScene(sc.id, { title: e.target.value })}
                    className="font-semibold text-on-surface bg-transparent border-b border-outline-variant/40 focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={sc.durationSec}
                    onChange={(e) => updateLocalScene(sc.id, { durationSec: Number(e.target.value) })}
                    className="w-16 rounded border border-outline-variant px-2 py-1 text-xs"
                  />
                  <span>sec</span>
                  <button
                    onClick={() => handleSaveScene(sc)}
                    className="inline-flex items-center gap-1 rounded bg-primary px-2.5 py-1 font-semibold text-on-primary"
                  >
                    <Save className="h-3 w-3" /> Save
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="font-semibold text-on-surface-variant">Script / Narration</label>
                  <textarea rows={2} value={sc.narrationText || ""} onChange={(e) => updateLocalScene(sc.id, { narrationText: e.target.value })} className="mt-1 w-full rounded border border-outline-variant p-2" />
                </div>
                <div>
                  <label className="font-semibold text-on-surface-variant">Visual Description</label>
                  <textarea rows={2} value={sc.visualPrompt || ""} onChange={(e) => updateLocalScene(sc.id, { visualPrompt: e.target.value })} className="mt-1 w-full rounded border border-outline-variant p-2" />
                </div>
                <div>
                  <label className="font-semibold text-on-surface-variant">Required Image / Diagram / Video</label>
                  <input type="text" value={sc.requiredImage || ""} onChange={(e) => updateLocalScene(sc.id, { requiredImage: e.target.value })} placeholder="Required Image" className="mt-1 w-full rounded border border-outline-variant p-1.5" />
                  <input type="text" value={sc.diagramSpec || ""} onChange={(e) => updateLocalScene(sc.id, { diagramSpec: e.target.value })} placeholder="Diagram Spec" className="mt-1 w-full rounded border border-outline-variant p-1.5" />
                </div>
                <div>
                  <label className="font-semibold text-on-surface-variant">Camera / Animation / Text on Screen</label>
                  <input type="text" value={sc.cameraDirection || ""} onChange={(e) => updateLocalScene(sc.id, { cameraDirection: e.target.value })} placeholder="Camera Movement" className="mt-1 w-full rounded border border-outline-variant p-1.5" />
                  <input type="text" value={sc.textOnScreen || ""} onChange={(e) => updateLocalScene(sc.id, { textOnScreen: e.target.value })} placeholder="Text on Screen" className="mt-1 w-full rounded border border-outline-variant p-1.5" />
                </div>
                <div>
                  <label className="font-semibold text-on-surface-variant">Voice Instructions</label>
                  <input type="text" value={sc.voiceInstructions || ""} onChange={(e) => updateLocalScene(sc.id, { voiceInstructions: e.target.value })} className="mt-1 w-full rounded border border-outline-variant p-1.5" />
                </div>
                <div>
                  <label className="font-semibold text-on-surface-variant">Music Instructions</label>
                  <input type="text" value={sc.musicInstructions || ""} onChange={(e) => updateLocalScene(sc.id, { musicInstructions: e.target.value })} className="mt-1 w-full rounded border border-outline-variant p-1.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
