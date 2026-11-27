"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  Maximize2,
  Save,
  Undo2,
  Redo2,
  Scissors,
  Trash2,
  Plus,
  Download,
  Captions,
  Type,
} from "lucide-react";
import {
  EDITOR_TRACKS,
  EditorClip,
  EditorTrackId,
  getExportDimensions,
} from "@/lib/ai-studio/editor/types";
import {
  exportTimelineVideo,
  renderTimelineFrame,
} from "@/lib/ai-studio/editor/compositor";

interface AssetRow {
  id: string;
  title: string | null;
  assetType: string;
  publicUrl: string | null;
  durationMs: number | null;
}

interface RenderJobRow {
  id: string;
  status: string;
  progress: number;
  errorMessage: string | null;
  createdAt: string;
}

export function VideoEditorTab({
  projectId,
  activeScriptText,
}: {
  projectId: string;
  activeScriptText?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewWrapRef = useRef<HTMLDivElement | null>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const videoCacheRef = useRef<Map<string, HTMLVideoElement>>(new Map());

  const [editorProjectId, setEditorProjectId] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [resolution, setResolution] = useState("1080p");
  const [fps, setFps] = useState(30);
  const [durationMs, setDurationMs] = useState(15000);

  const [clips, setClips] = useState<EditorClip[]>([]);
  const [undoStack, setUndoStack] = useState<EditorClip[][]>([]);
  const [redoStack, setRedoStack] = useState<EditorClip[][]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [renderJobs, setRenderJobs] = useState<RenderJobRow[]>([]);

  const [playheadMs, setPlayheadMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);

  const [captionLang, setCaptionLang] = useState<"hinglish" | "hindi" | "english">("hinglish");
  const [renderPct, setRenderPct] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const dims = getExportDimensions(aspectRatio, resolution);

  const pushClips = (next: EditorClip[]) => {
    setUndoStack((prev) => [...prev.slice(-20), clips]);
    setRedoStack([]);
    setClips(next);
  };

  const handleUndo = () => {
    const prev = undoStack[undoStack.length - 1];
    if (!prev) return;
    setRedoStack((r) => [...r, clips]);
    setUndoStack((u) => u.slice(0, -1));
    setClips(prev);
  };

  const handleRedo = () => {
    const next = redoStack[redoStack.length - 1];
    if (!next) return;
    setUndoStack((u) => [...u, clips]);
    setRedoStack((r) => r.slice(0, -1));
    setClips(next);
  };

  const loadEditor = async () => {
    const res = await fetch(`/api/team/content-studio/projects/${projectId}/editor`);
    const json = await res.json();
    if (json.success) {
      const ep = json.data.editorProject;
      setEditorProjectId(ep.id);
      setAspectRatio(ep.aspectRatio || "16:9");
      setResolution(ep.resolution || "1080p");
      setFps(ep.fps || 30);
      setDurationMs(ep.durationMs || 15000);
      setClips(Array.isArray(ep.timelineJson?.clips) ? ep.timelineJson.clips : []);
      setAssets(json.data.assets || []);
      setRenderJobs(json.data.renderJobs || []);
    }
  };

  useEffect(() => {
    loadEditor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Playback loop
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setPlayheadMs((prev) => {
        const next = prev + dt;
        if (next >= durationMs) {
          setPlaying(false);
          return 0;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, durationMs]);

  // Draw preview frame whenever playhead or clips change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = dims.width;
    canvas.height = dims.height;
    renderTimelineFrame({
      ctx,
      width: dims.width,
      height: dims.height,
      timeMs: playheadMs,
      clips,
      imageCache: imageCacheRef.current,
      videoCache: videoCacheRef.current,
      onAssetLoaded: () => setPlayheadMs((p) => p),
    });
  }, [playheadMs, clips, dims.width, dims.height]);

  const handleSaveProject = async () => {
    if (!editorProjectId) return;
    setBusy("save");
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/team/content-studio/projects/${projectId}/editor`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editorProjectId,
          aspectRatio,
          resolution,
          fps,
          durationMs,
          timelineJson: { clips },
        }),
      });
      if (!res.ok) throw new Error("Failed to save timeline");
      setMsg("Editable timeline project saved.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(null);
    }
  };

  const addAssetToTrack = (asset: AssetRow) => {
    let trackId: EditorTrackId = "IMAGE";
    if (asset.assetType === "VIDEO_CLIP" || asset.assetType === "EXPORTED_VIDEO") trackId = "VIDEO_1";
    else if (asset.assetType === "VOICEOVER" || asset.assetType === "AUDIO") trackId = "VOICE";
    else if (asset.assetType === "MUSIC") trackId = "MUSIC";
    else if (asset.assetType === "SFX") trackId = "SFX";

    const dur = asset.durationMs || 5000;
    const newClip: EditorClip = {
      id: `clip-${Date.now()}`,
      trackId,
      name: asset.title || asset.assetType,
      assetId: asset.id,
      mediaUrl: asset.publicUrl || undefined,
      startMs: Math.round(playheadMs),
      durationMs: dur,
      trimStartMs: 0,
      trimEndMs: dur,
      volume: 1,
      fadeInMs: 0,
      fadeOutMs: 0,
      duckUnderVoice: trackId === "MUSIC",
      transition: "fade",
    };
    pushClips([...clips, newClip]);
    setSelectedClipId(newClip.id);
    if (newClip.startMs + newClip.durationMs > durationMs) {
      setDurationMs(newClip.startMs + newClip.durationMs);
    }
  };

  const addTextOverlay = () => {
    const newClip: EditorClip = {
      id: `text-${Date.now()}`,
      trackId: "TEXT",
      name: "Title Overlay",
      startMs: Math.round(playheadMs),
      durationMs: 4000,
      trimStartMs: 0,
      trimEndMs: 4000,
      volume: 1,
      fadeInMs: 0,
      fadeOutMs: 0,
      text: "ATOMIC PATHSHALA",
      fontSize: Math.round(dims.height * 0.065),
      color: "#FFFFFF",
      align: "center",
    };
    pushClips([...clips, newClip]);
    setSelectedClipId(newClip.id);
  };

  const handleGenerateCaptions = async () => {
    const text = activeScriptText || prompt("Enter narration text for captions:");
    if (!text) return;
    setBusy("captions");
    setErr(null);
    try {
      const res = await fetch(`/api/team/content-studio/projects/${projectId}/editor/captions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language: captionLang, totalDurationMs: durationMs }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Caption generation failed");
      const capClips: EditorClip[] = (json.data.captions || []).map(
        (c: { text: string; startMs: number; durationMs: number }, i: number) => ({
          id: `cap-${Date.now()}-${i}`,
          trackId: "CAPTION" as EditorTrackId,
          name: `Caption ${i + 1}`,
          startMs: c.startMs,
          durationMs: c.durationMs,
          trimStartMs: 0,
          trimEndMs: c.durationMs,
          volume: 1,
          fadeInMs: 0,
          fadeOutMs: 0,
          text: c.text,
          color: "#FFFFFF",
          align: "center" as const,
        })
      );
      pushClips([...clips, ...capClips]);
      setMsg(`Added ${capClips.length} AI captions to Caption Track.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Caption generation failed");
    } finally {
      setBusy(null);
    }
  };

  const handleSplitSelected = () => {
    const c = clips.find((x) => x.id === selectedClipId);
    if (!c) return;
    if (playheadMs <= c.startMs || playheadMs >= c.startMs + c.durationMs) {
      setErr("Move playhead inside the selected clip to split.");
      return;
    }
    const leftDur = Math.round(playheadMs - c.startMs);
    const rightDur = c.durationMs - leftDur;
    const left: EditorClip = { ...c, durationMs: leftDur };
    const right: EditorClip = {
      ...c,
      id: `clip-${Date.now()}`,
      name: `${c.name} (2)`,
      startMs: Math.round(playheadMs),
      durationMs: rightDur,
      trimStartMs: c.trimStartMs + leftDur,
    };
    pushClips(clips.flatMap((x) => (x.id === c.id ? [left, right] : [x])));
  };

  const handleRenderExport = async () => {
    if (!editorProjectId) return;
    setBusy("render");
    setErr(null);
    setMsg(null);
    setRenderPct(0);
    const t0 = Date.now();
    let jobId: string | null = null;
    try {
      const startRes = await fetch(`/api/team/content-studio/projects/${projectId}/editor/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "START",
          editorProjectId,
          resolution,
          aspectRatio,
          durationMs,
        }),
      });
      const startJson = await startRes.json();
      if (!startRes.ok || !startJson.success) throw new Error(startJson.error || "Could not start render job");
      jobId = startJson.data.job.id;

      const { blob, mimeType } = await exportTimelineVideo({
        width: dims.width,
        height: dims.height,
        fps,
        durationMs,
        clips,
        onProgress: (pct) => setRenderPct(pct),
      });

      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      const localUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = localUrl;
      a.download = `final-video-${resolution}-${Date.now()}.${ext}`;
      a.click();

      const form = new FormData();
      form.append("file", new File([blob], `final-export.${ext}`, { type: mimeType }));
      form.append("assetType", "EXPORTED_VIDEO");
      form.append("projectId", projectId);
      form.append("title", `Final Video (${resolution} ${aspectRatio})`);

      const upRes = await fetch("/api/team/content-studio/assets", { method: "POST", body: form });
      const upJson = await upRes.json();
      if (!upRes.ok || !upJson.success) throw new Error(upJson.error || "Upload failed");

      await fetch(`/api/team/content-studio/projects/${projectId}/editor/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "COMPLETE",
          jobId,
          editorProjectId,
          exportedAssetId: upJson.data.asset.id,
          renderDurationMs: Date.now() - t0,
        }),
      });

      setMsg(`Rendered & exported final video to Project Assets!`);
      await loadEditor();
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Render failed";
      setErr(errMsg);
      if (jobId) {
        await fetch(`/api/team/content-studio/projects/${projectId}/editor/render`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "FAIL", jobId, errorMessage: errMsg }),
        });
      }
    } finally {
      setBusy(null);
      setRenderPct(null);
    }
  };

  const selectedClip = clips.find((c) => c.id === selectedClipId) || null;

  return (
    <div className="space-y-5">
      {msg && <div className="rounded-lg bg-tertiary-fixed px-4 py-2 text-sm text-on-tertiary-fixed">{msg}</div>}
      {err && <div className="rounded-lg bg-error-container px-4 py-2 text-sm text-on-error-container">{err}</div>}

      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-outline-variant/60 bg-surface p-3 shadow-sm text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="rounded border border-outline-variant bg-surface px-2 py-1">
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
            <option value="1:1">1:1</option>
          </select>
          <select value={resolution} onChange={(e) => setResolution(e.target.value)} className="rounded border border-outline-variant bg-surface px-2 py-1">
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
          </select>
          <label className="flex items-center gap-1">
            Dur(s):
            <input type="number" min={3} max={600} value={Math.round(durationMs / 1000)} onChange={(e) => setDurationMs(Number(e.target.value) * 1000)} className="w-16 rounded border border-outline-variant px-2 py-1" />
          </label>
          <button onClick={handleUndo} disabled={undoStack.length === 0} className="p-1.5 rounded border border-outline-variant disabled:opacity-40" title="Undo"><Undo2 className="h-3.5 w-3.5" /></button>
          <button onClick={handleRedo} disabled={redoStack.length === 0} className="p-1.5 rounded border border-outline-variant disabled:opacity-40" title="Redo"><Redo2 className="h-3.5 w-3.5" /></button>
          <button onClick={handleSplitSelected} disabled={!selectedClip} className="inline-flex items-center gap-1 rounded border border-outline-variant px-2 py-1 disabled:opacity-40"><Scissors className="h-3.5 w-3.5" /> Split</button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={addTextOverlay} className="inline-flex items-center gap-1 rounded border border-outline-variant px-2.5 py-1 font-medium"><Type className="h-3.5 w-3.5" /> + Text</button>
          <select value={captionLang} onChange={(e) => setCaptionLang(e.target.value as typeof captionLang)} className="rounded border border-outline-variant bg-surface px-2 py-1">
            <option value="hinglish">Hinglish</option>
            <option value="hindi">Hindi</option>
            <option value="english">English</option>
          </select>
          <button onClick={handleGenerateCaptions} disabled={Boolean(busy)} className="inline-flex items-center gap-1 rounded border border-outline-variant px-2.5 py-1 font-medium"><Captions className="h-3.5 w-3.5" /> AI Captions</button>
          <button onClick={handleSaveProject} disabled={Boolean(busy)} className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1.5 font-semibold text-on-primary"><Save className="h-3.5 w-3.5" /> Save</button>
          <button onClick={handleRenderExport} disabled={Boolean(busy)} className="inline-flex items-center gap-1 rounded bg-tertiary px-3 py-1.5 font-semibold text-on-tertiary">
            <Download className="h-3.5 w-3.5" /> {renderPct !== null ? `Rendering ${renderPct}%` : "Export Video"}
          </button>
        </div>
      </div>

      {/* Preview + Asset Bin + Clip Inspector */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div ref={previewWrapRef} className="lg:col-span-2 rounded-xl border border-outline-variant/60 bg-surface-container p-3 space-y-2">
          <canvas ref={canvasRef} className="w-full max-h-[380px] object-contain rounded-lg bg-black mx-auto" />
          <div className="flex items-center gap-3 text-xs">
            <button onClick={() => setPlaying((p) => !p)} className="rounded-lg bg-primary p-1.5 text-on-primary">
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <span className="font-mono">{(playheadMs / 1000).toFixed(1)}s / {(durationMs / 1000).toFixed(1)}s</span>
            <input
              type="range"
              min={0}
              max={durationMs}
              step={100}
              value={playheadMs}
              onChange={(e) => setPlayheadMs(Number(e.target.value))}
              className="flex-1"
            />
            <button onClick={() => previewWrapRef.current?.requestFullscreen?.()} className="p-1.5 rounded border border-outline-variant" title="Fullscreen">
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Right Panel: Project Assets + Selected Clip Inspector */}
        <div className="rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm space-y-4 text-xs">
          <div>
            <div className="font-bold text-on-surface mb-2">Project Assets (Click to Add)</div>
            <div className="max-h-36 overflow-y-auto space-y-1">
              {assets.map((a) => (
                <button
                  key={a.id}
                  onClick={() => addAssetToTrack(a)}
                  className="w-full flex items-center justify-between rounded border border-outline-variant/40 px-2 py-1 text-left hover:bg-surface-container"
                >
                  <span className="truncate">{a.title || a.assetType}</span>
                  <Plus className="h-3.5 w-3.5 shrink-0 text-primary" />
                </button>
              ))}
            </div>
          </div>

          {selectedClip && (
            <div className="border-t border-outline-variant/40 pt-3 space-y-2">
              <div className="flex items-center justify-between font-bold text-primary">
                <span>Clip: {selectedClip.name}</span>
                <button onClick={() => { pushClips(clips.filter((c) => c.id !== selectedClip.id)); setSelectedClipId(null); }} className="text-error"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label>Start (ms) <input type="number" step={250} value={selectedClip.startMs} onChange={(e) => pushClips(clips.map((c) => c.id === selectedClip.id ? { ...c, startMs: Number(e.target.value) } : c))} className="w-full rounded border border-outline-variant px-2 py-1" /></label>
                <label>Duration (ms) <input type="number" step={250} value={selectedClip.durationMs} onChange={(e) => pushClips(clips.map((c) => c.id === selectedClip.id ? { ...c, durationMs: Number(e.target.value) } : c))} className="w-full rounded border border-outline-variant px-2 py-1" /></label>
                <label>Volume <input type="number" step={0.1} min={0} max={2} value={selectedClip.volume} onChange={(e) => pushClips(clips.map((c) => c.id === selectedClip.id ? { ...c, volume: Number(e.target.value) } : c))} className="w-full rounded border border-outline-variant px-2 py-1" /></label>
                <label>Fade In (ms) <input type="number" step={100} value={selectedClip.fadeInMs} onChange={(e) => pushClips(clips.map((c) => c.id === selectedClip.id ? { ...c, fadeInMs: Number(e.target.value) } : c))} className="w-full rounded border border-outline-variant px-2 py-1" /></label>
              </div>
              {(selectedClip.trackId === "TEXT" || selectedClip.trackId === "CAPTION") && (
                <input type="text" value={selectedClip.text || ""} onChange={(e) => pushClips(clips.map((c) => c.id === selectedClip.id ? { ...c, text: e.target.value } : c))} className="w-full rounded border border-outline-variant px-2 py-1" />
              )}
              {selectedClip.trackId === "MUSIC" && (
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={Boolean(selectedClip.duckUnderVoice)} onChange={(e) => pushClips(clips.map((c) => c.id === selectedClip.id ? { ...c, duckUnderVoice: e.target.checked } : c))} />
                  Auto-duck when Voice Track is active
                </label>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Multi-Track Timeline */}
      <div className="rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-on-surface">Multi-Track Timeline</span>
          <label className="flex items-center gap-2">
            Zoom:
            <input type="range" min={0.5} max={3} step={0.25} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
          </label>
        </div>

        <div className="overflow-x-auto space-y-1.5">
          {EDITOR_TRACKS.map((track) => {
            const trackClips = clips.filter((c) => c.trackId === track.id);
            return (
              <div key={track.id} className="flex items-center gap-2 text-xs">
                <div className="w-28 shrink-0 font-medium text-on-surface-variant truncate">{track.label}</div>
                <div className="relative h-8 flex-1 min-w-[600px] rounded bg-surface-container border border-outline-variant/40 overflow-hidden">
                  {/* Playhead line */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-error z-10 pointer-events-none"
                    style={{ left: `${Math.min(100, (playheadMs / durationMs) * 100)}%` }}
                  />
                  {trackClips.map((c) => {
                    const leftPct = (c.startMs / durationMs) * 100 * zoom;
                    const widthPct = Math.max(3, (c.durationMs / durationMs) * 100 * zoom);
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedClipId(c.id)}
                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                        className={`absolute top-1 bottom-1 rounded px-1.5 text-[10px] font-semibold truncate border ${
                          selectedClipId === c.id
                            ? "bg-primary text-on-primary border-white"
                            : "bg-primary-fixed text-on-primary-fixed border-primary/30"
                        }`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {renderJobs.length > 0 && (
        <div className="rounded-xl border border-outline-variant/60 bg-surface p-4 text-xs space-y-1">
          <div className="font-semibold text-on-surface">Render Queue History</div>
          {renderJobs.slice(0, 5).map((j) => (
            <div key={j.id} className="flex justify-between text-on-surface-variant">
              <span>{j.id}</span>
              <span>{j.status} ({j.progress}%) {j.errorMessage ? `— ${j.errorMessage}` : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
