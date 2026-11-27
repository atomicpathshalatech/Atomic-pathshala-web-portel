"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, GitCompare, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";

interface CompareResult {
  provider: string;
  model: string;
  displayName: string;
  ok: boolean;
  text?: string;
  inputTokens?: number;
  outputTokens?: number;
  durationMs: number;
  costUsd: number | null;
  error?: string;
}

const PROVIDERS = [
  { id: "GEMINI", label: "Google Gemini" },
  { id: "OPENAI", label: "OpenAI / ChatGPT" },
  { id: "XAI_GROK", label: "xAI Grok" },
  { id: "GROQ", label: "Groq" },
  { id: "ANTHROPIC", label: "Anthropic Claude" },
];

export default function MultiAiComparePage() {
  const [taskType, setTaskType] = useState("SCRIPT_WRITING");
  const [prompt, setPrompt] = useState("");
  const [selectedProviders, setSelectedProviders] = useState<string[]>(["GEMINI", "OPENAI", "XAI_GROK"]);
  const [evaluateWinner, setEvaluateWinner] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<CompareResult[]>([]);
  const [evaluation, setEvaluation] = useState<{ text: string; provider: string; model: string } | null>(null);
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const toggleProvider = (id: string) => {
    setSelectedProviders((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleCompare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProviders.length < 2) {
      setErr("Select at least 2 providers to compare.");
      return;
    }
    setRunning(true);
    setErr(null);
    setResults([]);
    setEvaluation(null);
    setSelectedWinner(null);
    try {
      const res = await fetch("/api/team/content-studio/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType,
          prompt,
          providers: selectedProviders,
          evaluateWinner,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Comparison failed");
      setResults(json.data.results || []);
      setEvaluation(json.data.evaluation || null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Comparison failed");
    } finally {
      setRunning(false);
    }
  };

  const handleSelectOutput = async (r: CompareResult) => {
    if (!r.text) return;
    setSelectedWinner(r.provider);
    await fetch("/api/team/content-studio/compare", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: r.provider,
        model: r.model,
        prompt,
        selectedText: r.text,
      }),
    });
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <Link href="/team/content-studio" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Content Studio
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-on-surface">Compare Multiple AI Models</h1>
        <p className="text-sm text-on-surface-variant">
          Optional side-by-side comparison across OpenAI, Gemini, and Grok. Runs only when explicitly triggered.
        </p>
      </div>

      {err && <div className="rounded-lg bg-error-container px-4 py-2 text-sm text-on-error-container">{err}</div>}

      <form onSubmit={handleCompare} className="rounded-xl border border-outline-variant/60 bg-surface p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">Task Type</label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
            >
              <option value="RESEARCH">Research</option>
              <option value="TOPIC_ANALYSIS">Topic Analysis</option>
              <option value="SCRIPT_WRITING">Script Writing</option>
              <option value="SEO">SEO</option>
              <option value="CHEMISTRY_VERIFICATION">Chemistry Verification</option>
              <option value="THUMBNAIL_PROMPT">Thumbnail Prompt</option>
              <option value="CONTENT_PLANNING">Content Planning</option>
              <option value="SUMMARIZATION">Summarization</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">Providers to Compare</label>
            <div className="flex flex-wrap gap-2 pt-1">
              {PROVIDERS.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => toggleProvider(p.id)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                    selectedProviders.includes(p.id)
                      ? "border-primary bg-primary-fixed text-on-primary-fixed"
                      : "border-outline-variant bg-surface text-on-surface-variant"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-1">Prompt</label>
          <textarea
            rows={4}
            required
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Write a 60-second YouTube Shorts hook explaining Hybridization for NEET aspirants..."
            className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-on-surface">
            <input
              type="checkbox"
              checked={evaluateWinner}
              onChange={(e) => setEvaluateWinner(e.target.checked)}
            />
            Send outputs to a separate AI evaluator for objective ranking
          </label>
          <button
            type="submit"
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
          >
            <GitCompare className="h-4 w-4" /> {running ? "Comparing..." : "Run Comparison"}
          </button>
        </div>
      </form>

      {evaluation && (
        <div className="rounded-xl border border-tertiary/40 bg-tertiary-fixed/30 p-5 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
            <Sparkles className="h-4 w-4 text-tertiary" />
            AI Evaluator Recommendation ({evaluation.provider} · {evaluation.model})
          </div>
          <p className="text-sm text-on-surface whitespace-pre-wrap">{evaluation.text}</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {results.map((r) => (
            <div
              key={r.provider}
              className={`rounded-xl border bg-surface p-4 shadow-sm flex flex-col justify-between ${
                selectedWinner === r.provider ? "border-tertiary ring-2 ring-tertiary/30" : "border-outline-variant/60"
              }`}
            >
              <div>
                <div className="flex items-center justify-between border-b border-outline-variant/40 pb-2">
                  <div>
                    <div className="font-semibold text-sm text-on-surface">{r.displayName}</div>
                    <div className="text-[11px] text-on-surface-variant">{r.provider} · {r.model}</div>
                  </div>
                  {r.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-tertiary" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-error" />
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-on-surface-variant">
                  <span>{r.durationMs}ms</span>
                  {r.inputTokens !== undefined && <span>In: {r.inputTokens} tok</span>}
                  {r.outputTokens !== undefined && <span>Out: {r.outputTokens} tok</span>}
                  {r.costUsd !== null && <span>Est: ${r.costUsd.toFixed(5)}</span>}
                </div>
                <div className="mt-3 max-h-80 overflow-y-auto text-xs text-on-surface whitespace-pre-wrap">
                  {r.ok ? r.text : <span className="text-error">{r.error}</span>}
                </div>
              </div>

              {r.ok && (
                <button
                  onClick={() => handleSelectOutput(r)}
                  className={`mt-4 w-full rounded-lg py-1.5 text-xs font-semibold ${
                    selectedWinner === r.provider
                      ? "bg-tertiary text-on-tertiary"
                      : "bg-surface-container-high text-on-surface hover:bg-primary-fixed"
                  }`}
                >
                  {selectedWinner === r.provider ? "Preferred Output Selected" : "Select Preferred Output"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
