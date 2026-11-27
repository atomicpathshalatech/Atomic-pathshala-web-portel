"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Image as ImageIcon,
  Save,
  Download,
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  History,
  LayoutTemplate,
} from "lucide-react";
import {
  THUMBNAIL_DIMENSIONS,
  THUMBNAIL_PROJECT_TYPES,
  ThumbnailConcept,
  ThumbnailLayer,
  ThumbnailLayerType,
} from "@/lib/ai-studio/thumbnail/types";

interface ThumbnailProjectRow {
  id: string;
  title: string;
  projectType: string;
  platform: string;
  width: number;
  height: number;
  concepts: ThumbnailConcept[] | null;
  layers: ThumbnailLayer[] | null;
}

interface HistoryRow {
  id: string;
  version: number;
  changeSummary: string | null;
  snapshot: { layers?: ThumbnailLayer[] };
  createdAt: string;
}

interface TemplateRow {
  id: string;
  name: string;
  width: number;
  height: number;
  layers: ThumbnailLayer[];
}

interface TeacherOption {
  id: string;
  name: string;
  imageUrl: string | null;
}

const LAYER_TYPES: ThumbnailLayerType[] = [
  "BACKGROUND",
  "TEACHER_IMAGE",
  "LOGO",
  "TEXT",
  "CHEMISTRY_STRUCTURE",
  "DIAGRAM",
  "GRAPHIC",
  "DECORATIVE",
  "GLOW",
  "SHADOW",
  "OVERLAY",
];

