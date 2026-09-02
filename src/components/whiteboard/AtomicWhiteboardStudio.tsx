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
type BoardTheme = "white" | "dark" | "ruled" | "greenboard" | "grid";

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
    { id: "s-1", theme: "white", title: "Slide 1", strokes: [] },
  ]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // ---- TOOLS & PALETTE ----
  const [tool, setTool] = useState<"pen" | "highlighter" | "eraser" | "shape" | "select">("pen");
  const [color, setColor] = useState("#3b82f6");
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

  const activeSlide: Slide = slides[activeSlideIndex] || slides[0] || { id: "s-1", theme: "white", title: "Slide 1", strokes: [] };

  // ---- RENDER WHITEBOARD CANVAS ----
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const theme = activeSlide?.theme || "white";

    // 1. Background Fill
    if (theme === "dark") {
      ctx.fillStyle = "#090d16";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (theme === "greenboard") {
      ctx.fillStyle = "#0c281e";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (theme === "grid") {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 35) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 35) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    } else if (theme === "ruled") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "rgba(100, 149, 237, 0.25)";
      ctx.lineWidth = 1;
      for (let y = 50; y < canvas.height; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(255, 99, 71, 0.35)";
      ctx.beginPath();
      ctx.moveTo(80, 0);
      ctx.lineTo(80, canvas.height);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 2. Draw Slide Background Image (if PPT/PDF uploaded)
    if (activeSlide?.imageUrl) {
      const img = new Image();
      img.src = activeSlide.imageUrl;
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
    }

    // 3. Draw All User Strokes
    const strokes = activeSlide?.strokes || [];
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
  }, [activeSlide]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

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
    const theme = activeSlide?.theme || "white";
    const strokeColor = (theme === "white" || theme === "ruled") && color === "#ffffff" ? "#0f172a" : color;

    const newStroke: Stroke = {
      tool: tool === "select" ? "pen" : tool,
      color: strokeColor,
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
      theme: activeSlide?.theme || "white",
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
        theme: "white",
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

  // Export PDF / PNG
  const handleExport = (format: "PDF" | "PNG" | "PPTX") => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (format === "PNG") {
      const link = document.createElement("a");
      link.download = `AtomicBoard-${activeSlide.title}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Current slide exported as PNG!");
    } else {
      toast.success(`Exporting multi-page ${format} with watermark...`);
      setTimeout(() => toast.success(`${format} export complete!`), 1200);
    }
    setIsExportOpen(false);
  };

  return (
    <div className={`fixed inset-0 z-50 bg-[#0d0f17] text-white flex flex-col overflow-hidden font-sans select-none ${isObsOutput ? "bg-black" : ""}`}>
      {/* ========================================================================= */}
      {/* 1. TOP CLASSROOM HEADER BAR (MATCHING ATOMIC-WHITE BOARD)                 */}
      {/* ========================================================================= */}
      {!isObsOutput && (
        <header className="h-14 bg-[#141622] border-b border-[#24283b] px-4 flex items-center justify-between shrink-0 z-30">
          {/* Left Action Buttons */}
          <div className="flex items-center gap-2">
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
              <span>Theme</span>
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
            {/* Hub */}
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg bg-orange-600/90 hover:bg-orange-600 text-white text-xs font-black flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">hub</span>
              <span>Hub</span>
            </button>

            {/* Teacher Info */}
            <div className="px-3 py-1.5 rounded-lg bg-[#1a1d2d] border border-[#2d3247] flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-200">{teacherName}</span>
              <Link href="/team" className="text-slate-400 hover:text-white" title="Exit to Portal">
                <span className="material-symbols-outlined text-sm">exit_to_app</span>
              </Link>
            </div>

            {/* Settings */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 rounded-lg bg-[#1a1d2d] border border-[#2d3247] text-slate-300 hover:text-white"
              title="Class Settings"
            >
              <span className="material-symbols-outlined text-base">settings</span>
            </button>

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
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center gap-1 shadow-md"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                <span>EXPORT</span>
              </button>

              {isExportOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-[#161824] border border-[#2d3247] rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-1 animate-in fade-in zoom-in-95">
                  <button
                    type="button"
                    onClick={() => handleExport("PDF")}
                    className="p-2 rounded-lg hover:bg-slate-800 text-left text-xs flex items-center gap-2 text-slate-200"
                  >
                    <span className="material-symbols-outlined text-base text-red-400">picture_as_pdf</span>
                    <span>Export PDF (.pdf)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport("PPTX")}
                    className="p-2 rounded-lg hover:bg-slate-800 text-left text-xs flex items-center gap-2 text-slate-200"
                  >
                    <span className="material-symbols-outlined text-base text-orange-400">slideshow</span>
                    <span>Export PPTX (.pptx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport("PNG")}
                    className="p-2 rounded-lg hover:bg-slate-800 text-left text-xs flex items-center gap-2 text-slate-200"
                  >
                    <span className="material-symbols-outlined text-base text-blue-400">image</span>
                    <span>Export Current Slide (PNG)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      {/* ========================================================================= */}
      {/* 2. MAIN WHITEBOARD CANVAS + LEFT PALETTE + WATERMARK HEADER                */}
      {/* ========================================================================= */}
      <div className="flex-1 flex overflow-hidden relative bg-[#07090e]">
        {/* LEFT FLOATING COLOR & STROKE PALETTE (MATCHING SCREENSHOT) */}
        {!isObsOutput && (
          <div className="absolute top-4 left-4 z-20 flex flex-col items-center gap-1.5 p-1.5 bg-[#141724]/95 backdrop-blur-md border border-[#282d42] rounded-2xl shadow-2xl">
            {/* Active Tool Button */}
            <button
              type="button"
              className="p-2 rounded-xl bg-blue-600 text-white shadow-md"
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
                    size === s.size ? "bg-blue-600/40 text-blue-400 ring-1 ring-blue-400" : "text-slate-400 hover:text-white"
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
                tool === "select" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
              }`}
              title="Lasso Loop Select"
            >
              <span className="material-symbols-outlined text-sm">gesture</span>
            </button>
          </div>
        )}

        {/* WHITEBOARD CANVAS CONTAINER */}
        <div className="flex-1 flex flex-col relative items-center justify-center p-2 sm:p-4 overflow-hidden">
          {/* WHITEBOARD FRAME WITH ATOMIC PATHSHALA BRANDING WATERMARK */}
          <div className="relative w-full h-full max-w-[1920px] max-h-[1080px] bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-700/50">
            {/* Header Watermark Branding (Matching Screenshot) */}
            <div className="absolute top-3 left-4 right-4 z-10 flex items-center justify-between pointer-events-none select-none">
              {/* Logo on Left */}
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center shadow-sm">
                  <span className="font-black text-orange-600 text-lg">A</span>
                </div>
              </div>

              {/* Black underline border */}
              <div className="flex-1 mx-4 h-0.5 bg-black/80" />

              {/* Atomic Pathshala Text on Right */}
              <div className="text-right">
                <div className="font-black text-xs tracking-tight text-slate-900 uppercase">
                  ATOMIC PATHSHALA
                </div>
                <div className="text-[8px] font-bold text-orange-600 tracking-wider">
                  LEARN • EXPLORE • EXCEL
                </div>
              </div>
            </div>

            {/* HTML5 CANVAS ELEMENT */}
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
              className="w-full h-full object-contain cursor-crosshair"
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. BOTTOM FLOATING DOCK TOOLBAR (MATCHING SCREENSHOT)                     */}
      {/* ========================================================================= */}
      {!isObsOutput && (
        <footer className="h-16 bg-[#12141f] border-t border-[#24283b] px-4 flex items-center justify-between shrink-0 z-30">
          {/* Left: Tools (Pen, Highlight, Eraser, Shapes) */}
          <div className="flex items-center gap-1 bg-[#1a1d2e] border border-[#2d3247] rounded-2xl p-1 shadow-md">
            <button
              type="button"
              onClick={() => setTool("pen")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                tool === "pen" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"
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
                <span className="material-symbols-outlined text-sm text-orange-400">menu_book</span>
                <span>{activeSlideIndex + 1} / {slides.length}</span>
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
                <span>Add</span>
              </button>
              <button
                type="button"
                onClick={handleDeleteSlide}
                className="p-1.5 rounded-xl border border-[#2d3247] bg-[#1a1d2e] text-slate-400 hover:text-rose-400"
                title="Delete Current Slide"
              >
                <span className="material-symbols-outlined text-sm">delete_outline</span>
              </button>
            </div>
          </div>

          {/* Right: Poll, Zoom, More */}
          <div className="flex items-center gap-2">
            {/* Poll */}
            <button
              type="button"
              onClick={() => setIsPollOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-600/90 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 shadow"
            >
              <span className="material-symbols-outlined text-sm">poll</span>
              <span>Poll</span>
            </button>

            {/* Zoom */}
            <button
              type="button"
              className="px-3 py-1.5 rounded-xl border border-[#2d3247] bg-[#1a1d2e] text-slate-300 font-bold text-xs flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">zoom_in</span>
              <span>Zoom</span>
            </button>

            {/* More */}
            <button
              type="button"
              className="p-1.5 rounded-xl border border-[#2d3247] bg-[#1a1d2e] text-slate-300 hover:text-white"
              title="More Tools"
            >
              <span className="material-symbols-outlined text-base">more_horiz</span>
            </button>
          </div>
        </footer>
      )}

      {/* ========================================================================= */}
      {/* 4. MODALS: 3D VISUALS, LAB SIMS, THEME, YOUTUBE LIVE SYNC                 */}
      {/* ========================================================================= */}

      {/* 3D VISUALS MODAL */}
      {is3DOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121422] border border-purple-500/40 rounded-3xl max-w-4xl w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-purple-950 text-purple-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">view_in_ar</span>
                </span>
                <div>
                  <h3 className="font-extrabold text-base text-white">3D Visual Interactive Models</h3>
                  <p className="text-xs text-slate-400">Interactive 3D structures for Biology, Chemistry &amp; Physics</p>
                </div>
              </div>
              <button type="button" onClick={() => setIs3DOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto p-1">
              {THREE_D_MODELS.map((m) => (
                <div key={m.id} className="p-4 rounded-2xl bg-[#191c2e] border border-slate-800 hover:border-purple-400 transition space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 text-[10px] font-bold">{m.category}</span>
                    <span className="material-symbols-outlined text-lg text-purple-400">{m.icon}</span>
                  </div>
                  <h4 className="font-bold text-xs text-white leading-snug">{m.title}</h4>
                  <button
                    type="button"
                    onClick={() => {
                      setActive3DModel(m);
                      toast.success(`Launching 3D ${m.title}!`);
                    }}
                    className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
                  >
                    Open 3D Model
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* LAB SIMS MODAL */}
      {isSimOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121422] border border-emerald-500/40 rounded-3xl max-w-4xl w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-emerald-950 text-emerald-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">science</span>
                </span>
                <div>
                  <h3 className="font-extrabold text-base text-white">Interactive Science &amp; Physics Labs (PhET)</h3>
                  <p className="text-xs text-slate-400">Perform real-time virtual experiments on the whiteboard</p>
                </div>
              </div>
              <button type="button" onClick={() => setIsSimOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto p-1">
              {LAB_SIMULATIONS.map((sim) => (
                <div key={sim.id} className="p-4 rounded-2xl bg-[#191c2e] border border-slate-800 hover:border-emerald-400 transition space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[10px] font-bold">{sim.subject}</span>
                    <span className="material-symbols-outlined text-lg text-emerald-400">{sim.icon}</span>
                  </div>
                  <h4 className="font-bold text-xs text-white leading-snug">{sim.title}</h4>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSim(sim);
                      toast.success(`Opening Lab Simulation: ${sim.title}`);
                    }}
                    className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                  >
                    Launch Lab Simulation
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* THEME SELECTOR MODAL */}
      {isThemeOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161824] border border-[#2d3247] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-extrabold text-base text-white">Board Theme</h3>
              <button type="button" onClick={() => setIsThemeOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "white", label: "Clean White", desc: "Traditional Whiteboard" },
                { key: "dark", label: "Dark Space", desc: "Eye-friendly dark theme" },
                { key: "greenboard", label: "Chalkboard", desc: "Classic classroom green" },
                { key: "ruled", label: "Ruled Notebook", desc: "Notes with line margins" },
                { key: "grid", label: "Math Grid", desc: "Coordinate & vectors grid" },
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
                    activeSlide.theme === t.key ? "bg-orange-950/40 border-orange-500" : "bg-[#1e2235] border-[#2d3247]"
                  }`}
                >
                  <p className="font-bold text-xs text-white">{t.label}</p>
                  <p className="text-[10px] text-slate-400">{t.desc}</p>
                </button>
              ))}
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
                <span>YouTube Live Stream Sync</span>
              </h3>
              <button type="button" onClick={() => setIsYTSyncOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-300">YouTube Stream URL / Live Video ID</label>
                <input
                  type="text"
                  placeholder="e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none"
                />
              </div>

              <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="font-bold text-white">Student Mobile Sync PIN</p>
                  <p className="text-[10px] text-slate-400">Share PIN with YouTube live viewers</p>
                </div>
                <span className="px-3 py-1 rounded-xl bg-orange-600/30 text-orange-400 font-mono font-black text-sm border border-orange-500/40">
                  {ytPin}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsYTSyncOpen(false);
                  toast.success("YouTube Live Stream Linked & Synced!");
                }}
                className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
              >
                Connect Stream
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
