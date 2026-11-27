"use client";

import React, { useEffect, useState } from "react";
import { Sparkles, RefreshCw } from "lucide-react";

const FORMATS = [
  "LONG_FORM_YOUTUBE",
  "YOUTUBE_SHORT",
  "INSTAGRAM_REEL",
  "MOTIVATIONAL_VIDEO",
  "LECTURE",
  "REVISION_VIDEO",
  "ONE_SHOT",
  "PYQ_DISCUSSION",
  "BATCH_LAUNCH",
  "PROMOTIONAL_VIDEO",
  "CINEMATIC_TRAILER",
  "LIVE_SESSION_PROMO",
];

interface PlanRecord {
  id: string;
  version: number;
  topic: string;
  contentFormat: string;
  language: string;
  medium: string;
  providerUsed: string | null;
  modelUsed: string | null;
  planData: Record<string, unknown>;
  createdAt: string;
}

export function PlanTab({
  projectId,
  defaultTopic,
  defaultSubject,
  defaultChapter,
}: {
  projectId: string;
  defaultTopic?: string | null;
  defaultSubject?: string | null;
  defaultChapter?: string | null;
}) {
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [topic, setTopic] = useState(defaultTopic || "");
  const [subject, setSubject] = useState(defaultSubject || "");
  const [chapter, setChapter] = useState(defaultChapter || "");
  const [examTrack, setExamTrack] = useState("NEET");
  const [classLevel, setClassLevel] = useState("Class 12");
  const [language, setLanguage] = useState("hinglish");
  const [medium, setMedium] = useState("BILINGUAL");
  const [contentFormat, setContentFormat] = useState("LONG_FORM_YOUTUBE");
  const [targetDurationSec, setTargetDurationSec] = useState(600);
  const [teacherName, setTeacherName] = useState("");
  const [tone, setTone] = useState("EDUCATIONAL");
  const [referenceMaterials, setReferenceMaterials] = useState("");

  const loadPlans = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/team/content-studio/projects/${projectId}/plan`);
      const json = await res.json();
      if (json.success) setPlans(json.data.plans || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setGenerating(true);
    setErr(null);
    try {
      const res = await fetch(`/api/team/content-studio/projects/${projectId}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          subject: subject || undefined,
          chapter: chapter || undefined,
          examTrack,
          classLevel,
          language,
          medium,
          contentFormat,
          targetDurationSec: Number(targetDurationSec),
          teacherName: teacherName || undefined,
          tone,
          referenceMaterials: referenceMaterials || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Plan generation failed");
      await loadPlans();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Plan generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const activePlan = plans[0];

  return (
    <div className="space-y-6">
      {err && <div className="rounded-lg bg-error-container px-4 py-2 text-sm text-on-error-container">{err}</div>}

      <form onSubmit={handleGenerate} className="rounded-xl border border-outline-variant/60 bg-surface p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-on-surface">AI Content Plan Generator</h2>
          <button type="button" onClick={loadPlans} className="text-xs text-primary inline-flex items-center gap-1">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="block text-xs text-on-surface-variant mb-1">Topic *</label>
            <input
              type="text"
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Chemical Bonding & Hybridization Tricks"
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">Subject</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">Chapter</label>
            <input type="text" value={chapter} onChange={(e) => setChapter(e.target.value)} className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">Exam</label>
            <select value={examTrack} onChange={(e) => setExamTrack(e.target.value)} className="w-full rounded-lg border border-outline-variant bg-surface px-2 py-2 text-xs">
              <option value="NEET">NEET</option>
              <option value="JEE">JEE</option>
              <option value="BOARDS">Boards</option>
              <option value="GENERAL">General</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">Class</label>
            <input type="text" value={classLevel} onChange={(e) => setClassLevel(e.target.value)} className="w-full rounded-lg border border-outline-variant bg-surface px-2 py-2 text-xs" />
          </div>
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full rounded-lg border border-outline-variant bg-surface px-2 py-2 text-xs">
              <option value="hinglish">Hinglish</option>
              <option value="hindi">Hindi</option>
              <option value="english">English</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">Medium</label>
            <select value={medium} onChange={(e) => setMedium(e.target.value)} className="w-full rounded-lg border border-outline-variant bg-surface px-2 py-2 text-xs">
              <option value="BILINGUAL">Bilingual</option>
              <option value="HINDI_MEDIUM">Hindi Medium</option>
              <option value="ENGLISH_MEDIUM">English Medium</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">Format</label>
            <select value={contentFormat} onChange={(e) => setContentFormat(e.target.value)} className="w-full rounded-lg border border-outline-variant bg-surface px-2 py-2 text-xs">
              {FORMATS.map((f) => (
                <option key={f} value={f}>{f.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">Duration (sec)</label>
            <input type="number" value={targetDurationSec} onChange={(e) => setTargetDurationSec(Number(e.target.value))} className="w-full rounded-lg border border-outline-variant bg-surface px-2 py-2 text-xs" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input type="text" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} placeholder="Teacher / Presenter Name" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-xs" />
          <input type="text" value={tone} onChange={(e) => setTone(e.target.value)} placeholder="Tone (e.g. Energetic, Teacher-style)" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-xs" />
          <input type="text" value={referenceMaterials} onChange={(e) => setReferenceMaterials(e.target.value)} placeholder="Reference materials / NCERT chapters (optional)" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-xs" />
        </div>

        <button type="submit" disabled={generating} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50">
          <Sparkles className="h-4 w-4" /> {generating ? "Generating 17-Part Plan..." : "Generate Production Plan"}
        </button>
      </form>

      {activePlan && (
        <div className="rounded-xl border border-outline-variant/60 bg-surface p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-outline-variant/40 pb-3">
            <div>
              <h3 className="text-base font-bold text-on-surface">
                Production Plan v{activePlan.version}: {activePlan.topic}
              </h3>
              <p className="text-xs text-on-surface-variant">
                {activePlan.contentFormat} · {activePlan.language} · Generated via {activePlan.providerUsed || "AI"} ({activePlan.modelUsed || ""})
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {Object.entries(activePlan.planData || {}).map(([key, val]) => (
              <div key={key} className="rounded-lg bg-surface-container-low p-3 text-xs">
                <div className="font-semibold text-primary capitalize mb-1">
                  {key.replace(/([A-Z])/g, " $1")}
                </div>
                <div className="text-on-surface whitespace-pre-wrap">
                  {typeof val === "string" ? val : JSON.stringify(val, null, 2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
