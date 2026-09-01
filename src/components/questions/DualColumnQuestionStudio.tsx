"use client";

import React, { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

export interface QuestionEntry {
  id?: string;
  questionCode?: string;
  questionNumber: number;
  subject: string;
  chapter?: string;
  topic?: string;
  subTopic?: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  type: "SINGLE_CORRECT" | "MULTIPLE_CORRECT" | "NUMERICAL" | "ASSERTION_REASON" | "MATCH_COLUMN";
  marks: number;
  negativeMarks: number;
  statementHi: string;
  statementEn: string;
  optionAHi: string;
  optionAEn: string;
  optionBHi: string;
  optionBEn: string;
  optionCHi: string;
  optionCEn: string;
  optionDHi: string;
  optionDEn: string;
  correctOption: string; // 'A' | 'B' | 'C' | 'D'
  solutionHi: string;
  solutionEn: string;
  imageUrl?: string;
  isSaved?: boolean;
}

interface DualColumnQuestionStudioProps {
  mode?: "test" | "dpp";
  title?: string;
  testId?: string;
  dppId?: string;
  totalQuestionsCount?: number;
  subjects?: { name: string; count: number; total: number }[];
  initialQuestions?: QuestionEntry[];
  backHref?: string;
  onSave?: (question: QuestionEntry) => Promise<void>;
}

export function DualColumnQuestionStudio({
  mode = "test",
  title = "Minor Test : 02",
  testId,
  dppId,
  totalQuestionsCount = 180,
  subjects = [
    { name: "Biology", count: 90, total: 90 },
    { name: "Chemistry", count: 45, total: 45 },
    { name: "Physics", count: 45, total: 45 },
  ],
  initialQuestions,
  backHref = "/team/tests",
}: DualColumnQuestionStudioProps) {
  // Sidebar states
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeSubject, setActiveSubject] = useState(subjects[0]?.name || "Biology");
  const [currentQuestionNumber, setCurrentQuestionNumber] = useState(1);
  const [jumpInput, setJumpInput] = useState("1");
  const [viewMode, setViewMode] = useState<"side-by-side" | "hindi" | "english">("side-by-side");

  // Questions cache for the test/DPP
  const [questionsMap, setQuestionsMap] = useState<Record<number, QuestionEntry>>(() => {
    const map: Record<number, QuestionEntry> = {};
    if (initialQuestions && initialQuestions.length > 0) {
      initialQuestions.forEach((q) => {
        map[q.questionNumber] = q;
      });
    } else {
      map[1] = {
        questionNumber: 1,
        subject: "Biology",
        chapter: "Cell Cycle and Cell Division",
        topic: "S Phase & Interphase",
        subTopic: "DNA Replication & Centriole Duplication",
        difficulty: "MEDIUM",
        type: "SINGLE_CORRECT",
        marks: 4,
        negativeMarks: 1,
        statementHi: "निम्नलिखित में से कौन-सा कथन S अवस्था के संबंध में सही नहीं है?",
        statementEn: "Which of the following is NOT correct regarding S phase ?",
        optionAHi: "इस अवस्था में DNA संश्लेषण या प्रतिकृति होती है।",
        optionAEn: "DNA synthesis or replication occurs during this phase.",
        optionBHi: "इस अवस्था में प्रति कोशिका DNA की मात्रा दोगुनी हो जाती है।",
        optionBEn: "The amount of DNA per cell doubles during this phase.",
        optionCHi: "इस अवस्था के बाद गुणसूत्रों की संख्या दोगुनी हो जाती है।",
        optionCEn: "The chromosome number doubles after this phase.",
        optionDHi: "प्राणी कोशिकाओं में इसी अवस्था के दौरान centriole का द्विगुणन होता है।",
        optionDEn: "In animal cells, centriole duplication occurs during this phase.",
        correctOption: "C",
        solutionHi:
          "**What is asked:** कोशिका चक्र की S-अवस्था (संश्लेषण प्रावस्था) के संदर्भ में दिए गए कथनों में से कौन-सा कथन असत्य है, यह पहचानना है।\n\n**Approach:** NCERT के अनुसार कोशिका चक्र की S-प्रावस्था के प्रमुख लक्षणों (DNA प्रतिकृति, गुणसूत्र संख्या, एवं तारककेंद्र के द्विगुणन) का विश्लेषण करके सही विकल्प चुनना।\n\n**Solution:**\n1. S-प्रावस्था (संश्लेषण प्रावस्था) के दौरान DNA का संश्लेषण या प्रतिकृतिकरण होता है, जिससे DNA की मात्रा 2C से बढ़कर 4C हो जाती है (कथन A और B सही हैं)।\n2. DNA की मात्रा दोगुनी होने के बावजूद, गुणसूत्रों की संख्या में कोई वृद्धि नहीं होती है; यदि G1 में कोशिका द्विगुणित (2n) थी, तो S प्रावस्था के बाद भी गुणसूत्रों की संख्या 2n ही रहती है। अतः कथन C गलत है।\n3. प्राणी कोशिकाओं में S-प्रावस्था के दौरान केंद्रक में DNA प्रतिकृति के साथ-साथ कोशिकाद्रव्य में तारककेंद्र (centriole) का भी द्विगुणन होता है (कथन D सही है)।\n\nअतः, असत्य कथन विकल्प C है।",
        solutionEn:
          "**What is asked:** Identify the incorrect statement regarding the S phase of the cell cycle.\n\n**Approach:** Recall the cellular and genetic events that occur during the synthesis (S) phase of interphase.\n\n**Solution:**\n1. During the S phase (Synthesis phase), DNA replication takes place, which doubles the amount of DNA per cell from 2C to 4C.\n2. Although the DNA content doubles, the chromosome number remains the same (i.e., if the cell has 2n chromosomes at G1, it still possesses 2n chromosomes after the S phase).\n3. In animal cells, centriole duplication also takes place in the cytoplasm during the S phase.\n4. Therefore, the statement 'The chromosome number doubles after this phase' is incorrect.\n\nHence, the correct option is C.",
        isSaved: true,
      };
    }
    return map;
  });

  const currentQ: QuestionEntry = questionsMap[currentQuestionNumber] || {
    questionNumber: currentQuestionNumber,
    subject: activeSubject,
    chapter: "Cell Cycle and Cell Division",
    topic: "S Phase & Interphase",
    subTopic: "DNA Replication",
    difficulty: "MEDIUM",
    type: "SINGLE_CORRECT",
    marks: 4,
    negativeMarks: 1,
    statementHi: "",
    statementEn: "",
    optionAHi: "",
    optionAEn: "",
    optionBHi: "",
    optionBEn: "",
    optionCHi: "",
    optionCEn: "",
    optionDHi: "",
    optionDEn: "",
    correctOption: "A",
    solutionHi: "",
    solutionEn: "",
    isSaved: false,
  };

  const updateCurrentDraft = (fields: Partial<QuestionEntry>) => {
    setQuestionsMap((prev) => ({
      ...prev,
      [currentQuestionNumber]: {
        ...currentQ,
        ...fields,
      },
    }));
  };

  // 1. Single-Click AI Translation
  const handleSingleClickTranslate = async () => {
    toast.loading("Translating statement, options & solution...", { id: "translate" });
    try {
      if (currentQ.statementEn && !currentQ.statementHi) {
        const res = await fetch("/api/team/questions/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "translate",
            payload: { text: currentQ.statementEn, sourceLanguage: "ENGLISH" },
          }),
        });
        const json = await res.json();
        if (json.success && json.data.translation) {
          updateCurrentDraft({
            statementHi: json.data.translation,
            optionAHi: currentQ.optionAEn ? `${currentQ.optionAEn} (हिंदी अनुवाद)` : "",
            optionBHi: currentQ.optionBEn ? `${currentQ.optionBEn} (हिंदी अनुवाद)` : "",
            optionCHi: currentQ.optionCEn ? `${currentQ.optionCEn} (हिंदी अनुवाद)` : "",
            optionDHi: currentQ.optionDEn ? `${currentQ.optionDEn} (हिंदी अनुवाद)` : "",
          });
        }
      } else if (currentQ.statementHi && !currentQ.statementEn) {
        const res = await fetch("/api/team/questions/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "translate",
            payload: { text: currentQ.statementHi, sourceLanguage: "HINDI" },
          }),
        });
        const json = await res.json();
        if (json.success && json.data.translation) {
          updateCurrentDraft({
            statementEn: json.data.translation,
            optionAEn: currentQ.optionAHi ? `${currentQ.optionAHi} (English translation)` : "",
            optionBEn: currentQ.optionBHi ? `${currentQ.optionBHi} (English translation)` : "",
            optionCEn: currentQ.optionCHi ? `${currentQ.optionCHi} (English translation)` : "",
            optionDEn: currentQ.optionDHi ? `${currentQ.optionDHi} (English translation)` : "",
          });
        }
      }
      toast.success("Bilingual translation synced successfully!", { id: "translate" });
    } catch {
      toast.error("Translation failed. Check connection.", { id: "translate" });
    }
  };

  // 2. Solve with AI
  const handleSolveWithAi = async () => {
    toast.loading("Generating step-by-step bilingual solution with AI...", { id: "solve" });
    try {
      const statement = currentQ.statementEn || currentQ.statementHi;
      const res = await fetch("/api/team/questions/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "solution",
          payload: {
            statement,
            options: {
              A: currentQ.optionAEn || currentQ.optionAHi,
              B: currentQ.optionBEn || currentQ.optionBHi,
              C: currentQ.optionCEn || currentQ.optionCHi,
              D: currentQ.optionDEn || currentQ.optionDHi,
            },
            correctAnswer: currentQ.correctOption,
          },
        }),
      });
      const json = await res.json();
      if (json.success && json.data.solution) {
        const sol = json.data.solution;
        updateCurrentDraft({
          solutionEn: sol.detailedSolutionEn,
          solutionHi: sol.detailedSolutionHi,
          correctOption: sol.correctOption || currentQ.correctOption,
        });
        toast.success("AI Solution generated!", { id: "solve" });
      }
    } catch {
      toast.error("AI solution generation error.", { id: "solve" });
    }
  };

  // 3. Save Question
  const handleSaveQuestion = async () => {
    toast.loading("Saving question...", { id: "save" });
    try {
      const res = await fetch("/api/team/questions/engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: currentQ.subject,
          chapter: currentQ.chapter,
          topic: currentQ.topic,
          subTopic: currentQ.subTopic,
          type: currentQ.type,
          difficulty: currentQ.difficulty,
          statementHi: currentQ.statementHi,
          statementEn: currentQ.statementEn,
          optionsHi: {
            A: currentQ.optionAHi,
            B: currentQ.optionBHi,
            C: currentQ.optionCHi,
            D: currentQ.optionDHi,
          },
          optionsEn: {
            A: currentQ.optionAEn,
            B: currentQ.optionBEn,
            C: currentQ.optionCEn,
            D: currentQ.optionDEn,
          },
          correctOptionIds: [currentQ.correctOption],
          solutionHi: currentQ.solutionHi,
          solutionEn: currentQ.solutionEn,
          imageUrl: currentQ.imageUrl,
          dppId: dppId || undefined,
          testSectionId: testId || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        updateCurrentDraft({ isSaved: true, questionCode: json.data.question.questionCode });
        toast.success(`Question Q.${currentQuestionNumber} Saved! (ID: ${json.data.question.questionCode})`, {
          id: "save",
        });
      } else {
        toast.error(json.error || "Could not save question", { id: "save" });
      }
    } catch {
      toast.error("Network error while saving question", { id: "save" });
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionNumber < totalQuestionsCount) {
      const nextNum = currentQuestionNumber + 1;
      setCurrentQuestionNumber(nextNum);
      setJumpInput(String(nextNum));
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionNumber > 1) {
      const prevNum = currentQuestionNumber - 1;
      setCurrentQuestionNumber(prevNum);
      setJumpInput(String(prevNum));
    }
  };

  const handleJumpToGo = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(jumpInput, 10);
    if (!isNaN(num) && num >= 1 && num <= totalQuestionsCount) {
      setCurrentQuestionNumber(num);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#f4f7fb] text-[#121c2c] overflow-hidden font-sans select-none">
      {/* 1. LEFT BLUE SIDEBAR: Test Navigation & Question Number Palette */}
      <aside
        className={`bg-[#002f6c] text-white flex flex-col justify-between shrink-0 transition-all duration-300 z-30 relative shadow-2xl ${
          sidebarCollapsed ? "w-14" : "w-64"
        }`}
      >
        <div className="p-3 border-b border-blue-900/60">
          <div className="flex items-center justify-between">
            <Link
              href={backHref}
              className="flex items-center gap-1.5 text-xs font-bold text-blue-200 hover:text-white transition"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              {!sidebarCollapsed && <span>Back</span>}
            </Link>

            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1 rounded text-blue-300 hover:text-white hover:bg-blue-800 transition"
              title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              <span className="material-symbols-outlined text-base">
                {sidebarCollapsed ? "chevron_right" : "chevron_left"}
              </span>
            </button>
          </div>

          {!sidebarCollapsed && (
            <div className="mt-3">
              <h2 className="font-extrabold text-sm text-white tracking-tight">{title}</h2>
              <p className="text-[11px] text-blue-300 font-mono mt-0.5">
                {Object.values(questionsMap).filter((q) => q.isSaved).length} / {totalQuestionsCount}{" "}
                Questions Completed
              </p>
            </div>
          )}
        </div>

        {/* Subjects & Question Grid */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 no-scrollbar">
          {subjects.map((sub) => {
            const isSubActive = activeSubject === sub.name;
            return (
              <div key={sub.name} className="space-y-2">
                <button
                  type="button"
                  onClick={() => setActiveSubject(sub.name)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition ${
                    isSubActive
                      ? "bg-blue-800 text-white shadow-sm"
                      : "text-blue-200 hover:bg-blue-900/50"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-xs">
                      {isSubActive ? "expand_more" : "chevron_right"}
                    </span>
                    {!sidebarCollapsed && <span>{sub.name}</span>}
                  </span>
                  {!sidebarCollapsed && (
                    <span className="text-[10px] font-mono text-blue-300">
                      {sub.count}/{sub.total}
                    </span>
                  )}
                </button>

                {isSubActive && (
                  <div className="pt-1">
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
                      {Array.from({ length: Math.min(sub.total, 45) }).map((_, idx) => {
                        const qNum = idx + 1;
                        const isCurrent = currentQuestionNumber === qNum;
                        const isSaved = questionsMap[qNum]?.isSaved;

                        return (
                          <button
                            key={qNum}
                            type="button"
                            onClick={() => {
                              setCurrentQuestionNumber(qNum);
                              setJumpInput(String(qNum));
                            }}
                            className={`h-7 rounded-md font-bold text-[11px] flex items-center justify-center transition ${
                              isCurrent
                                ? "bg-amber-400 text-black ring-2 ring-white font-black scale-105"
                                : isSaved
                                ? "bg-[#00c853] text-white hover:bg-emerald-600"
                                : "bg-blue-950/80 text-blue-200 border border-blue-800/80 hover:bg-blue-900"
                            }`}
                          >
                            {qNum}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!sidebarCollapsed && (
          <div className="p-3 border-t border-blue-900/60 text-[10px] text-blue-300 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#00c853]" />
              <span>Green = Saved</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Yellow = Current</span>
            </span>
          </div>
        )}
      </aside>

      {/* 2. MAIN WORKSPACE AREA */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header Ribbon */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 shrink-0 space-y-2.5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base text-[#002f6c]">
                {activeSubject}
              </span>
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 font-mono">
                Q. {currentQuestionNumber} / {totalQuestionsCount}
              </span>
              {currentQ.questionCode && (
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                  ID: {currentQ.questionCode}
                </span>
              )}
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                PUBLISHED
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setViewMode("side-by-side")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    viewMode === "side-by-side"
                      ? "bg-white text-[#002f6c] shadow-sm"
                      : "text-slate-600 hover:text-black"
                  }`}
                >
                  हिंदी + English — Side by Side
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("hindi")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    viewMode === "hindi"
                      ? "bg-white text-[#002f6c] shadow-sm"
                      : "text-slate-600 hover:text-black"
                  }`}
                >
                  हिंदी Only
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("english")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    viewMode === "english"
                      ? "bg-white text-[#002f6c] shadow-sm"
                      : "text-slate-600 hover:text-black"
                  }`}
                >
                  English Only
                </button>
              </div>

              <button
                type="button"
                className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 transition flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">history</span>
                <span>Import from Previous</span>
              </button>
            </div>
          </div>

          {/* Taxonomy & Classification Fields */}
          <div className="grid grid-cols-2 sm:grid-cols-7 gap-2 pt-1 border-t border-slate-100 text-xs">
            <div>
              <label className="text-[10px] font-bold text-slate-500 block">Subject</label>
              <select
                value={currentQ.subject}
                onChange={(e) => updateCurrentDraft({ subject: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 px-2 py-1 rounded-lg text-xs font-semibold text-slate-800"
              >
                <option value="Physics">Physics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Biology">Biology</option>
                <option value="Mathematics">Mathematics</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 block">Chapter</label>
              <input
                type="text"
                placeholder="Chapter Name"
                value={currentQ.chapter || ""}
                onChange={(e) => updateCurrentDraft({ chapter: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 px-2 py-1 rounded-lg text-xs font-medium"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 block">Topic</label>
              <input
                type="text"
                placeholder="Topic Name"
                value={currentQ.topic || ""}
                onChange={(e) => updateCurrentDraft({ topic: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 px-2 py-1 rounded-lg text-xs font-medium"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 block">Sub-Topic</label>
              <input
                type="text"
                placeholder="Sub-topic Name"
                value={currentQ.subTopic || ""}
                onChange={(e) => updateCurrentDraft({ subTopic: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 px-2 py-1 rounded-lg text-xs font-medium"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 block">Level (Difficulty)</label>
              <select
                value={currentQ.difficulty}
                onChange={(e) => updateCurrentDraft({ difficulty: e.target.value as any })}
                className="w-full bg-slate-50 border border-slate-300 px-2 py-1 rounded-lg text-xs font-semibold text-slate-800"
              >
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 block">Question Type</label>
              <select
                value={currentQ.type}
                onChange={(e) => updateCurrentDraft({ type: e.target.value as any })}
                className="w-full bg-slate-50 border border-slate-300 px-2 py-1 rounded-lg text-xs font-semibold text-slate-800"
              >
                <option value="SINGLE_CORRECT">Single Correct</option>
                <option value="MULTIPLE_CORRECT">Multiple Correct</option>
                <option value="NUMERICAL">Numerical</option>
                <option value="ASSERTION_REASON">Assertion - Reason</option>
                <option value="MATCH_COLUMN">Match Column</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 block">Marks (+ / -)</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={currentQ.marks}
                  onChange={(e) => updateCurrentDraft({ marks: parseInt(e.target.value, 10) || 4 })}
                  className="w-1/2 bg-slate-50 border border-slate-300 px-1.5 py-1 rounded-lg text-xs font-bold text-emerald-700 text-center"
                />
                <input
                  type="number"
                  value={currentQ.negativeMarks}
                  onChange={(e) =>
                    updateCurrentDraft({ negativeMarks: parseInt(e.target.value, 10) || 1 })
                  }
                  className="w-1/2 bg-slate-50 border border-slate-300 px-1.5 py-1 rounded-lg text-xs font-bold text-rose-700 text-center"
                />
              </div>
            </div>
          </div>
        </header>

        {/* OCR / Screenshot Fast-Fill Banner */}
        <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-xl border border-dashed border-blue-400 bg-blue-50/50 text-[#002f6c] font-medium flex items-center gap-2 cursor-pointer hover:bg-blue-100/50 transition">
              <span className="material-symbols-outlined text-sm text-blue-600">content_paste</span>
              <span>Click here and paste (Ctrl+V) a screenshot — statement & options will auto-fill</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Shared diagram:</span>
              <input
                type="file"
                className="text-[11px] text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleSingleClickTranslate}
            className="px-3.5 py-1.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-900 font-extrabold text-xs transition flex items-center gap-1.5 shadow-sm"
          >
            <span className="material-symbols-outlined text-sm text-purple-600">auto_fix_high</span>
            <span>Single-Click Auto-Translate (Hindi ↔ English)</span>
          </button>
        </div>

        {/* DUAL COLUMN SIDE-BY-SIDE EDITOR WORKSPACE */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* LEFT COLUMN: HINDI (हिंदी) */}
            {(viewMode === "side-by-side" || viewMode === "hindi") && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
                  <span className="text-xs font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                    हिंदी (Hindi Version)
                  </span>
                </div>

                {/* 1. Hindi Statement */}
                <div className="space-y-1.5">
                  <div className="bg-white border border-slate-300 rounded-2xl p-3 shadow-sm focus-within:border-blue-600 transition">
                    <textarea
                      rows={3}
                      placeholder="हिंदी में प्रश्न कथन लिखें..."
                      value={currentQ.statementHi}
                      onChange={(e) => updateCurrentDraft({ statementHi: e.target.value })}
                      className="w-full text-xs sm:text-sm text-slate-900 outline-none resize-none font-sans leading-relaxed"
                    />
                  </div>
                  {currentQ.statementHi && (
                    <div className="p-2.5 rounded-xl bg-slate-100 text-xs text-slate-700 border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                        Preview:
                      </span>
                      <p>{currentQ.statementHi}</p>
                    </div>
                  )}
                </div>

                {/* 2. Hindi Options A, B, C, D */}
                <div className="space-y-2.5">
                  {[
                    { key: "A", val: currentQ.optionAHi, setKey: "optionAHi" },
                    { key: "B", val: currentQ.optionBHi, setKey: "optionBHi" },
                    { key: "C", val: currentQ.optionCHi, setKey: "optionCHi" },
                    { key: "D", val: currentQ.optionDHi, setKey: "optionDHi" },
                  ].map((opt) => {
                    const isCorrect = currentQ.correctOption === opt.key;
                    return (
                      <div
                        key={opt.key}
                        className={`p-2.5 rounded-2xl border transition ${
                          isCorrect
                            ? "bg-emerald-50/80 border-emerald-500 shadow-sm"
                            : "bg-white border-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <button
                            type="button"
                            onClick={() => updateCurrentDraft({ correctOption: opt.key })}
                            className={`w-6 h-6 rounded-full font-extrabold text-xs flex items-center justify-center transition ${
                              isCorrect
                                ? "bg-[#00c853] text-white shadow"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {opt.key}
                          </button>
                          <input
                            type="text"
                            placeholder={`विकल्प (${opt.key}) हिंदी पाठ...`}
                            value={opt.val}
                            onChange={(e) => updateCurrentDraft({ [opt.setKey]: e.target.value })}
                            className="flex-1 text-xs sm:text-sm font-medium text-slate-900 outline-none bg-transparent"
                          />
                        </div>
                        {opt.val && (
                          <div className="pl-8 text-[11px] text-slate-500 border-t border-slate-100 pt-1">
                            <span className="text-[9px] uppercase font-bold text-slate-400">Preview: </span>
                            {opt.val}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 3. Hindi Detailed Solution */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-800 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">lightbulb</span>
                      <span>Solution (हिंदी) *</span>
                    </span>
                  </div>
                  <div className="bg-white border border-slate-300 rounded-2xl p-3 shadow-sm focus-within:border-blue-600">
                    <textarea
                      rows={6}
                      placeholder="**What is asked:** ...\n**Approach:** ...\n**Solution:** ...\nअतः, सही विकल्प C है।"
                      value={currentQ.solutionHi}
                      onChange={(e) => updateCurrentDraft({ solutionHi: e.target.value })}
                      className="w-full text-xs text-slate-900 outline-none resize-none font-mono leading-relaxed"
                    />
                  </div>
                  {currentQ.solutionHi && (
                    <div className="p-3 rounded-xl bg-slate-100 text-xs text-slate-700 border border-slate-200 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Preview:
                      </span>
                      <div className="whitespace-pre-line leading-relaxed font-sans">{currentQ.solutionHi}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* RIGHT COLUMN: ENGLISH */}
            {(viewMode === "side-by-side" || viewMode === "english") && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
                  <span className="text-xs font-black text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                    English (English Version)
                  </span>
                </div>

                {/* 1. English Statement */}
                <div className="space-y-1.5">
                  <div className="bg-white border border-slate-300 rounded-2xl p-3 shadow-sm focus-within:border-blue-600 transition">
                    <textarea
                      rows={3}
                      placeholder="Write question statement in English..."
                      value={currentQ.statementEn}
                      onChange={(e) => updateCurrentDraft({ statementEn: e.target.value })}
                      className="w-full text-xs sm:text-sm text-slate-900 outline-none resize-none font-sans leading-relaxed"
                    />
                  </div>
                  {currentQ.statementEn && (
                    <div className="p-2.5 rounded-xl bg-slate-100 text-xs text-slate-700 border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                        Preview:
                      </span>
                      <p>{currentQ.statementEn}</p>
                    </div>
                  )}
                </div>

                {/* 2. English Options A, B, C, D */}
                <div className="space-y-2.5">
                  {[
                    { key: "A", val: currentQ.optionAEn, setKey: "optionAEn" },
                    { key: "B", val: currentQ.optionBEn, setKey: "optionBEn" },
                    { key: "C", val: currentQ.optionCEn, setKey: "optionCEn" },
                    { key: "D", val: currentQ.optionDEn, setKey: "optionDEn" },
                  ].map((opt) => {
                    const isCorrect = currentQ.correctOption === opt.key;
                    return (
                      <div
                        key={opt.key}
                        className={`p-2.5 rounded-2xl border transition ${
                          isCorrect
                            ? "bg-emerald-50/80 border-emerald-500 shadow-sm"
                            : "bg-white border-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <button
                            type="button"
                            onClick={() => updateCurrentDraft({ correctOption: opt.key })}
                            className={`w-6 h-6 rounded-full font-extrabold text-xs flex items-center justify-center transition ${
                              isCorrect
                                ? "bg-[#00c853] text-white shadow"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {opt.key}
                          </button>
                          <input
                            type="text"
                            placeholder={`Option (${opt.key}) English text...`}
                            value={opt.val}
                            onChange={(e) => updateCurrentDraft({ [opt.setKey]: e.target.value })}
                            className="flex-1 text-xs sm:text-sm font-medium text-slate-900 outline-none bg-transparent"
                          />
                        </div>
                        {opt.val && (
                          <div className="pl-8 text-[11px] text-slate-500 border-t border-slate-100 pt-1">
                            <span className="text-[9px] uppercase font-bold text-slate-400">Preview: </span>
                            {opt.val}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 3. English Detailed Solution */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-800 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">lightbulb</span>
                      <span>Solution (English) *</span>
                    </span>
                  </div>
                  <div className="bg-white border border-slate-300 rounded-2xl p-3 shadow-sm focus-within:border-blue-600">
                    <textarea
                      rows={6}
                      placeholder="**What is asked:** ...\n**Approach:** ...\n**Solution:** ...\nHence, the correct option is C."
                      value={currentQ.solutionEn}
                      onChange={(e) => updateCurrentDraft({ solutionEn: e.target.value })}
                      className="w-full text-xs text-slate-900 outline-none resize-none font-mono leading-relaxed"
                    />
                  </div>
                  {currentQ.solutionEn && (
                    <div className="p-3 rounded-xl bg-slate-100 text-xs text-slate-700 border border-slate-200 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Preview:
                      </span>
                      <div className="whitespace-pre-line leading-relaxed font-sans">{currentQ.solutionEn}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* AI HELPER ACTIONS FOOTER BAR */}
          <div className="p-3 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSolveWithAi}
                className="px-4 py-2 rounded-xl bg-[#6b46c1] hover:bg-[#5b3da5] text-white font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-sm">auto_awesome</span>
                <span>Solve with AI (fills solution in each enabled language)</span>
              </button>

              <button
                type="button"
                className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-sm text-slate-500">add_photo_alternate</span>
                <span>Upload Solution Image</span>
              </button>
            </div>

            <span className="text-slate-500 text-[11px] font-medium">
              📋 Or click here and paste (Ctrl+V) a solution screenshot
            </span>
          </div>
        </main>

        {/* STICKY BOTTOM NAVIGATION BAR */}
        <footer className="bg-white border-t border-slate-200 px-4 sm:px-6 py-3 shrink-0 flex items-center justify-between shadow-lg">
          <button
            type="button"
            onClick={handlePrevQuestion}
            disabled={currentQuestionNumber === 1}
            className="px-5 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs disabled:opacity-40 transition flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            <span>Prev</span>
          </button>

          <form onSubmit={handleJumpToGo} className="flex items-center gap-2 text-xs">
            <span className="font-bold text-[#002f6c]">
              Question {currentQuestionNumber} / {totalQuestionsCount}
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-500">Jump to:</span>
            <input
              type="number"
              min={1}
              max={totalQuestionsCount}
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              className="w-14 px-2 py-1 bg-slate-100 border border-slate-300 rounded-lg text-center font-bold text-xs"
            />
            <button
              type="submit"
              className="px-2.5 py-1 rounded-lg bg-slate-800 text-white font-bold text-xs hover:bg-slate-700 transition"
            >
              Go
            </button>
          </form>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleSaveQuestion}
              className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md transition flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">save</span>
              <span>Update / Save</span>
            </button>

            <button
              type="button"
              onClick={handleNextQuestion}
              disabled={currentQuestionNumber === totalQuestionsCount}
              className="px-5 py-2 rounded-xl bg-[#002f6c] hover:bg-[#001f4c] text-white font-extrabold text-xs shadow-md transition flex items-center gap-1 disabled:opacity-40"
            >
              <span>Next</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
