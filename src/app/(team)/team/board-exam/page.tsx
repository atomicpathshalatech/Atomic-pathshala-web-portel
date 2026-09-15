"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  BOARDS,
  CLASSES,
  SUBJECTS_BY_CLASS,
  YEARS,
  MODES,
  type BoardClass,
  type BoardLanguage,
  type BoardMode,
  type BoardPaper,
} from "@/lib/ai-chat/boardExam";

export default function AdminBoardExamPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "boards" | "preview" | "blueprint">("overview");
  const [boardConfigs, setBoardConfigs] = useState(
    BOARDS.map((b) => ({ ...b, active: true, priority: "High" }))
  );
  const [selectedClass, setSelectedClass] = useState<BoardClass>("12th");
  const [selectedBoard, setSelectedBoard] = useState("CBSE");
  const [selectedSubject, setSelectedSubject] = useState("Physics");
  const [selectedYear, setSelectedYear] = useState("2024");
  const [selectedMode, setSelectedMode] = useState<BoardMode>("pyq");
  const [selectedLang, setSelectedLang] = useState<BoardLanguage>("hindi");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewPaper, setPreviewPaper] = useState<BoardPaper | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const toggleBoardStatus = (val: string) => {
    setBoardConfigs((prev) =>
      prev.map((b) => (b.value === val ? { ...b, active: !b.active } : b))
    );
  };

  const handleGeneratePreview = async () => {
    setLoadingPreview(true);
    setPreviewError(null);
    try {
      const res = await fetch("/api/ai-chat/board-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board: selectedBoard,
          className: selectedClass,
          subject: selectedSubject,
          language: selectedLang,
          mode: selectedMode,
          year: selectedYear,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.paper) {
        throw new Error(data.error || "Failed to generate preview paper.");
      }
      setPreviewPaper(data.paper);
    } catch (err: any) {
      setPreviewError(err.message || "Failed to generate preview.");
    } finally {
      setLoadingPreview(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-bold border border-blue-500/30">
              CENTRAL CONTROL
            </span>
            <span className="text-xs text-slate-400">Class 10th & 12th Board Examinations</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white mt-1">
            Board Exam Hub Management
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure state & central boards, manage PYQ / Model Paper blueprints, verify AI generation rules, and monitor student exam practice.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/practice/board-exam"
            target="_blank"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-md shadow-blue-500/20 transition"
          >
            <span className="material-symbols-outlined text-sm">open_in_new</span>
            Open Student Portal View
          </Link>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 rounded-lg font-bold transition flex items-center gap-1.5 ${
            activeTab === "overview"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <span className="material-symbols-outlined text-base">dashboard</span>
          Overview & Stats
        </button>
        <button
          onClick={() => setActiveTab("boards")}
          className={`px-4 py-2 rounded-lg font-bold transition flex items-center gap-1.5 ${
            activeTab === "boards"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <span className="material-symbols-outlined text-base">domain</span>
          Boards & Subject Mapping ({boardConfigs.length})
        </button>
        <button
          onClick={() => setActiveTab("blueprint")}
          className={`px-4 py-2 rounded-lg font-bold transition flex items-center gap-1.5 ${
            activeTab === "blueprint"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <span className="material-symbols-outlined text-base">schema</span>
          Exam Blueprints & Structure
        </button>
        <button
          onClick={() => setActiveTab("preview")}
          className={`px-4 py-2 rounded-lg font-bold transition flex items-center gap-1.5 ${
            activeTab === "preview"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <span className="material-symbols-outlined text-base">science</span>
          Live Paper Generator & Validator
        </button>
      </div>

      {/* Tab: Overview */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Configured Boards</span>
                <span className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                  <span className="material-symbols-outlined text-lg">school</span>
                </span>
              </div>
              <div className="text-2xl font-black text-white mt-2">{boardConfigs.length}</div>
              <div className="text-[11px] text-emerald-400 mt-1">100% Active & Mapped</div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Classes Supported</span>
                <span className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                  <span className="material-symbols-outlined text-lg">class</span>
                </span>
              </div>
              <div className="text-2xl font-black text-white mt-2">Class 10 & 12</div>
              <div className="text-[11px] text-slate-400 mt-1">Science & Secondary streams</div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Years Covered</span>
                <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <span className="material-symbols-outlined text-lg">history</span>
                </span>
              </div>
              <div className="text-2xl font-black text-white mt-2">{YEARS.length} Years</div>
              <div className="text-[11px] text-slate-400 mt-1">2020 through 2025 Model</div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Paper Modes</span>
                <span className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                  <span className="material-symbols-outlined text-lg">description</span>
                </span>
              </div>
              <div className="text-2xl font-black text-white mt-2">2 Modes</div>
              <div className="text-[11px] text-purple-300 mt-1">PYQ Practice + Model Papers</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900/70 border border-slate-800 p-5 rounded-2xl space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-400 text-lg">verified</span>
                Active Examination Boards
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {boardConfigs.map((b) => (
                  <div
                    key={b.value}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">{b.label}</div>
                      <div className="text-[10px] text-slate-500">Code: {b.value}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 p-5 rounded-2xl space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400 text-lg">auto_stories</span>
                Curriculum & Subject Coverage
              </h3>
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between font-bold text-amber-400">
                    <span>Class 10th (Secondary)</span>
                    <span className="text-[10px] bg-amber-500/10 px-2 py-0.5 rounded">5 Subjects</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SUBJECTS_BY_CLASS["10th"].map((sub) => (
                      <span key={sub} className="px-2 py-1 rounded-md bg-slate-900 text-slate-300 border border-slate-800">
                        {sub}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between font-bold text-blue-400">
                    <span>Class 12th (Senior Secondary - Science)</span>
                    <span className="text-[10px] bg-blue-500/10 px-2 py-0.5 rounded">6 Subjects</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SUBJECTS_BY_CLASS["12th"].map((sub) => (
                      <span key={sub} className="px-2 py-1 rounded-md bg-slate-900 text-slate-300 border border-slate-800">
                        {sub}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Boards Management */}
      {activeTab === "boards" && (
        <div className="bg-slate-900/70 border border-slate-800 p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white">Board Configuration & Status</h2>
              <p className="text-xs text-slate-400">
                Enable or disable specific boards for the student practice portal.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Board Name</th>
                  <th className="py-3 px-4">Identifier</th>
                  <th className="py-3 px-4">Classes</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {boardConfigs.map((b) => (
                  <tr key={b.value} className="hover:bg-slate-900/40 transition">
                    <td className="py-3.5 px-4 font-semibold text-white">{b.label}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">{b.value}</td>
                    <td className="py-3.5 px-4 text-slate-300">Class 10th & 12th</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          b.active
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-red-500/10 text-red-400 border border-red-500/20"
                        }`}
                      >
                        {b.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => toggleBoardStatus(b.value)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                          b.active
                            ? "bg-slate-800 hover:bg-slate-700 text-slate-300"
                            : "bg-blue-600 hover:bg-blue-500 text-white"
                        }`}
                      >
                        {b.active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Blueprint */}
      {activeTab === "blueprint" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 p-5 rounded-2xl space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-400 text-lg">format_list_numbered</span>
              Official Examination Pattern Blueprint
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every AI-generated board paper strictly follows the canonical standard section structure of CBSE & State Boards (70 Marks / 3 Hours 15 Minutes):
            </p>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="font-bold text-blue-400">Section A: Multiple Choice Questions (Q1 - 4 Sub-parts)</div>
                <div className="text-slate-300">4 marks total (1 mark each). Contains standard conceptual MCQs and 1 Assertion-Reason style sub-part.</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="font-bold text-amber-400">Section B: Very Short Answer Type (Q2 - 5 Sub-parts)</div>
                <div className="text-slate-300">5 marks total (1 mark each). Exact single-line factual definitions, units, and principles.</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="font-bold text-emerald-400">Section C: Short Answer Type - I (Q3 - 4 to 5 Sub-parts)</div>
                <div className="text-slate-300">8 to 10 marks total (2 marks each). Conceptual reasoning and standard derivations.</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="font-bold text-purple-400">Section D: Short Answer Type - II (Q4, Q5, Q6 - 3 Marks each)</div>
                <div className="text-slate-300">Contains diagram-based or paragraph comprehension analytical problem sets.</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="font-bold text-rose-400">Section E: Long Answer Type (Q7, Q8, Q9 - 5 Marks each with OR choice)</div>
                <div className="text-slate-300">15 marks total. Deep derivations and multi-part problem solving with authentic internal choices.</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 p-5 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">Generation Rules</h3>
            <ul className="space-y-2 text-xs text-slate-300 list-disc pl-4 leading-relaxed">
              <li>Strict Hindi Devanagari or English language adherence without translation artifacts.</li>
              <li>Year-aligned trend weighting to emphasize high-frequency topics.</li>
              <li>Complete step-by-step marking scheme attached to each question for teacher/student review.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab: Preview */}
      {activeTab === "preview" && (
        <div className="space-y-6">
          <div className="bg-slate-900/70 border border-slate-800 p-5 rounded-2xl space-y-4">
            <h2 className="text-base font-bold text-white">Teacher Live Paper Validator</h2>
            <p className="text-xs text-slate-400">
              Select parameters to generate and inspect a live paper directly in the admin panel.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Board</label>
                <select
                  value={selectedBoard}
                  onChange={(e) => setSelectedBoard(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white"
                >
                  {BOARDS.map((b) => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Class</label>
                <select
                  value={selectedClass}
                  onChange={(e) => {
                    const c = e.target.value as BoardClass;
                    setSelectedClass(c);
                    setSelectedSubject(SUBJECTS_BY_CLASS[c][0] || "Physics");
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white"
                >
                  {CLASSES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Subject</label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white"
                >
                  {SUBJECTS_BY_CLASS[selectedClass].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Mode</label>
                <select
                  value={selectedMode}
                  onChange={(e) => setSelectedMode(e.target.value as BoardMode)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white"
                >
                  {MODES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Year</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white"
                >
                  {YEARS.map((y) => (
                    <option key={y.value} value={y.value}>{y.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Language</label>
                <select
                  value={selectedLang}
                  onChange={(e) => setSelectedLang(e.target.value as BoardLanguage)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white"
                >
                  <option value="hindi">Hindi</option>
                  <option value="english">English</option>
                  <option value="hinglish">Hinglish</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleGeneratePreview}
                disabled={loadingPreview}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition flex items-center gap-2"
              >
                {loadingPreview ? (
                  <>
                    <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                    Generating Live Paper...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">play_arrow</span>
                    Generate Paper Preview
                  </>
                )}
              </button>
            </div>

            {previewError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {previewError}
              </div>
            )}
          </div>

          {previewPaper && (
            <div className="bg-slate-900/70 border border-slate-800 p-6 rounded-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-white">{previewPaper.subject} - {previewPaper.board}</h3>
                  <p className="text-xs text-slate-400">
                    Total Marks: {previewPaper.totalMarks} • Time: {previewPaper.timeAllowed}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
                  Valid Blueprint ({previewPaper.questions.length} Questions)
                </span>
              </div>

              <div className="space-y-4 text-xs">
                {previewPaper.questions.map((q) => (
                  <div key={q.id} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                    <div className="font-bold text-blue-400 uppercase tracking-wide text-[11px]">
                      {q.sectionTitle} - Question {q.questionNumber}
                    </div>
                    {q.subParts.map((sp, idx) => (
                      <div key={idx} className="pl-2 border-l-2 border-slate-800 space-y-1">
                        <div className="text-slate-200">
                          <span className="font-bold text-amber-400">({sp.label})</span> {sp.text} ({sp.marks}M)
                        </div>
                        {sp.answer && (
                          <div className="text-emerald-400/90 text-[11px] bg-emerald-950/20 p-2 rounded">
                            <span className="font-bold text-emerald-400">Solution:</span> {sp.answer}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
