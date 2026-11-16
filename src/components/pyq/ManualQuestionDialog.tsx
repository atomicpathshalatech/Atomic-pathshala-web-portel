"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FormulaText } from "@/components/test-portal/FormulaText";

interface ManualQuestionDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultExamId?: string;
  defaultSubject?: string;
  defaultChapter?: string;
  exams: { id: string; name: string }[];
}

export function ManualQuestionDialog({
  open,
  onClose,
  onSuccess,
  defaultExamId,
  defaultSubject,
  defaultChapter,
  exams,
}: ManualQuestionDialogProps) {
  const [examId, setExamId] = useState(defaultExamId || exams[0]?.id || "");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [session, setSession] = useState("");
  const [shift, setShift] = useState("");
  const [paper, setPaper] = useState("");
  const [questionNumber, setQuestionNumber] = useState("");
  const [subject, setSubject] = useState(defaultSubject || "Physics");
  const [chapter, setChapter] = useState(defaultChapter || "");
  const [topic, setTopic] = useState("");
  const [questionType, setQuestionType] = useState("SINGLE_CORRECT");
  const [difficulty, setDifficulty] = useState("MEDIUM");
  const [statement, setStatement] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("A");
  const [solution, setSolution] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [publish, setPublish] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);

  if (!open) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!statement.trim()) {
      toast.error("Please enter the question statement.");
      return;
    }
    if (!correctAnswer.trim()) {
      toast.error("Please enter the correct answer.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/team/pyq/questions/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId,
          year: year ? parseInt(year, 10) : null,
          session: session.trim() || null,
          shift: shift.trim() || null,
          paper: paper.trim() || null,
          questionNumber: questionNumber.trim() || null,
          subject,
          chapter: chapter.trim() || null,
          topic: topic.trim() || null,
          questionType,
          difficulty,
          statement,
          options: {
            A: optionA.trim(),
            B: optionB.trim(),
            C: optionC.trim(),
            D: optionD.trim(),
          },
          correctAnswer,
          solution: solution.trim() || null,
          imageUrl: imageUrl.trim() || null,
          publish,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create question");

      toast.success(data.data?.message || "Question created successfully!");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save question");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Add Question Manually
            </h3>
            <p className="text-xs text-slate-500">
              Create a canonical PYQ question with exam sitting occurrence
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreview(!preview)}
              className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {preview ? "Edit Mode" : "Preview Formula"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                Exam *
              </label>
              <select
                value={examId}
                onChange={(e) => setExamId(e.target.value)}
                className="w-full pyq-input"
                required
              >
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                Year
              </label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2024"
                className="w-full pyq-input"
              />
            </div>

            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                Subject *
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full pyq-input"
                required
              >
                <option value="Physics">Physics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Biology">Biology</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Botany">Botany</option>
                <option value="Zoology">Zoology</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                Chapter
              </label>
              <input
                type="text"
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
                placeholder="e.g. Kinematics"
                className="w-full pyq-input"
              />
            </div>

            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                Topic
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Projectile Motion"
                className="w-full pyq-input"
              />
            </div>

            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                Session / Month
              </label>
              <input
                type="text"
                value={session}
                onChange={(e) => setSession(e.target.value)}
                placeholder="e.g. January, Phase 1"
                className="w-full pyq-input"
              />
            </div>

            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                Shift / Paper
              </label>
              <input
                type="text"
                value={shift}
                onChange={(e) => setShift(e.target.value)}
                placeholder="e.g. Shift 1, Paper 1"
                className="w-full pyq-input"
              />
            </div>

            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                Q. No. in Paper
              </label>
              <input
                type="text"
                value={questionNumber}
                onChange={(e) => setQuestionNumber(e.target.value)}
                placeholder="e.g. 15"
                className="w-full pyq-input"
              />
            </div>
          </div>

          {/* Statement */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Question Text (Supports LaTeX: $E=mc^2$ or $$...$$) *
            </label>
            {preview ? (
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-sm">
                <FormulaText text={statement || "(No text)"} />
              </div>
            ) : (
              <textarea
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
                rows={4}
                required
                placeholder="Type question statement here with LaTeX formulas..."
                className="w-full pyq-input text-xs font-mono"
              />
            )}
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(["A", "B", "C", "D"] as const).map((key) => {
              const val =
                key === "A" ? optionA : key === "B" ? optionB : key === "C" ? optionC : optionD;
              const setVal =
                key === "A" ? setOptionA : key === "B" ? setOptionB : key === "C" ? setOptionC : setOptionD;
              return (
                <div key={key}>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Option ({key})
                  </label>
                  {preview ? (
                    <div className="p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                      <span className="font-bold text-blue-600 mr-2">({key})</span>
                      <FormulaText text={val || "—"} />
                    </div>
                  ) : (
                    <div className="flex gap-1 items-center">
                      <span className="font-bold text-xs text-blue-600 w-6">({key})</span>
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => setVal(e.target.value)}
                        placeholder={`Option ${key} text`}
                        className="w-full pyq-input"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Answer & Type */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Correct Answer *
              </label>
              <input
                type="text"
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
                placeholder="A or A,B or 42"
                className="w-full pyq-input font-bold text-blue-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Question Type
              </label>
              <select
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value)}
                className="w-full pyq-input"
              >
                <option value="SINGLE_CORRECT">Single Correct MCQ</option>
                <option value="MULTIPLE_CORRECT">Multiple Correct MCQ</option>
                <option value="NUMERICAL">Numerical Value</option>
                <option value="INTEGER">Integer Type</option>
                <option value="ASSERTION_REASON">Assertion - Reason</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full pyq-input"
              >
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="direct-publish"
                  checked={publish}
                  onChange={(e) => setPublish(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <label htmlFor="direct-publish" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Publish Immediately
                </label>
              </div>
            </div>
          </div>

          {/* Solution */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Detailed Step-by-Step Solution (Protected / Login Required)
            </label>
            {preview ? (
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                <FormulaText text={solution || "(No solution entered)"} />
              </div>
            ) : (
              <textarea
                value={solution}
                onChange={(e) => setSolution(e.target.value)}
                rows={3}
                placeholder="Step-by-step derivation or explanation..."
                className="w-full pyq-input text-xs font-mono"
              />
            )}
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Diagram / Image URL (optional)
            </label>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://assets.atomicpathshala.com/..."
              className="w-full pyq-input"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="pyq-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="pyq-btn-primary px-6"
            >
              {saving ? "Saving..." : publish ? "Save & Publish Question" : "Save as Draft"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
