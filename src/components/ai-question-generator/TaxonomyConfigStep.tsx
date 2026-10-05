"use client";

import React, { useState } from "react";
import {
  BookOpen,
  Plus,
  Check,
  Search,
  CheckSquare,
  Square,
  Sliders,
  Sparkles,
  Layers,
  HelpCircle,
} from "lucide-react";
import {
  GenerationLanguage,
  GenerationPlan,
  NeetDifficulty,
  OFFICIAL_NEET_QUESTION_TYPES,
} from "@/lib/ai-question-engine/types";
import { toast } from "sonner";

interface Props {
  isPdfMode: boolean;
  subject: string;
  chapter: string;
  onSubjectChange: (s: string) => void;
  onChapterChange: (c: string) => void;
  subjectsList: Array<{ id: string; name: string }>;
  chaptersList: Array<{ id: string; title: string; displayTitle?: string }>;
  topicsList: Array<{ id: string; title: string; subtopics: string[]; isCustom?: boolean }>;
  selectedTopics: string[];
  onSelectedTopicsChange: (t: string[]) => void;
  selectedSubtopics: string[];
  onSelectedSubtopicsChange: (st: string[]) => void;
  difficulties: NeetDifficulty[];
  onDifficultiesChange: (d: NeetDifficulty[]) => void;
  questionTypes: string[];
  onQuestionTypesChange: (qt: string[]) => void;
  sourceMode?: string;
  onSourceModeChange?: (s: string) => void;
  primaryNature?: string;
  onPrimaryNatureChange?: (n: string) => void;
  imageMode?: string;
  onImageModeChange?: (im: string) => void;
  figurePreference?: string;
  onFigurePreferenceChange?: (fp: string) => void;
  cognitiveLevel?: string;
  onCognitiveLevelChange?: (cl: string) => void;
  language: GenerationLanguage;
  onLanguageChange: (l: GenerationLanguage) => void;
  totalQuestions: number;
  onTotalQuestionsChange: (n: number) => void;
  generationPlan: GenerationPlan;
  onGenerationPlanChange: (plan: GenerationPlan) => void;
  onCustomTopicAdded: (newTopic: string, subtopics?: string[]) => Promise<void>;
}

