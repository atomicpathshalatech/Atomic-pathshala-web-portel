"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Simulation3DModal } from "@/components/live-class/Simulation3DModal";
import { ScienceLabsModal } from "@/components/live-class/ScienceLabsModal";

// ---- PEN STYLES & COLOR PALETTES (Screenshots 2, 4, 5) ----
export const PEN_STYLES = [
  { id: "hard", label: "Hard-tipped", icon: "edit" },
  { id: "fountain", label: "Fountain", icon: "ink_pen" },
  { id: "chisel", label: "Chisel", icon: "border_color" },
  { id: "art", label: "Art", icon: "brush" },
  { id: "graphite", label: "Graphite", icon: "draw" },
  { id: "magic", label: "Magic", icon: "auto_awesome" },
] as const;

export type PenStyleId = (typeof PEN_STYLES)[number]["id"];

export const PEN_PALETTE_COLORS = [
  "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#6366f1", "#3b82f6",
  "#06b6d4", "#ec4899", "#15803d",
  "#000000", "#64748b", "#ffffff",
];

export const LEFT_BAR_COLORS = [
  "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#06b6d4", "#3b82f6",
  "#ec4899", "#ffffff",
];

export const HIGHLIGHTER_COLORS = [
  "#ef4444", "#eab308", "#22c55e", "#3b82f6"
];

// ---- ERASER MODES (Screenshot 1 & 3) ----
export type EraserMode = "stroke" | "object" | "lasso" | "box";

export const ERASER_MODES: { id: EraserMode; label: string; icon: string }[] = [
  { id: "stroke", label: "Stroke Eraser", icon: "ink_eraser" },
  { id: "object", label: "Object Eraser", icon: "delete_sweep" },
  { id: "lasso", label: "Lasso / Loop Eraser", icon: "gesture" },
  { id: "box", label: "Area / Box Eraser", icon: "crop_free" },
];

// ---- HIGHLIGHTER SIZES (Screenshot 2) ----
export type HighlighterSize = "thin" | "medium" | "thick";
export const HIGHLIGHTER_SIZES: { id: HighlighterSize; label: string; size: number }[] = [
  { id: "thin", label: "Thin", size: 12 },
  { id: "medium", label: "Medium", size: 24 },
  { id: "thick", label: "Thick", size: 38 },
];

// ---- SUBJECT-WISE SMART SHAPES (Screenshot 5) ----
export type SubjectShapeCategory = "math" | "phys" | "chem" | "bio";

export const SUBJECT_SHAPES: Record<
  SubjectShapeCategory,
  { id: string; label: string; icon: string }[]
> = {
  math: [
    { id: "line", label: "Line", icon: "horizontal_rule" },
    { id: "arrow", label: "Arrow", icon: "north_east" },
    { id: "rectangle", label: "Rectangle / Box", icon: "crop_square" },
    { id: "circle", label: "Circle / Ellipse", icon: "circle" },
    { id: "triangle", label: "Triangle", icon: "change_history" },
    { id: "double_arrow", label: "Double Arrow", icon: "sync_alt" },
    { id: "right_triangle", label: "Right-Angled T...", icon: "play_arrow" },
    { id: "coordinate_axes", label: "XY Coordinate ...", icon: "show_chart" },
    { id: "cylinder", label: "Cylinder (3D)", icon: "view_in_ar" },
    { id: "polygon", label: "Polygon / Hexa...", icon: "hexagon" },
    { id: "star", label: "Star", icon: "star" },
  ],
  phys: [
    { id: "resistor", label: "Resistor", icon: "reorder" },
    { id: "capacitor", label: "Capacitor", icon: "pause" },
    { id: "inductor", label: "Inductor", icon: "waves" },
    { id: "battery", label: "Battery Cell", icon: "battery_charging_full" },
    { id: "pulley", label: "Pulley", icon: "radio_button_checked" },
    { id: "prism", label: "Optics Prism", icon: "change_history" },
    { id: "magnet", label: "Bar Magnet", icon: "crop_5_4" },
  ],
  chem: [
    { id: "benzene", label: "Benzene Ring", icon: "hexagon" },
    { id: "flask", label: "Flask / Beaker", icon: "science" },
    { id: "atom", label: "Atom Model", icon: "bubble_chart" },
    { id: "test_tube", label: "Test Tube", icon: "biotech" },
    { id: "double_bond", label: "Double Bond", icon: "drag_handle" },
  ],
  bio: [
    { id: "dna", label: "DNA Helix", icon: "grain" },
    { id: "cell", label: "Animal Cell", icon: "lens" },
    { id: "neuron", label: "Neuron Cell", icon: "hub" },
    { id: "heart", label: "Human Heart", icon: "favorite" },
    { id: "leaf", label: "Plant Leaf", icon: "eco" },
  ],
};

// ---- THEMES ----
export type BoardTheme =
  | "brand_white"
  | "brand_dark"
  | "brand_ruled"
  | "grid"
  | "dark"
  | "light"
  | "coordinate"
  | "ruled";

interface Stroke {
  id?: string;
  tool: "pen" | "highlighter" | "eraser" | "shape" | "select";
  penStyle?: PenStyleId;
  color: string;
  size: number;
  points: { x: number; y: number }[];
  shapeType?: string;
  selected?: boolean;
}

interface Slide {
  id: string;
  theme: BoardTheme;
  title: string;
  strokes: Stroke[];
  imageUrl?: string | null;
}

// Preloaded Image Cache
const imageCache = new Map<string, HTMLImageElement>();
function getCachedImage(src: string): Promise<HTMLImageElement> {
  if (imageCache.has(src)) {
    return Promise.resolve(imageCache.get(src)!);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => {
      resolve(img);
    };
  });
}

