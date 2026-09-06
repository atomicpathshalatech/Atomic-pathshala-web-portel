"use client";

import React, { useState, useRef } from "react";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Image as ImageIcon,
  CheckSquare,
  Square,
  Sparkles,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  subject: string;
  chapter: string;
  onSubjectChange: (s: string) => void;
  onChapterChange: (c: string) => void;
  subjectsList: Array<{ id: string; name: string }>;
  chaptersList: Array<{ id: string; title: string }>;
  onPdfProcessed: (result: {
    sourcePdfId: string;
    fileName: string;
    pageCount: number;
    detectedTopics: string[];
    imagesCount: number;
  }) => void;
  selectedTopics: string[];
  onSelectedTopicsChange: (topics: string[]) => void;
}

export function PdfUploadStep({
  subject,
  chapter,
  onSubjectChange,
  onChapterChange,
  subjectsList,
  chaptersList,
  onPdfProcessed,
  selectedTopics,
  onSelectedTopicsChange,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [processedResult, setProcessedResult] = useState<any | null>(null);
  const [detectedTopicsList, setDetectedTopicsList] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("Invalid file type. Please upload an educational PDF file.");
      return;
    }
    if (selectedFile.size > 30 * 1024 * 1024) {
      setUploadError("File size exceeds the 30MB limit.");
      return;
    }
    setFile(selectedFile);
    setUploadError(null);
    setProcessedResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleProcessPdf = async () => {
    if (!file) return;
    if (!subject) {
      toast.error("Please select a Subject first.");
      return;
    }
    if (!chapter) {
      toast.error("Please select a Chapter first.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadProgress(20);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("subject", subject);
    formData.append("chapter", chapter);

    try {
      setUploadProgress(50);
      const res = await fetch("/api/team/ai-questions/upload-pdf", {
        method: "POST",
        body: formData,
      });
      setUploadProgress(90);

      const json = await res.json();
      if (!json.success) {
        setUploadError(json.error || "Failed to process PDF.");
        toast.error(json.error || "Processing failed.");
        return;
      }

      setUploadProgress(100);
      setProcessedResult(json.data);

      const topics = json.data.detectedTopics?.map((t: any) => t.topic) || [];
      setDetectedTopicsList(topics);
      onSelectedTopicsChange(topics); // default select all detected

      onPdfProcessed({
        sourcePdfId: json.data.sourcePdfId,
        fileName: json.data.fileName,
        pageCount: json.data.pageCount,
        detectedTopics: topics,
        imagesCount: json.data.images?.length || 0,
      });

      if (json.data.isDuplicate) {
        toast.info("This PDF was previously processed. Reusing existing source chunks & images!");
      } else {
        toast.success(`PDF processed! ${json.data.pageCount} pages, ${topics.length} topics detected.`);
      }
    } catch (err: any) {
      setUploadError("Network error during PDF processing.");
      toast.error("Failed to upload PDF.");
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setProcessedResult(null);
    setUploadError(null);
    setDetectedTopicsList([]);
    onSelectedTopicsChange([]);
  };

  const toggleTopic = (t: string) => {
    if (selectedTopics.includes(t)) {
      onSelectedTopicsChange(selectedTopics.filter((x) => x !== t));
    } else {
      onSelectedTopicsChange([...selectedTopics, t]);
    }
  };

  const handleSelectAll = () => onSelectedTopicsChange([...detectedTopicsList]);
  const handleClearAll = () => onSelectedTopicsChange([]);

  return (
    <div className="space-y-6">
      {/* 1. Subject & Chapter Constraints (Mandatory for PDF Mode) */}
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6">
        <h3 className="text-sm font-black text-slate-800 mb-1 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-blue-600" />
          <span>Step 1: Constrain Subject &amp; Chapter</span>
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          The selected Subject and Chapter act as hard guardrails. The AI will not assign topics outside this chapter.
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
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. Drag & Drop Upload Zone */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4">
        <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
          <Upload className="w-4 h-4 text-purple-600" />
          <span>Step 2: Upload Source Document (PDF)</span>
        </h3>

        {!file ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-purple-500 hover:bg-purple-50/20 rounded-3xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              accept=".pdf"
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">
                Drag &amp; Drop source PDF here, or <span className="text-purple-600 underline">browse</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supports NCERT chapters, coaching modules, teacher notes, or reference documents (up to 30MB)
              </p>
            </div>
          </div>
        ) : (
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-900 line-clamp-1">{file.name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB · Ready to process
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!processedResult && (
                <button
                  type="button"
                  onClick={handleProcessPdf}
                  disabled={uploading}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-md shadow-purple-500/20 active:scale-95 transition disabled:opacity-50"
                >
                  {uploading ? "Analyzing & Segmenting..." : "Process PDF"}
                </button>
              )}

              <button
                type="button"
                onClick={handleReset}
                disabled={uploading}
                className="p-2 hover:bg-slate-200 text-slate-500 rounded-xl transition"
                title="Remove and upload different file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Upload & Progress bar */}
        {uploading && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-600 font-bold">
              <span>Segmenting pages, detecting diagrams &amp; topics...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-purple-600 to-indigo-600 h-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error notification */}
        {uploadError && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}
      </div>

      {/* 3. Detected Topics Selection (After Processing) */}
      {processedResult && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>Detected Syllabus Topics in PDF</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedTopics.length} of {detectedTopicsList.length} topics selected for question generation.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs font-bold text-purple-600 hover:text-purple-800 px-3 py-1 bg-purple-50 rounded-lg"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-xs font-bold text-slate-500 hover:text-slate-700 px-3 py-1 bg-slate-100 rounded-lg"
              >
                Clear All
              </button>
            </div>
          </div>

          {detectedTopicsList.length === 0 ? (
            <p className="text-xs text-slate-500 italic p-4 text-center">
              No specific sub-topics identified automatically. Entire document text will be used as reference.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {detectedTopicsList.map((top) => {
                const isChecked = selectedTopics.includes(top);
                return (
                  <button
                    key={top}
                    type="button"
                    onClick={() => toggleTopic(top)}
                    className={`p-3 rounded-2xl border text-left text-xs transition flex items-center gap-2.5 ${
                      isChecked
                        ? "bg-purple-50/70 border-purple-400 text-purple-950 font-bold shadow-sm"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-purple-600 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300 shrink-0" />
                    )}
                    <span className="line-clamp-1">{top}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Extracted Images Summary */}
          {processedResult.images && processedResult.images.length > 0 && (
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span className="flex items-center gap-1.5 font-bold">
                <ImageIcon className="w-4 h-4 text-indigo-600" />
                <span>{processedResult.images.length} scientific diagram(s) detected in source PDF</span>
              </span>
              <span className="text-[11px] text-emerald-600 font-semibold">
                Available for Diagram-Based Questions
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
