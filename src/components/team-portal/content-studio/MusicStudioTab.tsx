"use client";

import React, { useEffect, useState } from "react";
import { Music, Sparkles, Sliders, Download, Volume2, ShieldAlert } from "lucide-react";
import {
  MUSIC_PRESETS,
  MUSIC_STRUCTURES,
  MusicProviderCapabilities,
  SFX_CATEGORIES,
} from "@/lib/ai-studio/music/capabilities";
import { mixAndDuckAudioToWav } from "@/lib/ai-studio/music/browser-mixer";

interface ProviderWithStatus extends MusicProviderCapabilities {
  configured: boolean;
}

interface MusicGenRow {
  id: string;
  kind: string;
  prompt: string;
  preset: string | null;
  mood: string | null;
  durationSec: number;
  variationIndex: number;
  provider: string;
  status: string;
  licenseType: string | null;
  licenseTermsUrl: string | null;
  audioUrl: string | null;
}

interface AudioAssetRow {
  id: string;
  title: string | null;
  assetType: string;
  publicUrl: string | null;
}

export function MusicStudioTab({ projectId }: { projectId: string }) {
  const [providers, setProviders] = useState<ProviderWithStatus[]>([]);
  const [generations, setGenerations] = useState<MusicGenRow[]>([]);
  const [audioAssets, setAudioAssets] = useState<AudioAssetRow[]>([]);

  const [provider, setProvider] = useState("ELEVENLABS_MUSIC");
  const [kind, setKind] = useState<"MUSIC" | "SFX">("MUSIC");
  const [preset, setPreset] = useState("Motivational");
  const [prompt, setPrompt] = useState("");
  const [mood, setMood] = useState("Inspiring");
  const [structureNotes, setStructureNotes] = useState("Calm opening -> Gradual build -> Powerful climax -> Outro");
  const [durationSec, setDurationSec] = useState(15);
  const [variations, setVariations] = useState(1);
  const [loopable, setLoopable] = useState(false);

  // Voice + Music Mixer & Ducking
  const [voiceAssetId, setVoiceAssetId] = useState("");
  const [musicAssetId, setMusicAssetId] = useState("");
  const [voiceVolume, setVoiceVolume] = useState(1.0);
  const [musicDuringSpeech, setMusicDuringSpeech] = useState(0.2);
  const [musicDuringPause, setMusicDuringPause] = useState(0.75);
  const [duckingFadeMs, setDuckingFadeMs] = useState(250);
  const [duckingRecoveryMs, setDuckingRecoveryMs] = useState(600);
  const [manualOverride, setManualOverride] = useState(false);
  const [loopMusic, setLoopMusic] = useState(true);
  const [mixedPreviewUrl, setMixedPreviewUrl] = useState<string | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadData = async () => {
    const res = await fetch(`/api/team/content-studio/projects/${projectId}/music`);
    const json = await res.json();
    if (json.success) {
      setProviders(json.data.providers || []);
      setGenerations(json.data.generations || []);
      setAudioAssets(json.data.audioAssets || []);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setBusy("generate");
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/team/content-studio/projects/${projectId}/music`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          kind,
          preset,
          prompt,
          mood,
          structureNotes,
          durationSec: Number(durationSec),
          variations: Number(variations),
          loopable,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Music generation failed");
      setMsg(`Generated ${json.data.generations?.length || 1} ${kind} track(s).`);
      await loadData();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Music generation failed");
    } finally {
      setBusy(null);
    }
  };

  const handleMixAndExport = async (saveToR2: boolean) => {
    setBusy("mix");
    setErr(null);
    setMsg(null);
    try {
      const voiceUrl = audioAssets.find((a) => a.id === voiceAssetId)?.publicUrl || null;
      const musicUrl = audioAssets.find((a) => a.id === musicAssetId)?.publicUrl || null;

      const wavBlob = await mixAndDuckAudioToWav({
        voiceUrl,
        musicUrl,
        voiceVolume,
        musicVolumeDuringSpeech: musicDuringSpeech,
        musicVolumeDuringPause: musicDuringPause,
        duckingFadeMs,
        duckingRecoveryMs,
        manualOverride,
        fadeInMs: 500,
        fadeOutMs: 1000,
        loopMusic,
      });

      const url = URL.createObjectURL(wavBlob);
      setMixedPreviewUrl(url);

      if (saveToR2) {
        const form = new FormData();
        form.append("file", new File([wavBlob], `mix-${Date.now()}.wav`, { type: "audio/wav" }));
        form.append("assetType", "AUDIO");
        form.append("projectId", projectId);
        form.append("title", "Voice + Music Ducked Mix");

        const upRes = await fetch("/api/team/content-studio/assets", { method: "POST", body: form });
        const upJson = await upRes.json();
        if (!upRes.ok || !upJson.success) throw new Error(upJson.error || "Failed to save mix");

        await fetch(`/api/team/content-studio/projects/${projectId}/music`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            voiceAssetId: voiceAssetId || null,
            musicAssetId: musicAssetId || null,
            voiceVolume,
            musicVolumeDuringSpeech: musicDuringSpeech,
            musicVolumeDuringPause: musicDuringPause,
            duckingFadeMs,
            duckingRecoveryMs,
            manualOverride,
            loopMusic,
            exportedAssetId: upJson.data.asset?.id || null,
          }),
        });
        setMsg("Rendered ducked mix and saved to Project Assets.");
        await loadData();
      } else {
        setMsg("Mixed preview ready below.");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Audio mixing failed");
    } finally {
      setBusy(null);
    }
  };

  const voiceAssets = audioAssets.filter((a) => a.assetType === "VOICEOVER" || a.assetType === "AUDIO");
  const musicAssets = audioAssets.filter((a) => a.assetType === "MUSIC" || a.assetType === "SFX" || a.assetType === "AUDIO");

  return (
    <div className="space-y-6">
      {msg && <div className="rounded-lg bg-tertiary-fixed px-4 py-2 text-sm text-on-tertiary-fixed">{msg}</div>}
      {err && <div className="rounded-lg bg-error-container px-4 py-2 text-sm text-on-error-container">{err}</div>}

      {/* Generator */}
      <form onSubmit={handleGenerate} className="rounded-xl border border-outline-variant/60 bg-surface p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-on-surface flex items-center gap-2">
            <Music className="h-4 w-4 text-primary" /> Music & Sound Effects Generator
          </h2>
          <div className="flex gap-1.5 text-xs">
            <button type="button" onClick={() => setKind("MUSIC")} className={`rounded-lg px-3 py-1 font-semibold ${kind === "MUSIC" ? "bg-primary text-on-primary" : "bg-surface-container"}`}>
              Music Track
            </button>
            <button type="button" onClick={() => setKind("SFX")} className={`rounded-lg px-3 py-1 font-semibold ${kind === "SFX" ? "bg-primary text-on-primary" : "bg-surface-container"}`}>
              Sound Effects (SFX)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <select value={provider} onChange={(e) => setProvider(e.target.value)} className="rounded-lg border border-outline-variant bg-surface px-2 py-2 text-xs">
            {providers.map((p) => (
              <option key={p.provider} value={p.provider}>
                {p.label} {p.configured ? "✓" : "(Env Missing)"}
              </option>
            ))}
          </select>
          <select value={preset} onChange={(e) => setPreset(e.target.value)} className="rounded-lg border border-outline-variant bg-surface px-2 py-2 text-xs">
            {(kind === "MUSIC" ? MUSIC_PRESETS : SFX_CATEGORIES).map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <input type="number" min={2} max={120} value={durationSec} onChange={(e) => setDurationSec(Number(e.target.value))} placeholder="Duration (sec)" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-xs" />
          <select value={variations} onChange={(e) => setVariations(Number(e.target.value))} className="rounded-lg border border-outline-variant bg-surface px-2 py-2 text-xs">
            <option value={1}>1 Variation</option>
            <option value={2}>2 Variations</option>
            <option value={3}>3 Variations</option>
          </select>
        </div>

        {kind === "MUSIC" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input type="text" value={mood} onChange={(e) => setMood(e.target.value)} placeholder="Mood (e.g. Inspiring, Focused)" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-xs" />
            <input type="text" value={structureNotes} onChange={(e) => setStructureNotes(e.target.value)} placeholder={`Structure (${MUSIC_STRUCTURES.join(" -> ")})`} className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-xs" />
          </div>
        )}

        <textarea
          rows={2}
          required
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={kind === "MUSIC" ? "Describe the background music (instruments, tempo, mood)..." : "Describe the SFX (e.g. crisp cinematic whoosh transition)..."}
          className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={loopable} onChange={(e) => setLoopable(e.target.checked)} />
            Seamless Loop
          </label>
          <button type="submit" disabled={Boolean(busy)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50">
            <Sparkles className="h-4 w-4" /> {busy === "generate" ? "Generating..." : `Generate ${kind}`}
          </button>
        </div>
      </form>

      {/* Generated Tracks & Licensing */}
      {generations.length > 0 && (
        <div className="rounded-xl border border-outline-variant/60 bg-surface p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-semibold text-on-surface">Generated Music & SFX ({generations.length})</h3>
          <div className="space-y-2.5">
            {generations.map((g) => (
              <div key={g.id} className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-3 text-xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-on-surface">
                    [{g.kind}] {g.preset || "Track"} v{g.variationIndex} · {g.durationSec}s · {g.provider}
                  </span>
                  {g.licenseType && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-on-surface-variant">
                      <ShieldAlert className="h-3 w-3" /> {g.licenseType}
                    </span>
                  )}
                </div>
                {g.audioUrl && (
                  <div className="flex items-center gap-3">
                    <audio controls src={g.audioUrl} className="h-8 flex-1" />
                    <a href={g.audioUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      <Download className="h-3.5 w-3.5" /> Download
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Voice + Music Mixer with Real Audio Ducking */}
      <div className="rounded-xl border border-outline-variant/60 bg-surface p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-base font-semibold text-on-surface">
          <Sliders className="h-4 w-4 text-secondary" /> Voice + Music Mixer & Auto-Ducking (Web Audio)
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">Voiceover Track</label>
            <select value={voiceAssetId} onChange={(e) => setVoiceAssetId(e.target.value)} className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-xs">
              <option value="">None</option>
              {voiceAssets.map((a) => (
                <option key={a.id} value={a.id}>{a.title || a.id}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">Background Music / SFX Track</label>
            <select value={musicAssetId} onChange={(e) => setMusicAssetId(e.target.value)} className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-xs">
              <option value="">None</option>
              {musicAssets.map((a) => (
                <option key={a.id} value={a.id}>{a.title || a.id}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 text-xs">
          <label className="space-y-1">
            <span>Voice Vol ({voiceVolume})</span>
            <input type="range" min="0" max="2" step="0.05" value={voiceVolume} onChange={(e) => setVoiceVolume(Number(e.target.value))} className="w-full" />
          </label>
          <label className="space-y-1">
            <span>Music During Speech ({musicDuringSpeech})</span>
            <input type="range" min="0" max="1" step="0.05" value={musicDuringSpeech} onChange={(e) => setMusicDuringSpeech(Number(e.target.value))} className="w-full" />
          </label>
          <label className="space-y-1">
            <span>Music During Pause ({musicDuringPause})</span>
            <input type="range" min="0" max="1" step="0.05" value={musicDuringPause} onChange={(e) => setMusicDuringPause(Number(e.target.value))} className="w-full" />
          </label>
          <label className="space-y-1">
            <span>Duck Fade (ms)</span>
            <input type="number" value={duckingFadeMs} onChange={(e) => setDuckingFadeMs(Number(e.target.value))} className="w-full rounded border border-outline-variant px-2 py-1" />
          </label>
          <label className="space-y-1">
            <span>Recovery (ms)</span>
            <input type="number" value={duckingRecoveryMs} onChange={(e) => setDuckingRecoveryMs(Number(e.target.value))} className="w-full rounded border border-outline-variant px-2 py-1" />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={loopMusic} onChange={(e) => setLoopMusic(e.target.checked)} />
            Loop Music to Match Voiceover
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={manualOverride} onChange={(e) => setManualOverride(e.target.checked)} />
            Manual Override (Disable Auto-Ducking)
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => handleMixAndExport(false)} disabled={Boolean(busy)} className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-semibold">
            <Volume2 className="h-3.5 w-3.5" /> {busy === "mix" ? "Mixing..." : "Preview Ducked Mix"}
          </button>
          <button type="button" onClick={() => handleMixAndExport(true)} disabled={Boolean(busy)} className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-on-secondary">
            <Download className="h-3.5 w-3.5" /> Render & Save WAV to Assets
          </button>
        </div>

        {mixedPreviewUrl && <audio controls src={mixedPreviewUrl} className="w-full h-9" />}
      </div>
    </div>
  );
}
