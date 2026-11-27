"use client";

import React, { useEffect, useState } from "react";
import {
  Mic,
  Play,
  RotateCcw,
  Download,
  Trash2,
  ArrowUp,
  ArrowDown,
  GitMerge,
  BookOpen,
  Plus,
  Sparkles,
} from "lucide-react";
import { DELIVERY_PRESETS, VoiceProviderCapabilities } from "@/lib/ai-studio/voice/capabilities";

interface VoiceProfileRow {
  id: string;
  name: string;
  provider: string;
  externalVoiceId: string;
  language: string;
  gender: string | null;
  tone: string | null;
  isCloned: boolean;
  consentStatus: string;
  isActive: boolean;
}

interface ProviderWithStatus extends VoiceProviderCapabilities {
  configured: boolean;
}

interface SegmentRow {
  id: string;
  orderIndex: number;
  text: string;
  pauseAfterMs: number;
  speed: number;
  volume: number;
  fadeInMs: number;
  fadeOutMs: number;
  durationMs: number | null;
  audioUrl: string | null;
  status: string;
  errorMessage: string | null;
}

interface VoiceoverRow {
  id: string;
  title: string;
  preset: string;
  provider: string;
  model: string;
  format: string;
  totalDurationMs: number;
  exportedAssetId: string | null;
  segments: SegmentRow[];
}

interface PronunciationRow {
  id: string;
  term: string;
  phonetic: string;
  category: string;
  language: string;
}

