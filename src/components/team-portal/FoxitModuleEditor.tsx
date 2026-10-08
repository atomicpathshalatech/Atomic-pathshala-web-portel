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
  | "HIGHLIGHT";

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
  const [deletedPages, setDeletedPages] = useState<number[]>([]);
  const [pageRotations, setPageRotations] = useState<Record<number, number>>({});
  const [pageOrder, setPageOrder] = useState<number[]>([]);

  // 4. Global Overlays & Configurations
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
  });

  const [watermark, setWatermark] = useState<WatermarkConfig>({
    enabled: false,
    text: "ATOMIC PATHSHALA",
    opacity: 0.05,
    rotation: 35,
  });

  const [coverPage, setCoverPage] = useState<CoverPageConfig>({
    enabled: false,
    subject: "CHEMISTRY",
    moduleNumber: "Module 01",
    chapter: "IUPAC Nomenclature",
    teacher: "Firoz Sir",
    batch: "NEET Accelerated Batch",
    targetExam: "NEET (UG)",
  });

  // 5. Undo / Redo History Stack
  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // 6. UI & Modal States
  const [activeSidebarTab, setActiveSidebarTab] = useState<"thumbnails" | "layers" | "versions" | "diagnostics">("thumbnails");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [showCoverDialog, setShowCoverDialog] = useState<boolean>(false);
  const [showHeaderFooterDialog, setShowHeaderFooterDialog] = useState<boolean>(false);
  const [showWatermarkDialog, setShowWatermarkDialog] = useState<boolean>(false);
  const [diagnosticsData, setDiagnosticsData] = useState<{ renderTimeMs: number; loadTimeMs: number }>({ renderTimeMs: 0, loadTimeMs: 0 });

  // 7. Interactive Drawing/Drag Refs
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const isAdmin = userRole === "SUPER_ADMIN" || userRole === "ADMIN";

  // Push state to Undo/Redo stack
  const pushHistory = useCallback((newState: {
    textEdits: TextEditItem[];
    whiteouts: WhiteoutItem[];
    images: ImageEditItem[];
    shapes: ShapeEditItem[];
    deletedPages: number[];
    pageRotations: Record<number, number>;
  }) => {
    setHistory((prev) => {
      const updated = prev.slice(0, historyIndex + 1);
      return [...updated, newState].slice(-50); // keep last 50 steps
    });
    setHistoryIndex((prev) => prev + 1);
    setHasUnsavedChanges(true);
  }, [historyIndex]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      const targetState = history[historyIndex - 1];
      setTextEdits(targetState.textEdits);
      setWhiteouts(targetState.whiteouts);
      setImages(targetState.images);
      setShapes(targetState.shapes);
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
        const mod: ModuleData = json.data.module;

        if (!isMounted) return;
        setModuleData(mod);

        if (mod.subject) {
          setCoverPage((prev) => ({
            ...prev,
            subject: mod.subject || "CHEMISTRY",
            chapter: mod.chapter || mod.title || "Academic Chapter",
            teacher: mod.facultyName || "Firoz Sir",
            batch: mod.batch || "NEET Accelerated Batch",
          }));
        }

        // Load PDF in browser via PDF.js immediately
        const pdfjs = await loadServerPdfJs();
        const pdfUrl = mod.originalFileUrl;
        const loadingTask = pdfjs.getDocument({
          url: pdfUrl,
          useSystemFonts: true,
          cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.0/cmaps/",
          cMapPacked: true,
        });

        const docProxy = await loadingTask.promise;
        if (!isMounted) return;

        setPdfDocProxy(docProxy);
        setTotalPages(docProxy.numPages);
        setPageOrder(Array.from({ length: docProxy.numPages }, (_, i) => i + 1));
        setDiagnosticsData((prev) => ({ ...prev, loadTimeMs: Date.now() - loadStart }));
        setLoading(false);
        toast.success(`PDF Loaded (${docProxy.numPages} Pages)`);
      } catch (err: any) {
        if (!isMounted) return;
        setLoading(false);
        toast.error(err.message || "Failed to load module PDF");
      }
    }

    loadModule();
    return () => {
      isMounted = false;
    };
  }, [moduleId]);

  // Unsaved changes window unload warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes in the PDF editor.";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Save changes to backend
  const handleSaveDocument = async (isAutosave = false) => {
    if (!moduleData) return;
    setSaveStatus("saving");
    const toastId = isAutosave ? undefined : toast.loading("Saving native PDF changes...");

    try {
      const res = await fetch(`/api/team/modules/${moduleId}/save-native`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textEdits,
          whiteouts,
          images,
          shapes,
          pageRotations,
          deletedPages,
          pageOrder,
          headerFooter,
          watermark,
          coverPage,
          changeSummary: `Edited in Native PDF Editor (${textEdits.length} text edits, ${whiteouts.length} whiteouts)`,
          isAutosave,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to save PDF");
      }

      setSaveStatus("saved");
      setHasUnsavedChanges(false);
      if (!isAutosave) {
        toast.success("Saved successfully! PDF is print-ready.", { id: toastId });
      }
    } catch (err: any) {
      setSaveStatus("error");
      if (!isAutosave) {
        toast.error(err.message || "Save failed", { id: toastId });
      }
    }
  };

  // Keyboard Shortcuts (Ctrl+S, Ctrl+Z, Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveDocument(false);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedObjectId && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
          handleDeleteSelectedObject();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedObjectId, historyIndex, history, textEdits, whiteouts, images, shapes]);

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
    <div className="flex flex-col h-[calc(100vh-68px)] bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
      {/* 1. TOP MENU & RIBBON TOOLBAR */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur shrink-0 z-30">
        {/* Top File / Doc Info Bar */}
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-slate-800/80 text-xs">
          <div className="flex items-center gap-3">
            <Link
              href="/team/modules"
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Back to Modules"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="font-bold text-orange-500">Atomic PDF Editor</span>
              <span className="text-slate-600">•</span>
              <span className="font-semibold text-slate-200 truncate max-w-xs">{moduleData?.title || "Loading Module..."}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">
                {moduleData?.originalFileName || "document.pdf"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Autosave / Save Status Indicator */}
            <div className="flex items-center gap-1.5 text-[11px]">
              {saveStatus === "saving" && (
                <span className="text-amber-400 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs animate-spin">sync</span>
                  Saving...
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">check_circle</span>
                  Saved ✓
                </span>
              )}
              {saveStatus === "error" && (
                <span className="text-red-400 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">error</span>
                  Save Failed
                </span>
              )}
              {saveStatus === "idle" && hasUnsavedChanges && (
                <span className="text-slate-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
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

            {moduleData?.originalFileUrl && (
              <a
                href={moduleData.originalFileUrl}
                download={moduleData.originalFileName}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-slate-700 transition-all"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                <span>Download</span>
              </a>
            )}
          </div>
        </div>

        {/* Ribbon Tool Icons & Action Controls */}
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
              title="Whiteout / Permanently Mask Unwanted Region"
            >
              <span className="material-symbols-outlined text-base">ink_eraser</span>
              <span>Whiteout</span>
            </button>

            <label
              className={`p-1.5 rounded-lg flex items-center gap-1 font-semibold cursor-pointer transition-all ${
                activeTool === "IMAGE" ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" : "text-slate-400 hover:text-white"
              }`}
              title="Insert / Replace Image"
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
                      pushHistory({ textEdits, whiteouts, images: [...images, newImg], shapes, deletedPages, pageRotations });
                      toast.success("Image placed on Page " + currentPage);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <span className="material-symbols-outlined text-base">image</span>
              <span>Image</span>
            </label>
          </div>

          {/* Tool Group 3: Shapes & Annotations */}
          <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTool("HIGHLIGHT")}
              className={`p-1.5 rounded-lg flex items-center gap-1 font-semibold transition-all ${
                activeTool === "HIGHLIGHT" ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" : "text-slate-400 hover:text-white"
              }`}
              title="Highlight Tool"
            >
              <span className="material-symbols-outlined text-base">highlight</span>
              <span>Highlight</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTool("RECTANGLE")}
              className={`p-1.5 rounded-lg flex items-center gap-1 font-semibold transition-all ${
                activeTool === "RECTANGLE" ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" : "text-slate-400 hover:text-white"
              }`}
              title="Draw Rectangle"
            >
              <span className="material-symbols-outlined text-base">rectangle</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTool("CIRCLE")}
              className={`p-1.5 rounded-lg flex items-center gap-1 font-semibold transition-all ${
                activeTool === "CIRCLE" ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" : "text-slate-400 hover:text-white"
              }`}
              title="Draw Circle"
            >
              <span className="material-symbols-outlined text-base">circle</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTool("LINE")}
              className={`p-1.5 rounded-lg flex items-center gap-1 font-semibold transition-all ${
                activeTool === "LINE" ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" : "text-slate-400 hover:text-white"
              }`}
              title="Draw Line"
            >
              <span className="material-symbols-outlined text-base">horizontal_rule</span>
            </button>
          </div>

          {/* Tool Group 4: Module Branding Dialogs */}
          <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setShowCoverDialog(true)}
              className={`p-1.5 rounded-lg flex items-center gap-1 font-semibold transition-all ${
                coverPage.enabled ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "text-slate-400 hover:text-white"
              }`}
              title="Generate Atomic Pathshala Front Cover Page"
            >
              <span className="material-symbols-outlined text-base">auto_stories</span>
              <span>Cover Page</span>
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
          </div>

          {/* Tool Group 5: Undo/Redo & Zoom Navigation */}
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
                  const rot = pageRotations[pNum] || 0;

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
                        <span className="font-bold text-slate-300">Page {idx + 1} (Orig #{pNum})</span>
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
                            }}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                            title="Rotate 90° Clockwise"
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
                            }}
                            className={`p-1 rounded hover:bg-slate-800 ${isDeleted ? "text-green-400" : "text-red-400"}`}
                            title={isDeleted ? "Restore Page" : "Delete Page"}
                          >
                            <span className="material-symbols-outlined text-xs">
                              {isDeleted ? "restore_from_trash" : "delete"}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Thumbnail Placeholder Preview */}
                      <div
                        className="w-full h-32 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center text-slate-600 text-xs font-mono relative overflow-hidden"
                        style={{ transform: `rotate(${rot}deg)` }}
                      >
                        <span className="material-symbols-outlined text-2xl opacity-40">description</span>
                        <span className="absolute bottom-1 right-2 text-[10px] text-slate-500 font-bold">
                          #{pNum}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* LAYERS TAB */}
            {activeSidebarTab === "layers" && (
              <div className="space-y-2 text-xs">
                <h4 className="font-bold text-slate-400 uppercase text-[10px] tracking-wider mb-2">
                  Edits on Page {currentPage}
                </h4>

                {/* Text Edits */}
                {textEdits.filter((t) => t.pageNumber === currentPage).map((t) => (
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
                {whiteouts.filter((w) => w.pageNumber === currentPage).map((w) => (
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
                      <span>Whiteout Mask ({Math.round(w.width)}x{Math.round(w.height)})</span>
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
                {images.filter((img) => img.pageNumber === currentPage).map((img) => (
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
                      <span>Inserted Image ({Math.round(img.width)}x{Math.round(img.height)})</span>
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

                {textEdits.filter((t) => t.pageNumber === currentPage).length === 0 &&
                  whiteouts.filter((w) => w.pageNumber === currentPage).length === 0 &&
                  images.filter((img) => img.pageNumber === currentPage).length === 0 && (
                    <p className="text-slate-500 text-xs italic text-center py-4">
                      No edits on Page {currentPage} yet. Select a tool to start editing.
                    </p>
                  )}
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
                selectedObjectId={selectedObjectId}
                onSelectObject={(id, type) => {
                  setSelectedObjectId(id);
                  setSelectedObjectType(type);
                }}
                onAddTextEdit={(newEdit) => {
                  setTextEdits((prev) => [...prev, newEdit]);
                  setSelectedObjectId(newEdit.id);
                  setSelectedObjectType("text");
                  pushHistory({ textEdits: [...textEdits, newEdit], whiteouts, images, shapes, deletedPages, pageRotations });
                }}
                onUpdateTextEdit={(updated) => {
                  setTextEdits((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
                  setHasUnsavedChanges(true);
                }}
                onAddWhiteout={(newWhiteout) => {
                  setWhiteouts((prev) => [...prev, newWhiteout]);
                  setSelectedObjectId(newWhiteout.id);
                  setSelectedObjectType("whiteout");
                  pushHistory({ textEdits, whiteouts: [...whiteouts, newWhiteout], images, shapes, deletedPages, pageRotations });
                }}
                headerFooter={headerFooter}
                watermark={watermark}
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
                Whiteout permanently covers the selected region in the final PDF with a solid background mask.
              </p>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Mask Color
                </label>
                <input
                  type="color"
                  value={selectedWhiteoutObj.color || "#ffffff"}
                  onChange={(e) => {
                    const updated = { ...selectedWhiteoutObj, color: e.target.value };
                    setWhiteouts((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
                  }}
                  className="w-full h-8 rounded border border-slate-800 cursor-pointer bg-transparent"
                />
              </div>
              <button
                type="button"
                onClick={handleDeleteSelectedObject}
                className="w-full py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
                <span>Remove Whiteout</span>
              </button>
            </div>
          )}

          {/* IMAGE PROPERTIES */}
          {selectedImageObj && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Width</label>
                  <input
                    type="number"
                    value={Math.round(selectedImageObj.width)}
                    onChange={(e) => {
                      const updated = { ...selectedImageObj, width: Number(e.target.value) };
                      setImages((prev) => prev.map((img) => (img.id === updated.id ? updated : img)));
                    }}
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Height</label>
                  <input
                    type="number"
                    value={Math.round(selectedImageObj.height)}
                    onChange={(e) => {
                      const updated = { ...selectedImageObj, height: Number(e.target.value) };
                      setImages((prev) => prev.map((img) => (img.id === updated.id ? updated : img)));
                    }}
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200"
                  />
                </div>
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

          {/* DEFAULT / NO OBJECT SELECTED: DOCUMENT QUICK SETTINGS */}
          {!selectedObjectId && (
            <div className="space-y-4">
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h4 className="font-bold text-slate-300 text-xs">Module Information</h4>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  <strong>Subject:</strong> {coverPage.subject}<br />
                  <strong>Chapter:</strong> {coverPage.chapter}<br />
                  <strong>Faculty:</strong> {coverPage.teacher}<br />
                  <strong>Pages:</strong> {totalPages}
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h4 className="font-bold text-slate-300 text-xs">Shortcuts</h4>
                <ul className="text-slate-400 text-[11px] space-y-1">
                  <li><kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-300">Ctrl + S</kbd> : Save PDF</li>
                  <li><kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-300">Ctrl + Z</kbd> : Undo</li>
                  <li><kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-300">Ctrl + Y</kbd> : Redo</li>
                  <li><kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-300">Del</kbd> : Delete Object</li>
                </ul>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* 3. COVER PAGE CONFIG MODAL */}
      {showCoverDialog && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-400">auto_stories</span>
                <span>Atomic Pathshala Front Cover Page</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCoverDialog(false)}
                className="text-slate-400 hover:text-white"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <label className="flex items-center gap-2 cursor-pointer p-3 rounded-xl bg-slate-950 border border-slate-800">
              <input
                type="checkbox"
                checked={coverPage.enabled}
                onChange={(e) => setCoverPage((p) => ({ ...p, enabled: e.target.checked }))}
                className="rounded text-orange-500 focus:ring-orange-500"
              />
              <span className="font-bold text-xs text-slate-200">
                Prepend Branded Front Cover to PDF
              </span>
            </label>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Subject</label>
                <select
                  value={coverPage.subject}
                  onChange={(e) => setCoverPage((p) => ({ ...p, subject: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                >
                  <option value="CHEMISTRY">CHEMISTRY (Green)</option>
                  <option value="PHYSICS">PHYSICS (Blue)</option>
                  <option value="BIOLOGY">BIOLOGY (Purple)</option>
                </select>
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
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Faculty</label>
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

      {/* 4. HEADER & FOOTER CONFIG MODAL */}
      {showHeaderFooterDialog && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-400">view_headline</span>
                <span>Running Header &amp; Footer Overlays</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowHeaderFooterDialog(false)}
                className="text-slate-400 hover:text-white"
              >
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

      {/* 5. WATERMARK CONFIG MODAL */}
      {showWatermarkDialog && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-400">branding_watermark</span>
                <span>Watermark Overlay</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowWatermarkDialog(false)}
                className="text-slate-400 hover:text-white"
              >
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

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Watermark Text</label>
              <input
                type="text"
                value={watermark.text || ""}
                onChange={(e) => setWatermark((p) => ({ ...p, text: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs"
              />
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
  selectedObjectId: string | null;
  onSelectObject: (id: string, type: "text" | "whiteout" | "image" | "shape") => void;
  onAddTextEdit: (edit: TextEditItem) => void;
  onUpdateTextEdit: (edit: TextEditItem) => void;
  onAddWhiteout: (whiteout: WhiteoutItem) => void;
  headerFooter?: HeaderFooterConfig;
  watermark?: WatermarkConfig;
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
  selectedObjectId,
  onSelectObject,
  onAddTextEdit,
  onUpdateTextEdit,
  onAddWhiteout,
  headerFooter,
  watermark,
}: NativePdfPageViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [pageSize, setPageSize] = useState<{ width: number; height: number }>({ width: 595, height: 842 });
  const [textSpans, setTextSpans] = useState<Array<{ text: string; x: number; y: number; width: number; height: number; fontSize: number }>>([]);
  const [isSelectingBox, setIsSelectingBox] = useState<boolean>(false);
  const [drawBox, setDrawBox] = useState<{ startX: number; startY: number; currX: number; currY: number } | null>(null);

  // Render PDF.js Canvas on Page Change or Zoom Change
  useEffect(() => {
    let isCancelled = false;

    async function renderPage() {
      if (!pdfDocProxy || pageNumber < 1 || pageNumber > pdfDocProxy.numPages) return;

      try {
        const page = await pdfDocProxy.getPage(pageNumber);
        const viewport = page.getViewport({ scale: zoom * 1.5, rotation }); // 1.5x crisp rendering

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

  // Handle Dragging / Box Selection for Whiteout or Add Text
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== "WHITEOUT" && activeTool !== "ADD_TEXT") return;
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
          activeTool === "WHITEOUT" || activeTool === "ADD_TEXT" ? "cursor-crosshair" : "cursor-default"
        }`}
      >
        {/* Draw Temporary Box during drag */}
        {drawBox && (
          <div
            className={`absolute border-2 ${
              activeTool === "WHITEOUT" ? "bg-white/80 border-red-500" : "bg-blue-500/20 border-blue-500"
            }`}
            style={{
              left: `${Math.min(drawBox.startX, drawBox.currX) * scale}px`,
              top: `${Math.min(drawBox.startY, drawBox.currY) * scale}px`,
              width: `${Math.abs(drawBox.currX - drawBox.startX) * scale}px`,
              height: `${Math.abs(drawBox.currY - drawBox.startY) * scale}px`,
            }}
          />
        )}

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
                backgroundColor: t.hideOriginal ? (t.backgroundColor || "#ffffff") : "transparent",
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
                    fontFamily: t.fontFamily === "times" ? "serif" : t.fontFamily === "courier" ? "monospace" : "sans-serif",
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
                    fontFamily: t.fontFamily === "times" ? "serif" : t.fontFamily === "courier" ? "monospace" : "sans-serif",
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
