"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import katex from "katex";
import "katex/dist/katex.min.css";
import { renderFormulaContent } from "@/lib/test-portal/formula";

type FontFamily = "helvetica" | "times" | "courier";
type Align = "left" | "center" | "right" | "justify";

type ElementStyle = {
  fontFamily?: FontFamily;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  align?: Align;
  lineHeight?: number;
  letterSpacing?: number;
};

type ElementRow = {
  id: string;
  type: string;
  order: number;
  content: string;
  style?: ElementStyle;
  tableData?: string[][];
  variant?: string;
  label?: string;
};

const CALLOUT_COLORS: Record<string, string> = {
  CONCEPT: "#2563eb",
  NOTE: "#d97706",
  EXAMPLE: "#7c3aed",
  TIP: "#059669",
  REMEMBER: "#e11d48",
  CAUTION: "#dc2626",
  FORMULA: "#4338ca",
  SUMMARY: "#0d9488",
};

const THEME_OPTIONS: { value: string; label: string; swatch: string }[] = [
  { value: "ATOMIC_BLUE", label: "Atomic Blue", swatch: "#1d4ed8" },
  { value: "SUNRISE", label: "Sunrise", swatch: "#ea580c" },
  { value: "EMERALD", label: "Emerald", swatch: "#047857" },
  { value: "ROYAL", label: "Royal", swatch: "#6d28d9" },
];

const LAYOUT_PRESETS = [
  { id: "MODERN_ACADEMIC", label: "Modern Academic", desc: "Clean cards & NEET/JEE hierarchy", icon: "school" },
  { id: "PREMIUM_EDTECH", label: "Premium EdTech", desc: "Vibrant section headers & cards", icon: "auto_awesome" },
  { id: "EXAM_REVISION", label: "Exam Revision", desc: "High-density formula & insight cards", icon: "bolt" },
  { id: "CONCEPT_MAP", label: "Concept Map", desc: "Relational definitions & examples", icon: "account_tree" },
  { id: "NCERT_ACADEMIC", label: "NCERT Academic", desc: "Canonical textbook styling", icon: "menu_book" },
  { id: "VISUAL_LEARNING", label: "Visual Learning", desc: "Diagram & mechanism focus", icon: "image" },
] as const;

const REBRAND_PRESETS = [
  { value: "ATOMIC_DEFAULT", label: "Atomic Default", desc: "Orange banner & navy headers", icon: "verified" },
  { value: "CHEMISTRY", label: "Chemistry Focus", desc: "Equations & structures preserve", icon: "science" },
  { value: "PHYSICS", label: "Physics Precision", desc: "Formulas & notation preserve", icon: "bolt" },
  { value: "BIOLOGY", label: "Biology Standard", desc: "Diagrams & tables preserve", icon: "psychology" },
  { value: "MINIMAL", label: "Minimal Clean", desc: "Ultra-light accent borders", icon: "format_paint" },
  { value: "TEACHER_CUSTOM", label: "Teacher Custom", desc: "Faculty & batch credentials", icon: "person" },
] as const;

function parseRenames(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = line.split(/\s*(?:=>|->|→|=)\s*/);
    if (m.length === 2 && m[0]!.trim() && m[1]!.trim()) out[m[0]!.trim()] = m[1]!.trim();
  }
  return out;
}

type PageRow = {
  id: string;
  pageNumber: number;
  width: number;
  height: number;
  pdfType: string;
  elements: ElementRow[];
  ocrConfidence: number | null;
  needsReview: boolean;
  warnings: string[];
};

type VersionRow = { id: string; label: string; createdAt: string };
type ExportRow = { id: string; fileUrl: string; fileName: string; fileSize: number; createdAt: string; includedWatermark: boolean };

type PageStatusItem = {
  pageNumber: number;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  attempts: number;
  error?: string | null;
  elementsCount: number;
  durationMs?: number;
  isScanned: boolean;
};

type JobStatusData = {
  jobId: string;
  moduleId: string;
  stage: string;
  progress: number;
  totalPages: number;
  completedPages: number;
  failedPages: number;
  pageStatuses: Record<number, PageStatusItem>;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
  pdfType: string;
  isCached: boolean;
};

type ModuleDetail = {
  id: string;
  code: string;
  title: string;
  status: string;
  subject: string | null;
  class: string | null;
  batch: string | null;
  chapter: string | null;
  facultyName: string | null;
  academicYear: string | null;
  layoutStyle: string | null;
  contentHash: string | null;
  pageCount: number | null;
  originalFileUrl: string;
  originalFileName: string;
  brandProfile: { id: string; name: string } | null;
  pages: PageRow[];
  versions: VersionRow[];
  exportHistory: ExportRow[];
  processingJobs: { stage: string; progress: number; errorMessage: string | null }[];
};

const ELEMENT_TYPES = [
  "TEXT",
  "HEADING",
  "SUBHEADING",
  "PARAGRAPH",
  "QUESTION",
  "OPTION",
  "SOLUTION",
  "IMAGE",
  "DIAGRAM",
  "EQUATION",
  "CHEMICAL_EQUATION",
  "CHEMICAL_STRUCTURE",
  "TABLE",
  "CALLOUT",
  "BULLETS",
];

const ADD_PALETTE: { type: string; label: string; icon: string }[] = [
  { type: "HEADING", label: "Heading", icon: "title" },
  { type: "SUBHEADING", label: "Subheading", icon: "short_text" },
  { type: "PARAGRAPH", label: "Paragraph", icon: "notes" },
  { type: "QUESTION", label: "Question", icon: "help" },
  { type: "OPTION", label: "Option", icon: "radio_button_checked" },
  { type: "SOLUTION", label: "Solution", icon: "check_circle" },
  { type: "EQUATION", label: "Formula", icon: "functions" },
  { type: "IMAGE", label: "Image", icon: "image" },
  { type: "TABLE", label: "Table", icon: "table_chart" },
  { type: "CALLOUT", label: "Box", icon: "lightbulb" },
  { type: "BULLETS", label: "Bullets", icon: "format_list_bulleted" },
];

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-surface-container-high text-on-surface-variant",
  PROCESSING: "bg-primary/10 text-primary",
  REVIEW_REQUIRED: "bg-amber-500/10 text-amber-600",
  READY: "bg-green-500/10 text-green-600",
  PUBLISHED: "bg-secondary/10 text-secondary",
  ARCHIVED: "bg-surface-container-high text-on-surface-variant",
  FAILED: "bg-red-500/10 text-red-600",
};

const FONT_CSS: Record<FontFamily, string> = {
  helvetica: "Arial, Helvetica, sans-serif",
  times: '"Times New Roman", Times, serif',
  courier: '"Courier New", Courier, monospace',
};
const FONT_LABEL: Record<FontFamily, string> = { helvetica: "Sans", times: "Serif", courier: "Mono" };

type TypeDefault = { fontFamily: FontFamily; fontSize: number; bold: boolean; italic: boolean; align: Align; indentPx: number };
const TYPE_DEFAULTS: Record<string, TypeDefault> = {
  HEADING: { fontFamily: "helvetica", fontSize: 15, bold: true, italic: false, align: "left", indentPx: 0 },
  SUBHEADING: { fontFamily: "helvetica", fontSize: 12, bold: true, italic: false, align: "left", indentPx: 0 },
  QUESTION: { fontFamily: "helvetica", fontSize: 11, bold: true, italic: false, align: "left", indentPx: 0 },
  OPTION: { fontFamily: "helvetica", fontSize: 10, bold: false, italic: false, align: "left", indentPx: 22 },
  SOLUTION: { fontFamily: "helvetica", fontSize: 10, bold: false, italic: true, align: "left", indentPx: 0 },
  EQUATION: { fontFamily: "courier", fontSize: 10, bold: false, italic: false, align: "left", indentPx: 15 },
  CHEMICAL_EQUATION: { fontFamily: "courier", fontSize: 10, bold: false, italic: false, align: "left", indentPx: 15 },
  CHEMICAL_STRUCTURE: { fontFamily: "courier", fontSize: 10, bold: false, italic: false, align: "left", indentPx: 15 },
  DIAGRAM: { fontFamily: "helvetica", fontSize: 10, bold: false, italic: false, align: "left", indentPx: 0 },
  TABLE: { fontFamily: "courier", fontSize: 9, bold: false, italic: false, align: "left", indentPx: 0 },
  IMAGE: { fontFamily: "helvetica", fontSize: 9, bold: false, italic: false, align: "left", indentPx: 0 },
  PARAGRAPH: { fontFamily: "helvetica", fontSize: 10.5, bold: false, italic: false, align: "left", indentPx: 0 },
  TEXT: { fontFamily: "helvetica", fontSize: 10.5, bold: false, italic: false, align: "left", indentPx: 0 },
  CALLOUT: { fontFamily: "helvetica", fontSize: 10.5, bold: false, italic: false, align: "left", indentPx: 0 },
  BULLETS: { fontFamily: "helvetica", fontSize: 10.5, bold: false, italic: false, align: "left", indentPx: 0 },
};

