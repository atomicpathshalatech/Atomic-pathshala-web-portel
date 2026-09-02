"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, CheckCircle2, Sparkles, AlertCircle, Layers, BookOpen, Calculator } from "lucide-react";
import { TemplateSectionInput } from "@/lib/validation/test-template";

interface Template {
  id: string;
  name: string;
  description: string | null;
  sections: Array<{
    id: string;
    name: string;
    subject: string;
    targetCount: number;
    marksPerQuestion: number | null;
    negativeMarks: number | null;
    order: number;
  }>;
}

interface TemplateBuilderProps {
  testId?: string;
  initialTemplateId?: string | null;
  onTemplateApplied?: () => void;
  onClose?: () => void;
}

const NEET_PRESET_SECTIONS: TemplateSectionInput[] = [
  { name: "Physics", subject: "Physics", targetCount: 45, marksPerQuestion: 4, negativeMarks: -1, order: 0 },
  { name: "Chemistry", subject: "Chemistry", targetCount: 45, marksPerQuestion: 4, negativeMarks: -1, order: 1 },
  { name: "Biology", subject: "Biology", targetCount: 90, marksPerQuestion: 4, negativeMarks: -1, order: 2 },
];

const JEE_PRESET_SECTIONS: TemplateSectionInput[] = [
  { name: "Physics", subject: "Physics", targetCount: 30, marksPerQuestion: 4, negativeMarks: -1, order: 0 },
  { name: "Chemistry", subject: "Chemistry", targetCount: 30, marksPerQuestion: 4, negativeMarks: -1, order: 1 },
  { name: "Mathematics", subject: "Mathematics", targetCount: 30, marksPerQuestion: 4, negativeMarks: -1, order: 2 },
];