export function VoiceStudioTab({
  projectId,
  activeScriptText,
  activeScriptId,
}: {
  projectId: string;
  activeScriptText?: string;
  activeScriptId?: string;
}) {
  const [profiles, setProfiles] = useState<VoiceProfileRow[]>([]);
  const [providers, setProviders] = useState<ProviderWithStatus[]>([]);
  const [voiceovers, setVoiceovers] = useState<VoiceoverRow[]>([]);
  const [rules, setRules] = useState<PronunciationRow[]>([]);

  const [selectedProvider, setSelectedProvider] = useState("OPENAI");
  const [selectedModel, setSelectedModel] = useState("tts-1");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [preset, setPreset] = useState("EDUCATIONAL");
  const [format, setFormat] = useState<"mp3" | "wav">("mp3");
  const [voTitle, setVoTitle] = useState("Main Narration");
  const [rawText, setRawText] = useState("");

  // Provider-specific delivery controls (rendered ONLY if provider supports them)
  const [stability, setStability] = useState(0.5);
  const [styleExaggeration, setStyleExaggeration] = useState(0);
  const [pitch, setPitch] = useState(0);

  // Pronunciation form
  const [term, setTerm] = useState("");
  const [phonetic, setPhonetic] = useState("");
  const [ruleCat, setRuleCat] = useState("CHEMISTRY");

  const [selectedSegId, setSelectedSegId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadAll = async () => {
    const [pRes, vRes, rRes] = await Promise.all([
      fetch("/api/team/content-studio/voice/profiles"),
      fetch(`/api/team/content-studio/projects/${projectId}/voice`),
      fetch("/api/team/content-studio/voice/pronunciations"),
    ]);
    const [pJson, vJson, rJson] = await Promise.all([pRes.json(), vRes.json(), rRes.json()]);
    if (pJson.success) {
      setProfiles(pJson.data.profiles || []);
      setProviders(pJson.data.providers || []);
      if (!selectedProfileId && pJson.data.profiles?.[0]) {
        setSelectedProfileId(pJson.data.profiles[0].id);
      }
    }
    if (vJson.success) setVoiceovers(vJson.data.voiceovers || []);
    if (rJson.success) setRules(rJson.data.rules || []);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const activeCap = providers.find((p) => p.provider === selectedProvider);
  const currentVo = voiceovers[0];

  const handleCreateVoiceover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) return;
    setBusy("create");
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/team/content-studio/projects/${projectId}/voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: voTitle,
          scriptId: activeScriptId,
          preset,
          provider: selectedProvider,
          model: selectedModel,
          voiceProfileId: selectedProfileId || undefined,
          format,
          rawText,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to create voiceover");
      setMsg("Created voiceover segments. Generate individual segments or all below.");
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create voiceover");
    } finally {
      setBusy(null);
    }
  };

  const handleGenerate = async (voiceoverId: string, segmentId?: string) => {
    setBusy(segmentId || "all");
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/team/content-studio/projects/${projectId}/voice/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceoverId,
          ...(segmentId ? { segmentId } : {}),
          ...(activeCap?.supportsStability ? { stability } : {}),
          ...(activeCap?.supportsStyleExaggeration ? { styleExaggeration } : {}),
          ...(activeCap?.supportsPitch ? { pitch } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Voice generation failed");
      setMsg(segmentId ? "Segment generated." : "All pending segments generated.");
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Voice generation failed");
    } finally {
      setBusy(null);
    }
  };

  const handleSegmentAction = async (
    action: "UPDATE_SEGMENT" | "DELETE_SEGMENT" | "REORDER_SEGMENTS" | "MERGE_SEGMENTS" | "EXPORT_ALL",
    payload: Record<string, unknown>
  ) => {
    if (!currentVo) return;
    setBusy(action);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/team/content-studio/projects/${projectId}/voice`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, voiceoverId: currentVo.id, ...payload }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Action failed");
      if (action === "EXPORT_ALL") {
        setMsg(`Exported final audio to Project Assets (${json.data.exportedAsset?.title}).`);
      }
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!term.trim() || !phonetic.trim()) return;
    const res = await fetch("/api/team/content-studio/voice/pronunciations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ term, phonetic, category: ruleCat }),
    });
    if (res.ok) {
      setTerm("");
      setPhonetic("");
      await loadAll();
    }
  };

  return (
    <div className="space-y-6">
      {msg && <div className="rounded-lg bg-tertiary-fixed px-4 py-2 text-sm text-on-tertiary-fixed">{msg}</div>}
      {err && <div className="rounded-lg bg-error-container px-4 py-2 text-sm text-on-error-container">{err}</div>}

      {/* Setup Form */}
      <form onSubmit={handleCreateVoiceover} className="rounded-xl border border-outline-variant/60 bg-surface p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-on-surface flex items-center gap-2">
            <Mic className="h-4 w-4 text-primary" /> Voice Studio Setup
          </h2>
          {activeScriptText && (
            <button
              type="button"
              onClick={() => setRawText(activeScriptText)}
              className="rounded-lg border border-primary/40 bg-primary-fixed/40 px-3 py-1 text-xs font-semibold text-on-primary-fixed"
            >
              Load Active Project Script
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
          <input
            type="text"
            required
            value={voTitle}
            onChange={(e) => setVoTitle(e.target.value)}
            placeholder="Voiceover Title"
            className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-xs"
          />
          <select
            value={selectedProvider}
            onChange={(e) => {
              const p = providers.find((pr) => pr.provider === e.target.value);
              setSelectedProvider(e.target.value);
              if (p?.models[0]) setSelectedModel(p.models[0].id);
              if (p?.formats[0]) setFormat(p.formats[0]);
            }}
            className="rounded-lg border border-outline-variant bg-surface px-2 py-2 text-xs"
          >
            {providers.map((p) => (
              <option key={p.provider} value={p.provider}>
                {p.label} {p.configured ? "✓" : "(Env Missing)"}
              </option>
            ))}
          </select>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="rounded-lg border border-outline-variant bg-surface px-2 py-2 text-xs"
          >
            {(activeCap?.models || []).map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          <select
            value={selectedProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value)}
            className="rounded-lg border border-outline-variant bg-surface px-2 py-2 text-xs"
          >
            {profiles
              .filter((pr) => pr.isActive && pr.provider === selectedProvider)
              .map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.name} ({pr.gender || pr.language})
                </option>
              ))}
          </select>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            className="rounded-lg border border-outline-variant bg-surface px-2 py-2 text-xs"
          >
            {DELIVERY_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Capability-gated Delivery Controls */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div>
            <label className="text-on-surface-variant mr-2">Format:</label>
            <select value={format} onChange={(e) => setFormat(e.target.value as "mp3" | "wav")} className="rounded border border-outline-variant px-2 py-1">
              {(activeCap?.formats || ["mp3"]).map((f) => (
                <option key={f} value={f}>{f.toUpperCase()}</option>
              ))}
            </select>
          </div>
          {activeCap?.supportsStability && (
            <label className="flex items-center gap-2">
              Stability ({stability}):
              <input type="range" min="0" max="1" step="0.05" value={stability} onChange={(e) => setStability(Number(e.target.value))} />
            </label>
          )}
          {activeCap?.supportsStyleExaggeration && (
            <label className="flex items-center gap-2">
              Style ({styleExaggeration}):
              <input type="range" min="0" max="1" step="0.05" value={styleExaggeration} onChange={(e) => setStyleExaggeration(Number(e.target.value))} />
            </label>
          )}
          {activeCap?.supportsPitch && (
            <label className="flex items-center gap-2">
              Pitch ({pitch}):
              <input type="range" min="-1" max="1" step="0.1" value={pitch} onChange={(e) => setPitch(Number(e.target.value))} />
            </label>
          )}
        </div>

        <textarea
          rows={4}
          required
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Paste Hindi, English, or Hinglish narration text here (paragraphs become segments)..."
          className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm"
        />

        <button type="submit" disabled={Boolean(busy)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50">
          <Plus className="h-4 w-4" /> Create Segmented Voiceover
        </button>
      </form>

      {/* Active Voiceover Timeline & Segments */}
      {currentVo && (
        <div className="rounded-xl border border-outline-variant/60 bg-surface p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-on-surface">{currentVo.title}</h3>
              <p className="text-xs text-on-surface-variant">
                {currentVo.provider} · {currentVo.model} · {currentVo.preset} · Total ~{(currentVo.totalDurationMs / 1000).toFixed(1)}s
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleGenerate(currentVo.id)}
                disabled={Boolean(busy)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary"
              >
                <Sparkles className="h-3.5 w-3.5" /> {busy === "all" ? "Synthesizing..." : "Generate Pending Segments"}
              </button>
              <button
                onClick={() => handleSegmentAction("EXPORT_ALL", {})}
                disabled={Boolean(busy)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-tertiary px-3 py-1.5 text-xs font-semibold text-on-tertiary"
              >
                <Download className="h-3.5 w-3.5" /> Export Final {currentVo.format.toUpperCase()}
              </button>
            </div>
          </div>

          {/* Visual Voice Timeline */}
          <div className="rounded-lg bg-surface-container p-3">
            <div className="text-[11px] font-semibold text-on-surface-variant mb-2">Voice Timeline</div>
            <div className="flex gap-1 overflow-x-auto pb-1">
              {currentVo.segments.map((seg) => (
                <button
                  key={seg.id}
                  onClick={() => setSelectedSegId(seg.id)}
                  className={`min-w-[90px] rounded px-2 py-1.5 text-left text-[10px] border transition ${
                    selectedSegId === seg.id
                      ? "border-primary bg-primary-fixed text-on-primary-fixed"
                      : seg.status === "READY"
                        ? "border-tertiary/40 bg-tertiary-fixed/40 text-on-surface"
                        : "border-outline-variant bg-surface text-on-surface-variant"
                  }`}
                >
                  <div className="font-bold">Seg {seg.orderIndex}</div>
                  <div>{seg.durationMs ? `${(seg.durationMs / 1000).toFixed(1)}s` : seg.status}</div>
                  <div className="text-[9px] opacity-75">+{seg.pauseAfterMs}ms pause</div>
                </button>
              ))}
            </div>
          </div>

          {/* Segment Cards */}
          <div className="space-y-3">
            {currentVo.segments.map((seg, idx) => (
              <div key={seg.id} className="rounded-lg border border-outline-variant/60 bg-surface-container-low p-3 text-xs space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-primary">
                    Segment {seg.orderIndex} · {seg.status}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleGenerate(currentVo.id, seg.id)}
                      disabled={Boolean(busy)}
                      className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-[11px] font-semibold text-on-primary"
                    >
                      {seg.status === "READY" ? <RotateCcw className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      {busy === seg.id ? "Working..." : seg.status === "READY" ? "Regenerate" : "Generate"}
                    </button>
                    {idx > 0 && (
                      <button
                        onClick={() => {
                          const ids = currentVo.segments.map((s) => s.id);
                          const a = ids[idx];
                          const b = ids[idx - 1];
                          if (a && b) {
                            ids[idx] = b;
                            ids[idx - 1] = a;
                            handleSegmentAction("REORDER_SEGMENTS", { orderedIds: ids });
                          }
                        }}
                        className="p-1 rounded hover:bg-surface"
                        title="Move Up"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {idx < currentVo.segments.length - 1 && (
                      <>
                        <button
                          onClick={() => {
                            const ids = currentVo.segments.map((s) => s.id);
                            const a = ids[idx];
                            const b = ids[idx + 1];
                            if (a && b) {
                              ids[idx] = b;
                              ids[idx + 1] = a;
                              handleSegmentAction("REORDER_SEGMENTS", { orderedIds: ids });
                            }
                          }}
                          className="p-1 rounded hover:bg-surface"
                          title="Move Down"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            handleSegmentAction("MERGE_SEGMENTS", {
                              segmentId: seg.id,
                              mergeWithSegmentId: currentVo.segments[idx + 1]?.id,
                            })
                          }
                          className="p-1 rounded hover:bg-surface"
                          title="Merge with next"
                        >
                          <GitMerge className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleSegmentAction("DELETE_SEGMENT", { segmentId: seg.id })}
                      className="p-1 text-error rounded hover:bg-error-container"
                      title="Delete segment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-on-surface whitespace-pre-wrap">{seg.text}</p>
                {seg.errorMessage && <p className="text-error">{seg.errorMessage}</p>}

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <label className="flex items-center gap-1">
                    Speed:
                    <input
                      type="number"
                      step="0.05"
                      min="0.5"
                      max="2"
                      defaultValue={seg.speed}
                      onBlur={(e) =>
                        handleSegmentAction("UPDATE_SEGMENT", {
                          segmentId: seg.id,
                          patch: { speed: Number(e.target.value) },
                        })
                      }
                      className="w-14 rounded border border-outline-variant bg-surface px-1 py-0.5"
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    Pause (ms):
                    <input
                      type="number"
                      step="100"
                      defaultValue={seg.pauseAfterMs}
                      onBlur={(e) =>
                        handleSegmentAction("UPDATE_SEGMENT", {
                          segmentId: seg.id,
                          patch: { pauseAfterMs: Number(e.target.value) },
                        })
                      }
                      className="w-16 rounded border border-outline-variant bg-surface px-1 py-0.5"
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    Volume:
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="2"
                      defaultValue={seg.volume}
                      onBlur={(e) =>
                        handleSegmentAction("UPDATE_SEGMENT", {
                          segmentId: seg.id,
                          patch: { volume: Number(e.target.value) },
                        })
                      }
                      className="w-14 rounded border border-outline-variant bg-surface px-1 py-0.5"
                    />
                  </label>
                </div>

                {seg.audioUrl && (
                  <div className="flex items-center gap-3 pt-1">
                    <audio controls src={seg.audioUrl} className="h-8 flex-1" />
                    <a href={seg.audioUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      Download
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pronunciation Dictionary */}
      <div className="rounded-xl border border-outline-variant/60 bg-surface p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
          <BookOpen className="h-4 w-4 text-secondary" /> Pronunciation Dictionary (Chemistry, Biology, Physics, NEET, Hinglish)
        </div>
        <form onSubmit={handleAddRule} className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <input type="text" required value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Term (e.g. IUPAC)" className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-xs" />
          <input type="text" required value={phonetic} onChange={(e) => setPhonetic(e.target.value)} placeholder="Spoken form (e.g. I-U-pack)" className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-xs" />
          <select value={ruleCat} onChange={(e) => setRuleCat(e.target.value)} className="rounded-lg border border-outline-variant bg-surface px-2 py-1.5 text-xs">
            <option value="CHEMISTRY">Chemistry</option>
            <option value="BIOLOGY">Biology</option>
            <option value="PHYSICS">Physics</option>
            <option value="NEET">NEET</option>
            <option value="ENGLISH_IN_HINDI">English in Hindi</option>
          </select>
          <button type="submit" className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-on-secondary">
            Add Rule
          </button>
        </form>
        {rules.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {rules.map((r) => (
              <span key={r.id} className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-2.5 py-1 text-[11px]">
                <strong>{r.term}</strong> → {r.phonetic} ({r.category})
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