export function ThumbnailStudioTab({
  projectId,
  defaultTopic,
  defaultSubject,
}: {
  projectId: string;
  defaultTopic?: string | null;
  defaultSubject?: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const [thumbProjects, setThumbProjects] = useState<ThumbnailProjectRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);

  const [activeThumbId, setActiveThumbId] = useState<string | null>(null);
  const [layers, setLayers] = useState<ThumbnailLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [concepts, setConcepts] = useState<ThumbnailConcept[]>([]);

  const [topic, setTopic] = useState(defaultTopic || "");
  const [projectType, setProjectType] = useState("LECTURE");
  const [dimId, setDimId] = useState("YOUTUBE");
  const [thumbnailText, setThumbnailText] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [templateName, setTemplateName] = useState("");

  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const dim = THUMBNAIL_DIMENSIONS.find((d) => d.id === dimId) || THUMBNAIL_DIMENSIONS[0];

  const loadAll = async () => {
    const [tRes, bRes] = await Promise.all([
      fetch(`/api/team/content-studio/projects/${projectId}/thumbnails`),
      fetch("/api/team/content-studio/thumbnails/brand"),
    ]);
    const [tJson, bJson] = await Promise.all([tRes.json(), bRes.json()]);
    if (tJson.success) {
      const list: ThumbnailProjectRow[] = tJson.data.thumbnails || [];
      setThumbProjects(list);
      setHistory(tJson.data.history || []);
      const first = list[0];
      if (first) {
        setActiveThumbId(first.id);
        setConcepts(Array.isArray(first.concepts) ? first.concepts : []);
        setLayers(Array.isArray(first.layers) ? first.layers : []);
      }
    }
    if (bJson.success) {
      setTemplates(bJson.data.templates || []);
      setTeachers(bJson.data.teachers || []);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Render layers to HTML5 Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = dim.width;
    const h = dim.height;
    canvas.width = w;
    canvas.height = h;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0B0E14";
    ctx.fillRect(0, 0, w, h);

    const drawLayer = (layer: ThumbnailLayer) => {
      if (!layer.visible) return;
      ctx.save();
      ctx.globalAlpha = layer.opacity ?? 1;

      const cx = layer.x + layer.width / 2;
      const cy = layer.y + layer.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate(((layer.rotation || 0) * Math.PI) / 180);
      ctx.translate(-cx, -cy);

      if (layer.type === "BACKGROUND" || layer.type === "OVERLAY" || layer.type === "DECORATIVE" || layer.type === "GRAPHIC") {
        if (layer.imageUrl) {
          const cached = imageCacheRef.current.get(layer.imageUrl);
          if (cached && cached.complete) {
            ctx.drawImage(cached, layer.x, layer.y, layer.width, layer.height);
          } else if (!cached) {
            const img = new window.Image();
            img.crossOrigin = "anonymous";
            img.onload = () => setLayers((prev) => [...prev]);
            img.src = layer.imageUrl;
            imageCacheRef.current.set(layer.imageUrl, img);
          }
        } else if (layer.gradientEndColor) {
          const grad = ctx.createLinearGradient(layer.x, layer.y, layer.x + layer.width, layer.y + layer.height);
          grad.addColorStop(0, layer.fillColor || "#0B0E14");
          grad.addColorStop(1, layer.gradientEndColor);
          ctx.fillStyle = grad;
          ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
        } else {
          ctx.fillStyle = layer.fillColor || "#1e293b";
          ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
        }
      } else if (layer.type === "GLOW" || layer.type === "SHADOW") {
        const rad = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(layer.width, layer.height) / 2);
        rad.addColorStop(0, layer.fillColor || "#f97316");
        rad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rad;
        ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
      } else if (
        (layer.type === "LOGO" || layer.type === "TEACHER_IMAGE" || layer.type === "CHEMISTRY_STRUCTURE" || layer.type === "DIAGRAM") &&
        layer.imageUrl
      ) {
        const cached = imageCacheRef.current.get(layer.imageUrl);
        if (cached && cached.complete) {
          ctx.drawImage(cached, layer.x, layer.y, layer.width, layer.height);
        } else if (!cached) {
          const img = new window.Image();
          img.crossOrigin = "anonymous";
          img.onload = () => setLayers((prev) => [...prev]);
          img.src = layer.imageUrl;
          imageCacheRef.current.set(layer.imageUrl, img);
        }
      } else if (layer.type === "TEXT" && layer.text) {
        const fontSize = layer.fontSize || 64;
        ctx.font = `${layer.fontWeight || "800"} ${fontSize}px ${layer.fontFamily || "Inter, sans-serif"}`;
        ctx.textAlign = layer.align || "left";
        ctx.textBaseline = "top";
        if (layer.glowColor) {
          ctx.shadowColor = layer.glowColor;
          ctx.shadowBlur = layer.glowBlur || 20;
        } else if (layer.shadowColor) {
          ctx.shadowColor = layer.shadowColor;
          ctx.shadowBlur = layer.shadowBlur || 12;
        }
        const words = layer.text.split(" ");
        const lines: string[] = [];
        let line = "";
        for (const word of words) {
          const test = line ? `${line} ${word}` : word;
          if (ctx.measureText(test).width > layer.width && line) {
            lines.push(line);
            line = word;
          } else {
            line = test;
          }
        }
        if (line) lines.push(line);

        const textX = layer.align === "center" ? cx : layer.align === "right" ? layer.x + layer.width : layer.x;
        lines.forEach((l, i) => {
          const ly = layer.y + i * (fontSize * 1.15);
          if (layer.strokeWidth && layer.strokeWidth > 0) {
            ctx.lineWidth = layer.strokeWidth;
            ctx.strokeStyle = layer.strokeColor || "#000000";
            ctx.strokeText(l, textX, ly);
          }
          ctx.fillStyle = layer.color || "#FFFFFF";
          ctx.fillText(l, textX, ly);
        });
      }
      ctx.restore();
    };

    layers.forEach(drawLayer);
  }, [layers, dim.width, dim.height]);

  const handleGenerateConcepts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setBusy("concepts");
    setErr(null);
    setMsg(null);
    try {
      const teacher = teachers.find((t) => t.id === teacherId);
      const res = await fetch(`/api/team/content-studio/projects/${projectId}/thumbnails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "GENERATE_CONCEPTS",
          title: `${topic} Thumbnail`,
          topic,
          subject: defaultSubject || undefined,
          projectType,
          thumbnailText: thumbnailText || undefined,
          platform: dim.id,
          width: dim.width,
          height: dim.height,
          teacherImageUrl: teacher?.imageUrl || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Concept generation failed");
      setMsg(`Generated ${json.data.concepts?.length || 5} thumbnail concepts.`);
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Concept generation failed");
    } finally {
      setBusy(null);
    }
  };

  const handleOneClickThumbnail = async () => {
    if (!topic.trim()) return;
    setBusy("oneclick");
    setErr(null);
    setMsg(null);
    try {
      const teacher = teachers.find((t) => t.id === teacherId);
      const res = await fetch(`/api/team/content-studio/projects/${projectId}/thumbnails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "GENERATE_CONCEPTS",
          title: `${topic} Thumbnail`,
          topic,
          subject: defaultSubject || undefined,
          projectType,
          thumbnailText: thumbnailText || undefined,
          platform: dim.id,
          width: dim.width,
          height: dim.height,
          teacherImageUrl: teacher?.imageUrl || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Thumbnail concept generation failed");

      const createdProj = json.data.thumbnailProject as ThumbnailProjectRow;
      const firstConcept = (json.data.concepts as ThumbnailConcept[] | undefined)?.[0];
      const bgPrompt =
        firstConcept?.backgroundPrompt ||
        `High-contrast YouTube educational thumbnail background for ${topic}, dramatic lighting, Atomic Pathshala orange and dark slate aesthetic, no text`;

      // Automatically generate the AI background image in the same click
      const imgRes = await fetch(`/api/team/content-studio/projects/${projectId}/thumbnails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "GENERATE_IMAGE",
          thumbnailProjectId: createdProj.id,
          prompt: bgPrompt,
          width: dim.width,
          height: dim.height,
        }),
      });
      const imgJson = await imgRes.json();
      if (!imgRes.ok || !imgJson.success) {
        await loadAll();
        throw new Error(imgJson.error || "Concepts created, but AI image generation failed");
      }

      const assetUrl = imgJson.data.asset?.publicUrl as string | undefined;
      const baseLayers = Array.isArray(createdProj.layers) ? createdProj.layers : [];
      const updatedLayers = assetUrl
        ? baseLayers.map((l) => (l.type === "BACKGROUND" ? { ...l, imageUrl: assetUrl } : l))
        : baseLayers;

      if (assetUrl && createdProj.id) {
        await fetch(`/api/team/content-studio/projects/${projectId}/thumbnails`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            thumbnailProjectId: createdProj.id,
            layers: updatedLayers,
            changeSummary: "1-Click AI Thumbnail + Background",
          }),
        });
      }

      setMsg("1-Click Thumbnail ready! You can download PNG now or tweak any layer below.");
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "1-Click thumbnail failed");
    } finally {
      setBusy(null);
    }
  };

  const handleGenerateAiBackground = async (prompt: string) => {
    setBusy("image");
    setErr(null);
    try {
      const res = await fetch(`/api/team/content-studio/projects/${projectId}/thumbnails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "GENERATE_IMAGE",
          thumbnailProjectId: activeThumbId || undefined,
          prompt,
          width: dim.width,
          height: dim.height,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Image generation failed");
      const assetUrl = json.data.asset?.publicUrl;
      if (assetUrl) {
        setLayers((prev) =>
          prev.map((l) => (l.type === "BACKGROUND" ? { ...l, imageUrl: assetUrl } : l))
        );
      }
      setMsg("AI Background generated and applied to Background layer.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Image generation failed");
    } finally {
      setBusy(null);
    }
  };

  const handleSaveLayers = async () => {
    if (!activeThumbId) return;
    setBusy("save");
    setErr(null);
    try {
      const res = await fetch(`/api/team/content-studio/projects/${projectId}/thumbnails`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thumbnailProjectId: activeThumbId, layers }),
      });
      if (!res.ok) throw new Error("Failed to save layers");
      setMsg("Saved thumbnail layers & version snapshot.");
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(null);
    }
  };

  const handleExportPng = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy("export");
    setErr(null);
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Canvas export failed");

      // Download locally
      const localUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = localUrl;
      a.download = `thumbnail-${dim.width}x${dim.height}-${Date.now()}.png`;
      a.click();

      // Persist to R2 Project Assets
      const form = new FormData();
      form.append("file", new File([blob], `thumbnail-${Date.now()}.png`, { type: "image/png" }));
      form.append("assetType", "THUMBNAIL");
      form.append("projectId", projectId);
      form.append("title", `Thumbnail (${dim.width}x${dim.height})`);
      await fetch("/api/team/content-studio/assets", { method: "POST", body: form });
      setMsg(`Exported ${dim.width}×${dim.height} PNG & saved to Project Assets.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return;
    const res = await fetch("/api/team/content-studio/thumbnails/brand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "TEMPLATE",
        name: templateName,
        projectType,
        width: dim.width,
        height: dim.height,
        layers,
      }),
    });
    if (res.ok) {
      setTemplateName("");
      setMsg("Saved reusable thumbnail template.");
      await loadAll();
    }
  };

  const selectedLayer = layers.find((l) => l.id === selectedLayerId) || null;

  const updateSelected = (patch: Partial<ThumbnailLayer>) => {
    if (!selectedLayerId) return;
    setLayers((prev) => prev.map((l) => (l.id === selectedLayerId ? { ...l, ...patch } : l)));
  };

  const addLayer = (type: ThumbnailLayerType) => {
    const newLayer: ThumbnailLayer = {
      id: `layer-${Date.now()}`,
      type,
      name: `${type.replace("_", " ")}`,
      x: 80,
      y: 80,
      width: type === "TEXT" ? 500 : 220,
      height: type === "TEXT" ? 120 : 220,
      rotation: 0,
      opacity: 1,
      visible: true,
      ...(type === "TEXT" ? { text: "NEW TEXT", fontSize: 60, color: "#FFFFFF", strokeColor: "#000000", strokeWidth: 4 } : {}),
      ...(type === "LOGO" ? { imageUrl: "/atomic-logo.png", width: 150, height: 60 } : {}),
      ...(type === "GLOW" || type === "DECORATIVE" || type === "GRAPHIC" ? { fillColor: "#f97316" } : {}),
    };
    setLayers((prev) => [...prev, newLayer]);
    setSelectedLayerId(newLayer.id);
  };

  return (
    <div className="space-y-6">
      {msg && <div className="rounded-lg bg-tertiary-fixed px-4 py-2 text-sm text-on-tertiary-fixed">{msg}</div>}
      {err && <div className="rounded-lg bg-error-container px-4 py-2 text-sm text-on-error-container">{err}</div>}

      {/* Concept Generator */}
      <form onSubmit={handleGenerateConcepts} className="rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
          <input type="text" required value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic..." className="sm:col-span-2 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-xs" />
          <select value={projectType} onChange={(e) => setProjectType(e.target.value)} className="rounded-lg border border-outline-variant bg-surface px-2 py-2 text-xs">
            {THUMBNAIL_PROJECT_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace("_", " ")}</option>
            ))}
          </select>
          <select value={dimId} onChange={(e) => setDimId(e.target.value)} className="rounded-lg border border-outline-variant bg-surface px-2 py-2 text-xs">
            {THUMBNAIL_DIMENSIONS.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
          <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="rounded-lg border border-outline-variant bg-surface px-2 py-2 text-xs">
            <option value="">Teacher Cutout (Optional)</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-3">
          <input type="text" value={thumbnailText} onChange={(e) => setThumbnailText(e.target.value)} placeholder="Short headline text override (2-5 words)" className="flex-1 min-w-[200px] rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-xs" />
          <button
            type="button"
            onClick={handleOneClickThumbnail}
            disabled={Boolean(busy)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-orange-500 disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" /> {busy === "oneclick" ? "Creating Thumbnail + AI Image..." : "1-Click Generate Thumbnail"}
          </button>
          <button type="submit" disabled={Boolean(busy)} className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container-high disabled:opacity-50">
            <Sparkles className="h-3.5 w-3.5" /> {busy === "concepts" ? "Generating..." : "Concepts Only"}
          </button>
        </div>
      </form>

      {/* 5 Concepts Strip */}
      {concepts.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {concepts.map((c) => (
            <div key={c.id} className="rounded-xl border border-outline-variant/60 bg-surface p-3 text-xs space-y-2 flex flex-col justify-between">
              <div>
                <span className="rounded bg-primary-fixed px-1.5 py-0.5 text-[10px] font-bold text-on-primary-fixed">{c.style}</span>
                <div className="mt-1.5 font-bold text-on-surface">{c.headlineText}</div>
                <p className="mt-1 text-[11px] text-on-surface-variant line-clamp-2">{c.compositionNote}</p>
              </div>
              <div className="flex flex-col gap-1 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setLayers((prev) =>
                      prev.map((l) =>
                        l.id === "layer-headline"
                          ? { ...l, text: c.headlineText.toUpperCase() }
                          : l.id === "layer-bg"
                            ? { ...l, gradientEndColor: c.primaryColor }
                            : l
                      )
                    )
                  }
                  className="rounded border border-outline-variant py-1 font-medium hover:bg-surface-container"
                >
                  Apply Text & Colors
                </button>
                <button
                  type="button"
                  onClick={() => handleGenerateAiBackground(c.backgroundPrompt)}
                  disabled={Boolean(busy)}
                  className="inline-flex items-center justify-center gap-1 rounded bg-secondary py-1 font-semibold text-on-secondary"
                >
                  <ImageIcon className="h-3 w-3" /> {busy === "image" ? "..." : "AI Background"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Canvas + Layer Editor */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          <div className="rounded-xl border border-outline-variant/60 bg-surface-container p-3">
            <canvas ref={canvasRef} className="w-full h-auto rounded-lg shadow-md bg-black" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleSaveLayers} disabled={!activeThumbId || Boolean(busy)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-on-primary">
              <Save className="h-3.5 w-3.5" /> Save Layers & Version
            </button>
            <button onClick={handleExportPng} disabled={Boolean(busy)} className="inline-flex items-center gap-1.5 rounded-lg bg-tertiary px-3.5 py-1.5 text-xs font-semibold text-on-tertiary">
              <Download className="h-3.5 w-3.5" /> Export {dim.width}×{dim.height} PNG
            </button>
          </div>
        </div>

        {/* Layer Stack & Inspector */}
        <div className="rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm text-on-surface">Layers ({layers.length})</span>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  addLayer(e.target.value as ThumbnailLayerType);
                  e.target.value = "";
                }
              }}
              className="rounded border border-outline-variant bg-surface px-2 py-1 text-xs"
            >
              <option value="">+ Add Layer...</option>
              {LAYER_TYPES.map((lt) => (
                <option key={lt} value={lt}>{lt}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {layers.map((l, idx) => (
              <div
                key={l.id}
                onClick={() => setSelectedLayerId(l.id)}
                className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 cursor-pointer border ${
                  selectedLayerId === l.id ? "border-primary bg-primary-fixed/40" : "border-outline-variant/40"
                }`}
              >
                <span className="font-medium truncate">{l.name} ({l.type})</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={(e) => { e.stopPropagation(); if (idx > 0) setLayers((p) => { const c = [...p]; const a = c[idx]; const b = c[idx - 1]; if (a && b) { c[idx] = b; c[idx - 1] = a; } return c; }); }}><ArrowUp className="h-3 w-3" /></button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); if (idx < layers.length - 1) setLayers((p) => { const c = [...p]; const a = c[idx]; const b = c[idx + 1]; if (a && b) { c[idx] = b; c[idx + 1] = a; } return c; }); }}><ArrowDown className="h-3 w-3" /></button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setLayers((p) => [...p, { ...l, id: `layer-${Date.now()}`, x: l.x + 20, y: l.y + 20 }]); }}><Copy className="h-3 w-3" /></button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setLayers((p) => p.filter((x) => x.id !== l.id)); }} className="text-error"><Trash2 className="h-3 w-3" /></button>
                </div>
              </div>
            ))}
          </div>

          {selectedLayer && (
            <div className="border-t border-outline-variant/40 pt-3 space-y-2">
              <div className="font-semibold text-primary">Edit: {selectedLayer.name}</div>
              <div className="grid grid-cols-2 gap-2">
                <label>X <input type="number" value={selectedLayer.x} onChange={(e) => updateSelected({ x: Number(e.target.value) })} className="w-full rounded border border-outline-variant px-2 py-1" /></label>
                <label>Y <input type="number" value={selectedLayer.y} onChange={(e) => updateSelected({ y: Number(e.target.value) })} className="w-full rounded border border-outline-variant px-2 py-1" /></label>
                <label>Width <input type="number" value={selectedLayer.width} onChange={(e) => updateSelected({ width: Number(e.target.value) })} className="w-full rounded border border-outline-variant px-2 py-1" /></label>
                <label>Height <input type="number" value={selectedLayer.height} onChange={(e) => updateSelected({ height: Number(e.target.value) })} className="w-full rounded border border-outline-variant px-2 py-1" /></label>
                <label>Rotate <input type="number" value={selectedLayer.rotation} onChange={(e) => updateSelected({ rotation: Number(e.target.value) })} className="w-full rounded border border-outline-variant px-2 py-1" /></label>
                <label>Opacity <input type="number" step="0.1" min="0" max="1" value={selectedLayer.opacity} onChange={(e) => updateSelected({ opacity: Number(e.target.value) })} className="w-full rounded border border-outline-variant px-2 py-1" /></label>
              </div>
              {selectedLayer.type === "TEXT" && (
                <div className="space-y-2 pt-1">
                  <input type="text" value={selectedLayer.text || ""} onChange={(e) => updateSelected({ text: e.target.value })} className="w-full rounded border border-outline-variant px-2 py-1" placeholder="Text" />
                  <div className="grid grid-cols-3 gap-2">
                    <input type="number" value={selectedLayer.fontSize || 64} onChange={(e) => updateSelected({ fontSize: Number(e.target.value) })} className="rounded border border-outline-variant px-2 py-1" placeholder="Size" />
                    <input type="color" value={selectedLayer.color || "#ffffff"} onChange={(e) => updateSelected({ color: e.target.value })} className="h-7 w-full" title="Text Color" />
                    <input type="color" value={selectedLayer.strokeColor || "#000000"} onChange={(e) => updateSelected({ strokeColor: e.target.value })} className="h-7 w-full" title="Outline Color" />
                  </div>
                </div>
              )}
              {(selectedLayer.type === "LOGO" || selectedLayer.type === "TEACHER_IMAGE" || selectedLayer.type === "BACKGROUND") && (
                <input type="text" value={selectedLayer.imageUrl || ""} onChange={(e) => updateSelected({ imageUrl: e.target.value })} placeholder="Image URL" className="w-full rounded border border-outline-variant px-2 py-1" />
              )}
            </div>
          )}

          {/* Templates & Version History */}
          <div className="border-t border-outline-variant/40 pt-3 space-y-2">
            <div className="font-semibold flex items-center gap-1"><LayoutTemplate className="h-3.5 w-3.5" /> Templates</div>
            <div className="flex gap-1.5">
              <input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Save layout as template..." className="flex-1 rounded border border-outline-variant px-2 py-1" />
              <button type="button" onClick={handleSaveTemplate} className="rounded bg-secondary px-2.5 py-1 font-semibold text-on-secondary">Save</button>
            </div>
            {templates.length > 0 && (
              <select onChange={(e) => { const tpl = templates.find((t) => t.id === e.target.value); if (tpl) setLayers(tpl.layers); }} className="w-full rounded border border-outline-variant px-2 py-1">
                <option value="">Load saved template...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.width}×{t.height})</option>
                ))}
              </select>
            )}
          </div>

          {history.length > 0 && (
            <div className="border-t border-outline-variant/40 pt-3 space-y-1.5">
              <div className="font-semibold flex items-center gap-1"><History className="h-3.5 w-3.5" /> Version History</div>
              {history.slice(0, 5).map((h) => (
                <div key={h.id} className="flex items-center justify-between text-[11px]">
                  <span>v{h.version}: {h.changeSummary}</span>
                  <button
                    type="button"
                    onClick={() => { if (h.snapshot?.layers) setLayers(h.snapshot.layers); }}
                    className="text-primary hover:underline"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
