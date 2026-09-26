"use client";

import React, { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  CamDrawDocument,
  CamDrawElement,
  AtomElement,
  BondElement,
  RingElement,
  ReactionArrowElement,
  CurvedArrowElement,
  PhysicsSymbolElement,
  BioShapeElement,
  TextAnnotationElement,
  MathPlotElement,
  createEmptyCamDrawDocument,
  BondType,
  RingType,
  PhysicsSymbolType,
  BioShapeType,
} from "@/lib/camdraw/types";
import { CamDrawRenderer, exportCamDrawToSvgString } from "./CamDrawRenderer";
import { CAMDRAW_TEMPLATES } from "@/lib/camdraw/templates";
import {
  Sparkles,
  Undo,
  Redo,
  Trash2,
  Copy,
  Plus,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
  Download,
  Check,
  X,
  Layers,
  HelpCircle,
  Eye,
  AlertTriangle,
  Move,
  Flame,
  Atom as AtomIcon,
  CircleDot,
  ArrowRight,
  Split,
  Zap,
  RotateCw,
  Compass,
  FileCode,
} from "lucide-react";

export interface CamDrawEditorProps {
  initialDocument?: CamDrawDocument | string | null;
  referenceImageUrl?: string | null;
  hintSubject?: string;
  onSave: (doc: CamDrawDocument) => void;
  onClose?: () => void;
  title?: string;
}

type ActiveCategory = "chemistry" | "physics" | "biology" | "math" | "custom";
type ActiveTool =
  | "select"
  | "atom"
  | "bond"
  | "ring"
  | "reaction_arrow"
  | "curved_arrow"
  | "charge"
  | "lone_pair"
  | "physics_symbol"
  | "bio_shape"
  | "math_plot"
  | "text"
  | "freehand";