export function TemplateBuilder({ testId, initialTemplateId, onTemplateApplied, onClose }: TemplateBuilderProps) {
  const [tab, setTab] = useState<"SELECT" | "CREATE">("SELECT");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(initialTemplateId || "");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New Template Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sections, setSections] = useState<TemplateSectionInput[]>(NEET_PRESET_SECTIONS);

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    setLoading(true);
    try {
      const res = await fetch("/api/team/test-templates");
      const json = await res.json();
      if (json.success) {
        setTemplates(json.data.templates || []);
        if (json.data.templates?.length === 0) {
          setTab("CREATE");
        }
      }
    } catch {
      setError("Failed to load templates.");
    } finally {
      setLoading(false);
    }
  }

  function handleAddSection() {
    setSections((prev) => [
      ...prev,
      {
        name: `Section ${prev.length + 1}`,
        subject: "Physics",
        targetCount: 30,
        marksPerQuestion: 4,
        negativeMarks: -1,
        order: prev.length,
      },
    ]);
  }

  function handleRemoveSection(index: number) {
    setSections((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSectionChange(index: number, field: keyof TemplateSectionInput, value: any) {
    setSections((prev) => {
      const updated = [...prev];
      const current = updated[index];
      if (current) {
        updated[index] = { ...current, [field]: value } as TemplateSectionInput;
      }
      return updated;
    });
  }

  const totalQuestions = sections.reduce((sum, s) => sum + (Number(s.targetCount) || 0), 0);
  const totalMarks = sections.reduce(
    (sum, s) => sum + (Number(s.targetCount) || 0) * (Number(s.marksPerQuestion) || 0),
    0
  );

  async function handleCreateAndApply() {
    if (!name.trim()) {
      setError("Please provide a template name");
      return;
    }
    if (sections.length === 0) {
      setError("Please add at least one section");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      // 1. Create Template
      const res = await fetch("/api/team/test-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          sections,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to create template");
      }

      const newTemplateId = json.data.template.id;

      // 2. If testId provided, apply it to the test
      if (testId) {
        const applyRes = await fetch(`/api/team/tests/${testId}/template`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId: newTemplateId }),
        });
        const applyJson = await applyRes.json();
        if (!applyRes.ok || !applyJson.success) {
          throw new Error(applyJson.error?.message || "Failed to apply template to test");
        }
      }

      onTemplateApplied?.();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApplyExisting() {
    if (!selectedTemplateId) {
      setError("Please select a template to apply");
      return;
    }
    if (!testId) return;

    setSubmitting(true);
    setError(null);
    try {
      const applyRes = await fetch(`/api/team/tests/${testId}/template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: selectedTemplateId }),
      });
      const applyJson = await applyRes.json();
      if (!applyRes.ok || !applyJson.success) {
        throw new Error(applyJson.error?.message || "Failed to apply template to test");
      }

      onTemplateApplied?.();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden max-w-3xl w-full">
      {/* Header */}
      <div className="bg-slate-900 text-white p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Test Template Configuration</h2>
            <p className="text-xs text-slate-400">Configure multi-subject sections, question counts & marking scheme</p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
          <button
            type="button"
            onClick={() => setTab("SELECT")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tab === "SELECT" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
            }`}
          >
            Saved Templates ({templates.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("CREATE")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tab === "CREATE" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
            }`}
          >
            + Create New Template
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        {tab === "SELECT" ? (
          <div>
            {loading ? (
              <div className="py-12 text-center text-slate-400 text-sm">Loading available templates...</div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-500 text-sm mb-3">No templates found.</p>
                <button
                  type="button"
                  onClick={() => setTab("CREATE")}
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700"
                >
                  Create First Template
                </button>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {templates.map((tpl) => {
                  const qCount = tpl.sections.reduce((sum, s) => sum + s.targetCount, 0);
                  const marks = tpl.sections.reduce(
                    (sum, s) => sum + s.targetCount * (s.marksPerQuestion ?? 4),
                    0
                  );
                  const isSelected = selectedTemplateId === tpl.id;

                  return (
                    <div
                      key={tpl.id}
                      onClick={() => setSelectedTemplateId(tpl.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "border-indigo-600 bg-indigo-50/50 shadow-sm ring-2 ring-indigo-500/20"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 text-sm">{tpl.name}</span>
                            {isSelected && (
                              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                            )}
                          </div>
                          {tpl.description && (
                            <p className="text-xs text-slate-500 mt-1">{tpl.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs">
                          <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg font-medium">
                            {tpl.sections.length} Sections
                          </span>
                          <span className="bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-lg font-medium">
                            {qCount} Questions
                          </span>
                          <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-lg font-medium">
                            {marks} Marks
                          </span>
                        </div>
                      </div>

                      {/* Section pills */}
                      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
                        {tpl.sections.map((sec) => (
                          <div
                            key={sec.id}
                            className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md flex items-center gap-1.5"
                          >
                            <span className="font-medium text-slate-900">{sec.name}</span>
                            <span className="text-slate-400">({sec.subject}):</span>
                            <span className="font-semibold text-indigo-600">{sec.targetCount}Q</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Presets */}
            <div className="flex items-center gap-2 pb-2">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Quick Presets:
              </span>
              <button
                type="button"
                onClick={() => {
                  setName("NEET Standard Pattern");
                  setDescription("Physics (45Q) + Chemistry (45Q) + Biology (90Q)");
                  setSections(NEET_PRESET_SECTIONS);
                }}
                className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-medium rounded-lg transition"
              >
                NEET (180Q / 720 Marks)
              </button>
              <button
                type="button"
                onClick={() => {
                  setName("JEE Main Standard Pattern");
                  setDescription("Physics (30Q) + Chemistry (30Q) + Mathematics (30Q)");
                  setSections(JEE_PRESET_SECTIONS);
                }}
                className="px-2.5 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs font-medium rounded-lg transition"
              >
                JEE Main (90Q / 360 Marks)
              </button>
            </div>

            {/* Template Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Template Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. NEET 2026 Full Syllabus Test"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. 3.20 hrs duration, full syllabus"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Sections Editor */}
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600" /> Sections Breakdown ({sections.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddSection}
                  className="px-2.5 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Section
                </button>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {sections.map((sec, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 bg-white p-2.5 rounded-lg border border-slate-200 items-center text-xs"
                  >
                    <div className="col-span-3">
                      <label className="text-[10px] text-slate-400 block mb-0.5">Section Name</label>
                      <input
                        type="text"
                        value={sec.name}
                        onChange={(e) => handleSectionChange(idx, "name", e.target.value)}
                        className="w-full px-2 py-1 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="text-[10px] text-slate-400 block mb-0.5">Subject</label>
                      <select
                        value={sec.subject}
                        onChange={(e) => handleSectionChange(idx, "subject", e.target.value)}
                        className="w-full px-2 py-1 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs bg-white"
                      >
                        <option value="Physics">Physics</option>
                        <option value="Chemistry">Chemistry</option>
                        <option value="Biology">Biology</option>
                        <option value="Botany">Botany</option>
                        <option value="Zoology">Zoology</option>
                        <option value="Mathematics">Mathematics</option>
                        <option value="General">General</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] text-slate-400 block mb-0.5">Questions</label>
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={sec.targetCount}
                        onChange={(e) => handleSectionChange(idx, "targetCount", Number(e.target.value))}
                        className="w-full px-2 py-1 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-semibold text-center"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] text-slate-400 block mb-0.5">Marks/Q (+ve)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={sec.marksPerQuestion ?? 4}
                        onChange={(e) => handleSectionChange(idx, "marksPerQuestion", Number(e.target.value))}
                        className="w-full px-2 py-1 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs text-center"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="text-[10px] text-slate-400 block mb-0.5">-ve</label>
                      <input
                        type="number"
                        step="0.25"
                        value={sec.negativeMarks ?? -1}
                        onChange={(e) => handleSectionChange(idx, "negativeMarks", Number(e.target.value))}
                        className="w-full px-1.5 py-1 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs text-center text-red-600"
                      />
                    </div>
                    <div className="col-span-1 flex justify-center pt-3">
                      <button
                        type="button"
                        onClick={() => handleRemoveSection(idx)}
                        disabled={sections.length <= 1}
                        className="text-slate-400 hover:text-red-600 disabled:opacity-30 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Calculation Summary Banner */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-indigo-900 font-semibold">
                <Calculator className="w-4 h-4 text-indigo-600" /> Live Calculated Blueprint:
              </div>
              <div className="flex items-center gap-4">
                <span className="text-slate-700 font-medium">
                  Total Questions: <strong className="text-indigo-700">{totalQuestions}</strong>
                </span>
                <span className="text-slate-700 font-medium">
                  Max Marks: <strong className="text-emerald-700">{totalMarks}</strong>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-white transition"
        >
          Cancel
        </button>

        <div className="flex items-center gap-2">
          {tab === "SELECT" ? (
            <button
              type="button"
              onClick={handleApplyExisting}
              disabled={submitting || !selectedTemplateId}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl disabled:opacity-50 transition shadow-sm"
            >
              {submitting ? "Applying..." : "Apply Selected Template"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCreateAndApply}
              disabled={submitting || !name.trim()}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl disabled:opacity-50 transition shadow-sm"
            >
              {submitting ? "Saving & Applying..." : "Save & Apply Template"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
