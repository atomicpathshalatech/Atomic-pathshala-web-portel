"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface AcademicClass {
  id: string;
  name: string;
  numericValue: number;
}

interface AcademicSubject {
  id: string;
  name: string;
  nameHindi: string | null;
}

interface AcademicChapter {
  id: string;
  title: string;
  titleHindi: string | null;
  chapterNumber: number;
}

interface NcertDocItem {
  id: string;
  className: string;
  classNumeric: number;
  subjectName: string;
  subjectNameHindi: string | null;
  chapterTitle: string;
  chapterTitleHindi: string | null;
  chapterNumber: number;
  language: "ENGLISH" | "HINDI";
  fileUrl: string;
  fileName: string;
  fileSize: number;
  version: number;
  status: "PROCESSING" | "READY" | "FAILED" | "ARCHIVED";
  totalPages: number;
  pageRecordsCount: number;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface PageInspectorItem {
  id: string;
  pageNumber: number;
  textLength: number;
  textPreview: string;
  elementsCount: number;
  questionsGeneratedCount: number;
  processingStatus: string;
}

export default function NcertAdminClient() {
  const [documents, setDocuments] = useState<NcertDocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Metadata for filter dropdowns
  const [classesList, setClassesList] = useState<AcademicClass[]>([]);
  const [subjectsList, setSubjectsList] = useState<AcademicSubject[]>([]);

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadClassId, setUploadClassId] = useState("");
  const [uploadSubjectId, setUploadSubjectId] = useState("");
  const [uploadChapterId, setUploadChapterId] = useState("");
  const [uploadLanguage, setUploadLanguage] = useState<"ENGLISH" | "HINDI">("ENGLISH");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadSubjects, setUploadSubjects] = useState<AcademicSubject[]>([]);
  const [uploadChapters, setUploadChapters] = useState<AcademicChapter[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Inspector modal state
  const [inspectDoc, setInspectDoc] = useState<NcertDocItem | null>(null);
  const [inspectPages, setInspectPages] = useState<PageInspectorItem[]>([]);
  const [inspectLoading, setInspectLoading] = useState(false);

  // Delete modal state
  const [docToDelete, setDocToDelete] = useState<NcertDocItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Fetch initial classes and documents
  useEffect(() => {
    fetchClasses();
    fetchDocuments();
  }, []);

  // Fetch subjects when filter class changes
  useEffect(() => {
    if (selectedClassId) {
      fetch(`/api/ncert/subjects?classId=${selectedClassId}`)
        .then((res) => res.json())
        .then((data) => setSubjectsList(data.subjects || []))
        .catch(() => setSubjectsList([]));
    } else {
      setSubjectsList([]);
      setSelectedSubjectId("");
    }
  }, [selectedClassId]);

  // Upload modal: fetch subjects when uploadClassId changes
  useEffect(() => {
    if (uploadClassId) {
      fetch(`/api/ncert/subjects?classId=${uploadClassId}`)
        .then((res) => res.json())
        .then((data) => {
          setUploadSubjects(data.subjects || []);
          setUploadSubjectId("");
          setUploadChapters([]);
          setUploadChapterId("");
        })
        .catch(() => setUploadSubjects([]));
    }
  }, [uploadClassId]);

  // Upload modal: fetch chapters when uploadSubjectId changes
  useEffect(() => {
    if (uploadSubjectId) {
      fetch(`/api/ncert/chapters?subjectId=${uploadSubjectId}`)
        .then((res) => res.json())
        .then((data) => {
          setUploadChapters(data.chapters || []);
          setUploadChapterId("");
        })
        .catch(() => setUploadChapters([]));
    }
  }, [uploadSubjectId]);

  const fetchClasses = async () => {
    try {
      const res = await fetch("/api/ncert/classes");
      const data = await res.json();
      setClassesList(data.classes || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedClassId) params.set("classId", selectedClassId);
      if (selectedSubjectId) params.set("subjectId", selectedSubjectId);
      if (selectedLanguage) params.set("language", selectedLanguage);

      const res = await fetch(`/api/team/ncert/documents?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load documents");
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (e: any) {
      setError(e.message || "Failed to load NCERT materials");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [selectedClassId, selectedSubjectId, selectedLanguage]);

  // Helper to extract pages in browser worker without server payload limits
  const extractNcertPagesClient = async (
    file: File,
    onProgress: (msg: string) => void
  ): Promise<{ totalPages: number; pages: any[] }> => {
    onProgress("Initializing PDF engine in browser...");
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      cMapUrl: "https://unpkg.com/pdfjs-dist@4.0.0/cmaps/",
      cMapPacked: true,
    });

    const doc = await loadingTask.promise;
    const totalPages = doc.numPages;
    const pages: any[] = [];

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      onProgress(`Extracting page contents (${pageNum}/${totalPages})...`);
      const page = await doc.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Group items by line based on vertical coordinate Y
      const lineMap = new Map<number, string[]>();
      for (const item of textContent.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const transform = (item as any).transform;
        const y = Math.round(transform[5] / 4) * 4;
        if (!lineMap.has(y)) {
          lineMap.set(y, []);
        }
        lineMap.get(y)!.push(item.str);
      }

      const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a);
      const lines: string[] = [];
      for (const y of sortedY) {
        const lineText = lineMap.get(y)!.join(" ").trim();
        if (lineText) lines.push(lineText);
      }
      const fullPageText = lines.join("\n").trim();

      const extractedElements: any[] = [];
      let currentParagraphLines: string[] = [];
      const flushParagraph = () => {
        if (currentParagraphLines.length > 0) {
          const pText = currentParagraphLines.join(" ").trim();
          if (pText) extractedElements.push({ type: "paragraph", content: pText });
          currentParagraphLines = [];
        }
      };

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (
          /^(figure|fig\.|चित्र|table|सारणी|diagram)\s+[\d\.]+/i.test(trimmed) ||
          /^चित्र\s*[\d\.]+/i.test(trimmed)
        ) {
          flushParagraph();
          extractedElements.push({ type: "diagram_caption", content: trimmed });
          continue;
        }
        if (
          /^[0-9]+(\.[0-9]+)*\s+[A-Z\u0900-\u097F]/.test(trimmed) ||
          (/^[A-Z\s]{4,}$/.test(trimmed) && trimmed.length < 80)
        ) {
          flushParagraph();
          extractedElements.push({ type: "heading", content: trimmed });
          continue;
        }
        if (/^[•\-\*\u2022]\s+/.test(trimmed) || /^\([a-z0-9]+\)\s+/i.test(trimmed)) {
          flushParagraph();
          extractedElements.push({ type: "list", content: trimmed });
          continue;
        }
        currentParagraphLines.push(trimmed);
      }
      flushParagraph();

      pages.push({
        pageNumber: pageNum,
        extractedText: fullPageText,
        extractedElements,
      });
    }

    return { totalPages, pages };
  };

  // Handle Upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadClassId || !uploadSubjectId || !uploadChapterId || !uploadFile) {
      setUploadError("Please fill all required fields and choose a PDF file.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      // 1. Extract pages in browser using pdfjs
      let clientExtraction: { totalPages: number; pages: any[] } | null = null;
      try {
        clientExtraction = await extractNcertPagesClient(uploadFile, (msg) => {
          setUploadProgressMsg(msg);
        });
      } catch (pdfErr: any) {
        console.warn("[NCERT Client Extraction] Browser extraction skipped, falling back to server:", pdfErr);
      }

      // 2. Request presigned upload URL from server
      setUploadProgressMsg("Preparing direct storage upload...");
      let presignSuccessful = false;
      try {
        const presignRes = await fetch("/api/team/ncert/upload/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            academicClassId: uploadClassId,
            academicSubjectId: uploadSubjectId,
            academicChapterId: uploadChapterId,
            language: uploadLanguage,
            fileName: uploadFile.name,
            contentType: "application/pdf",
          }),
        });

        if (presignRes.ok) {
          const presignData = await presignRes.json();
          const { uploadUrl, r2Key } = presignData;

          // 3. Upload directly to Cloudflare R2 (bypassing Vercel 4.5MB payload limit completely)
          setUploadProgressMsg(
            `Uploading PDF directly to storage (${(uploadFile.size / (1024 * 1024)).toFixed(1)} MB)...`
          );
          const r2UploadRes = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
              "Content-Type": "application/pdf",
            },
            body: uploadFile,
          });

          if (!r2UploadRes.ok) {
            const r2ErrText = await r2UploadRes.text().catch(() => "");
            throw new Error(`Direct storage upload failed (${r2UploadRes.status}): ${r2ErrText || r2UploadRes.statusText}`);
          }

          // 4. Finalize document & pages
          setUploadProgressMsg(`Saving chapter pages (${clientExtraction?.totalPages || 0} pages)...`);
          const completeRes = await fetch("/api/team/ncert/upload/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              academicClassId: uploadClassId,
              academicSubjectId: uploadSubjectId,
              academicChapterId: uploadChapterId,
              language: uploadLanguage,
              r2Key,
              fileName: uploadFile.name,
              fileSize: uploadFile.size,
              totalPages: clientExtraction?.totalPages || 0,
              pages: clientExtraction?.pages || [],
            }),
          });

          const completeText = await completeRes.text();
          let completeData: any = null;
          try {
            completeData = JSON.parse(completeText);
          } catch {
            throw new Error(completeText || `Finalizing upload failed (${completeRes.status})`);
          }

          if (!completeRes.ok) {
            throw new Error(completeData?.error || "Failed to finalize upload");
          }

          setUploadProgressMsg(`Success! Extracted ${completeData.extractedPages || 0} pages.`);
          setTimeout(() => {
            setIsUploadOpen(false);
            setIsUploading(false);
            setUploadFile(null);
            setUploadProgressMsg("");
            fetchDocuments();
          }, 1200);
          presignSuccessful = true;
          return;
        }
      } catch (directErr: any) {
        console.warn("[NCERT Upload] Direct storage upload error, trying gateway fallback:", directErr);
        if (uploadFile.size > 4.5 * 1024 * 1024) {
          throw new Error(directErr.message || "Failed to upload file to storage.");
        }
      }

      if (!presignSuccessful) {
        // Fallback: If presign route is not available or returned non-ok, attempt standard upload
        setUploadProgressMsg("Uploading PDF via gateway fallback...");
        const formData = new FormData();
        formData.append("academicClassId", uploadClassId);
        formData.append("academicSubjectId", uploadSubjectId);
        formData.append("academicChapterId", uploadChapterId);
        formData.append("language", uploadLanguage);
        formData.append("file", uploadFile);

        const res = await fetch("/api/team/ncert/upload", {
          method: "POST",
          body: formData,
        });

        const resText = await res.text();
        let data: any = null;
        try {
          data = JSON.parse(resText);
        } catch {
          if (
            res.status === 413 ||
            resText.toLowerCase().includes("request entity too large") ||
            resText.toLowerCase().includes("payload too large")
          ) {
            throw new Error(
              `File is too large (${(uploadFile.size / (1024 * 1024)).toFixed(1)} MB). Server gateway limit is 4.5 MB. Direct storage upload is required.`
            );
          }
          throw new Error(resText || `Upload failed (${res.status})`);
        }

        if (!res.ok) {
          throw new Error(data?.error || "Upload or processing failed");
        }

        setUploadProgressMsg(`Success! Extracted ${data.extractedPages || 0} pages.`);
        setTimeout(() => {
          setIsUploadOpen(false);
          setIsUploading(false);
          setUploadFile(null);
          setUploadProgressMsg("");
          fetchDocuments();
        }, 1200);
      }
    } catch (err: any) {
      console.error("[NCERT Upload Error]:", err);
      setUploadError(err.message || "Upload failed");
      setIsUploading(false);
    }
  };

  // Inspect Pages
  const openInspector = async (doc: NcertDocItem) => {
    setInspectDoc(doc);
    setInspectPages([]);
    setInspectLoading(true);
    try {
      const res = await fetch(`/api/team/ncert/documents/${doc.id}/pages`);
      const data = await res.json();
      setInspectPages(data.pages || []);
    } catch (e) {
      console.error(e);
    } finally {
      setInspectLoading(false);
    }
  };

  // Toggle Document Status
  const toggleDocStatus = async (docId: string, currentStatus: string) => {
    const newStatus = currentStatus === "READY" ? "ARCHIVED" : "READY";
    try {
      const res = await fetch(`/api/team/ncert/documents/${docId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setDocuments((prev) =>
          prev.map((d) => (d.id === docId ? { ...d, status: newStatus as any } : d))
        );
      }
    } catch (e) {
      console.error("Status update error", e);
    }
  };

  // Delete Document
  const handleDeleteDocument = async () => {
    if (!docToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/team/ncert/documents/${docToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete chapter document");
      }
      setDocuments((prev) => prev.filter((d) => d.id !== docToDelete.id));
      setDocToDelete(null);
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete chapter");
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered documents by search
  const filteredDocs = documents.filter((doc) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      doc.chapterTitle.toLowerCase().includes(q) ||
      (doc.chapterTitleHindi && doc.chapterTitleHindi.toLowerCase().includes(q)) ||
      doc.subjectName.toLowerCase().includes(q) ||
      doc.className.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-600 text-3xl">menu_book</span>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              NCERT Practice Hub & Content Ops
            </h1>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Manage official NCERT textbook materials, page extractions, and AI-grounded question verification pools.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/practice/ncert"
            target="_blank"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            <span className="material-symbols-outlined text-lg">open_in_new</span>
            Student NCERT View
          </Link>

          <button
            onClick={() => {
              setIsUploadOpen(true);
              setUploadError(null);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-sm shadow-teal-500/20 transition"
          >
            <span className="material-symbols-outlined text-lg">upload_file</span>
            Upload NCERT Chapter PDF
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Chapters Mapped</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {documents.length}
          </div>
          <div className="text-xs text-teal-600 font-medium mt-1">Across 11th & 12th Classes</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Pages Processed</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {documents.reduce((sum, d) => sum + d.totalPages, 0)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Extracted & indexed page-by-page</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">English Materials</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {documents.filter((d) => d.language === "ENGLISH").length}
          </div>
          <div className="text-xs text-emerald-600 font-medium mt-1">Strict English syllabus</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Hindi (हिंदी) Materials</div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {documents.filter((d) => d.language === "HINDI").length}
          </div>
          <div className="text-xs text-amber-600 font-medium mt-1">Strict Hindi Devanagari syllabus</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px]">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by chapter, class or subject..."
              className="w-full pl-10 pr-4 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Class Filter */}
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium"
        >
          <option value="">All Classes</option>
          {classesList.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Subject Filter */}
        {selectedClassId && (
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium"
          >
            <option value="">All Subjects</option>
            {subjectsList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}

        {/* Language Filter */}
        <select
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium"
        >
          <option value="">All Languages</option>
          <option value="ENGLISH">English Medium</option>
          <option value="HINDI">Hindi Medium (हिंदी)</option>
        </select>

        {(selectedClassId || selectedSubjectId || selectedLanguage || searchQuery) && (
          <button
            onClick={() => {
              setSelectedClassId("");
              setSelectedSubjectId("");
              setSelectedLanguage("");
              setSearchQuery("");
            }}
            className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white underline font-medium"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Documents Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500">
            <span className="material-symbols-outlined text-4xl animate-spin text-teal-600 mb-2">
              progress_activity
            </span>
            <p className="text-sm font-medium">Loading NCERT documents & extraction index...</p>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-rose-500">
            <span className="material-symbols-outlined text-3xl mb-1">error</span>
            <p className="text-sm">{error}</p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-700 mb-2">
              folder_off
            </span>
            <p className="font-bold text-slate-800 dark:text-slate-200">No NCERT Documents Found</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Upload textbook PDFs using the button above to enable page-by-page extraction and question practice.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-bold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Chapter & Content</th>
                  <th className="px-5 py-3.5">Class / Subject</th>
                  <th className="px-5 py-3.5">Language</th>
                  <th className="px-5 py-3.5 text-center">Extracted Pages</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 font-mono">
                          Ch {doc.chapterNumber}
                        </span>
                        {doc.chapterTitle}
                      </div>
                      {doc.chapterTitleHindi && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                          {doc.chapterTitleHindi}
                        </div>
                      )}
                      <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                        <span>{doc.fileName}</span>
                        <span>•</span>
                        <span>{(doc.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                        <span>•</span>
                        <span>v{doc.version}</span>
                      </div>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {doc.className}
                      </div>
                      <div className="text-xs text-slate-500">
                        {doc.subjectName}
                        {doc.subjectNameHindi && ` (${doc.subjectNameHindi})`}
                      </div>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      {doc.language === "ENGLISH" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                          English Medium
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                          हिंदी माध्यम
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap text-center">
                      <div className="font-black text-slate-900 dark:text-white">
                        {doc.totalPages} pages
                      </div>
                      <div className="text-[11px] text-teal-600 dark:text-teal-400 font-medium">
                        {doc.pageRecordsCount} indexed
                      </div>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap text-center">
                      {doc.status === "READY" && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-500/30">
                          READY
                        </span>
                      )}
                      {doc.status === "PROCESSING" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 animate-pulse border border-blue-500/30">
                          PROCESSING
                        </span>
                      )}
                      {doc.status === "FAILED" && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950 text-rose-600 border border-rose-500/30">
                          FAILED
                        </span>
                      )}
                      {doc.status === "ARCHIVED" && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
                          ARCHIVED
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap text-right space-x-2">
                      <button
                        onClick={() => openInspector(doc)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
                      >
                        <span className="material-symbols-outlined text-sm">visibility</span>
                        Inspect Pages
                      </button>

                      <Link
                        href={`/practice/ncert/${doc.id}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300 transition"
                      >
                        <span className="material-symbols-outlined text-sm">play_circle</span>
                        Student View
                      </Link>

                      <button
                        onClick={() => toggleDocStatus(doc.id, doc.status)}
                        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
                        title={doc.status === "READY" ? "Archive document" : "Activate document"}
                      >
                        <span className="material-symbols-outlined text-sm">
                          {doc.status === "READY" ? "archive" : "unarchive"}
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          setDeleteError(null);
                          setDocToDelete(doc);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
                        title="Delete chapter document"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-600">upload_file</span>
                <h3 className="font-bold text-slate-900 dark:text-white">Upload NCERT Chapter PDF</h3>
              </div>
              <button
                onClick={() => !isUploading && setIsUploadOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
              {uploadError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">error</span>
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Class Select */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Class
                </label>
                <select
                  required
                  disabled={isUploading}
                  value={uploadClassId}
                  onChange={(e) => setUploadClassId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="">Select Academic Class</option>
                  {classesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject Select */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Subject
                </label>
                <select
                  required
                  disabled={isUploading || !uploadClassId}
                  value={uploadSubjectId}
                  onChange={(e) => setUploadSubjectId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white disabled:opacity-50"
                >
                  <option value="">Select Subject</option>
                  {uploadSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.nameHindi ? `(${s.nameHindi})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Chapter Select */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Chapter
                </label>
                <select
                  required
                  disabled={isUploading || !uploadSubjectId}
                  value={uploadChapterId}
                  onChange={(e) => setUploadChapterId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white disabled:opacity-50"
                >
                  <option value="">Select Official NCERT Chapter</option>
                  {uploadChapters.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      Ch {ch.chapterNumber}: {ch.title} {ch.titleHindi ? `| ${ch.titleHindi}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Language Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Target Language / Medium
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => setUploadLanguage("ENGLISH")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      uploadLanguage === "ENGLISH"
                        ? "border-teal-500 bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300"
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">language</span>
                    English
                  </button>
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => setUploadLanguage("HINDI")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      uploadLanguage === "HINDI"
                        ? "border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">translate</span>
                    हिंदी (Hindi)
                  </button>
                </div>
              </div>

              {/* PDF File Picker */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  NCERT Chapter PDF File
                </label>
                <input
                  type="file"
                  required
                  accept="application/pdf"
                  disabled={isUploading}
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 dark:file:bg-teal-950 dark:file:text-teal-300 hover:file:bg-teal-100"
                />
              </div>

              {isUploading && (
                <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-500/30">
                  <div className="flex items-center gap-2 text-xs font-bold text-teal-700 dark:text-teal-300">
                    <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                    <span>{uploadProgressMsg}</span>
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => setIsUploadOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isUploading ? "Processing..." : "Upload & Extract Pages"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect Pages Slideover Modal */}
      {inspectDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-teal-600">find_in_page</span>
                  Page-wise Index: {inspectDoc.chapterTitle}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Class {inspectDoc.classNumeric} • {inspectDoc.subjectName} • {inspectDoc.language} • {inspectDoc.totalPages} Pages
                </p>
              </div>
              <button
                onClick={() => setInspectDoc(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {inspectLoading ? (
                <div className="py-12 text-center text-slate-500">
                  <span className="material-symbols-outlined animate-spin text-3xl text-teal-600 mb-2">
                    progress_activity
                  </span>
                  <p className="text-xs font-medium">Loading page details...</p>
                </div>
              ) : inspectPages.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <p className="text-sm">No page records extracted for this document.</p>
                </div>
              ) : (
                inspectPages.map((page) => (
                  <div
                    key={page.id}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-teal-600 text-white font-black text-xs flex items-center justify-center">
                          {page.pageNumber}
                        </span>
                        <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                          Page {page.pageNumber}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          ({page.textLength} characters extracted)
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                          {page.questionsGeneratedCount} Verified Questions in Pool
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {page.processingStatus}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 font-mono leading-relaxed line-clamp-3">
                      {page.textPreview}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex justify-between items-center text-xs text-slate-500">
              <span>Strict Page Boundary is enforced for all question generation.</span>
              <button
                onClick={() => setInspectDoc(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {docToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">delete_forever</span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Delete Chapter Document?
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Are you sure you want to permanently delete{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    "{docToDelete.chapterTitle}" (v{docToDelete.version})
                  </span>
                  ?
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Class & Subject:</span>
                  <span className="font-medium">{docToDelete.className} • {docToDelete.subjectName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Language:</span>
                  <span className="font-medium">{docToDelete.language}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Extracted Pages:</span>
                  <span className="font-medium">{docToDelete.totalPages} pages ({docToDelete.pageRecordsCount} indexed)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">File:</span>
                  <span className="font-medium truncate max-w-[200px]">{docToDelete.fileName}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2">
                <span className="material-symbols-outlined text-base shrink-0 mt-0.5">warning</span>
                <span>
                  This will permanently delete all extracted pages, associated page questions, and student progress for this document. This action cannot be undone.
                </span>
              </div>

              {deleteError && (
                <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-950 text-xs text-rose-700 dark:text-rose-300 font-medium">
                  {deleteError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => {
                    setDocToDelete(null);
                    setDeleteError(null);
                  }}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDeleteDocument}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-600/20 transition disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">delete</span>
                      Delete Chapter
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
