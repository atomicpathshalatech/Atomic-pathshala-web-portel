"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { loadServerPdfJs } from "@/lib/pdf/server-pdf";
import {
  TextEditItem,
  WhiteoutItem,
  ImageEditItem,
  ShapeEditItem,
  GlobalRemovalItem,
  GlobalReplacementItem,
  BackgroundConfig,
  HeaderFooterConfig,
  WatermarkConfig,
  CoverPageConfig,
} from "@/lib/module-editor/native-pdf-engine";

export type EditorTool =
  | "SELECT"
  | "HAND"
  | "EDIT_TEXT"
  | "ADD_TEXT"
  | "WHITEOUT"
  | "IMAGE"
  | "RECTANGLE"
  | "CIRCLE"
  | "LINE"
  | "HIGHLIGHT"
  | "REMOVE_OBJECT"
  | "REPLACE_OBJECT";

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

  // 3. Document Edits (Applied per-page)
  const [textEdits, setTextEdits] = useState<TextEditItem[]>([]);
  const [whiteouts, setWhiteouts] = useState<WhiteoutItem[]>([]);
  const [images, setImages] = useState<ImageEditItem[]>([]);
  const [shapes, setShapes] = useState<ShapeEditItem[]>([]);
  const [globalRemovals, setGlobalRemovals] = useState<GlobalRemovalItem[]>([]);
  const [globalReplacements, setGlobalReplacements] = useState<GlobalReplacementItem[]>([]);
  const [deletedPages, setDeletedPages] = useState<number[]>([]);
  const [pageRotations, setPageRotations] = useState<Record<number, number>>({});
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [viewMode, setViewMode] = useState<"continuous" | "single">("continuous");

  // 4. Global Overlays & Configurations
  const [background, setBackground] = useState<BackgroundConfig>({
    enabled: false,
    color: "#ffffff",
    opacity: 1,
    pageRange: "ALL",
  });

  const [headerFooter, setHeaderFooter] = useState<HeaderFooterConfig>({
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
  });

  const [watermark, setWatermark] = useState<WatermarkConfig>({
    enabled: false,
    type: "text",
    text: "ATOMIC PATHSHALA",
    opacity: 0.05,
    rotation: 35,
    position: "CENTER",
    excludeFirstPage: true,
    pageRange: "ALL",
  });

  const [coverPage, setCoverPage] = useState<CoverPageConfig>({
    enabled: false,
    action: "PREPEND",
    subject: "CHEMISTRY",
    moduleNumber: "Module 01",
    chapter: "IUPAC Nomenclature",
    teacher: "Firoz Sir",
    batch: "NEET Accelerated Batch",
    targetExam: "NEET (UG)",
  });

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

  // 8. Undo / Redo History Stack
  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // 9. UI & Lifecycle States
  const [activeSidebarTab, setActiveSidebarTab] = useState<"thumbnails" | "layers" | "versions" | "diagnostics">("thumbnails");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [downloadDropdownOpen, setDownloadDropdownOpen] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [latestExportUrl, setLatestExportUrl] = useState<string | null>(null);
  const [diagnosticsData, setDiagnosticsData] = useState<{ renderTimeMs: number; loadTimeMs: number }>({ renderTimeMs: 0, loadTimeMs: 0 });

  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const isAdmin = userRole === "SUPER_ADMIN" || userRole === "ADMIN";

  // Push state to Undo/Redo stack (Stable reference with zero re-trigger loops)
  const pushHistory = useCallback(
    (newState: {
      textEdits: TextEditItem[];
      whiteouts: WhiteoutItem[];
      images: ImageEditItem[];
      shapes: ShapeEditItem[];
      globalRemovals: GlobalRemovalItem[];
      globalReplacements: GlobalReplacementItem[];
      deletedPages: number[];
      pageRotations: Record<number, number>;
    }) => {
      setHistory((prev) => {
        const nextIndex = historyIndexRef.current + 1;
        historyIndexRef.current = nextIndex;
        setHistoryIndex(nextIndex);
        const updated = prev.slice(0, nextIndex);
        return [...updated, newState].slice(-50);
      });
      setHasUnsavedChanges(true);
    },
    []
  );

  const historyIndexRef = useRef<number>(historyIndex);
  historyIndexRef.current = historyIndex;

  const handleUndo = () => {
    if (historyIndex > 0) {
      const targetState = history[historyIndex - 1];
      setTextEdits(targetState.textEdits);
      setWhiteouts(targetState.whiteouts);
      setImages(targetState.images);
      setShapes(targetState.shapes);
      setGlobalRemovals(targetState.globalRemovals || []);
      setGlobalReplacements(targetState.globalReplacements || []);
      setDeletedPages(targetState.deletedPages);
      setPageRotations(targetState.pageRotations);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const targetState = history[historyIndex + 1];
      setTextEdits(targetState.textEdits);
      setWhiteouts(targetState.whiteouts);
      setImages(targetState.images);
      setShapes(targetState.shapes);
      setGlobalRemovals(targetState.globalRemovals || []);
      setGlobalReplacements(targetState.globalReplacements || []);
      setDeletedPages(targetState.deletedPages);
      setPageRotations(targetState.pageRotations);
      setHistoryIndex(historyIndex + 1);
    }
  };

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

        // Check for existing saved version snapshot to restore full state
        const latestVersion = data.versions && data.versions.length > 0 ? data.versions[0] : null;
        const snap = latestVersion?.snapshot;

        const initTextEdits = snap?.textEdits || [];
        const initWhiteouts = snap?.whiteouts || [];
        const initImages = snap?.images || [];
        const initShapes = snap?.shapes || [];
        const initGlobalRemovals = snap?.globalRemovals || [];
        const initGlobalReplacements = snap?.globalReplacements || [];
        const initPageRotations = snap?.pageRotations || {};
        const initDeletedPages = snap?.deletedPages || [];
        const initPageOrder = snap?.pageOrder || Array.from({ length: docProxy.numPages }, (_, i) => i + 1);

        if (snap?.textEdits) setTextEdits(snap.textEdits);
        if (snap?.whiteouts) setWhiteouts(snap.whiteouts);
        if (snap?.images) setImages(snap.images);
        if (snap?.shapes) setShapes(snap.shapes);
        if (snap?.globalRemovals) setGlobalRemovals(snap.globalRemovals);
        if (snap?.globalReplacements) setGlobalReplacements(snap.globalReplacements);
        if (snap?.pageRotations) setPageRotations(snap.pageRotations);
        if (snap?.deletedPages) setDeletedPages(snap.deletedPages);
        if (snap?.pageOrder) setPageOrder(snap.pageOrder);
        if (snap?.background) setBackground(snap.background);
        if (snap?.headerFooter) setHeaderFooter(snap.headerFooter);
        if (snap?.watermark) setWatermark(snap.watermark);
        if (snap?.coverPage) setCoverPage(snap.coverPage);
        if (snap?.fileUrl) setLatestExportUrl(snap.fileUrl);

        // Auto-detect subject theme from module data if not explicitly set
        const sub = (data.subject || "").toUpperCase();
        let detectedThemeColor = "#ea580c";
        if (sub.includes("CHEM")) detectedThemeColor = "#059669";
        else if (sub.includes("PHYS")) detectedThemeColor = "#0284c7";
        else if (sub.includes("BIO")) detectedThemeColor = "#7c3aed";

        if (!snap?.headerFooter?.accentColor) {
          setHeaderFooter((prev) => ({
            ...prev,
            accentColor: detectedThemeColor,
            headerCenter: prev.headerCenter || `| ${data.subject || "NEET PREP"} - ${data.chapter || data.title || "Module"}`,
            headerRight: prev.headerRight || data.facultyName || "Firoz Sir",
          }));
        }

        setDiagnosticsData((d) => ({ ...d, loadTimeMs: Date.now() - loadStart }));
        setLoading(false);

        // Initialize history stack with restored state
        setHistory([
          {
            textEdits: initTextEdits,
            whiteouts: initWhiteouts,
            images: initImages,
            shapes: initShapes,
            globalRemovals: initGlobalRemovals,
            globalReplacements: initGlobalReplacements,
            deletedPages: initDeletedPages,
            pageRotations: initPageRotations,
          },
        ]);
        setHistoryIndex(0);
        historyIndexRef.current = 0;
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
      id: `rep-${Date.now()}-${match.pageNumber}`,
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
    pushHistory({
      textEdits: updatedEdits,
      whiteouts,
      images,
      shapes,
      globalRemovals,
      globalReplacements,
      deletedPages,
      pageRotations,
    });
    toast.success(`Replaced match on Page ${match.pageNumber}`);
  };

  const handleReplaceAllMatches = () => {
    if (searchMatches.length === 0) return;
    const newEditsToAdd: TextEditItem[] = searchMatches.map((match, idx) => {
      const newEditText = match.text.replace(new RegExp(searchQuery, "gi"), replaceQuery);
      return {
        id: `rep-all-${Date.now()}-${idx}`,
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
    pushHistory({
      textEdits: updatedEdits,
      whiteouts,
      images,
      shapes,
      globalRemovals,
      globalReplacements,
      deletedPages,
      pageRotations,
    });
    toast.success(`Replaced ${newEditsToAdd.length} occurrences across all pages!`);
    setShowSearchModal(false);
  };

  // 3. Object Removal Confirmation
  const handleConfirmRemoveObject = () => {
    if (!pendingTargetBox) return;
    if (removeScope === "current") {
      const newWo: WhiteoutItem = {
        id: `wo-${Date.now()}`,
        pageNumber: currentPage,
        x: pendingTargetBox.x,
        y: pendingTargetBox.y,
        width: pendingTargetBox.width,
        height: pendingTargetBox.height,
        color: "#ffffff",
      };
      setWhiteouts((prev) => [...prev, newWo]);
      pushHistory({
        textEdits,
        whiteouts: [...whiteouts, newWo],
        images,
        shapes,
        globalRemovals,
        globalReplacements,
        deletedPages,
        pageRotations,
      });
      toast.success(`Object removed from Page ${currentPage}`);
    } else {
      const newRemoval: GlobalRemovalItem = {
        id: `g-rem-${Date.now()}`,
        x: pendingTargetBox.x,
        y: pendingTargetBox.y,
        width: pendingTargetBox.width,
        height: pendingTargetBox.height,
        pageRange: "ALL",
      };
      setGlobalRemovals((prev) => [...prev, newRemoval]);
      pushHistory({
        textEdits,
        whiteouts,
        images,
        shapes,
        globalRemovals: [...globalRemovals, newRemoval],
        globalReplacements,
        deletedPages,
        pageRotations,
      });
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
          id: `img-${Date.now()}`,
          pageNumber: currentPage,
          x: pendingTargetBox.x,
          y: pendingTargetBox.y,
          width: pendingTargetBox.width,
          height: pendingTargetBox.height,
          base64Data: replaceImageData,
          opacity: 1,
        };
        const newWo: WhiteoutItem = {
          id: `wo-rep-${Date.now()}`,
          pageNumber: currentPage,
          x: pendingTargetBox.x,
          y: pendingTargetBox.y,
          width: pendingTargetBox.width,
          height: pendingTargetBox.height,
          color: "#ffffff",
        };
        setWhiteouts((prev) => [...prev, newWo]);
        setImages((prev) => [...prev, newImg]);
        pushHistory({
          textEdits,
          whiteouts: [...whiteouts, newWo],
          images: [...images, newImg],
          shapes,
          globalRemovals,
          globalReplacements,
          deletedPages,
          pageRotations,
        });
        toast.success(`Object replaced on Page ${currentPage}`);
      } else if (replaceType === "text" && replaceTextData) {
        const newTxt: TextEditItem = {
          id: `txt-rep-${Date.now()}`,
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
        pushHistory({
          textEdits: [...textEdits, newTxt],
          whiteouts,
          images,
          shapes,
          globalRemovals,
          globalReplacements,
          deletedPages,
          pageRotations,
        });
        toast.success(`Object replaced with text on Page ${currentPage}`);
      }
    } else {
      const newRep: GlobalReplacementItem = {
        id: `g-rep-${Date.now()}`,
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
      pushHistory({
        textEdits,
        whiteouts,
        images,
        shapes,
        globalRemovals,
        globalReplacements: [...globalReplacements, newRep],
        deletedPages,
        pageRotations,
      });
      toast.success(`Object replaced across entire PDF (${totalPages} pages)`);
    }
    setShowReplaceModal(false);
    setPendingTargetBox(null);
  };

  // 5. Save Document Handler (with In-Place Native PDF Engine)
  const handleSaveDocument = async (isAutosave = false): Promise<string | null> => {
    try {
      setSaveStatus("saving");
      const res = await fetch(`/api/team/modules/${moduleId}/save-native`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textEdits,
          whiteouts,
          images,
          shapes,
          globalRemovals,
          globalReplacements,
          background,
          pageRotations,
          deletedPages,
          pageOrder,
          headerFooter,
          watermark,
          coverPage,
          changeSummary: `Revision saved with ${textEdits.length} edits, ${images.length} images, ${globalRemovals.length} removals`,
          isAutosave,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Save failed with HTTP ${res.status}`);
      }

      const result = await res.json();
      const returnedFileUrl = result.data?.fileUrl || null;
      if (returnedFileUrl) {
        setLatestExportUrl(returnedFileUrl);
      }

      setSaveStatus("saved");
      setHasUnsavedChanges(false);

      if (!isAutosave) {
        toast.success("Document saved successfully! New revision created.");
        setModuleData((prev) =>
          prev
            ? {
                ...prev,
                pageCount: result.data.pageCount,
                versions: [
                  {
                    id: result.data.versionId,
                    label: `Revision #${(prev.versions?.length || 0) + 1}`,
                    createdAt: new Date().toISOString(),
                    snapshot: {
                      textEditsCount: textEdits.length,
                      pageCount: result.data.pageCount,
                      fileUrl: returnedFileUrl,
                    },
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
    a.href = url;
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
      if (hasUnsavedChanges || !fileUrl) {
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

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S / Cmd+S
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveDocument(false);
      }
      // Ctrl+E / Cmd+E -> Export & Download
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        handleExportAndDownload();
      }
      // Ctrl+P / Cmd+P -> Print
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        handlePrintDocument();
      }
      // Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl+Y or Ctrl+Shift+Z
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z")) {
        e.preventDefault();
        handleRedo();
      }
      // Ctrl+F or Ctrl+H for Search & Replace
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "f" || e.key.toLowerCase() === "h")) {
        e.preventDefault();
        setShowSearchModal(true);
      }
      // Tool shortcuts (when not typing in an input/textarea)
      if (document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        if (e.key.toLowerCase() === "t") setActiveTool("EDIT_TEXT");
        if (e.key.toLowerCase() === "v") setActiveTool("SELECT");
        if (e.key.toLowerCase() === "h") setActiveTool("HAND");
        if (e.key.toLowerCase() === "w") setActiveTool("WHITEOUT");
        if (e.key.toLowerCase() === "a") setActiveTool("ADD_TEXT");
        if (e.key === "Delete" || e.key === "Backspace") {
          if (selectedObjectId) {
            e.preventDefault();
            handleDeleteSelectedObject();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedObjectId, historyIndex, history, textEdits, whiteouts, images, shapes, globalRemovals, globalReplacements, latestExportUrl, hasUnsavedChanges, moduleData]);

  // Delete Active Selected Object
  const handleDeleteSelectedObject = () => {
    if (!selectedObjectId) return;
    setTextEdits((prev) => prev.filter((t) => t.id !== selectedObjectId));
    setWhiteouts((prev) => prev.filter((w) => w.id !== selectedObjectId));
    setImages((prev) => prev.filter((img) => img.id !== selectedObjectId));
    setShapes((prev) => prev.filter((s) => s.id !== selectedObjectId));
    setSelectedObjectId(null);
    setSelectedObjectType(null);
    pushHistory({
      textEdits: textEdits.filter((t) => t.id !== selectedObjectId),
      whiteouts: whiteouts.filter((w) => w.id !== selectedObjectId),
      images: images.filter((img) => img.id !== selectedObjectId),
      shapes: shapes.filter((s) => s.id !== selectedObjectId),
      globalRemovals,
      globalReplacements,
      deletedPages,
      pageRotations,
    });
  };

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
    setHasUnsavedChanges(true);

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
  const selectedShapeObj = useMemo(() => shapes.find((s) => s.id === selectedObjectId), [shapes, selectedObjectId]);

  return (
    <div
      onClick={() => setActiveMenu(null)}
      className="flex flex-col h-[calc(100vh-68px)] bg-slate-950 text-slate-100 font-sans select-none overflow-hidden"
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
            {/* Autosave / Save Status Indicator */}
            <div className="flex items-center gap-1.5 text-[11px]">
              {saveStatus === "saving" && (
                <span className="text-amber-400 flex items-center gap-1 font-semibold">
                  <span className="material-symbols-outlined text-xs animate-spin">sync</span>
                  Saving...
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                  <span className="material-symbols-outlined text-xs">check_circle</span>
                  Saved ✓
                </span>
              )}
              {saveStatus === "error" && (
                <span className="text-red-400 flex items-center gap-1 font-semibold">
                  <span className="material-symbols-outlined text-xs">error</span>
                  Save Failed
                </span>
              )}
              {saveStatus === "idle" && hasUnsavedChanges && (
                <span className="text-slate-400 flex items-center gap-1 font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  Unsaved Changes
                </span>
              )}
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
              title="Whiteout / Mask Unwanted Region (W)"
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
                        id: `img-${Date.now()}`,
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
                      pushHistory({
                        textEdits,
                        whiteouts,
                        images: [...images, newImg],
                        shapes,
                        globalRemovals,
                        globalReplacements,
                        deletedPages,
                        pageRotations,
                      });
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
                disabled={historyIndex <= 0}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30"
                title="Undo (Ctrl+Z)"
              >
                <span className="material-symbols-outlined text-base">undo</span>
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
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
            <div className="flex items-center gap-1.5 bg-slate-950/60 px-2 py-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => handleSelectPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="text-slate-400 hover:text-white disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              <span className="font-semibold text-slate-300">
                {currentPage} / {totalPages || 1}
              </span>
              <button
                type="button"
                onClick={() => handleSelectPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
                className="text-slate-400 hover:text-white disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))))}
                className="p-1 text-slate-400 hover:text-white"
                title="Zoom Out"
              >
                <span className="material-symbols-outlined text-sm">remove</span>
              </button>
              <span className="font-bold w-12 text-center text-slate-300">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.15).toFixed(2))))}
                className="p-1 text-slate-400 hover:text-white"
                title="Zoom In"
              >
                <span className="material-symbols-outlined text-sm">add</span>
              </button>
              <button
                type="button"
                onClick={() => setZoom(1.0)}
                className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-400 hover:text-white"
              >
                100%
              </button>
            </div>
          </div>
        </div>
      </header>

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
            {/* THUMBNAILS TAB */}
            {activeSidebarTab === "thumbnails" && (
              <div className="space-y-3">
                {pageOrder.map((pNum, idx) => {
                  const isDeleted = deletedPages.includes(pNum);
                  const isCurrent = currentPage === pNum;

                  return (
                    <div
                      key={pNum}
                      onClick={() => !isDeleted && handleSelectPage(pNum)}
                      className={`p-2.5 rounded-2xl border transition-all cursor-pointer relative ${
                        isCurrent
                          ? "border-orange-500 bg-orange-500/10 shadow-md"
                          : isDeleted
                          ? "border-red-900/40 bg-red-950/20 opacity-50"
                          : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5 text-[11px]">
                        <span className="font-bold text-slate-300">Page {idx + 1}</span>
                        <div className="flex items-center gap-1">
                          {/* Rotate Page Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPageRotations((prev) => ({
                                ...prev,
                                [pNum]: ((prev[pNum] || 0) + 90) % 360,
                              }));
                              setHasUnsavedChanges(true);
                            }}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                            title="Rotate 90° CW"
                          >
                            <span className="material-symbols-outlined text-xs">rotate_right</span>
                          </button>

                          {/* Delete Page Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isDeleted) {
                                setDeletedPages((prev) => prev.filter((p) => p !== pNum));
                              } else {
                                setDeletedPages((prev) => [...prev, pNum]);
                              }
                              setHasUnsavedChanges(true);
                            }}
                            className={`p-1 rounded hover:bg-slate-800 ${
                              isDeleted ? "text-emerald-400" : "text-red-400 hover:text-red-300"
                            }`}
                            title={isDeleted ? "Restore Page" : "Delete Page"}
                          >
                            <span className="material-symbols-outlined text-xs">
                              {isDeleted ? "restore" : "delete"}
                            </span>
                          </button>
                        </div>
                      </div>

                      <div className="w-full aspect-[1/1.414] bg-white/5 rounded-lg border border-slate-800/80 flex items-center justify-center text-slate-500 text-xs">
                        {isDeleted ? (
                          <span className="text-red-400 font-bold">Deleted</span>
                        ) : (
                          <span>Page {idx + 1}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* LAYERS & EDITS TAB */}
            {activeSidebarTab === "layers" && (
              <div className="space-y-2 text-xs">
                <h4 className="font-bold text-slate-400 uppercase text-[10px] tracking-wider mb-2">
                  Edits on Page {currentPage}
                </h4>

                {/* Global Removals / Replacements */}
                {globalRemovals.length > 0 && (
                  <div className="p-2 rounded-xl border border-red-800/50 bg-red-950/20 text-red-300">
                    <span className="font-bold">Global Removals:</span> {globalRemovals.length} active
                  </div>
                )}
                {globalReplacements.length > 0 && (
                  <div className="p-2 rounded-xl border border-cyan-800/50 bg-cyan-950/20 text-cyan-300">
                    <span className="font-bold">Global Replacements:</span> {globalReplacements.length} active
                  </div>
                )}

                {/* Text Edits */}
                {textEdits
                  .filter((t) => t.pageNumber === currentPage)
                  .map((t) => (
                    <div
                      key={t.id}
                      onClick={() => {
                        setSelectedObjectId(t.id);
                        setSelectedObjectType("text");
                      }}
                      className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer ${
                        selectedObjectId === t.id ? "border-emerald-500 bg-emerald-500/10" : "border-slate-800 bg-slate-950/40"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="material-symbols-outlined text-emerald-400 text-sm">edit_note</span>
                        <span className="truncate">{t.newText || "(Empty Text)"}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTextEdits((prev) => prev.filter((item) => item.id !== t.id));
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        <span className="material-symbols-outlined text-xs">delete</span>
                      </button>
                    </div>
                  ))}

                {/* Whiteouts */}
                {whiteouts
                  .filter((w) => w.pageNumber === currentPage)
                  .map((w) => (
                    <div
                      key={w.id}
                      onClick={() => {
                        setSelectedObjectId(w.id);
                        setSelectedObjectType("whiteout");
                      }}
                      className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer ${
                        selectedObjectId === w.id ? "border-red-500 bg-red-500/10" : "border-slate-800 bg-slate-950/40"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-red-400 text-sm">ink_eraser</span>
                        <span>Whiteout ({Math.round(w.width)}x{Math.round(w.height)})</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setWhiteouts((prev) => prev.filter((item) => item.id !== w.id));
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        <span className="material-symbols-outlined text-xs">delete</span>
                      </button>
                    </div>
                  ))}

                {/* Images */}
                {images
                  .filter((img) => img.pageNumber === currentPage)
                  .map((img) => (
                    <div
                      key={img.id}
                      onClick={() => {
                        setSelectedObjectId(img.id);
                        setSelectedObjectType("image");
                      }}
                      className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer ${
                        selectedObjectId === img.id ? "border-indigo-500 bg-indigo-500/10" : "border-slate-800 bg-slate-950/40"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-indigo-400 text-sm">image</span>
                        <span>Image ({Math.round(img.width)}x{Math.round(img.height)})</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImages((prev) => prev.filter((item) => item.id !== img.id));
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        <span className="material-symbols-outlined text-xs">delete</span>
                      </button>
                    </div>
                  ))}
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
                    {moduleData?.versions?.length || 0} saved
                  </span>
                </div>
                {moduleData?.versions && moduleData.versions.length > 0 ? (
                  moduleData.versions.map((v) => (
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
                                `${(moduleData.code || "Module")}_${v.label.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`
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
          ) : viewMode === "continuous" ? (
            <div className="space-y-8 flex flex-col items-center w-full pb-16">
              {pageOrder
                .filter((p) => !deletedPages.includes(p))
                .map((pNum) => (
                  <div
                    key={pNum}
                    id={`pdf-page-${pNum}`}
                    data-page={pNum}
                    className="flex flex-col items-center relative"
                  >
                    <div className="text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                        Page {pNum} of {totalPages}
                      </span>
                    </div>
                    <NativePdfPageView
                      pdfDocProxy={pdfDocProxy}
                      pageNumber={pNum}
                      totalPages={totalPages}
                      zoom={zoom}
                      rotation={pageRotations[pNum] || 0}
                      activeTool={activeTool}
                      textEdits={textEdits.filter((t) => t.pageNumber === pNum)}
                      whiteouts={whiteouts.filter((w) => w.pageNumber === pNum)}
                      images={images.filter((img) => img.pageNumber === pNum)}
                      shapes={shapes.filter((s) => s.pageNumber === pNum)}
                      globalRemovals={globalRemovals}
                      globalReplacements={globalReplacements}
                      selectedObjectId={selectedObjectId}
                      onSelectObject={(id, type) => {
                        setSelectedObjectId(id);
                        setSelectedObjectType(type);
                        setCurrentPage(pNum);
                      }}
                      onAddTextEdit={(newEdit) => {
                        setTextEdits((prev) => [...prev, newEdit]);
                        setSelectedObjectId(newEdit.id);
                        setSelectedObjectType("text");
                        setCurrentPage(pNum);
                        pushHistory({
                          textEdits: [...textEdits, newEdit],
                          whiteouts,
                          images,
                          shapes,
                          globalRemovals,
                          globalReplacements,
                          deletedPages,
                          pageRotations,
                        });
                      }}
                      onUpdateTextEdit={(updated) => {
                        setTextEdits((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
                        setHasUnsavedChanges(true);
                      }}
                      onUpdateImage={(updated) => {
                        setImages((prev) => prev.map((img) => (img.id === updated.id ? updated : img)));
                        setHasUnsavedChanges(true);
                      }}
                      onAddWhiteout={(newWhiteout) => {
                        setWhiteouts((prev) => [...prev, newWhiteout]);
                        setSelectedObjectId(newWhiteout.id);
                        setSelectedObjectType("whiteout");
                        setCurrentPage(pNum);
                        pushHistory({
                          textEdits,
                          whiteouts: [...whiteouts, newWhiteout],
                          images,
                          shapes,
                          globalRemovals,
                          globalReplacements,
                          deletedPages,
                          pageRotations,
                        });
                      }}
                      onTargetBoxSelected={(box) => {
                        setPendingTargetBox(box);
                        setCurrentPage(pNum);
                        if (activeTool === "REMOVE_OBJECT") {
                          setShowRemoveModal(true);
                        } else if (activeTool === "REPLACE_OBJECT") {
                          setShowReplaceModal(true);
                        }
                      }}
                      headerFooter={headerFooter}
                      watermark={watermark}
                      background={background}
                      coverPage={coverPage}
                      moduleData={moduleData}
                    />
                  </div>
                ))}
            </div>
          ) : (
            <div className="space-y-8 flex flex-col items-center">
              <NativePdfPageView
                pdfDocProxy={pdfDocProxy}
                pageNumber={currentPage}
                totalPages={totalPages}
                zoom={zoom}
                rotation={pageRotations[currentPage] || 0}
                activeTool={activeTool}
                textEdits={textEdits.filter((t) => t.pageNumber === currentPage)}
                whiteouts={whiteouts.filter((w) => w.pageNumber === currentPage)}
                images={images.filter((img) => img.pageNumber === currentPage)}
                shapes={shapes.filter((s) => s.pageNumber === currentPage)}
                globalRemovals={globalRemovals}
                globalReplacements={globalReplacements}
                selectedObjectId={selectedObjectId}
                onSelectObject={(id, type) => {
                  setSelectedObjectId(id);
                  setSelectedObjectType(type);
                }}
                onAddTextEdit={(newEdit) => {
                  setTextEdits((prev) => [...prev, newEdit]);
                  setSelectedObjectId(newEdit.id);
                  setSelectedObjectType("text");
                  pushHistory({
                    textEdits: [...textEdits, newEdit],
                    whiteouts,
                    images,
                    shapes,
                    globalRemovals,
                    globalReplacements,
                    deletedPages,
                    pageRotations,
                  });
                }}
                onUpdateTextEdit={(updated) => {
                  setTextEdits((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
                  setHasUnsavedChanges(true);
                }}
                onUpdateImage={(updated) => {
                  setImages((prev) => prev.map((img) => (img.id === updated.id ? updated : img)));
                  setHasUnsavedChanges(true);
                }}
                onAddWhiteout={(newWhiteout) => {
                  setWhiteouts((prev) => [...prev, newWhiteout]);
                  setSelectedObjectId(newWhiteout.id);
                  setSelectedObjectType("whiteout");
                  pushHistory({
                    textEdits,
                    whiteouts: [...whiteouts, newWhiteout],
                    images,
                    shapes,
                    globalRemovals,
                    globalReplacements,
                    deletedPages,
                    pageRotations,
                  });
                }}
                onTargetBoxSelected={(box) => {
                  setPendingTargetBox(box);
                  if (activeTool === "REMOVE_OBJECT") {
                    setShowRemoveModal(true);
                  } else if (activeTool === "REPLACE_OBJECT") {
                    setShowReplaceModal(true);
                  }
                }}
                headerFooter={headerFooter}
                watermark={watermark}
                background={background}
                coverPage={coverPage}
                moduleData={moduleData}
              />
            </div>
          )}
        </main>

        {/* RIGHT PROPERTIES PANEL: Selected Object Styling */}
        <aside className="w-72 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0 z-20 overflow-y-auto p-4 space-y-4 text-xs">
          <h3 className="font-bold text-slate-300 text-sm flex items-center gap-2 border-b border-slate-800 pb-2">
            <span className="material-symbols-outlined text-orange-500">tune</span>
            <span>Object Properties</span>
          </h3>

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
                    setHasUnsavedChanges(true);
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
                      setHasUnsavedChanges(true);
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
                      setHasUnsavedChanges(true);
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
                      setHasUnsavedChanges(true);
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
                      setHasUnsavedChanges(true);
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
                      setHasUnsavedChanges(true);
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
                      setHasUnsavedChanges(true);
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
                Solid vector mask permanently covers underlying content in the final PDF.
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
                      setHasUnsavedChanges(true);
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
                      setHasUnsavedChanges(true);
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
                      setHasUnsavedChanges(true);
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
                      setHasUnsavedChanges(true);
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
                    setHasUnsavedChanges(true);
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
                    setHasUnsavedChanges(true);
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
                        setHasUnsavedChanges(true);
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

          {!selectedTextObj && !selectedWhiteoutObj && !selectedImageObj && (
            <div className="text-center py-8 text-slate-500 space-y-2">
              <span className="material-symbols-outlined text-3xl opacity-40">touch_app</span>
              <p>Select any text snippet, whiteout, or image on the canvas to inspect and edit its properties.</p>
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
                  setHasUnsavedChanges(true);
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
                  setHasUnsavedChanges(true);
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
                  setHasUnsavedChanges(true);
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
                  setHasUnsavedChanges(true);
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

// Helper function to check if a page is in the active range
function isPageInRange(
  pageNumber: number,
  range?: "ALL" | "ODD" | "EVEN" | "CUSTOM",
  customPages?: number[],
  excludeFirstPage?: boolean
): boolean {
  if (excludeFirstPage && pageNumber === 1) return false;
  if (!range || range === "ALL") return true;
  if (range === "ODD") return pageNumber % 2 !== 0;
  if (range === "EVEN") return pageNumber % 2 === 0;
  if (range === "CUSTOM") {
    return Array.isArray(customPages) && customPages.includes(pageNumber);
  }
  return true;
}

// Helper function to interpolate header/footer template variables
function replaceVariables(
  template: string,
  vars: {
    page: number;
    totalPages: number;
    subject: string;
    chapter: string;
    teacher: string;
    date: string;
    moduleNumber: string;
  }
): string {
  let res = template;
  res = res.replace(/\{page\}/gi, String(vars.page));
  res = res.replace(/\{totalPages\}/gi, String(vars.totalPages));
  res = res.replace(/\{subject\}/gi, vars.subject);
  res = res.replace(/\{chapter\}/gi, vars.chapter);
  res = res.replace(/\{teacher\}/gi, vars.teacher);
  res = res.replace(/\{date\}/gi, vars.date);
  res = res.replace(/\{moduleNumber\}/gi, vars.moduleNumber);
  return res;
}

/**
 * High-Resolution Native PDF Page View with Interactive In-Place Edit Overlays,
 * Live Running Header & Footer, Watermark, Subject Theme, and Front Page Previews
 */
interface NativePdfPageViewProps {
  pdfDocProxy: any;
  pageNumber: number;
  totalPages: number;
  zoom: number;
  rotation: number;
  activeTool: EditorTool;
  textEdits: TextEditItem[];
  whiteouts: WhiteoutItem[];
  images: ImageEditItem[];
  shapes: ShapeEditItem[];
  globalRemovals: GlobalRemovalItem[];
  globalReplacements: GlobalReplacementItem[];
  selectedObjectId: string | null;
  onSelectObject: (id: string, type: "text" | "whiteout" | "image" | "shape") => void;
  onAddTextEdit: (edit: TextEditItem) => void;
  onUpdateTextEdit: (edit: TextEditItem) => void;
  onUpdateImage: (edit: ImageEditItem) => void;
  onAddWhiteout: (whiteout: WhiteoutItem) => void;
  onTargetBoxSelected: (box: { x: number; y: number; width: number; height: number }) => void;
  headerFooter?: HeaderFooterConfig;
  watermark?: WatermarkConfig;
  background?: BackgroundConfig;
  coverPage?: CoverPageConfig;
  moduleData?: ModuleData | null;
}

function NativePdfPageView({
  pdfDocProxy,
  pageNumber,
  totalPages,
  zoom,
  rotation,
  activeTool,
  textEdits,
  whiteouts,
  images,
  shapes,
  globalRemovals,
  globalReplacements,
  selectedObjectId,
  onSelectObject,
  onAddTextEdit,
  onUpdateTextEdit,
  onUpdateImage,
  onAddWhiteout,
  onTargetBoxSelected,
  headerFooter,
  watermark,
  background,
  coverPage,
  moduleData,
}: NativePdfPageViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [pageSize, setPageSize] = useState<{ width: number; height: number }>({ width: 595, height: 842 });
  const [textSpans, setTextSpans] = useState<
    Array<{ text: string; x: number; y: number; width: number; height: number; fontSize: number }>
  >([]);
  const [isSelectingBox, setIsSelectingBox] = useState<boolean>(false);
  const [drawBox, setDrawBox] = useState<{ startX: number; startY: number; currX: number; currY: number } | null>(null);
  const [resizingImgId, setResizingImgId] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ startW: number; startH: number; startX: number; startY: number } | null>(null);

  // Render PDF.js Canvas on Page Change or Zoom Change
  useEffect(() => {
    let isCancelled = false;
    let renderTask: any = null;

    async function renderPage() {
      if (!pdfDocProxy || pageNumber < 1 || pageNumber > pdfDocProxy.numPages) return;

      try {
        const page = await pdfDocProxy.getPage(pageNumber);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale: zoom * 1.5, rotation });
        setPageSize({ width: viewport.width / (zoom * 1.5), height: viewport.height / (zoom * 1.5) });

        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.width = `${viewport.width / 1.5}px`;
            canvas.style.height = `${viewport.height / 1.5}px`;

            const renderContext = {
              canvasContext: ctx,
              viewport,
            };
            renderTask = page.render(renderContext);
            await renderTask.promise;
          }
        }

        if (isCancelled) return;

        // Extract Text Geometry Spans for Direct In-Place Text Editing
        const textContent = await page.getTextContent();
        if (isCancelled) return;

        const spans: Array<{ text: string; x: number; y: number; width: number; height: number; fontSize: number }> = [];
        for (const item of textContent.items as any[]) {
          if (item.str && item.str.trim().length > 0) {
            const tx = item.transform;
            const x = tx[4];
            const y = viewport.height / (zoom * 1.5) - tx[5] - (item.height || item.fontSize || 12);
            spans.push({
              text: item.str,
              x: Math.max(0, x),
              y: Math.max(0, y),
              width: item.width || item.str.length * 6,
              height: item.height || item.fontSize || 12,
              fontSize: item.fontSize || 10,
            });
          }
        }
        setTextSpans(spans);
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.warn("[NativePdfPageView] Render error:", err);
        }
      }
    }

    renderPage();
    return () => {
      isCancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {}
      }
    };
  }, [pdfDocProxy, pageNumber, zoom, rotation]);

  // Handle Dragging / Box Selection for Whiteout, Add Text, Remove Object, Replace Object
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (resizingImgId) return;

    if (
      activeTool !== "WHITEOUT" &&
      activeTool !== "ADD_TEXT" &&
      activeTool !== "REMOVE_OBJECT" &&
      activeTool !== "REPLACE_OBJECT"
    )
      return;
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;

    const scale = zoom;
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    setIsSelectingBox(true);
    setDrawBox({ startX: x, startY: y, currX: x, currY: y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scale = zoom;

    // Handle Image Corner Resize
    if (resizingImgId && resizeStart) {
      const currX = (e.clientX - rect.left) / scale;
      const currY = (e.clientY - rect.top) / scale;
      const deltaX = currX - resizeStart.startX;
      const deltaY = currY - resizeStart.startY;
      const newWidth = Math.max(20, resizeStart.startW + deltaX);
      const newHeight = Math.max(20, resizeStart.startH + deltaY);

      const targetImg = images.find((img) => img.id === resizingImgId);
      if (targetImg) {
        onUpdateImage({ ...targetImg, width: newWidth, height: newHeight });
      }
      return;
    }

    if (!isSelectingBox || !drawBox) return;
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    setDrawBox((prev) => (prev ? { ...prev, currX: x, currY: y } : null));
  };

  const handleMouseUp = () => {
    if (resizingImgId) {
      setResizingImgId(null);
      setResizeStart(null);
      return;
    }

    if (!isSelectingBox || !drawBox) return;
    setIsSelectingBox(false);

    const x = Math.min(drawBox.startX, drawBox.currX);
    const y = Math.min(drawBox.startY, drawBox.currY);
    const width = Math.max(10, Math.abs(drawBox.currX - drawBox.startX));
    const height = Math.max(10, Math.abs(drawBox.currY - drawBox.startY));

    if (activeTool === "WHITEOUT") {
      onAddWhiteout({
        id: `wo-${Date.now()}`,
        pageNumber,
        x,
        y,
        width,
        height,
        color: "#ffffff",
      });
      toast.success("Whiteout mask applied");
    } else if (activeTool === "ADD_TEXT") {
      onAddTextEdit({
        id: `txt-${Date.now()}`,
        pageNumber,
        x,
        y,
        width: Math.max(120, width),
        height: Math.max(24, height),
        newText: "Double-click to type text",
        fontSize: 12,
        fontFamily: "helvetica",
        color: "#000000",
        hideOriginal: false,
      });
    } else if (activeTool === "REMOVE_OBJECT" || activeTool === "REPLACE_OBJECT") {
      onTargetBoxSelected({ x, y, width, height });
    }

    setDrawBox(null);
  };

  const scale = zoom;

  // Variables interpolation dictionary
  const vars = {
    page: pageNumber,
    totalPages: totalPages || 1,
    subject: coverPage?.subject || moduleData?.subject || "NEET PREP",
    chapter: coverPage?.chapter || moduleData?.chapter || moduleData?.title || "Academic Module",
    teacher: coverPage?.teacher || moduleData?.facultyName || "Firoz Sir",
    date: new Date().toLocaleDateString("en-IN"),
    moduleNumber: coverPage?.moduleNumber || moduleData?.code || "Module 01",
  };

  const isCoverActive =
    coverPage?.enabled &&
    pageNumber === 1 &&
    (coverPage.action === "REPLACE_FIRST" || coverPage.action === "PREPEND");

  const showHeader =
    headerFooter?.enabled &&
    isPageInRange(pageNumber, headerFooter.pageRange, headerFooter.customPages, headerFooter.excludeFirstPage);

  const showWatermark =
    watermark?.enabled &&
    isPageInRange(pageNumber, watermark.pageRange, watermark.customPages, watermark.excludeFirstPage);

  const showBackground =
    background?.enabled &&
    isPageInRange(pageNumber, background.pageRange, background.customPages);

  const headerAccent = headerFooter?.accentColor || "#ea580c";
  const headerHeightPt = headerFooter?.headerImageHeight || 36;
  const footerHeightPt = headerFooter?.footerImageHeight || 24;

  return (
    <div
      className="relative shadow-2xl border border-slate-800 bg-white select-none transition-transform"
      style={{
        width: `${pageSize.width * scale}px`,
        height: `${pageSize.height * scale}px`,
      }}
    >
      {/* 0. Subject Background Theme Tint Layer */}
      {showBackground && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundColor: background?.color || "#ffffff",
            opacity: background?.opacity ?? 0.85,
            mixBlendMode: "multiply",
            zIndex: 5,
          }}
        >
          {background?.base64Data && (
            <img
              src={background.base64Data}
              alt="Page Background Pattern"
              className="w-full h-full object-cover pointer-events-none opacity-20"
            />
          )}
        </div>
      )}

      {/* 1. Underlying High-Res PDF.js Render Canvas */}
      {!isCoverActive && (
        <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-[2]" />
      )}

      {/* 2. ATOMIC PATHSHALA FRONT PAGE LIVE PREVIEW (if page 1 and cover active) */}
      {isCoverActive && (
        <div
          className="absolute inset-0 z-20 flex flex-col justify-between p-8 text-white select-none pointer-events-none overflow-hidden"
          style={{
            background:
              coverPage?.subject === "CHEMISTRY"
                ? "linear-gradient(145deg, #064e3b 0%, #022c22 60%, #065f46 100%)"
                : coverPage?.subject === "PHYSICS"
                ? "linear-gradient(145deg, #0c4a6e 0%, #082f49 60%, #0369a1 100%)"
                : coverPage?.subject === "BIOLOGY"
                ? "linear-gradient(145deg, #4a044e 0%, #2e1065 60%, #6b21a8 100%)"
                : "linear-gradient(145deg, #7c2d12 0%, #431407 60%, #9a3412 100%)",
          }}
        >
          {/* Top Branding Banner */}
          <div className="flex items-center justify-between border-b border-white/20 pb-4">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-wider text-white">ATOMIC PATHSHALA</span>
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-bold tracking-widest uppercase border border-white/20">
                Academy
              </span>
            </div>
            <div className="px-3 py-1 rounded-full bg-white/15 text-xs font-bold tracking-wide uppercase backdrop-blur-sm">
              {coverPage?.targetExam || "NEET (UG)"} Accelerator
            </div>
          </div>

          {/* Center Title Hero */}
          <div className="space-y-4 my-auto">
            <div className="inline-block px-3.5 py-1 rounded-lg bg-white/20 text-xs font-extrabold tracking-widest uppercase text-white shadow-sm">
              {coverPage?.subject || "CHEMISTRY"} • {coverPage?.moduleNumber || "MODULE 01"}
            </div>
            <h1 className="text-3xl font-black tracking-tight leading-tight max-w-lg text-white drop-shadow-md">
              {coverPage?.chapter || "Academic Chapter Title"}
            </h1>
            <p className="text-xs text-white/80 font-medium">Comprehensive NEET Theory, Solved Examples &amp; Question Bank</p>
          </div>

          {/* Bottom Faculty & Batch Card */}
          <div className="border-t border-white/20 pt-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-white/60 uppercase font-bold tracking-wider">Course Faculty</div>
              <div className="text-sm font-bold text-white">{coverPage?.teacher || "Firoz Sir"}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-white/60 uppercase font-bold tracking-wider">Target Academic Batch</div>
              <div className="text-xs font-bold text-white">{coverPage?.batch || "NEET Accelerated Batch"}</div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Old Header / Footer Masking Layers */}
      {headerFooter?.removeOldHeader && isPageInRange(pageNumber, headerFooter.pageRange, headerFooter.customPages, headerFooter.excludeFirstPage) && (
        <div
          className="absolute top-0 left-0 right-0 bg-white z-10 pointer-events-none"
          style={{ height: `${((headerFooter.oldHeaderHeightPt || 42) + (headerFooter.headerTopOffsetPt || 0)) * scale}px` }}
        />
      )}
      {headerFooter?.removeOldFooter && isPageInRange(pageNumber, headerFooter.pageRange, headerFooter.customPages, headerFooter.excludeFirstPage) && (
        <div
          className="absolute bottom-0 left-0 right-0 bg-white z-10 pointer-events-none"
          style={{ height: `${((headerFooter.oldFooterHeightPt || 32) + (headerFooter.footerBottomOffsetPt || 0)) * scale}px` }}
        />
      )}

      {/* 4. RUNNING HEADER LIVE PREVIEW */}
      {showHeader && !isCoverActive && (
        <div
          className="absolute left-0 right-0 bg-white z-15 flex items-center justify-between px-4 border-b pointer-events-none"
          style={{
            top: `${(headerFooter?.headerTopOffsetPt || 0) * scale}px`,
            height: `${headerHeightPt * scale}px`,
            borderBottomColor: headerAccent,
            borderBottomWidth: `${2.5 * scale}px`,
            zIndex: 15,
          }}
        >
          {headerFooter?.headerImageBase64 ? (
            <img
              src={headerFooter.headerImageBase64}
              alt="Header Logo"
              className="h-[80%] object-contain"
            />
          ) : (
            <span
              className="font-bold uppercase tracking-wider"
              style={{ color: headerAccent, fontSize: `${(headerFooter?.fontSize || 9) * scale}px` }}
            >
              {replaceVariables(headerFooter?.headerLeft || "ATOMIC PATHSHALA", vars)}
            </span>
          )}

          <span
            className="text-slate-800 font-semibold truncate px-2"
            style={{ fontSize: `${((headerFooter?.fontSize || 9) - 0.5) * scale}px` }}
          >
            {replaceVariables(headerFooter?.headerCenter || "| {subject} - {chapter}", vars)}
          </span>

          <span
            className="text-slate-500 font-medium truncate"
            style={{ fontSize: `${((headerFooter?.fontSize || 9) - 1) * scale}px` }}
          >
            {replaceVariables(headerFooter?.headerRight || "{teacher}", vars)}
          </span>
        </div>
      )}

      {/* 5. RUNNING FOOTER LIVE PREVIEW */}
      {showHeader && !isCoverActive && (
        <div
          className="absolute left-0 right-0 bg-white z-15 flex items-center justify-between px-4 border-t border-slate-200 pointer-events-none"
          style={{
            bottom: `${(headerFooter?.footerBottomOffsetPt || 0) * scale}px`,
            height: `${footerHeightPt * scale}px`,
            zIndex: 15,
          }}
        >
          <span className="text-slate-500 font-medium" style={{ fontSize: `${7.5 * scale}px` }}>
            {replaceVariables(headerFooter?.footerLeft || "Atomic Pathshala | NEET Accelerator", vars)}
          </span>
          <span
            className="font-bold uppercase"
            style={{ color: headerAccent, fontSize: `${8 * scale}px` }}
          >
            {replaceVariables(headerFooter?.footerRight || "Page {page} of {totalPages}", vars)}
          </span>
        </div>
      )}

      {/* 6. WATERMARK LIVE OVERLAY */}
      {showWatermark && !isCoverActive && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden"
          style={{ zIndex: 12 }}
        >
          {watermark?.type === "image" && (watermark.base64Data || watermark.imageUrl) ? (
            <img
              src={watermark.base64Data || watermark.imageUrl}
              alt="Watermark Overlay"
              className="pointer-events-none select-none"
              style={{
                width: `${(watermark.imageWidth || 320) * scale}px`,
                opacity: watermark.opacity ?? 0.08,
                transform: `rotate(${watermark.rotation ?? -30}deg)`,
                transformOrigin: "center",
              }}
            />
          ) : (
            <div
              className="font-black uppercase tracking-widest text-center select-none"
              style={{
                fontSize: `${(watermark?.fontSize || 38) * scale}px`,
                color: watermark?.color || "#000000",
                opacity: watermark?.opacity ?? 0.08,
                transform: `rotate(${watermark?.rotation ?? -30}deg)`,
                whiteSpace: "nowrap",
              }}
            >
              {watermark?.text || "ATOMIC PATHSHALA"}
            </div>
          )}
        </div>
      )}

      {/* 7. Interactive Editing Overlay (Text, Whiteouts, Images, Global Masks) */}
      <div
        ref={overlayRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className={`absolute inset-0 overflow-hidden z-20 ${
          activeTool === "WHITEOUT" ||
          activeTool === "ADD_TEXT" ||
          activeTool === "REMOVE_OBJECT" ||
          activeTool === "REPLACE_OBJECT"
            ? "cursor-crosshair"
            : "cursor-default"
        }`}
      >
        {/* Draw Temporary Selection Box during drag */}
        {drawBox && (
          <div
            className={`absolute border-2 ${
              activeTool === "WHITEOUT" || activeTool === "REMOVE_OBJECT"
                ? "bg-red-500/20 border-red-500"
                : activeTool === "REPLACE_OBJECT"
                ? "bg-cyan-500/20 border-cyan-500"
                : "bg-blue-500/20 border-blue-500"
            }`}
            style={{
              left: `${Math.min(drawBox.startX, drawBox.currX) * scale}px`,
              top: `${Math.min(drawBox.startY, drawBox.currY) * scale}px`,
              width: `${Math.abs(drawBox.currX - drawBox.startX) * scale}px`,
              height: `${Math.abs(drawBox.currY - drawBox.startY) * scale}px`,
              zIndex: 50,
            }}
          />
        )}

        {/* Global Removals Masks (Solid 100% Opaque Pure Whiteout without red outlines) */}
        {globalRemovals.map((g) => (
          <div
            key={g.id}
            className="absolute bg-white pointer-events-none z-10"
            style={{
              left: `${g.x * scale}px`,
              top: `${g.y * scale}px`,
              width: `${g.width * scale}px`,
              height: `${g.height * scale}px`,
            }}
          />
        ))}

        {/* Global Replacements (Masks underlying old object completely, then renders new object) */}
        {globalReplacements.map((r) => (
          <div
            key={r.id}
            className="absolute bg-white overflow-hidden pointer-events-none z-10 flex items-center justify-center"
            style={{
              left: `${r.x * scale}px`,
              top: `${r.y * scale}px`,
              width: `${r.width * scale}px`,
              height: `${r.height * scale}px`,
            }}
          >
            {r.replacementType === "image" && r.base64Data && (
              <img src={r.base64Data} alt="Global Replacement" className="w-full h-full object-contain" />
            )}
            {r.replacementType === "text" && r.newText && (
              <span className="text-slate-900 font-bold px-1" style={{ fontSize: `${(r.fontSize || 11) * scale}px` }}>
                {r.newText}
              </span>
            )}
          </div>
        ))}

        {/* Existing PDF Text Hover Spans (for Edit Text Tool) */}
        {activeTool === "EDIT_TEXT" &&
          textSpans.map((span, idx) => (
            <div
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                onAddTextEdit({
                  id: `edit-${Date.now()}-${idx}`,
                  pageNumber,
                  x: span.x,
                  y: span.y,
                  width: span.width + 4,
                  height: span.height + 2,
                  originalText: span.text,
                  newText: span.text,
                  fontSize: Math.max(9, span.fontSize),
                  fontFamily: "helvetica",
                  color: "#000000",
                  hideOriginal: true,
                });
                toast.success(`Editing: "${span.text.slice(0, 20)}..."`);
              }}
              className="absolute border border-transparent hover:border-emerald-500 hover:bg-emerald-500/20 cursor-text transition-colors rounded z-30"
              style={{
                left: `${span.x * scale}px`,
                top: `${span.y * scale}px`,
                width: `${span.width * scale}px`,
                height: `${span.height * scale}px`,
              }}
              title={`Click to edit: "${span.text}"`}
            />
          ))}

        {/* Applied Whiteout Masks */}
        {whiteouts.map((w) => (
          <div
            key={w.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelectObject(w.id, "whiteout");
            }}
            className={`absolute transition-all cursor-pointer z-10 ${
              selectedObjectId === w.id ? "ring-2 ring-red-500" : ""
            }`}
            style={{
              left: `${w.x * scale}px`,
              top: `${w.y * scale}px`,
              width: `${w.width * scale}px`,
              height: `${w.height * scale}px`,
              backgroundColor: w.color || "#ffffff",
            }}
          />
        ))}

        {/* Applied Text Edits (with 100% Solid Underneath Mask to PREVENT OVERLAPS) */}
        {textEdits.map((t) => {
          const isSelected = selectedObjectId === t.id;
          return (
            <React.Fragment key={t.id}>
              {/* Opaque solid white mask covering old text underneath */}
              {t.hideOriginal !== false && (
                <div
                  className="absolute bg-white pointer-events-none z-15"
                  style={{
                    left: `${(t.x - 2) * scale}px`,
                    top: `${(t.y - 2) * scale}px`,
                    width: `${(t.width + 4) * scale}px`,
                    height: `${(t.height + 4) * scale}px`,
                    backgroundColor: t.backgroundColor || "#ffffff",
                  }}
                />
              )}

              {/* Editable Text Box */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectObject(t.id, "text");
                }}
                className={`absolute flex flex-col cursor-move z-25 ${
                  isSelected ? "ring-2 ring-emerald-500 z-35" : ""
                }`}
                style={{
                  left: `${t.x * scale}px`,
                  top: `${t.y * scale}px`,
                  width: `${t.width * scale}px`,
                  minHeight: `${t.height * scale}px`,
                }}
              >
                {isSelected ? (
                  <textarea
                    value={t.newText}
                    autoFocus
                    onChange={(e) => onUpdateTextEdit({ ...t, newText: e.target.value })}
                    className="w-full h-full p-1 bg-white text-slate-900 border-0 outline-none resize-none shadow-sm"
                    style={{
                      fontSize: `${t.fontSize * scale}px`,
                      fontFamily:
                        t.fontFamily === "times" ? "serif" : t.fontFamily === "courier" ? "monospace" : "sans-serif",
                      fontWeight: t.isBold ? "bold" : "normal",
                      fontStyle: t.isItalic ? "italic" : "normal",
                      color: t.color || "#000000",
                      textAlign: t.align || "left",
                    }}
                  />
                ) : (
                  <div
                    className="w-full h-full p-0.5 whitespace-pre-wrap select-text text-slate-900"
                    style={{
                      fontSize: `${t.fontSize * scale}px`,
                      fontFamily:
                        t.fontFamily === "times" ? "serif" : t.fontFamily === "courier" ? "monospace" : "sans-serif",
                      fontWeight: t.isBold ? "bold" : "normal",
                      fontStyle: t.isItalic ? "italic" : "normal",
                      color: t.color || "#000000",
                      textAlign: t.align || "left",
                    }}
                  >
                    {t.newText}
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}

        {/* Inserted Images (with Move, Corner Resize, Rotation, and Delete Handles) */}
        {images.map((img) => {
          const isSelected = selectedObjectId === img.id;
          return (
            <div
              key={img.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectObject(img.id, "image");
              }}
              className={`absolute cursor-move z-25 group ${
                isSelected ? "ring-2 ring-indigo-500 z-35" : ""
              }`}
              style={{
                left: `${img.x * scale}px`,
                top: `${img.y * scale}px`,
                width: `${img.width * scale}px`,
                height: `${img.height * scale}px`,
                opacity: img.opacity ?? 1,
                transform: `rotate(${img.rotation ?? 0}deg)`,
                transformOrigin: "center",
              }}
            >
              <img
                src={img.base64Data || img.imageUrl}
                alt="Embedded PDF graphic"
                className="w-full h-full object-contain pointer-events-none select-none"
              />

              {/* Corner Resize Handle on bottom-right */}
              {isSelected && (
                <div
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setResizingImgId(img.id);
                    setResizeStart({
                      startW: img.width,
                      startH: img.height,
                      startX: (e.clientX - (overlayRef.current?.getBoundingClientRect().left || 0)) / scale,
                      startY: (e.clientY - (overlayRef.current?.getBoundingClientRect().top || 0)) / scale,
                    });
                  }}
                  className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-indigo-600 rounded-tl border border-white cursor-nwse-resize shadow-md"
                  title="Drag to resize image"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
