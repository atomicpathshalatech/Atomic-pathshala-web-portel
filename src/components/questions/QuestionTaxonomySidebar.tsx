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
    <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-sm">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
        <span className="material-symbols-outlined text-indigo-400 text-lg">account_tree</span>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
          Curriculum & Taxonomy
        </h4>
      </div>

      <div className="space-y-3 text-xs">
        {/* Subject */}
        <div>
          <label className="block text-slate-400 font-bold mb-1">Subject *</label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 px-3 py-2 rounded-xl text-white font-medium focus:border-amber-500"
          >
            <option value="Physics">Physics (80xxxxxx)</option>
            <option value="Chemistry">Chemistry (82xxxxxx)</option>
            <option value="Biology">Biology (83xxxxxx)</option>
            <option value="Mathematics">Mathematics (84xxxxxx)</option>
          </select>
        </div>

        {/* Chapter */}
        <div>
          <label className="block text-slate-400 font-bold mb-1">Chapter Name *</label>
          <input
            type="text"
            placeholder="e.g. Structure of Atom / Electrostatics"
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 px-3 py-2 rounded-xl text-white font-medium focus:border-amber-500"
          />
        </div>

        {/* Topic & Subtopic */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-slate-400 font-bold mb-1">Topic</label>
            <input
              type="text"
              placeholder="e.g. Bohr Model"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 px-2.5 py-2 rounded-xl text-white text-xs focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-bold mb-1">Subtopic</label>
            <input
              type="text"
              placeholder="e.g. Energy Levels"
              value={subTopic}
              onChange={(e) => setSubTopic(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 px-2.5 py-2 rounded-xl text-white text-xs focus:border-amber-500"
            />
          </div>
        </div>

        {/* Question Type & Difficulty */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-slate-400 font-bold mb-1">Question Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 px-2 py-2 rounded-xl text-white text-xs focus:border-amber-500"
            >
              <option value="SINGLE_CORRECT">Single Correct MCQ</option>
              <option value="MULTIPLE_CORRECT">Multiple Correct MCQ</option>
              <option value="NUMERICAL">Numerical Answer</option>
              <option value="STATEMENT_BASED">Statement Based</option>
              <option value="ASSERTION_REASON">Assertion - Reason</option>
              <option value="MATCH_COLUMN">Match The Column</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 px-2 py-2 rounded-xl text-white text-xs focus:border-amber-500"
            >
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </div>
        </div>

        {/* PYQ Source & Category */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-slate-400 font-bold mb-1">PYQ Source</label>
            <input
              type="text"
              placeholder="e.g. NEET 2024 / JEE 2023"
              value={pyqSource}
              onChange={(e) => setPyqSource(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 px-2.5 py-2 rounded-xl text-white text-xs focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1">Category</label>
            <input
              type="text"
              placeholder="e.g. NCERT Exemplar"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 px-2.5 py-2 rounded-xl text-white text-xs focus:border-amber-500"
            />
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-slate-400 font-bold mb-1">Tags</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add tag and press Enter"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              className="flex-1 bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded-xl text-white text-xs"
            />
            <button
              type="button"
              onClick={handleAddTag}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs"
            >
              +
            </button>
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] flex items-center gap-1 border border-slate-700"
                >
                  <span>{t}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    className="text-slate-500 hover:text-white"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}