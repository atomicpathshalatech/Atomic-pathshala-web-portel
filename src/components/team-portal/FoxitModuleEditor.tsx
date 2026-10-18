"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { moveEditorImagesToStorage } from "@/lib/module-editor/image-upload";
import { loadServerPdfJs } from "@/lib/pdf/server-pdf";
import type { SetStateAction } from "react";
import {
  TextEditItem,
  WhiteoutItem,
  ImageEditItem,
  GlobalRemovalItem,
  GlobalReplacementItem,
} from "@/lib/module-editor/native-pdf-engine";
import {
  normalizeProject,
  placeNewObjects,
  objectsOnPage,
  findObject,
  addObject,
  updateObject,
  removeObject,
  duplicateObject,
  arrange,
  movePage,
  movePageTo,
  duplicatePage,
  insertBlankPage,
  toggleDeletePage,
  rotatePage,
  sourceOf,
  exportPlan,
  newId,
  PROJECT_DRAFT_LABEL,
  type PdfProject,
  type OverlayObject,
  type ArrangeOp,
} from "@/lib/module-editor/overlay-model";
import { PdfPageCanvas, type EditorTool } from "./pdf-editor/PdfPageCanvas";
import { PageThumb } from "./pdf-editor/PageThumb";
import { ObjectArrangePanel } from "./pdf-editor/ObjectPanel";

export type { EditorTool };

const HISTORY_LIMIT = 100;
const AUTOSAVE_MS = 2500;

/** Page styles a module starts with before anything was saved (unchanged from before). */
const DEFAULT_PAGE_STYLES: Pick<PdfProject, "background" | "headerFooter" | "watermark" | "coverPage"> = {
  background: { enabled: false, color: "#ffffff", opacity: 1, pageRange: "ALL" },
  headerFooter: {
    enabled: true,
    headerLeft: "ATOMIC PATHSHALA",
    headerCenter: "| {subject} - {chapter}",
    headerRight: "{teacher}",
    footerLeft: "Atomic Pathshala | India's Leading NEET Accelerator",
    footerRight: "Page {page} of {totalPages}",
    headerTopOffsetPt: 0,
    footerBottomOffsetPt: 0,
    headerImageHeight: 36,
    footerImageHeight: 24,
    removeOldHeader: true,
    removeOldFooter: true,
    oldHeaderHeightPt: 42,
    oldFooterHeightPt: 32,
    accentColor: "#059669",
    excludeFirstPage: true,
    pageRange: "ALL",
  },
  watermark: { enabled: false, type: "text", text: "ATOMIC PATHSHALA", opacity: 0.05, rotation: 35, position: "CENTER", excludeFirstPage: true, pageRange: "ALL" },
  coverPage: {
    enabled: false,
    action: "PREPEND",
    subject: "CHEMISTRY",
    moduleNumber: "Module 01",
    chapter: "IUPAC Nomenclature",
    teacher: "Firoz Sir",
    batch: "NEET Accelerated Batch",
    targetExam: "NEET (UG)",
  },
};

export interface FoxitModuleEditorProps {
  moduleId: string;
  userRole?: string;
}

interface ModuleData {
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
  originalFileUrl: string;
  originalFileName: string;
  originalFileSize: number;
  pageCount: number | null;
  versions?: Array<{ id: string; label: string; createdAt: string; snapshot: any }>;
  exportHistory?: Array<{ id: string; fileUrl: string; fileName: string; fileSize: number; createdAt: string }>;
}

interface SearchMatch {
  pageNumber: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
}

