"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Simulation3DModal } from "@/components/live-class/Simulation3DModal";
import { ScienceLabsModal } from "@/components/live-class/ScienceLabsModal";

// ---- PEN STYLES & COLOR PALETTE (Screenshot 5) ----
export const PEN_STYLES = [
  { id: "hard", label: "Hard-tipped", icon: "edit" },
  { id: "fountain", label: "Fountain", icon: "ink_pen" },
  { id: "chisel", label: "Chisel", icon: "border_color" },
  { id: "art", label: "Art", icon: "brush" },
  { id: "graphite", label: "Graphite", icon: "draw" },
  { id: "magic", label: "Magic", icon: "auto_awesome" },
] as const;

export type PenStyleId = typeof PEN_STYLES[number]["id"];

export const PEN_PALETTE_COLORS = [
  "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#6366f1", "#3b82f6",
  "#06b6d4", "#ec4899", "#15803d",
  "#000000", "#64748b", "#ffffff",
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

// ---- THEMES (Screenshot 4) ----
export type BoardTheme =
  | "brand_white"
  | "brand_dark"
  | "brand_ruled"
  | "grid"
  | "dark"
  | "light"
  | "coordinate"
  | "ruled";

interface Slide {
  id: string;
  theme: BoardTheme;
  title: string;
  strokes: Stroke[];
  imageUrl?: string | null;
}

interface Stroke {
  tool: "pen" | "highlighter" | "eraser" | "shape";
  penStyle?: PenStyleId;
  color: string;
  size: number;
  points: { x: number; y: number }[];
  shapeType?: string;
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

  // ---- TOOLS & PALETTES (Screenshot 5) ----
  const [tool, setTool] = useState<"pen" | "highlighter" | "eraser" | "shape" | "select">("pen");
  const [penStyle, setPenStyle] = useState<PenStyleId>("hard");
  const [color, setColor] = useState("#ef4444");
  const [size, setSize] = useState(5);
  const [shape, setShape] = useState<string>("rectangle");
  const [shapeSubjectTab, setShapeSubjectTab] = useState<SubjectShapeCategory>("math");
  const [openPopup, setOpenPopup] = useState<"pen" | "shapes" | "pollMenu" | "more" | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<Stroke[][]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[][]>([]);

  // ---- MODALS & DIALOGS ----
  const [is3DOpen, setIs3DOpen] = useState(false);
  const [isSimOpen, setIsSimOpen] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [isPollOpen, setIsPollOpen] = useState(false);
  const [pollModalTab, setPollModalTab] = useState<"quiz" | "ranks">("quiz");
  const [pollType, setPollType] = useState<"mcq4" | "yesno">("mcq4");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"chatpoll" | "audio" | "shortcuts">("shortcuts");
  const [isCameraOpen, setIsCameraOpen] = useState(true);
  const [isObsOutput, setIsObsOutput] = useState(false);

  // Camera video ref
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(true);
  const [micActive, setMicActive] = useState(true);

  const activeSlide: Slide = slides[activeSlideIndex] || slides[0] || { id: "s-1", theme: "brand_white", title: "Slide 1", strokes: [] };

  // Webcam stream
  useEffect(() => {
    let currentStream: MediaStream | null = null;
    if (cameraActive && isCameraOpen) {
      navigator.mediaDevices?.getUserMedia({ video: true, audio: true })
        .then((s) => {
          currentStream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
        })
        .catch(() => {
          // Camera permission soft fallback
        });
    }
    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [cameraActive, isCameraOpen]);

  // Synchronous Slide Drawing Helper
  const drawSlideContent = useCallback(async (
    ctx: CanvasRenderingContext2D,
    slide: Slide,
    width: number,
    height: number
  ) => {
    ctx.clearRect(0, 0, width, height);
    const theme = slide?.theme || "brand_white";

    // 1. Draw Theme Background (Screenshot 4)
    if (theme === "brand_white") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      // Branded Header Bar
      ctx.fillStyle = "#fff7ed";
      ctx.fillRect(0, 0, width, 55);
      ctx.fillStyle = "#ea580c";
      ctx.fillRect(0, 55, width, 4);
      // Logo text
      ctx.fillStyle = "#ea580c";
      ctx.font = "bold 20px sans-serif";
      ctx.fillText("ATOMIC PATHSHALA", 30, 36);
    } else if (theme === "brand_dark") {
      ctx.fillStyle = "#0d0f17";
      ctx.fillRect(0, 0, width, height);
      // Dark Header Bar
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
      // Header
      ctx.fillStyle = "#fff7ed";
      ctx.fillRect(0, 0, width, 55);
      ctx.fillStyle = "#ea580c";
      ctx.fillRect(0, 55, width, 4);
      ctx.fillStyle = "#ea580c";
      ctx.font = "bold 20px sans-serif";
      ctx.fillText("ATOMIC PATHSHALA", 30, 36);
      // Notebook ruled lines
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
      // Main Axes
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

    // 2. Draw Slide Background Image (if 3D / Science simulation snapshot uploaded)
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

      if (stroke.tool === "highlighter") {
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = stroke.color === "#ffffff" ? "#fef08a" : stroke.color;
        ctx.lineWidth = stroke.size * 3.5;
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
      } else if (pts.length > 1) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();
      }
      ctx.restore();
    });
  }, []);

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

  // Pointer drawing handlers
  const handleStartDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    setHistory((h) => [...h, activeSlide.strokes]);
    setRedoStack([]);

    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    const newStroke: Stroke = {
      tool,
      penStyle,
      color,
      size,
      points: [{ x, y }],
      shapeType: tool === "shape" ? shape : undefined,
    };

    setSlides((all) =>
      all.map((s, idx) => (idx === activeSlideIndex ? { ...s, strokes: [...s.strokes, newStroke] } : s))
    );
  };

  const handleMoveDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    setSlides((all) =>
      all.map((s, idx) => {
        if (idx !== activeSlideIndex) return s;
        const currentStrokes = [...s.strokes];
        const lastIndex = currentStrokes.length - 1;
        if (lastIndex < 0) return s;
        const last = { ...currentStrokes[lastIndex] };
        if (last.tool === "shape") {
          last.points = [last.points[0], { x, y }];
        } else {
          last.points = [...last.points, { x, y }];
        }
        currentStrokes[lastIndex] = last;
        return { ...s, strokes: currentStrokes };
      })
    );
  };

  const handleEndDraw = () => {
    setIsDrawing(false);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setRedoStack((r) => [...r, activeSlide.strokes]);
    setHistory((h) => h.slice(0, -1));
    setSlides((all) => all.map((s, idx) => (idx === activeSlideIndex ? { ...s, strokes: prev } : s)));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistory((h) => [...h, activeSlide.strokes]);
    setRedoStack((r) => r.slice(0, -1));
    setSlides((all) => all.map((s, idx) => (idx === activeSlideIndex ? { ...s, strokes: next } : s)));
  };

  const handleClear = () => {
    setHistory((h) => [...h, activeSlide.strokes]);
    setSlides((all) => all.map((s, idx) => (idx === activeSlideIndex ? { ...s, strokes: [] } : s)));
  };

  const handleAddSlide = () => {
    const newSlide: Slide = {
      id: `s-${Date.now()}`,
      theme: activeSlide.theme,
      title: `Slide ${slides.length + 1}`,
      strokes: [],
    };
    setSlides((s) => [...s, newSlide]);
    setActiveSlideIndex(slides.length);
    toast.success("New slide added");
  };

  const handleDeleteSlide = () => {
    if (slides.length <= 1) return;
    setSlides((all) => all.filter((_, idx) => idx !== activeSlideIndex));
    setActiveSlideIndex((i) => Math.max(0, i - 1));
  };

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
    <div className="flex flex-col h-screen w-screen bg-[#090b10] text-slate-100 overflow-hidden select-none font-sans">
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
      <div className="flex-1 flex relative overflow-hidden">
        {/* Left Floating Camera Tile */}
        {isCameraOpen && (
          <div className="absolute top-4 left-4 z-20 w-48 h-36 bg-[#12131e] rounded-2xl border border-[#2d3045] shadow-2xl overflow-hidden flex flex-col">
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

        {/* 16:9 Presentation Canvas */}
        <div className="flex-1 flex items-center justify-center p-3 sm:p-5 bg-[#08090f] overflow-hidden">
          <div className="relative w-full max-w-[calc((100vh-140px)*16/9)] aspect-[16/9] max-h-[calc(100vh-140px)] bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-700/60">
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
              className="w-full h-full object-contain cursor-crosshair select-none"
            />
          </div>
        </div>
      </div>

      {/* 3. BOTTOM FLOATING DOCK TOOLBAR */}
      {!isObsOutput && (
        <footer className="h-16 bg-[#11131c] border-t border-[#212433] px-4 flex items-center justify-between shrink-0 z-30">
          {/* Left: Pen, Highlight, Eraser, Shapes (with Popups) */}
          <div className="flex items-center gap-1.5">
            {/* Pen Customizer Flyout (Screenshot 5) */}
            <div className="relative">
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
                  {/* Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-[#252838]">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-blue-400 text-base">edit</span>
                      <span className="text-xs font-bold capitalize">{penStyle}-tipped pen</span>
                    </div>
                    <button type="button" onClick={() => setOpenPopup(null)} className="text-gray-400 hover:text-white">
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>

                  {/* Thickness */}
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

                  {/* 6 Pen Styles + 12-Color Palette */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {/* Left: 6 Pen Styles */}
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

                    {/* Right: 12-Color Palette Grid */}
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

            <button
              type="button"
              onClick={() => setTool("highlighter")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                tool === "highlighter" ? "bg-yellow-500 text-black shadow" : "bg-[#1c1e2c] text-gray-300 hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">ink_highlighter</span>
              <span>Highlight</span>
            </button>

            <button
              type="button"
              onClick={() => setTool("eraser")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                tool === "eraser" ? "bg-rose-600 text-white shadow" : "bg-[#1c1e2c] text-gray-300 hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">ink_eraser</span>
              <span>Eraser</span>
            </button>

            {/* Subject-Wise Smart Shapes (Screenshot 5) */}
            <div className="relative">
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
                  {/* Category Switcher Tabs: Math, Phys, Chem, Bio */}
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

                  {/* 2-Column Grid */}
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

          {/* Center: Undo, Redo, Clear, Slide Switcher */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[#1a1d2e] border border-[#2d3247] rounded-xl p-1">
              <button type="button" onClick={handleUndo} className="p-1.5 rounded-lg text-gray-400 hover:text-white" title="Undo (Ctrl+Z)">
                <span className="material-symbols-outlined text-base">undo</span>
              </button>
              <button type="button" onClick={handleRedo} className="p-1.5 rounded-lg text-gray-400 hover:text-white" title="Redo (Ctrl+Y)">
                <span className="material-symbols-outlined text-base">redo</span>
              </button>
              <button type="button" onClick={handleClear} className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400" title="Clear Slide">
                <span className="material-symbols-outlined text-base">delete</span>
              </button>
            </div>

            <div className="flex items-center gap-2 bg-[#1a1d2e] border border-[#2d3247] rounded-2xl px-3 py-1.5">
              <button
                type="button"
                disabled={activeSlideIndex === 0}
                onClick={() => setActiveSlideIndex((i) => i - 1)}
                className="text-gray-400 hover:text-white disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </button>
              <span className="text-xs font-bold text-gray-200">
                Slide {activeSlideIndex + 1} / {slides.length}
              </span>
              <button
                type="button"
                disabled={activeSlideIndex === slides.length - 1}
                onClick={() => setActiveSlideIndex((i) => i + 1)}
                className="text-gray-400 hover:text-white disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleAddSlide}
              className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center gap-1 shadow"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              <span>Add</span>
            </button>
            <button
              type="button"
              onClick={handleDeleteSlide}
              disabled={slides.length <= 1}
              className="p-1.5 rounded-xl bg-[#1a1d2e] text-gray-400 hover:text-rose-400 disabled:opacity-30 border border-[#2d3247]"
              title="Delete Slide"
            >
              <span className="material-symbols-outlined text-base">delete</span>
            </button>
          </div>

          {/* Right: Poll & Camera Toggles */}
          <div className="flex items-center gap-2">
            {/* Poll Button & Popover (Screenshot 3) */}
            <div className="relative">
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
                      <p className="text-[10px] text-gray-400">Launch YES/NO or 4-MCQ</p>
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
                      <p className="text-[10px] text-gray-400">Full class ranks &amp; speed</p>
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

      {/* 3D Visual Models Modal (Screenshots 1 & 2) */}
      {is3DOpen && (
        <Simulation3DModal
          onClose={() => setIs3DOpen(false)}
          onInsertToSlide={handleInsertSnapshot}
        />
      )}

      {/* Interactive Science Labs Modal (Screenshot 3) */}
      {isSimOpen && (
        <ScienceLabsModal
          onClose={() => setIsSimOpen(false)}
          onStampToWhiteboard={handleInsertSnapshot}
        />
      )}

      {/* Slide Themes Modal (Screenshot 4) */}
      {isThemeOpen && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
          <div className="bg-[#12131c] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[#2d2e3b] max-h-[90vh] text-white">
            {/* Header (Screenshot 4) */}
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
              {/* Section 1: Official Atomic Pathshala Templates (Screenshot 4) */}
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

              {/* Section 2: Standard Classroom Themes (Screenshot 4) */}
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

      {/* Live Quiz / Poll Modal (Screenshots 1 & 2) */}
      {isPollOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#12131c] w-full max-w-lg rounded-2xl shadow-2xl border border-[#2d2e3b] flex flex-col text-white overflow-hidden">
            {/* Header (Screenshot 1) */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#252836] bg-[#171924]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-400 text-lg">quiz</span>
                <h3 className="text-sm font-bold text-gray-100">Poll / Quiz</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPollModalTab(pollModalTab === "quiz" ? "ranks" : "quiz")}
                  className="px-2.5 py-1 rounded-lg bg-[#202234] border border-[#2e3146] text-xs font-semibold text-amber-400 hover:text-amber-300"
                >
                  Ranks
                </button>
                <button type="button" onClick={() => setIsPollOpen(false)} className="text-gray-400 hover:text-white">
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
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
                {/* YES/NO vs 4-MCQ (Screenshot 1) */}
                <div className="grid grid-cols-2 gap-2 bg-[#0e0f17] p-1.5 rounded-xl border border-[#252836]">
                  <button
                    type="button"
                    onClick={() => setPollType("yesno")}
                    className={`py-1.5 rounded-lg text-xs font-bold transition ${
                      pollType === "yesno" ? "bg-[#25283a] text-white" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    YES / NO
                  </button>
                  <button
                    type="button"
                    onClick={() => setPollType("mcq4")}
                    className={`py-1.5 rounded-lg text-xs font-bold transition ${
                      pollType === "mcq4" ? "bg-blue-600 text-white shadow" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    4-Option Quiz
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-300 font-semibold">
                  <input type="checkbox" defaultChecked className="accent-blue-500 rounded" />
                  <span>Board-Driven MCQ Quiz</span>
                </div>

                {/* Options preview (Screenshot 1) */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                    OPTIONS (ANSWER WILL BE MARKED BY YOU AT REVEAL TIME):
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {["Option A", "Option B", "Option C", "Option D"].map((opt) => (
                      <div key={opt} className="p-2.5 rounded-xl bg-[#161724] border border-[#252836] text-xs font-bold text-gray-200">
                        {opt}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Timer + Launch (Screenshot 1) */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2 text-xs text-gray-300">
                    <span>Timer:</span>
                    <select className="bg-[#171926] border border-[#2d3045] rounded-lg px-2 py-1 text-xs text-white outline-none">
                      <option>15s</option>
                      <option>30s</option>
                      <option selected>45s</option>
                      <option>60s</option>
                      <option>90s</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsPollOpen(false);
                    toast.success("Live 4-Option Quiz Launched!");
                  }}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition"
                >
                  Launch 4-Option Quiz
                </button>
              </div>
            ) : (
              <div className="p-6 space-y-3 text-center">
                <span className="material-symbols-outlined text-4xl text-amber-400">military_tech</span>
                <h4 className="text-sm font-bold text-gray-100">Live Session Leaderboard</h4>
                <p className="text-xs text-gray-400">Ranks and response speed will update automatically when students answer.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings Modal (Screenshot 4) */}
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
              {/* Left Tabs (Screenshot 4) */}
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

              {/* Right Tab Content (Screenshot 4) */}
              <div className="flex-1 p-6">
                {settingsTab === "shortcuts" && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-200">Keyboard shortcuts</h4>
                    <div className="space-y-2">
                      {[
                        { label: "Undo", key: "Ctrl+Z" },
                        { label: "Redo", key: "Ctrl+Y" },
                        { label: "Add page", key: "Shift+N" },
                        { label: "Clear page", key: "Shift+C" },
                        { label: "Toggle Messages", key: "Shift+M" },
                        { label: "Toggle Questions", key: "Shift+Q" },
                        { label: "Full screen", key: "F" },
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