export function TaxonomyConfigStep({
  isPdfMode,
  subject,
  chapter,
  onSubjectChange,
  onChapterChange,
  subjectsList,
  chaptersList,
  topicsList,
  selectedTopics,
  onSelectedTopicsChange,
  selectedSubtopics,
  onSelectedSubtopicsChange,
  difficulties,
  onDifficultiesChange,
  questionTypes,
  onQuestionTypesChange,
  sourceMode = "NCERT_ONLY",
  onSourceModeChange,
  primaryNature = "Diagram-Based",
  onPrimaryNatureChange,
  imageMode = "NCERT_FIGURE_ONLY",
  onImageModeChange,
  figurePreference = "AUTO",
  onFigurePreferenceChange,
  cognitiveLevel = "L3 Apply",
  onCognitiveLevelChange,
  language,
  onLanguageChange,
  totalQuestions,
  onTotalQuestionsChange,
  generationPlan,
  onGenerationPlanChange,
  onCustomTopicAdded,
}: Props) {
  const [topicSearch, setTopicSearch] = useState("");
  const [showAddCustomTopic, setShowAddCustomTopic] = useState(false);
  const [customTopicInput, setCustomTopicInput] = useState("");
  const [customSubtopicInput, setCustomSubtopicInput] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);

  // Available subtopics from selected topics
  const availableSubtopics = Array.from(
    new Set(
      topicsList
        .filter((t) => selectedTopics.includes(t.title))
        .flatMap((t) => t.subtopics || [])
    )
  );

  // Filtered topics by search
  const filteredTopics = topicsList.filter((t) =>
    t.title.toLowerCase().includes(topicSearch.toLowerCase().trim())
  );

  // Difficulty Toggle
  const toggleDifficulty = (diff: NeetDifficulty) => {
    if (difficulties.includes(diff)) {
      if (difficulties.length === 1) {
        toast.info("At least one difficulty level must be selected.");
        return;
      }
      onDifficultiesChange(difficulties.filter((d) => d !== diff));
    } else {
      onDifficultiesChange([...difficulties, diff]);
    }
  };

  // Question Type Toggle
  const toggleQuestionType = (typeId: string) => {
    let updatedTypes: string[];
    if (questionTypes.includes(typeId)) {
      if (questionTypes.length === 1) {
        toast.info("At least one question type must be selected.");
        return;
      }
      updatedTypes = questionTypes.filter((t) => t !== typeId);
    } else {
      updatedTypes = [...questionTypes, typeId];
    }
    onQuestionTypesChange(updatedTypes);
    calculateAutoMix(totalQuestions, updatedTypes, difficulties);
  };

  // Topic Multi-select helpers
  const toggleTopic = (title: string) => {
    if (selectedTopics.includes(title)) {
      onSelectedTopicsChange(selectedTopics.filter((t) => t !== title));
    } else {
      onSelectedTopicsChange([...selectedTopics, title]);
    }
  };

  const handleSelectAllTopics = () => {
    onSelectedTopicsChange(topicsList.map((t) => t.title));
  };

  const handleClearAllTopics = () => {
    onSelectedTopicsChange([]);
  };

  // Subtopic Toggle
  const toggleSubtopic = (st: string) => {
    if (selectedSubtopics.includes(st)) {
      onSelectedSubtopicsChange(selectedSubtopics.filter((x) => x !== st));
    } else {
      onSelectedSubtopicsChange([...selectedSubtopics, st]);
    }
  };

  // Auto-Mix Generation Plan Distribution
  const calculateAutoMix = (
    qty: number,
    types: string[] = questionTypes,
    diffs: NeetDifficulty[] = difficulties
  ) => {
    const safeQty = Math.max(1, qty);
    const typeCount = types.length || 1;
    const basePerType = Math.floor(safeQty / typeCount);
    let remainder = safeQty % typeCount;

    const items = types.map((t) => {
      const def = OFFICIAL_NEET_QUESTION_TYPES.find((x) => x.id === t);
      const count = basePerType + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
      return {
        questionTypeId: t,
        typeName: def?.name || t,
        count,
      };
    });

    const diffMix: Record<NeetDifficulty, number> = {
      EASY: 0,
      MEDIUM: 0,
      HARD: 0,
      ULTRA: 0,
    };

    const diffShare = Math.floor(safeQty / diffs.length);
    let diffRem = safeQty % diffs.length;
    diffs.forEach((d) => {
      diffMix[d] = diffShare + (diffRem > 0 ? 1 : 0);
      if (diffRem > 0) diffRem--;
    });

    onGenerationPlanChange({
      totalQuestions: safeQty,
      items,
      difficultyMix: diffMix,
      language,
    });
  };

  // Add Custom Topic submit
  const handleAddCustomTopicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTopic = customTopicInput.trim();
    if (!cleanTopic) {
      toast.error("Please enter a topic name.");
      return;
    }

    setAddingCustom(true);
    try {
      await onCustomTopicAdded(
        cleanTopic,
        customSubtopicInput.trim() ? [customSubtopicInput.trim()] : []
      );
      setShowAddCustomTopic(false);
      setCustomTopicInput("");
      setCustomSubtopicInput("");
      toast.success("Custom topic added to current generation and persistent memory!");
    } catch {
      toast.error("Failed to add custom topic.");
    } finally {
      setAddingCustom(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Subject & Chapter (If not already configured in PDF mode) */}
      {!isPdfMode && (
        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6">
          <h3 className="text-sm font-black text-slate-900 mb-1 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span>Academic Taxonomy: Subject &amp; Chapter</span>
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Connects to canonical Atomic Pathshala NCERT syllabus taxonomy.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Subject <span className="text-rose-500">*</span>
              </label>
              <select
                value={subject}
                onChange={(e) => {
                  onSubjectChange(e.target.value);
                  onChapterChange("");
                }}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-2xl text-xs font-semibold text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="">-- Select Subject --</option>
                {subjectsList.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Chapter <span className="text-rose-500">*</span>
              </label>
              <select
                value={chapter}
                onChange={(e) => onChapterChange(e.target.value)}
                disabled={!subject}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-2xl text-xs font-semibold text-slate-900 outline-none focus:border-blue-500 disabled:opacity-50"
              >
                <option value="">-- Select Chapter --</option>
                {chaptersList.map((c) => (
                  <option key={c.id} value={c.title}>
                    {c.displayTitle || c.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 2. Topic Selector: Searchable Multi-Select Box (Section 16) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Syllabus Topics (Multi-Select)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedTopics.length} selected of {topicsList.length} available topics
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAllTopics}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 px-3 py-1 bg-blue-50 rounded-lg"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={handleClearAllTopics}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 px-3 py-1 bg-slate-100 rounded-lg"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Search & Add Custom Button */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search topics..."
              value={topicSearch}
              onChange={(e) => setTopicSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAddCustomTopic(!showAddCustomTopic)}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
          >
            <Plus className="w-4 h-4 text-slate-600" />
            <span>Add Custom Topic</span>
          </button>
        </div>

        {/* Add Custom Topic Input Form */}
        {showAddCustomTopic && (
          <form
            onSubmit={handleAddCustomTopicSubmit}
            className="p-4 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-3 animate-in fade-in"
          >
            <p className="text-xs font-black text-blue-950 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>+ Add Persistent Custom Topic</span>
            </p>
            <p className="text-[11px] text-blue-800">
              Normalized into taxonomy memory without duplicate spelling variations. Future teachers selecting this chapter will see it automatically.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Topic name e.g. Pedigree Analysis"
                value={customTopicInput}
                onChange={(e) => setCustomTopicInput(e.target.value)}
                className="text-xs p-2.5 bg-white border border-blue-300 rounded-xl outline-none"
              />
              <input
                type="text"
                placeholder="Optional subtopic e.g. X-linked recessive traits"
                value={customSubtopicInput}
                onChange={(e) => setCustomSubtopicInput(e.target.value)}
                className="text-xs p-2.5 bg-white border border-blue-300 rounded-xl outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddCustomTopic(false)}
                className="px-3 py-1.5 text-xs text-slate-500 font-bold hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addingCustom || !customTopicInput.trim()}
                className="px-4 py-1.5 text-xs bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-500 disabled:opacity-50"
              >
                {addingCustom ? "Saving..." : "Save Topic"}
              </button>
            </div>
          </form>
        )}

        {/* Scrollable Topics Grid */}
        <div className="max-h-56 overflow-y-auto border border-slate-100 rounded-2xl p-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {filteredTopics.length === 0 ? (
            <p className="text-xs text-slate-400 italic p-3 text-center col-span-2">
              {topicSearch ? "No matching topics found." : "Select a Subject and Chapter to view topics."}
            </p>
          ) : (
            filteredTopics.map((top) => {
              const isChecked = selectedTopics.includes(top.title);
              return (
                <button
                  key={top.id || top.title}
                  type="button"
                  onClick={() => toggleTopic(top.title)}
                  className={`p-2.5 rounded-xl border text-left text-xs transition flex items-center gap-2.5 ${
                    isChecked
                      ? "bg-blue-50/70 border-blue-400 text-blue-950 font-bold shadow-sm"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {isChecked ? (
                    <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-300 shrink-0" />
                  )}
                  <span className="line-clamp-1 flex-1">{top.title}</span>
                  {top.isCustom && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1 rounded">
                      Custom
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Subtopics chips if available */}
        {availableSubtopics.length > 0 && (
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <p className="text-xs font-bold text-slate-600">
              Sub-topics (Optional granular selection):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {availableSubtopics.map((st) => {
                const isSelected = selectedSubtopics.includes(st);
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => toggleSubtopic(st)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition ${
                      isSelected
                        ? "bg-blue-600 text-white border-blue-600 font-bold shadow-sm"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {st}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3. Difficulty Level Selection (EASY, MEDIUM, HARD, ULTRA - Section 19, 20) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-3 shadow-sm">
        <div>
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-600" />
            <span>Difficulty Levels (Multiple Allowed)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Based on cognitive demand. ULTRA requires high-level NEET concept synthesis, never out-of-syllabus Olympiad tricks.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["EASY", "MEDIUM", "HARD", "ULTRA"] as const).map((diff) => {
            const isSelected = difficulties.includes(diff);
            const desc =
              diff === "EASY"
                ? "Direct NCERT recall & 1-step formula"
                : diff === "MEDIUM"
                ? "Concept application & 2-step logic"
                : diff === "HARD"
                ? "Multi-step reasoning & distractor discrimination"
                : "Deep NEET syllabus conceptual synthesis";

            const activeStyles: Record<string, string> = {
              EASY: "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm",
              MEDIUM: "border-blue-500 bg-blue-50 text-blue-900 shadow-sm",
              HARD: "border-amber-500 bg-amber-50 text-amber-900 shadow-sm",
              ULTRA: "border-blue-600 bg-blue-50 text-blue-950 font-black shadow-sm",
            };

            return (
              <button
                key={diff}
                type="button"
                onClick={() => toggleDifficulty(diff)}
                className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between gap-1.5 ${
                  isSelected
                    ? activeStyles[diff]
                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-extrabold text-xs tracking-wider uppercase">{diff}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                </div>
                <p className="text-[10px] text-slate-500 leading-tight line-clamp-2">{desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. NEET Question Type System (20 Official Types - Section 21) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>NEET Question Types (Multi-Select)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {questionTypes.length} question types selected for this batch
            </p>
          </div>
          <button
            type="button"
            onClick={() => onQuestionTypesChange(OFFICIAL_NEET_QUESTION_TYPES.map((t) => t.id))}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 px-3 py-1 bg-blue-50 rounded-lg"
          >
            Select All 20 Types
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-72 overflow-y-auto p-1">
          {OFFICIAL_NEET_QUESTION_TYPES.map((typeDef) => {
            const isSelected = questionTypes.includes(typeDef.id);
            return (
              <button
                key={typeDef.id}
                type="button"
                onClick={() => toggleQuestionType(typeDef.id)}
                className={`p-2.5 rounded-2xl border text-left text-xs transition flex items-center gap-2 ${
                  isSelected
                    ? "bg-blue-50/80 border-blue-400 text-blue-950 font-bold shadow-sm"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {isSelected ? (
                  <CheckSquare className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                )}
                <span className="line-clamp-1">{typeDef.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. NCERT-FIRST & VISUAL DIAGRAM INTELLIGENCE (Sections 93-132) */}
      <div className="bg-white border-2 border-emerald-500/30 rounded-3xl p-6 space-y-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>NCERT Grounding &amp; Diagram Intelligence Engine</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Configures authentic textbook diagram extraction, strict NCERT grounding, and cognitive levels.
            </p>
          </div>
          <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 self-start sm:self-auto">
            NCERT-First Engine Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Source Mode */}
          <div>
            <label className="text-xs font-bold text-slate-800 block mb-2">
              Source Mode (Grounding Truth)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "NCERT_ONLY", label: "● NCERT Only", desc: "Strictly textbook factual" },
                { id: "NCERT_PYQ", label: "NCERT + PYQ", desc: "Textbook with PYQ styles" },
                { id: "NCERT_VERIFIED", label: "NCERT + Verified", desc: "Curated faculty sources" },
                { id: "OPEN_ACADEMIC", label: "Open Academic", desc: "General NEET syllabus" },
              ].map((m) => {
                const isSelected = sourceMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onSourceModeChange?.(m.id)}
                    className={`p-2.5 rounded-2xl border text-left transition ${
                      isSelected
                        ? "bg-emerald-50 border-emerald-500 text-emerald-950 font-bold shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div className="text-xs font-extrabold">{m.label}</div>
                    <div className="text-[10px] text-slate-500 font-normal">{m.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Image Mode */}
          <div>
            <label className="text-xs font-bold text-slate-800 block mb-2">
              Image Mode (Mandatory Figure Policy)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "NCERT_FIGURE_ONLY", label: "● NCERT Figure Only", desc: "Extracted authentic diagram" },
                { id: "NCERT_GENERATED", label: "NCERT + Generated", desc: "Textbook + AI diagram" },
                { id: "GENERATED_DIAGRAM", label: "Generated Diagram", desc: "Synthetic scientific figure" },
                { id: "NONE", label: "Text Only (No Image)", desc: "Standard text question" },
              ].map((im) => {
                const isSelected = imageMode === im.id;
                return (
                  <button
                    key={im.id}
                    type="button"
                    onClick={() => onImageModeChange?.(im.id)}
                    className={`p-2.5 rounded-2xl border text-left transition ${
                      isSelected
                        ? "bg-blue-50 border-blue-500 text-blue-950 font-bold shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div className="text-xs font-extrabold">{im.label}</div>
                    <div className="text-[10px] text-slate-500 font-normal">{im.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question Nature & Visual Requirement */}
          <div>
            <label className="text-xs font-bold text-slate-800 block mb-2">
              Question Nature
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                "Diagram-Based",
                "Conceptual",
                "Numerical",
                "Application-Based",
                "Graph-Based",
                "Multi-Concept",
              ].map((nat) => {
                const isSelected = primaryNature === nat;
                return (
                  <button
                    key={nat}
                    type="button"
                    onClick={() => onPrimaryNatureChange?.(nat)}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold text-center transition ${
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {nat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cognitive Level & Figure Preference */}
          <div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-2">
                  Cognitive Depth
                </label>
                <select
                  value={cognitiveLevel}
                  onChange={(e) => onCognitiveLevelChange?.(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none"
                >
                  <option value="L1 Recall">L1 Recall (Direct fact)</option>
                  <option value="L2 Understand">L2 Understand (Concept)</option>
                  <option value="L3 Apply">L3 Apply (Application)</option>
                  <option value="L4 Analyze">L4 Analyze (Multi-step)</option>
                  <option value="L5 Evaluate">L5 Evaluate (Evaluation)</option>
                  <option value="L6 Synthesis">L6 Synthesis (Multi-concept)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 block mb-2">
                  NCERT Figure Selection
                </label>
                <div className="flex gap-2">
                  {[
                    { id: "AUTO", label: "● Auto Select" },
                    { id: "MANUAL", label: "○ Manual" },
                  ].map((fp) => {
                    const isSelected = figurePreference === fp.id;
                    return (
                      <button
                        key={fp.id}
                        type="button"
                        onClick={() => onFigurePreferenceChange?.(fp.id)}
                        className={`flex-1 py-2 px-2 rounded-xl border text-xs font-bold text-center transition ${
                          isSelected
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {fp.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Quantity, Balanced Auto-Mix & Language (Section 22, 25) */}
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-4">
        <h3 className="text-sm font-black text-slate-900">
          Batch Volume &amp; Examination Language
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total Questions */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Total Questions to Generate
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={100}
                value={totalQuestions}
                onChange={(e) => {
                  const val = Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1));
                  onTotalQuestionsChange(val);
                  calculateAutoMix(val);
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none"
              />
              <button
                type="button"
                onClick={() => calculateAutoMix(totalQuestions)}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl whitespace-nowrap shadow-sm"
                title="Create a balanced NEET-appropriate distribution across selected types"
              >
                Auto Mix
              </button>
            </div>
          </div>

          {/* Language Selection */}
          <div className="sm:col-span-2">
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Language Delivery
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["ENGLISH", "HINDI", "BOTH"] as const).map((lang) => {
                const label =
                  lang === "ENGLISH"
                    ? "English Only"
                    : lang === "HINDI"
                    ? "Hindi Only"
                    : "Both (Bilingual)";
                const isSelected = language === lang;
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => onLanguageChange(lang)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold text-center transition ${
                      isSelected
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Generation Plan Preview (Section 23) */}
        <div className="pt-3 border-t border-slate-200">
          <p className="text-xs font-black text-slate-700 mb-2">
            Generation Plan Preview ({generationPlan.totalQuestions} Questions Planned):
          </p>
          <div className="flex flex-wrap gap-2">
            {generationPlan.items
              .filter((it) => it.count > 0)
              .map((item) => (
                <span
                  key={item.questionTypeId}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-800 shadow-xs"
                >
                  {item.typeName}: <strong className="text-blue-600">{item.count}</strong>
                </span>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
