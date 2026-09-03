"use client";

import React from "react";
import { NEET_QUESTION_TYPES } from "@/lib/questions/neet-question-classifier";

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

  const currentTypeDef = NEET_QUESTION_TYPES.find((t) => t.id === type) || NEET_QUESTION_TYPES[0];

  return (
    <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <span className="material-symbols-outlined text-base">account_tree</span>
          </div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
            Curriculum &amp; Taxonomy
          </h4>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 text-[10px] font-mono font-bold">
          18 NEET Formats
        </span>
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
            placeholder="e.g. Structure of Atom / Cell: The Unit of Life"
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

        {/* 18 NEET Question Types */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-slate-700 dark:text-slate-300 font-bold">
              NEET Question Type *
            </label>
            {currentTypeDef && (
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold font-mono">
                {currentTypeDef.badge}
              </span>
            )}
          </div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-slate-900 dark:text-white font-medium focus:border-blue-500 focus:bg-white outline-none transition cursor-pointer"
          >
            <optgroup label="Standard & Calculations">
              <option value="SINGLE_CORRECT">1. Single Correct MCQ (एकल सही)</option>
              <option value="TABLE_BASED">2. Table-based MCQ (तालिका आधारित)</option>
              <option value="SEQUENCE_ORDER">9. Sequence / Arrangement (क्रम / व्यवस्था)</option>
              <option value="EXCEPT_TYPE">11. EXCEPT Type (अपवाद प्रकार)</option>
              <option value="NUMERICAL">12. Numerical / Calculation (गणना आधारित)</option>
            </optgroup>
            <optgroup label="Statement & Reasoning">
              <option value="ASSERTION_REASON">3. Assertion–Reason (अभिकथन और कारण)</option>
              <option value="STATEMENT_BASED">4. Statement-based (कथन आधारित)</option>
              <option value="TWO_STATEMENT">5. Two-Statement (Statement I & II)</option>
              <option value="CORRECT_INCORRECT_STATEMENT">10. Correct / Incorrect Statement (सही / गलत कथन)</option>
              <option value="MULTI_STATEMENT_COMBINATION">16. Multi-Statement Combination (3+ कथन संयोजन)</option>
            </optgroup>
            <optgroup label="Match Columns">
              <option value="MATCH_2_COLUMN">6. Match the Column — 2 Columns (2 कॉलम मिलान)</option>
              <option value="MATCH_3_COLUMN">7. Match the Column — 3 Columns (3 कॉलम मिलान)</option>
              <option value="MATCH_CONCEPTUAL">8. Match the Column — Conceptual (संकल्पनात्मक मिलान)</option>
              <option value="CONCEPT_TABLE_COMBINATION">17. Concept + Table Combination (संकल्पना + तालिका)</option>
            </optgroup>
            <optgroup label="Visual, Diagrams & Flowcharts">
              <option value="DIAGRAM_BASED">13. Diagram-based (चित्र आधारित)</option>
              <option value="FIGURE_IDENTIFICATION_TABLE">14. Figure Identification + Table (चित्र पहचान + तालिका)</option>
              <option value="FLOWCHART_BASED">15. Flowchart-based (फ्लोचार्ट आधारित)</option>
              <option value="IMAGE_STATEMENT_COMBINATION">18. Image + Statement Combination (चित्र + कथन)</option>
            </optgroup>
          </select>
          {currentTypeDef && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 italic">
              <b>Rule:</b> {currentTypeDef.identificationRule}
            </p>
          )}
        </div>

        {/* Difficulty */}
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
            placeholder="e.g. NEET 2024 / AIPMT 2015"
            value={pyqSource}
            onChange={(e) => setPyqSource(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-slate-900 dark:text-white font-medium focus:border-blue-500 focus:bg-white outline-none transition placeholder-slate-400"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Taxonomy Tags</label>
          <div className="flex gap-1.5 mb-2">
            <input
              type="text"
              placeholder="Add tag..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-slate-900 dark:text-white font-medium focus:border-blue-500 focus:bg-white outline-none transition placeholder-slate-400 text-xs"
            />
            <button
              type="button"
              onClick={handleAddTag}
              className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 font-bold text-xs text-slate-700 dark:text-slate-200"
            >
              Add
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-mono text-[10px] font-bold"
              >
                <span>{t}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(t)}
                  className="hover:text-red-500 text-slate-400 ml-0.5"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}