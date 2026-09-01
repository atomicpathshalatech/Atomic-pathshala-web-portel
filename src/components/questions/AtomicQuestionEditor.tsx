"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { QuestionIdBadge } from "./QuestionIdBadge";
import { QuestionTaxonomySidebar } from "./QuestionTaxonomySidebar";
import { QuestionSimilaritySidebar } from "./QuestionSimilaritySidebar";
import { AiAssistantTools } from "./AiAssistantTools";
import { SimilarityReport, SimilarityMatch } from "@/lib/questions/similarity";
import { AiMetadataSuggestion } from "@/lib/questions/ai-service";

export interface AtomicQuestionEditorProps {
  initialSubject?: string;
  initialChapter?: string;
  initialTopic?: string;
  dppId?: string;
  dppName?: string;
  testSectionId?: string;
  testName?: string;
  onSuccess?: (createdQuestion: any) => void;
  onCancelHref?: string;
}

export function AtomicQuestionEditor({
  initialSubject = "Chemistry",
  initialChapter = "",
  initialTopic = "",
  dppId,
  dppName,
  testSectionId,
  testName,
  onSuccess,
  onCancelHref = "/team/questions",
}: AtomicQuestionEditorProps) {
  const router = useRouter();

  // Content states
  const [activeLangTab, setActiveLangTab] = useState<"ENGLISH" | "HINDI" | "BOTH">("BOTH");
  const [statementEn, setStatementEn] = useState("");
  const [statementHi, setStatementHi] = useState("");

  const [optionAEn, setOptionAEn] = useState("");
  const [optionBEn, setOptionBEn] = useState("");
  const [optionCEn, setOptionCEn] = useState("");
  const [optionDEn, setOptionDEn] = useState("");

  const [optionAHi, setOptionAHi] = useState("");
  const [optionBHi, setOptionBHi] = useState("");
  const [optionCHi, setOptionCHi] = useState("");
  const [optionDHi, setOptionDHi] = useState("");

  const [correctOption, setCorrectOption] = useState<string>("A");
  const [solutionEn, setSolutionEn] = useState("");
  const [solutionHi, setSolutionHi] = useState("");

  // Figure / Diagram attachment
  const [figureUrl, setFigureUrl] = useState("");
  const [figureCaption, setFigureCaption] = useState("");

  // Taxonomy states
  const [subject, setSubject] = useState(initialSubject);
  const [chapter, setChapter] = useState(initialChapter);
  const [topic, setTopic] = useState(initialTopic);
  const [subTopic, setSubTopic] = useState("");
  const [type, setType] = useState("SINGLE_CORRECT");
  const [difficulty, setDifficulty] = useState("MEDIUM");
  const [category, setCategory] = useState("NCERT Canonical");
  const [pyqSource, setPyqSource] = useState("");
  const [tags, setTags] = useState<string[]>(["NEET 2026", "NCERT Line-by-Line"]);

  // Similarity states
  const [similarityReport, setSimilarityReport] = useState<SimilarityReport | null>(null);
  const [checkingSimilarity, setCheckingSimilarity] = useState(false);

  // Status & submission states
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  // Auto trigger debounced similarity check when statement changes
  useEffect(() => {
    if (!statementEn.trim() && !statementHi.trim()) return;

    const timer = setTimeout(() => {
      runSimilarityCheck();
    }, 1200);

    return () => clearTimeout(timer);
  }, [statementEn, statementHi, subject, chapter]);

  const runSimilarityCheck = async () => {
    if (!statementEn.trim() && !statementHi.trim()) return;
    setCheckingSimilarity(true);
    try {
      const res = await fetch("/api/team/questions/similarity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statementEn,
          statementHi,
          subject,
          chapter,
          topic,
          optionsEn: { A: optionAEn, B: optionBEn, C: optionCEn, D: optionDEn },
          optionsHi: { A: optionAHi, B: optionBHi, C: optionCHi, D: optionDHi },
        }),
      });
      const json = await res.json();
      if (json.success && json.data.report) {
        setSimilarityReport(json.data.report);
      }
    } catch (err) {
      console.error("Similarity check error:", err);
    } finally {
      setCheckingSimilarity(false);
    }
  };

  // AI Assistant Callbacks
  const handleApplyExtraction = (extracted: any) => {
    if (extracted.statementEn) setStatementEn(extracted.statementEn);
    if (extracted.optionA) setOptionAEn(extracted.optionA);
    if (extracted.optionB) setOptionBEn(extracted.optionB);
    if (extracted.optionC) setOptionCEn(extracted.optionC);
    if (extracted.optionD) setOptionDEn(extracted.optionD);
    if (extracted.correctOptionIds?.[0]) setCorrectOption(extracted.correctOptionIds[0]);
    if (extracted.solutionEn) setSolutionEn(extracted.solutionEn);
  };

  const handleApplyTranslation = (text: string, targetLang: "ENGLISH" | "HINDI") => {
    if (targetLang === "HINDI") {
      setStatementHi(text);
    } else {
      setStatementEn(text);
    }
  };

  const handleApplySolution = (sol: any) => {
    if (sol.detailedSolutionEn) setSolutionEn(sol.detailedSolutionEn);
    if (sol.detailedSolutionHi) setSolutionHi(sol.detailedSolutionHi);
    if (sol.correctOption) setCorrectOption(sol.correctOption);
  };

  const handleApplyMetadata = (meta: AiMetadataSuggestion) => {
    if (meta.subject) setSubject(meta.subject);
    if (meta.chapter) setChapter(meta.chapter);
    if (meta.topic) setTopic(meta.topic);
    if (meta.subTopic) setSubTopic(meta.subTopic);
    if (meta.difficulty) setDifficulty(meta.difficulty);
    if (meta.tags) setTags(meta.tags);
  };

  // Submit master question
  const handleSubmit = async (isPublished: boolean) => {
    if (!statementEn.trim() && !statementHi.trim()) {
      setSaveError("Please provide question statement in English or Hindi.");
      return;
    }
    if (!subject.trim()) {
      setSaveError("Please select a subject.");
      return;
    }

    setSaving(true);
    setSaveError("");

    try {
      const res = await fetch("/api/team/questions/engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          chapter: chapter || null,
          topic: topic || null,
          subTopic: subTopic || null,
          type,
          difficulty,
          category,
          pyqSource,
          tags,
          statementEn: statementEn.trim() || undefined,
          statementHi: statementHi.trim() || undefined,
          optionsEn: { A: optionAEn, B: optionBEn, C: optionCEn, D: optionDEn },
          optionsHi: { A: optionAHi, B: optionBHi, C: optionCHi, D: optionDHi },
          correctOptionIds: [correctOption],
          solutionEn: solutionEn.trim() || undefined,
          solutionHi: solutionHi.trim() || undefined,
          figureUrl: figureUrl.trim() || undefined,
          isPublished,
          dppId: dppId || undefined,
          testSectionId: testSectionId || undefined,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        setSaveError(json.error || "Failed to save question.");
        return;
      }

      setGeneratedCode(json.data.question.questionCode);

      if (onSuccess) {
        onSuccess(json.data.question);
      } else if (dppId) {
        router.push(`/team/dpp/${dppId}`);
        router.refresh();
      } else {
        router.push("/team/questions");
        router.refresh();
      }
    } catch (err: any) {
      setSaveError(err.message || "Network error occurred.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Top Header & Mode Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-mono">
              UNIVERSAL QUESTION ENGINE
            </span>
            {dppName && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold">
                Target: {dppName}
              </span>
            )}
            {testName && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
                Target: {testName}
              </span>
            )}
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight mt-1">
            Atomic Question Creation Studio
          </h2>
        </div>

        {/* Live Question ID Indicator */}
        <div className="w-full sm:w-auto">
          <QuestionIdBadge questionCode={generatedCode} subjectName={subject} isSaving={saving} />
        </div>
      </div>

      {/* 2. Main Grid: Editor on Left (col-span-8), Taxonomies & Similarity on Right (col-span-4) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Question Content, Bilingual Fields, Options & Solutions (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {/* AI Co-Pilot Bar */}
          <AiAssistantTools
            statementEn={statementEn}
            statementHi={statementHi}
            optionsEn={{ A: optionAEn, B: optionBEn, C: optionCEn, D: optionDEn }}
            optionsHi={{ A: optionAHi, B: optionBHi, C: optionCHi, D: optionDHi }}
            correctAnswer={[correctOption]}
            onApplyExtraction={handleApplyExtraction}
            onApplyTranslation={handleApplyTranslation}
            onApplySolution={handleApplySolution}
            onApplyMetadata={handleApplyMetadata}
          />

          {/* Bilingual Language Switcher */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Language Display:
              </span>
              <button
                type="button"
                onClick={() => setActiveLangTab("BOTH")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  activeLangTab === "BOTH"
                    ? "bg-amber-500 text-black shadow"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                Bilingual (Both)
              </button>
              <button
                type="button"
                onClick={() => setActiveLangTab("ENGLISH")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  activeLangTab === "ENGLISH"
                    ? "bg-indigo-600 text-white shadow"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                English Only
              </button>
              <button
                type="button"
                onClick={() => setActiveLangTab("HINDI")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  activeLangTab === "HINDI"
                    ? "bg-emerald-600 text-white shadow"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                Hindi Only
              </button>
            </div>
          </div>

          {/* A. QUESTION STATEMENT */}
          <div className="space-y-4">
            {(activeLangTab === "BOTH" || activeLangTab === "ENGLISH") && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Question Statement (English) *</span>
                  <span className="text-[10px] text-slate-500 font-mono">LaTeX / Math supported</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Which of the following statements is correct regarding the Bohr model of hydrogen atom?"
                  value={statementEn}
                  onChange={(e) => setStatementEn(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 p-3.5 rounded-2xl text-sm text-white focus:border-amber-500 font-sans leading-relaxed shadow-inner"
                />
              </div>
            )}

            {(activeLangTab === "BOTH" || activeLangTab === "HINDI") && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Question Statement (Hindi - हिंदी)</span>
                  <span className="text-[10px] text-slate-500 font-mono">Devanagari supported</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. हाइड्रोजन परमाणु के बोहर मॉडल के संबंध में निम्नलिखित में से कौन सा कथन सही है?"
                  value={statementHi}
                  onChange={(e) => setStatementHi(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 p-3.5 rounded-2xl text-sm text-white focus:border-amber-500 font-sans leading-relaxed shadow-inner"
                />
              </div>
            )}
          </div>

          {/* B. FIGURE / DIAGRAM ATTACHMENT */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-amber-400">image</span>
                Figure / Diagram Attachment (Optional)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Figure Image URL (e.g. https://.../circuit.png)"
                value={figureUrl}
                onChange={(e) => setFigureUrl(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 px-3 py-2 rounded-xl text-xs text-white"
              />
              <input
                type="text"
                placeholder="Figure Caption (e.g. Fig 1.1 — Wheatstone Bridge Circuit)"
                value={figureCaption}
                onChange={(e) => setFigureCaption(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 px-3 py-2 rounded-xl text-xs text-white"
              />
            </div>

            {figureUrl && (
              <div className="w-32 h-32 rounded-xl overflow-hidden border border-slate-700 bg-black/40 flex items-center justify-center">
                <img src={figureUrl} alt="Question figure" className="max-w-full max-h-full object-contain" />
              </div>
            )}
          </div>

          {/* C. OPTIONS (A, B, C, D) & CORRECT ANSWER MARKING */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Options & Correct Answer
              </h4>
              <span className="text-xs text-amber-400 font-bold">
                Selected Answer: Option ({correctOption})
              </span>
            </div>

            <div className="space-y-3">
              {[
                {
                  key: "A",
                  valEn: optionAEn,
                  setValEn: setOptionAEn,
                  valHi: optionAHi,
                  setValHi: setOptionAHi,
                },
                {
                  key: "B",
                  valEn: optionBEn,
                  setValEn: setOptionBEn,
                  valHi: optionBHi,
                  setValHi: setOptionBHi,
                },
                {
                  key: "C",
                  valEn: optionCEn,
                  setValEn: setOptionCEn,
                  valHi: optionCHi,
                  setValHi: setOptionCHi,
                },
                {
                  key: "D",
                  valEn: optionDEn,
                  setValEn: setOptionDEn,
                  valHi: optionDHi,
                  setValHi: setOptionDHi,
                },
              ].map((opt) => {
                const isSelected = correctOption === opt.key;
                return (
                  <div
                    key={opt.key}
                    className={`p-3.5 rounded-2xl border transition ${
                      isSelected
                        ? "bg-emerald-950/30 border-emerald-500/50 shadow-md"
                        : "bg-slate-900 border-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="correctOptionRadio"
                          checked={isSelected}
                          onChange={() => setCorrectOption(opt.key)}
                          className="w-4 h-4 text-emerald-500 focus:ring-emerald-400"
                        />
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                            isSelected
                              ? "bg-emerald-500 text-black"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {opt.key}
                        </span>
                        <span className="text-xs font-bold text-white">
                          Option ({opt.key}) {isSelected && "— Correct Answer"}
                        </span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(activeLangTab === "BOTH" || activeLangTab === "ENGLISH") && (
                        <input
                          type="text"
                          placeholder={`Option (${opt.key}) English text`}
                          value={opt.valEn}
                          onChange={(e) => opt.setValEn(e.target.value)}
                          className="w-full bg-slate-800/80 border border-slate-700 px-3 py-2 rounded-xl text-xs text-white focus:border-amber-500"
                        />
                      )}
                      {(activeLangTab === "BOTH" || activeLangTab === "HINDI") && (
                        <input
                          type="text"
                          placeholder={`विकल्प (${opt.key}) हिंदी पाठ`}
                          value={opt.valHi}
                          onChange={(e) => opt.setValHi(e.target.value)}
                          className="w-full bg-slate-800/80 border border-slate-700 px-3 py-2 rounded-xl text-xs text-white focus:border-amber-500"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* D. EXPLANATION & SOLUTIONS */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Detailed Solution & Concepts
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(activeLangTab === "BOTH" || activeLangTab === "ENGLISH") && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Solution (English)
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Step 1: Formula used...\nStep 2: Calculation...\nHence, Option (A) is correct."
                    value={solutionEn}
                    onChange={(e) => setSolutionEn(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 p-3 rounded-2xl text-xs text-white focus:border-amber-500 leading-relaxed font-mono"
                  />
                </div>
              )}

              {(activeLangTab === "BOTH" || activeLangTab === "HINDI") && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Solution (Hindi - हिंदी)
                  </label>
                  <textarea
                    rows={4}
                    placeholder="चरण 1: प्रयुक्त सूत्र...\nचरण 2: गणना...\nअतः, विकल्प (A) सही है।"
                    value={solutionHi}
                    onChange={(e) => setSolutionHi(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 p-3 rounded-2xl text-xs text-white focus:border-amber-500 leading-relaxed font-mono"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Save Error Display */}
          {saveError && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              <span>{saveError}</span>
            </div>
          )}

          {/* Save Action Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => router.push(onCancelHref)}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition"
              >
                {saving ? "Saving..." : "Save Draft"}
              </button>

              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs shadow-lg shadow-amber-500/20 transition flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">publish</span>
                <span>{saving ? "Publishing..." : "Save & Publish Question"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Curriculum Taxonomy & Similarity Sidebar (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* 1. Taxonomy & Curriculum Sidebar */}
          <QuestionTaxonomySidebar
            subject={subject}
            setSubject={setSubject}
            chapter={chapter}
            setChapter={setChapter}
            topic={topic}
            setTopic={setTopic}
            subTopic={subTopic}
            setSubTopic={setSubTopic}
            type={type}
            setType={setType}
            difficulty={difficulty}
            setDifficulty={setDifficulty}
            category={category}
            setCategory={setCategory}
            pyqSource={pyqSource}
            setPyqSource={setPyqSource}
            tags={tags}
            setTags={setTags}
          />

          {/* 2. Real-time Similarity & Duplicate Check Sidebar */}
          <QuestionSimilaritySidebar
            report={similarityReport}
            checking={checkingSimilarity}
            onCheckSimilarity={runSimilarityCheck}
            newQuestionData={{
              statementEn,
              statementHi,
              optionsEn: { A: optionAEn, B: optionBEn, C: optionCEn, D: optionDEn },
              optionsHi: { A: optionAHi, B: optionBHi, C: optionCHi, D: optionDHi },
              correctAnswer: [correctOption],
              subject,
              chapter,
              topic,
            }}
            onUseExisting={(match) => {
              setGeneratedCode(match.questionCode);
              setStatementEn(match.statementEn || "");
              setStatementHi(match.statementHi || "");
              if (match.optionsEn) {
                setOptionAEn(match.optionsEn.A || "");
                setOptionBEn(match.optionsEn.B || "");
                setOptionCEn(match.optionsEn.C || "");
                setOptionDEn(match.optionsEn.D || "");
              }
              if (match.correctAnswer?.[0]) setCorrectOption(match.correctAnswer[0]);
              if (match.solutionEn) setSolutionEn(match.solutionEn);
            }}
          />
        </div>
      </div>
    </div>
  );
}