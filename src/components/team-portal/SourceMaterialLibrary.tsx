"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  FileText,
  Filter,
  FolderOpen,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Tag,
  UploadCloud,
} from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  NCERT_TEXTBOOK: "NCERT Textbook",
  NCERT_EXEMPLAR: "NCERT Exemplar",
  ALLEN_MODULE: "Allen Module",
  PREVIOUS_YEAR_QUESTIONS: "PYQ Bank",
  REFERENCE_BOOK: "Reference Book",
  FACULTY_NOTES: "Faculty Notes",
  QUESTION_BANK: "Question Bank",
  OFFICIAL_ANSWER_KEY: "Official Key",
  OTHER: "Other Material",
};

export function SourceMaterialLibrary() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("");
  const [classLevel, setClassLevel] = useState("");

  // Upload/Register Modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState("NCERT_TEXTBOOK");
  const [uploadSubject, setUploadSubject] = useState("PHYSICS");
  const [uploadClass, setUploadClass] = useState("CLASS_11");
  const [uploadChapter, setUploadChapter] = useState("");
  const [uploadFileUrl, setUploadFileUrl] = useState("");
  const [uploadText, setUploadText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadMaterials = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (subject) params.set("subject", subject);
      if (category) params.set("category", category);
      if (classLevel) params.set("classLevel", classLevel);

      const res = await fetch(`/api/team/qc/source-materials?${params.toString()}`);
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error || "Failed to load source materials");
      }
      setItems(body.data.items || []);
      setTotal(body.data.total || 0);
    } catch (err: any) {
      toast.error(err.message || "Failed to load library items");
    } finally {
      setLoading(false);
    }
  }, [search, subject, category, classLevel]);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  const handleRegister = async () => {
    if (!uploadTitle.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!uploadFileUrl.trim()) {
      toast.error("File URL is required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/team/qc/source-materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: uploadTitle,
          category: uploadCategory,
          subject: uploadSubject,
          classLevel: uploadClass,
          chapterName: uploadChapter,
          fileUrl: uploadFileUrl,
          extractedText: uploadText,
          chunks: uploadText
            ? [
                {
                  pageNumber: 1,
                  chunkIndex: 0,
                  content: uploadText,
                },
              ]
            : [],
        }),
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error || "Failed to register material");
      }

      toast.success("Source material added to library");
      setShowUploadModal(false);
      setUploadTitle("");
      setUploadFileUrl("");
      setUploadText("");
      loadMaterials();
    } catch (err: any) {
      toast.error(err.message || "Failed to register source material");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <FolderOpen className="w-3.5 h-3.5" /> Source Material Library
              </span>
              <span className="text-xs text-slate-500">NCERT, Allen, PYQs & Reference Works</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
              Persistent Curriculum Repository
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Subject → Class → Book/Module → Chapter → Topic hierarchy. Materials ground AI question generation and NCERT verification.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" /> Add Source Material
            </button>
            <button
              onClick={() => loadMaterials()}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-6">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search title, chapter, or text..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            />
          </div>

          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-slate-800 dark:text-slate-100"
          >
            <option value="">All Subjects</option>
            <option value="PHYSICS">Physics</option>
            <option value="CHEMISTRY">Chemistry</option>
            <option value="BOTANY">Botany</option>
            <option value="ZOOLOGY">Zoology</option>
          </select>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-slate-800 dark:text-slate-100"
          >
            <option value="">All Categories</option>
            <option value="NCERT_TEXTBOOK">NCERT Textbook</option>
            <option value="NCERT_EXEMPLAR">NCERT Exemplar</option>
            <option value="ALLEN_MODULE">Allen Module</option>
            <option value="PREVIOUS_YEAR_QUESTIONS">Previous Year Questions</option>
            <option value="REFERENCE_BOOK">Reference Book</option>
            <option value="FACULTY_NOTES">Faculty Notes</option>
          </select>

          <select
            value={classLevel}
            onChange={(e) => setClassLevel(e.target.value)}
            className="text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-slate-800 dark:text-slate-100"
          >
            <option value="">All Classes</option>
            <option value="CLASS_11">Class 11</option>
            <option value="CLASS_12">Class 12</option>
            <option value="DROPPER">Dropper</option>
          </select>
        </div>
      </div>

      {/* Materials List */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mb-2 text-emerald-500" />
            <span className="text-xs font-medium">Loading source repository...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No source materials found</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Add NCERT textbooks, Allen modules, or PYQ books to the library to ground multi-AI generation.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 transition-all flex flex-col justify-between bg-slate-50/50 dark:bg-slate-800/40"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                      {CATEGORY_LABELS[item.category] || item.category}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {item.classLevel?.replace("_", " ")}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                    {item.title}
                  </h4>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Chapter: {item.chapterName || "Comprehensive"}
                  </p>

                  {item.topicName && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Topic: {item.topicName}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" /> {item._count?.chunks || 0} chunks
                  </span>
                  <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-emerald-500" /> Add Source Material to Library
            </h3>
            <p className="text-xs text-slate-500">
              Register educational material for grounding NEET questions and citation verification.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Title</label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. NCERT Physics Class 11 - Laws of Motion"
                  className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5"
                  >
                    <option value="NCERT_TEXTBOOK">NCERT Textbook</option>
                    <option value="NCERT_EXEMPLAR">NCERT Exemplar</option>
                    <option value="ALLEN_MODULE">Allen Module</option>
                    <option value="PREVIOUS_YEAR_QUESTIONS">Previous Year Questions</option>
                    <option value="REFERENCE_BOOK">Reference Book</option>
                    <option value="FACULTY_NOTES">Faculty Notes</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Subject</label>
                  <select
                    value={uploadSubject}
                    onChange={(e) => setUploadSubject(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5"
                  >
                    <option value="PHYSICS">Physics</option>
                    <option value="CHEMISTRY">Chemistry</option>
                    <option value="BOTANY">Botany</option>
                    <option value="ZOOLOGY">Zoology</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Class Level</label>
                  <select
                    value={uploadClass}
                    onChange={(e) => setUploadClass(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5"
                  >
                    <option value="CLASS_11">Class 11</option>
                    <option value="CLASS_12">Class 12</option>
                    <option value="DROPPER">Dropper</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Chapter Name</label>
                  <input
                    type="text"
                    value={uploadChapter}
                    onChange={(e) => setUploadChapter(e.target.value)}
                    placeholder="e.g. Laws of Motion"
                    className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Storage URL (R2 / S3)</label>
                <input
                  type="text"
                  value={uploadFileUrl}
                  onChange={(e) => setUploadFileUrl(e.target.value)}
                  placeholder="https://pub-..."
                  className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Extracted Text Content (Optional initial chunk)</label>
                <textarea
                  rows={4}
                  value={uploadText}
                  onChange={(e) => setUploadText(e.target.value)}
                  placeholder="Paste textbook passage or OCR extracted text..."
                  className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleRegister}
                disabled={submitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
              >
                {submitting ? "Registering..." : "Add to Library"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
