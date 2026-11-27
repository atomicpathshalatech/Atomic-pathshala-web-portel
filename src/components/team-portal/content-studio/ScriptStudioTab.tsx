"use client";

import React, { useEffect, useState } from "react";
import {
  Sparkles,
  Save,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  FlaskConical,
  Activity,
  GitCompare,
} from "lucide-react";

interface ScriptSection {
  id: string;
  type: "HOOK" | "INTRO" | "MAIN" | "ENGAGEMENT" | "CTA" | "ENDING";
  title: string;
  content: string;
  durationSec: number;
}

interface ScriptRecord {
  id: string;
  version: number;
  title: string;
  language: string;
  medium: string;
  style: string;
  wordCount: number;
  estimatedDurationSec: number;
  bodyMarkdown: string;
  sectionsJson: ScriptSection[] | null;
  chemistryAudit: Record<string, unknown> | null;
  retentionReview: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: string;
}

const STYLES = [
  "TEACHER_STYLE",
  "CONVERSATIONAL",
  "MOTIVATIONAL",
  "CINEMATIC",
  "ENERGETIC",
  "SERIOUS",
  "EMOTIONAL",
  "EDUCATIONAL",
  "STORYTELLING",
];

export function ScriptStudioTab({
  projectId,
  defaultTopic,
}: {
  projectId: string;
  defaultTopic?: string | null;
}) {
  const [scripts, setScripts] = useState<ScriptRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [sections, setSections] = useState<ScriptSection[]>([]);
  const [title, setTitle] = useState(defaultTopic || "Video Script");
  const [language, setLanguage] = useState("hinglish");
  const [medium, setMedium] = useState("BILINGUAL");
  const [style, setStyle] = useState("TEACHER_STYLE");
  const [topic, setTopic] = useState(defaultTopic || "");

  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadScripts = async () => {
    const res = await fetch(`/api/team/content-studio/projects/${projectId}/scripts`);
    const json = await res.json();
    if (json.success) {
      const list: ScriptRecord[] = json.data.scripts || [];
      setScripts(list);
      const active = list.find((s) => s.isActive) || list[0];
      if (active) {
        setSelectedId(active.id);
        setTitle(active.title);
        setLanguage(active.language);
        setMedium(active.medium);
        setStyle(active.style);
        setSections(
          Array.isArray(active.sectionsJson) && active.sectionsJson.length > 0
            ? active.sectionsJson
            : [{ id: "sec-1", type: "MAIN", title: "Full Script", content: active.bodyMarkdown, durationSec: active.estimatedDurationSec || 120 }]
        );
      }
    }
  };

  useEffect(() => {
    loadScripts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const activeScript = scripts.find((s) => s.id === selectedId) || null;
  const compareScript = scripts.find((s) => s.id === compareId) || null;

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setBusy("generate");
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/team/content-studio/projects/${projectId}/scripts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, language, medium, style }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Script generation failed");
      setMsg("Generated new script version.");
      await loadScripts();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Script generation failed");
    } finally {
      setBusy(null);
    }
  };

  const handleSave = async (saveAsNewVersion: boolean) => {
    setBusy("save");
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/team/content-studio/projects/${projectId}/scripts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scriptId: selectedId || undefined,
          title,
          sections,
          language,
          medium,
          style,
          saveAsNewVersion,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Save failed");
      setMsg(saveAsNewVersion ? "Saved as new version." : "Script saved.");
      await loadScripts();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(null);
    }
  };

  const handleSectionAi = async (
    secIdx: number,
    action: "REWRITE" | "SHORTEN" | "EXPAND" | "CHANGE_TONE" | "TRANSLATE" | "REGENERATE" | "ADD_EXAMPLE"
  ) => {
    const sec = sections[secIdx];
    if (!sec) return;
    setBusy(`sec-${secIdx}-${action}`);
    setErr(null);
    try {
      const res = await fetch(`/api/team/content-studio/projects/${projectId}/scripts/transform`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          text: sec.content,
          targetTone: style,
          targetLanguage: language,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Transform failed");
      setSections((prev) =>
        prev.map((s, i) => (i === secIdx ? { ...s, content: json.data.updatedText } : s))
      );
      setMsg(`Updated section "${sec.title}" (${action}). Click Save to persist.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Transform failed");
    } finally {
      setBusy(null);
    }
  };

  const handleAudit = async (action: "CHEMISTRY_VERIFY" | "RETENTION_ANALYZE") => {
    if (!activeScript) return;
    setBusy(action);
    setErr(null);
    try {
      const fullText = sections.map((s) => `${s.title}\n${s.content}`).join("\n\n");
      const res = await fetch(`/api/team/content-studio/projects/${projectId}/scripts/transform`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, scriptId: activeScript.id, text: fullText }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Analysis failed");
      await loadScripts();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setBusy(null);
    }
  };

  const handleAssetAction = async (
    sec: ScriptSection,
    action: "IMAGE" | "VOICE" | "VIDEO" | "DIAGRAM" | "SLIDE" | "MUSIC" | "CAPTION"
  ) => {
    setBusy(`asset-${sec.id}-${action}`);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/team/content-studio/projects/${projectId}/scripts/asset-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, sectionTitle: sec.title, sectionText: sec.content }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Asset action failed");
      setMsg(
        json.data.asset
          ? `Created ${action} asset: ${json.data.asset.title}`
          : `Queued ${action} job (${json.data.job?.id})`
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Asset action failed");
    } finally {
      setBusy(null);
    }
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= sections.length) return;
    setSections((prev) => {
      const copy = [...prev];
      const item = copy[idx];
      const swap = copy[target];
      if (!item || !swap) return prev;
      copy[idx] = swap;
      copy[target] = item;
      return copy;
    });
  };

  return (
    <div className="space-y-5">
      {msg && <div className="rounded-lg bg-tertiary-fixed px-4 py-2 text-sm text-on-tertiary-fixed">{msg}</div>}
      {err && <div className="rounded-lg bg-error-container px-4 py-2 text-sm text-on-error-container">{err}</div>}

      {/* Generator Controls */}
      <div className="rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic for new script..."
            className="sm:col-span-2 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
          />
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="rounded-lg border border-outline-variant bg-surface px-2 py-2 text-xs">
            <option value="hinglish">Hinglish</option>
            <option value="hindi">Hindi</option>
            <option value="english">English</option>
          </select>
          <select value={medium} onChange={(e) => setMedium(e.target.value)} className="rounded-lg border border-outline-variant bg-surface px-2 py-2 text-xs">
            <option value="BILINGUAL">Bilingual</option>
            <option value="HINDI_MEDIUM">Hindi Medium</option>
            <option value="ENGLISH_MEDIUM">English Medium</option>
          </select>
          <select value={style} onChange={(e) => setStyle(e.target.value)} className="rounded-lg border border-outline-variant bg-surface px-2 py-2 text-xs">
            {STYLES.map((s) => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleGenerate} disabled={Boolean(busy)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-on-primary disabled:opacity-50">
            <Sparkles className="h-3.5 w-3.5" /> {busy === "generate" ? "Generating..." : "Generate Full Script"}
          </button>
          <button onClick={() => handleSave(false)} disabled={Boolean(busy)} className="inline-flex items-center gap-1 rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-semibold">
            <Save className="h-3.5 w-3.5" /> Save
          </button>
          <button onClick={() => handleSave(true)} disabled={Boolean(busy)} className="inline-flex items-center gap-1 rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-semibold">
            Save as New Version
          </button>
          <button onClick={() => handleAudit("CHEMISTRY_VERIFY")} disabled={!activeScript || Boolean(busy)} className="inline-flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-on-secondary disabled:opacity-50">
            <FlaskConical className="h-3.5 w-3.5" /> Chemistry Accuracy Check
          </button>
          <button onClick={() => handleAudit("RETENTION_ANALYZE")} disabled={!activeScript || Boolean(busy)} className="inline-flex items-center gap-1 rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
            <Activity className="h-3.5 w-3.5" /> Retention Suggestions
          </button>
        </div>
      </div>

      {/* Version Selector & Compare */}
      {scripts.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-semibold text-on-surface-variant">Versions:</span>
          {scripts.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setSelectedId(s.id);
                setTitle(s.title);
                setSections(Array.isArray(s.sectionsJson) ? s.sectionsJson : []);
              }}
              className={`rounded-full px-3 py-1 font-semibold ${selectedId === s.id ? "bg-primary text-on-primary" : "bg-surface-container-high"}`}
            >
              v{s.version} ({s.wordCount}w)
            </button>
          ))}
          {scripts.length > 1 && (
            <select
              value={compareId || ""}
              onChange={(e) => setCompareId(e.target.value || null)}
              className="ml-auto rounded-lg border border-outline-variant bg-surface px-2 py-1 text-xs"
            >
              <option value="">Compare with version...</option>
              {scripts.filter((s) => s.id !== selectedId).map((s) => (
                <option key={s.id} value={s.id}>v{s.version} — {s.title}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Side-by-side Version Compare */}
      {compareScript && activeScript && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 rounded-xl border border-primary/30 bg-surface-container-low p-4 text-xs">
          <div>
            <div className="font-bold text-primary mb-1 flex items-center gap-1"><GitCompare className="h-3.5 w-3.5" /> Active: v{activeScript.version}</div>
            <pre className="whitespace-pre-wrap font-sans max-h-60 overflow-y-auto">{activeScript.bodyMarkdown}</pre>
          </div>
          <div>
            <div className="font-bold text-secondary mb-1">Compare: v{compareScript.version}</div>
            <pre className="whitespace-pre-wrap font-sans max-h-60 overflow-y-auto">{compareScript.bodyMarkdown}</pre>
          </div>
        </div>
      )}

      {/* Editable Sections */}
      <div className="space-y-4">
        {sections.map((sec, idx) => (
          <div key={sec.id} className="rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <select
                  value={sec.type}
                  onChange={(e) =>
                    setSections((prev) =>
                      prev.map((s, i) => (i === idx ? { ...s, type: e.target.value as ScriptSection["type"] } : s))
                    )
                  }
                  className="rounded bg-primary-fixed px-2 py-1 text-xs font-semibold text-on-primary-fixed"
                >
                  <option value="HOOK">HOOK</option>
                  <option value="INTRO">INTRO</option>
                  <option value="MAIN">MAIN</option>
                  <option value="ENGAGEMENT">ENGAGEMENT</option>
                  <option value="CTA">CTA</option>
                  <option value="ENDING">ENDING</option>
                </select>
                <input
                  type="text"
                  value={sec.title}
                  onChange={(e) =>
                    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, title: e.target.value } : s)))
                  }
                  className="font-semibold text-sm text-on-surface bg-transparent border-b border-transparent focus:border-primary focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <button onClick={() => moveSection(idx, -1)} className="p-1 hover:bg-surface-container rounded"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button onClick={() => moveSection(idx, 1)} className="p-1 hover:bg-surface-container rounded"><ArrowDown className="h-3.5 w-3.5" /></button>
                <button onClick={() => setSections((prev) => prev.filter((_, i) => i !== idx))} className="p-1 text-error hover:bg-error-container rounded"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>

            <textarea
              rows={4}
              value={sec.content}
              onChange={(e) =>
                setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, content: e.target.value } : s)))
              }
              className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex flex-wrap gap-1.5">
                {(["REWRITE", "SHORTEN", "EXPAND", "CHANGE_TONE", "TRANSLATE", "REGENERATE", "ADD_EXAMPLE"] as const).map((act) => (
                  <button
                    key={act}
                    onClick={() => handleSectionAi(idx, act)}
                    disabled={Boolean(busy)}
                    className="rounded border border-outline-variant px-2 py-0.5 hover:bg-surface-container"
                  >
                    {act.replace("_", " ")}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(["IMAGE", "VOICE", "VIDEO", "DIAGRAM", "SLIDE", "MUSIC", "CAPTION"] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => handleAssetAction(sec, a)}
                    disabled={Boolean(busy)}
                    className="rounded bg-surface-container-high px-2 py-0.5 font-medium text-primary hover:bg-primary-fixed"
                  >
                    + {a}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() =>
            setSections((prev) => [
              ...prev,
              { id: `sec-${Date.now()}`, type: "MAIN", title: "New Section", content: "", durationSec: 45 },
            ])
          }
          className="inline-flex items-center gap-1 rounded-lg border border-dashed border-outline-variant px-3 py-2 text-xs font-medium text-on-surface-variant hover:border-primary"
        >
          <Plus className="h-3.5 w-3.5" /> Add Section
        </button>
      </div>

      {/* Chemistry Audit & Retention Review Panels */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {activeScript?.chemistryAudit && (
          <div className="rounded-xl border border-secondary/40 bg-surface p-4 text-xs space-y-2">
            <div className="font-bold text-secondary">Chemistry Accuracy Audit</div>
            <pre className="whitespace-pre-wrap font-sans max-h-60 overflow-y-auto">
              {JSON.stringify(activeScript.chemistryAudit, null, 2)}
            </pre>
          </div>
        )}
        {activeScript?.retentionReview && (
          <div className="rounded-xl border border-primary/40 bg-surface p-4 text-xs space-y-2">
            <div className="font-bold text-primary">Advisory Retention & Pacing Suggestions</div>
            <pre className="whitespace-pre-wrap font-sans max-h-60 overflow-y-auto">
              {JSON.stringify(activeScript.retentionReview, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