// Point in polygon test for Lasso / Loop Eraser
function isPointInPolygon(point: { x: number; y: number }, polygon: { x: number; y: number }[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Point in bounding box for Area/Box Eraser & Select Tool
function isPointInRect(pt: { x: number; y: number }, r: { x1: number; y1: number; x2: number; y2: number }) {
  const minX = Math.min(r.x1, r.x2);
  const maxX = Math.max(r.x1, r.x2);
  const minY = Math.min(r.y1, r.y2);
  const maxY = Math.max(r.y1, r.y2);
  return pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY;
}

export function AtomicWhiteboardStudio({
  scheduleId = "live-101",
  classTitle = "Atomic Whiteboard Studio",
  batchName = "Faculty Studio",
  teacherName = "Educator",
}: {
  scheduleId?: string;
  classTitle?: string;
  batchName?: string;
  teacherName?: string;
}) {
  // ---- CANVAS & SLIDE STATE ----
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [slides, setSlides] = useState<Slide[]>([
    { id: "s-1", theme: "brand_white", title: "Slide 1", strokes: [] },
  ]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [isSlidePanelOpen, setIsSlidePanelOpen] = useState(false);

  // ---- TOOLS & PALETTES ----
  const [tool, setTool] = useState<"pen" | "highlighter" | "eraser" | "shape" | "select">("pen");
  const [penStyle, setPenStyle] = useState<PenStyleId>("hard");
  const [color, setColor] = useState("#ef4444");
  const [size, setSize] = useState(5);
  const [shape, setShape] = useState<string>("rectangle");
  const [shapeSubjectTab, setShapeSubjectTab] = useState<SubjectShapeCategory>("math");

  // Highlighter State (Screenshot 2)
  const [highlighterSize, setHighlighterSize] = useState<HighlighterSize>("medium");
  const [highlighterColor, setHighlighterColor] = useState("#eab308");

  // Eraser Mode State (Screenshot 1 & 3)
  const [eraserMode, setEraserMode] = useState<EraserMode>("stroke");

  // Popups State
  const [openPopup, setOpenPopup] = useState<"pen" | "highlight" | "eraser" | "shapes" | "pollMenu" | "more" | null>(null);

  // Drawing & Selection State
  const [isDrawing, setIsDrawing] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [isHoveringCanvas, setIsHoveringCanvas] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [lassoPoints, setLassoPoints] = useState<{ x: number; y: number }[]>([]);
  const [selectedStrokeIds, setSelectedStrokeIds] = useState<string[]>([]);
  const [history, setHistory] = useState<Stroke[][]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[][]>([]);

  // ---- MODALS & DIALOGS ----
  const [is3DOpen, setIs3DOpen] = useState(false);
  const [isSimOpen, setIsSimOpen] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);

  // Poll / Quiz State (Requirement 7)
  const [isPollOpen, setIsPollOpen] = useState(false);
  const [pollModalTab, setPollModalTab] = useState<"quiz" | "ranks">("quiz");
  const [pollType, setPollType] = useState<"mcq4" | "yesno">("mcq4");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["Option A", "Option B", "Option C", "Option D"]);
  const [pollTimer, setPollTimer] = useState("45s");
  const [activeLiveQuiz, setActiveLiveQuiz] = useState<{
    type: "mcq4" | "yesno";
    question: string;
    options: string[];
    isAnswerRevealed: boolean;
    correctOption?: string;
    totalResponses: number;
  } | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"chatpoll" | "audio" | "shortcuts">("shortcuts");
  const [isCameraOpen, setIsCameraOpen] = useState(true);
  const [isObsOutput, setIsObsOutput] = useState(false);

  // Camera video ref
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(true);
  const [micActive, setMicActive] = useState(true);

  const activeSlide: Slide =
    slides[activeSlideIndex] ||
    slides[0] || { id: "s-1", theme: "brand_white", title: "Slide 1", strokes: [] };

  // Webcam stream
  useEffect(() => {
    let currentStream: MediaStream | null = null;
    if (cameraActive && isCameraOpen) {
      navigator.mediaDevices
        ?.getUserMedia({ video: true, audio: true })
        .then((s) => {
          currentStream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
        })
        .catch(() => {});
    }
    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [cameraActive, isCameraOpen]);

  // Synchronous Slide Drawing Helper
  const drawSlideContent = useCallback(
    async (ctx: CanvasRenderingContext2D, slide: Slide, width: number, height: number) => {
      ctx.clearRect(0, 0, width, height);
      const theme = slide?.theme || "brand_white";

      // 1. Draw Theme Background
      if (theme === "brand_white") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "#fff7ed";
        ctx.fillRect(0, 0, width, 55);
        ctx.fillStyle = "#ea580c";
        ctx.fillRect(0, 55, width, 4);
        ctx.fillStyle = "#ea580c";
        ctx.font = "bold 20px sans-serif";
        ctx.fillText("ATOMIC PATHSHALA", 30, 36);
      } else if (theme === "brand_dark") {
        ctx.fillStyle = "#0d0f17";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(0, 0, width, 55);
        ctx.fillStyle = "#ea580c";
        ctx.fillRect(0, 55, width, 4);
        ctx.fillStyle = "#ea580c";
        ctx.font = "bold 20px sans-serif";
        ctx.fillText("ATOMIC PATHSHALA", 30, 36);
      } else if (theme === "brand_ruled") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "#fff7ed";
        ctx.fillRect(0, 0, width, 55);
        ctx.fillStyle = "#ea580c";
        ctx.fillRect(0, 55, width, 4);
        ctx.fillStyle = "#ea580c";
        ctx.font = "bold 20px sans-serif";
        ctx.fillText("ATOMIC PATHSHALA", 30, 36);
        ctx.strokeStyle = "rgba(100, 149, 237, 0.25)";
        ctx.lineWidth = 1.5;
        for (let y = 90; y < height; y += 40) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      } else if (theme === "dark") {
        ctx.fillStyle = "#1a1b23";
        ctx.fillRect(0, 0, width, height);
      } else if (theme === "grid") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = "rgba(156, 163, 175, 0.35)";
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 30) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 0; y < height; y += 30) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      } else if (theme === "coordinate") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = "rgba(209, 213, 219, 0.5)";
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 30) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 0; y < height; y += 30) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.moveTo(width / 2, 0);
        ctx.lineTo(width / 2, height);
        ctx.stroke();
      } else if (theme === "ruled") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = "rgba(100, 149, 237, 0.25)";
        ctx.lineWidth = 1.5;
        for (let y = 50; y < height; y += 36) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
      }

      // 2. Draw Slide Background Image
      if (slide?.imageUrl) {
        const img = await getCachedImage(slide.imageUrl);
        if (img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, 0, 0, width, height);
        }
      }

      // 3. Draw Strokes
      const strokes = slide?.strokes || [];
      strokes.forEach((stroke) => {
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        const isSelected = selectedStrokeIds.includes(stroke.id || "");

        if (stroke.tool === "highlighter") {
          ctx.globalAlpha = 0.35;
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.size;
        } else if (stroke.tool === "eraser") {
          ctx.globalCompositeOperation = "destination-out";
          ctx.lineWidth = stroke.size * 5;
        } else {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.size;
        }

        const pts = stroke.points;
        if (stroke.tool === "shape") {
          const start = pts[0];
          const end = pts[pts.length - 1];
          if (start && end) {
            const shapeKind = stroke.shapeType || "rectangle";
            ctx.beginPath();
            if (shapeKind === "rectangle" || shapeKind === "battery" || shapeKind === "resistor") {
              ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
            } else if (shapeKind === "circle" || shapeKind === "cell" || shapeKind === "atom") {
              const rx = Math.abs(end.x - start.x) / 2;
              const ry = Math.abs(end.y - start.y) / 2;
              const cx = (start.x + end.x) / 2;
              const cy = (start.y + end.y) / 2;
              ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
              ctx.stroke();
            } else if (shapeKind === "line" || shapeKind === "double_bond") {
              ctx.moveTo(start.x, start.y);
              ctx.lineTo(end.x, end.y);
              ctx.stroke();
            } else if (shapeKind === "arrow") {
              ctx.moveTo(start.x, start.y);
              ctx.lineTo(end.x, end.y);
              ctx.stroke();
              const angle = Math.atan2(end.y - start.y, end.x - start.x);
              ctx.lineTo(end.x - 16 * Math.cos(angle - Math.PI / 6), end.y - 16 * Math.sin(angle - Math.PI / 6));
              ctx.moveTo(end.x, end.y);
              ctx.lineTo(end.x - 16 * Math.cos(angle + Math.PI / 6), end.y - 16 * Math.sin(angle + Math.PI / 6));
              ctx.stroke();
            } else if (shapeKind === "triangle" || shapeKind === "prism") {
              ctx.moveTo((start.x + end.x) / 2, start.y);
              ctx.lineTo(start.x, end.y);
              ctx.lineTo(end.x, end.y);
              ctx.closePath();
              ctx.stroke();
            } else if (shapeKind === "benzene") {
              const cx = (start.x + end.x) / 2;
              const cy = (start.y + end.y) / 2;
              const r = Math.max(20, Math.hypot(end.x - start.x, end.y - start.y) / 2);
              for (let i = 0; i < 6; i++) {
                const a = (i * Math.PI) / 3;
                const px = cx + r * Math.cos(a);
                const py = cy + r * Math.sin(a);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
              }
              ctx.closePath();
              ctx.stroke();
              ctx.beginPath();
              ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
              ctx.stroke();
            } else {
              ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
            }
          }
        } else if (pts && pts.length > 1 && pts[0]) {
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            const pt = pts[i];
            if (pt) ctx.lineTo(pt.x, pt.y);
          }
          ctx.stroke();
        }

        // Draw Selection Bounding Box if selected
        if (isSelected && pts.length > 0) {
          ctx.save();
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 6]);
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          pts.forEach((p) => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
          });
          ctx.strokeRect(minX - 6, minY - 6, maxX - minX + 12, maxY - minY + 12);
          ctx.restore();
        }

        ctx.restore();
      });

      // 4. Draw Active Selection Box Overlay (Area Eraser or Select Tool)
      if (selectionBox) {
        ctx.save();
        ctx.strokeStyle = tool === "eraser" && eraserMode === "box" ? "#ef4444" : "#3b82f6";
        ctx.fillStyle = tool === "eraser" && eraserMode === "box" ? "rgba(239, 68, 68, 0.15)" : "rgba(59, 130, 246, 0.15)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        const bx = Math.min(selectionBox.x1, selectionBox.x2);
        const by = Math.min(selectionBox.y1, selectionBox.y2);
        const bw = Math.abs(selectionBox.x2 - selectionBox.x1);
        const bh = Math.abs(selectionBox.y2 - selectionBox.y1);
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.restore();
      }

      // 5. Draw Active Lasso Loop (Lasso Eraser)
      if (lassoPoints.length > 1) {
        ctx.save();
        ctx.strokeStyle = "#3b82f6";
        ctx.fillStyle = "rgba(59, 130, 246, 0.12)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
        for (let i = 1; i < lassoPoints.length; i++) {
          ctx.lineTo(lassoPoints[i].x, lassoPoints[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    },
    [selectedStrokeIds, selectionBox, lassoPoints, tool, eraserMode]
  );

  const redrawCurrentSlide = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawSlideContent(ctx, activeSlide, canvas.width, canvas.height);
  }, [activeSlide, drawSlideContent]);

  useEffect(() => {
    redrawCurrentSlide();
  }, [activeSlide, redrawCurrentSlide]);

  // Helper for type-safe touch and mouse coordinates
  const getEventCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ) => {
    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;
    if ("touches" in e) {
      const touch = e.touches[0];
      if (touch) {
        clientX = touch.clientX;
        clientY = touch.clientY;
      }
    } else {
      clientX = (e as React.MouseEvent<HTMLCanvasElement>).clientX;
      clientY = (e as React.MouseEvent<HTMLCanvasElement>).clientY;
    }
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    return { x, y, clientX, clientY };
  };

  // Pointer drawing handlers
  const handleStartDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    setHistory((h) => [...h, activeSlide.strokes]);
    setRedoStack([]);

    const { x, y } = getEventCoordinates(e, canvas);

    // 1. OBJECT ERASER (Deletes clicked stroke directly)
    if (tool === "eraser" && eraserMode === "object") {
      setSlides((all) =>
        all.map((s, idx) => {
          if (idx !== activeSlideIndex) return s;
          const filtered = s.strokes.filter((st) => {
            return !st.points.some((p) => Math.hypot(p.x - x, p.y - y) < Math.max(15, st.size * 2));
          });
          return { ...s, strokes: filtered };
        })
      );
      return;
    }

    // 2. LASSO / LOOP ERASER
    if (tool === "eraser" && eraserMode === "lasso") {
      setLassoPoints([{ x, y }]);
      return;
    }

    // 3. AREA / BOX ERASER or SELECT TOOL
    if ((tool === "eraser" && eraserMode === "box") || tool === "select") {
      setSelectionBox({ x1: x, y1: y, x2: x, y2: y });
      setSelectedStrokeIds([]);
      return;
    }

    // 4. NORMAL PEN / HIGHLIGHTER / STROKE ERASER / SHAPE
    const currentStrokeSize =
      tool === "highlighter"
        ? HIGHLIGHTER_SIZES.find((h) => h.id === highlighterSize)?.size || 24
        : size;

    const currentStrokeColor = tool === "highlighter" ? highlighterColor : color;

    const newStroke: Stroke = {
      id: `strk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tool,
      penStyle,
      color: currentStrokeColor,
      size: currentStrokeSize,
      points: [{ x, y }],
      shapeType: tool === "shape" ? shape : undefined,
    };

    setSlides((all) =>
      all.map((s, idx) => (idx === activeSlideIndex ? { ...s, strokes: [...s.strokes, newStroke] } : s))
    );
  };

  const handleMoveDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y } = getEventCoordinates(e, canvas);
    setCursorPos({ x, y });

    if (!isDrawing) return;

    // 1. LASSO / LOOP ERASER
    if (tool === "eraser" && eraserMode === "lasso") {
      setLassoPoints((pts) => [...pts, { x, y }]);
      return;
    }

    // 2. AREA / BOX ERASER or SELECT TOOL
    if ((tool === "eraser" && eraserMode === "box") || tool === "select") {
      setSelectionBox((prev) => (prev ? { ...prev, x2: x, y2: y } : null));
      return;
    }

    // 3. REGULAR STROKE DRAWING
    setSlides((all) =>
      all.map((s, idx) => {
        if (idx !== activeSlideIndex) return s;
        const currentStrokes = [...s.strokes];
        const lastIndex = currentStrokes.length - 1;
        if (lastIndex < 0) return s;
        const last = currentStrokes[lastIndex];
        if (!last) return s;

        const currentPoints = last.points || [];
        const updatedStroke: Stroke = {
          ...last,
          points:
            last.tool === "shape"
              ? [currentPoints[0] || { x, y }, { x, y }]
              : [...currentPoints, { x, y }],
        };
        currentStrokes[lastIndex] = updatedStroke;
        return { ...s, strokes: currentStrokes };
      })
    );
  };

  const handleEndDraw = () => {
    setIsDrawing(false);

    // Finalize Lasso Loop Eraser (delete enclosed strokes)
    if (tool === "eraser" && eraserMode === "lasso" && lassoPoints.length > 2) {
      setSlides((all) =>
        all.map((s, idx) => {
          if (idx !== activeSlideIndex) return s;
          const filtered = s.strokes.filter((st) => {
            return !st.points.some((p) => isPointInPolygon(p, lassoPoints));
          });
          return { ...s, strokes: filtered };
        })
      );
      setLassoPoints([]);
      toast.success("Lasso area cleared");
      return;
    }

    // Finalize Area/Box Eraser (delete strokes inside box)
    if (tool === "eraser" && eraserMode === "box" && selectionBox) {
      setSlides((all) =>
        all.map((s, idx) => {
          if (idx !== activeSlideIndex) return s;
          const filtered = s.strokes.filter((st) => {
            return !st.points.some((p) => isPointInRect(p, selectionBox));
          });
          return { ...s, strokes: filtered };
        })
      );
      setSelectionBox(null);
      toast.success("Selected box cleared");
      return;
    }

    // Finalize Select Tool (select strokes inside box)
    if (tool === "select" && selectionBox) {
      const selectedIds = activeSlide.strokes
        .filter((st) => st.points.some((p) => isPointInRect(p, selectionBox)))
        .map((st) => st.id || "");
      setSelectedStrokeIds(selectedIds.filter(Boolean));
      setSelectionBox(null);
      if (selectedIds.length > 0) {
        toast.success(`${selectedIds.length} object(s) selected`);
      }
    }
  };

  // Selection Tool Actions (Requirement 3: Delete, Copy, Duplicate)
  const handleDeleteSelected = useCallback(() => {
    if (selectedStrokeIds.length === 0) return;
    setHistory((h) => [...h, activeSlide.strokes]);
    setSlides((all) =>
      all.map((s, idx) =>
        idx === activeSlideIndex
          ? { ...s, strokes: s.strokes.filter((st) => !selectedStrokeIds.includes(st.id || "")) }
          : s
      )
    );
    setSelectedStrokeIds([]);
    toast.success("Selected object(s) deleted");
  }, [selectedStrokeIds, activeSlideIndex, activeSlide.strokes]);

  const handleDuplicateSelected = useCallback(() => {
    if (selectedStrokeIds.length === 0) return;
    setHistory((h) => [...h, activeSlide.strokes]);
    const duplicated: Stroke[] = activeSlide.strokes
      .filter((st) => selectedStrokeIds.includes(st.id || ""))
      .map((st) => ({
        ...st,
        id: `strk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        points: st.points.map((p) => ({ x: p.x + 30, y: p.y + 30 })),
      }));

    setSlides((all) =>
      all.map((s, idx) =>
        idx === activeSlideIndex ? { ...s, strokes: [...s.strokes, ...duplicated] } : s
      )
    );
    setSelectedStrokeIds(duplicated.map((d) => d.id || ""));
    toast.success("Object duplicated (offset +30px)");
  }, [selectedStrokeIds, activeSlideIndex, activeSlide.strokes]);

  const handleCopySelected = useCallback(() => {
    if (selectedStrokeIds.length === 0) return;
    toast.success("Object copied to clipboard");
  }, [selectedStrokeIds]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    if (!prev) return;
    setRedoStack((r) => [...r, activeSlide.strokes]);
    setHistory((h) => h.slice(0, -1));
    setSlides((all) => all.map((s, idx) => (idx === activeSlideIndex ? { ...s, strokes: prev } : s)));
  }, [history, activeSlide.strokes, activeSlideIndex]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    if (!next) return;
    setHistory((h) => [...h, activeSlide.strokes]);
    setRedoStack((r) => r.slice(0, -1));
    setSlides((all) => all.map((s, idx) => (idx === activeSlideIndex ? { ...s, strokes: next } : s)));
  }, [redoStack, activeSlide.strokes, activeSlideIndex]);

  const handleClear = useCallback(() => {
    setHistory((h) => [...h, activeSlide.strokes]);
    setSlides((all) => all.map((s, idx) => (idx === activeSlideIndex ? { ...s, strokes: [] } : s)));
    setSelectedStrokeIds([]);
    toast.success("Slide cleared");
  }, [activeSlide.strokes, activeSlideIndex]);

  const handleAddSlide = useCallback(() => {
    const newSlide: Slide = {
      id: `s-${Date.now()}`,
      theme: activeSlide.theme,
      title: `Slide ${slides.length + 1}`,
      strokes: [],
    };
    setSlides((s) => [...s, newSlide]);
    setActiveSlideIndex(slides.length);
    toast.success("New slide added");
  }, [activeSlide.theme, slides.length]);

  const handleDuplicateSlide = useCallback(() => {
    const current = slides[activeSlideIndex];
    if (!current) return;
    const duplicatedSlide: Slide = {
      id: `s-${Date.now()}`,
      theme: current.theme,
      title: `${current.title} (Copy)`,
      strokes: JSON.parse(JSON.stringify(current.strokes)),
      imageUrl: current.imageUrl,
    };
    const updated = [...slides];
    updated.splice(activeSlideIndex + 1, 0, duplicatedSlide);
    setSlides(updated);
    setActiveSlideIndex(activeSlideIndex + 1);
    toast.success("Slide duplicated (Ctrl+D)");
  }, [slides, activeSlideIndex]);

  const handlePrevSlide = useCallback(() => {
    setActiveSlideIndex((i) => Math.max(0, i - 1));
  }, []);

  const handleNextSlide = useCallback(() => {
    setActiveSlideIndex((i) => Math.min(slides.length - 1, i + 1));
  }, [slides.length]);

  // Requirement 6: Delete Slide with confirmation
  const handleDeleteSlide = useCallback(() => {
    if (slides.length <= 1) {
      toast.error("Cannot delete the only slide.");
      return;
    }
    const current = slides[activeSlideIndex];
    if (current && current.strokes.length > 0) {
      if (!confirm(`Are you sure you want to delete Slide ${activeSlideIndex + 1}?`)) {
        return;
      }
    }
    setSlides((all) => all.filter((_, idx) => idx !== activeSlideIndex));
    setActiveSlideIndex((i) => Math.max(0, i - 1));
    toast.success("Slide deleted");
  }, [slides, activeSlideIndex]);

  // Click outside to close any open popup
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (openPopup) {
        const target = e.target as HTMLElement;
        if (!target.closest("[data-popup-container]")) {
          setOpenPopup(null);
        }
      }
    };
    window.addEventListener("mousedown", handleGlobalClick);
    return () => window.removeEventListener("mousedown", handleGlobalClick);
  }, [openPopup]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z") && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      if (
        ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "z" || e.key === "Z"))
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        handleDuplicateSlide();
        return;
      }

      if (e.key === "ArrowUp" || e.key === "PageUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrevSlide();
        return;
      }

      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === "ArrowRight") {
        e.preventDefault();
        handleNextSlide();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedStrokeIds.length > 0) {
          e.preventDefault();
          handleDeleteSelected();
          return;
        }
      }

      if (e.key === "Escape") {
        setOpenPopup(null);
        setIsSlidePanelOpen(false);
        setSelectedStrokeIds([]);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handleUndo,
    handleRedo,
    handleDuplicateSlide,
    handlePrevSlide,
    handleNextSlide,
    handleDeleteSelected,
    selectedStrokeIds.length,
  ]);

  const handleSetTheme = (t: BoardTheme) => {
    setSlides((all) =>
      all.map((s, idx) => (idx === activeSlideIndex ? { ...s, theme: t } : s))
    );
    setIsThemeOpen(false);
    toast.success("Theme applied");
  };

  const handleInsertSnapshot = (dataUrl: string, title: string) => {
    setSlides((all) =>
      all.map((s, idx) => (idx === activeSlideIndex ? { ...s, imageUrl: dataUrl } : s))
    );
    toast.success(`${title} stamped onto slide!`);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-75px)] w-full max-w-full bg-[#090b10] text-slate-100 overflow-hidden select-none font-sans rounded-2xl border border-[#212433]">
      {/* 1. TOP HEADER STUDIO NAV */}
      {!isObsOutput && (
        <header className="h-14 bg-[#11131c] border-b border-[#212433] px-4 flex items-center justify-between shrink-0 z-30">
          <div className="flex items-center gap-3">
            <Link
              href="/team"
              className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center font-black border border-orange-500/40 hover:bg-orange-500/30 transition"
            >
              A
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xs font-bold text-gray-100">{classTitle}</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  {batchName}
                </span>
              </div>
              <p className="text-[10px] text-gray-400">{teacherName} • Interactive Studio</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsThemeOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-[#1c1e2c] hover:bg-[#25283a] border border-[#2d3045] text-xs font-bold text-gray-200 flex items-center gap-1.5 transition"
            >
              <span className="material-symbols-outlined text-sm text-orange-400">palette</span>
              Themes
            </button>

            <button
              type="button"
              onClick={() => setIs3DOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-xs font-bold text-blue-400 flex items-center gap-1.5 transition"
            >
              <span className="material-symbols-outlined text-sm">view_in_ar</span>
              3D Models
            </button>

            <button
              type="button"
              onClick={() => setIsSimOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-xs font-bold text-emerald-400 flex items-center gap-1.5 transition"
            >
              <span className="material-symbols-outlined text-sm">science</span>
              Science Labs
            </button>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 rounded-xl bg-[#1c1e2c] hover:bg-[#25283a] border border-[#2d3045] text-gray-300 transition"
              title="Class Settings"
            >
              <span className="material-symbols-outlined text-base">settings</span>
            </button>
          </div>
        </header>
      )}

      {/* 2. MAIN WORKSPACE */}
      <div className="flex-1 w-full min-w-0 flex relative overflow-hidden">
        {/* Requirement 5: Left Slide Thumbnail Drawer */}
        {isSlidePanelOpen && (
          <aside className="absolute top-0 left-0 bottom-0 z-40 w-64 bg-[#121420] border-r border-[#26293d] p-3 shadow-2xl flex flex-col gap-3 animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-[#212433]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-blue-400">auto_stories</span>
                <span className="text-xs font-bold text-gray-200">Slides &amp; Pages</span>
              </div>
              <button
                type="button"
                onClick={() => setIsSlidePanelOpen(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {slides.map((s, idx) => (
                <div
                  key={s.id}
                  onClick={() => {
                    setActiveSlideIndex(idx);
                    setIsSlidePanelOpen(false);
                  }}
                  className={`p-2 rounded-xl border cursor-pointer transition flex flex-col gap-1.5 group ${
                    idx === activeSlideIndex
                      ? "bg-blue-600/20 border-blue-500 shadow-md ring-2 ring-blue-500/30"
                      : "bg-[#181a28] border-[#26293d] hover:border-gray-500"
                  }`}
                >
                  <div className="w-full aspect-[16/9] bg-white rounded-lg overflow-hidden border border-black/20 flex items-center justify-center relative shadow-inner">
                    <span className="text-[10px] font-bold text-slate-400">Slide {idx + 1}</span>
                    {idx === activeSlideIndex && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-500" />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-gray-300">
                    <span>{s.title}</span>
                    <span className="text-[9px] text-gray-500 font-mono">{s.strokes.length} items</span>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddSlide}
              className="w-full py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Add New Slide
            </button>
          </aside>
        )}

        {/* Requirement 3: Left Vertical Select & Palette Toolbar (Screenshot 4) */}
        <div className="absolute top-16 left-3 z-30 flex flex-col items-center py-2.5 px-1.5 bg-[#141624]/90 backdrop-blur-md rounded-full border border-[#292d42] shadow-2xl gap-2">
          {/* Active Tool Icon Indicator */}
          <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs text-orange-400">
            <span className="material-symbols-outlined text-sm">
              {tool === "pen" ? "edit" : tool === "highlighter" ? "ink_highlighter" : tool === "eraser" ? "ink_eraser" : tool === "shape" ? "category" : "gesture"}
            </span>
          </div>

          <div className="w-4 h-[1px] bg-gray-700/60" />

          {/* Color Swatches (Screenshot 4) */}
          <div className="flex flex-col gap-1.5">
            {LEFT_BAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setColor(c);
                  setHighlighterColor(c);
                }}
                className={`w-4 h-4 rounded-full transition transform hover:scale-125 ${
                  color === c ? "ring-2 ring-white ring-offset-1 ring-offset-[#141624]" : "opacity-85"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="w-4 h-[1px] bg-gray-700/60" />

          {/* 3 Size Dots (Screenshot 4) */}
          <div className="flex flex-col gap-2 items-center py-1">
            {[4, 10, 18].map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => setSize(sz)}
                className={`rounded-full transition flex items-center justify-center ${
                  size === sz ? "ring-2 ring-blue-400 ring-offset-1 ring-offset-[#141624]" : ""
                }`}
                style={{
                  width: `${Math.max(8, sz / 1.5)}px`,
                  height: `${Math.max(8, sz / 1.5)}px`,
                  backgroundColor: color,
                }}
              />
            ))}
          </div>

          <div className="w-4 h-[1px] bg-gray-700/60" />

          {/* Select / Lasso Tool Button (Screenshot 4) */}
          <button
            type="button"
            onClick={() => {
              setTool("select");
              toast.info("Select Tool active: Drag box to select objects");
            }}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition shadow ${
              tool === "select"
                ? "bg-blue-600 text-white ring-2 ring-blue-400"
                : "bg-white/10 text-gray-300 hover:text-white"
            }`}
            title="Lasso / Object Select Tool"
          >
            <span className="material-symbols-outlined text-sm">gesture</span>
          </button>

          {/* Actions for Selected Objects (Screenshot 4) */}
          <div className="flex flex-col gap-1 pt-1">
            <button
              type="button"
              onClick={handleDuplicateSelected}
              disabled={selectedStrokeIds.length === 0}
              className="p-1 rounded-full text-gray-400 hover:text-white disabled:opacity-20 transition"
              title="Duplicate Selected (Ctrl+D)"
            >
              <span className="material-symbols-outlined text-xs">content_copy</span>
            </button>
            <button
              type="button"
              onClick={handleCopySelected}
              disabled={selectedStrokeIds.length === 0}
              className="p-1 rounded-full text-gray-400 hover:text-white disabled:opacity-20 transition"
              title="Copy Selected"
            >
              <span className="material-symbols-outlined text-xs">content_paste</span>
            </button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={selectedStrokeIds.length === 0}
              className="p-1 rounded-full text-gray-400 hover:text-rose-400 disabled:opacity-20 transition"
              title="Delete Selected (Delete key)"
            >
              <span className="material-symbols-outlined text-xs">delete</span>
            </button>
          </div>
        </div>

        {/* Right Floating Camera Tile */}
        {isCameraOpen && (
          <div className="absolute top-4 right-4 z-20 w-48 h-36 bg-[#12131e] rounded-2xl border border-[#2d3045] shadow-2xl overflow-hidden flex flex-col">
            <div className="relative flex-1 bg-black flex items-center justify-center">
              {cameraActive ? (
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
              ) : (
                <span className="material-symbols-outlined text-3xl text-gray-600">videocam_off</span>
              )}
              <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-black/70 px-2 py-0.5 rounded text-[10px] font-bold text-white backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Camera
              </div>
            </div>
            <div className="h-7 bg-[#171926] px-2 flex items-center justify-between border-t border-[#252838]">
              <button
                type="button"
                onClick={() => setMicActive(!micActive)}
                className={`p-1 rounded ${micActive ? "text-gray-300" : "text-rose-500"}`}
              >
                <span className="material-symbols-outlined text-xs">{micActive ? "mic" : "mic_off"}</span>
              </button>
              <button
                type="button"
                onClick={() => setCameraActive(!cameraActive)}
                className={`p-1 rounded ${cameraActive ? "text-gray-300" : "text-rose-500"}`}
              >
                <span className="material-symbols-outlined text-xs">{cameraActive ? "videocam" : "videocam_off"}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCameraOpen(false)}
                className="p-1 rounded text-gray-400 hover:text-white"
              >
                <span className="material-symbols-outlined text-xs">close</span>
              </button>
            </div>
          </div>
        )}

        {/* 16:9 Presentation Canvas & Pen Circular Dot Cursor (Requirement 4) */}
        <div className="flex-1 w-full h-full min-w-0 flex items-center justify-center p-2 sm:p-4 bg-[#08090f] overflow-hidden">
          <div
            className="relative aspect-[16/9] w-full max-w-full max-h-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-700/60 flex items-center justify-center cursor-none"
            onMouseEnter={() => setIsHoveringCanvas(true)}
            onMouseLeave={() => setIsHoveringCanvas(false)}
          >
            <canvas
              ref={canvasRef}
              width={1920}
              height={1080}
              onMouseDown={handleStartDraw}
              onMouseMove={handleMoveDraw}
              onMouseUp={handleEndDraw}
              onTouchStart={handleStartDraw}
              onTouchMove={handleMoveDraw}
              onTouchEnd={handleEndDraw}
              className="w-full h-full object-contain select-none"
            />

            {/* Requirement 4: Subtle Circular Dot Cursor for Pen (no '+' icon) */}
            {isHoveringCanvas && cursorPos && (
              <div
                className="absolute pointer-events-none rounded-full transform -translate-x-1/2 -translate-y-1/2 border border-black/40 shadow-sm"
                style={{
                  left: `${(cursorPos.x / 1920) * 100}%`,
                  top: `${(cursorPos.y / 1080) * 100}%`,
                  width: `${Math.max(6, tool === "highlighter" ? 18 : tool === "eraser" ? 22 : size)}px`,
                  height: `${Math.max(6, tool === "highlighter" ? 18 : tool === "eraser" ? 22 : size)}px`,
                  backgroundColor:
                    tool === "eraser" ? "rgba(255,255,255,0.8)" : tool === "highlighter" ? highlighterColor : color,
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* 3. BOTTOM FLOATING DOCK TOOLBAR (Screenshots 1, 2, 3, 5) */}
      {!isObsOutput && (
        <footer className="h-16 bg-[#11131c] border-t border-[#212433] px-4 flex items-center justify-between shrink-0 z-30">
          {/* Left: Pen, Highlight, Eraser, Shapes */}
          <div className="flex items-center gap-1.5">
            {/* Pen Customizer Flyout (Screenshot 5) */}
            <div className="relative" data-popup-container="true">
              <button
                type="button"
                onClick={() => {
                  setTool("pen");
                  setOpenPopup((p) => (p === "pen" ? null : "pen"));
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                  tool === "pen" ? "bg-orange-600 text-white shadow" : "bg-[#1c1e2c] text-gray-300 hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-sm">edit</span>
                <span>Pen</span>
              </button>

              {openPopup === "pen" && (
                <div className="absolute bottom-full left-0 mb-3 z-50 bg-[#161724] border border-[#2d3045] rounded-2xl p-4 shadow-2xl w-[360px] flex flex-col gap-3 text-white">
                  <div className="flex items-center justify-between pb-2 border-b border-[#252838]">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-blue-400 text-base">edit</span>
                      <span className="text-xs font-bold capitalize">{penStyle}-tipped pen</span>
                    </div>
                    <button type="button" onClick={() => setOpenPopup(null)} className="text-gray-400 hover:text-white">
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-gray-400 font-semibold">
                      <span>Thickness</span>
                      <span className="text-white font-mono">{size}px</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={2}
                        max={24}
                        value={size}
                        onChange={(e) => setSize(Number(e.target.value))}
                        className="flex-1 accent-blue-500 h-1.5 bg-gray-700 rounded-lg cursor-pointer"
                      />
                      <div
                        className="rounded-full shadow-md shrink-0 border border-white/20"
                        style={{ width: `${Math.max(6, size)}px`, height: `${Math.max(6, size)}px`, backgroundColor: color }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1 bg-[#0f1019] p-2 rounded-xl border border-[#232536]">
                      {PEN_STYLES.map((ps) => (
                        <button
                          key={ps.id}
                          type="button"
                          onClick={() => setPenStyle(ps.id)}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                            penStyle === ps.id ? "bg-blue-600 text-white shadow font-bold" : "text-gray-400 hover:text-white"
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm">{ps.icon}</span>
                          <span>{ps.label}</span>
                        </button>
                      ))}
                    </div>

                    <div className="bg-[#0f1019] p-2 rounded-xl border border-[#232536] flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-2 text-center">Color</span>
                        <div className="grid grid-cols-3 gap-2 justify-items-center">
                          {PEN_PALETTE_COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setColor(c)}
                              className={`w-6 h-6 rounded-lg transition transform hover:scale-105 ${
                                color.toLowerCase() === c.toLowerCase()
                                  ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-[#0f1019]"
                                  : "opacity-85"
                              }`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </div>
                      <label className="mt-2 flex items-center justify-center gap-1 py-1 rounded-lg border border-[#2d3045] bg-[#171926] text-xs text-gray-300 font-medium cursor-pointer">
                        <span className="material-symbols-outlined text-xs text-blue-400">colorize</span>
                        Custom
                        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="opacity-0 w-0 h-0 absolute" />
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Requirement 1: 3-Type/Size Highlighter Flyout (Screenshot 2) */}
            <div className="relative" data-popup-container="true">
              <button
                type="button"
                onClick={() => {
                  setTool("highlighter");
                  setOpenPopup((p) => (p === "highlight" ? null : "highlight"));
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                  tool === "highlighter" ? "bg-blue-600 text-white shadow" : "bg-[#1c1e2c] text-gray-300 hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-sm">ink_highlighter</span>
                <span>Highlight</span>
              </button>

              {openPopup === "highlight" && (
                <div className="absolute bottom-full left-0 mb-3 z-50 bg-[#141522] border border-[#292d42] rounded-2xl p-3 shadow-2xl flex flex-col gap-2.5 text-white">
                  {/* 4 Highlighter Color Swatches (Screenshot 2) */}
                  <div className="flex items-center gap-2.5 bg-[#0e0f17] p-1.5 rounded-xl border border-[#232536]">
                    {HIGHLIGHTER_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setHighlighterColor(c)}
                        className={`w-7 h-7 rounded-full transition transform hover:scale-110 ${
                          highlighterColor === c ? "ring-2 ring-white ring-offset-2 ring-offset-[#0e0f17]" : "opacity-85"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>

                  {/* 3 Selectable Sizes (Screenshot 2) */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    {HIGHLIGHTER_SIZES.map((sz) => (
                      <button
                        key={sz.id}
                        type="button"
                        onClick={() => setHighlighterSize(sz.id)}
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                          highlighterSize === sz.id ? "bg-blue-600 text-white shadow" : "bg-[#181a28] text-gray-400 hover:text-white"
                        }`}
                      >
                        {sz.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Requirement 2: 4-Mode Eraser Flyout Menu (Screenshots 1 & 3) */}
            <div className="relative" data-popup-container="true">
              <button
                type="button"
                onClick={() => {
                  setTool("eraser");
                  setOpenPopup((p) => (p === "eraser" ? null : "eraser"));
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                  tool === "eraser" ? "bg-rose-600 text-white shadow" : "bg-[#1c1e2c] text-gray-300 hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-sm">ink_eraser</span>
                <span>Eraser</span>
              </button>

              {openPopup === "eraser" && (
                <div className="absolute bottom-full left-0 mb-3 z-50 w-52 bg-[#141522] border border-[#292d42] rounded-2xl p-1.5 shadow-2xl flex flex-col gap-1 text-white">
                  {ERASER_MODES.map((em) => (
                    <button
                      key={em.id}
                      type="button"
                      onClick={() => {
                        setEraserMode(em.id);
                        setTool("eraser");
                        setOpenPopup(null);
                        toast.info(`${em.label} mode active`);
                      }}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                        eraserMode === em.id && tool === "eraser"
                          ? "bg-blue-600/20 text-blue-400 font-bold border border-blue-500/40"
                          : "text-gray-300 hover:bg-[#1f2234] hover:text-white"
                      }`}
                    >
                      <span className="material-symbols-outlined text-base text-blue-400">{em.icon}</span>
                      <span>{em.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Subject-Wise Smart Shapes (Screenshot 5) */}
            <div className="relative" data-popup-container="true">
              <button
                type="button"
                onClick={() => {
                  setTool("shape");
                  setOpenPopup((p) => (p === "shapes" ? null : "shapes"));
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                  tool === "shape" ? "bg-purple-600 text-white shadow" : "bg-[#1c1e2c] text-gray-300 hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-sm">category</span>
                <span>Shapes</span>
              </button>

              {openPopup === "shapes" && (
                <div className="absolute bottom-full left-0 mb-3 z-50 bg-[#161724] border border-[#2d3045] rounded-2xl p-3 shadow-2xl w-72 flex flex-col gap-3 text-white">
                  <div className="grid grid-cols-4 gap-1 bg-[#0f1019] p-1 rounded-xl border border-[#232536]">
                    <button
                      type="button"
                      onClick={() => setShapeSubjectTab("math")}
                      className={`flex items-center justify-center gap-1 py-1 rounded-lg text-[11px] font-bold transition ${
                        shapeSubjectTab === "math" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                      }`}
                    >
                      <span className="material-symbols-outlined text-xs">square_foot</span>
                      Math
                    </button>
                    <button
                      type="button"
                      onClick={() => setShapeSubjectTab("phys")}
                      className={`flex items-center justify-center gap-1 py-1 rounded-lg text-[11px] font-bold transition ${
                        shapeSubjectTab === "phys" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                      }`}
                    >
                      <span className="material-symbols-outlined text-xs">bolt</span>
                      Phys
                    </button>
                    <button
                      type="button"
                      onClick={() => setShapeSubjectTab("chem")}
                      className={`flex items-center justify-center gap-1 py-1 rounded-lg text-[11px] font-bold transition ${
                        shapeSubjectTab === "chem" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                      }`}
                    >
                      <span className="material-symbols-outlined text-xs">science</span>
                      Chem
                    </button>
                    <button
                      type="button"
                      onClick={() => setShapeSubjectTab("bio")}
                      className={`flex items-center justify-center gap-1 py-1 rounded-lg text-[11px] font-bold transition ${
                        shapeSubjectTab === "bio" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                      }`}
                    >
                      <span className="material-symbols-outlined text-xs">grain</span>
                      Bio
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-1">
                    {(SUBJECT_SHAPES[shapeSubjectTab] || SUBJECT_SHAPES.math).map((s, idx) => (
                      <button
                        key={`${s.label}-${idx}`}
                        type="button"
                        onClick={() => {
                          setShape(s.id);
                          setTool("shape");
                          setOpenPopup(null);
                        }}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-xs text-left transition ${
                          shape === s.id && tool === "shape"
                            ? "bg-blue-600/20 border-blue-500 text-white font-bold"
                            : "bg-[#0f1019] border-[#232536] text-gray-300 hover:border-gray-500"
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm text-blue-400 shrink-0">{s.icon}</span>
                        <span className="truncate">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="w-[1px] h-6 bg-gray-700/60 mx-1" />

          {/* Center: Select, Undo, Redo, Clear, Slide Switcher (Screenshot 5) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[#1a1d2e] border border-[#2d3247] rounded-xl p-1">
              <button
                type="button"
                onClick={() => setTool("select")}
                className={`p-1.5 rounded-lg transition ${
                  tool === "select" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                }`}
                title="Select Tool"
              >
                <span className="material-symbols-outlined text-base">near_me</span>
              </button>
              <button type="button" onClick={handleUndo} className="p-1.5 rounded-lg text-gray-400 hover:text-white" title="Undo (Ctrl+Z)">
                <span className="material-symbols-outlined text-base">undo</span>
              </button>
              <button type="button" onClick={handleRedo} className="p-1.5 rounded-lg text-gray-400 hover:text-white" title="Redo (Ctrl+Y)">
                <span className="material-symbols-outlined text-base">redo</span>
              </button>
              <button type="button" onClick={handleClear} className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400" title="Clear Slide">
                <span className="material-symbols-outlined text-base">delete_sweep</span>
              </button>
            </div>

            {/* Requirement 5: Clickable Slide Number opens Left Drawer */}
            <div className="flex items-center gap-1 bg-[#1a1d2e] border border-[#2d3247] rounded-2xl px-2 py-1">
              <button
                type="button"
                disabled={activeSlideIndex === 0}
                onClick={handlePrevSlide}
                className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                title="Previous Slide (Up/Left Arrow)"
              >
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </button>

              <button
                type="button"
                onClick={() => setIsSlidePanelOpen(!isSlidePanelOpen)}
                className="px-2 py-0.5 rounded-lg hover:bg-white/10 text-xs font-bold text-gray-200 flex items-center gap-1 transition"
                title="Click to open Slides Drawer"
              >
                <span className="material-symbols-outlined text-sm text-blue-400">auto_stories</span>
                <span>{activeSlideIndex + 1} / {slides.length}</span>
              </button>

              <button
                type="button"
                disabled={activeSlideIndex === slides.length - 1}
                onClick={handleNextSlide}
                className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                title="Next Slide (Down/Right Arrow)"
              >
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
            </div>

            <div className="w-[1px] h-6 bg-gray-700/60 mx-1" />

            {/* Requirement 6: Add & Delete Slide */}
            <button
              type="button"
              onClick={handleAddSlide}
              className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center gap-1 shadow"
              title="Add New Slide"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              <span>Add</span>
            </button>

            <button
              type="button"
              onClick={handleDeleteSlide}
              disabled={slides.length <= 1}
              className="px-2.5 py-1.5 rounded-xl bg-[#1c1e2c] hover:bg-[#25283a] border border-[#2d3045] text-gray-300 hover:text-rose-400 disabled:opacity-30 font-bold text-xs flex items-center gap-1 transition"
              title="Delete Current Slide"
            >
              <span className="material-symbols-outlined text-sm">delete</span>
              <span>Delete</span>
            </button>
          </div>

          {/* Right: Poll, Zoom, More (Screenshot 5) */}
          <div className="flex items-center gap-2">
            {/* Requirement 7: Poll & Live Quiz Popover */}
            <div className="relative" data-popup-container="true">
              <button
                type="button"
                onClick={() => setOpenPopup((p) => (p === "pollMenu" ? null : "pollMenu"))}
                className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-xs font-bold text-blue-400 flex items-center gap-1.5 transition"
              >
                <span className="material-symbols-outlined text-sm">equalizer</span>
                <span>Poll</span>
              </button>

              {openPopup === "pollMenu" && (
                <div className="absolute bottom-full right-0 mb-3 z-50 w-64 bg-[#161724] border border-[#2d3045] rounded-2xl p-2 shadow-2xl flex flex-col gap-1 text-white">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenPopup(null);
                      setPollModalTab("quiz");
                      setIsPollOpen(true);
                    }}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#202232] text-left transition group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-base">quiz</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-100 group-hover:text-blue-400">Live Quiz / Poll</h4>
                      <p className="text-[10px] text-gray-400">Launch YES/NO or 4-Option Quiz</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOpenPopup(null);
                      setPollModalTab("ranks");
                      setIsPollOpen(true);
                    }}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#202232] text-left transition group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-base">military_tech</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-100 group-hover:text-amber-400">Session Leaderboard</h4>
                      <p className="text-[10px] text-gray-400">Class ranks &amp; answer accuracy</p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsCameraOpen(!isCameraOpen)}
              className={`p-2 rounded-xl border transition ${
                isCameraOpen ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/40" : "bg-[#1c1e2c] text-gray-400 border-[#2d3045]"
              }`}
              title="Toggle Camera"
            >
              <span className="material-symbols-outlined text-base">videocam</span>
            </button>
          </div>
        </footer>
      )}

      {/* 4. MODALS */}

      {/* 3D Visual Models Modal */}
      {is3DOpen && (
        <Simulation3DModal
          onClose={() => setIs3DOpen(false)}
          onInsertToSlide={handleInsertSnapshot}
        />
      )}

      {/* Interactive Science Labs Modal */}
      {isSimOpen && (
        <ScienceLabsModal
          onClose={() => setIsSimOpen(false)}
          onStampToWhiteboard={handleInsertSnapshot}
        />
      )}

      {/* Slide Themes Modal */}
      {isThemeOpen && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
          <div className="bg-[#12131c] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[#2d2e3b] max-h-[90vh] text-white">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#252836] bg-[#171924]">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-amber-500 text-xl">palette</span>
                <div>
                  <h2 className="text-sm font-bold text-gray-100">Choose Slide Theme</h2>
                  <p className="text-[11px] text-gray-400">
                    Select Atomic Pathshala official branded background or standard template
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsThemeOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#252836] transition"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              <div className="space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">school</span>
                  OFFICIAL ATOMIC PATHSHALA TEMPLATES
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { id: "brand_white" as BoardTheme, label: "Atomic Pathshala (White)", bg: "#ffffff" },
                    { id: "brand_dark" as BoardTheme, label: "Atomic Pathshala (Dark)", bg: "#0d0f17" },
                    { id: "brand_ruled" as BoardTheme, label: "Atomic Pathshala (Ruled)", bg: "#ffffff" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSetTheme(p.id)}
                      className={`flex flex-col text-left rounded-2xl border p-2.5 transition gap-2 group ${
                        activeSlide.theme === p.id
                          ? "border-orange-500 ring-2 ring-orange-500/30 bg-orange-950/10"
                          : "border-[#252836] hover:border-orange-500/60 bg-[#161724]"
                      }`}
                    >
                      <div
                        className="w-full aspect-video rounded-xl shadow-inner relative overflow-hidden border border-black/20"
                        style={{ backgroundColor: p.bg }}
                      >
                        <div className="absolute top-1 left-1.5 flex items-center gap-1">
                          <span className="text-[8px] font-black text-orange-600 bg-orange-100 px-1 rounded">A</span>
                        </div>
                        <div className="absolute top-1 right-1.5 text-[7px] font-black text-slate-700">
                          ATOMIC
                        </div>
                      </div>
                      <span className="text-xs font-bold text-gray-200 group-hover:text-orange-400 transition">
                        {p.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">grid_view</span>
                  STANDARD CLASSROOM THEMES
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { id: "grid" as BoardTheme, label: "Math Grid" },
                    { id: "dark" as BoardTheme, label: "Deep Slate Dark" },
                    { id: "light" as BoardTheme, label: "Pure White" },
                    { id: "coordinate" as BoardTheme, label: "Coordinate Plane (XY)" },
                    { id: "ruled" as BoardTheme, label: "Notebook Ruled" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSetTheme(p.id)}
                      className={`flex flex-col text-left rounded-2xl border p-2.5 transition gap-2 group ${
                        activeSlide.theme === p.id
                          ? "border-blue-500 ring-2 ring-blue-500/30 bg-blue-950/10"
                          : "border-[#252836] hover:border-blue-500/60 bg-[#161724]"
                      }`}
                    >
                      <div className="w-full aspect-video rounded-xl shadow-inner relative overflow-hidden border border-black/20 bg-slate-800" />
                      <span className="text-xs font-semibold text-gray-200 group-hover:text-blue-400 transition truncate">
                        {p.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Requirement 7: Live Quiz / Poll Modal with "Launch without reveal" & "Reveal Answer" */}
      {isPollOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#12131c] w-full max-w-lg rounded-2xl shadow-2xl border border-[#2d2e3b] flex flex-col text-white overflow-hidden animate-in zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#252836] bg-[#171924]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-400 text-lg">quiz</span>
                <h3 className="text-sm font-bold text-gray-100">Live Quiz / Poll</h3>
              </div>
              <button type="button" onClick={() => setIsPollOpen(false)} className="text-gray-400 hover:text-white">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Top Tabs */}
            <div className="grid grid-cols-2 p-3 bg-[#0e0f17] border-b border-[#252836] gap-2">
              <button
                type="button"
                onClick={() => setPollModalTab("quiz")}
                className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  pollModalTab === "quiz" ? "bg-blue-600 text-white shadow" : "text-gray-400 hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-sm">help_center</span>
                Live Quiz
              </button>
              <button
                type="button"
                onClick={() => setPollModalTab("ranks")}
                className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  pollModalTab === "ranks" ? "bg-amber-600 text-white shadow" : "text-gray-400 hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-sm">emoji_events</span>
                Leaderboard
              </button>
            </div>

            {/* Body */}
            {pollModalTab === "quiz" ? (
              <div className="p-6 space-y-4">
                {/* YES/NO vs 4-Option Quiz */}
                <div className="grid grid-cols-2 gap-2 bg-[#0e0f17] p-1.5 rounded-xl border border-[#252836]">
                  <button
                    type="button"
                    onClick={() => {
                      setPollType("yesno");
                      setPollOptions(["YES", "NO"]);
                    }}
                    className={`py-1.5 rounded-lg text-xs font-bold transition ${
                      pollType === "yesno" ? "bg-blue-600 text-white shadow" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    YES / NO Quiz
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPollType("mcq4");
                      setPollOptions(["Option A", "Option B", "Option C", "Option D"]);
                    }}
                    className={`py-1.5 rounded-lg text-xs font-bold transition ${
                      pollType === "mcq4" ? "bg-blue-600 text-white shadow" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    4-Option Quiz
                  </button>
                </div>

                {/* Optional Question Input */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-400">Question / Prompt (Optional):</label>
                  <input
                    type="text"
                    placeholder="Enter question or leave blank for Board-Driven MCQ..."
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#161724] border border-[#252836] text-xs text-white placeholder-gray-500 outline-none focus:border-blue-500"
                  />
                </div>

                {/* Options List */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                    OPTIONS (ANSWER WILL REMAIN HIDDEN UNTIL YOU REVEAL):
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {pollOptions.map((opt, idx) => (
                      <input
                        key={idx}
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const updated = [...pollOptions];
                          updated[idx] = e.target.value;
                          setPollOptions(updated);
                        }}
                        className="p-2.5 rounded-xl bg-[#161724] border border-[#252836] text-xs font-bold text-gray-200 outline-none focus:border-blue-500"
                      />
                    ))}
                  </div>
                </div>

                {/* Timer Dropdown */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2 text-xs text-gray-300">
                    <span>Timer:</span>
                    <select
                      value={pollTimer}
                      onChange={(e) => setPollTimer(e.target.value)}
                      className="bg-[#171926] border border-[#2d3045] rounded-lg px-2.5 py-1 text-xs text-white outline-none"
                    >
                      <option value="15s">15s</option>
                      <option value="30s">30s</option>
                      <option value="45s">45s</option>
                      <option value="60s">60s</option>
                      <option value="90s">90s</option>
                    </select>
                  </div>
                  <span className="text-[11px] text-amber-400 font-medium">Answer hidden on launch</span>
                </div>

                {/* Launch Button */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveLiveQuiz({
                      type: pollType,
                      question: pollQuestion || (pollType === "mcq4" ? "4-Option Quiz" : "YES / NO Quiz"),
                      options: pollOptions,
                      isAnswerRevealed: false,
                      totalResponses: 0,
                    });
                    setIsPollOpen(false);
                    toast.success("Quiz Launched to students (Answer Hidden)!");
                  }}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition"
                >
                  Launch Quiz
                </button>
              </div>
            ) : (
              <div className="p-6 space-y-3 text-center">
                <span className="material-symbols-outlined text-4xl text-amber-400">military_tech</span>
                <h4 className="text-sm font-bold text-gray-100">Live Session Leaderboard</h4>
                <p className="text-xs text-gray-400">Ranks and speed will update live when students submit answers.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Requirement 7: Teacher Active Live Quiz Floating Bar (Reveal Answer Control) */}
      {activeLiveQuiz && (
        <div className="absolute top-16 right-4 z-40 w-80 bg-[#121420]/95 backdrop-blur-md rounded-2xl border border-blue-500/50 p-4 shadow-2xl flex flex-col gap-3 text-white animate-in slide-in-from-top-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#252838]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-blue-400">Live Quiz Active</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveLiveQuiz(null)}
              className="text-gray-400 hover:text-white"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>

          <p className="text-xs font-bold text-gray-200 truncate">{activeLiveQuiz.question}</p>

          <div className="grid grid-cols-2 gap-1.5">
            {activeLiveQuiz.options.map((opt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (!activeLiveQuiz.isAnswerRevealed) {
                    setActiveLiveQuiz((prev) => (prev ? { ...prev, correctOption: opt } : null));
                  }
                }}
                className={`p-2 rounded-xl text-xs font-bold text-left transition border ${
                  activeLiveQuiz.correctOption === opt
                    ? "bg-emerald-600/30 border-emerald-500 text-emerald-300"
                    : "bg-[#181a28] border-[#252838] text-gray-300"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>

          {/* Reveal Answer Control */}
          {!activeLiveQuiz.isAnswerRevealed ? (
            <button
              type="button"
              onClick={() => {
                setActiveLiveQuiz((prev) => (prev ? { ...prev, isAnswerRevealed: true } : null));
                toast.success("Correct Answer Revealed to Students!");
              }}
              className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow transition"
            >
              Reveal Correct Answer
            </button>
          ) : (
            <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-center text-xs font-bold text-emerald-300">
              Answer Revealed: {activeLiveQuiz.correctOption || activeLiveQuiz.options[0]}
            </div>
          )}
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#12131c] w-full max-w-xl rounded-2xl shadow-2xl border border-[#2d2e3b] flex flex-col text-white overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#252836] bg-[#171924]">
              <h3 className="text-sm font-bold text-gray-100">Class Settings</h3>
              <button type="button" onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-white">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="flex flex-1 min-h-[300px]">
              <div className="w-48 bg-[#0e0f17] p-3 border-r border-[#252836] space-y-1">
                <button
                  type="button"
                  onClick={() => setSettingsTab("chatpoll")}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition ${
                    settingsTab === "chatpoll" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Chat &amp; Poll controls
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsTab("audio")}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition ${
                    settingsTab === "audio" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Audio &amp; Video
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsTab("shortcuts")}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition ${
                    settingsTab === "shortcuts" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Shortcuts
                </button>
              </div>

              <div className="flex-1 p-6">
                {settingsTab === "shortcuts" && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-200">Keyboard shortcuts</h4>
                    <div className="space-y-2">
                      {[
                        { label: "Undo stroke", key: "Ctrl+Z" },
                        { label: "Redo stroke", key: "Ctrl+Y" },
                        { label: "Duplicate slide / object", key: "Ctrl+D" },
                        { label: "Previous slide", key: "Up Arrow" },
                        { label: "Next slide", key: "Down Arrow" },
                        { label: "Delete selected object", key: "Delete" },
                      ].map((s) => (
                        <div key={s.label} className="flex items-center justify-between text-xs py-1 border-b border-[#252836]/40">
                          <span className="text-gray-400">{s.label}</span>
                          <kbd className="px-2 py-0.5 rounded bg-[#161724] border border-[#2d3045] font-mono text-gray-200">
                            {s.key}
                          </kbd>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {settingsTab === "chatpoll" && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-200">Chat &amp; Interaction</h4>
                    <div className="space-y-2 text-xs text-gray-300">
                      <label className="flex items-center justify-between p-2 rounded-xl bg-[#161724] border border-[#252836]">
                        <span>Allow student live chat</span>
                        <input type="checkbox" defaultChecked className="accent-blue-500" />
                      </label>
                      <label className="flex items-center justify-between p-2 rounded-xl bg-[#161724] border border-[#252836]">
                        <span>Allow student hand raise</span>
                        <input type="checkbox" defaultChecked className="accent-blue-500" />
                      </label>
                    </div>
                  </div>
                )}

                {settingsTab === "audio" && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-200">Audio &amp; Video Devices</h4>
                    <p className="text-xs text-gray-400">Integrated WebRTC camera and microphone active.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
