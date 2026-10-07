"use client";

import { useState, useMemo } from "react";
import { SUBJECT_THEMES, ModuleSubject } from "@/lib/module-studio/subject-design-system";
import type { ModuleElementInput } from "@/lib/validation/module";
import { ReplacementRule } from "@/lib/module-studio/find-replace-engine";
import { toast } from "sonner";

export function ModuleRedesignStudio({ userRole }: { userRole?: string }) {
  // Step State
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Source Files
  const [mainPdf, setMainPdf] = useState<File | null>(null);
  const [referencePdfs, setReferencePdfs] = useState<File[]>([]);

  // Metadata
  const [subject, setSubject] = useState<ModuleSubject>("CHEMISTRY");
  const [moduleNumber, setModuleNumber] = useState<string>("Module 01");
  const [isCustomChapter, setIsCustomChapter] = useState<boolean>(false);
  const [chapterName, setChapterName] = useState<string>("Some Basic Concepts of Chemistry");
  const [customChapterName, setCustomChapterName] = useState<string>("");
  const [targetExam, setTargetExam] = useState<string>("NEET (UG)");
  const [facultyName, setFacultyName] = useState<string>("Firoz Sir");

  // Find & Replace Rules
  const [rules, setRules] = useState<ReplacementRule[]>([
    { id: "1", find: "XYZ Sir", replace: "Firoz Sir", matchCase: false, wholeWord: false },
  ]);
  const [newFind, setNewFind] = useState("");
  const [newReplace, setNewReplace] = useState("");

  // Processing & AST Data
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [ast, setAst] = useState<ModuleElementInput[]>([]);
  const [stats, setStats] = useState<{
    totalPages: number;
    totalElements: number;
    referenceInsightsInserted: number;
  } | null>(null);

  // Preview Mode
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewPrintMode, setPreviewPrintMode] = useState<boolean>(false);

  const activeTheme = SUBJECT_THEMES[subject] || SUBJECT_THEMES.CHEMISTRY;
  const isAdmin = userRole === "SUPER_ADMIN" || userRole === "ADMIN";

  const effectiveChapterName = isCustomChapter && customChapterName.trim()
    ? customChapterName.trim()
    : chapterName;

  // Add Find & Replace Rule
  const handleAddRule = () => {
    if (!newFind.trim()) return;
    setRules((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2, 7),
        find: newFind.trim(),
        replace: newReplace.trim(),
        matchCase: false,
        wholeWord: false,
      },
    ]);
    setNewFind("");
    setNewReplace("");
  };

  const handleRemoveRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  // 1. Process Extraction
  const handleProcessExtraction = async () => {
    if (!mainPdf) {
      toast.error("Please upload the MAIN PDF first");
      return;
    }

    setIsProcessing(true);
    const toastId = toast.loading("Processing MAIN PDF and extracting academic content...");

    try {
      const fd = new FormData();
      fd.append("mainPdf", mainPdf);
      referencePdfs.forEach((ref) => fd.append("referencePdfs", ref));
      fd.append("subject", subject);
      fd.append("moduleNumber", moduleNumber);
      fd.append("chapterName", effectiveChapterName);
      fd.append("targetExam", targetExam);
      fd.append("facultyName", facultyName);

      const res = await fetch("/api/modules/redesign/process", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to process PDF");

      setAst(data.data.ast);
      setStats({
        totalPages: data.data.totalPages,
        totalElements: data.data.totalElements,
        referenceInsightsInserted: data.data.referenceInsightsInserted,
      });

      toast.success(
        `Extracted ${data.data.totalElements} elements across ${data.data.totalPages} pages with ${data.data.referenceInsightsInserted} reference insights!`,
        { id: toastId }
      );

      // Render initial preview
      await fetchPreviewHtml(data.data.ast, false);
      setCurrentStep(3);
    } catch (err: any) {
      toast.error(err.message || "Error processing module", { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Fetch Preview HTML
  const fetchPreviewHtml = async (currentAst: ModuleElementInput[], isPrint: boolean) => {
    try {
      const res = await fetch("/api/modules/redesign/render-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          elements: currentAst,
          subject,
          moduleNumber,
          chapterName: effectiveChapterName,
          facultyName,
          targetExam,
          isPrintMode: isPrint,
          findReplaceRules: rules,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to generate preview");
      }

      const html = await res.text();
      setPreviewHtml(html);
    } catch (err: any) {
      toast.error(err.message || "Preview error");
    }
  };

  // 3. Bilingual Translation
  const handleTranslate = async (targetLang: "HINDI" | "ENGLISH") => {
    if (ast.length === 0) {
      toast.error("No extracted content to translate. Process PDF first.");
      return;
    }

    setIsTranslating(true);
    const toastId = toast.loading(`Translating module content to ${targetLang}...`);

    try {
      const res = await fetch("/api/modules/redesign/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          elements: ast,
          targetLanguage: targetLang,
          subject: activeTheme.name,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Translation failed");

      setAst(data.data.ast);
      toast.success(`Successfully translated ${data.data.totalElements} elements into ${targetLang}!`, { id: toastId });
      await fetchPreviewHtml(data.data.ast, previewPrintMode);
    } catch (err: any) {
      toast.error(err.message || "Translation error", { id: toastId });
    } finally {
      setIsTranslating(false);
    }
  };

  // 4. Trigger Direct Print/Download in Browser
  const handlePrintOrDownload = (isPrint: boolean) => {
    if (!previewHtml) {
      toast.error("Please generate preview first");
      return;
    }

    const printWin = window.open("", "_blank");
    if (!printWin) {
      toast.error("Please allow popups to open the print view");
      return;
    }

    printWin.document.open();
    printWin.document.write(previewHtml);
    printWin.document.close();

    // Trigger native browser print dialog after render
    setTimeout(() => {
      printWin.focus();
      printWin.print();
    }, 800);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-teal-900 via-slate-900 to-indigo-950 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 font-bold text-xs uppercase tracking-wider border border-teal-500/30">
              Module Engine 2.0
            </span>
            <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs uppercase tracking-wider border border-amber-500/30">
              Zero Content Loss
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black mt-2 tracking-tight">
            Atomic Pathshala Module Redesign System
          </h1>
          <p className="text-slate-300 text-sm mt-1 max-w-2xl">
            Reconstruct complete chapter modules with Subject-Specific Branding (Chemistry, Physics, Biology), Multi-Reference Ingestion, and Separate Digital &amp; Print Engines.
          </p>
        </div>

        {/* Step Tabs */}
        <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/10 shrink-0">
          {[
            { num: 1, label: "Upload" },
            { num: 2, label: "Design" },
            { num: 3, label: "Edit & Rules" },
            { num: 4, label: "Preview & PDF" },
          ].map((s) => (
            <button
              key={s.num}
              type="button"
              onClick={() => setCurrentStep(s.num as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                currentStep === s.num
                  ? "bg-teal-500 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {s.num}. {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* STEP 1: Upload Source PDFs */}
      {currentStep === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* MAIN PDF Box */}
          <div className="p-6 rounded-3xl bg-surface border-2 border-primary/30 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black">
                1
              </div>
              <div>
                <h3 className="font-bold text-base text-on-surface">
                  MAIN PDF (Master Source Module)
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Authoritative primary content source. 100% preserved.
                </p>
              </div>
            </div>

            <div className="border-2 border-dashed border-primary/40 rounded-2xl p-6 text-center hover:bg-primary/5 transition-colors cursor-pointer relative">
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  if (e.target.files?.[0]) setMainPdf(e.target.files[0]);
                }}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <span className="material-symbols-outlined text-4xl text-primary">
                picture_as_pdf
              </span>
              <p className="font-bold text-sm text-on-surface mt-2">
                {mainPdf ? mainPdf.name : "Click or Drag MAIN PDF here"}
              </p>
              <p className="text-xs text-on-surface-variant mt-1">
                {mainPdf ? `${(mainPdf.size / (1024 * 1024)).toFixed(2)} MB` : "Supports English & Hindi text, diagrams, formulas"}
              </p>
            </div>
          </div>

          {/* REFERENCE PDFs Box */}
          <div className="p-6 rounded-3xl bg-surface border border-outline-variant/30 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-600 flex items-center justify-center font-black">
                2
              </div>
              <div>
                <h3 className="font-bold text-base text-on-surface">
                  REFERENCE PDFs (NCERT, Other Modules)
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Optional enrichment sources. Injected at relevant topics.
                </p>
              </div>
            </div>

            <div className="border-2 border-dashed border-outline-variant/40 rounded-2xl p-6 text-center hover:bg-surface-container-high transition-colors cursor-pointer relative">
              <input
                type="file"
                accept="application/pdf"
                multiple
                onChange={(e) => {
                  if (e.target.files) {
                    setReferencePdfs((prev) => [...prev, ...Array.from(e.target.files!)]);
                  }
                }}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <span className="material-symbols-outlined text-4xl text-orange-500">
                library_books
              </span>
              <p className="font-bold text-sm text-on-surface mt-2">
                Add NCERT / Reference PDFs
              </p>
              <p className="text-xs text-on-surface-variant mt-1">
                Select multiple files to extract additional insights
              </p>
            </div>

            {referencePdfs.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {referencePdfs.map((ref, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-xl bg-surface-container-lowest text-xs border border-outline-variant/20"
                  >
                    <span className="font-medium truncate max-w-[80%]">{ref.name}</span>
                    <button
                      type="button"
                      onClick={() => setReferencePdfs((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:text-red-700 font-bold"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button
              type="button"
              disabled={!mainPdf}
              onClick={() => setCurrentStep(2)}
              className="px-6 py-3 rounded-2xl bg-primary text-on-primary font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <span>Next: Select Subject &amp; Chapter</span>
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Subject & Chapter Settings */}
      {currentStep === 2 && (
        <div className="p-6 rounded-3xl bg-surface border border-outline-variant/30 shadow-sm space-y-6">
          <h2 className="font-bold text-lg text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">palette</span>
            Subject Design &amp; Module Configuration
          </h2>

          {/* Subject Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["CHEMISTRY", "PHYSICS", "BIOLOGY"] as ModuleSubject[]).map((subjKey) => {
              const theme = SUBJECT_THEMES[subjKey];
              const isSelected = subject === subjKey;

              return (
                <div
                  key={subjKey}
                  onClick={() => {
                    setSubject(subjKey);
                    setChapterName(theme.standardChapters[0]?.en || "");
                  }}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-outline-variant/30 hover:border-primary/40 bg-surface"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="px-3 py-1 rounded-full text-xs font-black text-white"
                      style={{ background: theme.primaryColor }}
                    >
                      {theme.name}
                    </span>
                    <span className="material-symbols-outlined text-xl" style={{ color: theme.primaryColor }}>
                      {theme.icon}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-on-surface">{theme.name} ({theme.hindiName})</h3>
                    <p className="text-[11px] text-on-surface-variant mt-1 leading-snug">{theme.tagline}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Module No, Chapter & Faculty Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Module Number */}
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase">
                Module Number
              </label>
              <select
                value={moduleNumber}
                onChange={(e) => setModuleNumber(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/40 bg-surface text-sm font-medium focus:ring-2 focus:ring-primary"
              >
                {Array.from({ length: 20 }).map((_, idx) => (
                  <option key={idx} value={`Module ${String(idx + 1).padStart(2, "0")}`}>
                    Module {String(idx + 1).padStart(2, "0")}
                  </option>
                ))}
              </select>
            </div>

            {/* Chapter Selection (Dropdown or Custom) */}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase">
                  Chapter Name
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomChapter(!isCustomChapter)}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  {isCustomChapter ? "← Choose Standard NCERT Chapter" : "+ Use Custom Chapter Name"}
                </button>
              </div>

              {isCustomChapter ? (
                <input
                  type="text"
                  value={customChapterName}
                  onChange={(e) => setCustomChapterName(e.target.value)}
                  placeholder="Enter Custom Chapter Name (e.g. IUPAC & Isomerism Special)"
                  className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/40 bg-surface text-sm font-medium focus:ring-2 focus:ring-primary"
                />
              ) : (
                <select
                  value={chapterName}
                  onChange={(e) => setChapterName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/40 bg-surface text-sm font-medium focus:ring-2 focus:ring-primary"
                >
                  {activeTheme.standardChapters.map((ch, idx) => (
                    <option key={idx} value={ch.en}>
                      {ch.en} ({ch.hi})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Target Exam */}
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase">
                Target Exam
              </label>
              <select
                value={targetExam}
                onChange={(e) => setTargetExam(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/40 bg-surface text-sm font-medium focus:ring-2 focus:ring-primary"
              >
                <option value="NEET (UG)">NEET (UG)</option>
                <option value="JEE (Main + Advanced)">JEE (Main + Advanced)</option>
                <option value="Class 11 / 12 CBSE & State Boards">Class 11 / 12 CBSE &amp; State Boards</option>
              </select>
            </div>

            {/* Faculty / Academic Mentor */}
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase">
                Faculty / Verified By
              </label>
              <input
                type="text"
                value={facultyName}
                onChange={(e) => setFacultyName(e.target.value)}
                placeholder="e.g. Firoz Sir"
                className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/40 bg-surface text-sm font-medium focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-outline-variant/20">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-5 py-2.5 rounded-xl border border-outline-variant/40 text-xs font-bold text-on-surface-variant hover:bg-surface-container-high"
            >
              ← Back
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={handleProcessExtraction}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base">auto_fix_high</span>
              <span>{isProcessing ? "Processing Extraction..." : "Extract & Build AST"}</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Edit Rules & Bilingual Translation */}
      {currentStep === 3 && (
        <div className="space-y-6">
          {/* Summary Box */}
          {stats && (
            <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/25 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-teal-600 text-2xl">verified</span>
                <div>
                  <h4 className="font-bold text-sm text-teal-900 dark:text-teal-200">
                    AST Extraction Successful
                  </h4>
                  <p className="text-xs text-teal-700 dark:text-teal-300">
                    {stats.totalElements} structured academic items extracted across {stats.totalPages} pages. ({stats.referenceInsightsInserted} NCERT reference insights integrated).
                  </p>
                </div>
              </div>

              {/* 1-Click Bilingual Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isTranslating}
                  onClick={() => handleTranslate("HINDI")}
                  className="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">translate</span>
                  <span>Translate to Hindi (हिंदी)</span>
                </button>
                <button
                  type="button"
                  disabled={isTranslating}
                  onClick={() => handleTranslate("ENGLISH")}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">translate</span>
                  <span>Translate to English</span>
                </button>
              </div>
            </div>
          )}

          {/* Global Find & Replace */}
          <div className="p-6 rounded-3xl bg-surface border border-outline-variant/30 shadow-sm space-y-4">
            <h3 className="font-bold text-base text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">find_replace</span>
              Global Find &amp; Replace (Faculties, Institute Names, Terms)
            </h3>
            <p className="text-xs text-on-surface-variant">
              Replaces terms globally across all headings, paragraphs, questions, and examples before rendering.
            </p>

            <div className="flex items-center gap-3">
              <input
                type="text"
                value={newFind}
                onChange={(e) => setNewFind(e.target.value)}
                placeholder="Find (e.g. Old Teacher / Institute)"
                className="flex-1 px-4 py-2.5 rounded-xl border border-outline-variant/40 bg-surface text-xs font-medium"
              />
              <span className="material-symbols-outlined text-on-surface-variant">arrow_forward</span>
              <input
                type="text"
                value={newReplace}
                onChange={(e) => setNewReplace(e.target.value)}
                placeholder="Replace with (e.g. Firoz Sir / Atomic Pathshala)"
                className="flex-1 px-4 py-2.5 rounded-xl border border-outline-variant/40 bg-surface text-xs font-medium"
              />
              <button
                type="button"
                onClick={handleAddRule}
                className="px-4 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs"
              >
                + Add Rule
              </button>
            </div>

            {rules.length > 0 && (
              <div className="space-y-2 mt-2">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/20 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-red-500">"{rule.find}"</span>
                      <span>➔</span>
                      <span className="font-bold text-green-600">"{rule.replace}"</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveRule(rule.id)}
                      className="text-red-500 hover:text-red-700 font-bold"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-5 py-2.5 rounded-xl border border-outline-variant/40 text-xs font-bold text-on-surface-variant hover:bg-surface-container-high"
            >
              ← Back
            </button>

            <button
              type="button"
              onClick={() => {
                fetchPreviewHtml(ast, previewPrintMode);
                setCurrentStep(4);
              }}
              className="px-6 py-3 rounded-2xl bg-primary text-on-primary font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2"
            >
              <span>View Subject-Themed Preview &amp; Export</span>
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Live Preview & Dual PDF Export */}
      {currentStep === 4 && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="p-4 rounded-2xl bg-surface border border-outline-variant/30 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-surface-container-high p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewPrintMode(false);
                    fetchPreviewHtml(ast, false);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                    !previewPrintMode ? "bg-primary text-on-primary" : "text-on-surface-variant"
                  }`}
                >
                  Digital Mode (Watermark ON)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewPrintMode(true);
                    fetchPreviewHtml(ast, true);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                    previewPrintMode ? "bg-primary text-on-primary" : "text-on-surface-variant"
                  }`}
                >
                  Print Mode (Watermark OFF)
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Digital Download */}
              <button
                type="button"
                onClick={() => handlePrintOrDownload(false)}
                className="px-5 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold flex items-center gap-2 border border-outline-variant/30"
              >
                <span className="material-symbols-outlined text-base text-primary">download</span>
                <span>Download Digital PDF</span>
              </button>

              {/* Admin High-Res Print PDF */}
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => handlePrintOrDownload(true)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-bold flex items-center gap-2 shadow-md"
                >
                  <span className="material-symbols-outlined text-base">print</span>
                  <span>Print PDF (300 DPI, No Watermark)</span>
                </button>
              ) : (
                <div className="text-[11px] text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">lock</span>
                  <span>Print version restricted to Administrators</span>
                </div>
              )}
            </div>
          </div>

          {/* Live Preview Iframe */}
          <div className="w-full bg-slate-900 rounded-3xl p-4 shadow-2xl border border-outline-variant/30 flex justify-center">
            <iframe
              srcDoc={previewHtml}
              title="Redesigned Module Preview"
              className="w-full max-w-[850px] h-[900px] bg-white rounded-2xl shadow-lg border-0"
            />
          </div>
        </div>
      )}
    </div>
  );
}
