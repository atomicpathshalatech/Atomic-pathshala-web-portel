"use client";

import { useState } from "react";
import { toast } from "sonner";

type RankPoint = { id: string; category: string; marks: number; expectedRank: number; year: number; confidence: string | null; source: string | null };
type Allotment = { id: string; year: number; round: string; rank: number; quota: string; instituteName: string; course: string; allottedCategory: string; candidateCategory: string };

export function PredictorDataManager({
  initialRankPoints,
  initialAllotments,
}: {
  initialRankPoints: RankPoint[];
  initialAllotments: Allotment[];
}) {
  const [tab, setTab] = useState<"rank" | "college">("rank");
  const [rankPoints, setRankPoints] = useState(initialRankPoints);
  const [allotments, setAllotments] = useState(initialAllotments);

  const [rankForm, setRankForm] = useState({ category: "General", marks: "", expectedRank: "", year: String(new Date().getFullYear()) });
  const [rankSubmitting, setRankSubmitting] = useState(false);

  const [collegeForm, setCollegeForm] = useState({
    year: String(new Date().getFullYear()),
    round: "Round 1",
    rank: "",
    quota: "AIQ",
    instituteName: "",
    course: "",
    allottedCategory: "General",
    candidateCategory: "General",
  });
  const [collegeSubmitting, setCollegeSubmitting] = useState(false);

  async function addRankPoint(e: React.FormEvent) {
    e.preventDefault();
    setRankSubmitting(true);
    try {
      const res = await fetch("/api/team/predictor/rank-trend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rankForm),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body.error ?? "Could not add this row.");
        return;
      }
      setRankPoints((prev) => [body.data.point, ...prev.filter((p) => p.id !== body.data.point.id)]);
      toast.success(body.data.updated ? "Row updated." : "Row added.");
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setRankSubmitting(false);
    }
  }

  async function deleteRankPoint(id: string) {
    const res = await fetch(`/api/team/predictor/rank-trend/${id}`, { method: "DELETE" });
    const body = await res.json();
    if (!res.ok || !body.success) {
      toast.error(body.error ?? "Could not delete.");
      return;
    }
    setRankPoints((prev) => prev.filter((p) => p.id !== id));
  }

  async function addAllotment(e: React.FormEvent) {
    e.preventDefault();
    setCollegeSubmitting(true);
    try {
      const res = await fetch("/api/team/predictor/college-allotments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(collegeForm),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body.error ?? "Could not add this row.");
        return;
      }
      setAllotments((prev) => [body.data.allotment, ...prev]);
      toast.success("Row added.");
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setCollegeSubmitting(false);
    }
  }

  async function deleteAllotment(id: string) {
    const res = await fetch(`/api/team/predictor/college-allotments/${id}`, { method: "DELETE" });
    const body = await res.json();
    if (!res.ok || !body.success) {
      toast.error(body.error ?? "Could not delete.");
      return;
    }
    setAllotments((prev) => prev.filter((a) => a.id !== id));
  }

  const inputClass =
    "rounded-lg border border-outline-variant bg-surface-container-lowest py-2 px-3 text-body-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  return (
    <div className="space-y-stack-lg max-w-5xl">
      <div className="flex gap-2 glass-card p-1.5 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setTab("rank")}
          className={`px-4 py-2 rounded-lg text-label-md transition-colors ${tab === "rank" ? "bg-primary text-on-primary" : "text-on-surface-variant"}`}
        >
          Rank Trend Data
        </button>
        <button
          type="button"
          onClick={() => setTab("college")}
          className={`px-4 py-2 rounded-lg text-label-md transition-colors ${tab === "college" ? "bg-primary text-on-primary" : "text-on-surface-variant"}`}
        >
          College Allotment Data
        </button>
      </div>

      {tab === "rank" && (
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <form onSubmit={addRankPoint} className="flex flex-wrap items-end gap-3">
            <input
              placeholder="Category"
              value={rankForm.category}
              onChange={(e) => setRankForm((f) => ({ ...f, category: e.target.value }))}
              className={inputClass}
              required
            />
            <input
              type="number"
              placeholder="Marks"
              value={rankForm.marks}
              onChange={(e) => setRankForm((f) => ({ ...f, marks: e.target.value }))}
              className={`${inputClass} w-28`}
              required
            />
            <input
              type="number"
              placeholder="Expected AIR"
              value={rankForm.expectedRank}
              onChange={(e) => setRankForm((f) => ({ ...f, expectedRank: e.target.value }))}
              className={`${inputClass} w-32`}
              required
            />
            <input
              type="number"
              placeholder="Year"
              value={rankForm.year}
              onChange={(e) => setRankForm((f) => ({ ...f, year: e.target.value }))}
              className={`${inputClass} w-24`}
              required
            />
            <button type="submit" disabled={rankSubmitting} className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md disabled:opacity-60">
              {rankSubmitting ? "Adding..." : "Add"}
            </button>
          </form>

          <div className="space-y-1 max-h-96 overflow-y-auto">
            {rankPoints.map((p) => (
              <div key={p.id} className="flex justify-between items-center text-label-sm py-2 border-b border-outline-variant/20">
                <span>
                  {p.category} · {p.marks} marks · Year {p.year}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-on-surface-variant">~AIR {p.expectedRank.toLocaleString("en-IN")}</span>
                  <button type="button" onClick={() => deleteRankPoint(p.id)} className="text-error hover:opacity-80">
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
            ))}
            {rankPoints.length === 0 && <p className="text-body-sm text-on-surface-variant">No rank trend data yet.</p>}
          </div>
        </div>
      )}

      {tab === "college" && (
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <form onSubmit={addAllotment} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <input type="number" placeholder="Year" value={collegeForm.year} onChange={(e) => setCollegeForm((f) => ({ ...f, year: e.target.value }))} className={inputClass} required />
            <input placeholder="Round" value={collegeForm.round} onChange={(e) => setCollegeForm((f) => ({ ...f, round: e.target.value }))} className={inputClass} required />
            <input type="number" placeholder="Closing AIR" value={collegeForm.rank} onChange={(e) => setCollegeForm((f) => ({ ...f, rank: e.target.value }))} className={inputClass} required />
            <input placeholder="Quota" value={collegeForm.quota} onChange={(e) => setCollegeForm((f) => ({ ...f, quota: e.target.value }))} className={inputClass} required />
            <input placeholder="Institute Name" value={collegeForm.instituteName} onChange={(e) => setCollegeForm((f) => ({ ...f, instituteName: e.target.value }))} className={`${inputClass} col-span-2`} required />
            <input placeholder="Course" value={collegeForm.course} onChange={(e) => setCollegeForm((f) => ({ ...f, course: e.target.value }))} className={inputClass} required />
            <input placeholder="Allotted Category" value={collegeForm.allottedCategory} onChange={(e) => setCollegeForm((f) => ({ ...f, allottedCategory: e.target.value }))} className={inputClass} required />
            <input placeholder="Candidate Category" value={collegeForm.candidateCategory} onChange={(e) => setCollegeForm((f) => ({ ...f, candidateCategory: e.target.value }))} className={inputClass} required />
            <button type="submit" disabled={collegeSubmitting} className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md disabled:opacity-60 col-span-2 sm:col-span-1">
              {collegeSubmitting ? "Adding..." : "Add"}
            </button>
          </form>

          <div className="space-y-1 max-h-96 overflow-y-auto">
            {allotments.map((a) => (
              <div key={a.id} className="flex justify-between items-center text-label-sm py-2 border-b border-outline-variant/20">
                <span>
                  {a.instituteName} · {a.course} · {a.candidateCategory} · Year {a.year} {a.round}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-on-surface-variant">Closing AIR {a.rank.toLocaleString("en-IN")}</span>
                  <button type="button" onClick={() => deleteAllotment(a.id)} className="text-error hover:opacity-80">
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
            ))}
            {allotments.length === 0 && <p className="text-body-sm text-on-surface-variant">No college allotment data yet.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
