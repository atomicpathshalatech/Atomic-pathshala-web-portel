"use client";

import React from "react";

interface QuestionTaxonomySidebarProps {
  subject: string;
  setSubject: (val: string) => void;
  chapter: string;
  setChapter: (val: string) => void;
  topic: string;
  setTopic: (val: string) => void;
  subTopic: string;
  setSubTopic: (val: string) => void;
  type: string;
  setType: (val: string) => void;
  difficulty: string;
  setDifficulty: (val: string) => void;
  category: string;
  setCategory: (val: string) => void;
  pyqSource: string;
  setPyqSource: (val: string) => void;
  tags: string[];
  setTags: (val: string[]) => void;
}

export function QuestionTaxonomySidebar({
  subject,
  setSubject,
  chapter,
  setChapter,
  topic,
  setTopic,
  subTopic,
  setSubTopic,
  type,
  setType,
  difficulty,
  setDifficulty,
  category,
  setCategory,
  pyqSource,
  setPyqSource,
  tags,
  setTags,
}: QuestionTaxonomySidebarProps) {
  const [tagInput, setTagInput] = React.useState("");

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  return (
    <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
          <span className="material-symbols-outlined text-base">account_tree</span>
        </div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
          Curriculum &amp; Taxonomy
        </h4>
      </div>

      <div className="space-y-3.5 text-xs">
        {/* Subject */}
        <div>
          <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Subject *</label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-slate-900 dark:text-white font-medium focus:border-blue-500 focus:bg-white outline-none transition"
          >
            <option value="Physics">Physics (80xxxxxx)</option>
            <option value="Chemistry">Chemistry (82xxxxxx)</option>
            <option value="Biology">Biology (83xxxxxx)</option>
            <option value="Mathematics">Mathematics (84xxxxxx)</option>
            <option value="Science">Science (85xxxxxx)</option>
          </select>
        </div>

        {/* Chapter */}
        <div>
          <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Chapter Name *</label>
          <input
            type="text"
            placeholder="e.g. Structure of Atom / Electrostatics"
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-slate-900 dark:text-white font-medium focus:border-blue-500 focus:bg-white outline-none transition placeholder-slate-400"
          />
        </div>

        {/* Topic & Subtopic */}
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Topic</label>
            <input
              type="text"
              placeholder="e.g. Bohr's Model"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-slate-900 dark:text-white font-medium focus:border-blue-500 focus:bg-white outline-none transition placeholder-slate-400"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Sub-Topic</label>
            <input
              type="text"
              placeholder="e.g. Energy Levels"
              value={subTopic}
              onChange={(e) => setSubTopic(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-slate-900 dark:text-white font-medium focus:border-blue-500 focus:bg-white outline-none transition placeholder-slate-400"
            />
          </div>
        </div>

        {/* Question Type & Difficulty */}
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Type *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-slate-900 dark:text-white font-medium focus:border-blue-500 focus:bg-white outline-none transition"
            >
              <option value="SINGLE_CORRECT">Single Correct</option>
              <option value="MULTI_CORRECT">Multi Correct</option>
              <option value="INTEGER">Integer Type</option>
              <option value="ASSERTION_REASON">Assertion - Reason</option>
              <option value="MATCH_THE_COLUMN">Match Column</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Difficulty *</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-slate-900 dark:text-white font-medium focus:border-blue-500 focus:bg-white outline-none transition"
            >
              <option value="EASY">Easy (Foundation)</option>
              <option value="MEDIUM">Medium (NEET / JEE Main)</option>
              <option value="HARD">Hard (Advanced Level)</option>
              <option value="VERY_HARD">Very Hard (Challenger)</option>
            </select>
          </div>
        </div>

        {/* Category & Exam Tag */}
        <div>
          <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Category / Source</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-slate-900 dark:text-white font-medium focus:border-blue-500 focus:bg-white outline-none transition"
          >
            <option value="NCERT Canonical">NCERT Canonical (Line-by-line)</option>
            <option value="NCERT Exemplar">NCERT Exemplar</option>
            <option value="PYQ NEET">PYQ (NEET Past Year)</option>
            <option value="PYQ JEE Main">PYQ (JEE Main Past Year)</option>
            <option value="PYQ JEE Advanced">PYQ (JEE Advanced)</option>
            <option value="High-Yield Challenger">High-Yield Challenger</option>
            <option value="Original Atomic">Original Atomic Concept</option>
          </select>
        </div>

        {/* PYQ Source Details */}
        <div>
          <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
            PYQ Year / Citation (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. NEET 2023 (Phase 1), Question 47"
            value={pyqSource}
            onChange={(e) => setPyqSource(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-slate-900 dark:text-white font-medium focus:border-blue-500 focus:bg-white outline-none transition placeholder-slate-400"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Search &amp; Filter Tags</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Add tag (e.g. Formula-Based)..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-slate-900 dark:text-white font-medium focus:border-blue-500 focus:bg-white outline-none transition placeholder-slate-400"
            />
            <button
              type="button"
              onClick={handleAddTag}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition"
            >
              Add
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={t}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-medium flex items-center gap-1.5"
              >
                <span>#{t}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(t)}
                  className="hover:text-red-500 transition font-bold"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}