export function FoxitModuleEditor({ moduleId, userRole }: FoxitModuleEditorProps) {
  // 1. Data & Document State
  const [moduleData, setModuleData] = useState<ModuleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfDocProxy, setPdfDocProxy] = useState<any>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1.0); // 1.0 = 100%

  // 2. Active Tool & Selection State
  const [activeTool, setActiveTool] = useState<EditorTool>("SELECT");
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedObjectType, setSelectedObjectType] = useState<"text" | "whiteout" | "image" | "shape" | null>(null);

  const [viewMode, setViewMode] = useState<"continuous" | "single">("continuous");
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [firstPageSize, setFirstPageSize] = useState<{ width: number; height: number }>({ width: 595, height: 842 });

  // 3. The document being edited — overlays, page list and page styles in one
  //    object (overlay-model.ts): one stacking order per page, pages with ids.
  const [project, setProjectRaw] = useState<PdfProject>(() => normalizeProject({}, 0, DEFAULT_PAGE_STYLES));
  const projectRef = useRef(project);
  projectRef.current = project;
  // Every change goes through here: an object that arrives without a stacking
  // position is put on top of its page, whichever tool or dialog added it.
  const setProject = useCallback((next: SetStateAction<PdfProject>) => {
    setProjectRaw((prev) => placeNewObjects(typeof next === "function" ? (next as (p: PdfProject) => PdfProject)(prev) : next));
  }, []);
  const { textEdits, whiteouts, images, shapes, globalRemovals, globalReplacements, deletedPages, pageRotations, pageOrder, background, headerFooter, watermark, coverPage } = project;
  // Setters for each part, so the existing dialogs keep working unchanged.
  const {
    setTextEdits,
    setWhiteouts,
    setImages,
    setShapes,
    setGlobalRemovals,
    setGlobalReplacements,
    setPageOrder,
    setBackground,
    setHeaderFooter,
    setWatermark,
    setCoverPage,
  } = useMemo(() => {
    const field =
      <K extends keyof PdfProject>(key: K) =>
      (v: SetStateAction<PdfProject[K]>) =>
        setProject((p) => ({ ...p, [key]: typeof v === "function" ? (v as (x: PdfProject[K]) => PdfProject[K])(p[key]) : v }));
    return {
      setTextEdits: field("textEdits"),
      setWhiteouts: field("whiteouts"),
      setImages: field("images"),
      setShapes: field("shapes"),
      setGlobalRemovals: field("globalRemovals"),
      setGlobalReplacements: field("globalReplacements"),
      setPageOrder: field("pageOrder"),
      setBackground: field("background"),
      setHeaderFooter: field("headerFooter"),
      setWatermark: field("watermark"),
      setCoverPage: field("coverPage"),
    };
  }, [setProject]);

  // Pages of the finished PDF (the front-page option may take the place of page 1, as the PDF writer does).
  const coverDropsFirst = coverPage?.action === "REPLACE_FIRST" || coverPage?.action === "DELETE_FIRST";
  const effectiveDeleted = useMemo(() => (coverDropsFirst && !deletedPages.includes(1) ? [...deletedPages, 1] : deletedPages), [coverDropsFirst, deletedPages]);
  const plan = useMemo(
    () => exportPlan({ pageOrder, deletedPages: effectiveDeleted, pageSources: project.pageSources, pageRotations }, totalPages).map((e, i) => ({ ...e, displayNumber: i + 1 })),
    [pageOrder, effectiveDeleted, project.pageSources, pageRotations, totalPages]
  );

  // 5. Search & Replace State
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [replaceQuery, setReplaceQuery] = useState<string>("");
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [activeMatchIndex, setActiveMatchIndex] = useState<number>(-1);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // 6. Object Removal / Replacement Modals
  const [showRemoveModal, setShowRemoveModal] = useState<boolean>(false);
  const [showReplaceModal, setShowReplaceModal] = useState<boolean>(false);
  const [pendingTargetBox, setPendingTargetBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [removeScope, setRemoveScope] = useState<"current" | "all">("all");
  const [replaceScope, setReplaceScope] = useState<"current" | "all">("all");
  const [replaceType, setReplaceType] = useState<"image" | "text">("image");
  const [replaceImageData, setReplaceImageData] = useState<string>("");
  const [replaceTextData, setReplaceTextData] = useState<string>("");

  // 7. Dialog States & Dropdown Menus
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showCoverDialog, setShowCoverDialog] = useState<boolean>(false);
  const [showHeaderFooterDialog, setShowHeaderFooterDialog] = useState<boolean>(false);
  const [showWatermarkDialog, setShowWatermarkDialog] = useState<boolean>(false);
  const [showBackgroundDialog, setShowBackgroundDialog] = useState<boolean>(false);
  const [showPagePropsDialog, setShowPagePropsDialog] = useState<boolean>(false);

  // 9. UI & Lifecycle States
  const [activeSidebarTab, setActiveSidebarTab] = useState<"thumbnails" | "layers" | "versions" | "diagnostics">("thumbnails");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [downloadDropdownOpen, setDownloadDropdownOpen] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [latestExportUrl, setLatestExportUrl] = useState<string | null>(null);
  const [diagnosticsData, setDiagnosticsData] = useState<{ renderTimeMs: number; loadTimeMs: number }>({ renderTimeMs: 0, loadTimeMs: 0 });

  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const isAdmin = userRole === "SUPER_ADMIN" || userRole === "ADMIN";

  // Undo / redo: snapshots of the whole document, taken when an edit settles —
  // typing a sentence or dragging an object is one step, not one per key or pixel.
  const [projectLoaded, setProjectLoaded] = useState(false);
  const historyRef = useRef<{ stack: PdfProject[]; index: number }>({ stack: [], index: -1 });
  const [historyInfo, setHistoryInfo] = useState({ canUndo: false, canRedo: false });
  const restoringRef = useRef(false);
  const syncHistoryInfo = useCallback(() => {
    const h = historyRef.current;
    setHistoryInfo({ canUndo: h.index > 0, canRedo: h.index < h.stack.length - 1 });
  }, []);
  const commitHistory = useCallback(() => {
    const h = historyRef.current;
    const cur = projectRef.current;
    if (h.index >= 0 && h.stack[h.index] === cur) return;
    h.stack = [...h.stack.slice(0, h.index + 1), cur].slice(-HISTORY_LIMIT);
    h.index = h.stack.length - 1;
    syncHistoryInfo();
  }, [syncHistoryInfo]);
  useEffect(() => {
    if (!projectLoaded) return;
    if (restoringRef.current) {
      restoringRef.current = false;
      return;
    }
    const t = setTimeout(commitHistory, 400);
    return () => clearTimeout(t);
  }, [project, projectLoaded, commitHistory]);

  const stepHistory = (dir: -1 | 1) => {
    commitHistory(); // an edit still settling becomes its own step first
    const h = historyRef.current;
    const i = h.index + dir;
    if (i < 0 || i >= h.stack.length) return;
    h.index = i;
    restoringRef.current = true;
    setProjectRaw(h.stack[i]!);
    setEditingTextId(null);
    syncHistoryInfo();
  };
  const handleUndo = () => stepHistory(-1);
  const handleRedo = () => stepHistory(1);

  // Autosave of the working copy: the editable document only (no PDF is made),
  // a moment after the last edit. Saves run one after another and carry the
  // revision they are based on, so an older save never overwrites newer edits.
  const revisionRef = useRef(0);
  const savedRef = useRef<PdfProject | null>(null);
  const exportedRef = useRef<PdfProject | null>(null);
  const conflictRef = useRef(false);
  const saveChainRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const [savedSnapshot, setSavedSnapshot] = useState<PdfProject | null>(null);
  const [draftState, setDraftState] = useState<"idle" | "saving" | "saved" | "error" | "conflict">("idle");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const hasUnsavedChanges = projectLoaded && project !== savedSnapshot;

  const saveWorkingCopy = useCallback((): Promise<boolean> => {
    const run = async (): Promise<boolean> => {
      const snapshot = projectRef.current;
      if (snapshot === savedRef.current) return true;
      if (conflictRef.current) return false;
      setDraftState("saving");
      try {
        const media = await moveEditorImagesToStorage(snapshot, moduleId);
        const res = await fetch(`/api/team/modules/${moduleId}/editor-project`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ baseRevision: revisionRef.current, project: media }),
        });
        const body = await res.json().catch(() => null);
        if (res.status === 409) {
          conflictRef.current = true;
          setDraftState("conflict");
          return false;
        }
        if (!res.ok || !body?.success) throw new Error(body?.error || `Saving failed (HTTP ${res.status}).`);
        revisionRef.current = body.data.revision;
        savedRef.current = snapshot;
        setSavedSnapshot(snapshot);
        setLastSavedAt(body.data.savedAt);
        setDraftError(null);
        setDraftState("saved");
        return true;
      } catch (err: any) {
        setDraftError(err?.message || "Saving failed.");
        setDraftState("error");
        return false;
      }
    };
    const p = saveChainRef.current.then(run, run);
    saveChainRef.current = p;
    return p;
  }, [moduleId]);

  useEffect(() => {
    if (!projectLoaded || project === savedRef.current || conflictRef.current) return;
    const t = setTimeout(() => void saveWorkingCopy(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [project, projectLoaded, saveWorkingCopy]);
  useEffect(() => {
    if (draftState !== "error") return;
    const t = setTimeout(() => void saveWorkingCopy(), 10000);
    return () => clearTimeout(t);
  }, [draftState, saveWorkingCopy]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (savedRef.current && projectRef.current !== savedRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  /** After a conflict: keep this tab's document and save it over the other one. */
  const keepMineAfterConflict = async () => {
    try {
      const res = await fetch(`/api/team/modules/${moduleId}/editor-project`, { cache: "no-store" });
      const body = await res.json();
      revisionRef.current = body?.data?.revision ?? revisionRef.current;
      conflictRef.current = false;
      setDraftState("idle");
      savedRef.current = null;
      await saveWorkingCopy();
    } catch {
      toast.error("Could not reach the server — try again.");
    }
  };

  const selectObject = useCallback((id: string | null, pageId?: number) => {
    setSelectedObjectId(id);
    const o = id ? findObject(projectRef.current, id) : null;
    setSelectedObjectType(o ? o.kind : null);
    if (o && pageId) setCurrentPage(pageId);
    setEditingTextId((cur) => (cur && cur !== id ? null : cur));
  }, []);

  // 1. Initial Load of Module Details & PDF Document (Runs strictly once per moduleId)
  useEffect(() => {
    let isMounted = true;
    const loadStart = Date.now();

    async function loadModule() {
      try {
        setLoading(true);
        const res = await fetch(`/api/team/modules/${moduleId}`);
        if (!res.ok) throw new Error("Module not found");
        const json = await res.json();
        const data = (json.data?.module || json.data) as ModuleData;

        if (!data || !data.originalFileUrl) {
          throw new Error("Module PDF file URL is missing or not yet uploaded.");
        }

        if (!isMounted) return;
        setModuleData(data);

        // Populate cover config defaults from module data
        setCoverPage((prev) => ({
          ...prev,
          subject: data.subject || "CHEMISTRY",
          chapter: data.chapter || data.title || "Academic Chapter",
          teacher: data.facultyName || "Firoz Sir",
          batch: data.batch || "NEET Accelerated Batch",
        }));

        // Load PDF.js Proxy
        const pdfjs = await loadServerPdfJs();
        const loadingTask = pdfjs.getDocument({
          url: data.originalFileUrl,
          cMapUrl: "https://unpkg.com/pdfjs-dist@3.11.174/cmaps/",
          cMapPacked: true,
        });

        const docProxy = await loadingTask.promise;
        if (!isMounted) return;

        setPdfDocProxy(docProxy);
        setTotalPages(docProxy.numPages);
        setPageOrder(Array.from({ length: docProxy.numPages }, (_, i) => i + 1));

        const first = await docProxy.getPage(1);
        const firstView = first.getViewport({ scale: 1, rotation: 0 });
        setFirstPageSize({ width: firstView.width, height: firstView.height });

        // The editable document: the working copy, or this editor's latest saved
        // version if that is newer (not just "the newest version" — the block
        // editor saves its own versions in the same list).
        const stored = await fetch(`/api/team/modules/${moduleId}/editor-project`, { cache: "no-store" })
          .then((r) => r.json())
          .then((j) => (j?.success ? j.data : null))
          .catch(() => null);
        if (!isMounted) return;

        const sub = (data.subject || "").toUpperCase();
        const accent = sub.includes("CHEM") ? "#059669" : sub.includes("PHYS") ? "#0284c7" : sub.includes("BIO") ? "#7c3aed" : "#ea580c";
        const defaults = {
          ...DEFAULT_PAGE_STYLES,
          headerFooter: {
            ...DEFAULT_PAGE_STYLES.headerFooter,
            accentColor: accent,
            headerCenter: `| ${data.subject || "NEET PREP"} - ${data.chapter || data.title || "Module"}`,
            headerRight: data.facultyName || DEFAULT_PAGE_STYLES.headerFooter.headerRight,
          },
          coverPage: {
            ...DEFAULT_PAGE_STYLES.coverPage,
            subject: data.subject || "CHEMISTRY",
            chapter: data.chapter || data.title || "Academic Chapter",
            teacher: data.facultyName || DEFAULT_PAGE_STYLES.coverPage.teacher,
            batch: data.batch || DEFAULT_PAGE_STYLES.coverPage.batch,
          },
        };
        const loaded = placeNewObjects(normalizeProject(stored?.project ?? null, docProxy.numPages, defaults));
        revisionRef.current = stored?.revision ?? 0;
        savedRef.current = loaded;
        exportedRef.current = stored?.source === "saved-version" ? loaded : null;
        const lastPdf = (data.versions ?? []).find((v) => v.label !== PROJECT_DRAFT_LABEL && v.snapshot?.fileUrl)?.snapshot?.fileUrl;
        if (lastPdf) setLatestExportUrl(lastPdf);
        setProjectRaw(loaded);
        setSavedSnapshot(loaded);
        setLastSavedAt(stored?.savedAt ?? null);
        historyRef.current = { stack: [loaded], index: 0 };
        syncHistoryInfo();
        setCurrentPage(loaded.pageOrder.find((id) => !loaded.deletedPages.includes(id)) ?? 1);

        setDiagnosticsData((d) => ({ ...d, loadTimeMs: Date.now() - loadStart }));
        setLoading(false);
        setProjectLoaded(true);
      } catch (err: any) {
        console.error("Failed to load PDF document:", err);
        toast.error("Failed to load PDF: " + (err.message || "Unknown error"));
        setLoading(false);
      }
    }

    loadModule();
    return () => {
      isMounted = false;
    };
  }, [moduleId]);

  // 2. Perform Global Search Across All Pages
  const performSearch = useCallback(async () => {
    if (!pdfDocProxy || !searchQuery.trim()) return;
    setIsSearching(true);
    const queryLower = searchQuery.toLowerCase();
    const foundMatches: SearchMatch[] = [];

    try {
      for (let pNum = 1; pNum <= pdfDocProxy.numPages; pNum++) {
        const page = await pdfDocProxy.getPage(pNum);
        const viewport = page.getViewport({ scale: 1.0 });
        const textContent = await page.getTextContent();

        for (const item of textContent.items as any[]) {
          if (item.str && item.str.toLowerCase().includes(queryLower)) {
            const tx = item.transform;
            const x = tx[4];
            const y = viewport.height - tx[5] - (item.height || item.fontSize || 12);
            foundMatches.push({
              pageNumber: pNum,
              text: item.str,
              x: Math.max(0, x),
              y: Math.max(0, y),
              width: item.width || item.str.length * 6,
              height: item.height || item.fontSize || 12,
              fontSize: item.fontSize || 10,
            });
          }
        }
      }

      setSearchMatches(foundMatches);
      if (foundMatches.length > 0 && foundMatches[0]) {
        setActiveMatchIndex(0);
        setCurrentPage(foundMatches[0].pageNumber);
        toast.success(`Found ${foundMatches.length} matches across document.`);
      } else {
        setActiveMatchIndex(-1);
        toast.info("No matches found for: " + searchQuery);
      }
    } catch (err) {
      console.warn("Search error:", err);
      toast.error("Search failed on document text layer");
    } finally {
      setIsSearching(false);
    }
  }, [pdfDocProxy, searchQuery]);

  const handleNextMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIdx = (activeMatchIndex + 1) % searchMatches.length;
    const targetMatch = searchMatches[nextIdx];
    if (targetMatch) {
      setActiveMatchIndex(nextIdx);
      setCurrentPage(targetMatch.pageNumber);
    }
  };

  const handlePrevMatch = () => {
    if (searchMatches.length === 0) return;
    const prevIdx = (activeMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    const targetMatch = searchMatches[prevIdx];
    if (targetMatch) {
      setActiveMatchIndex(prevIdx);
      setCurrentPage(targetMatch.pageNumber);
    }
  };

  const handleReplaceCurrentMatch = () => {
    if (activeMatchIndex < 0 || activeMatchIndex >= searchMatches.length) return;
    const match = searchMatches[activeMatchIndex];
    if (!match) return;
    const newEditText = match.text.replace(new RegExp(searchQuery, "gi"), replaceQuery);

    const newEdit: TextEditItem = {
      id: newId("text"),
      pageNumber: match.pageNumber,
      x: match.x,
      y: match.y,
      width: Math.max(match.width, replaceQuery.length * 7),
      height: match.height + 2,
      originalText: match.text,
      newText: newEditText,
      fontSize: match.fontSize || 10,
      fontFamily: "helvetica",
      color: "#000000",
      hideOriginal: true,
    };

    const updatedEdits = [...textEdits, newEdit];
    setTextEdits(updatedEdits);
    toast.success(`Replaced match on Page ${match.pageNumber}`);
  };

  const handleReplaceAllMatches = () => {
    if (searchMatches.length === 0) return;
    const newEditsToAdd: TextEditItem[] = searchMatches.map((match, idx) => {
      const newEditText = match.text.replace(new RegExp(searchQuery, "gi"), replaceQuery);
      return {
        id: newId("text"),
        pageNumber: match.pageNumber,
        x: match.x,
        y: match.y,
        width: Math.max(match.width, replaceQuery.length * 7),
        height: match.height + 2,
        originalText: match.text,
        newText: newEditText,
        fontSize: match.fontSize || 10,
        fontFamily: "helvetica",
        color: "#000000",
        hideOriginal: true,
      };
    });

    const updatedEdits = [...textEdits, ...newEditsToAdd];
    setTextEdits(updatedEdits);
    toast.success(`Replaced ${newEditsToAdd.length} occurrences across all pages!`);
    setShowSearchModal(false);
  };

  // 3. Object Removal Confirmation
  const handleConfirmRemoveObject = () => {
    if (!pendingTargetBox) return;
    if (removeScope === "current") {
      const newWo: WhiteoutItem = {
        id: newId("whiteout"),
        pageNumber: currentPage,
        x: pendingTargetBox.x,
        y: pendingTargetBox.y,
        width: pendingTargetBox.width,
        height: pendingTargetBox.height,
        color: "#ffffff",
      };
      setWhiteouts((prev) => [...prev, newWo]);
      toast.success(`Object removed from Page ${currentPage}`);
    } else {
      const newRemoval: GlobalRemovalItem = {
        id: newId("removal"),
        x: pendingTargetBox.x,
        y: pendingTargetBox.y,
        width: pendingTargetBox.width,
        height: pendingTargetBox.height,
        pageRange: "ALL",
      };
      setGlobalRemovals((prev) => [...prev, newRemoval]);
      toast.success(`Object removed across entire PDF (All ${totalPages} pages)`);
    }
    setShowRemoveModal(false);
    setPendingTargetBox(null);
  };

  // 4. Object Replacement Confirmation
  const handleConfirmReplaceObject = () => {
    if (!pendingTargetBox) return;
    if (replaceScope === "current") {
      if (replaceType === "image" && replaceImageData) {
        const newImg: ImageEditItem = {
          id: newId("image"),
          pageNumber: currentPage,
          x: pendingTargetBox.x,
          y: pendingTargetBox.y,
          width: pendingTargetBox.width,
          height: pendingTargetBox.height,
          base64Data: replaceImageData,
          opacity: 1,
        };
        const newWo: WhiteoutItem = {
          id: newId("whiteout"),
          pageNumber: currentPage,
          x: pendingTargetBox.x,
          y: pendingTargetBox.y,
          width: pendingTargetBox.width,
          height: pendingTargetBox.height,
          color: "#ffffff",
        };
        setWhiteouts((prev) => [...prev, newWo]);
        setImages((prev) => [...prev, newImg]);
        toast.success(`Object replaced on Page ${currentPage}`);
      } else if (replaceType === "text" && replaceTextData) {
        const newTxt: TextEditItem = {
          id: newId("text"),
          pageNumber: currentPage,
          x: pendingTargetBox.x,
          y: pendingTargetBox.y,
          width: pendingTargetBox.width,
          height: pendingTargetBox.height,
          newText: replaceTextData,
          fontSize: 11,
          fontFamily: "helvetica",
          hideOriginal: true,
        };
        setTextEdits((prev) => [...prev, newTxt]);
        toast.success(`Object replaced with text on Page ${currentPage}`);
      }
    } else {
      const newRep: GlobalReplacementItem = {
        id: newId("replacement"),
        x: pendingTargetBox.x,
        y: pendingTargetBox.y,
        width: pendingTargetBox.width,
        height: pendingTargetBox.height,
        replacementType: replaceType,
        base64Data: replaceType === "image" ? replaceImageData : undefined,
        newText: replaceType === "text" ? replaceTextData : undefined,
        pageRange: "ALL",
      };
      setGlobalReplacements((prev) => [...prev, newRep]);
      toast.success(`Object replaced across entire PDF (${totalPages} pages)`);
    }
    setShowReplaceModal(false);
    setPendingTargetBox(null);
  };

  // 5. Save = keep the working copy, then make the edited PDF and record it as a version.
  const handleSaveDocument = async (isAutosave = false): Promise<string | null> => {
    try {
      setSaveStatus("saving");
      await saveWorkingCopy();
      const snapshot = projectRef.current;
      // Images go to file storage first; the save request carries only their
      // addresses (a request over ~4.5 MB is refused — see image-upload.ts).
      const media = await moveEditorImagesToStorage(snapshot, moduleId);
      const res = await fetch(`/api/team/modules/${moduleId}/save-native`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...media,
          changeSummary: `Saved with ${snapshot.textEdits.length} text boxes, ${snapshot.images.length} pictures, ${snapshot.shapes.length} shapes, ${snapshot.whiteouts.length} covers`,
          isAutosave,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Save failed with HTTP ${res.status}`);
      }

      const result = await res.json();
      const returnedFileUrl = result.data?.fileUrl || null;
      if (returnedFileUrl) setLatestExportUrl(returnedFileUrl);
      exportedRef.current = snapshot;
      setSaveStatus("saved");
      for (const w of (result.data?.warnings as string[] | undefined) ?? []) toast.warning(w, { duration: 12000 });

      if (!isAutosave) {
        toast.success("Saved. A new PDF revision was made.");
        setModuleData((prev) =>
          prev
            ? {
                ...prev,
                pageCount: result.data.pageCount,
                versions: [
                  {
                    id: result.data.versionId,
                    label: `Revision #${(prev.versions?.filter((v) => v.label !== PROJECT_DRAFT_LABEL && v.snapshot?.fileUrl).length || 0) + 1}`,
                    createdAt: new Date().toISOString(),
                    snapshot: { textEditsCount: snapshot.textEdits.length, pageCount: result.data.pageCount, fileUrl: returnedFileUrl, textEdits: [] },
                  },
                  ...(prev.versions || []),
                ],
              }
            : null
        );
      }

      setTimeout(() => setSaveStatus("idle"), 4000);
      return returnedFileUrl;
    } catch (err: any) {
      console.error("Save error:", err);
      setSaveStatus("error");
      toast.error("Failed to save: " + (err.message || "Unknown error"));
      return null;
    }
  };

  // Helper to trigger browser file download
  const triggerBrowserDownload = (url: string, fileName: string) => {
    const a = document.createElement("a");
    // Module files open through /file, which redirects to storage; a cross-origin
    // redirect ignores `download`, so ask the route for a "save as" link instead.
    a.href = url.startsWith("/api/team/modules/") && url.includes("/file?") ? `${url}&download=1` : url;
    a.download = fileName;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Export & Download Edited PDF Handler
  const handleExportAndDownload = async () => {
    setIsExporting(true);
    const toastId = toast.loading("Generating edited PDF for download...");
    try {
      let fileUrl = latestExportUrl;
      // If there are unsaved changes or we haven't saved yet, perform a fresh save
      if (projectRef.current !== exportedRef.current || !fileUrl) {
        fileUrl = await handleSaveDocument(false);
      }

      if (!fileUrl) {
        throw new Error("Could not generate edited PDF download URL.");
      }

      const safeTitle = (moduleData?.title || moduleData?.code || "Atomic_Module")
        .replace(/[^a-zA-Z0-9_-]/g, "_");
      const downloadFileName = `${safeTitle}_Edited.pdf`;

      triggerBrowserDownload(fileUrl, downloadFileName);
      toast.success("🎉 PDF Downloaded Successfully!", { id: toastId });
    } catch (err: any) {
      console.error("Export download error:", err);
      toast.error(err.message || "Failed to download edited PDF", { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  // Direct Print PDF Handler
  const handlePrintDocument = () => {
    const printUrl = latestExportUrl || moduleData?.originalFileUrl;
    if (printUrl) {
      const win = window.open(printUrl, "_blank");
      if (win) {
        win.focus();
      }
    } else {
      window.print();
    }
  };

  // Window Click Listener to Close Menus
  useEffect(() => {
    const handleWindowClick = () => {
      setActiveMenu(null);
      setDownloadDropdownOpen(false);
    };
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, []);

  // Object actions (toolbar, properties panel, layers list and keyboard all use these).
  const clipboardRef = useRef<OverlayObject | null>(null);
  const handleDeleteSelectedObject = () => {
    const id = selectedObjectId;
    if (!id) return;
    const o = findObject(projectRef.current, id);
    if (o?.locked) {
      toast.info("This object is locked — unlock it to delete it.");
      return;
    }
    setProject((p) => removeObject(p, id));
    setSelectedObjectId(null);
    setSelectedObjectType(null);
    setEditingTextId(null);
  };
  const duplicateSelected = () => {
    if (!selectedObjectId) return;
    const { project: next, newId: created } = duplicateObject(projectRef.current, selectedObjectId);
    setProject(next);
    if (created) selectObject(created);
  };
  const arrangeSelected = (op: ArrangeOp) => {
    if (selectedObjectId) setProject((p) => arrange(p, selectedObjectId, op));
  };
  const updateSelected = (patch: Record<string, unknown>) => {
    if (selectedObjectId) setProject((p) => updateObject(p, selectedObjectId, patch));
  };
  const pasteObject = () => {
    const src = clipboardRef.current;
    if (!src) return;
    const copy = { ...src, id: newId(src.kind), pageNumber: currentPage, x: src.x + 12, y: src.y + 12, locked: false, z: undefined } as OverlayObject;
    setProject((p) => addObject(p, copy));
    selectObject(copy.id, currentPage);
    clipboardRef.current = { ...copy };
  };

  // Keyboard shortcuts. Inside a text field the browser's own typing, undo and copy apply.
  const keys = useRef<Record<string, any>>({});
  keys.current = { selectedObjectId, editingTextId, handleUndo, handleRedo, handleSaveDocument, handleExportAndDownload, handlePrintDocument, handleDeleteSelectedObject, duplicateSelected, arrangeSelected, updateSelected, pasteObject };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const K = keys.current;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      const el = document.activeElement as HTMLElement | null;
      const typing = !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
      if (mod && k === "s") {
        e.preventDefault();
        void K.handleSaveDocument(false);
        return;
      }
      if (mod && k === "e") {
        e.preventDefault();
        void K.handleExportAndDownload();
        return;
      }
      if (mod && k === "p") {
        e.preventDefault();
        K.handlePrintDocument();
        return;
      }
      if (typing) return;
      if (mod && k === "z" && !e.shiftKey) {
        e.preventDefault();
        K.handleUndo();
        return;
      }
      if (mod && (k === "y" || (k === "z" && e.shiftKey))) {
        e.preventDefault();
        K.handleRedo();
        return;
      }
      if (mod && (k === "f" || k === "h")) {
        e.preventDefault();
        setShowSearchModal(true);
        return;
      }
      if (mod && k === "v") {
        if (clipboardRef.current) {
          e.preventDefault();
          K.pasteObject();
        }
        return;
      }
      const id: string | null = K.selectedObjectId;
      if (id) {
        const o = findObject(projectRef.current, id);
        if (mod && k === "d") {
          e.preventDefault();
          K.duplicateSelected();
          return;
        }
        if (mod && k === "c") {
          if (o) clipboardRef.current = o;
          return;
        }
        if (mod && k === "x") {
          if (o && !o.locked) {
            clipboardRef.current = o;
            K.handleDeleteSelectedObject();
          }
          return;
        }
        if (mod && (e.code === "BracketRight" || e.code === "BracketLeft")) {
          e.preventDefault();
          K.arrangeSelected(e.code === "BracketRight" ? (e.shiftKey ? "front" : "forward") : e.shiftKey ? "back" : "backward");
          return;
        }
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          K.handleDeleteSelectedObject();
          return;
        }
        if (o && !o.locked && e.key.startsWith("Arrow")) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          K.updateSelected({ x: o.x + dx, y: o.y + dy });
          return;
        }
        if (e.key === "Enter" && o?.kind === "text" && !o.locked) {
          e.preventDefault();
          setEditingTextId(id);
          return;
        }
        if (e.key === "Escape") {
          setSelectedObjectId(null);
          setSelectedObjectType(null);
          return;
        }
      }
      if (mod || e.altKey) return;
      const tool: Record<string, EditorTool> = { v: "SELECT", h: "HAND", t: "EDIT_TEXT", a: "ADD_TEXT", w: "WHITEOUT", r: "RECTANGLE", o: "CIRCLE", l: "LINE", g: "HIGHLIGHT", u: "UNDERLINE" };
      if (tool[k]) setActiveTool(tool[k]!);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Scroll to page in continuous view mode
  const handleSelectPage = useCallback((pNum: number) => {
    if (deletedPages.includes(pNum)) return;
    setCurrentPage(pNum);
    if (viewMode === "continuous") {
      const el = document.getElementById(`pdf-page-${pNum}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [deletedPages, viewMode]);

  // Continuous Scroll Sync: update currentPage when user scrolls viewport
  useEffect(() => {
    if (viewMode !== "continuous") return;
    const container = canvasContainerRef.current;
    if (!container) return;

    let timeoutId: any = null;
    const handleScroll = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const pageElements = container.querySelectorAll<HTMLElement>("[data-page]");
        const scrollPos = container.scrollTop + 140;

        for (let i = 0; i < pageElements.length; i++) {
          const el = pageElements[i];
          if (!el) continue;
          const pNum = Number(el.getAttribute("data-page"));
          const top = el.offsetTop;
          const bottom = top + el.offsetHeight;
          if (scrollPos >= top && scrollPos <= bottom) {
            setCurrentPage((curr) => (curr !== pNum ? pNum : curr));
            break;
          }
        }
      }, 50);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [viewMode]);

  // 1-Click Subject Theme & Heading Styling
  const applySubjectTheme = (subject: "CHEMISTRY" | "PHYSICS" | "BIOLOGY" | "ORANGE") => {
    let accentCol = "#059669";
    let bgCol = "#f0fdf4";
    let name = "Chemistry Green";

    if (subject === "PHYSICS") {
      accentCol = "#0284c7";
      bgCol = "#f0f9ff";
      name = "Physics Blue";
    } else if (subject === "BIOLOGY") {
      accentCol = "#7c3aed";
      bgCol = "#faf5ff";
      name = "Biology Purple";
    } else if (subject === "ORANGE") {
      accentCol = "#ea580c";
      bgCol = "#fff7ed";
      name = "Atomic Orange";
    }

    setBackground({ enabled: true, color: bgCol, opacity: 0.85, pageRange: "ALL" });
    setHeaderFooter((prev) => ({ ...prev, enabled: true, accentColor: accentCol }));
    setCoverPage((prev) => ({ ...prev, subject }));

    if (selectedObjectId) {
      setTextEdits((prev) =>
        prev.map((t) => (t.id === selectedObjectId ? { ...t, color: accentCol, isBold: true } : t))
      );
    }

    toast.success(`Applied ${name} Theme to Header, Background Tint & Accents!`);
  };

  // Selected Object Properties
  const selectedTextObj = useMemo(() => textEdits.find((t) => t.id === selectedObjectId), [textEdits, selectedObjectId]);
  const selectedWhiteoutObj = useMemo(() => whiteouts.find((w) => w.id === selectedObjectId), [whiteouts, selectedObjectId]);
  const selectedImageObj = useMemo(() => images.find((img) => img.id === selectedObjectId), [images, selectedObjectId]);
  const selectedObj = useMemo(() => (selectedObjectId ? findObject(project, selectedObjectId) : null), [project, selectedObjectId]);
  const selectedStack = useMemo(() => (selectedObj ? objectsOnPage(project, selectedObj.pageNumber) : []), [project, selectedObj]);
  // This editor's own saved PDFs (the working copy and the block editor's versions live in the same list).
  const savedVersions = (moduleData?.versions ?? []).filter((v) => v.label !== PROJECT_DRAFT_LABEL && v.snapshot && !Array.isArray(v.snapshot) && Array.isArray(v.snapshot.textEdits));
  const fitZoom = (mode: "width" | "page") => {
    const c = canvasContainerRef.current;
    if (!c) return;
    const w = (c.clientWidth - 72) / firstPageSize.width;
    const h = (c.clientHeight - 90) / firstPageSize.height;
    setZoom(Math.max(0.25, Math.min(4, Number((mode === "width" ? w : Math.min(w, h)).toFixed(2)))));
  };

  return (
    <div
      onClick={() => setActiveMenu(null)}
      className="flex flex-col h-[calc(100vh-128px)] rounded-xl bg-slate-950 text-slate-100 font-sans select-none overflow-hidden"
    >
      {/* 1. TOP MENU & RIBBON TOOLBAR */}
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur shrink-0 z-30">
        {/* Top Header Row with Menu Items and Save Controls */}
        <div className="flex items-center justify-between px-4 py-1 border-b border-slate-800/80 text-xs">
          <div className="flex items-center gap-3">
            <Link
              href="/team/modules"
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Back to Modules"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
            </Link>

            <div className="flex items-center gap-2 mr-2">
              <span className="font-bold text-orange-500">Atomic PDF Editor</span>
              <span className="text-slate-600">•</span>
              <span className="font-semibold text-slate-200 truncate max-w-xs">{moduleData?.title || "Loading..."}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">
                {moduleData?.originalFileName || "document.pdf"}
              </span>
              <Link
                href={`/team/modules/${moduleId}/blocks`}
                className="px-2 py-0.5 rounded text-[10px] font-bold border border-orange-500/40 text-orange-400 hover:bg-orange-500/10"
                title="Extract this PDF into editable blocks (text, questions, pictures; OCR for scanned pages)"
              >
                Extract to blocks
              </Link>
              <Link
                href={`/team/modules/${moduleId}/design`}
                className="px-2 py-0.5 rounded text-[10px] font-bold border border-sky-500/40 text-sky-300 hover:bg-sky-500/10"
                title="Design the module from its blocks: templates, theme, page setup, print/digital PDF"
              >
                Design &amp; export
              </Link>
            </div>

            {/* EXPANDED MENU BAR */}
            <div className="flex items-center gap-1 text-xs text-slate-300 relative">
              {/* File Menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenu(activeMenu === "file" ? null : "file");
                  }}
                  className={`px-2.5 py-1 rounded hover:bg-slate-800 transition-colors font-medium ${
                    activeMenu === "file" ? "bg-slate-800 text-white" : ""
                  }`}
                >
                  File
                </button>
                {activeMenu === "file" && (
                  <div className="absolute left-0 top-full mt-1 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1 z-50 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenu(null);
                        handleSaveDocument(false);
                      }}
                      className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-800 text-slate-200"
                    >
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-orange-400">save</span> Save Changes
                      </span>
                      <span className="text-[10px] text-slate-500">Ctrl+S</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenu(null);
                        handleExportAndDownload();
                      }}
                      className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-800 text-slate-200"
                    >
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-emerald-400">download</span> Export & Download
                      </span>
                      <span className="text-[10px] text-slate-500">Ctrl+E</span>
                    </button>
                    {moduleData?.originalFileUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveMenu(null);
                          triggerBrowserDownload(
                            moduleData.originalFileUrl,
                            moduleData.originalFileName || "Original_Module.pdf"
                          );
                          toast.success("Downloading original PDF...");
                        }}
                        className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-800 text-slate-200"
                      >
                        <span className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm text-indigo-400">history_edu</span> Download Original
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenu(null);
                        handlePrintDocument();
                      }}
                      className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-800 text-slate-200"
                    >
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-slate-400">print</span> Print
                      </span>
                      <span className="text-[10px] text-slate-500">Ctrl+P</span>
                    </button>
                    <div className="my-1 border-t border-slate-800" />
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenu(null);
                        setActiveSidebarTab("versions");
                      }}
                      className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-800 text-slate-200"
                    >
                      <span className="material-symbols-outlined text-sm text-teal-400">history</span> Version History
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenu(null);
                        setShowPagePropsDialog(true);
                      }}
                      className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-800 text-slate-200"
                    >
                      <span className="material-symbols-outlined text-sm text-slate-400">info</span> Document Properties
                    </button>
                  </div>
                )}
              </div>

              {/* Edit Menu (Comprehensive) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenu(activeMenu === "edit" ? null : "edit");
                  }}
                  className={`px-2.5 py-1 rounded hover:bg-slate-800 transition-colors font-medium ${
                    activeMenu === "edit" ? "bg-slate-800 text-white" : ""
                  }`}
                >
                  Edit
                </button>
                {activeMenu === "edit" && (
                  <div className="absolute left-0 top-full mt-1 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1 z-50 text-xs">
                    <button
                      onClick={() => setActiveTool("EDIT_TEXT")}
                      className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-800 text-slate-200"
                    >
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-emerald-400">edit_note</span> Edit Text
                      </span>
                      <span className="text-[10px] text-slate-500">T</span>
                    </button>
                    <button
                      onClick={() => setActiveTool("SELECT")}
                      className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-800 text-slate-200"
                    >
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-orange-400">near_me</span> Edit Object
                      </span>
                      <span className="text-[10px] text-slate-500">V</span>
                    </button>
                    <div className="my-1 border-t border-slate-800" />
                    <button
                      onClick={() => setShowSearchModal(true)}
                      className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-800 text-slate-200"
                    >
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-yellow-400">find_replace</span> Search &amp; Replace
                      </span>
                      <span className="text-[10px] text-slate-500">Ctrl+F</span>
                    </button>
                    <button
                      onClick={() => setActiveTool("REPLACE_OBJECT")}
                      className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-800 text-slate-200"
                    >
                      <span className="material-symbols-outlined text-sm text-cyan-400">cached</span> Replace Object
                    </button>
                    <button
                      onClick={() => setActiveTool("REMOVE_OBJECT")}
                      className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-800 text-slate-200"
                    >
                      <span className="material-symbols-outlined text-sm text-red-400">delete_sweep</span> Remove Object
                    </button>
                    <div className="my-1 border-t border-slate-800" />
                    <button
                      onClick={() => setShowHeaderFooterDialog(true)}
                      className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-800 text-slate-200"
                    >
                      <span className="material-symbols-outlined text-sm text-teal-400">view_headline</span> Header
                    </button>
                    <button
                      onClick={() => setShowHeaderFooterDialog(true)}
                      className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-800 text-slate-200"
                    >
                      <span className="material-symbols-outlined text-sm text-teal-400">dock_to_bottom</span> Footer
                    </button>
                    <button
                      onClick={() => setShowBackgroundDialog(true)}
                      className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-800 text-slate-200"
                    >
                      <span className="material-symbols-outlined text-sm text-purple-400">wallpaper</span> Background
                    </button>
                    <button
                      onClick={() => setShowWatermarkDialog(true)}
                      className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-800 text-slate-200"
                    >
                      <span className="material-symbols-outlined text-sm text-blue-400">branding_watermark</span> Watermark
                    </button>
                    <button
                      onClick={() => setShowCoverDialog(true)}
                      className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-800 text-slate-200"
                    >
                      <span className="material-symbols-outlined text-sm text-emerald-400">auto_stories</span> Front Page
                    </button>
                  </div>
                )}
              </div>

              {/* View Menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenu(activeMenu === "view" ? null : "view");
                  }}
                  className={`px-2.5 py-1 rounded hover:bg-slate-800 transition-colors font-medium ${
                    activeMenu === "view" ? "bg-slate-800 text-white" : ""
                  }`}
                >
                  View
                </button>
                {activeMenu === "view" && (
                  <div className="absolute left-0 top-full mt-1 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1 z-50 text-xs">
                    <button
                      onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))))}
                      className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-800 text-slate-200"
                    >
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">zoom_in</span> Zoom In
                      </span>
                      <span className="text-[10px] text-slate-500">+</span>
                    </button>
                    <button
                      onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                      className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-800 text-slate-200"
                    >
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">zoom_out</span> Zoom Out
                      </span>
                      <span className="text-[10px] text-slate-500">-</span>
                    </button>
                    <button
                      onClick={() => setZoom(1.0)}
                      className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-800 text-slate-200"
                    >
                      <span className="material-symbols-outlined text-sm">restart_alt</span> Actual Size (100%)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Save status: the working copy autosaves; "Save" also makes the PDF */}
            <div className="flex items-center gap-1.5 text-[11px]" role="status" aria-live="polite">
              {saveStatus === "saving" ? (
                <span className="text-amber-400 flex items-center gap-1 font-semibold">
                  <span className="material-symbols-outlined text-xs animate-spin">sync</span>
                  Making the PDF…
                </span>
              ) : saveStatus === "error" ? (
                <span className="text-red-400 flex items-center gap-1 font-semibold">
                  <span className="material-symbols-outlined text-xs">error</span>
                  PDF not made
                </span>
              ) : draftState === "conflict" ? (
                <span className="text-red-400 font-semibold">Changed elsewhere — not saved</span>
              ) : draftState === "error" ? (
                <span className="text-red-400 font-semibold" title={draftError ?? ""}>
                  Autosave failed — retrying
                </span>
              ) : draftState === "saving" ? (
                <span className="text-slate-300 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs animate-spin">sync</span>
                  Saving…
                </span>
              ) : hasUnsavedChanges ? (
                <span className="text-slate-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Unsaved changes
                </span>
              ) : lastSavedAt ? (
                <span className="text-emerald-400 flex items-center gap-1" title={`Saved ${new Date(lastSavedAt).toLocaleString()}`}>
                  <span className="material-symbols-outlined text-xs">cloud_done</span>
                  All changes saved
                </span>
              ) : null}
            </div>

            {/* Save & Export / Download Action Buttons */}
            <button
              type="button"
              onClick={() => handleSaveDocument(false)}
              className="px-3.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              title="Save Changes (Ctrl+S)"
            >
              <span className="material-symbols-outlined text-sm">save</span>
              <span>Save (Ctrl+S)</span>
            </button>

            {/* Prominent Download PDF Button with Options Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDownloadDropdownOpen((prev) => !prev);
                }}
                disabled={isExporting}
                className="px-3.5 py-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                title="Download / Export PDF (Ctrl+E)"
              >
                {isExporting ? (
                  <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-sm">download</span>
                )}
                <span>{isExporting ? "Generating..." : "Download PDF"}</span>
                <span className="material-symbols-outlined text-xs">arrow_drop_down</span>
              </button>

              {downloadDropdownOpen && (
                <div
                  className="absolute right-0 top-full mt-1.5 w-64 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl py-1.5 z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Export & Download
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setDownloadDropdownOpen(false);
                      handleExportAndDownload();
                    }}
                    className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-slate-800 text-left transition-colors text-slate-200"
                  >
                    <span className="material-symbols-outlined text-emerald-400 text-lg">download_done</span>
                    <div>
                      <div className="font-bold text-slate-100 flex items-center gap-1">
                        Download Edited PDF
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1 rounded font-normal">Latest</span>
                      </div>
                      <div className="text-[10px] text-slate-400">Includes all text, images & edits (Ctrl+E)</div>
                    </div>
                  </button>

                  {moduleData?.originalFileUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setDownloadDropdownOpen(false);
                        triggerBrowserDownload(
                          moduleData.originalFileUrl,
                          moduleData.originalFileName || "Original_Module.pdf"
                        );
                        toast.success("Downloading original PDF...");
                      }}
                      className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-slate-800 text-left transition-colors text-slate-200"
                    >
                      <span className="material-symbols-outlined text-indigo-400 text-lg">history_edu</span>
                      <div>
                        <div className="font-bold text-slate-200">Download Original PDF</div>
                        <div className="text-[10px] text-slate-400">Unedited source document</div>
                      </div>
                    </button>
                  )}

                  <div className="my-1 border-t border-slate-800" />

                  <button
                    type="button"
                    onClick={() => {
                      setDownloadDropdownOpen(false);
                      handlePrintDocument();
                    }}
                    className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-800 text-slate-300 text-left transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm text-slate-400">print</span>
                    <span>Print PDF (Ctrl+P)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Ribbon Tool Icons & Quick Action Controls */}
        <div className="flex items-center justify-between px-4 py-2 gap-2 overflow-x-auto text-xs">
          {/* Tool Group 1: Navigation & Selection */}
          <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTool("SELECT")}
              className={`p-1.5 rounded-lg flex items-center gap-1 font-semibold transition-all ${
                activeTool === "SELECT" ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" : "text-slate-400 hover:text-white"
              }`}
              title="Select / Move Object (V)"
            >
              <span className="material-symbols-outlined text-base">near_me</span>
              <span>Select</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTool("HAND")}
              className={`p-1.5 rounded-lg flex items-center gap-1 font-semibold transition-all ${
                activeTool === "HAND" ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" : "text-slate-400 hover:text-white"
              }`}
              title="Hand / Pan View (H)"
            >
              <span className="material-symbols-outlined text-base">pan_tool</span>
              <span>Hand</span>
            </button>
          </div>

          {/* Tool Group 2: In-Place Editing Tools */}
          <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTool("EDIT_TEXT")}
              className={`p-1.5 rounded-lg flex items-center gap-1 font-semibold transition-all ${
                activeTool === "EDIT_TEXT" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-slate-400 hover:text-white"
              }`}
              title="Click Existing PDF Text to Edit In-Place (T)"
            >
              <span className="material-symbols-outlined text-base">edit_note</span>
              <span>Edit Text</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSearchModal(true)}
              className="p-1.5 rounded-lg flex items-center gap-1 font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              title="Global Search & Replace across All Pages (Ctrl+F)"
            >
              <span className="material-symbols-outlined text-base text-yellow-400">find_replace</span>
              <span>Search &amp; Replace</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTool("ADD_TEXT")}
              className={`p-1.5 rounded-lg flex items-center gap-1 font-semibold transition-all ${
                activeTool === "ADD_TEXT" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-slate-400 hover:text-white"
              }`}
              title="Add New Text Box (A)"
            >
              <span className="material-symbols-outlined text-base">text_fields</span>
              <span>Add Text</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTool("WHITEOUT")}
              className={`p-1.5 rounded-lg flex items-center gap-1 font-semibold transition-all ${
                activeTool === "WHITEOUT" ? "bg-red-500/20 text-red-400 border border-red-500/30" : "text-slate-400 hover:text-white"
              }`}
              title="Cover an area with white (W) — an overlay: text underneath stays in the PDF file, so this is not a redaction"
            >
              <span className="material-symbols-outlined text-base">ink_eraser</span>
              <span>Whiteout</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTool("REMOVE_OBJECT")}
              className={`p-1.5 rounded-lg flex items-center gap-1 font-semibold transition-all ${
                activeTool === "REMOVE_OBJECT" ? "bg-red-500/20 text-red-400 border border-red-500/30" : "text-slate-400 hover:text-white"
              }`}
              title="Drag box around logo/object to remove across current page or entire PDF"
            >
              <span className="material-symbols-outlined text-base">delete_sweep</span>
              <span>Remove Object</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTool("REPLACE_OBJECT")}
              className={`p-1.5 rounded-lg flex items-center gap-1 font-semibold transition-all ${
                activeTool === "REPLACE_OBJECT" ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "text-slate-400 hover:text-white"
              }`}
              title="Drag box around object to replace with new image/text across PDF"
            >
              <span className="material-symbols-outlined text-base">cached</span>
              <span>Replace Object</span>
            </button>

            <label
              className="p-1.5 rounded-lg flex items-center gap-1 font-semibold cursor-pointer text-slate-400 hover:text-white transition-all hover:bg-slate-800"
              title="Insert Image"
            >
              <input
                type="file"
                accept="image/png, image/jpeg, image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                      const base64 = evt.target?.result as string;
                      const newImg: ImageEditItem = {
                        id: newId("image"),
                        pageNumber: currentPage,
                        x: 50,
                        y: 50,
                        width: 180,
                        height: 120,
                        base64Data: base64,
                        opacity: 1,
                      };
                      setImages((prev) => [...prev, newImg]);
                      setSelectedObjectId(newImg.id);
                      setSelectedObjectType("image");
                      toast.success("Image placed on Page " + currentPage);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <span className="material-symbols-outlined text-base text-indigo-400">image</span>
              <span>Image</span>
            </label>
          </div>

          {/* Tool Group 2b: Draw (drag on the page) */}
          <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800 shrink-0" role="group" aria-label="Draw">
            {(
              [
                ["RECTANGLE", "crop_square", "Box", "R"],
                ["CIRCLE", "circle", "Ellipse", "O"],
                ["LINE", "horizontal_rule", "Line", "L"],
                ["HIGHLIGHT", "ink_highlighter", "Highlight", "G"],
                ["UNDERLINE", "format_underlined", "Underline", "U"],
              ] as const
            ).map(([tool, icon, label, key]) => (
              <button
                key={tool}
                type="button"
                onClick={() => setActiveTool(tool)}
                aria-pressed={activeTool === tool}
                className={`p-1.5 rounded-lg flex items-center gap-1 font-semibold transition-all ${
                  activeTool === tool ? "bg-sky-500/20 text-sky-300 border border-sky-500/30" : "text-slate-400 hover:text-white"
                }`}
                title={`${label} — drag on the page (${key})`}
              >
                <span className="material-symbols-outlined text-base">{icon}</span>
                <span className="hidden 2xl:inline">{label}</span>
              </button>
            ))}
          </div>


          {/* Tool Group 3: Module Branding Dialogs */}
          <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setShowCoverDialog(true)}
              className={`p-1.5 rounded-lg flex items-center gap-1 font-semibold transition-all ${
                coverPage.enabled ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "text-slate-400 hover:text-white"
              }`}
              title="Atomic Pathshala Front Page Setup"
            >
              <span className="material-symbols-outlined text-base">auto_stories</span>
              <span>Front Page</span>
            </button>

            <button
              type="button"
              onClick={() => setShowHeaderFooterDialog(true)}
              className={`p-1.5 rounded-lg flex items-center gap-1 font-semibold transition-all ${
                headerFooter.enabled ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "text-slate-400 hover:text-white"
              }`}
              title="Header & Footer Settings"
            >
              <span className="material-symbols-outlined text-base">view_headline</span>
              <span>Header/Footer</span>
            </button>

            <button
              type="button"
              onClick={() => setShowWatermarkDialog(true)}
              className={`p-1.5 rounded-lg flex items-center gap-1 font-semibold transition-all ${
                watermark.enabled ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "text-slate-400 hover:text-white"
              }`}
              title="Watermark Overlay"
            >
              <span className="material-symbols-outlined text-base">branding_watermark</span>
              <span>Watermark</span>
            </button>

            <button
              type="button"
              onClick={() => setShowBackgroundDialog(true)}
              className={`p-1.5 rounded-lg flex items-center gap-1 font-semibold transition-all ${
                background.enabled ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "text-slate-400 hover:text-white"
              }`}
              title="Background Color/Image Settings"
            >
              <span className="material-symbols-outlined text-base">wallpaper</span>
              <span>Background</span>
            </button>
          </div>

          {/* Tool Group 3.5: Subject Theme 1-Click Filters */}
          <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800 shrink-0">
            <span className="text-[10px] font-bold text-slate-400 px-1">Theme:</span>
            <button
              type="button"
              onClick={() => applySubjectTheme("CHEMISTRY")}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                headerFooter.accentColor === "#059669"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "text-slate-400 hover:text-emerald-400 hover:bg-slate-800"
              }`}
              title="Apply Chemistry Theme & Accents"
            >
              <span>🧪</span>
              <span className="hidden xl:inline">Chemistry</span>
            </button>
            <button
              type="button"
              onClick={() => applySubjectTheme("PHYSICS")}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                headerFooter.accentColor === "#0284c7"
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                  : "text-slate-400 hover:text-sky-400 hover:bg-slate-800"
              }`}
              title="Apply Physics Theme & Accents"
            >
              <span>⚡</span>
              <span className="hidden xl:inline">Physics</span>
            </button>
            <button
              type="button"
              onClick={() => applySubjectTheme("BIOLOGY")}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                headerFooter.accentColor === "#7c3aed"
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                  : "text-slate-400 hover:text-purple-400 hover:bg-slate-800"
              }`}
              title="Apply Biology Theme & Accents"
            >
              <span>🧬</span>
              <span className="hidden xl:inline">Biology</span>
            </button>
          </div>

          {/* Tool Group 4: Undo/Redo & Zoom Navigation */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <div className="flex items-center gap-0.5 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={handleUndo}
                disabled={!historyInfo.canUndo}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30"
                title="Undo (Ctrl+Z)"
              >
                <span className="material-symbols-outlined text-base">undo</span>
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={!historyInfo.canRedo}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30"
                title="Redo (Ctrl+Y)"
              >
                <span className="material-symbols-outlined text-base">redo</span>
              </button>
            </div>

            {/* View Mode Toggle */}
            <button
              type="button"
              onClick={() => setViewMode((m) => (m === "continuous" ? "single" : "continuous"))}
              className={`p-1.5 rounded-xl border flex items-center gap-1 font-bold text-xs transition-all ${
                viewMode === "continuous"
                  ? "bg-orange-500/20 text-orange-300 border-orange-500/30"
                  : "bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white"
              }`}
              title={viewMode === "continuous" ? "Continuous Vertical Scroll (Click for Single Page)" : "Single Page Mode (Click for Continuous Scroll)"}
            >
              <span className="material-symbols-outlined text-sm">
                {viewMode === "continuous" ? "view_stream" : "crop_portrait"}
              </span>
              <span className="hidden sm:inline">{viewMode === "continuous" ? "Scroll" : "Single"}</span>
            </button>

            {/* Page Navigator */}
            <div className="flex items-center gap-1.5 bg-slate-950/60 px-2 py-1 rounded-xl border border-slate-800 text-xs" role="group" aria-label="Pages">
              {(() => {
                const at = plan.findIndex((e) => e.pageId === currentPage);
                return (
                  <>
                    <button type="button" onClick={() => at > 0 && handleSelectPage(plan[at - 1]!.pageId)} disabled={at <= 0} className="text-slate-400 hover:text-white disabled:opacity-30" aria-label="Previous page">
                      <span className="material-symbols-outlined text-sm">chevron_left</span>
                    </button>
                    <span className="font-semibold text-slate-300 tabular-nums">
                      {at + 1} / {plan.length || 1}
                    </span>
                    <button type="button" onClick={() => at < plan.length - 1 && handleSelectPage(plan[at + 1]!.pageId)} disabled={at >= plan.length - 1} className="text-slate-400 hover:text-white disabled:opacity-30" aria-label="Next page">
                      <span className="material-symbols-outlined text-sm">chevron_right</span>
                    </button>
                  </>
                );
              })()}
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800 text-xs" role="group" aria-label="Zoom">
              <button type="button" onClick={() => setZoom((z) => Math.max(0.25, Number((z - 0.15).toFixed(2))))} className="p-1 text-slate-400 hover:text-white" title="Zoom out" aria-label="Zoom out">
                <span className="material-symbols-outlined text-sm">remove</span>
              </button>
              <span className="font-bold w-12 text-center text-slate-300 tabular-nums">{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => setZoom((z) => Math.min(4, Number((z + 0.15).toFixed(2))))} className="p-1 text-slate-400 hover:text-white" title="Zoom in" aria-label="Zoom in">
                <span className="material-symbols-outlined text-sm">add</span>
              </button>
              <button type="button" onClick={() => fitZoom("width")} className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-400 hover:text-white" title="Fit page width">
                Fit width
              </button>
              <button type="button" onClick={() => fitZoom("page")} className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-400 hover:text-white" title="Fit whole page">
                Fit page
              </button>
              <button type="button" onClick={() => setZoom(1.0)} className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-400 hover:text-white">
                100%
              </button>
            </div>
          </div>
        </div>
      </header>

      {draftState === "conflict" && (
        <div role="alert" className="bg-red-950/80 border-b border-red-800 text-red-200 text-xs px-4 py-2 flex flex-wrap items-center gap-3 shrink-0">
          <span>This document was saved from another tab or by someone else after you opened it, so your latest edits are not saved.</span>
          <button type="button" onClick={() => window.location.reload()} className="px-2.5 py-1 rounded-lg border border-red-700 hover:bg-red-900 font-bold">
            Load their version
          </button>
          <button type="button" onClick={() => void keepMineAfterConflict()} className="px-2.5 py-1 rounded-lg bg-red-700 hover:bg-red-600 text-white font-bold">
            Keep mine (replace theirs)
          </button>
        </div>
      )}
      <div className="bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400 px-4 py-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 shrink-0">
        <span className="font-bold text-orange-400">Original PDF mode</span>
        <span>
          Text, covers, pictures and shapes are added <b className="text-slate-300">on top of</b> the original pages; the original content is not rewritten (text under a cover stays in the file). Page order,
          removing, turning, duplicating and blank pages change the document&apos;s pages.
        </span>
        <Link href={`/team/modules/${moduleId}/blocks`} className="text-orange-400 hover:underline font-semibold">
          Need to rewrite the content? Rebuild it as editable blocks →
        </Link>
      </div>

      {/* 2. MAIN WORKSPACE WITH 3-COLUMN SPLIT */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* LEFT SIDEBAR: Thumbnails, Layers, Versions */}
        <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 z-20">
          {/* Sidebar Tab Header */}
          <div className="flex items-center border-b border-slate-800 p-1 text-[11px] font-bold bg-slate-950/50">
            <button
              type="button"
              onClick={() => setActiveSidebarTab("thumbnails")}
              className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
                activeSidebarTab === "thumbnails" ? "bg-slate-800 text-orange-400" : "text-slate-400 hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">grid_view</span>
              <span>Pages ({totalPages})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSidebarTab("layers")}
              className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
                activeSidebarTab === "layers" ? "bg-slate-800 text-orange-400" : "text-slate-400 hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">layers</span>
              <span>Edits</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSidebarTab("versions")}
              className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
                activeSidebarTab === "versions" ? "bg-slate-800 text-orange-400" : "text-slate-400 hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">history</span>
              <span>History</span>
            </button>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* PAGES TAB — order, turn, copy, blank page, remove/restore; drag a page to move it */}
            {activeSidebarTab === "thumbnails" && (
              <ol className="space-y-3" aria-label="Pages">
                {pageOrder.map((pageId, idx) => {
                  const isDeleted = effectiveDeleted.includes(pageId);
                  const coverTook = coverDropsFirst && pageId === 1 && !deletedPages.includes(1);
                  const src = sourceOf(project, pageId);
                  const num = plan.findIndex((e) => e.pageId === pageId) + 1;
                  const isCurrent = currentPage === pageId;
                  const iconBtn = "p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 focus-visible:outline focus-visible:outline-1 focus-visible:outline-orange-500";
                  return (
                    <li
                      key={pageId}
                      draggable
                      onDragStart={(ev) => {
                        ev.dataTransfer.setData("text/x-page-id", String(pageId));
                        ev.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(ev) => {
                        if (ev.dataTransfer.types.includes("text/x-page-id")) ev.preventDefault();
                      }}
                      onDrop={(ev) => {
                        ev.preventDefault();
                        const from = Number(ev.dataTransfer.getData("text/x-page-id"));
                        if (from && from !== pageId) setProject((p) => movePageTo(p, from, p.pageOrder.indexOf(pageId)));
                      }}
                      className={`p-2 rounded-2xl border transition-all relative ${
                        isCurrent ? "border-orange-500 bg-orange-500/10 shadow-md" : isDeleted ? "border-red-900/40 bg-red-950/20 opacity-60" : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5 text-[11px] gap-1">
                        <span className="font-bold text-slate-300 truncate">
                          {isDeleted ? (coverTook ? "Replaced by front page" : "Removed") : `Page ${num}`}
                          {src === 0 ? " · blank" : src !== pageId ? ` · copy of p.${src}` : ""}
                        </span>
                        <div className="flex items-center shrink-0">
                          <button type="button" className={iconBtn} disabled={idx === 0} onClick={() => setProject((p) => movePage(p, pageId, -1))} title="Move up" aria-label={`Move page ${num || idx + 1} up`}>
                            <span className="material-symbols-outlined text-xs">arrow_upward</span>
                          </button>
                          <button type="button" className={iconBtn} disabled={idx === pageOrder.length - 1} onClick={() => setProject((p) => movePage(p, pageId, 1))} title="Move down" aria-label={`Move page ${num || idx + 1} down`}>
                            <span className="material-symbols-outlined text-xs">arrow_downward</span>
                          </button>
                          <button type="button" className={iconBtn} onClick={() => setProject((p) => rotatePage(p, pageId))} title="Turn 90° clockwise" aria-label="Turn page">
                            <span className="material-symbols-outlined text-xs">rotate_right</span>
                          </button>
                          <button
                            type="button"
                            className={iconBtn}
                            onClick={() => {
                              const r = duplicatePage(projectRef.current, pageId);
                              setProject(r.project);
                              toast.success("Page duplicated — the copy has its own edits.");
                            }}
                            title="Duplicate page (with its edits)"
                            aria-label="Duplicate page"
                          >
                            <span className="material-symbols-outlined text-xs">library_add</span>
                          </button>
                          <button type="button" className={iconBtn} onClick={() => setProject((p) => insertBlankPage(p, pageId).project)} title="Insert a blank page after" aria-label="Insert blank page after">
                            <span className="material-symbols-outlined text-xs">note_add</span>
                          </button>
                          <button
                            type="button"
                            className={`p-1 rounded hover:bg-slate-800 ${isDeleted ? "text-emerald-400" : "text-red-400 hover:text-red-300"}`}
                            disabled={coverTook}
                            onClick={() => {
                              if (!isDeleted && plan.length <= 1) return toast.info("A PDF needs at least one page.");
                              setProject((p) => toggleDeletePage(p, pageId));
                            }}
                            title={isDeleted ? "Restore page" : "Remove page"}
                            aria-label={isDeleted ? "Restore page" : "Remove page"}
                          >
                            <span className="material-symbols-outlined text-xs">{isDeleted ? "restore" : "delete"}</span>
                          </button>
                        </div>
                      </div>
                      <button type="button" onClick={() => !isDeleted && handleSelectPage(pageId)} className="block w-full rounded-lg border border-slate-800/80 overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500" aria-label={`Go to page ${num || idx + 1}`}>
                        <PageThumb pdfDocProxy={pdfDocProxy} sourcePage={src} rotation={pageRotations[pageId] ?? 0} />
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}

            {/* LAYERS TAB — the current page's objects, top first */}
            {activeSidebarTab === "layers" && (
              <div className="space-y-2 text-xs">
                <h4 className="font-bold text-slate-400 uppercase text-[10px] tracking-wider mb-1">
                  Layers on page {plan.find((e) => e.pageId === currentPage)?.displayNumber ?? "–"} <span className="normal-case font-normal">(top first)</span>
                </h4>
                {(globalRemovals.length > 0 || globalReplacements.length > 0) && (
                  <p className="p-2 rounded-xl border border-slate-800 bg-slate-950/40 text-slate-400">
                    {globalRemovals.length} cover(s) and {globalReplacements.length} replacement(s) on every page sit under all page objects.
                  </p>
                )}
                {(() => {
                  const stack = objectsOnPage(project, currentPage).slice().reverse();
                  if (!stack.length) return <p className="text-slate-500 italic text-center py-4">No objects on this page yet.</p>;
                  return (
                    <ul className="space-y-1.5" aria-label="Layers">
                      {stack.map((o) => {
                        const icon = o.kind === "text" ? "text_fields" : o.kind === "image" ? "image" : o.kind === "whiteout" ? "ink_eraser" : o.type === "highlight" ? "ink_highlighter" : o.type === "underline" ? "format_underlined" : o.type === "circle" ? "circle" : o.type === "line" ? "horizontal_rule" : "crop_square";
                        const name = o.kind === "text" ? o.newText || "(empty text)" : o.kind === "image" ? "Picture" : o.kind === "whiteout" ? "White cover" : o.type;
                        return (
                          <li key={o.id} className={`p-1.5 rounded-xl border flex items-center gap-1.5 ${selectedObjectId === o.id ? "border-orange-500 bg-orange-500/10" : "border-slate-800 bg-slate-950/40"}`}>
                            <button type="button" onClick={() => selectObject(o.id, currentPage)} className="flex-1 flex items-center gap-1.5 truncate text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-orange-500 rounded">
                              <span className="material-symbols-outlined text-sm text-slate-400">{icon}</span>
                              <span className="truncate">{name}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setProject((p) => updateObject(p, o.id, { locked: !o.locked }))}
                              className={`p-0.5 rounded ${o.locked ? "text-amber-400" : "text-slate-500 hover:text-white"}`}
                              title={o.locked ? "Unlock" : "Lock"}
                              aria-label={o.locked ? `Unlock ${name}` : `Lock ${name}`}
                              aria-pressed={!!o.locked}
                            >
                              <span className="material-symbols-outlined text-sm">{o.locked ? "lock" : "lock_open"}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()}
              </div>
            )}

            {/* VERSIONS TAB */}
            {activeSidebarTab === "versions" && (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">
                    Revision History
                  </h4>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {savedVersions.length} saved
                  </span>
                </div>
                {savedVersions.length > 0 ? (
                  savedVersions.map((v) => (
                    <div key={v.id} className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2 hover:border-slate-700 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200 truncate pr-2">{v.label}</span>
                        <span className="text-[10px] text-slate-500 shrink-0">{new Date(v.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900">
                        <span>
                          {v.snapshot?.textEditsCount ?? 0} edits • {v.snapshot?.pageCount ?? 0} pages
                        </span>
                        {v.snapshot?.fileUrl ? (
                          <button
                            type="button"
                            onClick={() => {
                              triggerBrowserDownload(
                                v.snapshot.fileUrl,
                                `${(moduleData?.code || "Module")}_${v.label.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`
                              );
                              toast.success("Downloading revision PDF...");
                            }}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 font-semibold text-[10px] transition-colors cursor-pointer"
                            title="Download this version"
                          >
                            <span className="material-symbols-outlined text-xs text-emerald-400">download</span>
                            Download
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-xs italic text-center py-4">No revisions saved yet.</p>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* CENTER VIEWPORT: High-Resolution Native PDF Canvas */}
        <main
          ref={canvasContainerRef}
          className="flex-1 bg-slate-950 overflow-auto p-8 flex justify-center relative cursor-default"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 m-auto">
              <span className="material-symbols-outlined text-4xl text-orange-500 animate-spin">
                progress_activity
              </span>
              <p className="font-bold text-sm text-slate-300">Loading Native PDF...</p>
            </div>
          ) : (
            <div className="space-y-8 flex flex-col items-center w-full pb-16">
              {coverPage?.enabled && (coverPage.action === "PREPEND" || coverPage.action === "REPLACE_FIRST" || !coverPage.action) && (viewMode === "continuous" || plan[0]?.pageId === currentPage) && (
                <div className="flex flex-col items-center">
                  <div className="text-[10px] font-bold text-slate-400 mb-1">Front page (added when the PDF is made — set it up under Front Page)</div>
                  <div
                    className="shadow-2xl border border-slate-800 p-8 flex flex-col justify-between text-white"
                    style={{ width: 595 * zoom, height: 842 * zoom, background: "linear-gradient(145deg, #7c2d12 0%, #431407 60%, #9a3412 100%)" }}
                    aria-label="Front page preview"
                  >
                    <span className="text-xl font-black tracking-wider">ATOMIC PATHSHALA</span>
                    <div className="space-y-3">
                      <div className="inline-block px-3 py-1 rounded-lg bg-white/20 text-xs font-extrabold uppercase">
                        {coverPage.subject || "CHEMISTRY"} • {coverPage.moduleNumber || "MODULE 01"}
                      </div>
                      <h1 className="text-3xl font-black leading-tight">{coverPage.chapter}</h1>
                    </div>
                    <div className="text-sm font-bold">{coverPage.teacher}</div>
                  </div>
                </div>
              )}
              {(viewMode === "continuous" ? plan : plan.filter((e) => e.pageId === currentPage).concat(plan.some((e) => e.pageId === currentPage) ? [] : plan.slice(0, 1))).map((e) => (
                <div key={e.pageId} id={`pdf-page-${e.pageId}`} data-page={e.pageId} className="flex flex-col items-center relative">
                  <div className="text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                      Page {e.displayNumber} of {plan.length}
                      {e.source === 0 ? " · blank" : e.source !== e.pageId ? ` · copy of page ${e.source}` : ""}
                    </span>
                  </div>
                  <PdfPageCanvas
                    pdfDocProxy={pdfDocProxy}
                    pageId={e.pageId}
                    sourcePage={e.source}
                    displayNumber={e.displayNumber}
                    totalPages={plan.length}
                    zoom={zoom}
                    rotation={e.rotation}
                    defaultSize={firstPageSize}
                    activeTool={activeTool}
                    objects={objectsOnPage(project, e.pageId)}
                    globalRemovals={globalRemovals}
                    globalReplacements={globalReplacements}
                    selectedObjectId={selectedObjectId}
                    editingTextId={editingTextId}
                    onSelectObject={(id) => selectObject(id, e.pageId)}
                    onStartEditText={setEditingTextId}
                    onAddObject={(obj) => {
                      setProject((p) => addObject(p, obj));
                      setSelectedObjectId(obj.id);
                      setSelectedObjectType(obj.kind);
                      setCurrentPage(e.pageId);
                    }}
                    onUpdateObject={(id, patch) => setProject((p) => updateObject(p, id, patch))}
                    onTargetBoxSelected={(box) => {
                      setPendingTargetBox(box);
                      setCurrentPage(e.pageId);
                      if (activeTool === "REMOVE_OBJECT") setShowRemoveModal(true);
                      else if (activeTool === "REPLACE_OBJECT") setShowReplaceModal(true);
                    }}
                    onToolDone={() => setActiveTool("SELECT")}
                    onGestureStart={commitHistory}
                    headerFooter={headerFooter}
                    watermark={watermark}
                    background={background}
                    coverPage={coverPage}
                    moduleData={moduleData}
                  />
                </div>
              ))}
            </div>
          )}
        </main>

        {/* RIGHT PROPERTIES PANEL: Selected Object Styling */}
        <aside className="w-72 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0 z-20 overflow-y-auto p-4 space-y-4 text-xs">
          <h3 className="font-bold text-slate-300 text-sm flex items-center gap-2 border-b border-slate-800 pb-2">
            <span className="material-symbols-outlined text-orange-500">tune</span>
            <span>Object Properties</span>
          </h3>

          {selectedObj ? (
            <ObjectArrangePanel
              o={selectedObj}
              index={selectedStack.findIndex((x) => x.id === selectedObj.id)}
              count={selectedStack.length}
              onArrange={arrangeSelected}
              onUpdate={updateSelected}
              onDuplicate={duplicateSelected}
              onDelete={handleDeleteSelectedObject}
            />
          ) : null}

          {/* TEXT OBJECT PROPERTIES */}
          {selectedTextObj && (
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Text Content
                </label>
                <textarea
                  value={selectedTextObj.newText}
                  onChange={(e) => {
                    const updated = { ...selectedTextObj, newText: e.target.value };
                    setTextEdits((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
                  }}
                  rows={4}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-sans text-xs focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Font Size
                  </label>
                  <input
                    type="number"
                    min={6}
                    max={72}
                    value={selectedTextObj.fontSize}
                    onChange={(e) => {
                      const updated = { ...selectedTextObj, fontSize: Number(e.target.value) };
                      setTextEdits((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
                    }}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-sans"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Font Family
                  </label>
                  <select
                    value={selectedTextObj.fontFamily || "helvetica"}
                    onChange={(e) => {
                      const updated = { ...selectedTextObj, fontFamily: e.target.value as any };
                      setTextEdits((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
                    }}
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-sans"
                  >
                    <option value="helvetica">Helvetica (Sans)</option>
                    <option value="times">Times (Serif)</option>
                    <option value="courier">Courier (Mono)</option>
                  </select>
                </div>
              </div>

              {/* Text Styles & Color */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const updated = { ...selectedTextObj, isBold: !selectedTextObj.isBold };
                    setTextEdits((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
                  }}
                  className={`flex-1 py-1 rounded-lg border font-bold ${
                    selectedTextObj.isBold ? "bg-orange-500/20 text-orange-400 border-orange-500" : "border-slate-800"
                  }`}
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const updated = { ...selectedTextObj, isItalic: !selectedTextObj.isItalic };
                    setTextEdits((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
                  }}
                  className={`flex-1 py-1 rounded-lg border italic font-serif ${
                    selectedTextObj.isItalic ? "bg-orange-500/20 text-orange-400 border-orange-500" : "border-slate-800"
                  }`}
                >
                  I
                </button>

                <div className="flex items-center gap-1">
                  <input
                    type="color"
                    value={selectedTextObj.color || "#000000"}
                    onChange={(e) => {
                      const updated = { ...selectedTextObj, color: e.target.value };
                      setTextEdits((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
                    }}
                    className="w-8 h-8 rounded border border-slate-800 cursor-pointer bg-transparent"
                  />
                </div>
              </div>

              {/* Quick Subject Theme Heading Colors */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                  Subject Heading Colors
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...selectedTextObj, color: "#059669", isBold: true };
                      setTextEdits((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
                      toast.success("Applied Chemistry Heading Style");
                    }}
                    className="p-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/40 hover:bg-emerald-900/50 flex flex-col items-center gap-0.5"
                    title="Chemistry Green"
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-[9px] font-bold text-emerald-400">Chem</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...selectedTextObj, color: "#0284c7", isBold: true };
                      setTextEdits((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
                      toast.success("Applied Physics Heading Style");
                    }}
                    className="p-1.5 rounded-lg border border-sky-500/40 bg-sky-950/40 hover:bg-sky-900/50 flex flex-col items-center gap-0.5"
                    title="Physics Blue"
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                    <span className="text-[9px] font-bold text-sky-400">Phys</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...selectedTextObj, color: "#7c3aed", isBold: true };
                      setTextEdits((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
                      toast.success("Applied Biology Heading Style");
                    }}
                    className="p-1.5 rounded-lg border border-purple-500/40 bg-purple-950/40 hover:bg-purple-900/50 flex flex-col items-center gap-0.5"
                    title="Biology Purple"
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    <span className="text-[9px] font-bold text-purple-400">Bio</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...selectedTextObj, color: "#ea580c", isBold: true };
                      setTextEdits((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
                      toast.success("Applied Orange Accent Style");
                    }}
                    className="p-1.5 rounded-lg border border-orange-500/40 bg-orange-950/40 hover:bg-orange-900/50 flex flex-col items-center gap-0.5"
                    title="Orange Accent"
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                    <span className="text-[9px] font-bold text-orange-400">Orange</span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDeleteSelectedObject}
                className="w-full py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
                <span>Delete Text Box</span>
              </button>
            </div>
          )}

          {/* WHITEOUT OBJECT PROPERTIES */}
          {selectedWhiteoutObj && (
            <div className="space-y-4">
              <p className="text-slate-400 text-xs">
                A white cover drawn on top of the page. It hides the area when viewed or printed, but any text underneath is still inside the PDF file.
              </p>
              <button
                type="button"
                onClick={handleDeleteSelectedObject}
                className="w-full py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
                <span>Remove Whiteout Mask</span>
              </button>
            </div>
          )}

          {/* IMAGE OBJECT PROPERTIES */}
          {selectedImageObj && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">X Position</label>
                  <input
                    type="number"
                    value={Math.round(selectedImageObj.x)}
                    onChange={(e) => {
                      const updated = { ...selectedImageObj, x: Number(e.target.value) };
                      setImages((prev) => prev.map((img) => (img.id === updated.id ? updated : img)));
                    }}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Y Position</label>
                  <input
                    type="number"
                    value={Math.round(selectedImageObj.y)}
                    onChange={(e) => {
                      const updated = { ...selectedImageObj, y: Number(e.target.value) };
                      setImages((prev) => prev.map((img) => (img.id === updated.id ? updated : img)));
                    }}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Width (pt)</label>
                  <input
                    type="number"
                    value={Math.round(selectedImageObj.width)}
                    onChange={(e) => {
                      const updated = { ...selectedImageObj, width: Number(e.target.value) };
                      setImages((prev) => prev.map((img) => (img.id === updated.id ? updated : img)));
                    }}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Height (pt)</label>
                  <input
                    type="number"
                    value={Math.round(selectedImageObj.height)}
                    onChange={(e) => {
                      const updated = { ...selectedImageObj, height: Number(e.target.value) };
                      setImages((prev) => prev.map((img) => (img.id === updated.id ? updated : img)));
                    }}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Rotation: {selectedImageObj.rotation ?? 0}°
                </label>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={5}
                  value={selectedImageObj.rotation ?? 0}
                  onChange={(e) => {
                    const updated = { ...selectedImageObj, rotation: Number(e.target.value) };
                    setImages((prev) => prev.map((img) => (img.id === updated.id ? updated : img)));
                  }}
                  className="w-full accent-orange-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Opacity: {Math.round((selectedImageObj.opacity ?? 1) * 100)}%
                </label>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={selectedImageObj.opacity ?? 1}
                  onChange={(e) => {
                    const updated = { ...selectedImageObj, opacity: Number(e.target.value) };
                    setImages((prev) => prev.map((img) => (img.id === updated.id ? updated : img)));
                  }}
                  className="w-full accent-orange-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Replace Image</label>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        const updated = { ...selectedImageObj, base64Data: evt.target?.result as string };
                        setImages((prev) => prev.map((img) => (img.id === updated.id ? updated : img)));
                        toast.success("Image replaced successfully!");
                      };
                      reader.readAsDataURL(f);
                    }
                  }}
                  className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:bg-slate-800 file:text-slate-200"
                />
              </div>

              <button
                type="button"
                onClick={handleDeleteSelectedObject}
                className="w-full py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
                <span>Delete Image</span>
              </button>
            </div>
          )}

          {!selectedObj && (
            <div className="text-center py-8 text-slate-500 space-y-2">
              <span className="material-symbols-outlined text-3xl opacity-40">touch_app</span>
              <p>Select an object on the page (or in Layers) to edit it. Drag to move, the corner handle to resize, double-click text to type.</p>
            </div>
          )}
        </aside>
      </div>

      {/* 3. SEARCH & REPLACE MODAL DIALOG */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-yellow-400">find_replace</span>
                <span>Global Search &amp; Replace across Document</span>
              </h3>
              <button onClick={() => setShowSearchModal(false)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Search For</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && performSearch()}
                    placeholder="e.g. Chemical Bonding, Old Academy Name..."
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={performSearch}
                    disabled={isSearching || !searchQuery.trim()}
                    className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold disabled:opacity-40"
                  >
                    {isSearching ? "Searching..." : "Find"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Replace With</label>
                <input
                  type="text"
                  value={replaceQuery}
                  onChange={(e) => setReplaceQuery(e.target.value)}
                  placeholder="e.g. Chemical Bonding - NEET 2027..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                />
              </div>

              {/* Search Results Summary */}
              {searchMatches.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <span className="font-semibold text-emerald-400">
                    Match {activeMatchIndex + 1} of {searchMatches.length} (Page {searchMatches[activeMatchIndex]?.pageNumber})
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handlePrevMatch}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title="Previous Match"
                    >
                      <span className="material-symbols-outlined text-xs">arrow_upward</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleNextMatch}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title="Next Match"
                    >
                      <span className="material-symbols-outlined text-xs">arrow_downward</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowSearchModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700"
              >
                Close
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReplaceCurrentMatch}
                  disabled={activeMatchIndex < 0}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs disabled:opacity-40"
                >
                  Replace Current
                </button>
                <button
                  type="button"
                  onClick={handleReplaceAllMatches}
                  disabled={searchMatches.length === 0}
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs disabled:opacity-40"
                >
                  Replace All ({searchMatches.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. REMOVE OBJECT MODAL DIALOG */}
      {showRemoveModal && pendingTargetBox && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-red-400">delete_sweep</span>
                <span>Remove Object / Logo</span>
              </h3>
              <button onClick={() => setShowRemoveModal(false)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Where would you like to permanently remove this selected object/region from?
            </p>

            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="removeScope"
                  checked={removeScope === "current"}
                  onChange={() => setRemoveScope("current")}
                  className="text-orange-500 focus:ring-orange-500"
                />
                <div>
                  <p className="font-bold text-slate-200">Current Page Only</p>
                  <p className="text-[11px] text-slate-400">Removes this object from Page {currentPage}</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="removeScope"
                  checked={removeScope === "all"}
                  onChange={() => setRemoveScope("all")}
                  className="text-orange-500 focus:ring-orange-500"
                />
                <div>
                  <p className="font-bold text-slate-200">Entire PDF (All Pages)</p>
                  <p className="text-[11px] text-slate-400">
                    Permanently masks matching signature on all {totalPages} pages
                  </p>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowRemoveModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveObject}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
              >
                Confirm Removal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. REPLACE OBJECT MODAL DIALOG */}
      {showReplaceModal && pendingTargetBox && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-400">cached</span>
                <span>Replace Object / Logo</span>
              </h3>
              <button onClick={() => setShowReplaceModal(false)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReplaceType("image")}
                  className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${
                    replaceType === "image" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500" : "bg-slate-950 border border-slate-800"
                  }`}
                >
                  Replace with Image
                </button>
                <button
                  type="button"
                  onClick={() => setReplaceType("text")}
                  className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${
                    replaceType === "text" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500" : "bg-slate-950 border border-slate-800"
                  }`}
                >
                  Replace with Text
                </button>
              </div>

              {replaceType === "image" ? (
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Upload New Image / Logo
                  </label>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        const reader = new FileReader();
                        reader.onload = (evt) => setReplaceImageData(evt.target?.result as string);
                        reader.readAsDataURL(f);
                      }
                    }}
                    className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-800 file:text-slate-200"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Replacement Text</label>
                  <input
                    type="text"
                    value={replaceTextData}
                    onChange={(e) => setReplaceTextData(e.target.value)}
                    placeholder="Enter text..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Apply Scope</label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="replaceScope"
                      checked={replaceScope === "current"}
                      onChange={() => setReplaceScope("current")}
                      className="text-orange-500"
                    />
                    <span className="font-semibold text-slate-200">Current Page</span>
                  </label>
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="replaceScope"
                      checked={replaceScope === "all"}
                      onChange={() => setReplaceScope("all")}
                      className="text-orange-500"
                    />
                    <span className="font-semibold text-slate-200">Entire PDF</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowReplaceModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReplaceObject}
                disabled={replaceType === "image" ? !replaceImageData : !replaceTextData}
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs disabled:opacity-40"
              >
                Apply Replacement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. FRONT COVER PAGE DIALOG */}
      {showCoverDialog && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400">auto_stories</span>
                <span>Atomic Pathshala Front Page Setup</span>
              </h3>
              <button onClick={() => setShowCoverDialog(false)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer p-3 rounded-xl bg-slate-950 border border-slate-800">
                <input
                  type="checkbox"
                  checked={coverPage.enabled}
                  onChange={(e) => setCoverPage((p) => ({ ...p, enabled: e.target.checked }))}
                  className="rounded text-orange-500 focus:ring-orange-500"
                />
                <span className="font-bold text-slate-200">Include Front Cover Page</span>
              </label>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Front Page Action</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCoverPage((p) => ({ ...p, action: "PREPEND" }))}
                    className={`py-2 rounded-xl font-bold transition-all ${
                      coverPage.action === "PREPEND" || !coverPage.action
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500"
                        : "bg-slate-950 border border-slate-800"
                    }`}
                  >
                    Prepend Cover (Page 0)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoverPage((p) => ({ ...p, action: "REPLACE_FIRST" }))}
                    className={`py-2 rounded-xl font-bold transition-all ${
                      coverPage.action === "REPLACE_FIRST"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500"
                        : "bg-slate-950 border border-slate-800"
                    }`}
                  >
                    Replace First Page
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Subject Theme</label>
                  <select
                    value={coverPage.subject}
                    onChange={(e) => {
                      const sub = e.target.value;
                      setCoverPage((p) => ({ ...p, subject: sub }));
                      // Also auto-sync header accent color
                      let col = "#ea580c";
                      if (sub === "CHEMISTRY") col = "#059669";
                      if (sub === "PHYSICS") col = "#0284c7";
                      if (sub === "BIOLOGY") col = "#7c3aed";
                      setHeaderFooter((h) => ({ ...h, accentColor: col }));
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                  >
                    <option value="CHEMISTRY">🧪 Chemistry (Emerald Green)</option>
                    <option value="PHYSICS">⚡ Physics (Cyan / Blue)</option>
                    <option value="BIOLOGY">🧬 Biology (Purple / Violet)</option>
                    <option value="GENERAL">🟧 General / Atomic Orange</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Module Code</label>
                  <input
                    type="text"
                    value={coverPage.moduleNumber}
                    onChange={(e) => setCoverPage((p) => ({ ...p, moduleNumber: e.target.value }))}
                    placeholder="e.g. Module 01"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Action</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setCoverPage((p) => ({ ...p, action: "REPLACE_FIRST" }))}
                    className={`py-2 px-3 rounded-xl border font-bold text-left transition-all ${
                      coverPage.action === "REPLACE_FIRST"
                        ? "border-orange-500 bg-orange-500/20 text-orange-300"
                        : "border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white"
                    }`}
                  >
                    <div>Replace Page 1</div>
                    <div className="text-[10px] font-normal text-slate-400">Replaces old cover</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoverPage((p) => ({ ...p, action: "PREPEND" }))}
                    className={`py-2 px-3 rounded-xl border font-bold text-left transition-all ${
                      coverPage.action === "PREPEND"
                        ? "border-orange-500 bg-orange-500/20 text-orange-300"
                        : "border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white"
                    }`}
                  >
                    <div>Prepend as Page 1</div>
                    <div className="text-[10px] font-normal text-slate-400">Inserts at front</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Chapter Title</label>
                <input
                  type="text"
                  value={coverPage.chapter}
                  onChange={(e) => setCoverPage((p) => ({ ...p, chapter: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Faculty Name</label>
                  <input
                    type="text"
                    value={coverPage.teacher || ""}
                    onChange={(e) => setCoverPage((p) => ({ ...p, teacher: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Target Exam</label>
                  <input
                    type="text"
                    value={coverPage.targetExam || ""}
                    onChange={(e) => setCoverPage((p) => ({ ...p, targetExam: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowCoverDialog(false);
                  toast.success("Front Page configuration applied!");
                }}
                className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs"
              >
                Apply Cover Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. HEADER & FOOTER CONFIG MODAL */}
      {showHeaderFooterDialog && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-lg w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-400">view_headline</span>
                <span>Running Header &amp; Footer Styling</span>
              </h3>
              <button onClick={() => setShowHeaderFooterDialog(false)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Quick Subject Theme Presets */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">
                Subject Theme Color Preset
              </label>
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setHeaderFooter((p) => ({ ...p, accentColor: "#059669" }))}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    headerFooter.accentColor === "#059669"
                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                      : "border-slate-800 bg-slate-950 text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="w-3 h-3 rounded-full bg-emerald-500 mx-auto mb-1" />
                  <div className="text-[10px] font-bold">Chemistry</div>
                </button>
                <button
                  type="button"
                  onClick={() => setHeaderFooter((p) => ({ ...p, accentColor: "#0284c7" }))}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    headerFooter.accentColor === "#0284c7"
                      ? "border-sky-500 bg-sky-500/20 text-sky-300"
                      : "border-slate-800 bg-slate-950 text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="w-3 h-3 rounded-full bg-sky-500 mx-auto mb-1" />
                  <div className="text-[10px] font-bold">Physics</div>
                </button>
                <button
                  type="button"
                  onClick={() => setHeaderFooter((p) => ({ ...p, accentColor: "#7c3aed" }))}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    headerFooter.accentColor === "#7c3aed"
                      ? "border-purple-500 bg-purple-500/20 text-purple-300"
                      : "border-slate-800 bg-slate-950 text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="w-3 h-3 rounded-full bg-purple-500 mx-auto mb-1" />
                  <div className="text-[10px] font-bold">Biology</div>
                </button>
                <button
                  type="button"
                  onClick={() => setHeaderFooter((p) => ({ ...p, accentColor: "#ea580c" }))}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    headerFooter.accentColor === "#ea580c"
                      ? "border-orange-500 bg-orange-500/20 text-orange-300"
                      : "border-slate-800 bg-slate-950 text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="w-3 h-3 rounded-full bg-orange-500 mx-auto mb-1" />
                  <div className="text-[10px] font-bold">Orange</div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 cursor-pointer p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <input
                  type="checkbox"
                  checked={headerFooter.enabled}
                  onChange={(e) => setHeaderFooter((p) => ({ ...p, enabled: e.target.checked }))}
                  className="rounded text-orange-500 focus:ring-orange-500"
                />
                <span className="font-bold text-slate-200">Enable Header / Footer</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <input
                  type="checkbox"
                  checked={headerFooter.removeOldHeader}
                  onChange={(e) => setHeaderFooter((p) => ({ ...p, removeOldHeader: e.target.checked }))}
                  className="rounded text-orange-500 focus:ring-orange-500"
                />
                <span className="font-bold text-slate-200">Mask Old Headers</span>
              </label>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Header Left</label>
                  <input
                    type="text"
                    value={headerFooter.headerLeft || ""}
                    onChange={(e) => setHeaderFooter((p) => ({ ...p, headerLeft: e.target.value }))}
                    placeholder="ATOMIC PATHSHALA"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Header Center</label>
                  <input
                    type="text"
                    value={headerFooter.headerCenter || ""}
                    onChange={(e) => setHeaderFooter((p) => ({ ...p, headerCenter: e.target.value }))}
                    placeholder="| {subject} - {chapter}"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Header Right</label>
                  <input
                    type="text"
                    value={headerFooter.headerRight || ""}
                    onChange={(e) => setHeaderFooter((p) => ({ ...p, headerRight: e.target.value }))}
                    placeholder="{teacher}"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Header Top Offset: {headerFooter.headerTopOffsetPt || 0}pt
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    step={1}
                    value={headerFooter.headerTopOffsetPt || 0}
                    onChange={(e) => setHeaderFooter((p) => ({ ...p, headerTopOffsetPt: Number(e.target.value) }))}
                    className="w-full accent-orange-500"
                  />
                  <div className="text-[10px] text-slate-500">Distance from top edge</div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Header Height: {headerFooter.headerImageHeight || 36}pt
                  </label>
                  <input
                    type="range"
                    min={28}
                    max={50}
                    step={2}
                    value={headerFooter.headerImageHeight || 36}
                    onChange={(e) => setHeaderFooter((p) => ({ ...p, headerImageHeight: Number(e.target.value) }))}
                    className="w-full accent-orange-500"
                  />
                  <div className="text-[10px] text-slate-500">Height of header banner</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Footer Left</label>
                  <input
                    type="text"
                    value={headerFooter.footerLeft || ""}
                    onChange={(e) => setHeaderFooter((p) => ({ ...p, footerLeft: e.target.value }))}
                    placeholder="Atomic Pathshala | NEET Accelerator"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Footer Right</label>
                  <input
                    type="text"
                    value={headerFooter.footerRight || ""}
                    onChange={(e) => setHeaderFooter((p) => ({ ...p, footerRight: e.target.value }))}
                    placeholder="Page {page} of {totalPages}"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Footer Bottom Offset: {headerFooter.footerBottomOffsetPt || 0}pt
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    step={1}
                    value={headerFooter.footerBottomOffsetPt || 0}
                    onChange={(e) => setHeaderFooter((p) => ({ ...p, footerBottomOffsetPt: Number(e.target.value) }))}
                    className="w-full accent-orange-500"
                  />
                  <div className="text-[10px] text-slate-500">Distance from bottom edge</div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Footer Height: {headerFooter.footerImageHeight || 24}pt
                  </label>
                  <input
                    type="range"
                    min={16}
                    max={40}
                    step={2}
                    value={headerFooter.footerImageHeight || 24}
                    onChange={(e) => setHeaderFooter((p) => ({ ...p, footerImageHeight: Number(e.target.value) }))}
                    className="w-full accent-orange-500"
                  />
                  <div className="text-[10px] text-slate-500">Height of footer banner</div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Header Logo / Image (Optional)
                </label>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const reader = new FileReader();
                      reader.onload = (evt) =>
                        setHeaderFooter((p) => ({ ...p, headerImageBase64: evt.target?.result as string }));
                      reader.readAsDataURL(f);
                    }
                  }}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-800 file:text-slate-200"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1 text-slate-300">
                <input
                  type="checkbox"
                  checked={headerFooter.excludeFirstPage ?? true}
                  onChange={(e) => setHeaderFooter((p) => ({ ...p, excludeFirstPage: e.target.checked }))}
                  className="rounded text-orange-500"
                />
                <span>Exclude Header / Footer from First Page (Cover)</span>
              </label>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowHeaderFooterDialog(false);
                  toast.success("Header & Footer applied across pages!");
                }}
                className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs"
              >
                Apply Header / Footer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. WATERMARK CONFIG MODAL */}
      {showWatermarkDialog && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-400">branding_watermark</span>
                <span>Watermark Configuration</span>
              </h3>
              <button onClick={() => setShowWatermarkDialog(false)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <label className="flex items-center gap-2 cursor-pointer p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <input
                type="checkbox"
                checked={watermark.enabled}
                onChange={(e) => setWatermark((p) => ({ ...p, enabled: e.target.checked }))}
                className="rounded text-orange-500 focus:ring-orange-500"
              />
              <span className="font-bold text-slate-200">Enable Diagonal Watermark</span>
            </label>

            {/* Type Tab: Text vs Image */}
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setWatermark((p) => ({ ...p, type: "text" }))}
                className={`py-1.5 rounded-lg font-bold transition-all ${
                  watermark.type !== "image" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                Text Watermark
              </button>
              <button
                type="button"
                onClick={() => setWatermark((p) => ({ ...p, type: "image" }))}
                className={`py-1.5 rounded-lg font-bold transition-all ${
                  watermark.type === "image" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                Image Watermark
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {watermark.type === "image" ? (
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Upload Watermark Logo / Image
                  </label>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        const reader = new FileReader();
                        reader.onload = (evt) =>
                          setWatermark((p) => ({ ...p, base64Data: evt.target?.result as string }));
                        reader.readAsDataURL(f);
                      }
                    }}
                    className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-800 file:text-slate-200"
                  />
                  {watermark.base64Data && (
                    <div className="mt-2 p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <img src={watermark.base64Data} alt="Preview" className="h-10 object-contain" />
                      <span className="text-[10px] text-emerald-400 font-bold">Image Loaded ✓</span>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Watermark Text</label>
                  <input
                    type="text"
                    value={watermark.text || ""}
                    onChange={(e) => setWatermark((p) => ({ ...p, text: e.target.value }))}
                    placeholder="ATOMIC PATHSHALA"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                  />
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    {["ATOMIC PATHSHALA", "CONFIDENTIAL", "NEET ACCELERATOR", "SAMPLE ONLY"].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setWatermark((p) => ({ ...p, text: preset }))}
                        className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 font-medium"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Opacity: {Math.round((watermark.opacity ?? 0.08) * 100)}%
                  </label>
                  <input
                    type="range"
                    min={0.02}
                    max={0.35}
                    step={0.01}
                    value={watermark.opacity ?? 0.08}
                    onChange={(e) => setWatermark((p) => ({ ...p, opacity: Number(e.target.value) }))}
                    className="w-full accent-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Rotation: {watermark.rotation ?? -30}°
                  </label>
                  <input
                    type="range"
                    min={-90}
                    max={90}
                    step={5}
                    value={watermark.rotation ?? -30}
                    onChange={(e) => setWatermark((p) => ({ ...p, rotation: Number(e.target.value) }))}
                    className="w-full accent-blue-500"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={watermark.excludeFirstPage ?? true}
                  onChange={(e) => setWatermark((p) => ({ ...p, excludeFirstPage: e.target.checked }))}
                  className="rounded text-orange-500"
                />
                <span>Exclude Watermark from First Page (Cover)</span>
              </label>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowWatermarkDialog(false);
                  toast.success("Watermark applied!");
                }}
                className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs"
              >
                Apply Watermark
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. BACKGROUND & SUBJECT THEME CONFIG MODAL */}
      {showBackgroundDialog && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-400">palette</span>
                <span>Subject Theme &amp; Background</span>
              </h3>
              <button onClick={() => setShowBackgroundDialog(false)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* 1-Click Subject Theme Presets */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">
                Apply Complete Subject Theme
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBackground({ enabled: true, color: "#f0fdf4", opacity: 0.95, pageRange: "ALL" });
                    setHeaderFooter((h) => ({ ...h, enabled: true, accentColor: "#059669" }));
                    setCoverPage((c) => ({ ...c, subject: "CHEMISTRY" }));
                    toast.success("🧪 Applied Chemistry Green Theme!");
                  }}
                  className="p-3 rounded-2xl border border-emerald-500/40 bg-emerald-950/30 hover:bg-emerald-900/40 text-left transition-all"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">🧪</span>
                    <span className="font-bold text-emerald-400 text-xs">Chemistry Theme</span>
                  </div>
                  <div className="text-[10px] text-slate-400">Mint background tint + Emerald green accents</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBackground({ enabled: true, color: "#f0f9ff", opacity: 0.95, pageRange: "ALL" });
                    setHeaderFooter((h) => ({ ...h, enabled: true, accentColor: "#0284c7" }));
                    setCoverPage((c) => ({ ...c, subject: "PHYSICS" }));
                    toast.success("⚡ Applied Physics Blue Theme!");
                  }}
                  className="p-3 rounded-2xl border border-sky-500/40 bg-sky-950/30 hover:bg-sky-900/40 text-left transition-all"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">⚡</span>
                    <span className="font-bold text-sky-400 text-xs">Physics Theme</span>
                  </div>
                  <div className="text-[10px] text-slate-400">Ice blue background tint + Cyan/Royal Blue accents</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBackground({ enabled: true, color: "#faf5ff", opacity: 0.95, pageRange: "ALL" });
                    setHeaderFooter((h) => ({ ...h, enabled: true, accentColor: "#7c3aed" }));
                    setCoverPage((c) => ({ ...c, subject: "BIOLOGY" }));
                    toast.success("🧬 Applied Biology Purple Theme!");
                  }}
                  className="p-3 rounded-2xl border border-purple-500/40 bg-purple-950/30 hover:bg-purple-900/40 text-left transition-all"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">🧬</span>
                    <span className="font-bold text-purple-400 text-xs">Biology Theme</span>
                  </div>
                  <div className="text-[10px] text-slate-400">Lavender background tint + Violet accents</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBackground({ enabled: true, color: "#ffffff", opacity: 1, pageRange: "ALL" });
                    setHeaderFooter((h) => ({ ...h, enabled: true, accentColor: "#ea580c" }));
                    setCoverPage((c) => ({ ...c, subject: "GENERAL" }));
                    toast.success("🟧 Applied Atomic Classic Theme!");
                  }}
                  className="p-3 rounded-2xl border border-orange-500/40 bg-orange-950/30 hover:bg-orange-900/40 text-left transition-all"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">🟧</span>
                    <span className="font-bold text-orange-400 text-xs">Atomic Classic</span>
                  </div>
                  <div className="text-[10px] text-slate-400">Clean white background + Signature Orange accents</div>
                </button>
              </div>
            </div>

            <div className="space-y-3 text-xs pt-2 border-t border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <input
                  type="checkbox"
                  checked={background.enabled}
                  onChange={(e) => setBackground((p) => ({ ...p, enabled: e.target.checked }))}
                  className="rounded text-orange-500"
                />
                <span className="font-bold text-slate-200">Custom Background Enabled</span>
              </label>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Custom Tint / Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={background.color || "#ffffff"}
                    onChange={(e) => setBackground((p) => ({ ...p, color: e.target.value }))}
                    className="w-10 h-10 rounded border border-slate-800 cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={background.color || "#ffffff"}
                    onChange={(e) => setBackground((p) => ({ ...p, color: e.target.value }))}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Background Watermark Image (Optional)
                </label>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const reader = new FileReader();
                      reader.onload = (evt) =>
                        setBackground((p) => ({ ...p, base64Data: evt.target?.result as string }));
                      reader.readAsDataURL(f);
                    }
                  }}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-800 file:text-slate-200"
                />
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowBackgroundDialog(false);
                  toast.success("Background settings applied!");
                }}
                className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs"
              >
                Apply Theme &amp; Background
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. DOCUMENT PROPERTIES MODAL */}
      {showPagePropsDialog && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-400">info</span>
                <span>Document Information</span>
              </h3>
              <button onClick={() => setShowPagePropsDialog(false)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <p><span className="text-slate-500">File Name:</span> {moduleData?.originalFileName}</p>
              <p><span className="text-slate-500">Total Pages:</span> {totalPages}</p>
              <p><span className="text-slate-500">Current Page:</span> {currentPage}</p>
              <p><span className="text-slate-500">Rendering Engine:</span> Native PDF.js + pdf-lib Direct Stream</p>
              <p><span className="text-slate-500">Active Edits:</span> {textEdits.length} text, {whiteouts.length} whiteouts, {images.length} images</p>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowPagePropsDialog(false)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
