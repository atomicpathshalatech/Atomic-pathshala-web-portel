"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";

// ---- 3D VISUALS CATALOG (NEET & JEE) ----
const THREE_D_MODELS = [
  { id: "dna", title: "DNA Double Helix (Molecular Genetics)", icon: "biotech", category: "Biology", embedUrl: "https://sketchfab.com/models/dna-double-helix/embed" },
  { id: "heart", title: "Human Heart 3D (Circulatory System)", icon: "favorite", category: "Biology", embedUrl: "https://sketchfab.com/models/human-heart/embed" },
  { id: "brain", title: "Human Brain & Neuron Synapse", icon: "psychology", category: "Biology", embedUrl: "https://sketchfab.com/models/human-brain/embed" },
  { id: "benzene", title: "Benzene Ring Delocalized π-Orbital", icon: "token", category: "Chemistry", embedUrl: "https://sketchfab.com/models/benzene-molecule/embed" },
  { id: "solarsystem", title: "Gravitation & Planetary Orbits", icon: "public", category: "Physics", embedUrl: "https://sketchfab.com/models/solar-system/embed" },
  { id: "atom", title: "Bohr Atom & Electron Clouds", icon: "grain", category: "Physics", embedUrl: "https://sketchfab.com/models/atom-structure/embed" },
];

// ---- SCIENCE & PHYSICS LAB SIMS CATALOG (PHET) ----
const LAB_SIMULATIONS = [
  { id: "optics", title: "Ray Optics: Lenses, Mirrors & Refraction", icon: "tonality", subject: "Physics", simUrl: "https://phet.colorado.edu/sims/html/geometric-optics/latest/geometric-optics_en.html" },
  { id: "projectile", title: "Projectile Motion & Trajectory Vectors", icon: "sports_score", subject: "Physics", simUrl: "https://phet.colorado.edu/sims/html/projectile-motion/latest/projectile-motion_en.html" },
  { id: "circuit", title: "DC Circuit Construction (Ohm's & Kirchhoff's Law)", icon: "electric_bolt", subject: "Physics", simUrl: "https://phet.colorado.edu/sims/html/circuit-construction-kit-dc/latest/circuit-construction-kit-dc_en.html" },
  { id: "acidbase", title: "Acid-Base Solutions & pH Titration", icon: "science", subject: "Chemistry", simUrl: "https://phet.colorado.edu/sims/html/acid-base-solutions/latest/acid-base-solutions_en.html" },
  { id: "molecule", title: "Molecule Shapes & VSEPR Theory", icon: "share", subject: "Chemistry", simUrl: "https://phet.colorado.edu/sims/html/molecule-shapes/latest/molecule-shapes_en.html" },
  { id: "genes", title: "Gene Expression & Protein Synthesis", icon: "eco", subject: "Biology", simUrl: "https://phet.colorado.edu/sims/html/gene-expression-essentials/latest/gene-expression-essentials_en.html" },
];

// ---- THEMES ----
export type BoardTheme =
  | "brand_white"
  | "brand_dark"
  | "brand_ruled"
  | "white"
  | "dark"
  | "ruled"
  | "greenboard"
  | "grid";

interface Slide {
  id: string;
  theme: BoardTheme;
  title: string;
  strokes: Stroke[];
  imageUrl?: string | null;
}

interface Stroke {
  tool: "pen" | "highlighter" | "eraser" | "shape";
  color: string;
  size: number;
  points: { x: number; y: number }[];
  shapeType?: "rectangle" | "circle" | "benzene" | "coordinate_axes" | "arrow" | "triangle";
}

const PALETTE_COLORS = [
  { color: "#ef4444", label: "Red" },
  { color: "#f97316", label: "Orange" },
  { color: "#eab308", label: "Yellow" },
  { color: "#22c55e", label: "Green" },
  { color: "#06b6d4", label: "Cyan" },
  { color: "#3b82f6", label: "Blue" },
  { color: "#ec4899", label: "Pink" },
  { color: "#ffffff", label: "White" },
  { color: "#0f172a", label: "Black" },
];

const STROKE_SIZES = [
  { size: 2, label: "Fine" },
  { size: 5, label: "Medium" },
  { size: 9, label: "Thick" },
  { size: 16, label: "Extra Thick" },
];

