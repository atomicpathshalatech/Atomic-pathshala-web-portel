"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
    removeOldHeader: true,
    removeOldFooter: true,
    oldHeaderHeightPt: 42,
    oldFooterHeightPt: 32,
    accentColor: "#0B7A43",
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
  const [diagnosticsData, setDiagnosticsData] = useState<{ renderTimeMs: number; loadTimeMs: number }>({ renderTimeMs: 0, loadTimeMs: 0 });

  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const isAdmin = userRole === "SUPER_ADMIN" || userRole === "ADMIN";

  // Push state to Undo/Redo stack
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
        const updated = prev.slice(0, historyIndex + 1);
        return [...updated, newState].slice(-50);
      });
      setHistoryIndex((prev) => prev + 1);
      setHasUnsavedChanges(true);
    },
    [historyIndex]
  );

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

  // 1. Initial Load of Module Details & PDF Document
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

        setDiagnosticsData((d) => ({ ...d, loadTimeMs: Date.now() - loadStart }));
        setLoading(false);

        // Push initial state to history
        pushHistory({
          textEdits: [],
          whiteouts: [],
          images: [],
          shapes: [],
          globalRemovals: [],
          globalReplacements: [],
          deletedPages: [],
          pageRotations: {},
        });
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
  }, [moduleId, pushHistory]);

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
  const handleSaveDocument = async (isAutosave = false) => {
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
                    },
                  },
                  ...(prev.versions || []),
                ],
              }
            : null
        );
      }

      setTimeout(() => setSaveStatus("idle"), 4000);
    } catch (err: any) {
      console.error("Save error:", err);
      setSaveStatus("error");
      toast.error("Failed to save: " + (err.message || "Unknown error"));
    }
  };

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S / Cmd+S
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveDocument(false);
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
  }, [selectedObjectId, historyIndex, history, textEdits, whiteouts, images, shapes, globalRemovals, globalReplacements]);

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
                  <div className="absolute left-0 top-full mt-1 w-52 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1 z-50 text-xs">
                    <button
                      onClick={() => handleSaveDocument(false)}
                      className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-800 text-slate-200"
                    >
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-orange-400">save</span> Save
                      </span>
                      <span className="text-[10px] text-slate-500">Ctrl+S</span>
                    </button>
                    {moduleData?.originalFileUrl && (
                      <a
                        href={moduleData.originalFileUrl}
                        download={moduleData.originalFileName}
                        className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-800 text-slate-200"
                      >
                        <span className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm text-indigo-400">download</span> Download Original
                        </span>
                      </a>
                    )}
                    <div className="my-1 border-t border-slate-800" />
                    <button
                      onClick={() => setActiveSidebarTab("versions")}
                      className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-800 text-slate-200"
                    >
                      <span className="material-symbols-outlined text-sm text-teal-400">history</span> Version History
                    </button>
                    <button
                      onClick={() => setShowPagePropsDialog(true)}
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

            {/* Save & Export Buttons */}
            <button
              type="button"
              onClick={() => handleSaveDocument(false)}
              className="px-3.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
            >
              <span className="material-symbols-outlined text-sm">save</span>
              <span>Save (Ctrl+S)</span>
            </button>
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

            {/* Page Navigator */}
            <div className="flex items-center gap-1.5 bg-slate-950/60 px-2 py-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
                      onClick={() => !isDeleted && setCurrentPage(pNum)}
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
                <h4 className="font-bold text-slate-400 uppercase text-[10px] tracking-wider mb-2">
                  Revision History
                </h4>
                {moduleData?.versions && moduleData.versions.length > 0 ? (
                  moduleData.versions.map((v) => (
                    <div key={v.id} className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/40 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200">{v.label}</span>
                        <span className="text-[10px] text-slate-500">{new Date(v.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {v.snapshot?.textEditsCount ?? 0} Text Edits • {v.snapshot?.pageCount ?? 0} Pages
                      </p>
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
            <div className="space-y-8 flex flex-col items-center">
              {/* Active Page Canvas Container */}
              <NativePdfPageView
                pdfDocProxy={pdfDocProxy}
                pageNumber={currentPage}
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
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Width (pt)</label>
                  <input
                    type="number"
                    value={Math.round(selectedImageObj.width)}
                    onChange={(e) => {
                      const updated = { ...selectedImageObj, width: Number(e.target.value) };
                      setImages((prev) => prev.map((img) => (img.id === updated.id ? updated : img)));
                    }}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200"
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
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200"
                  />
                </div>
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
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Subject</label>
                  <select
                    value={coverPage.subject}
                    onChange={(e) => setCoverPage((p) => ({ ...p, subject: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                  >
                    <option value="CHEMISTRY">Chemistry (Green)</option>
                    <option value="PHYSICS">Physics (Blue)</option>
                    <option value="BIOLOGY">Biology (Purple)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Module Number</label>
                  <input
                    type="text"
                    value={coverPage.moduleNumber}
                    onChange={(e) => setCoverPage((p) => ({ ...p, moduleNumber: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Chapter Title</label>
                <input
                  type="text"
                  value={coverPage.chapter}
                  onChange={(e) => setCoverPage((p) => ({ ...p, chapter: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
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
                onClick={() => setShowCoverDialog(false)}
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
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-400">view_headline</span>
                <span>Running Header &amp; Footer Overlays</span>
              </h3>
              <button onClick={() => setShowHeaderFooterDialog(false)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
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
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Header Left</label>
                <input
                  type="text"
                  value={headerFooter.headerLeft || ""}
                  onChange={(e) => setHeaderFooter((p) => ({ ...p, headerLeft: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Header Center</label>
                <input
                  type="text"
                  value={headerFooter.headerCenter || ""}
                  onChange={(e) => setHeaderFooter((p) => ({ ...p, headerCenter: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Footer Left</label>
                <input
                  type="text"
                  value={headerFooter.footerLeft || ""}
                  onChange={(e) => setHeaderFooter((p) => ({ ...p, footerLeft: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                />
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
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowHeaderFooterDialog(false)}
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
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-400">branding_watermark</span>
                <span>Watermark Overlay</span>
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

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Watermark Text</label>
                <input
                  type="text"
                  value={watermark.text || ""}
                  onChange={(e) => setWatermark((p) => ({ ...p, text: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Opacity: {Math.round((watermark.opacity ?? 0.05) * 100)}%
                </label>
                <input
                  type="range"
                  min={0.02}
                  max={0.3}
                  step={0.01}
                  value={watermark.opacity ?? 0.05}
                  onChange={(e) => setWatermark((p) => ({ ...p, opacity: Number(e.target.value) }))}
                  className="w-full accent-orange-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowWatermarkDialog(false)}
                className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs"
              >
                Apply Watermark
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. BACKGROUND CONFIG MODAL */}
      {showBackgroundDialog && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-400">wallpaper</span>
                <span>Page Background Settings</span>
              </h3>
              <button onClick={() => setShowBackgroundDialog(false)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <label className="flex items-center gap-2 cursor-pointer p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <input
                type="checkbox"
                checked={background.enabled}
                onChange={(e) => setBackground((p) => ({ ...p, enabled: e.target.checked }))}
                className="rounded text-orange-500"
              />
              <span className="font-bold text-slate-200">Enable Custom Background</span>
            </label>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Background Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={background.color || "#ffffff"}
                    onChange={(e) => setBackground((p) => ({ ...p, color: e.target.value }))}
                    className="w-10 h-10 rounded border border-slate-800 cursor-pointer bg-transparent"
                  />
                  <span className="text-slate-300 font-mono">{background.color || "#ffffff"}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Background Image (Optional)
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
                onClick={() => setShowBackgroundDialog(false)}
                className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs"
              >
                Apply Background
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

/**
 * High-Resolution Native PDF Page View with Interactive In-Place Edit Overlays
 */
interface NativePdfPageViewProps {
  pdfDocProxy: any;
  pageNumber: number;
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
  onAddWhiteout: (whiteout: WhiteoutItem) => void;
  onTargetBoxSelected: (box: { x: number; y: number; width: number; height: number }) => void;
  headerFooter?: HeaderFooterConfig;
  watermark?: WatermarkConfig;
  background?: BackgroundConfig;
}

function NativePdfPageView({
  pdfDocProxy,
  pageNumber,
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
  onAddWhiteout,
  onTargetBoxSelected,
  headerFooter,
  watermark,
  background,
}: NativePdfPageViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [pageSize, setPageSize] = useState<{ width: number; height: number }>({ width: 595, height: 842 });
  const [textSpans, setTextSpans] = useState<
    Array<{ text: string; x: number; y: number; width: number; height: number; fontSize: number }>
  >([]);
  const [isSelectingBox, setIsSelectingBox] = useState<boolean>(false);
  const [drawBox, setDrawBox] = useState<{ startX: number; startY: number; currX: number; currY: number } | null>(null);

  // Render PDF.js Canvas on Page Change or Zoom Change
  useEffect(() => {
    let isCancelled = false;

    async function renderPage() {
      if (!pdfDocProxy || pageNumber < 1 || pageNumber > pdfDocProxy.numPages) return;

      try {
        const page = await pdfDocProxy.getPage(pageNumber);
        const viewport = page.getViewport({ scale: zoom * 1.5, rotation });

        if (isCancelled) return;
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
            await page.render(renderContext).promise;
          }
        }

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
      } catch (err) {
        console.warn("[NativePdfPageView] Render error:", err);
      }
    }

    renderPage();
    return () => {
      isCancelled = true;
    };
  }, [pdfDocProxy, pageNumber, zoom, rotation]);

  // Handle Dragging / Box Selection for Whiteout, Add Text, Remove Object, Replace Object
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
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
    if (!isSelectingBox || !drawBox) return;
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;

    const scale = zoom;
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    setDrawBox((prev) => (prev ? { ...prev, currX: x, currY: y } : null));
  };

  const handleMouseUp = () => {
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

  return (
    <div
      className="relative shadow-2xl border border-slate-800 bg-white select-none transition-transform"
      style={{
        width: `${pageSize.width * scale}px`,
        height: `${pageSize.height * scale}px`,
      }}
    >
      {/* 1. Underlying High-Res PDF.js Render Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      {/* 2. Interactive Editing Overlay */}
      <div
        ref={overlayRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className={`absolute inset-0 overflow-hidden ${
          activeTool === "WHITEOUT" ||
          activeTool === "ADD_TEXT" ||
          activeTool === "REMOVE_OBJECT" ||
          activeTool === "REPLACE_OBJECT"
            ? "cursor-crosshair"
            : "cursor-default"
        }`}
      >
        {/* Draw Temporary Box during drag */}
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
            }}
          />
        )}

        {/* Global Removals Masks */}
        {globalRemovals.map((g) => (
          <div
            key={g.id}
            className="absolute bg-white border border-red-400/30 pointer-events-none z-10"
            style={{
              left: `${g.x * scale}px`,
              top: `${g.y * scale}px`,
              width: `${g.width * scale}px`,
              height: `${g.height * scale}px`,
            }}
          />
        ))}

        {/* Global Replacements */}
        {globalReplacements.map((r) => (
          <div
            key={r.id}
            className="absolute bg-white border border-cyan-400/30 overflow-hidden pointer-events-none z-10 flex items-center"
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
              className="absolute border border-transparent hover:border-emerald-500 hover:bg-emerald-500/20 cursor-text transition-colors rounded"
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
            className={`absolute transition-all cursor-pointer ${
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

        {/* Applied Text Edits & Text Boxes */}
        {textEdits.map((t) => {
          const isSelected = selectedObjectId === t.id;
          return (
            <div
              key={t.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectObject(t.id, "text");
              }}
              className={`absolute flex flex-col cursor-move ${
                isSelected ? "ring-2 ring-emerald-500 z-30" : "z-20"
              }`}
              style={{
                left: `${t.x * scale}px`,
                top: `${t.y * scale}px`,
                width: `${t.width * scale}px`,
                minHeight: `${t.height * scale}px`,
                backgroundColor: t.hideOriginal ? t.backgroundColor || "#ffffff" : "transparent",
              }}
            >
              {isSelected ? (
                <textarea
                  value={t.newText}
                  autoFocus
                  onChange={(e) => onUpdateTextEdit({ ...t, newText: e.target.value })}
                  className="w-full h-full p-1 bg-white text-slate-900 border-0 outline-none resize-none"
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
          );
        })}

        {/* Inserted Images */}
        {images.map((img) => (
          <div
            key={img.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelectObject(img.id, "image");
            }}
            className={`absolute cursor-move overflow-hidden ${
              selectedObjectId === img.id ? "ring-2 ring-indigo-500 z-30" : "z-20"
            }`}
            style={{
              left: `${img.x * scale}px`,
              top: `${img.y * scale}px`,
              width: `${img.width * scale}px`,
              height: `${img.height * scale}px`,
              opacity: img.opacity ?? 1,
            }}
          >
            <img
              src={img.base64Data || img.imageUrl}
              alt="Embedded PDF graphic"
              className="w-full h-full object-contain pointer-events-none"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
