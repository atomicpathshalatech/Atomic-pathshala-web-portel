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
} from "lucide-react";

export default function QuestionExtractUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [sourceName, setSourceName] = useState("ALLEN");
  const [customSource, setCustomSource] = useState("");
  const [startNumber, setStartNumber] = useState(1);
  const [endNumber, setEndNumber] = useState(180);
  const [examName, setExamName] = useState("NEET Mock Test 01");
  const [year, setYear] = useState("2026");
  const [subject, setSubject] = useState("Auto Detect");
  const [chapter, setChapter] = useState("");
  const [tags, setTags] = useState("NEET 2026, Full Syllabus, Mock");
  const [rawText, setRawText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const finalSourceName = sourceName === "CUSTOM" ? customSource.trim() : sourceName;
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

  const handleStartExtraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finalSourceName) {
      toast.error("Source Name is required (e.g. ALLEN, RACE, NCERT).");
      return;
    }
    if (!file && !rawText.trim()) {
      toast.error("Please upload a PDF file or provide extracted document text.");
      return;
    }

    setIsProcessing(true);
    const toastId = toast.loading("Initializing extraction job & running layout boundary detection...");

    try {
      const formData = new FormData();
      if (file) formData.append("file", file);
      formData.append("sourceName", finalSourceName);
      formData.append("startNumber", String(startNumber));
      formData.append("endNumber", String(endNumber));
      if (examName) formData.append("examName", examName);
      if (year) formData.append("year", year);
      formData.append("subject", subject);
      if (chapter) formData.append("chapter", chapter);
      if (rawText.trim()) formData.append("rawText", rawText.trim());

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
          STEP 1: UPLOAD &amp; SOURCE CONFIGURATION
        </span>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Extract Exam PDF to Question Bank
        </h1>
        <p className="text-xs text-slate-500">
          Upload complete PDF paper. Every question retains its permanent source name, source PDF URL, and original question number.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleStartExtraction} className="space-y-6">
        {/* 1. PDF File Dropzone */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            A. PDF Document File *
          </label>

          <input
            type="file"
            ref={fileInputRef}
            accept=".pdf,.txt"
            onChange={handleFileChange}
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 p-8 rounded-2xl text-center cursor-pointer transition bg-slate-50/60 dark:bg-slate-800/40 group space-y-2"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center group-hover:scale-110 transition">
              <UploadCloud className="w-6 h-6" />
            </div>
            {file ? (
              <div>
                <p className="font-bold text-sm text-slate-900 dark:text-white">{file.name}</p>
                <span className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB • Click to replace</span>
              </div>
            ) : (
              <div>
                <p className="font-bold text-xs text-slate-800 dark:text-slate-200">
                  Click to select PDF or drag &amp; drop here
                </p>
                <span className="text-[11px] text-slate-400">Complete multi-page exam paper (e.g. 180 questions)</span>
              </div>
            )}
          </div>
        </div>

        {/* 2. Source Configuration & Hard Question Range */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Sliders className="w-4 h-4 text-slate-400" />
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
              Source Identity &amp; Expected Question Range
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Source Name Selector */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                Source Name * <span className="text-[10px] text-slate-400">(Permanent Traceability)</span>
              </label>
              <select
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-slate-900 dark:text-white font-medium focus:border-blue-500 outline-none transition"
              >
                <option value="ALLEN">ALLEN</option>
                <option value="RACE">RACE</option>
                <option value="NCERT">NCERT</option>
                <option value="NEET 2026">NEET 2026</option>
                <option value="NEET 2025 PYQ">NEET 2025 PYQ</option>
                <option value="AIIMS">AIIMS</option>
                <option value="Aakash">Aakash</option>
                <option value="Physics Wallah">Physics Wallah</option>
                <option value="CUSTOM">Custom Source...</option>
              </select>

              {sourceName === "CUSTOM" && (
                <input
                  type="text"
                  required
                  placeholder="Enter Custom Source Name..."
                  value={customSource}
                  onChange={(e) => setCustomSource(e.target.value)}
                  className="w-full mt-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 transition"
                />
              )}
            </div>

            {/* Exam / Test Name */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                Exam / Test Name
              </label>
              <input
                type="text"
                placeholder="e.g. NEET Mock Test 01 / Major Test 04"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-slate-900 dark:text-white font-medium focus:border-blue-500 outline-none transition"
              />
            </div>

            {/* Question Range: Start - End */}
            <div className="sm:col-span-2 p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-950 dark:text-blue-200">
                  Expected Question Range (Hard Validation Rule)
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-blue-600 text-white font-mono font-bold text-xs">
                  Expected: {expectedCount} Questions
                </span>
              </div>
              <p className="text-[11px] text-blue-800 dark:text-blue-300">
                System validates every question in this range. Any missing number (e.g. Q38) will trigger a hard validation flag.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Start Question Number
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={startNumber}
                    onChange={(e) => setStartNumber(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-slate-900 dark:text-white font-mono font-bold outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    End Question Number
                  </label>
                  <input
                    type="number"
                    min={startNumber}
                    value={endNumber}
                    onChange={(e) => setEndNumber(parseInt(e.target.value, 10) || 180)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-slate-900 dark:text-white font-mono font-bold outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Subject & Year */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-slate-900 dark:text-white font-medium focus:border-blue-500 outline-none transition"
              >
                <option value="Auto Detect">Auto Detect (Physics, Chemistry, Biology)</option>
                <option value="Physics">Physics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Biology">Biology</option>
                <option value="Botany">Botany</option>
                <option value="Zoology">Zoology</option>
                <option value="Mathematics">Mathematics</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Year</label>
              <input
                type="text"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-slate-900 dark:text-white font-medium focus:border-blue-500 outline-none transition"
              />
            </div>
          </div>
        </div>

        {/* Optional Text Paste Fallback */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            Document Raw Text (Optional Fast Track)
          </label>
          <textarea
            rows={3}
            placeholder="Paste raw PDF text or OCR stream here if you wish to bypass file upload..."
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 transition font-mono"
          />
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isProcessing}
            className="px-8 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isProcessing ? "Processing Extraction..." : `Start Extraction (${expectedCount} Questions)`}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
