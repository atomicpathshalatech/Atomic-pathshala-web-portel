"use client";

import { useState } from "react";

type NEETPredictionData = {
  rawScore: number;
  maxMarks: number;
  neetEquivalentScore: number;
  isNormalized: boolean;
  estimatedAIR: number;
  minAIR: number;
  maxAIR: number;
  confidence: "EXACT" | "HIGH" | "MEDIUM" | "LOW";
  isExactReference: boolean;
  percentile?: number | null;
  sourceDocument: string;
  sourcePage: number;
  datasetYear: number;
  disclaimer: string;
  categoryPrediction?: {
    category: string;
    isExact: boolean;
    estimatedCategoryRank?: number | null;
    minCategoryRank?: number | null;
    maxCategoryRank?: number | null;
    statusText: string;
    sourcePage?: number;
  };
  rank1Benchmark: {
    title: string;
    score: number;
    maxScore: number;
    gapMarks: number;
    sourcePage: number;
  };
};

type Allotment = {
  id: string;
  rank: number;
  quota: string;
  instituteName: string;
  course: string;
  allottedCategory: string;
  round: string;
};

const CATEGORIES = ["General", "OBC-NCL", "SC", "ST", "GEN-EWS"];

export function RankCollegePredictor() {
  const [tab, setTab] = useState<"rank" | "college">("rank");

  // Rank predictor state
  const [marks, setMarks] = useState("");
  const [rankCategory, setRankCategory] = useState("General");
  const [rankLoading, setRankLoading] = useState(false);
  const [prediction, setPrediction] = useState<NEETPredictionData | null>(null);

  // College predictor state
  const [rank, setRank] = useState("");
  const [collegeCategory, setCollegeCategory] = useState("General");
  const [course, setCourse] = useState("");
  const [collegeLoading, setCollegeLoading] = useState(false);
  const [collegeResult, setCollegeResult] = useState<{ available: boolean; allotments?: Allotment[] } | null>(null);

  async function predictRank(e: React.FormEvent) {
    e.preventDefault();
    setRankLoading(true);
    setPrediction(null);
    try {
      const res = await fetch(
        `/api/predictor/rank?marks=${encodeURIComponent(marks)}&category=${encodeURIComponent(rankCategory)}`
      );
      const body = await res.json();
      if (res.ok && body.success && body.data?.prediction) {
        setPrediction(body.data.prediction);
      }
    } finally {
      setRankLoading(false);
    }
  }

  async function predictCollege(e: React.FormEvent) {
    e.preventDefault();
    setCollegeLoading(true);
    setCollegeResult(null);
    try {
      const params = new URLSearchParams({ rank, category: collegeCategory });
      if (course.trim()) params.set("course", course.trim());
      const res = await fetch(`/api/predictor/college?${params.toString()}`);
      const body = await res.json();
      if (res.ok && body.success) setCollegeResult(body.data);
    } finally {
      setCollegeLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Mode Navigation Tabs */}
      <div className="flex gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm w-fit">
        <button
          type="button"
          onClick={() => setTab("rank")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            tab === "rank"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <span className="material-symbols-outlined text-sm">analytics</span>
          <span>NEET 2026 Rank Predictor</span>
        </button>
        <button
          type="button"
          onClick={() => setTab("college")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            tab === "college"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <span className="material-symbols-outlined text-sm">domain</span>
          <span>College Allotment Predictor</span>
        </button>
      </div>

      {tab === "rank" && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="space-y-1">
            <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600">insights</span>
              <span>NEET (UG)-2026 Official Rank Predictor</span>
            </h2>
            <p className="text-xs text-slate-500">
              Directly mapped against the official 15-page NTA NEET (UG)-2026 dataset
            </p>
          </div>

          <form onSubmit={predictRank} className="flex flex-wrap items-end gap-3 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Expected Marks (Out of 720)
              </label>
              <input
                type="number"
                min="0"
                max="720"
                required
                placeholder="e.g. 540"
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
                className="w-40 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2.5 px-3.5 text-sm font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Candidate Category
              </label>
              <select
                value={rankCategory}
                onChange={(e) => setRankCategory(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2.5 px-3.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={rankLoading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 transition disabled:opacity-60 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">target</span>
              <span>{rankLoading ? "Predicting..." : "Predict NEET AIR"}</span>
            </button>
          </form>

          {/* Prediction Result Display */}
          {prediction && (
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800 animate-in fade-in duration-200">
              {/* Main Estimated Rank Banner */}
              <div className="rounded-2xl p-6 bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 text-white space-y-4 shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-widest font-mono font-bold text-indigo-300">
                      Estimated NEET 2026 AIR
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        prediction.confidence === "EXACT"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                      }`}
                    >
                      {prediction.confidence === "EXACT" ? "Exact Reference Match" : "Estimated via Interpolation"}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Score: {prediction.neetEquivalentScore} / 720
                  </span>
                </div>

                <div className="flex items-baseline gap-4">
                  <div className="text-4xl sm:text-5xl font-black font-mono text-cyan-300">
                    ≈ {prediction.estimatedAIR.toLocaleString("en-IN")}
                  </div>
                  <div className="text-xs font-mono text-slate-300">
                    Estimated Range: <b>{prediction.minAIR.toLocaleString("en-IN")} – {prediction.maxAIR.toLocaleString("en-IN")}</b>
                  </div>
                </div>

                {prediction.percentile && (
                  <p className="text-xs text-indigo-200 font-mono">
                    Reference Percentile: <b>{prediction.percentile}%</b>
                  </p>
                )}

                {/* Anonymous Rank 1 Benchmark */}
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-400 text-base">military_tech</span>
                    <span><b>NEET 2026 Rank 1 Benchmark:</b> 720 / 720 marks</span>
                  </div>
                  <span className="font-mono text-amber-300 font-bold">
                    Gap: {Math.max(0, 720 - prediction.neetEquivalentScore)} marks
                  </span>
                </div>

                {/* Source Citation */}
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
                  <span className="material-symbols-outlined text-xs text-cyan-400">menu_book</span>
                  <span>
                    Source: {prediction.sourceDocument} (Page {prediction.sourcePage})
                  </span>
                </div>
              </div>

              {/* Category Rank Information Card */}
              {prediction.categoryPrediction && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 font-mono block">
                    Category Status ({prediction.categoryPrediction.category})
                  </span>
                  <p className="text-slate-700 dark:text-slate-300 font-medium">
                    {prediction.categoryPrediction.statusText}
                  </p>
                </div>
              )}

              <p className="text-[11px] text-slate-400 italic">
                *{prediction.disclaimer}
              </p>
            </div>
          )}
        </div>
      )}

      {tab === "college" && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="space-y-1">
            <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600">domain</span>
              <span>NEET Medical College Allotment Predictor</span>
            </h2>
            <p className="text-xs text-slate-500">
              Explore college allotments from previous counselling rounds based on rank
            </p>
          </div>

          <form onSubmit={predictCollege} className="flex flex-wrap items-end gap-3 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Your All India Rank (AIR)
              </label>
              <input
                type="number"
                required
                placeholder="e.g. 15000"
                value={rank}
                onChange={(e) => setRank(e.target.value)}
                className="w-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2.5 px-3.5 text-sm font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={collegeCategory}
                onChange={(e) => setCollegeCategory(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2.5 px-3.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Course (Optional)
              </label>
              <input
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder="MBBS / BDS"
                className="w-32 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2.5 px-3.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <button
              type="submit"
              disabled={collegeLoading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 transition disabled:opacity-60 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">search</span>
              <span>{collegeLoading ? "Searching..." : "Find Colleges"}</span>
            </button>
          </form>

          {collegeResult && !collegeResult.available && (
            <p className="text-xs text-slate-500">
              No historical allotment cutoffs match your filter criteria.
            </p>
          )}

          {collegeResult?.available && (
            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Plausible College Allotments
              </h3>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Institute</th>
                      <th className="p-3">Course</th>
                      <th className="p-3">Quota</th>
                      <th className="p-3 text-right">Closing Rank</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {(collegeResult.allotments ?? []).map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                        <td className="p-3 font-bold text-slate-900 dark:text-white">{a.instituteName}</td>
                        <td className="p-3 text-blue-600 dark:text-blue-400 font-mono font-bold">{a.course}</td>
                        <td className="p-3 text-slate-500">{a.quota}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          ~{a.rank.toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