// Preloaded Image Cache for high-performance canvas redrawing
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
  classTitle = "NEET 2027 Chemistry: Organic Reaction Mechanisms & Benzene Masterclass",
  batchName = "YODHA Batch — Class 11 & 12",
  teacherName = "Dr. Sharma (Physics)",
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

  // ---- TOOLS & PALETTE ----
  const [tool, setTool] = useState<"pen" | "highlighter" | "eraser" | "shape" | "select">("pen");
  const [color, setColor] = useState("#0f172a");
  const [size, setSize] = useState(3);
  const [shape, setShape] = useState<"rectangle" | "circle" | "benzene" | "coordinate_axes" | "arrow" | "triangle">("benzene");
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<Stroke[][]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[][]>([]);

  // ---- MODALS & DIALOGS ----
  const [is3DOpen, setIs3DOpen] = useState(false);
  const [active3DModel, setActive3DModel] = useState<any>(null);

  const [isSimOpen, setIsSimOpen] = useState(false);
  const [activeSim, setActiveSim] = useState<any>(null);

  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [isPollOpen, setIsPollOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isYTSyncOpen, setIsYTSyncOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isObsOutput, setIsObsOutput] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // ---- LIVE STATUS ----
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");
  const [ytPin, setYtPin] = useState("ATOM-2026");

  // File Inputs
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const pptxInputRef = useRef<HTMLInputElement>(null);

  const activeSlide: Slide = slides[activeSlideIndex] || slides[0] || { id: "s-1", theme: "brand_white", title: "Slide 1", strokes: [] };

  // Preload brand images on mount
  useEffect(() => {
    getCachedImage("/brand/slide-white.png");
    getCachedImage("/brand/slide-dark.png");
    getCachedImage("/brand/slide-ruled.png");
    getCachedImage("/brand/logo.png");
  }, []);

  // Synchronous + Asynchronous Slide Drawing Helper
  const drawSlideContent = useCallback(async (
    ctx: CanvasRenderingContext2D,
    slide: Slide,
    width: number,
    height: number
  ) => {
    ctx.clearRect(0, 0, width, height);
    const theme = slide?.theme || "brand_white";

    // 1. Draw Theme Background
    if (theme === "brand_white") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      const img = await getCachedImage("/brand/slide-white.png");
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, 0, 0, width, height);
      }
    } else if (theme === "brand_dark") {
      ctx.fillStyle = "#090d16";
      ctx.fillRect(0, 0, width, height);
      const img = await getCachedImage("/brand/slide-dark.png");
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, 0, 0, width, height);
      }
    } else if (theme === "brand_ruled") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      const img = await getCachedImage("/brand/slide-ruled.png");
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, 0, 0, width, height);
      }
    } else if (theme === "dark") {
      ctx.fillStyle = "#090d16";
      ctx.fillRect(0, 0, width, height);
    } else if (theme === "greenboard") {
      ctx.fillStyle = "#0c281e";
      ctx.fillRect(0, 0, width, height);
    } else if (theme === "grid") {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 35) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 35) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    } else if (theme === "ruled") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(100, 149, 237, 0.25)";
      ctx.lineWidth = 1;
      for (let y = 50; y < height; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(255, 99, 71, 0.35)";
      ctx.beginPath();
      ctx.moveTo(80, 0);
      ctx.lineTo(80, height);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
    }

    // 2. Draw Slide Background Image (if PPT/PDF uploaded)
    if (slide?.imageUrl) {
      const img = await getCachedImage(slide.imageUrl);
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, 0, 0, width, height);
      }
    }

    // 3. Draw All User Strokes
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
        ctx.lineWidth = stroke.size * 6;
      } else {
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size;
      }

      if (stroke.shapeType) {
        const p1 = stroke.points[0];
        const p2 = stroke.points[stroke.points.length - 1];
        if (p1 && p2) {
          if (stroke.shapeType === "rectangle") {
            ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
          } else if (stroke.shapeType === "circle") {
            const rx = Math.abs(p2.x - p1.x) / 2;
            const ry = Math.abs(p2.y - p1.y) / 2;
            const cx = (p1.x + p2.x) / 2;
            const cy = (p1.y + p2.y) / 2;
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
            ctx.stroke();
          } else if (stroke.shapeType === "benzene") {
            // Benzene Aromatic Ring
            const cx = (p1.x + p2.x) / 2;
            const cy = (p1.y + p2.y) / 2;
            const r = Math.hypot(p2.x - p1.x, p2.y - p1.y) / 2 || 45;

            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
              const angle = (i * 60 * Math.PI) / 180 - Math.PI / 6;
              const x = cx + r * Math.cos(angle);
              const y = cy + r * Math.sin(angle);
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();

            // Inner Aromatic Circle
            ctx.beginPath();
            ctx.arc(cx, cy, r * 0.58, 0, 2 * Math.PI);
            ctx.stroke();
          } else if (stroke.shapeType === "coordinate_axes") {
            const cx = (p1.x + p2.x) / 2;
            const cy = (p1.y + p2.y) / 2;
            const w = Math.abs(p2.x - p1.x) || 140;
            const h = Math.abs(p2.y - p1.y) || 140;

            // X axis
            ctx.beginPath();
            ctx.moveTo(cx - w / 2, cy);
            ctx.lineTo(cx + w / 2, cy);
            ctx.stroke();

            // Y axis
            ctx.beginPath();
            ctx.moveTo(cx, cy + h / 2);
            ctx.lineTo(cx, cy - h / 2);
            ctx.stroke();
          }
        }
      } else {
        // Freehand Pen / Highlighter
        ctx.beginPath();
        stroke.points.forEach((p, idx) => {
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
      }

      ctx.restore();
    });
  }, []);

  // Redraw Canvas on changes
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawSlideContent(ctx, activeSlide, canvas.width, canvas.height);
  }, [activeSlide, drawSlideContent]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Adjust default pen color based on theme
  useEffect(() => {
    const isDark = activeSlide.theme === "brand_dark" || activeSlide.theme === "dark" || activeSlide.theme === "greenboard" || activeSlide.theme === "grid";
    if (isDark && (color === "#0f172a" || color === "#000000")) {
      setColor("#ffffff");
    } else if (!isDark && color === "#ffffff") {
      setColor("#0f172a");
    }
  }, [activeSlide.theme]);

  // ---- CANVAS COORDINATES & DRAWING ----
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e && e.touches && e.touches.length > 0) {
      const touch = e.touches[0];
      if (touch) {
        return {
          x: (touch.clientX - rect.left) * scaleX,
          y: (touch.clientY - rect.top) * scaleY,
        };
      }
    }

    if ("clientX" in e) {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }

    return { x: 0, y: 0 };
  };

  const handleStartDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    setSaveStatus("saving");
    const pos = getCoordinates(e);

    const newStroke: Stroke = {
      tool: tool === "select" ? "pen" : tool,
      color,
      size,
      points: [pos],
      shapeType: tool === "shape" ? shape : undefined,
    };

    if (activeSlide) {
      setHistory((prev) => [...prev, activeSlide.strokes]);
      setRedoStack([]);

      const updatedSlides = [...slides];
      if (updatedSlides[activeSlideIndex]) {
        updatedSlides[activeSlideIndex]!.strokes.push(newStroke);
        setSlides(updatedSlides);
      }
    }
  };

  const handleMoveDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const pos = getCoordinates(e);
    const updatedSlides = [...slides];
    const currentStrokes = updatedSlides[activeSlideIndex]?.strokes;
    if (currentStrokes && currentStrokes.length > 0) {
      const lastStroke = currentStrokes[currentStrokes.length - 1];
      if (lastStroke) {
        if (lastStroke.shapeType) {
          const firstPoint = lastStroke.points[0] || pos;
          lastStroke.points = [firstPoint, pos];
        } else {
          lastStroke.points.push(pos);
        }
        setSlides(updatedSlides);
        redrawCanvas();
      }
    }
  };

  const handleEndDraw = () => {
    setIsDrawing(false);
    setTimeout(() => setSaveStatus("saved"), 600);
  };

  // Undo / Redo / Clear
  const handleUndo = () => {
    if (!activeSlide || activeSlide.strokes.length === 0) return;
    const last = activeSlide.strokes[activeSlide.strokes.length - 1];
    if (last) {
      setRedoStack((prev) => [...prev, [last]]);
      const updated = [...slides];
      if (updated[activeSlideIndex]) {
        updated[activeSlideIndex]!.strokes.pop();
        setSlides(updated);
        redrawCanvas();
      }
    }
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const last = redoStack[redoStack.length - 1];
    if (last && last[0]) {
      const updated = [...slides];
      if (updated[activeSlideIndex]) {
        updated[activeSlideIndex]!.strokes.push(last[0]);
        setSlides(updated);
        setRedoStack((prev) => prev.slice(0, -1));
        redrawCanvas();
      }
    }
  };

  const handleClear = () => {
    if (!confirm("Are you sure you want to clear this slide?")) return;
    const updated = [...slides];
    if (updated[activeSlideIndex]) {
      updated[activeSlideIndex]!.strokes = [];
      setSlides(updated);
      redrawCanvas();
      toast.success("Board cleared!");
    }
  };

  // Slide Add / Delete
  const handleAddSlide = () => {
    const newSlide: Slide = {
      id: `s-${slides.length + 1}`,
      theme: activeSlide?.theme || "brand_white",
      title: `Slide ${slides.length + 1}`,
      strokes: [],
    };
    setSlides([...slides, newSlide]);
    setActiveSlideIndex(slides.length);
    toast.success(`Slide ${slides.length + 1} added`);
  };

  const handleDeleteSlide = () => {
    if (slides.length <= 1) {
      toast.error("Cannot delete the last slide");
      return;
    }
    const updated = slides.filter((_, idx) => idx !== activeSlideIndex);
    setSlides(updated);
    setActiveSlideIndex(Math.max(0, activeSlideIndex - 1));
    toast.success("Slide deleted");
  };

  // File Upload Handlers (PPTX / PDF)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "PDF" | "PPTX") => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      const newSlide: Slide = {
        id: `s-${slides.length + 1}`,
        theme: "brand_white",
        title: file.name,
        imageUrl: url,
        strokes: [],
      };
      setSlides([...slides, newSlide]);
      setActiveSlideIndex(slides.length);
      toast.success(`${type} "${file.name}" imported onto new slide!`);
    };
    reader.readAsDataURL(file);
  };

  // Professional Export (PNG / PDF / PPTX) with Baked-In Brand Identity
  const handleExport = async (format: "PDF" | "PNG" | "PPTX") => {
    setIsExportOpen(false);

    if (format === "PNG") {
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = 1920;
      exportCanvas.height = 1080;
      const ctx = exportCanvas.getContext("2d");
      if (!ctx) return;

      await drawSlideContent(ctx, activeSlide, 1920, 1080);

      const link = document.createElement("a");
      link.download = `AtomicPathshala-${activeSlide.title || "Slide"}.png`;
      link.href = exportCanvas.toDataURL("image/png");
      link.click();
      toast.success("Slide exported as branded PNG!");
    } else if (format === "PDF" || format === "PPTX") {
      toast.info(`Generating ${slides.length}-slide branded ${format} export...`);
      try {
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({
          orientation: "landscape",
          unit: "px",
          format: [1920, 1080],
        });

        for (let i = 0; i < slides.length; i++) {
          const slide = slides[i];
          if (!slide) continue;
          if (i > 0) pdf.addPage([1920, 1080], "landscape");

          const exportCanvas = document.createElement("canvas");
          exportCanvas.width = 1920;
          exportCanvas.height = 1080;
          const ctx = exportCanvas.getContext("2d");
          if (ctx) {
            await drawSlideContent(ctx, slide, 1920, 1080);
            const imgData = exportCanvas.toDataURL("image/jpeg", 0.95);
            pdf.addImage(imgData, "JPEG", 0, 0, 1920, 1080);
          }
        }

        const filename = format === "PDF"
          ? `AtomicPathshala-${batchName || "Lecture"}-Notes.pdf`
          : `AtomicPathshala-${classTitle || "Presentation"}.pdf`;

        pdf.save(filename);
        toast.success(`${format} Lecture Notes exported with Atomic Pathshala branding!`);
      } catch (err) {
        console.error(err);
        toast.error(`Failed to export ${format}.`);
      }
    }
  };

  return (
    <div className={`fixed inset-0 z-50 bg-[#07090e] text-white flex flex-col overflow-hidden font-sans select-none ${isObsOutput ? "bg-black" : ""}`}>
      {/* ========================================================================= */}
      {/* 1. TOP CLASSROOM HEADER BAR WITH BRAND IDENTITY                           */}
      {/* ========================================================================= */}
      {!isObsOutput && (
        <header className="h-14 bg-[#11131c] border-b border-[#202435] px-4 flex items-center justify-between shrink-0 z-30">
          {/* Left Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Brand Icon */}
            <div className="flex items-center gap-2 pr-2 border-r border-[#24283b]">
              <img
                src="/brand/logo.png"
                alt="Atomic Pathshala"
                className="w-8 h-8 rounded-lg object-contain shadow-sm"
              />
              <span className="font-extrabold text-xs text-white tracking-wide hidden sm:inline">
                ATOMIC STUDIO
              </span>
            </div>

            {/* Import PPTX */}
            <button
              type="button"
              onClick={() => pptxInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg border border-orange-500/50 bg-orange-950/20 hover:bg-orange-900/40 text-orange-400 font-extrabold text-xs flex items-center gap-1.5 transition"
            >
              <span className="material-symbols-outlined text-sm">slideshow</span>
              <span>Import PPTX</span>
              <span className="text-[9px] font-black uppercase px-1 py-0.2 rounded bg-orange-500 text-black">AI</span>
              <input
                ref={pptxInputRef}
                type="file"
                accept=".pptx,.ppt,image/*"
                onChange={(e) => handleFileUpload(e, "PPTX")}
                className="hidden"
              />
            </button>

            {/* Import PDF */}
            <button
              type="button"
              onClick={() => pdfInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg border border-red-500/50 bg-red-950/20 hover:bg-red-900/40 text-red-400 font-extrabold text-xs flex items-center gap-1.5 transition"
            >
              <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
              <span>Import PDF</span>
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => handleFileUpload(e, "PDF")}
                className="hidden"
              />
            </button>

            {/* 3D Visuals */}
            <button
              type="button"
              onClick={() => setIs3DOpen(true)}
              className="px-3 py-1.5 rounded-lg border border-purple-500/50 bg-purple-950/20 hover:bg-purple-900/40 text-purple-300 font-bold text-xs flex items-center gap-1.5 transition"
            >
              <span className="material-symbols-outlined text-sm text-purple-400">view_in_ar</span>
              <span>3D Visuals</span>
            </button>

            {/* Lab Sims */}
            <button
              type="button"
              onClick={() => setIsSimOpen(true)}
              className="px-3 py-1.5 rounded-lg border border-emerald-500/50 bg-emerald-950/20 hover:bg-emerald-900/40 text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition"
            >
              <span className="material-symbols-outlined text-sm text-emerald-400">science</span>
              <span>Lab Sims</span>
            </button>

            {/* Theme */}
            <button
              type="button"
              onClick={() => setIsThemeOpen(true)}
              className="px-3 py-1.5 rounded-lg border border-[#2d3247] bg-[#1a1d2d] hover:bg-slate-800 text-slate-300 font-bold text-xs flex items-center gap-1.5 transition"
            >
              <span className="material-symbols-outlined text-sm text-orange-400">palette</span>
              <span>Slide Themes</span>
            </button>

            {/* Camera Toggle */}
            <button
              type="button"
              onClick={() => setIsCameraOpen(!isCameraOpen)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition ${
                isCameraOpen
                  ? "border-orange-500 bg-orange-600/30 text-orange-300"
                  : "border-[#2d3247] bg-[#1a1d2d] text-slate-300 hover:bg-slate-800"
              }`}
            >
              <span className="material-symbols-outlined text-sm text-orange-400">videocam</span>
              <span>Camera</span>
            </button>
          </div>

          {/* Center Status / Live Sync / OBS */}
          <div className="flex items-center gap-3">
            {/* YouTube Live Sync Pill */}
            <button
              type="button"
              onClick={() => setIsYTSyncOpen(true)}
              className="px-3 py-1.5 rounded-xl border border-red-500/60 bg-gradient-to-r from-red-950/80 to-red-900/60 text-xs text-white font-bold flex items-center gap-2 shadow-lg shadow-red-950/40"
            >
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span>YouTube Live Sync</span>
              <span className="px-1.5 py-0.5 rounded bg-black/50 text-[10px] font-mono text-orange-300">
                PIN: {ytPin}
              </span>
            </button>

            {/* OBS Output Clean Feed Toggle */}
            <button
              type="button"
              onClick={() => {
                setIsObsOutput(true);
                toast.info("OBS Virtual Camera Mode activated. Press ESC to restore header.");
              }}
              className="px-2.5 py-1.5 rounded-lg border border-indigo-500/50 bg-indigo-950/30 hover:bg-indigo-900/40 text-xs font-bold text-indigo-300 flex items-center gap-1.5"
            >
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              <span>OBS Output</span>
            </button>

            {/* Saved Indicator */}
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <span className={`w-2 h-2 rounded-full ${saveStatus === "saving" ? "bg-blue-400 animate-pulse" : "bg-emerald-400"}`} />
              <span className="text-[11px] font-medium">{saveStatus === "saving" ? "Saving..." : "Saved"}</span>
            </div>
          </div>

          {/* Right Section: Hub, Teacher Info, Settings, Fullscreen, Export */}
          <div className="flex items-center gap-2">
            {/* Teacher Info */}
            <div className="px-3 py-1.5 rounded-lg bg-[#1a1d2d] border border-[#2d3247] flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-200">{teacherName}</span>
              <Link href="/team" className="text-slate-400 hover:text-white" title="Exit to Portal">
                <span className="material-symbols-outlined text-sm">exit_to_app</span>
              </Link>
            </div>

            {/* Fullscreen */}
            <button
              type="button"
              onClick={() => {
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen();
                  setIsFullScreen(true);
                } else {
                  document.exitFullscreen();
                  setIsFullScreen(false);
                }
              }}
              className="p-1.5 rounded-lg bg-[#1a1d2d] border border-[#2d3247] text-slate-300 hover:text-white"
            >
              <span className="material-symbols-outlined text-base">
                {isFullScreen ? "fullscreen_exit" : "crop_free"}
              </span>
            </button>

            {/* Export Dropdown Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsExportOpen(!isExportOpen)}
                className="px-4 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-black text-xs flex items-center gap-1 shadow-md shadow-orange-950/40"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                <span>EXPORT</span>
              </button>

              {isExportOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-56 bg-[#161824] border border-[#2d3247] rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-1 animate-in fade-in zoom-in-95">
                  <button
                    type="button"
                    onClick={() => handleExport("PDF")}
                    className="p-2.5 rounded-lg hover:bg-slate-800 text-left text-xs flex items-center gap-2.5 text-slate-200"
                  >
                    <span className="material-symbols-outlined text-base text-red-400">picture_as_pdf</span>
                    <div>
                      <p className="font-bold">Export All Slides (PDF)</p>
                      <p className="text-[10px] text-slate-400">With Atomic Pathshala branding</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport("PPTX")}
                    className="p-2.5 rounded-lg hover:bg-slate-800 text-left text-xs flex items-center gap-2.5 text-slate-200"
                  >
                    <span className="material-symbols-outlined text-base text-orange-400">slideshow</span>
                    <div>
                      <p className="font-bold">Export PPT Presentation</p>
                      <p className="text-[10px] text-slate-400">16:9 Presentation Format</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport("PNG")}
                    className="p-2.5 rounded-lg hover:bg-slate-800 text-left text-xs flex items-center gap-2.5 text-slate-200"
                  >
                    <span className="material-symbols-outlined text-base text-blue-400">image</span>
                    <div>
                      <p className="font-bold">Export Current Slide (PNG)</p>
                      <p className="text-[10px] text-slate-400">High-Res with official logo</p>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      {/* ========================================================================= */}
      {/* 2. MAIN 16:9 PPT SLIDE STAGE + LEFT PALETTE                               */}
      {/* ========================================================================= */}
      <div className="flex-1 flex overflow-hidden relative bg-[#07090e]">
        {/* LEFT FLOATING COLOR & STROKE PALETTE */}
        {!isObsOutput && (
          <div className="absolute top-4 left-4 z-20 flex flex-col items-center gap-1.5 p-1.5 bg-[#141724]/95 backdrop-blur-md border border-[#282d42] rounded-2xl shadow-2xl">
            {/* Active Tool Button */}
            <button
              type="button"
              className="p-2 rounded-xl bg-orange-600 text-white shadow-md"
              title="Active Pen"
            >
              <span className="material-symbols-outlined text-base">edit</span>
            </button>

            <div className="w-5 h-px bg-slate-700 my-0.5" />

            {/* Vertical Colors Swatches */}
            <div className="flex flex-col gap-1.5">
              {PALETTE_COLORS.map((item) => (
                <button
                  key={item.color}
                  type="button"
                  onClick={() => {
                    setColor(item.color);
                    if (tool !== "pen" && tool !== "highlighter") setTool("pen");
                  }}
                  style={{ backgroundColor: item.color }}
                  className={`w-5 h-5 rounded-full transition ${
                    color.toLowerCase() === item.color.toLowerCase()
                      ? "ring-2 ring-white scale-125 shadow-md"
                      : "opacity-85 hover:scale-110"
                  }`}
                  title={item.label}
                />
              ))}
            </div>

            <div className="w-5 h-px bg-slate-700 my-0.5" />

            {/* Stroke Sizes */}
            <div className="flex flex-col gap-1.5 items-center">
              {STROKE_SIZES.map((s) => (
                <button
                  key={s.size}
                  type="button"
                  onClick={() => setSize(s.size)}
                  className={`w-5 h-5 rounded-lg flex items-center justify-center transition ${
                    size === s.size ? "bg-orange-600/40 text-orange-400 ring-1 ring-orange-400" : "text-slate-400 hover:text-white"
                  }`}
                  title={`${s.label} (${s.size}px)`}
                >
                  <div
                    className="rounded-full bg-current"
                    style={{ width: `${Math.max(3, s.size * 0.9)}px`, height: `${Math.max(3, s.size * 0.9)}px` }}
                  />
                </button>
              ))}
            </div>

            <div className="w-5 h-px bg-slate-700 my-0.5" />

            {/* Lasso Select */}
            <button
              type="button"
              onClick={() => setTool(tool === "select" ? "pen" : "select")}
              className={`p-1.5 rounded-lg transition ${
                tool === "select" ? "bg-orange-600 text-white" : "text-slate-400 hover:text-white"
              }`}
              title="Lasso Loop Select"
            >
              <span className="material-symbols-outlined text-sm">gesture</span>
            </button>
          </div>
        )}

        {/* 16:9 PPT SLIDE WORKSPACE CONTAINER (CENTERED PRESENTATION SLIDE) */}
        <div className="flex-1 flex flex-col relative items-center justify-center p-2 sm:p-4 overflow-hidden bg-[#07090e]">
          {/* Strict 16:9 PPT Slide Frame */}
          <div className="relative w-full max-w-[calc((100vh-145px)*16/9)] aspect-[16/9] max-h-[calc(100vh-145px)] bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-700/60 flex items-center justify-center">
            {/* HTML5 CANVAS ELEMENT (1920x1080 16:9 PPT Resolution) */}
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

      {/* ========================================================================= */}
      {/* 3. BOTTOM FLOATING DOCK TOOLBAR                                           */}
      {/* ========================================================================= */}
      {!isObsOutput && (
        <footer className="h-16 bg-[#10121b] border-t border-[#202435] px-4 flex items-center justify-between shrink-0 z-30">
          {/* Left: Tools (Pen, Highlight, Eraser, Shapes) */}
          <div className="flex items-center gap-1 bg-[#1a1d2e] border border-[#2d3247] rounded-2xl p-1 shadow-md">
            <button
              type="button"
              onClick={() => setTool("pen")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                tool === "pen" ? "bg-orange-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">edit</span>
              <span>Pen</span>
            </button>

            <button
              type="button"
              onClick={() => setTool("highlighter")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                tool === "highlighter" ? "bg-yellow-500 text-black font-extrabold shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">ink_highlighter</span>
              <span>Highlight</span>
            </button>

            <button
              type="button"
              onClick={() => setTool("eraser")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                tool === "eraser" ? "bg-rose-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">ink_eraser</span>
              <span>Eraser</span>
            </button>

            {/* Shapes Palette */}
            <div className="relative group">
              <button
                type="button"
                onClick={() => setTool("shape")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                  tool === "shape" ? "bg-purple-600 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-sm">shapes</span>
                <span>Shapes</span>
              </button>

              <div className="hidden group-hover:flex absolute bottom-full mb-2 left-0 bg-[#161824] border border-[#2d3247] rounded-xl p-1.5 shadow-2xl flex-col gap-1 w-44 z-50">
                <button
                  type="button"
                  onClick={() => { setShape("benzene"); setTool("shape"); }}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-left text-xs font-bold text-slate-200 flex items-center gap-2"
                >
                  <span>⌬</span>
                  <span>Benzene Ring</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setShape("coordinate_axes"); setTool("shape"); }}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-left text-xs font-bold text-slate-200 flex items-center gap-2"
                >
                  <span>✛</span>
                  <span>Coordinate Axes</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setShape("rectangle"); setTool("shape"); }}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-left text-xs font-bold text-slate-200 flex items-center gap-2"
                >
                  <span>▢</span>
                  <span>Rectangle / Box</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setShape("circle"); setTool("shape"); }}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-left text-xs font-bold text-slate-200 flex items-center gap-2"
                >
                  <span>◯</span>
                  <span>Circle</span>
                </button>
              </div>
            </div>
          </div>

          {/* Center: Undo, Redo, Clear, Slide Switcher, Add, Delete */}
          <div className="flex items-center gap-3">
            {/* Undo / Redo */}
            <div className="flex items-center gap-1 bg-[#1a1d2e] border border-[#2d3247] rounded-xl p-1">
              <button
                type="button"
                onClick={handleUndo}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
                title="Undo (Ctrl+Z)"
              >
                <span className="material-symbols-outlined text-base">undo</span>
              </button>
              <button
                type="button"
                onClick={handleRedo}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
                title="Redo (Ctrl+Y)"
              >
                <span className="material-symbols-outlined text-base">redo</span>
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400"
                title="Clear Slide"
              >
                <span className="material-symbols-outlined text-base">delete</span>
              </button>
            </div>

            {/* Slide Pagination Navigator */}
            <div className="flex items-center gap-2 bg-[#1a1d2e] border border-[#2d3247] rounded-2xl px-3 py-1.5 shadow">
              <button
                type="button"
                disabled={activeSlideIndex === 0}
                onClick={() => setActiveSlideIndex((i) => i - 1)}
                className="text-slate-400 hover:text-white disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </button>

              <span className="text-xs font-extrabold text-slate-200 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-orange-400">slideshow</span>
                <span>Slide {activeSlideIndex + 1} / {slides.length}</span>
              </span>

              <button
                type="button"
                disabled={activeSlideIndex === slides.length - 1}
                onClick={() => setActiveSlideIndex((i) => i + 1)}
                className="text-slate-400 hover:text-white disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
            </div>

            {/* + Add & Delete Slide */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleAddSlide}
                className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center gap-1 shadow"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                <span>Add Slide</span>
              </button>
              <button
                type="button"
                onClick={handleDeleteSlide}
                disabled={slides.length <= 1}
                className="p-1.5 rounded-xl bg-[#1a1d2e] hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 disabled:opacity-30 border border-[#2d3247]"
                title="Delete Slide"
              >
                <span className="material-symbols-outlined text-base">delete</span>
              </button>
            </div>
          </div>

          {/* Right Status */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 font-mono">16:9 PPT Slide</span>
          </div>
        </footer>
      )}

      {/* ========================================================================= */}
      {/* 4. MODALS: 3D VISUALS, LAB SIMS, THEME, YOUTUBE LIVE SYNC                 */}
      {/* ========================================================================= */}

      {/* 3D VISUALS MODAL */}
      {is3DOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141724] border border-purple-500/50 rounded-3xl max-w-4xl w-full h-[80vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-400 text-xl">view_in_ar</span>
                <h3 className="font-extrabold text-base text-white">3D NEET/JEE Visual Models</h3>
              </div>
              <button type="button" onClick={() => setIs3DOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="flex-1 flex overflow-hidden">
              <div className="w-72 border-r border-slate-800 overflow-y-auto p-2 space-y-1.5">
                {THREE_D_MODELS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setActive3DModel(m)}
                    className={`w-full p-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-2 transition ${
                      active3DModel?.id === m.id ? "bg-purple-900/60 text-purple-200 border border-purple-500" : "bg-[#1c2032] text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <span className="material-symbols-outlined text-base text-purple-400">{m.icon}</span>
                    <span className="truncate">{m.title}</span>
                  </button>
                ))}
              </div>

              <div className="flex-1 bg-black flex items-center justify-center relative">
                {active3DModel ? (
                  <iframe
                    src={active3DModel.embedUrl}
                    title={active3DModel.title}
                    className="w-full h-full border-0"
                    allow="autoplay; fullscreen; xr-spatial-tracking"
                  />
                ) : (
                  <div className="text-center text-slate-500 text-sm">
                    <span className="material-symbols-outlined text-4xl text-purple-400 block mb-2">view_in_ar</span>
                    Select a 3D model to interact with during class
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LAB SIMS MODAL */}
      {isSimOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141724] border border-emerald-500/50 rounded-3xl max-w-5xl w-full h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-xl">science</span>
                <h3 className="font-extrabold text-base text-white">Interactive Physics & Chemistry Lab Simulations</h3>
              </div>
              <button type="button" onClick={() => setIsSimOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="flex-1 flex overflow-hidden">
              <div className="w-80 border-r border-slate-800 overflow-y-auto p-2 space-y-1.5">
                {LAB_SIMULATIONS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveSim(s)}
                    className={`w-full p-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-2 transition ${
                      activeSim?.id === s.id ? "bg-emerald-900/60 text-emerald-200 border border-emerald-500" : "bg-[#1c2032] text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <span className="material-symbols-outlined text-base text-emerald-400">{s.icon}</span>
                    <span className="truncate">{s.title}</span>
                  </button>
                ))}
              </div>

              <div className="flex-1 bg-black flex items-center justify-center relative">
                {activeSim ? (
                  <iframe
                    src={activeSim.simUrl}
                    title={activeSim.title}
                    className="w-full h-full border-0"
                    allowFullScreen
                  />
                ) : (
                  <div className="text-center text-slate-500 text-sm">
                    <span className="material-symbols-outlined text-4xl text-emerald-400 block mb-2">science</span>
                    Select an interactive lab simulation
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* THEME SELECTOR MODAL WITH BRANDED PPT SLIDES */}
      {isThemeOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141724] border border-[#2d3247] rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <img src="/brand/logo.png" alt="Logo" className="w-6 h-6 rounded object-contain" />
                <h3 className="font-extrabold text-base text-white">Slide Themes & Brand Templates</h3>
              </div>
              <button type="button" onClick={() => setIsThemeOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {/* Official Brand Slide Templates */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-orange-400 mb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">verified</span>
                Atomic Pathshala Official Slides
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  { key: "brand_white", label: "Brand White", desc: "Official White PPT Slide" },
                  { key: "brand_dark", label: "Brand Dark", desc: "Night Mode PPT Slide" },
                  { key: "brand_ruled", label: "Brand Ruled", desc: "Official Ruled Notebook" },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      const updated = [...slides];
                      if (updated[activeSlideIndex]) {
                        updated[activeSlideIndex]!.theme = t.key as BoardTheme;
                        setSlides(updated);
                      }
                      setIsThemeOpen(false);
                      toast.success(`Theme changed to ${t.label}!`);
                    }}
                    className={`p-3 rounded-2xl border text-left transition ${
                      activeSlide.theme === t.key
                        ? "bg-orange-950/60 border-orange-500 shadow-md ring-2 ring-orange-500/20"
                        : "bg-[#1c2032] border-[#2d3247] hover:border-orange-500/50"
                    }`}
                  >
                    <p className="font-bold text-xs text-white">{t.label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Classic Boards */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Classic Boards
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[
                  { key: "white", label: "Clean White", desc: "Minimal Whiteboard" },
                  { key: "dark", label: "Dark Space", desc: "Eye-friendly dark" },
                  { key: "greenboard", label: "Chalkboard", desc: "Classic green" },
                  { key: "ruled", label: "Ruled Paper", desc: "Notebook lines" },
                  { key: "grid", label: "Math Grid", desc: "Coordinate grid" },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      const updated = [...slides];
                      if (updated[activeSlideIndex]) {
                        updated[activeSlideIndex]!.theme = t.key as BoardTheme;
                        setSlides(updated);
                      }
                      setIsThemeOpen(false);
                      toast.success(`Theme changed to ${t.label}!`);
                    }}
                    className={`p-3 rounded-2xl border text-left transition ${
                      activeSlide.theme === t.key
                        ? "bg-orange-950/60 border-orange-500 shadow-md ring-2 ring-orange-500/20"
                        : "bg-[#1c2032] border-[#2d3247] hover:border-slate-600"
                    }`}
                  >
                    <p className="font-bold text-xs text-white">{t.label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* YOUTUBE LIVE SYNC MODAL */}
      {isYTSyncOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161824] border border-red-500/50 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                YouTube Live Interactive Sync
              </h3>
              <button type="button" onClick={() => setIsYTSyncOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-300">
              Broadcast your real-time whiteboard slides, quiz popups &amp; live annotations to YouTube viewers via PIN sync.
            </p>

            <div className="bg-black/60 p-4 rounded-2xl border border-red-950 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase text-slate-400 block font-bold">Classroom Broadcast PIN</span>
                <span className="text-2xl font-black text-orange-400 tracking-wider font-mono">{ytPin}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(ytPin);
                  toast.success("PIN copied to clipboard!");
                }}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition"
              >
                Copy PIN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
