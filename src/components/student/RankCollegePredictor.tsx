"use client";

import { useState } from "react";

type RankPoint = { id: string; category: string; marks: number; expectedRank: number; year: number; confidence: string | null };
type Allotment = {
  id: string;
  rank: number;
  quota: string;
  instituteName: string;
  course: string;
  allottedCategory: string;
  round: string;
};

const CATEGORIES = ["General", "OBC", "SC", "ST", "EWS"];

export function RankCollegePredictor() {
  const [tab, setTab] = useState<"rank" | "college">("rank");

  // Rank predictor state
  const [marks, setMarks] = useState("");
  const [rankCategory, setRankCategory] = useState("General");
  const [rankLoading, setRankLoading] = useState(false);
  const [rankResult, setRankResult] = useState<{
    available: boolean;
    year?: number;
    exactMatch?: RankPoint | null;
    nearest?: RankPoint[];
  } | null>(null);

  // College predictor state
  const [rank, setRank] = useState("");
  const [collegeCategory, setCollegeCategory] = useState("General");
  const [course, setCourse] = useState("");
  const [collegeLoading, setCollegeLoading] = useState(false);
  const [collegeResult, setCollegeResult] = useState<{ available: boolean; allotments?: Allotment[] } | null>(null);

  async function predictRank(e: React.FormEvent) {
    e.preventDefault();
    setRankLoading(true);
    setRankResult(null);
    try {
      const res = await fetch(
        `/api/predictor/rank?marks=${encodeURIComponent(marks)}&category=${encodeURIComponent(rankCategory)}`
      );
      const body = await res.json();
      if (res.ok && body.success) setRankResult(body.data);
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
    <div className="space-y-stack-lg max-w-2xl">
      <div className="flex gap-2 glass-card p-1.5 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setTab("rank")}
          className={`px-4 py-2 rounded-lg text-label-md transition-colors ${
            tab === "rank" ? "bg-primary text-on-primary" : "text-on-surface-variant"
          }`}
        >
          Rank Predictor
        </button>
        <button
          type="button"
          onClick={() => setTab("college")}
          className={`px-4 py-2 rounded-lg text-label-md transition-colors ${
            tab === "college" ? "bg-primary text-on-primary" : "text-on-surface-variant"
          }`}
        >
          College Predictor
        </button>
      </div>

      {tab === "rank" && (
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <form onSubmit={predictRank} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-label-sm text-on-surface-variant mb-1">Expected Marks</label>
              <input
                type="number"
                required
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
                className="rounded-lg border border-outline-variant bg-surface-container-lowest py-2 px-3 text-body-md outline-none w-32"
              />
            </div>
            <div>
              <label className="block text-label-sm text-on-surface-variant mb-1">Category</label>
              <select
                value={rankCategory}
                onChange={(e) => setRankCategory(e.target.value)}
                className="rounded-lg border border-outline-variant bg-surface-container-lowest py-2 px-3 text-body-md outline-none"
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
              className="px-5 py-2 bg-primary text-on-primary rounded-lg font-label-md disabled:opacity-60"
            >
              {rankLoading ? "Predicting..." : "Predict Rank"}
            </button>
          </form>

          {rankResult && !rankResult.available && (
            <p className="text-body-sm text-on-surface-variant">
              No reference data available yet for this category. Check back once this year&apos;s rank trends are published.
            </p>
          )}

          {rankResult?.available && (
            <div className="space-y-2">
              {rankResult.exactMatch && (
                <div className="glass-card rounded-xl p-4 bg-primary-container/15">
                  <p className="text-label-sm text-on-surface-variant">Expected AIR (Year {rankResult.year})</p>
                  <p className="text-headline-md font-headline-md text-primary">
                    ~{rankResult.exactMatch.expectedRank.toLocaleString("en-IN")}
                  </p>
                </div>
              )}
              {(rankResult.nearest ?? []).length > 0 && (
                <div className="space-y-1">
                  <p className="text-label-sm text-on-surface-variant">Nearby reference points</p>
                  {rankResult.nearest!.slice(0, 4).map((p) => (
                    <div key={p.id} className="flex justify-between text-label-sm py-1 border-b border-outline-variant/20">
                      <span>{p.marks} marks</span>
                      <span className="text-on-surface-variant">~AIR {p.expectedRank.toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "college" && (
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <form onSubmit={predictCollege} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-label-sm text-on-surface-variant mb-1">Your AIR</label>
              <input
                type="number"
                required
                value={rank}
                onChange={(e) => setRank(e.target.value)}
                className="rounded-lg border border-outline-variant bg-surface-container-lowest py-2 px-3 text-body-md outline-none w-32"
              />
            </div>
            <div>
              <label className="block text-label-sm text-on-surface-variant mb-1">Category</label>
              <select
                value={collegeCategory}
                onChange={(e) => setCollegeCategory(e.target.value)}
                className="rounded-lg border border-outline-variant bg-surface-container-lowest py-2 px-3 text-body-md outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-label-sm text-on-surface-variant mb-1">Course (optional)</label>
              <input
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder="MBBS"
                className="rounded-lg border border-outline-variant bg-surface-container-lowest py-2 px-3 text-body-md outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={collegeLoading}
              className="px-5 py-2 bg-primary text-on-primary rounded-lg font-label-md disabled:opacity-60"
            >
              {collegeLoading ? "Predicting..." : "Predict Colleges"}
            </button>
          </form>

          {collegeResult && !collegeResult.available && (
            <p className="text-body-sm text-on-surface-variant">
              No counselling reference data available yet. Check back once past-round allotment data is published.
            </p>
          )}

          {collegeResult?.available && (collegeResult.allotments ?? []).length === 0 && (
            <p className="text-body-sm text-on-surface-variant">No matching colleges found for this rank/category.</p>
          )}

          {collegeResult?.available && (collegeResult.allotments ?? []).length > 0 && (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {collegeResult.allotments!.map((a) => (
                <div key={a.id} className="flex justify-between items-center text-label-sm py-2 border-b border-outline-variant/20">
                  <div>
                    <p className="text-on-surface">{a.instituteName}</p>
                    <p className="text-on-surface-variant text-label-sm">
                      {a.course} · {a.quota} · {a.round}
                    </p>
                  </div>
                  <span className="text-on-surface-variant">Closing AIR {a.rank.toLocaleString("en-IN")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