function typeDefault(type: string): TypeDefault {
  return TYPE_DEFAULTS[type] ?? TYPE_DEFAULTS.TEXT!;
}

function effectiveStyle(el: ElementRow) {
  const base = typeDefault(el.type);
  const s = el.style ?? {};
  return {
    fontFamily: s.fontFamily ?? base.fontFamily,
    fontSize: s.fontSize ?? base.fontSize,
    bold: s.bold ?? base.bold,
    italic: s.italic ?? base.italic,
    align: s.align ?? base.align,
    lineHeight: s.lineHeight ?? 1,
    letterSpacing: s.letterSpacing ?? 0,
    color: s.color ?? "#111827",
    indentPx: base.indentPx,
  };
}

function elementCssStyle(el: ElementRow): CSSProperties {
  const eff = effectiveStyle(el);
  return {
    fontFamily: FONT_CSS[eff.fontFamily],
    fontSize: `${eff.fontSize}pt`,
    fontWeight: eff.bold ? 700 : 400,
    fontStyle: eff.italic ? "italic" : "normal",
    color: eff.color,
    textAlign: eff.align,
    lineHeight: eff.lineHeight,
    letterSpacing: `${eff.letterSpacing}px`,
    paddingLeft: eff.indentPx,
  };
}

function extractImgUrl(content: string): string | null {
  const match = /!\[[^\]]*\]\((.+?)\)/.exec(content);
  return match?.[1] ?? null;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

const AUTOSAVE_DELAY_MS = 1500;
const HISTORY_LIMIT = 50;

