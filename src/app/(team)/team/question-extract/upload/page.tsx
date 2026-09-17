"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  UploadCloud,
  FileText,
  Layers,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  ChevronLeft,
  Sliders,
  Calendar,
  CheckCircle2,
} from "lucide-react";

type CategoryType = "NEET_PYQ" | "JEE_MAINS_PYQ" | "JEE_ADVANCED_PYQ" | "GENERAL";

const YEARS = Array.from({ length: 20 }, (_, i) => String(2026 - i));

export default function QuestionExtractUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Category & PYQ State
  const [categoryType, setCategoryType] = useState<CategoryType>("NEET_PYQ");
  const [pyqYear, setPyqYear] = useState<string>("2025");
  const [pyqMonth, setPyqMonth] = useState<"January" | "April">("January");

  // General Source State
  const [sourceName, setSourceName] = useState("ALLEN");
  const [customSource, setCustomSource] = useState("");
  const [examName, setExamName] = useState("NEET Mock Test 01");
  const [generalYear, setGeneralYear] = useState("2026");

  // Extraction bounds & content
  const [startNumber, setStartNumber] = useState(1);
  const [endNumber, setEndNumber] = useState(200);
  const [subject, setSubject] = useState("Auto Detect");
  const [chapter, setChapter] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Handle category changes with smart defaults
  const handleCategoryChange = (cat: CategoryType) => {
    setCategoryType(cat);
    if (cat === "NEET_PYQ") {
      setStartNumber(1);
      setEndNumber(200);
      setSubject("Auto Detect");
    } else if (cat === "JEE_MAINS_PYQ") {
      setStartNumber(1);
      setEndNumber(90);
      setSubject("Auto Detect");
    } else if (cat === "JEE_ADVANCED_PYQ") {
      setStartNumber(1);
      setEndNumber(54);
      setSubject("Auto Detect");
    } else {
      setStartNumber(1);
      setEndNumber(180);
    }
  };

  const isPyq = categoryType !== "GENERAL";

  // Compute active metadata
  const effectiveSourceName =
    categoryType === "NEET_PYQ"
      ? "NEET"
      : categoryType === "JEE_MAINS_PYQ"
      ? "JEE Main"
      : categoryType === "JEE_ADVANCED_PYQ"
      ? "JEE Advanced"
      : sourceName === "CUSTOM"
      ? customSource.trim()
      : sourceName;

  const effectiveExamName =
    categoryType === "NEET_PYQ"
      ? `NEET ${pyqYear} Official Paper`
      : categoryType === "JEE_MAINS_PYQ"
      ? `JEE Main ${pyqYear} (${pyqMonth}) Paper`
      : categoryType === "JEE_ADVANCED_PYQ"
      ? `JEE Advanced ${pyqYear} Official Paper`
      : examName;

  const expectedCount = Math.max(1, endNumber - startNumber + 1);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.type !== "application/pdf" && !selected.name.endsWith(".pdf") && !selected.name.endsWith(".txt")) {
        toast.error("Please upload a valid PDF or text document.");
        return;
      }
      setFile(selected);
      toast.success(`Selected ${selected.name} (${(selected.size / 1024 / 1024).toFixed(2)} MB)`);
    }
  };

  const handleDropzoneClick = () => {
    if (isPyq && !pyqYear) {
      toast.error("Please select the Exam Year first.");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleStartExtraction = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!effectiveSourceName) {
      toast.error("Source Name is required.");
      return;
    }

    if (isPyq && !pyqYear) {
      toast.error("Please select an Exam Year before starting extraction.");
      return;
    }

    if (!file && !rawText.trim()) {
      toast.error("Please upload a PDF file or provide document text.");
      return;
    }

    setIsProcessing(true);
    const toastId = toast.loading("Initializing extraction job & running layout boundary detection...");

    try {
      const formData = new FormData();
      if (file) formData.append("file", file);
      formData.append("sourceName", effectiveSourceName);
      formData.append("startNumber", String(startNumber));
      formData.append("endNumber", String(endNumber));
      formData.append("examName", effectiveExamName);
      formData.append("subject", subject);
      if (chapter) formData.append("chapter", chapter);
      if (rawText.trim()) formData.append("rawText", rawText.trim());

      if (categoryType === "NEET_PYQ") {
        formData.append("pyqExam", "NEET");
        formData.append("pyqYear", pyqYear);
        formData.append("year", pyqYear);
      } else if (categoryType === "JEE_MAINS_PYQ") {
        formData.append("pyqExam", "JEE_MAINS");
        formData.append("pyqYear", pyqYear);
        formData.append("pyqMonth", pyqMonth);
        formData.append("year", pyqYear);
      } else if (categoryType === "JEE_ADVANCED_PYQ") {
        formData.append("pyqExam", "JEE_ADVANCED");
        formData.append("pyqYear", pyqYear);
        formData.append("year", pyqYear);
      } else {
        if (generalYear) formData.append("year", generalYear);
      }

      const res = await fetch("/api/team/question-extract/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to process extraction job.");
      }

      toast.success(`Extraction job created! Extracted ${json.data.report?.extractedCount || 0} questions.`, {
        id: toastId,
      });

      router.push(`/team/question-extract/${json.data.job.id}`);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to start extraction.", { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        href="/team/question-extract"
        className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-blue-600 transition"
      >
        <ChevronLeft className="w-4 h-4" />
        <span>Back to Extraction Jobs</span>
      </Link>

      {/* Header */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
        <span className="text-xs font-bold px-3 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-mono">
          QUESTION BANK — PDF EXTRACTION PIPELINE
        </span>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Upload PDF Exam Paper
        </h1>
        <p className="text-xs text-slate-500">
          Upload official PYQ or institute question papers. All extracted questions retain permanent source identification and sequential question numbering.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleStartExtraction} className="space-y-6">
        {/* STEP 1: CATEGORY & EXAM SELECTION (BEFORE PDF UPLOAD) */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                1
              </span>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Select Exam Category
              </h3>
            </div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Step 1 of 3
            </span>
          </div>

          {/* Category Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              type="button"
              onClick={() => handleCategoryChange("NEET_PYQ")}
              className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between gap-2 ${
                categoryType === "NEET_PYQ"
                  ? "bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/20 shadow-sm"
                  : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase">NEET</span>
                {categoryType === "NEET_PYQ" && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
              </div>
              <div>
                <p className="font-bold text-xs text-slate-900 dark:text-white">NEET PYQs</p>
                <p className="text-[10px] text-slate-400">Official Past Year Papers</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleCategoryChange("JEE_MAINS_PYQ")}
              className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between gap-2 ${
                categoryType === "JEE_MAINS_PYQ"
                  ? "bg-amber-50/80 dark:bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/20 shadow-sm"
                  : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase">JEE Mains</span>
                {categoryType === "JEE_MAINS_PYQ" && <CheckCircle2 className="w-4 h-4 text-amber-600" />}
              </div>
              <div>
                <p className="font-bold text-xs text-slate-900 dark:text-white">JEE Mains PYQs</p>
                <p className="text-[10px] text-slate-400">Jan &amp; Apr Sessions</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleCategoryChange("JEE_ADVANCED_PYQ")}
              className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between gap-2 ${
                categoryType === "JEE_ADVANCED_PYQ"
                  ? "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm"
                  : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase">JEE Adv</span>
                {categoryType === "JEE_ADVANCED_PYQ" && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              </div>
              <div>
                <p className="font-bold text-xs text-slate-900 dark:text-white">JEE Advanced PYQs</p>
                <p className="text-[10px] text-slate-400">Official IIT Papers</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleCategoryChange("GENERAL")}
              className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between gap-2 ${
                categoryType === "GENERAL"
                  ? "bg-purple-50/80 dark:bg-purple-950/40 border-purple-500 ring-2 ring-purple-500/20 shadow-sm"
                  : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase">Institute</span>
                {categoryType === "GENERAL" && <CheckCircle2 className="w-4 h-4 text-purple-600" />}
              </div>
              <div>
                <p className="font-bold text-xs text-slate-900 dark:text-white">General / Coaching</p>
                <p className="text-[10px] text-slate-400">ALLEN, NCERT, RACE...</p>
              </div>
            </button>
          </div>

          {/* STEP 1.5: YEAR & SESSION SELECTION (REQUIRED BEFORE PDF UPLOAD) */}
          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-500" />
                {isPyq ? "Exam Metadata (Required Before PDF Upload)" : "Test & Source Information"}
              </span>

              {/* Tag Preview */}
              <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 text-[11px] font-mono font-bold">
                {categoryType === "NEET_PYQ" && `NEET ${pyqYear} — Question 01`}
                {categoryType === "JEE_MAINS_PYQ" && `JEE Main ${pyqYear} — ${pyqMonth} — Question 01`}
                {categoryType === "JEE_ADVANCED_PYQ" && `JEE Advanced ${pyqYear} — Question 01`}
                {categoryType === "GENERAL" && `${effectiveSourceName} — Question 01`}
              </span>
            </div>

            {/* NEET PYQ: Enforce NEET Year Selection */}
            {categoryType === "NEET_PYQ" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    NEET Exam Year *
                  </label>
                  <select
                    value={pyqYear}
                    onChange={(e) => setPyqYear(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-slate-900 dark:text-white font-bold text-xs focus:border-blue-500 outline-none"
                  >
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        NEET {y}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    NEET Year {pyqYear} will automatically attach to all extracted questions.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Subject Scope
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-slate-900 dark:text-white font-medium text-xs focus:border-blue-500 outline-none"
                  >
                    <option value="Auto Detect">Auto Detect (Physics, Chemistry, Biology)</option>
                    <option value="Physics">Physics Only</option>
                    <option value="Chemistry">Chemistry Only</option>
                    <option value="Biology">Biology Only</option>
                  </select>
                </div>
              </div>
            )}

            {/* JEE MAINS PYQ: Enforce Year and Month Selection */}
            {categoryType === "JEE_MAINS_PYQ" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    JEE Main Year *
                  </label>
                  <select
                    value={pyqYear}
                    onChange={(e) => setPyqYear(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-slate-900 dark:text-white font-bold text-xs focus:border-blue-500 outline-none"
                  >
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        JEE Main {y}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Session / Month *
                  </label>
                  <select
                    value={pyqMonth}
                    onChange={(e) => setPyqMonth(e.target.value as "January" | "April")}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-slate-900 dark:text-white font-bold text-xs focus:border-blue-500 outline-none"
                  >
                    <option value="January">January Session</option>
                    <option value="April">April Session</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Subject Scope
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-slate-900 dark:text-white font-medium text-xs focus:border-blue-500 outline-none"
                  >
                    <option value="Auto Detect">Auto Detect (Physics, Chemistry, Maths)</option>
                    <option value="Physics">Physics Only</option>
                    <option value="Chemistry">Chemistry Only</option>
                    <option value="Mathematics">Mathematics Only</option>
                  </select>
                </div>
                <div className="sm:col-span-3 text-[10px] text-slate-400">
                  JEE Main, {pyqYear}, and {pyqMonth} will automatically attach to every extracted question.
                </div>
              </div>
            )}

            {/* JEE ADVANCED PYQ: Enforce Year Selection */}
            {categoryType === "JEE_ADVANCED_PYQ" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    JEE Advanced Year *
                  </label>
                  <select
                    value={pyqYear}
                    onChange={(e) => setPyqYear(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-slate-900 dark:text-white font-bold text-xs focus:border-blue-500 outline-none"
                  >
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        JEE Advanced {y}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    JEE Advanced and {pyqYear} will automatically attach to all extracted questions.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Subject Scope
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-slate-900 dark:text-white font-medium text-xs focus:border-blue-500 outline-none"
                  >
                    <option value="Auto Detect">Auto Detect (Physics, Chemistry, Maths)</option>
                    <option value="Physics">Physics Only</option>
                    <option value="Chemistry">Chemistry Only</option>
                    <option value="Mathematics">Mathematics Only</option>
                  </select>
                </div>
              </div>
            )}

            {/* GENERAL / COACHING EXAMS */}
            {categoryType === "GENERAL" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Source Institute *
                  </label>
                  <select
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-slate-900 dark:text-white font-medium text-xs focus:border-blue-500 outline-none"
                  >
                    <option value="ALLEN">ALLEN</option>
                    <option value="RACE">RACE</option>
                    <option value="NCERT">NCERT</option>
                    <option value="AIIMS">AIIMS</option>
                    <option value="Aakash">Aakash</option>
                    <option value="Physics Wallah">Physics Wallah</option>
                    <option value="CUSTOM">Custom Institute...</option>
                  </select>
                  {sourceName === "CUSTOM" && (
                    <input
                      type="text"
                      placeholder="Enter Institute Name..."
                      value={customSource}
                      onChange={(e) => setCustomSource(e.target.value)}
                      className="w-full mt-2 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Test / Paper Name
                  </label>
                  <input
                    type="text"
                    value={examName}
                    onChange={(e) => setExamName(e.target.value)}
                    placeholder="e.g. Major Test 04"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-slate-900 dark:text-white font-medium text-xs focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Year
                  </label>
                  <input
                    type="text"
                    value={generalYear}
                    onChange={(e) => setGeneralYear(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-slate-900 dark:text-white font-medium text-xs focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* STEP 2: PDF FILE DROPZONE */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                2
              </span>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Upload Document PDF *
              </h3>
            </div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Step 2 of 3
            </span>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            accept=".pdf,.txt"
            onChange={handleFileChange}
            className="hidden"
          />

          <div
            onClick={handleDropzoneClick}
            className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 p-8 rounded-2xl text-center cursor-pointer transition bg-slate-50/60 dark:bg-slate-800/40 group space-y-2"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center group-hover:scale-110 transition">
              <UploadCloud className="w-6 h-6" />
            </div>
            {file ? (
              <div>
                <p className="font-bold text-sm text-slate-900 dark:text-white">{file.name}</p>
                <span className="text-xs text-slate-400">
                  {(file.size / 1024 / 1024).toFixed(2)} MB • Click to change file
                </span>
              </div>
            ) : (
              <div>
                <p className="font-bold text-xs text-slate-800 dark:text-slate-200">
                  Click to select PDF or drag &amp; drop here
                </p>
                <span className="text-[11px] text-slate-400">
                  {categoryType === "NEET_PYQ" && `Complete NEET ${pyqYear} paper (questions will be auto-numbered 01, 02...)`}
                  {categoryType === "JEE_MAINS_PYQ" && `Complete JEE Main ${pyqYear} (${pyqMonth}) paper`}
                  {categoryType === "JEE_ADVANCED_PYQ" && `Complete JEE Advanced ${pyqYear} paper`}
                  {categoryType === "GENERAL" && "Complete multi-page exam paper"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* STEP 3: QUESTION RANGE VALIDATION */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                3
              </span>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Expected Question Range &amp; Validation
              </h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-lg bg-blue-600 text-white font-mono font-bold text-xs">
              Expected: {expectedCount} Questions
            </span>
          </div>

          <p className="text-xs text-slate-500">
            The extractor automatically identifies question numbers (e.g. Question 01, Question 02). Any missing question in this range will trigger a validation alert.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Start Question Number
              </label>
              <input
                type="number"
                min={1}
                value={startNumber}
                onChange={(e) => setStartNumber(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-slate-900 dark:text-white font-mono font-bold outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                End Question Number
              </label>
              <input
                type="number"
                min={startNumber}
                value={endNumber}
                onChange={(e) => setEndNumber(parseInt(e.target.value, 10) || 180)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-slate-900 dark:text-white font-mono font-bold outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Optional Fast Track Raw Text */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            Document Raw Text (Optional OCR / Fast Track)
          </label>
          <textarea
            rows={3}
            placeholder="Paste raw text if you wish to bypass file upload..."
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 transition font-mono"
          />
        </div>

        {/* Submit Action */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isProcessing}
            className="px-8 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {isProcessing
                ? "Processing Extraction..."
                : `Start Extraction (${expectedCount} Questions)`}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
