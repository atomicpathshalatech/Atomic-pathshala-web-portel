"use client";

import { useState } from "react";

type SolutionStep = {
  stepNumber: number;
  title: string;
  description: string;
};

type AiSolution = {
  concept: string;
  stepByStep: SolutionStep[];
  keyTakeaway: string;
  recommendedLectureTopic: string;
};

export function AiDoubtSolver({ subject }: { subject?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [loading, setLoading] = useState(false);
  const [solution, setSolution] = useState<AiSolution | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSolve() {
    if (!questionText.trim()) return;
    setLoading(true);
    setError(null);
    setSolution(null);
    try {
      const res = await fetch("/api/doubts/ai-solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionText, subject }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Could not generate solution.");
        return;
      }
      setSolution(data.data.solution);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-card rounded-2xl p-6 border-2 border-primary/20 space-y-4 relative overflow-hidden bg-gradient-to-br from-primary/5 via-surface to-surface">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-md">
            <span className="material-symbols-outlined text-2xl">auto_awesome</span>
          </div>
          <div>
            <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
              Atomic AI Tutor
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold uppercase tracking-wider">
                Instant
              </span>
            </h3>
            <p className="text-xs text-on-surface-variant">
              Get an instant step-by-step conceptual breakdown before asking human faculty.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className="px-4 py-2 bg-primary text-on-primary text-xs font-semibold rounded-xl hover:opacity-90 transition-all shrink-0 self-start sm:self-auto"
        >
          {isOpen ? "Close AI Assistant" : "Ask AI Assistant"}
        </button>
      </div>

      {isOpen && (
        <div className="space-y-4 pt-2 border-t border-outline-variant/20">
          <div className="space-y-2">
            <textarea
              rows={3}
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Paste your question, math equation, or concept query here..."
              className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3 text-body-sm text-on-surface outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={loading || !questionText.trim()}
                onClick={handleSolve}
                className="bg-primary text-on-primary text-xs font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">
                  {loading ? "progress_activity" : "psychology"}
                </span>
                {loading ? "Analyzing Problem..." : "Solve with AI"}
              </button>
            </div>
          </div>

          {error && <div className="text-xs text-error bg-error/10 p-3 rounded-xl">{error}</div>}

          {solution && (
            <div className="space-y-3 bg-surface-container-lowest p-4 rounded-xl border border-primary/20">
              <div className="flex items-center gap-2 text-xs font-bold text-primary">
                <span className="material-symbols-outlined text-base">lightbulb</span>
                <span>{solution.concept}</span>
              </div>

              <div className="space-y-2.5">
                {solution.stepByStep.map((step) => (
                  <div key={step.stepNumber} className="text-xs space-y-1 pl-3 border-l-2 border-primary/40">
                    <p className="font-bold text-on-surface">
                      Step {step.stepNumber}: {step.title}
                    </p>
                    <p className="text-on-surface-variant leading-relaxed">{step.description}</p>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-outline-variant/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                <span className="text-on-surface-variant">
                  💡 <b>Key Tip:</b> {solution.keyTakeaway}
                </span>
                <span className="text-primary font-semibold shrink-0">
                  Recommended: {solution.recommendedLectureTopic}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