export function CamDrawEditor({
  initialDocument,
  referenceImageUrl,
  hintSubject = "Chemistry",
  onSave,
  onClose,
  title = "CamDraw Academic Structure Studio",
}: CamDrawEditorProps) {
  // 1. Core Document & History State
  const [doc, setDoc] = useState<CamDrawDocument>(() => {
    if (initialDocument) {
      if (typeof initialDocument === "object" && initialDocument.elements) {
        return initialDocument;
      }
      if (typeof initialDocument === "string") {
        try {
          const parsed = JSON.parse(initialDocument);
          if (parsed && parsed.elements) return parsed;
        } catch {}
      }
    }
    return createEmptyCamDrawDocument("chemical", 900, 560);
  });

  const [history, setHistory] = useState<CamDrawDocument[]>([doc]);
  const [historyIdx, setHistoryIdx] = useState(0);

  // 2. Active Tool & Tool Palette States
  const [category, setCategory] = useState<ActiveCategory>(
    hintSubject.toLowerCase().includes("phys")
      ? "physics"
      : hintSubject.toLowerCase().includes("bio")
      ? "biology"
      : hintSubject.toLowerCase().includes("math")
      ? "math"
      : "chemistry"
  );
  const [activeTool, setActiveTool] = useState<ActiveTool>("select");

  // Sub-tool options
  const [selectedAtomSymbol, setSelectedAtomSymbol] = useState("C");
  const [customAtomInput, setCustomAtomInput] = useState("");
  const [selectedBondType, setSelectedBondType] = useState<BondType>("single");
  const [selectedRingType, setSelectedRingType] = useState<RingType>("benzene");
  const [selectedCharge, setSelectedCharge] = useState("+");
  const [selectedPhysSymbol, setSelectedPhysSymbol] = useState<PhysicsSymbolType>("resistor");
  const [selectedBioShape, setSelectedBioShape] = useState<BioShapeType>("cell_membrane");
  const [reactionTopText, setReactionTopText] = useState("KMnO4 / H+");
  const [reactionBottomText, setReactionBottomText] = useState("Δ");

  // 3. Selection & Canvas Interaction States
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [bondStartPoint, setBondStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [curvedStartPoint, setCurvedStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showReferenceSideBySide, setShowReferenceSideBySide] = useState<boolean>(
    Boolean(referenceImageUrl)
  );
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [matchMode, setMatchMode] = useState<"MATCH_REFERENCE" | "AUTO_ORGANIZE">("MATCH_REFERENCE");

  const canvasRef = useRef<SVGSVGElement>(null);

  // Push new state to history
  const updateDocument = (newDoc: CamDrawDocument) => {
    setDoc(newDoc);
    const newHist = history.slice(0, historyIdx + 1);
    newHist.push(newDoc);
    setHistory(newHist);
    setHistoryIdx(newHist.length - 1);
  };

  const handleUndo = () => {
    if (historyIdx > 0) {
      const prev = history[historyIdx - 1];
      if (prev) {
        setHistoryIdx(historyIdx - 1);
        setDoc(prev);
        setSelectedElementId(null);
      }
    }
  };

  const handleRedo = () => {
    if (historyIdx < history.length - 1) {
      const next = history[historyIdx + 1];
      if (next) {
        setHistoryIdx(historyIdx + 1);
        setDoc(next);
        setSelectedElementId(null);
      }
    }
  };

  // Keyboard shortcuts (Ctrl+Z, Ctrl+Y, Delete, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedElementId && document.activeElement?.tagName !== "INPUT") {
          e.preventDefault();
          deleteSelectedElement();
        }
      } else if (e.key === "Escape") {
        setActiveTool("select");
        setSelectedElementId(null);
        setBondStartPoint(null);
        setCurvedStartPoint(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [historyIdx, history, selectedElementId]);

  // AI Structure Recognition
  const handleRunAiRecognition = async () => {
    if (!referenceImageUrl) {
      toast.error("No reference image found to analyze.");
      return;
    }

    setIsRecognizing(true);
    const toastId = toast.loading("Analyzing structure & geometry with CamDraw Vision...");

    try {
      const res = await fetch("/api/team/camdraw/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageSource: referenceImageUrl,
          hintSubject,
          preferredType: category,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to recognize structure.");
      }

      const result = json.data;
      if (result?.document && result.document.elements?.length > 0) {
        updateDocument(result.document);
        toast.success(
          `Reconstructed structure with ${result.confidence}% confidence!`,
          { id: toastId }
        );
      } else {
        toast.warning(
          "Could not detect scientific structure clearly. Please create or refine manually.",
          { id: toastId }
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Recognition failed.", { id: toastId });
    } finally {
      setIsRecognizing(false);
    }
  };

  // Convert client click coordinates to SVG viewbox coordinates
  const getCanvasCoords = (e: React.MouseEvent<SVGSVGElement>): { x: number; y: number } => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const scaleX = (doc.canvas.width || 900) / rect.width;
    const scaleY = (doc.canvas.height || 560) / rect.height;

    let x = Math.round(clientX * scaleX);
    let y = Math.round(clientY * scaleY);

    // Snap to grid (10px grid)
    if (showGrid) {
      x = Math.round(x / 10) * 10;
      y = Math.round(y / 10) * 10;
    }

    return { x, y };
  };

  // Handle Canvas Click to add or select elements
  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const coords = getCanvasCoords(e);
    const id = `el_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    if (activeTool === "atom") {
      const sym = customAtomInput.trim() || selectedAtomSymbol;
      const newAtom: AtomElement = {
        id,
        type: "atom",
        x: coords.x,
        y: coords.y,
        symbol: sym,
        fontSize: 18,
      };
      updateDocument({
        ...doc,
        elements: [...doc.elements, newAtom],
      });
      setSelectedElementId(id);
    } else if (activeTool === "ring") {
      const newRing: RingElement = {
        id,
        type: "ring",
        ringType: selectedRingType,
        cx: coords.x,
        cy: coords.y,
        radius: 60,
        rotation: 0,
        aromaticCircle: selectedRingType === "benzene",
      };
      updateDocument({
        ...doc,
        elements: [...doc.elements, newRing],
      });
      setSelectedElementId(id);
    } else if (activeTool === "bond") {
      if (!bondStartPoint) {
        setBondStartPoint(coords);
        toast.info("Click second point to finish bond");
      } else {
        const newBond: BondElement = {
          id,
          type: "bond",
          start: bondStartPoint,
          end: coords,
          bondType: selectedBondType,
          thickness: 2.2,
        };
        updateDocument({
          ...doc,
          elements: [...doc.elements, newBond],
        });
        setBondStartPoint(null);
        setSelectedElementId(id);
      }
    } else if (activeTool === "reaction_arrow") {
      if (!bondStartPoint) {
        setBondStartPoint(coords);
        toast.info("Click arrow end position");
      } else {
        const newArrow: ReactionArrowElement = {
          id,
          type: "reaction_arrow",
          start: bondStartPoint,
          end: coords,
          arrowStyle: "forward",
          topReagents: reactionTopText.trim() || undefined,
          bottomConditions: reactionBottomText.trim() || undefined,
          thickness: 2.5,
        };
        updateDocument({
          ...doc,
          elements: [...doc.elements, newArrow],
        });
        setBondStartPoint(null);
        setSelectedElementId(id);
      }
    } else if (activeTool === "curved_arrow") {
      if (!curvedStartPoint) {
        setCurvedStartPoint(coords);
        toast.info("Click arrow destination");
      } else {
        const midX = (curvedStartPoint.x + coords.x) / 2;
        const midY = Math.min(curvedStartPoint.y, coords.y) - 40;
        const newCurved: CurvedArrowElement = {
          id,
          type: "curved_arrow",
          start: curvedStartPoint,
          control: { x: midX, y: midY },
          end: coords,
          arrowHead: "double_barb",
          thickness: 2,
        };
        updateDocument({
          ...doc,
          elements: [...doc.elements, newCurved],
        });
        setCurvedStartPoint(null);
        setSelectedElementId(id);
      }
    } else if (activeTool === "physics_symbol") {
      const newPhys: PhysicsSymbolElement = {
        id,
        type: "physics_symbol",
        symbolType: selectedPhysSymbol,
        x: coords.x,
        y: coords.y,
        width: 80,
        height: 40,
        label: selectedPhysSymbol.toUpperCase(),
      };
      updateDocument({
        ...doc,
        elements: [...doc.elements, newPhys],
      });
      setSelectedElementId(id);
    } else if (activeTool === "bio_shape") {
      const newBio: BioShapeElement = {
        id,
        type: "bio_shape",
        shapeType: selectedBioShape,
        x: coords.x,
        y: coords.y,
        width: 140,
        height: 90,
        label: selectedBioShape.replace("_", " "),
      };
      updateDocument({
        ...doc,
        elements: [...doc.elements, newBio],
      });
      setSelectedElementId(id);
    } else if (activeTool === "math_plot") {
      const newMath: MathPlotElement = {
        id,
        type: "math_plot",
        plotType: "axes",
        cx: coords.x,
        cy: coords.y,
        width: 200,
        height: 160,
        xLabel: "X",
        yLabel: "Y",
      };
      updateDocument({
        ...doc,
        elements: [...doc.elements, newMath],
      });
      setSelectedElementId(id);
    } else if (activeTool === "text") {
      const textVal = prompt("Enter text annotation:") || "";
      if (textVal.trim()) {
        const newText: TextAnnotationElement = {
          id,
          type: "text",
          x: coords.x,
          y: coords.y,
          text: textVal.trim(),
          fontSize: 16,
          fontWeight: "bold",
        };
        updateDocument({
          ...doc,
          elements: [...doc.elements, newText],
        });
        setSelectedElementId(id);
      }
    }
  };

  // Delete currently selected element
  const deleteSelectedElement = () => {
    if (!selectedElementId) return;
    updateDocument({
      ...doc,
      elements: doc.elements.filter((el) => el.id !== selectedElementId),
    });
    setSelectedElementId(null);
    toast.info("Element deleted");
  };

  // Duplicate currently selected element
  const duplicateSelectedElement = () => {
    if (!selectedElementId) return;
    const target = doc.elements.find((el) => el.id === selectedElementId);
    if (!target) return;

    const newId = `el_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const cloned = JSON.parse(JSON.stringify(target));
    cloned.id = newId;

    if ("x" in cloned) cloned.x += 20;
    if ("y" in cloned) cloned.y += 20;
    if ("cx" in cloned) cloned.cx += 20;
    if ("cy" in cloned) cloned.cy += 20;
    if ("start" in cloned) {
      cloned.start.x += 20;
      cloned.start.y += 20;
      cloned.end.x += 20;
      cloned.end.y += 20;
    }

    updateDocument({
      ...doc,
      elements: [...doc.elements, cloned],
    });
    setSelectedElementId(newId);
    toast.success("Element duplicated");
  };

  // Load preset template
  const loadTemplate = (tpl: (typeof CAMDRAW_TEMPLATES)[0]) => {
    updateDocument(tpl.doc);
    setShowTemplatesModal(false);
    toast.success(`Loaded "${tpl.name}" template!`);
  };

  // Export SVG to download
  const handleExportSvg = () => {
    const svgStr = exportCamDrawToSvgString(doc);
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `camdraw-structure-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("SVG downloaded!");
  };

  // Save and Return to Question
  const handleSaveAndApply = () => {
    const finalDoc: CamDrawDocument = {
      ...doc,
      metadata: {
        ...doc.metadata,
        matchMode,
      },
    };
    onSave(finalDoc);
    if (onClose) onClose();
  };

  const selectedEl = doc.elements.find((el) => el.id === selectedElementId);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white select-none animate-in fade-in">
      {/* 1. TOP HEADER BAR */}
      <header className="h-14 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight text-white flex items-center gap-2">
                <span>{title}</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Vector Engine v1.0
                </span>
              </h1>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="hidden md:flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 ml-4">
            {(["chemistry", "physics", "biology", "math", "custom"] as ActiveCategory[]).map(
              (cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition ${
                    category === cat
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {cat}
                </button>
              )
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Reference Split view toggle */}
          {referenceImageUrl && (
            <button
              type="button"
              onClick={() => setShowReferenceSideBySide((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                showReferenceSideBySide
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
              }`}
            >
              <Split className="w-3.5 h-3.5" />
              <span>Reference Split</span>
            </button>
          )}

          {/* AI Re-detect button */}
          {referenceImageUrl && (
            <button
              type="button"
              disabled={isRecognizing}
              onClick={handleRunAiRecognition}
              className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-md transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>{isRecognizing ? "Recognizing..." : "Recreate with AI"}</span>
            </button>
          )}

          {/* Template presets button */}
          <button
            type="button"
            onClick={() => setShowTemplatesModal(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Presets</span>
          </button>

          {/* Save & Apply */}
          <button
            type="button"
            onClick={handleSaveAndApply}
            className="px-4 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Apply to Question</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title="Close Editor"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* 2. MAIN WORKSPACE */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT REFERENCE PANEL (If Split view is active) */}
        {showReferenceSideBySide && referenceImageUrl && (
          <div className="w-1/3 min-w-[320px] max-w-md bg-slate-900/90 border-r border-slate-800 flex flex-col shrink-0">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-black text-slate-200">Reference Source</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                Original Geometry
              </span>
            </div>
            <div className="flex-1 p-4 overflow-auto flex items-center justify-center bg-slate-950/50">
              <img
                src={referenceImageUrl}
                alt="Original Question Reference"
                className="max-w-full max-h-full object-contain rounded-xl border border-slate-800 shadow-lg"
              />
            </div>
            {doc.metadata?.confidence !== undefined && (
              <div className="p-3 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">CamDraw Fidelity:</span>
                  <span
                    className={`text-xs font-black px-2 py-0.5 rounded-full ${
                      doc.metadata.confidence >= 80
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    }`}
                  >
                    {doc.metadata.confidence}%
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-bold">
                  <button
                    type="button"
                    onClick={() => setMatchMode("MATCH_REFERENCE")}
                    className={`px-2 py-1 rounded ${
                      matchMode === "MATCH_REFERENCE"
                        ? "bg-blue-600 text-white"
                        : "hover:bg-slate-800"
                    }`}
                  >
                    Match Geometry
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatchMode("AUTO_ORGANIZE")}
                    className={`px-2 py-1 rounded ${
                      matchMode === "AUTO_ORGANIZE"
                        ? "bg-blue-600 text-white"
                        : "hover:bg-slate-800"
                    }`}
                  >
                    Auto Layout
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PRIMARY CANVAS AREA */}
        <div className="flex-1 flex flex-col relative overflow-hidden bg-slate-950">
          {/* Canvas Sub-Toolbar */}
          <div className="h-11 px-4 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between shrink-0 text-xs">
            {/* Subject Specific Tool Selectors */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              <button
                type="button"
                onClick={() => setActiveTool("select")}
                className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition ${
                  activeTool === "select"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-800 text-slate-300 hover:text-white"
                }`}
              >
                <Move className="w-3.5 h-3.5" />
                <span>Select / Move</span>
              </button>

              {category === "chemistry" && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTool("atom")}
                    className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition ${
                      activeTool === "atom"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:text-white"
                    }`}
                  >
                    <AtomIcon className="w-3.5 h-3.5" />
                    <span>Atom ({selectedAtomSymbol})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTool("bond")}
                    className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition ${
                      activeTool === "bond"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:text-white"
                    }`}
                  >
                    <span>— Bond ({selectedBondType})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTool("ring")}
                    className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition ${
                      activeTool === "ring"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:text-white"
                    }`}
                  >
                    <CircleDot className="w-3.5 h-3.5" />
                    <span>Ring ({selectedRingType})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTool("reaction_arrow")}
                    className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition ${
                      activeTool === "reaction_arrow"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:text-white"
                    }`}
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Reaction Arrow</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTool("curved_arrow")}
                    className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition ${
                      activeTool === "curved_arrow"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:text-white"
                    }`}
                  >
                    <RotateCw className="w-3.5 h-3.5 text-red-400" />
                    <span>Curved Arrow</span>
                  </button>
                </>
              )}

              {category === "physics" && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTool("physics_symbol")}
                    className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition ${
                      activeTool === "physics_symbol"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:text-white"
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Symbol ({selectedPhysSymbol})</span>
                  </button>
                </>
              )}

              {category === "biology" && (
                <button
                  type="button"
                  onClick={() => setActiveTool("bio_shape")}
                  className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition ${
                    activeTool === "bio_shape"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800 text-slate-300 hover:text-white"
                  }`}
                >
                  <CircleDot className="w-3.5 h-3.5" />
                  <span>Bio Structure ({selectedBioShape})</span>
                </button>
              )}

              {category === "math" && (
                <button
                  type="button"
                  onClick={() => setActiveTool("math_plot")}
                  className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition ${
                    activeTool === "math_plot"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800 text-slate-300 hover:text-white"
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>Axes / Curve</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveTool("text")}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition ${
                  activeTool === "text"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:text-white"
                }`}
              >
                <span>Text Label</span>
              </button>
            </div>

            {/* Utility Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleUndo}
                disabled={historyIdx === 0}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white disabled:opacity-30"
                title="Undo (Ctrl+Z)"
              >
                <Undo className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={historyIdx >= history.length - 1}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white disabled:opacity-30"
                title="Redo (Ctrl+Y)"
              >
                <Redo className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowGrid((p) => !p)}
                className={`p-1.5 rounded-lg ${
                  showGrid ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400"
                }`}
                title="Toggle Grid"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleExportSvg}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                title="Download SVG"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* PALETTE TOOLBAR TRAY */}
          <div className="p-2 bg-slate-900 border-b border-slate-800 flex items-center gap-2 overflow-x-auto text-xs">
            {activeTool === "atom" && (
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-slate-400 font-bold mr-1">Atom:</span>
                {[
                  "C",
                  "H",
                  "O",
                  "N",
                  "Cl",
                  "Br",
                  "I",
                  "OH",
                  "COOH",
                  "CHO",
                  "NH2",
                  "NO2",
                  "CH3",
                  "OCH3",
                  "C2H5",
                ].map((sym) => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => {
                      setSelectedAtomSymbol(sym);
                      setCustomAtomInput("");
                    }}
                    className={`px-2 py-0.5 rounded font-mono font-bold transition ${
                      selectedAtomSymbol === sym && !customAtomInput
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {sym}
                  </button>
                ))}
                <input
                  type="text"
                  placeholder="Custom atom..."
                  value={customAtomInput}
                  onChange={(e) => setCustomAtomInput(e.target.value)}
                  className="w-24 px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-white font-mono text-xs"
                />
              </div>
            )}

            {activeTool === "bond" && (
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-slate-400 font-bold mr-1">Bond Type:</span>
                {(
                  [
                    "single",
                    "double",
                    "triple",
                    "wedge",
                    "dash",
                    "wavy",
                    "coordinate",
                  ] as BondType[]
                ).map((bType) => (
                  <button
                    key={bType}
                    type="button"
                    onClick={() => setSelectedBondType(bType)}
                    className={`px-2.5 py-0.5 rounded font-bold capitalize transition ${
                      selectedBondType === bType
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {bType}
                  </button>
                ))}
              </div>
            )}

            {activeTool === "ring" && (
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-slate-400 font-bold mr-1">Ring:</span>
                {(
                  [
                    "benzene",
                    "cyclohexane",
                    "cyclopentane",
                    "cyclobutane",
                    "cyclopropane",
                    "pyridine",
                    "pyrrole",
                    "furan",
                  ] as RingType[]
                ).map((rType) => (
                  <button
                    key={rType}
                    type="button"
                    onClick={() => setSelectedRingType(rType)}
                    className={`px-2.5 py-0.5 rounded font-bold capitalize transition ${
                      selectedRingType === rType
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {rType}
                  </button>
                ))}
              </div>
            )}

            {activeTool === "reaction_arrow" && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-bold">Reagents (Top):</span>
                <input
                  type="text"
                  value={reactionTopText}
                  onChange={(e) => setReactionTopText(e.target.value)}
                  placeholder="e.g. KMnO4 / H+"
                  className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-white text-xs w-36"
                />
                <span className="text-[11px] text-slate-400 font-bold">Conditions (Bottom):</span>
                <input
                  type="text"
                  value={reactionBottomText}
                  onChange={(e) => setReactionBottomText(e.target.value)}
                  placeholder="e.g. Δ, 273 K"
                  className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-white text-xs w-28"
                />
              </div>
            )}

            {activeTool === "physics_symbol" && (
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-slate-400 font-bold mr-1">Component:</span>
                {(
                  [
                    "resistor",
                    "capacitor",
                    "battery",
                    "switch",
                    "convex_lens",
                    "force_vector",
                  ] as PhysicsSymbolType[]
                ).map((pType) => (
                  <button
                    key={pType}
                    type="button"
                    onClick={() => setSelectedPhysSymbol(pType)}
                    className={`px-2.5 py-0.5 rounded font-bold capitalize transition ${
                      selectedPhysSymbol === pType
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {pType.replace("_", " ")}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* INTERACTIVE SVG CANVAS */}
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center relative bg-slate-950">
            <div className="border border-slate-800 rounded-2xl bg-slate-900/50 shadow-2xl relative overflow-hidden">
              <svg
                ref={canvasRef}
                viewBox={`0 0 ${doc.canvas.width} ${doc.canvas.height}`}
                className="w-[900px] h-[560px] cursor-crosshair block"
                onClick={handleCanvasClick}
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* SVG Grid Pattern */}
                {showGrid && (
                  <defs>
                    <pattern id="camdraw-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <circle cx="1" cy="1" r="1" fill="#334155" />
                    </pattern>
                  </defs>
                )}
                {showGrid && <rect width="100%" height="100%" fill="url(#camdraw-grid)" />}

                {/* Bond / Arrow drawing line preview */}
                {bondStartPoint && (
                  <line
                    x1={bondStartPoint.x}
                    y1={bondStartPoint.y}
                    x2={bondStartPoint.x + 30}
                    y2={bondStartPoint.y}
                    stroke="#3b82f6"
                    strokeWidth={2}
                    strokeDasharray="4,4"
                  />
                )}

                {/* Render All Document Elements */}
                <CamDrawRenderer
                  document={doc}
                  theme="dark"
                  interactive={true}
                  selectedElementId={selectedElementId}
                  onElementClick={(id) => {
                    setSelectedElementId(id);
                    setActiveTool("select");
                  }}
                />
              </svg>
            </div>
          </div>

          {/* ELEMENT PROPERTY INSPECTOR DOCK (When element is selected) */}
          {selectedEl && (
            <div className="h-12 px-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between shrink-0 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-bold text-blue-400">
                  Selected: {selectedEl.type.toUpperCase()} ({selectedEl.id})
                </span>
                {selectedEl.type === "atom" && (
                  <div className="flex items-center gap-2">
                    <span>Symbol:</span>
                    <input
                      type="text"
                      value={(selectedEl as AtomElement).symbol}
                      onChange={(e) => {
                        const updated = doc.elements.map((el) =>
                          el.id === selectedEl.id ? { ...el, symbol: e.target.value } : el
                        );
                        updateDocument({ ...doc, elements: updated as any });
                      }}
                      className="w-20 px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-white font-mono"
                    />
                    <span>Charge:</span>
                    <input
                      type="text"
                      value={(selectedEl as AtomElement).charge || ""}
                      placeholder="+ / -"
                      onChange={(e) => {
                        const updated = doc.elements.map((el) =>
                          el.id === selectedEl.id ? { ...el, charge: e.target.value || undefined } : el
                        );
                        updateDocument({ ...doc, elements: updated as any });
                      }}
                      className="w-14 px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-white font-mono"
                    />
                  </div>
                )}
                {selectedEl.type === "bond" && (
                  <div className="flex items-center gap-2">
                    <span>Type:</span>
                    <select
                      value={(selectedEl as BondElement).bondType}
                      onChange={(e) => {
                        const updated = doc.elements.map((el) =>
                          el.id === selectedEl.id ? { ...el, bondType: e.target.value as BondType } : el
                        );
                        updateDocument({ ...doc, elements: updated as any });
                      }}
                      className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-white"
                    >
                      <option value="single">Single</option>
                      <option value="double">Double</option>
                      <option value="triple">Triple</option>
                      <option value="wedge">Wedge</option>
                      <option value="dash">Dash</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={duplicateSelectedElement}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Duplicate</span>
                </button>
                <button
                  type="button"
                  onClick={deleteSelectedElement}
                  className="px-2.5 py-1 rounded bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 font-bold flex items-center gap-1 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. PRESET TEMPLATES MODAL */}
      {showTemplatesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-400" />
                <span>CamDraw Standard Academic Presets</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowTemplatesModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {CAMDRAW_TEMPLATES.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => loadTemplate(tpl)}
                  className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-blue-500 transition cursor-pointer group space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {tpl.category}
                    </span>
                    <Plus className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition" />
                  </div>
                  <h4 className="font-bold text-sm text-white group-hover:text-blue-400 transition">
                    {tpl.name}
                  </h4>
                  <p className="text-xs text-slate-400 line-clamp-2">{tpl.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default CamDrawEditor;