export function ModuleEditor({ moduleId }: { moduleId: string }) {
  const [data, setData] = useState<ModuleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [jobStatus, setJobStatus] = useState<JobStatusData | null>(null);
  const [pageEdits, setPageEdits] = useState<Record<string, ElementRow[]>>({});
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [uploadingImageFor, setUploadingImageFor] = useState<string | null>(null);
  const [versionLabel, setVersionLabel] = useState("");
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [exportVersionId, setExportVersionId] = useState("");
  const [includeWatermark, setIncludeWatermark] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Edit Details Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editChapter, setEditChapter] = useState("");
  const [editClass, setEditClass] = useState("");
  const [editBatch, setEditBatch] = useState("");
  const [editFaculty, setEditFaculty] = useState("");
  const [editYear, setEditYear] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);

  // Layout & Theme Options
  const [selectedLayout, setSelectedLayout] = useState<string>("MODERN_ACADEMIC");
  const [removeWordsText, setRemoveWordsText] = useState("");
  const [renamesText, setRenamesText] = useState("Example => Illustration");
  const [fromPage, setFromPage] = useState("");
  const [toPage, setToPage] = useState("");
  const [exportDesign, setExportDesign] = useState<"premium" | "classic">("premium");
  const [exportTheme, setExportTheme] = useState("ATOMIC_BLUE");

  // High-Fidelity Vector Rebranding & Document Preservation Studio
  const [rebrandPreset, setRebrandPreset] = useState<string>("ATOMIC_DEFAULT");
  const [teacherNameOverride, setTeacherNameOverride] = useState("");
  const [batchNameOverride, setBatchNameOverride] = useState("");
  const [chapterNameOverride, setChapterNameOverride] = useState("");
  const [removeOldHeader, setRemoveOldHeader] = useState(true);
  const [removeOldFooter, setRemoveOldFooter] = useState(true);
  const [oldHeaderHeight, setOldHeaderHeight] = useState(34);
  const [oldFooterHeight, setOldFooterHeight] = useState(26);
  const [rebrandWatermark, setRebrandWatermark] = useState(true);
  const [watermarkCustomText, setWatermarkCustomText] = useState("ATOMIC PATHSHALA");
  const [rebranding, setRebranding] = useState(false);
  const [verificationReport, setVerificationReport] = useState<any | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  const pageEditsRef = useRef(pageEdits);
  useEffect(() => {
    pageEditsRef.current = pageEdits;
  }, [pageEdits]);

  const savedSnapshotRef = useRef<Record<string, string>>({});
  const historyRef = useRef<Record<string, { stack: ElementRow[][]; index: number }>>({});
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingImageTargetRef = useRef<{ pageId: string; elId: string } | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/team/modules/${moduleId}`);
      const body = await res.json();
      if (!body.success) {
        setError(body.error ?? "Could not load this module.");
        return;
      }
      const m = body.data.module as ModuleDetail;
      setData(m);
      setSelectedLayout(m.layoutStyle || "MODERN_ACADEMIC");
      setEditTitle(m.title);
      setEditSubject(m.subject || "");
      setEditChapter(m.chapter || "");
      setEditClass(m.class || "");
      setEditBatch(m.batch || "");
      setEditFaculty(m.facultyName || "");
      setEditYear(m.academicYear || "");

      const edits: Record<string, ElementRow[]> = {};
      for (const p of m.pages) {
        edits[p.id] = p.elements;
        savedSnapshotRef.current[p.id] = JSON.stringify(p.elements);
        historyRef.current[p.id] = { stack: [p.elements], index: 0 };
      }
      setPageEdits(edits);
      setSelectedPageId((prev) => (prev && m.pages.some((p) => p.id === prev) ? prev : (m.pages[0]?.id ?? null)));

      if (m.status === "PROCESSING") {
        setProcessing(true);
      }
    } catch {
      setError("Failed to connect to module service.");
    }
  }, [moduleId]);

  useEffect(() => {
    load();
  }, [load]);

  // Polling for live asynchronous job progress
  useEffect(() => {
    if (!processing) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    const pollJob = async () => {
      try {
        const res = await fetch(`/api/team/modules/${moduleId}/process`);
        const body = await res.json();
        if (body.success && body.data.job) {
          const job = body.data.job as JobStatusData;
          setJobStatus(job);
          if (job.stage === "READY_FOR_REVIEW" || job.finishedAt || job.stage === "FAILED") {
            setProcessing(false);
            if (pollingRef.current) clearInterval(pollingRef.current);
            await load();
          }
        }
      } catch {
        // Transient network drop during poll — don't crash, will retry on next tick
      }
    };

    pollJob();
    pollingRef.current = setInterval(pollJob, 1600);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [processing, moduleId, load]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const pid = selectedPageId;
      if (!pid) return;
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo(pid);
      } else if ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo(pid);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedPageId]);

  function pushHistory(pageId: string, snapshot: ElementRow[]) {
    const h = historyRef.current[pageId] ?? { stack: [snapshot], index: 0 };
    const truncated = h.stack.slice(0, h.index + 1);
    truncated.push(snapshot);
    const capped = truncated.length > HISTORY_LIMIT ? truncated.slice(truncated.length - HISTORY_LIMIT) : truncated;
    historyRef.current[pageId] = { stack: capped, index: capped.length - 1 };
  }

  function undo(pageId: string) {
    const h = historyRef.current[pageId];
    if (!h || h.index <= 0) return;
    h.index -= 1;
    setPageEdits((prev) => ({ ...prev, [pageId]: h.stack[h.index]! }));
    scheduleAutosave();
  }

  function redo(pageId: string) {
    const h = historyRef.current[pageId];
    if (!h || h.index >= h.stack.length - 1) return;
    h.index += 1;
    setPageEdits((prev) => ({ ...prev, [pageId]: h.stack[h.index]! }));
    scheduleAutosave();
  }

  function scheduleAutosave() {
    setSaveStatus("idle");
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      const pid = selectedPageId;
      if (!pid) return;
      const current = pageEditsRef.current[pid] ?? [];
      if (JSON.stringify(current) === savedSnapshotRef.current[pid]) return;
      savePage(pid, { silent: true });
    }, AUTOSAVE_DELAY_MS);
  }

  function updateElement(pageId: string, elId: string, patch: Partial<ElementRow>) {
    setPageEdits((prev) => {
      const next = (prev[pageId] ?? []).map((el) => (el.id === elId ? { ...el, ...patch } : el));
      pushHistory(pageId, next);
      return { ...prev, [pageId]: next };
    });
    scheduleAutosave();
  }

  function updateElementLive(pageId: string, elId: string, patch: Partial<ElementRow>) {
    setPageEdits((prev) => ({
      ...prev,
      [pageId]: (prev[pageId] ?? []).map((el) => (el.id === elId ? { ...el, ...patch } : el)),
    }));
    scheduleAutosave();
  }

  function commitHistorySnapshot(pageId: string) {
    pushHistory(pageId, pageEditsRef.current[pageId] ?? []);
  }

  function removeElement(pageId: string, elId: string) {
    setPageEdits((prev) => {
      const next = (prev[pageId] ?? []).filter((el) => el.id !== elId).map((el, idx) => ({ ...el, order: idx }));
      pushHistory(pageId, next);
      return { ...prev, [pageId]: next };
    });
    setSelectedElementId((prev) => (prev === elId ? null : prev));
    scheduleAutosave();
  }

  function addElement(pageId: string, type: string) {
    const list = pageEditsRef.current[pageId] ?? [];
    const afterIdx = selectedElementId ? list.findIndex((e) => e.id === selectedElementId) : -1;
    const insertAt = afterIdx >= 0 ? afterIdx + 1 : list.length;
    const newEl: ElementRow = {
      id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      order: 0,
      content: "",
      ...(type === "TABLE" ? { tableData: [["", ""], ["", ""]] } : {}),
    };
    const next = [...list.slice(0, insertAt), newEl, ...list.slice(insertAt)].map((el, idx) => ({ ...el, order: idx }));
    setPageEdits((prev) => ({ ...prev, [pageId]: next }));
    pushHistory(pageId, next);
    setSelectedElementId(newEl.id);
    scheduleAutosave();
  }

  function reorderElement(pageId: string, fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return;
    setPageEdits((prev) => {
      const list = (prev[pageId] ?? []).slice().sort((a, b) => a.order - b.order);
      const [moved] = list.splice(fromIdx, 1);
      if (!moved) return prev;
      list.splice(toIdx, 0, moved);
      const next = list.map((el, idx) => ({ ...el, order: idx }));
      pushHistory(pageId, next);
      return { ...prev, [pageId]: next };
    });
    scheduleAutosave();
  }

  async function runProcess() {
    setProcessing(true);
    setError(null);
    try {
      const removeWords = removeWordsText
        .split(/[\n,]/)
        .map((w) => w.trim())
        .filter(Boolean);
      const res = await fetch(`/api/team/modules/${moduleId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          removeWords,
          renames: parseRenames(renamesText),
          fromPage: Number(fromPage) || undefined,
          toPage: Number(toPage) || undefined,
        }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error ?? "Failed to initiate extraction job.");
        setProcessing(false);
      } else {
        if (body.data.isCached) {
          setProcessing(false);
          await load();
        }
      }
    } catch {
      setError("Unable to connect to server. Please check your connection.");
      setProcessing(false);
    }
  }

  async function cancelCurrentJob() {
    try {
      await fetch(`/api/team/modules/${moduleId}/process?action=cancel`, { method: "POST" });
      setProcessing(false);
      await load();
    } catch {
      setError("Failed to cancel job.");
    }
  }

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    setSavingDetails(true);
    setError(null);
    try {
      const res = await fetch(`/api/team/modules/${moduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          subject: editSubject || undefined,
          chapter: editChapter || undefined,
          class: editClass || undefined,
          batch: editBatch || undefined,
          facultyName: editFaculty || undefined,
          academicYear: editYear || undefined,
          layoutStyle: selectedLayout,
        }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error ?? "Could not update module details.");
      } else {
        setShowEditModal(false);
        await load();
      }
    } catch {
      setError("Network connection error. Please try again.");
    } finally {
      setSavingDetails(false);
    }
  }

  async function updateLayoutStyle(newLayout: string) {
    setSelectedLayout(newLayout);
    try {
      await fetch(`/api/team/modules/${moduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layoutStyle: newLayout }),
      });
      setData((prev) => (prev ? { ...prev, layoutStyle: newLayout } : prev));
    } catch {
      // Best effort background sync
    }
  }

  async function savePage(pageId: string, opts?: { silent?: boolean; markReviewed?: boolean }) {
    setSaveStatus("saving");
    if (!opts?.silent) setError(null);
    try {
      const elements = (pageEditsRef.current[pageId] ?? [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((el, idx) => ({ ...el, order: idx }));
      const res = await fetch(`/api/team/modules/${moduleId}/pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          elements,
          ...(opts?.markReviewed !== undefined && { needsReview: !opts.markReviewed }),
        }),
      });
      const body = await res.json();
      if (!body.success) {
        setSaveStatus("error");
        if (!opts?.silent) setError(body.error ?? "Could not save this page.");
        return;
      }
      const savedElements = body.data.page.elements as ElementRow[];
      savedSnapshotRef.current[pageId] = JSON.stringify(savedElements);
      setPageEdits((prev) => ({ ...prev, [pageId]: savedElements }));
      setData((prev) =>
        prev
          ? { ...prev, pages: prev.pages.map((p) => (p.id === pageId ? { ...p, elements: savedElements, needsReview: body.data.page.needsReview } : p)) }
          : prev
      );
      setSaveStatus("saved");
      if (opts?.markReviewed) await load();
    } catch {
      setSaveStatus("error");
      if (!opts?.silent) setError("Network connection error. Please try again.");
    }
  }

  function triggerImageUpload(pageId: string, elId: string) {
    pendingImageTargetRef.current = { pageId, elId };
    fileInputRef.current?.click();
  }

  async function onImageFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    const target = pendingImageTargetRef.current;
    pendingImageTargetRef.current = null;
    if (!file || !target) return;
    setUploadingImageFor(target.elId);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/team/modules/${moduleId}/pages/${target.pageId}/image`, { method: "POST", body: form });
      const body = await res.json();
      if (!body.success) {
        setError(body.error ?? "Image upload failed.");
        return;
      }
      updateElement(target.pageId, target.elId, { content: `![](${body.data.url})` });
    } catch {
      setError("Network error while uploading image.");
    } finally {
      setUploadingImageFor(null);
    }
  }

  async function createVersion() {
    if (!versionLabel.trim()) return;
    setCreatingVersion(true);
    setError(null);
    try {
      const res = await fetch(`/api/team/modules/${moduleId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: versionLabel }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error ?? "Could not save this version.");
      } else {
        setVersionLabel("");
        await load();
      }
    } catch {
      setError("Network connection error. Please try again.");
    } finally {
      setCreatingVersion(false);
    }
  }

  async function runExport() {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch(`/api/team/modules/${moduleId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionId: exportVersionId || undefined,
          includedWatermark: includeWatermark,
          includedFrontPage: true,
          design: exportDesign,
          theme: exportTheme,
        }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error ?? "Export failed.");
      } else {
        await load();
      }
    } catch {
      setError("Network connection error. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  async function runRebrand() {
    if (!data) return;
    setRebranding(true);
    setError(null);
    try {
      const res = await fetch(`/api/team/modules/${moduleId}/rebrand`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preset: rebrandPreset,
          teacherName: teacherNameOverride || data.facultyName || undefined,
          batchName: batchNameOverride || data.batch || undefined,
          chapterName: chapterNameOverride || data.chapter || data.title,
          subject: data.subject || undefined,
          removeOldHeader,
          removeOldFooter,
          oldHeaderHeightPt: oldHeaderHeight,
          oldFooterHeightPt: oldFooterHeight,
          includeWatermark: rebrandWatermark,
          watermarkText: watermarkCustomText || undefined,
        }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error ?? "Rebranding failed.");
        return;
      }
      setVerificationReport(body.data.report);
      setShowReportModal(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rebranding failed.");
    } finally {
      setRebranding(false);
    }
  }

  if (error && !data) {
    return <p className="text-label-md text-error">{error}</p>;
  }
  if (!data) {
    return <p className="text-label-md text-on-surface-variant">Loading…</p>;
  }

  const latestJob = data.processingJobs[0];
  const selectedPage = data.pages.find((p) => p.id === selectedPageId) ?? null;
  const currentElements = selectedPageId ? (pageEdits[selectedPageId] ?? []).slice().sort((a, b) => a.order - b.order) : [];
  const selectedElement = currentElements.find((el) => el.id === selectedElementId) ?? null;
  const history = selectedPageId ? historyRef.current[selectedPageId] : undefined;
  const canUndo = !!history && history.index > 0;
  const canRedo = !!history && history.index < history.stack.length - 1;

  const currentStageLabel = (stage?: string) => {
    switch (stage) {
      case "ANALYZING":
        return "Analyzing PDF layout and language layers…";
      case "EXTRACTING":
        return "Extracting text and isolating scanned pages…";
      case "OCR_PROCESSING":
        return "Processing pages in parallel with Gemini AI…";
      case "RECONSTRUCTING_LAYOUT":
        return "Structuring formulas, callouts, and questions…";
      case "GENERATING_PREVIEW":
        return "Generating academic layout and preview…";
      case "READY_FOR_REVIEW":
        return "Module Ready for Review";
      case "FAILED":
        return "Processing Encountered Issues";
      default:
        return "Processing Module…";
    }
  };

  return (
    <div className="space-y-stack-lg">
      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onImageFileChosen} />

      {/* Header & Quick Metadata Editor */}
      <div>
        <Link href="/team/modules" className="text-label-sm text-primary hover:underline flex items-center gap-1 mb-2 w-fit">
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Module Studio
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4 glass-card p-5 rounded-2xl">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="font-headline-lg text-headline-lg text-on-surface font-extrabold">{data.title}</h1>
              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                title="Edit module name and academic metadata"
                className="text-primary hover:bg-primary/10 p-1.5 rounded-lg transition-colors flex items-center gap-1 text-label-sm"
              >
                <span className="material-symbols-outlined text-base">edit</span>
                <span className="text-xs font-semibold">Edit Info</span>
              </button>
            </div>
            <p className="text-label-sm text-on-surface-variant flex flex-wrap items-center gap-2">
              <span className="font-mono font-bold text-primary">{data.code}</span>
              <span>·</span>
              <span className="font-semibold text-on-surface">{data.subject ?? "No Subject"}</span>
              <span>·</span>
              <span>{data.chapter ?? "No Chapter"}</span>
              {data.facultyName && (
                <>
                  <span>·</span>
                  <span className="text-primary font-medium">Faculty: {data.facultyName}</span>
                </>
              )}
              {data.batch && (
                <>
                  <span>·</span>
                  <span className="bg-surface-container px-2 py-0.5 rounded text-xs">Batch: {data.batch}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${STATUS_STYLE[data.status] ?? ""}`}>
              {data.status.replace(/_/g, " ")}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 text-label-sm flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-bold text-xs uppercase hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Real-time Asynchronous Extraction Console */}
      <section className="glass-card rounded-2xl p-6 space-y-4 border border-outline-variant/30">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-2xl">electric_bolt</span>
              <h2 className="font-headline-md text-headline-md text-on-surface">Parallel Extraction Engine</h2>
            </div>
            <p className="text-label-sm text-on-surface-variant mt-0.5">
              High-speed parallel text extraction with AI block structuring and per-page fault tolerance.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {processing && (
              <button
                type="button"
                onClick={cancelCurrentJob}
                className="rounded-full border border-red-500/40 text-red-600 px-4 py-2 font-label-md text-label-sm hover:bg-red-500/10 transition-colors"
              >
                Cancel Extraction
              </button>
            )}
            <button
              type="button"
              onClick={runProcess}
              disabled={processing}
              className="bg-primary text-on-primary rounded-full px-6 py-2.5 font-label-md text-label-md disabled:opacity-60 hover:opacity-90 transition-all shadow-sm flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">{processing ? "sync" : "play_arrow"}</span>
              {processing ? "Extracting in background…" : data.pageCount ? "Reprocess Module" : "Run Extraction"}
            </button>
          </div>
        </div>

        {/* Live Progress Bar if Processing or Status Available */}
        {(processing || jobStatus) && (
          <div className="space-y-3 p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/30">
            <div className="flex items-center justify-between text-label-sm">
              <span className="font-semibold text-primary flex items-center gap-2">
                {processing && <span className="inline-block w-2 h-2 rounded-full bg-primary animate-ping" />}
                {currentStageLabel(jobStatus?.stage || latestJob?.stage)}
              </span>
              <span className="font-bold text-on-surface">
                {jobStatus?.progress ?? latestJob?.progress ?? 0}%
                {jobStatus && jobStatus.totalPages > 0 ? ` (${jobStatus.completedPages} / ${jobStatus.totalPages} pages)` : ""}
              </span>
            </div>

            <div className="w-full bg-surface-container-high rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-primary to-secondary h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.max(4, jobStatus?.progress ?? latestJob?.progress ?? 0)}%` }}
              />
            </div>

            {/* Page matrix visualizer */}
            {jobStatus && Object.keys(jobStatus.pageStatuses).length > 0 && (
              <div className="pt-2">
                <p className="text-[11px] uppercase font-bold text-on-surface-variant mb-2">Page-Level Status Matrix</p>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-surface-container-high/30 rounded-lg">
                  {Object.values(jobStatus.pageStatuses).map((p) => {
                    const bg =
                      p.status === "COMPLETED"
                        ? "bg-green-500 text-white"
                        : p.status === "FAILED"
                        ? "bg-red-500 text-white"
                        : p.status === "PROCESSING"
                        ? "bg-primary text-white animate-pulse"
                        : "bg-surface-container-high text-on-surface-variant";

                    return (
                      <div
                        key={p.pageNumber}
                        title={`Page ${p.pageNumber}: ${p.status}${p.error ? ` - ${p.error}` : ""}${p.durationMs ? ` (${p.durationMs}ms)` : ""}`}
                        className={`px-2 py-1 rounded text-[10px] font-mono font-bold cursor-default ${bg}`}
                      >
                        P{p.pageNumber}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Options accordion */}
        <details className="rounded-xl border border-outline-variant/30 p-3 bg-surface-container-lowest" open={!data.pageCount}>
          <summary className="cursor-pointer text-label-sm font-label-md text-on-surface select-none flex items-center justify-between">
            <span>Redesign & Extraction Fine-Tuning Options</span>
            <span className="text-xs text-primary font-normal">Click to toggle</span>
          </summary>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <label className="block">
              <span className="text-label-sm text-on-surface-variant block mb-1">Words / lines to remove (one per line)</span>
              <textarea
                value={removeWordsText}
                onChange={(e) => setRemoveWordsText(e.target.value)}
                rows={3}
                placeholder={"Old coaching institute name\nOld website or copyright footer"}
                className="w-full rounded-lg border border-outline-variant/40 px-3 py-2 text-label-sm bg-surface-container-lowest"
              />
            </label>
            <label className="block">
              <span className="text-label-sm text-on-surface-variant block mb-1">Rename box / heading labels (old =&gt; new, one per line)</span>
              <textarea
                value={renamesText}
                onChange={(e) => setRenamesText(e.target.value)}
                rows={3}
                placeholder={"Example => Illustration\nKey Point => Atomic Insight"}
                className="w-full rounded-lg border border-outline-variant/40 px-3 py-2 text-label-sm bg-surface-container-lowest font-mono"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3 text-label-sm text-on-surface-variant">
            <span>Pages: from</span>
            <input
              value={fromPage}
              onChange={(e) => setFromPage(e.target.value.replace(/\D/g, ""))}
              placeholder="1"
              className="w-16 rounded-lg border border-outline-variant/40 px-2 py-1 bg-surface-container-lowest"
            />
            <span>to</span>
            <input
              value={toPage}
              onChange={(e) => setToPage(e.target.value.replace(/\D/g, ""))}
              placeholder="all"
              className="w-16 rounded-lg border border-outline-variant/40 px-2 py-1 bg-surface-container-lowest"
            />
            <span className="text-xs opacity-75">(Leave blank to extract entire document in parallel)</span>
          </div>
        </details>

        <div className="flex items-center gap-4 pt-1">
          <a
            href={data.originalFileUrl}
            target="_blank"
            rel="noreferrer"
            className="text-label-sm text-primary hover:underline inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">picture_as_pdf</span>
            View original source PDF ({data.originalFileName})
          </a>
        </div>
      </section>

      {/* Academic Layout Engine Selector */}
      <section className="glass-card rounded-2xl p-6 space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">style</span>
            <h2 className="font-headline-md text-headline-md text-on-surface">Academic Layout System</h2>
          </div>
          <p className="text-label-sm text-on-surface-variant mt-0.5">
            Select a pedagogical presentation layout tailored for NEET, JEE, or Board revision.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {LAYOUT_PRESETS.map((layout) => {
            const active = selectedLayout === layout.id;
            return (
              <button
                key={layout.id}
                type="button"
                onClick={() => updateLayoutStyle(layout.id)}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 ${
                  active
                    ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                    : "border-outline-variant/30 bg-surface-container-lowest hover:border-outline-variant/60"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`material-symbols-outlined text-lg ${active ? "text-primary" : "text-on-surface-variant"}`}>
                    {layout.icon}
                  </span>
                  <span className={`font-label-md text-label-sm line-clamp-1 ${active ? "text-primary font-bold" : "text-on-surface font-semibold"}`}>
                    {layout.label}
                  </span>
                </div>
                <span className="text-[11px] text-on-surface-variant line-clamp-2 leading-tight">{layout.desc}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* High-Precision Preservation & Vector Rebranding Studio */}
      <section className="glass-card rounded-2xl p-6 space-y-4 border border-primary/20 bg-primary/[0.02]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">auto_fix_high</span>
              <h2 className="font-headline-md text-headline-md text-on-surface">Vector Rebranding & Preservation Engine</h2>
            </div>
            <p className="text-label-sm text-on-surface-variant mt-0.5">
              100% preservation of Hindi text, chemistry equations, reaction mechanisms, math notation, and diagrams with zero OCR data loss.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {verificationReport && (
              <button
                type="button"
                onClick={() => setShowReportModal(true)}
                className="rounded-full border border-green-600/40 bg-green-500/10 text-green-700 dark:text-green-400 px-4 py-2 font-label-md text-label-md hover:bg-green-500/20 flex items-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-base">verified</span>
                Audit Report ({verificationReport.overallScore}%)
              </button>
            )}
            <button
              type="button"
              onClick={runRebrand}
              disabled={rebranding}
              className="bg-primary text-on-primary rounded-full px-5 py-2.5 font-label-md text-label-md disabled:opacity-60 hover:opacity-90 transition-all shadow-sm flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">{rebranding ? "sync" : "verified"}</span>
              {rebranding ? "Rebranding & Verifying…" : "1-Click Rebrand & Verify"}
            </button>
          </div>
        </div>

        {/* Preset Selection Grid */}
        <div>
          <label className="text-label-sm font-semibold text-on-surface block mb-2">Rebranding Design Preset</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {REBRAND_PRESETS.map((p) => {
              const active = rebrandPreset === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setRebrandPreset(p.value)}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                    active
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                      : "border-outline-variant/30 bg-surface-container-lowest hover:border-outline-variant/60"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`material-symbols-outlined text-base ${active ? "text-primary" : "text-on-surface-variant"}`}>
                      {p.icon}
                    </span>
                    <span className={`font-label-md text-label-sm line-clamp-1 ${active ? "text-primary font-bold" : "text-on-surface"}`}>
                      {p.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-on-surface-variant line-clamp-1">{p.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Rebranding Customization Options */}
        <details className="rounded-xl border border-outline-variant/30 p-4 bg-surface-container-lowest" open>
          <summary className="cursor-pointer text-label-sm font-semibold text-on-surface select-none flex items-center justify-between">
            <span>Faculty Metadata & Masking Controls</span>
            <span className="text-[11px] text-primary font-normal">Click to toggle</span>
          </summary>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <div>
              <label className="text-label-sm text-on-surface-variant block mb-1">Faculty Name</label>
              <input
                value={teacherNameOverride}
                onChange={(e) => setTeacherNameOverride(e.target.value)}
                placeholder={data.facultyName || "Atomic Pathshala Faculty"}
                className="w-full rounded-lg border border-outline-variant/40 px-3 py-2 text-label-sm bg-surface-container-lowest"
              />
            </div>
            <div>
              <label className="text-label-sm text-on-surface-variant block mb-1">Batch Name</label>
              <input
                value={batchNameOverride}
                onChange={(e) => setBatchNameOverride(e.target.value)}
                placeholder={data.batch || "NEET Accelerated Batch"}
                className="w-full rounded-lg border border-outline-variant/40 px-3 py-2 text-label-sm bg-surface-container-lowest"
              />
            </div>
            <div>
              <label className="text-label-sm text-on-surface-variant block mb-1">Chapter / Subject Scope</label>
              <input
                value={chapterNameOverride}
                onChange={(e) => setChapterNameOverride(e.target.value)}
                placeholder={data.chapter || data.title}
                className="w-full rounded-lg border border-outline-variant/40 px-3 py-2 text-label-sm bg-surface-container-lowest"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-3 border-t border-outline-variant/20">
            <label className="flex items-center gap-2 text-label-sm text-on-surface cursor-pointer">
              <input
                type="checkbox"
                checked={removeOldHeader}
                onChange={(e) => setRemoveOldHeader(e.target.checked)}
                className="rounded text-primary focus:ring-primary"
              />
              <span>Mask Old Running Header</span>
            </label>
            <label className="flex items-center gap-2 text-label-sm text-on-surface cursor-pointer">
              <input
                type="checkbox"
                checked={removeOldFooter}
                onChange={(e) => setRemoveOldFooter(e.target.checked)}
                className="rounded text-primary focus:ring-primary"
              />
              <span>Mask Old Running Footer</span>
            </label>
            <label className="flex items-center gap-2 text-label-sm text-on-surface cursor-pointer">
              <input
                type="checkbox"
                checked={rebrandWatermark}
                onChange={(e) => setRebrandWatermark(e.target.checked)}
                className="rounded text-primary focus:ring-primary"
              />
              <span>Include Watermark Overlay</span>
            </label>
            <div>
              <input
                value={watermarkCustomText}
                onChange={(e) => setWatermarkCustomText(e.target.value)}
                placeholder="Watermark text"
                disabled={!rebrandWatermark}
                className="w-full rounded-lg border border-outline-variant/40 px-2.5 py-1.5 text-label-sm bg-surface-container-lowest disabled:opacity-40"
              />
            </div>
          </div>
        </details>
      </section>

      {/* Note Studio / Canvas Workspace */}
      {data.pages.length > 0 && selectedPage && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-headline-md text-headline-md text-on-surface font-bold">Note Studio Workspace</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => selectedPageId && undo(selectedPageId)}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant disabled:opacity-30 hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-lg">undo</span>
              </button>
              <button
                type="button"
                onClick={() => selectedPageId && redo(selectedPageId)}
                disabled={!canRedo}
                title="Redo (Ctrl+Shift+Z)"
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant disabled:opacity-30 hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-lg">redo</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode((v) => !v)}
                className={`px-3 py-1.5 rounded-full text-label-sm flex items-center gap-1.5 ${previewMode ? "bg-primary text-on-primary font-semibold" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"}`}
                title="Toggle a read-only preview that renders math (KaTeX) and images the way the export will"
              >
                <span className="material-symbols-outlined text-base">visibility</span>
                {previewMode ? "Live Editing" : "Formatted Preview"}
              </button>
              <SaveStatusPill status={saveStatus} />
              {selectedPage.needsReview && (
                <button
                  type="button"
                  onClick={() => selectedPageId && savePage(selectedPageId, { markReviewed: true })}
                  className="px-3 py-1.5 rounded-full text-label-sm bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 flex items-center gap-1.5 font-medium"
                >
                  <span className="material-symbols-outlined text-base">task_alt</span>
                  Mark Reviewed
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {data.pages.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedPageId(p.id);
                  setSelectedElementId(null);
                }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-label-sm flex items-center gap-1.5 transition-colors ${
                  selectedPageId === p.id ? "bg-primary text-on-primary font-bold shadow-sm" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                }`}
              >
                Page {p.pageNumber}
                {p.needsReview && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
              </button>
            ))}
          </div>

          {selectedPage.warnings.length > 0 && <p className="text-label-sm text-amber-600">{selectedPage.warnings.join(" ")}</p>}

          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_280px] gap-3 items-start">
            {/* Blocks Outline */}
            <div className="glass-card rounded-xl p-3 space-y-3 lg:sticky lg:top-4">
              <div>
                <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wide mb-1.5">Blocks</p>
                {currentElements.length === 0 ? (
                  <p className="text-label-sm text-on-surface-variant">No blocks yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {currentElements.map((el, idx) => (
                      <li
                        key={el.id}
                        draggable
                        onDragStart={() => {
                          dragIndexRef.current = idx;
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          const from = dragIndexRef.current;
                          dragIndexRef.current = null;
                          if (from !== null && selectedPageId) reorderElement(selectedPageId, from, idx);
                        }}
                        onClick={() => setSelectedElementId(el.id)}
                        className={`flex items-center gap-1 rounded-lg px-1.5 py-1 cursor-pointer text-label-sm ${
                          selectedElementId === el.id ? "bg-primary/10 text-primary" : "hover:bg-surface-container-lowest text-on-surface-variant"
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm cursor-grab shrink-0">drag_indicator</span>
                        <span className="truncate flex-1">
                          <span className="text-[9px] uppercase font-bold tracking-wide opacity-70">{el.type}</span>
                          <br />
                          {el.type === "TABLE" ? `${el.tableData?.length ?? 0} rows` : el.content.trim().slice(0, 36) || "Empty"}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (selectedPageId) removeElement(selectedPageId, el.id);
                          }}
                          className="text-red-500/70 hover:text-red-500 shrink-0"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wide mb-1.5">Add Block</p>
                <div className="grid grid-cols-3 gap-1">
                  {ADD_PALETTE.map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => selectedPageId && addElement(selectedPageId, item.type)}
                      title={item.label}
                      className="flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-on-surface-variant hover:bg-surface-container-lowest hover:text-primary"
                    >
                      <span className="material-symbols-outlined text-base">{item.icon}</span>
                      <span className="text-[9px]">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Canvas */}
            <div className="glass-card rounded-xl p-2 overflow-x-auto">
              <div
                className="bg-white mx-auto shadow-sm border border-outline-variant/20 rounded-xl"
                style={{ width: "100%", maxWidth: 700, aspectRatio: "210 / 297", padding: "5% 7%", overflowY: "auto" }}
              >
                {currentElements.length === 0 ? (
                  <p className="text-label-sm text-gray-400">No content blocks yet — add one from the left panel.</p>
                ) : (
                  <div className="space-y-2">
                    {currentElements.map((el) => (
                      <CanvasBlock
                        key={el.id}
                        pageId={selectedPageId!}
                        el={el}
                        selected={selectedElementId === el.id}
                        previewMode={previewMode}
                        uploading={uploadingImageFor === el.id}
                        onSelect={() => setSelectedElementId(el.id)}
                        onLiveChange={(patch) => updateElementLive(selectedPageId!, el.id, patch)}
                        onCommitChange={(patch) => updateElement(selectedPageId!, el.id, patch)}
                        onBlurCommit={() => commitHistorySnapshot(selectedPageId!)}
                        onUploadClick={() => triggerImageUpload(selectedPageId!, el.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Properties */}
            <div className="glass-card rounded-xl p-3 space-y-3 lg:sticky lg:top-4">
              <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wide">Properties</p>
              {!selectedElement ? (
                <p className="text-label-sm text-on-surface-variant">Select a block to edit its style.</p>
              ) : (
                <PropertiesPanel
                  el={selectedElement}
                  onChangeType={(type) => updateElement(selectedPageId!, selectedElement.id, { type })}
                  onChangeStyle={(style) => updateElement(selectedPageId!, selectedElement.id, { style })}
                  onChangeTable={(tableData) => updateElement(selectedPageId!, selectedElement.id, { tableData })}
                  onChangeMeta={(patch) => updateElement(selectedPageId!, selectedElement.id, patch)}
                  onUploadImage={() => triggerImageUpload(selectedPageId!, selectedElement.id)}
                  uploading={uploadingImageFor === selectedElement.id}
                  onDelete={() => removeElement(selectedPageId!, selectedElement.id)}
                />
              )}
            </div>
          </div>
        </section>
      )}

      {/* Export & Versions Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
        <section className="glass-card rounded-2xl p-6 space-y-3">
          <h2 className="font-headline-md text-headline-md text-on-surface">Versions</h2>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
              placeholder="e.g. Reviewed by faculty"
              className="flex-1 rounded-lg border border-outline-variant/40 px-3 py-2 text-label-sm bg-surface-container-lowest"
            />
            <button
              type="button"
              onClick={createVersion}
              disabled={creatingVersion || !versionLabel.trim()}
              className="bg-primary/10 text-primary rounded-full px-4 py-2 font-label-sm text-label-sm disabled:opacity-60 hover:bg-primary/20 transition-colors shrink-0 font-medium"
            >
              Save Version
            </button>
          </div>
          {data.versions.length === 0 ? (
            <p className="text-label-sm text-on-surface-variant">No saved versions yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between text-label-sm">
                  <span className="text-on-surface">{v.label}</span>
                  <span className="text-on-surface-variant">{new Date(v.createdAt).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="glass-card rounded-2xl p-6 space-y-3">
          <h2 className="font-headline-md text-headline-md text-on-surface">Export Module</h2>
          <div className="space-y-2">
            <select
              value={exportVersionId}
              onChange={(e) => setExportVersionId(e.target.value)}
              className="w-full rounded-lg border border-outline-variant/40 px-3 py-2 text-label-sm bg-surface-container-lowest"
            >
              <option value="">Current content</option>
              {data.versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2 text-label-sm">
              {(["premium", "classic"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setExportDesign(d)}
                  className={`flex-1 rounded-lg border px-3 py-1.5 ${exportDesign === d ? "border-primary bg-primary/10 text-primary font-semibold" : "border-outline-variant/40 text-on-surface-variant"}`}
                >
                  {d === "premium" ? "Premium Colourful" : "Classic"}
                </button>
              ))}
            </div>
            {exportDesign === "premium" && (
              <div className="grid grid-cols-2 gap-2">
                {THEME_OPTIONS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setExportTheme(t.value)}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-label-sm ${exportTheme === t.value ? "border-primary ring-1 ring-primary/40" : "border-outline-variant/40"}`}
                  >
                    <span className="w-4 h-4 rounded-full shrink-0" style={{ background: t.swatch }} />
                    {t.label}
                  </button>
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 text-label-sm text-on-surface-variant">
              <input type="checkbox" checked={includeWatermark} onChange={(e) => setIncludeWatermark(e.target.checked)} />
              Include watermark (brand logo)
            </label>
            {exportDesign === "premium" && data.pages.length > 0 && (
              <a
                href={`/api/team/modules/${moduleId}/preview?theme=${exportTheme}${includeWatermark ? "&watermark=1" : ""}`}
                target="_blank"
                rel="noreferrer"
                className="block text-center w-full rounded-full border border-primary text-primary px-4 py-2 font-label-md text-label-md hover:bg-primary/5"
              >
                Preview Premium Typeset Document
              </a>
            )}
            <button
              type="button"
              onClick={runExport}
              disabled={exporting || data.pages.length === 0}
              className="w-full bg-primary text-on-primary rounded-full px-4 py-2.5 font-label-md text-label-md disabled:opacity-60 hover:opacity-90 transition-opacity"
            >
              {exporting ? "Creating PDF…" : exportDesign === "premium" ? "Export Premium PDF" : "Export Branded PDF"}
            </button>
          </div>
          {data.exportHistory.length > 0 && (
            <ul className="space-y-1.5 pt-2 border-t border-outline-variant/20">
              {data.exportHistory.map((ex) => (
                <li key={ex.id} className="flex items-center justify-between text-label-sm">
                  <a href={ex.fileUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">
                    {ex.fileName}
                  </a>
                  <span className="text-on-surface-variant shrink-0">{fmtBytes(ex.fileSize)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Edit Details Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-2xl max-w-xl w-full flex flex-col shadow-2xl border border-outline-variant/30 overflow-hidden">
            <div className="p-5 border-b border-outline-variant/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-2xl">edit_note</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">Edit Module Metadata</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={saveDetails} className="p-6 space-y-4">
              <div>
                <label className="text-label-sm text-on-surface-variant block mb-1">Module Title *</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-lg border border-outline-variant/40 px-3 py-2 text-label-md bg-surface-container-lowest font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-label-sm text-on-surface-variant block mb-1">Subject</label>
                  <input
                    type="text"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    placeholder="e.g. Chemistry"
                    className="w-full rounded-lg border border-outline-variant/40 px-3 py-2 text-label-sm bg-surface-container-lowest"
                  />
                </div>
                <div>
                  <label className="text-label-sm text-on-surface-variant block mb-1">Chapter</label>
                  <input
                    type="text"
                    value={editChapter}
                    onChange={(e) => setEditChapter(e.target.value)}
                    placeholder="e.g. Mole Concept"
                    className="w-full rounded-lg border border-outline-variant/40 px-3 py-2 text-label-sm bg-surface-container-lowest"
                  />
                </div>
                <div>
                  <label className="text-label-sm text-on-surface-variant block mb-1">Class</label>
                  <input
                    type="text"
                    value={editClass}
                    onChange={(e) => setEditClass(e.target.value)}
                    placeholder="11 or 12"
                    className="w-full rounded-lg border border-outline-variant/40 px-3 py-2 text-label-sm bg-surface-container-lowest"
                  />
                </div>
                <div>
                  <label className="text-label-sm text-on-surface-variant block mb-1">Batch</label>
                  <input
                    type="text"
                    value={editBatch}
                    onChange={(e) => setEditBatch(e.target.value)}
                    placeholder="Selection Pro Batch"
                    className="w-full rounded-lg border border-outline-variant/40 px-3 py-2 text-label-sm bg-surface-container-lowest"
                  />
                </div>
                <div>
                  <label className="text-label-sm text-on-surface-variant block mb-1">Faculty Name</label>
                  <input
                    type="text"
                    value={editFaculty}
                    onChange={(e) => setEditFaculty(e.target.value)}
                    placeholder="e.g. Firoz Sir"
                    className="w-full rounded-lg border border-outline-variant/40 px-3 py-2 text-label-sm bg-surface-container-lowest"
                  />
                </div>
                <div>
                  <label className="text-label-sm text-on-surface-variant block mb-1">Academic Year</label>
                  <input
                    type="text"
                    value={editYear}
                    onChange={(e) => setEditYear(e.target.value)}
                    placeholder="2026-27"
                    className="w-full rounded-lg border border-outline-variant/40 px-3 py-2 text-label-sm bg-surface-container-lowest"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-outline-variant/30 flex items-center justify-end gap-3 -mx-6 -mb-6 bg-surface-container-lowest">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-full border border-outline-variant/40 text-label-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDetails}
                  className="bg-primary text-on-primary rounded-full px-6 py-2 font-label-md text-label-sm hover:opacity-90 disabled:opacity-60"
                >
                  {savingDetails ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Verification & Preservation Report Modal */}
      {showReportModal && verificationReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-outline-variant/30">
            <div className="p-5 border-b border-outline-variant/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-green-600 text-2xl">verified</span>
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">Module Verification & Preservation Audit</h3>
                  <p className="text-label-sm text-on-surface-variant">Code: {verificationReport.moduleCode} • {verificationReport.originalFileName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="rounded-xl p-4 bg-green-500/10 border border-green-500/30 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-label-sm font-bold uppercase tracking-wider text-green-700 dark:text-green-400">
                      {verificationReport.overallStatus === "SAFE_TO_PUBLISH" ? "✓ Safe to Publish" : verificationReport.overallStatus}
                    </span>
                  </div>
                  <p className="text-label-sm text-on-surface-variant mt-1">{verificationReport.recommendation}</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-extrabold text-green-600">{verificationReport.overallScore}%</div>
                  <div className="text-[11px] text-on-surface-variant">Fidelity Score</div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">Fidelity Audit Metrics</h4>
                <div className="grid grid-cols-1 gap-2">
                  {verificationReport.metrics.map((m: any, idx: number) => (
                    <div key={idx} className="rounded-lg border border-outline-variant/30 p-3 bg-surface-container-lowest flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm text-green-600">check_circle</span>
                          <span className="font-semibold text-label-sm text-on-surface">{m.name}</span>
                        </div>
                        <p className="text-label-sm text-on-surface-variant mt-0.5">{m.details}</p>
                      </div>
                      <span className="text-xs font-bold text-green-600 shrink-0">{m.score}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-outline-variant/30 flex items-center justify-between gap-3 bg-surface-container-lowest rounded-b-2xl">
              <a
                href={`/api/team/modules/${moduleId}/report?format=md`}
                download
                className="text-label-sm text-primary hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                Download Audit Report (.md)
              </a>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="bg-primary text-on-primary rounded-full px-5 py-2 font-label-md text-label-sm hover:opacity-90"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SaveStatusPill({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  if (status === "saving") return <span className="text-label-sm text-on-surface-variant flex items-center gap-1">Saving…</span>;
  if (status === "saved") return <span className="text-label-sm text-green-600 flex items-center gap-1">Saved</span>;
  if (status === "error") return <span className="text-label-sm text-error flex items-center gap-1">Save failed</span>;
  return <span className="text-label-sm text-on-surface-variant flex items-center gap-1">Unsaved changes</span>;
}

function CanvasBlock({
  pageId,
  el,
  selected,
  previewMode,
  uploading,
  onSelect,
  onLiveChange,
  onCommitChange,
  onBlurCommit,
  onUploadClick,
}: {
  pageId: string;
  el: ElementRow;
  selected: boolean;
  previewMode: boolean;
  uploading: boolean;
  onSelect: () => void;
  onLiveChange: (patch: Partial<ElementRow>) => void;
  onCommitChange: (patch: Partial<ElementRow>) => void;
  onBlurCommit: () => void;
  onUploadClick: () => void;
}) {
  const ring = selected ? "ring-2 ring-primary/50 bg-primary/5" : "hover:bg-black/[0.02]";

  if (el.type === "TABLE") {
    const rows = el.tableData && el.tableData.length > 0 ? el.tableData : [["", ""]];
    return (
      <div onClick={onSelect} className={`rounded p-1 -m-1 ${ring}`}>
        <table className="w-full border-collapse text-[10px]" style={{ fontFamily: FONT_CSS.courier }}>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} className="border border-gray-300 p-0">
                    <input
                      value={cell}
                      onFocus={onSelect}
                      onChange={(e) => {
                        const next = rows.map((rr) => rr.slice());
                        next[r]![c] = e.target.value;
                        onLiveChange({ tableData: next });
                      }}
                      onBlur={onBlurCommit}
                      className="w-full px-1 py-0.5 text-[10px] outline-none bg-transparent"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (el.type === "IMAGE") {
    const url = extractImgUrl(el.content);
    return (
      <div onClick={onSelect} className={`rounded p-1 -m-1 ${ring}`}>
        {url ? (
          <img src={url} alt="" className="max-w-full rounded" style={{ maxHeight: 220 }} />
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUploadClick();
            }}
            className="w-full border-2 border-dashed border-gray-300 rounded-lg py-6 text-[11px] text-gray-400 flex flex-col items-center gap-1 hover:border-primary hover:text-primary"
          >
            <span className="material-symbols-outlined">{uploading ? "hourglass_top" : "add_photo_alternate"}</span>
            {uploading ? "Uploading…" : "Click to upload image"}
          </button>
        )}
      </div>
    );
  }

  const isFormula = el.type === "EQUATION" || el.type === "CHEMICAL_EQUATION";
  const cssStyle = elementCssStyle(el);

  if (el.type === "CALLOUT") {
    const color = CALLOUT_COLORS[el.variant ?? "NOTE"] ?? CALLOUT_COLORS.NOTE!;
    return (
      <div onClick={onSelect} className={`rounded-lg p-2 ${ring}`} style={{ borderLeft: `4px solid ${color}`, background: `${color}0f` }}>
        <span className="inline-block text-[10px] font-bold uppercase tracking-wide text-white rounded-full px-2 py-0.5 mb-1" style={{ background: color }}>
          {el.label || (el.variant ?? "Note").toLowerCase()}
        </span>
        {previewMode ? (
          <div style={cssStyle} dangerouslySetInnerHTML={{ __html: renderFormulaContent(el.content || "") || "" }} />
        ) : (
          <textarea
            value={el.content}
            onFocus={onSelect}
            onChange={(e) => {
              autoGrow(e.currentTarget);
              onLiveChange({ content: e.target.value });
            }}
            onBlur={onBlurCommit}
            rows={2}
            placeholder="Box content…"
            className="w-full resize-none bg-transparent outline-none overflow-hidden"
            style={cssStyle}
          />
        )}
      </div>
    );
  }

  if (previewMode) {
    const html = isFormula
      ? safeKatex(el.content)
      : renderFormulaContent(el.content || "");
    return (
      <div
        onClick={onSelect}
        className={`rounded p-1 -m-1 ${ring}`}
        style={isFormula ? { textAlign: cssStyle.textAlign } : cssStyle}
        dangerouslySetInnerHTML={{ __html: html || '<span class="text-gray-300">Empty</span>' }}
      />
    );
  }

  return (
    <textarea
      value={el.content}
      onFocus={onSelect}
      onChange={(e) => {
        autoGrow(e.currentTarget);
        onLiveChange({ content: e.target.value });
      }}
      onBlur={onBlurCommit}
      rows={1}
      placeholder={isFormula ? "LaTeX, e.g. \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}" : "Type here…"}
      className={`w-full resize-none bg-transparent outline-none overflow-hidden rounded p-1 -m-1 ${ring}`}
      style={isFormula ? { fontFamily: FONT_CSS.courier, fontSize: "10pt" } : cssStyle}
    />
  );
}

function safeKatex(latex: string): string {
  try {
    return katex.renderToString(latex || "", { throwOnError: false, displayMode: true });
  } catch {
    return latex;
  }
}

function PropertiesPanel({
  el,
  onChangeType,
  onChangeStyle,
  onChangeTable,
  onChangeMeta,
  onUploadImage,
  uploading,
  onDelete,
}: {
  el: ElementRow;
  onChangeType: (type: string) => void;
  onChangeStyle: (style: ElementStyle) => void;
  onChangeTable: (tableData: string[][]) => void;
  onChangeMeta: (patch: { variant?: string; label?: string }) => void;
  onUploadImage: () => void;
  uploading: boolean;
  onDelete: () => void;
}) {
  const base = typeDefault(el.type);
  const style = el.style ?? {};

  function setStyle(patch: Partial<ElementStyle>) {
    onChangeStyle({ ...style, ...patch });
  }

  return (
    <div className="space-y-3">
      {el.type === "CALLOUT" && (
        <div className="space-y-2 rounded-lg border border-outline-variant/30 p-2">
          <label className="text-label-sm text-on-surface-variant block">Box kind</label>
          <select
            value={el.variant ?? "NOTE"}
            onChange={(e) => onChangeMeta({ variant: e.target.value })}
            className="w-full rounded-lg border border-outline-variant/40 px-2 py-1.5 text-label-sm bg-surface-container-lowest"
          >
            {Object.keys(CALLOUT_COLORS).map((v) => (
              <option key={v} value={v}>
                {v.charAt(0) + v.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
          <label className="text-label-sm text-on-surface-variant block">Box heading</label>
          <input
            value={el.label ?? ""}
            onChange={(e) => onChangeMeta({ label: e.target.value })}
            placeholder="e.g. Illustration 3, Atomic Insight"
            className="w-full rounded-lg border border-outline-variant/40 px-2 py-1.5 text-label-sm bg-surface-container-lowest"
          />
        </div>
      )}
      {el.type === "BULLETS" && <p className="text-label-sm text-on-surface-variant">One point per line.</p>}
      <div>
        <label className="text-label-sm text-on-surface-variant block mb-1">Block type</label>
        <select
          value={el.type}
          onChange={(e) => onChangeType(e.target.value)}
          className="w-full rounded-lg border border-outline-variant/40 px-2 py-1.5 text-label-sm bg-surface-container-lowest"
        >
          {ELEMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {el.type !== "TABLE" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-label-sm text-on-surface-variant block mb-1">Font</label>
              <select
                value={style.fontFamily ?? base.fontFamily}
                onChange={(e) => setStyle({ fontFamily: e.target.value as FontFamily })}
                className="w-full rounded-lg border border-outline-variant/40 px-2 py-1.5 text-label-sm bg-surface-container-lowest"
              >
                {(Object.keys(FONT_LABEL) as FontFamily[]).map((f) => (
                  <option key={f} value={f}>
                    {FONT_LABEL[f]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-label-sm text-on-surface-variant block mb-1">Size (pt)</label>
              <input
                type="number"
                min={6}
                max={48}
                value={style.fontSize ?? base.fontSize}
                onChange={(e) => setStyle({ fontSize: Number(e.target.value) })}
                className="w-full rounded-lg border border-outline-variant/40 px-2 py-1.5 text-label-sm bg-surface-container-lowest"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStyle({ bold: !(style.bold ?? base.bold) })}
              className={`w-8 h-8 rounded-lg font-bold text-label-sm ${(style.bold ?? base.bold) ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"}`}
            >
              B
            </button>
            <button
              type="button"
              onClick={() => setStyle({ italic: !(style.italic ?? base.italic) })}
              className={`w-8 h-8 rounded-lg italic text-label-sm ${(style.italic ?? base.italic) ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"}`}
            >
              I
            </button>
            <input
              type="color"
              value={style.color ?? "#111827"}
              onChange={(e) => setStyle({ color: e.target.value })}
              className="w-8 h-8 rounded-lg border border-outline-variant/40 bg-transparent cursor-pointer"
              title="Text color"
            />
          </div>

          <div>
            <label className="text-label-sm text-on-surface-variant block mb-1">Align</label>
            <div className="flex gap-1">
              {(["left", "center", "right", "justify"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setStyle({ align: a })}
                  className={`flex-1 h-8 rounded-lg flex items-center justify-center ${(style.align ?? base.align) === a ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"}`}
                  title={a}
                >
                  <span className="material-symbols-outlined text-base">{`format_align_${a === "justify" ? "justify" : a}`}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-label-sm text-on-surface-variant block mb-1">Line height</label>
              <input
                type="number"
                step={0.1}
                min={0.8}
                max={3}
                value={style.lineHeight ?? 1}
                onChange={(e) => setStyle({ lineHeight: Number(e.target.value) })}
                className="w-full rounded-lg border border-outline-variant/40 px-2 py-1.5 text-label-sm bg-surface-container-lowest"
              />
            </div>
            <div>
              <label className="text-label-sm text-on-surface-variant block mb-1">Letter spacing</label>
              <input
                type="number"
                step={0.5}
                min={-2}
                max={10}
                value={style.letterSpacing ?? 0}
                onChange={(e) => setStyle({ letterSpacing: Number(e.target.value) })}
                className="w-full rounded-lg border border-outline-variant/40 px-2 py-1.5 text-label-sm bg-surface-container-lowest"
              />
            </div>
          </div>

          {Object.keys(style).length > 0 && (
            <button type="button" onClick={() => onChangeStyle({})} className="text-label-sm text-primary hover:underline">
              Reset style to default
            </button>
          )}
        </>
      )}

      {el.type === "TABLE" && (
        <TableControls tableData={el.tableData ?? [["", ""]]} onChange={onChangeTable} />
      )}

      {el.type === "IMAGE" && (
        <button
          type="button"
          onClick={onUploadImage}
          disabled={uploading}
          className="w-full bg-primary/10 text-primary rounded-lg px-3 py-2 text-label-sm hover:bg-primary/20 disabled:opacity-60 font-medium"
        >
          {uploading ? "Uploading…" : extractImgUrl(el.content) ? "Replace image" : "Upload image"}
        </button>
      )}

      <button type="button" onClick={onDelete} className="w-full text-red-500 border border-red-500/30 rounded-lg px-3 py-2 text-label-sm hover:bg-red-500/5 flex items-center justify-center gap-1.5 font-medium">
        <span className="material-symbols-outlined text-base">delete</span>
        Delete block
      </button>
    </div>
  );
}

function TableControls({ tableData, onChange }: { tableData: string[][]; onChange: (t: string[][]) => void }) {
  const cols = tableData[0]?.length ?? 2;
  return (
    <div className="space-y-2">
      <p className="text-label-sm text-on-surface-variant">
        {tableData.length} row{tableData.length === 1 ? "" : "s"} × {cols} col{cols === 1 ? "" : "s"}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange([...tableData, Array(cols).fill("")])}
          className="bg-surface-container-high text-on-surface-variant rounded-lg px-2 py-1.5 text-label-sm hover:bg-surface-container-highest"
        >
          + Row
        </button>
        <button
          type="button"
          onClick={() => onChange(tableData.map((r) => [...r, ""]))}
          className="bg-surface-container-high text-on-surface-variant rounded-lg px-2 py-1.5 text-label-sm hover:bg-surface-container-highest"
        >
          + Column
        </button>
        <button
          type="button"
          disabled={tableData.length <= 1}
          onClick={() => onChange(tableData.slice(0, -1))}
          className="bg-surface-container-high text-on-surface-variant rounded-lg px-2 py-1.5 text-label-sm hover:bg-surface-container-highest disabled:opacity-40"
        >
          − Row
        </button>
        <button
          type="button"
          disabled={cols <= 1}
          onClick={() => onChange(tableData.map((r) => r.slice(0, -1)))}
          className="bg-surface-container-high text-on-surface-variant rounded-lg px-2 py-1.5 text-label-sm hover:bg-surface-container-highest disabled:opacity-40"
        >
          − Column
        </button>
      </div>
    </div>
  );
}
