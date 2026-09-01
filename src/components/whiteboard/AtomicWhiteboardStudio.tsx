"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";

interface Point {
  x: number;
  y: number;
  pressure?: number;
}

interface Stroke {
  id: string;
  tool: "pen" | "highlighter" | "eraser" | "laser" | "line" | "rect" | "circle" | "arrow" | "benzene" | "dna";
  color: string;
  size: number;
  points: Point[];
}

interface WhiteboardSlide {
  id: string;
  theme: "dark" | "light" | "grid" | "ruled" | "greenboard";
  strokes: Stroke[];
  imageUrl?: string;
}

export function AtomicWhiteboardStudio({
  initialTitle = "NEET Live Class — Atomic Pathshala",
  batchName = "YODHA NEET 2027",
}: {
  initialTitle?: string;
  batchName?: string;
}) {
  // Live Class State
  const [isLive, setIsLive] = useState(false);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const [studentCount, setStudentCount] = useState(148);
  const [classTitle, setClassTitle] = useState(initialTitle);

  // Tools & Canvas State
  const [activeTool, setActiveTool] = useState<Stroke["tool"]>("pen");
  const [penColor, setPenColor] = useState("#ffffff");
  const [penSize, setPenSize] = useState(4);
  const [slides, setSlides] = useState<WhiteboardSlide[]>([
    { id: "slide-1", theme: "dark", strokes: [] },
  ]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);

  // Teacher Camera PiP
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [cameraShape, setCameraShape] = useState<"rounded" | "circle">("rounded");
  const [pipPosition, setPipPosition] = useState({ x: 20, y: 80 });
  const [isDraggingPip, setIsDraggingPip] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Modals & Panels
  const [showPollModal, setShowPollModal] = useState(false);
  const [showDoubtsDrawer, setShowDoubtsDrawer] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [activePoll, setActivePoll] = useState<{
    question: string;
    options: { text: string; votes: number }[];
    active: boolean;
  } | null>(null);

  // Mock In-Class Doubts
  const [doubts, setDoubts] = useState([
    { id: "d1", student: "Aman Sharma", text: "Sir, sp3d2 hybridization ka geometry octahedral hi kyu hota hai?", time: "02:14 PM" },
    { id: "d2", student: "Pooja Verma", text: "Please explain lone pair repulsion in SF4 again.", time: "02:16 PM" },
  ]);

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Live Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLive) {
      interval = setInterval(() => {
        setLiveSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isLive]);

  // Webcam Stream
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (isCameraOn) {
      navigator.mediaDevices
        ?.getUserMedia({ video: true, audio: false })
        .then((s) => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
        })
        .catch(() => {
          // Camera permission denied or not available
        });
    } else {
      if (videoRef.current?.srcObject) {
        const s = videoRef.current.srcObject as MediaStream;
        s.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = null;
      }
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isCameraOn]);

  // Format Time
  const formatLiveTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h > 0 ? String(h).padStart(2, "0") + ":" : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const safeCurrentSlide: WhiteboardSlide = slides[currentSlideIndex] || {
    id: "fallback-slide",
    theme: "dark",
    strokes: [],
  };

  // Redraw Canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all strokes of current slide
    safeCurrentSlide.strokes.forEach((stroke) => {
      if (!stroke || stroke.points.length === 0) return;

      ctx.save();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (stroke.tool === "highlighter") {
        ctx.globalAlpha = 0.35;
      }

      if (stroke.tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.lineWidth = stroke.size * 3;
      }

      if (stroke.tool === "line" && stroke.points.length >= 2) {
        const start = stroke.points[0];
        const end = stroke.points[stroke.points.length - 1];
        if (start && end) {
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
        }
      } else if (stroke.tool === "rect" && stroke.points.length >= 2) {
        const start = stroke.points[0];
        const end = stroke.points[stroke.points.length - 1];
        if (start && end) {
          ctx.beginPath();
          ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
        }
      } else if (stroke.tool === "circle" && stroke.points.length >= 2) {
        const start = stroke.points[0];
        const end = stroke.points[stroke.points.length - 1];
        if (start && end) {
          const radius = Math.hypot(end.x - start.x, end.y - start.y);
          ctx.beginPath();
          ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
          ctx.stroke();
        }
      } else if (stroke.tool === "benzene" && stroke.points.length >= 2) {
        const start = stroke.points[0];
        const end = stroke.points[stroke.points.length - 1];
        if (start && end) {
          const r = Math.max(30, Math.hypot(end.x - start.x, end.y - start.y));
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const px = start.x + r * Math.cos(angle);
            const py = start.y + r * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
          // Inner circle for aromatic ring
          ctx.beginPath();
          ctx.arc(start.x, start.y, r * 0.55, 0, 2 * Math.PI);
          ctx.stroke();
        }
      } else {
        // Freehand path
        const first = stroke.points[0];
        if (first) {
          ctx.beginPath();
          ctx.moveTo(first.x, first.y);
          for (let i = 1; i < stroke.points.length; i++) {
            const pt = stroke.points[i];
            if (pt) ctx.lineTo(pt.x, pt.y);
          }
          ctx.stroke();
        }
      }

      ctx.restore();
    });
  }, [safeCurrentSlide]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas, currentSlideIndex, slides]);

  // Canvas Resize Handler
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
      redrawCanvas();
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [redrawCanvas]);

  // Pointer Down
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    isDrawingRef.current = true;
    currentStrokeRef.current = {
      id: Math.random().toString(36).substring(7),
      tool: activeTool,
      color: activeTool === "highlighter" ? "#facc15" : penColor,
      size: penSize,
      points: [{ x, y, pressure: e.pressure || 0.5 }],
    };
  };

  // Pointer Move
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    currentStrokeRef.current.points.push({ x, y, pressure: e.pressure || 0.5 });

    // For freehand drawing, draw live segment
    const ctx = canvas.getContext("2d");
    if (ctx && (activeTool === "pen" || activeTool === "highlighter" || activeTool === "eraser")) {
      const pts = currentStrokeRef.current.points;
      if (pts.length >= 2) {
        const p1 = pts[pts.length - 2];
        if (p1) {
          ctx.save();
          ctx.strokeStyle = currentStrokeRef.current.color;
          ctx.lineWidth = currentStrokeRef.current.size;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          if (activeTool === "highlighter") ctx.globalAlpha = 0.35;
          if (activeTool === "eraser") {
            ctx.globalCompositeOperation = "destination-out";
            ctx.lineWidth = penSize * 3;
          }

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(x, y);
          ctx.stroke();
          ctx.restore();
        }
      }
    } else {
      redrawCanvas();
    }
  };

  // Pointer Up
  const handlePointerUp = () => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    isDrawingRef.current = false;

    const newStroke = currentStrokeRef.current;
    currentStrokeRef.current = null;

    setSlides((prev) => {
      const updated = [...prev];
      const target = updated[currentSlideIndex];
      if (target) {
        updated[currentSlideIndex] = {
          ...target,
          strokes: [...target.strokes, newStroke],
        };
      }
      return updated;
    });
    setRedoStack([]);
  };

  // Undo / Redo
  const handleUndo = () => {
    setSlides((prev) => {
      const updated = [...prev];
      const target = updated[currentSlideIndex];
      if (!target || target.strokes.length === 0) return prev;
      const last = target.strokes[target.strokes.length - 1];
      if (last) {
        setRedoStack((r) => [...r, last]);
      }
      updated[currentSlideIndex] = {
        ...target,
        strokes: target.strokes.slice(0, -1),
      };
      return updated;
    });
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const lastRedo = redoStack[redoStack.length - 1];
    if (!lastRedo) return;
    setRedoStack((r) => r.slice(0, -1));
    setSlides((prev) => {
      const updated = [...prev];
      const target = updated[currentSlideIndex];
      if (target) {
        updated[currentSlideIndex] = {
          ...target,
          strokes: [...target.strokes, lastRedo],
        };
      }
      return updated;
    });
  };

  const handleClearSlide = () => {
    if (window.confirm("Clear all drawings on this slide?")) {
      setSlides((prev) => {
        const updated = [...prev];
        const target = updated[currentSlideIndex];
        if (target) {
          updated[currentSlideIndex] = { ...target, strokes: [] };
        }
        return updated;
      });
    }
  };

  const handleAddSlide = () => {
    const newSlide: WhiteboardSlide = {
      id: `slide-${slides.length + 1}`,
      theme: safeCurrentSlide.theme,
      strokes: [],
    };
    setSlides([...slides, newSlide]);
    setCurrentSlideIndex(slides.length);
  };

  // Drag Teacher PiP
  const handlePipMouseDown = (e: React.MouseEvent) => {
    setIsDraggingPip(true);
    dragOffsetRef.current = {
      x: e.clientX - pipPosition.x,
      y: e.clientY - pipPosition.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingPip) {
        setPipPosition({
          x: Math.max(10, Math.min(window.innerWidth - 220, e.clientX - dragOffsetRef.current.x)),
          y: Math.max(70, Math.min(window.innerHeight - 180, e.clientY - dragOffsetRef.current.y)),
        });
      }
    };
    const handleMouseUp = () => setIsDraggingPip(false);

    if (isDraggingPip) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingPip, pipPosition]);

  // Background Styles
  const getBackgroundClass = () => {
    switch (safeCurrentSlide.theme) {
      case "light":
        return "bg-white text-slate-900";
      case "greenboard":
        return "bg-[#0b3b24] text-white";
      case "grid":
        return "bg-[#121824] bg-[linear-gradient(to_right,#1f293d_1px,transparent_1px),linear-gradient(to_bottom,#1f293d_1px,transparent_1px)] bg-[size:24px_24px] text-white";
      case "ruled":
        return "bg-[#f8f9fa] bg-[linear-gradient(to_bottom,#cbd5e1_1px,transparent_1px)] bg-[size:100%_28px] text-slate-900";
      case "dark":
      default:
        return "bg-[#0a0f1d] text-white";
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#060a14] flex flex-col font-sans select-none overflow-hidden">
      {/* 1. TOP HEADER RIBBON */}
      <header className="h-14 bg-[#0a0f1d]/95 backdrop-blur border-b border-slate-800 px-4 flex items-center justify-between z-30 shrink-0">
        {/* Left: Class Info & Live Status */}
        <div className="flex items-center gap-3">
          <Link
            href="/team"
            className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center transition"
            title="Exit Classroom"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-white tracking-wide">{classTitle}</span>
              <span className="bg-purple-950/80 border border-purple-700/60 text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded">
                {batchName}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              {isLive ? (
                <span className="flex items-center gap-1.5 text-red-400 font-bold animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                  LIVE • {formatLiveTime(liveSeconds)}
                </span>
              ) : (
                <span className="text-slate-500 font-medium">Ready to Stream</span>
              )}
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-amber-400">group</span>
                {studentCount} Students
              </span>
            </div>
          </div>
        </div>

        {/* Center: Slide Switcher */}
        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
            disabled={currentSlideIndex === 0}
            className="p-1 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 transition"
          >
            <span className="material-symbols-outlined text-base">chevron_left</span>
          </button>
          <span className="text-xs font-mono font-bold text-white px-2">
            Slide {currentSlideIndex + 1} / {slides.length}
          </span>
          <button
            type="button"
            onClick={() => setCurrentSlideIndex(Math.min(slides.length - 1, currentSlideIndex + 1))}
            disabled={currentSlideIndex === slides.length - 1}
            className="p-1 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 transition"
          >
            <span className="material-symbols-outlined text-base">chevron_right</span>
          </button>
          <button
            type="button"
            onClick={handleAddSlide}
            className="ml-1 px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-xs">add</span>
            <span>Slide</span>
          </button>
        </div>

        {/* Right: Stream / Broadcast CTA & Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowThemeModal(true)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Board Theme"
          >
            <span className="material-symbols-outlined text-sm">palette</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPollModal(true)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition relative"
            title="Launch Live Poll"
          >
            <span className="material-symbols-outlined text-sm">bar_chart</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDoubtsDrawer(!showDoubtsDrawer)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition relative"
            title="Student Doubts"
          >
            <span className="material-symbols-outlined text-sm">help</span>
            {doubts.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                {doubts.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsLive(!isLive)}
            className={`px-4 py-2 rounded-xl font-bold text-xs shadow-lg transition flex items-center gap-1.5 ${
              isLive
                ? "bg-red-600 hover:bg-red-700 text-white shadow-red-600/30 animate-pulse"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30"
            }`}
          >
            <span className="material-symbols-outlined text-sm">
              {isLive ? "stop_circle" : "videocam"}
            </span>
            <span>{isLive ? "End Live Class" : "Start Live Class"}</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN WHITEBOARD CANVAS AREA */}
      <div className={`flex-1 relative overflow-hidden ${getBackgroundClass()}`}>
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="absolute inset-0 cursor-crosshair touch-none"
        />

        {/* Floating Teacher Camera PiP */}
        {isCameraOn && (
          <div
            style={{ left: `${pipPosition.x}px`, top: `${pipPosition.y}px` }}
            onMouseDown={handlePipMouseDown}
            className={`absolute z-20 shadow-2xl border-2 border-purple-500/80 bg-black cursor-move overflow-hidden transition-all group ${
              cameraShape === "circle" ? "w-40 h-40 rounded-full" : "w-52 h-36 rounded-2xl"
            }`}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover pointer-events-none transform -scale-x-100"
            />
            {/* Overlay Camera Controls */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCameraShape(cameraShape === "rounded" ? "circle" : "rounded");
                }}
                className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/40 text-xs"
                title="Toggle Shape"
              >
                <span className="material-symbols-outlined text-sm">crop_free</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCameraOn(false);
                }}
                className="p-1.5 rounded-lg bg-red-600 text-white text-xs"
                title="Turn Off Camera"
              >
                <span className="material-symbols-outlined text-sm">videocam_off</span>
              </button>
            </div>
          </div>
        )}

        {/* In-Class Doubts Drawer */}
        {showDoubtsDrawer && (
          <div className="absolute right-4 top-4 bottom-20 w-80 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-3xl p-4 flex flex-col z-30 shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-purple-400">help</span>
                Live Student Doubts
              </h3>
              <button
                type="button"
                onClick={() => setShowDoubtsDrawer(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {doubts.map((d) => (
                <div
                  key={d.id}
                  className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-purple-300">{d.student}</span>
                    <span className="text-slate-400">{d.time}</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">{d.text}</p>
                  <button
                    type="button"
                    onClick={() => {
                      alert(`Projecting doubt to whiteboard: "${d.text}"`);
                    }}
                    className="w-full mt-1 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 text-[10px] font-bold transition flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">draw</span>
                    <span>Explain on Board</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Live Poll Banner */}
        {activePoll && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-full max-w-md bg-slate-900/95 border border-purple-500 rounded-2xl p-4 shadow-2xl z-30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-amber-400 uppercase tracking-wider">
                Active Live Poll
              </span>
              <button
                type="button"
                onClick={() => setActivePoll(null)}
                className="text-xs text-slate-400 hover:text-white font-bold"
              >
                Close Poll
              </button>
            </div>
            <p className="text-xs font-bold text-white">{activePoll.question}</p>
            <div className="space-y-1.5">
              {activePoll.options.map((opt, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-300">
                    <span>{opt.text}</span>
                    <span className="font-mono font-bold">{opt.votes} votes</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full"
                      style={{ width: `${Math.min(100, opt.votes * 10)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. BOTTOM FLOATING TOOLBAR */}
      <footer className="h-16 bg-[#0a0f1d]/95 backdrop-blur border-t border-slate-800 px-4 flex items-center justify-between z-30 shrink-0">
        {/* Left: Device Toggles */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsMicOn(!isMicOn)}
            className={`p-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
              isMicOn
                ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                : "bg-red-600 text-white hover:bg-red-700"
            }`}
            title="Toggle Microphone"
          >
            <span className="material-symbols-outlined text-base">
              {isMicOn ? "mic" : "mic_off"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsCameraOn(!isCameraOn)}
            className={`p-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
              isCameraOn
                ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                : "bg-red-600 text-white hover:bg-red-700"
            }`}
            title="Toggle Teacher Camera"
          >
            <span className="material-symbols-outlined text-base">
              {isCameraOn ? "videocam" : "videocam_off"}
            </span>
          </button>
        </div>

        {/* Center: Drawing Tools Palette */}
        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1.5 rounded-2xl shadow-xl">
          {/* Pen */}
          <button
            type="button"
            onClick={() => setActiveTool("pen")}
            className={`p-2 rounded-xl transition ${
              activeTool === "pen"
                ? "bg-purple-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
            title="Pen"
          >
            <span className="material-symbols-outlined text-lg">edit</span>
          </button>

          {/* Highlighter */}
          <button
            type="button"
            onClick={() => setActiveTool("highlighter")}
            className={`p-2 rounded-xl transition ${
              activeTool === "highlighter"
                ? "bg-amber-500 text-black shadow-md font-bold"
                : "text-slate-400 hover:text-white"
            }`}
            title="Neon Highlighter"
          >
            <span className="material-symbols-outlined text-lg">ink_highlighter</span>
          </button>

          {/* Eraser */}
          <button
            type="button"
            onClick={() => setActiveTool("eraser")}
            className={`p-2 rounded-xl transition ${
              activeTool === "eraser"
                ? "bg-red-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
            title="Eraser"
          >
            <span className="material-symbols-outlined text-lg">ink_eraser</span>
          </button>

          <div className="w-px h-6 bg-slate-800 mx-1" />

          {/* Color Presets */}
          <div className="flex items-center gap-1 px-1">
            {["#ffffff", "#ef4444", "#3b82f6", "#22c55e", "#facc15", "#c084fc"].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setPenColor(c)}
                style={{ backgroundColor: c }}
                className={`w-5 h-5 rounded-full transition-transform ${
                  penColor === c ? "scale-125 ring-2 ring-purple-400" : "hover:scale-110"
                }`}
              />
            ))}
          </div>

          <div className="w-px h-6 bg-slate-800 mx-1" />

          {/* Shapes & NEET Diagrams */}
          <button
            type="button"
            onClick={() => setActiveTool("rect")}
            className={`p-2 rounded-xl transition ${
              activeTool === "rect" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"
            }`}
            title="Rectangle"
          >
            <span className="material-symbols-outlined text-lg">crop_square</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool("circle")}
            className={`p-2 rounded-xl transition ${
              activeTool === "circle" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"
            }`}
            title="Circle"
          >
            <span className="material-symbols-outlined text-lg">circle</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool("benzene")}
            className={`p-2 rounded-xl transition ${
              activeTool === "benzene" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"
            }`}
            title="Benzene Ring (Chemistry)"
          >
            <span className="material-symbols-outlined text-lg">hexagon</span>
          </button>
        </div>

        {/* Right: Undo / Redo / Clear / Export */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleUndo}
            className="p-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition"
            title="Undo (Ctrl+Z)"
          >
            <span className="material-symbols-outlined text-base">undo</span>
          </button>

          <button
            type="button"
            onClick={handleRedo}
            className="p-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition"
            title="Redo (Ctrl+Y)"
          >
            <span className="material-symbols-outlined text-base">redo</span>
          </button>

          <button
            type="button"
            onClick={handleClearSlide}
            className="p-2.5 rounded-xl bg-slate-800 text-red-400 hover:bg-red-600 hover:text-white transition"
            title="Clear Slide"
          >
            <span className="material-symbols-outlined text-base">delete</span>
          </button>
        </div>
      </footer>

      {/* MODAL: LIVE POLL LAUNCHER */}
      {showPollModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-black text-sm text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-400">bar_chart</span>
                Create Instant Live Poll
              </h3>
              <button
                type="button"
                onClick={() => setShowPollModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Poll Question</label>
                <input
                  type="text"
                  placeholder="e.g. Which orbital has highest screening effect?"
                  id="poll-q-input"
                  defaultValue="Hybridization of XeF4 is?"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  defaultValue="(A) sp3"
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                />
                <input
                  type="text"
                  defaultValue="(B) sp3d"
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                />
                <input
                  type="text"
                  defaultValue="(C) sp3d2"
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                />
                <input
                  type="text"
                  defaultValue="(D) dsp2"
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setActivePoll({
                  question: "Hybridization of XeF4 is?",
                  options: [
                    { text: "(A) sp3", votes: 8 },
                    { text: "(B) sp3d", votes: 14 },
                    { text: "(C) sp3d2", votes: 89 },
                    { text: "(D) dsp2", votes: 3 },
                  ],
                  active: true,
                });
                setShowPollModal(false);
              }}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg transition"
            >
              Broadcast Poll to Live Students
            </button>
          </div>
        </div>
      )}

      {/* MODAL: BOARD THEME SELECTOR */}
      {showThemeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white">Board Theme</h3>
              <button
                type="button"
                onClick={() => setShowThemeModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: "dark", label: "Dark Space", bg: "bg-[#0a0f1d] border-slate-700" },
                { id: "greenboard", label: "Chalkboard Green", bg: "bg-[#0b3b24] border-emerald-800" },
                { id: "grid", label: "Math Grid", bg: "bg-[#121824] border-blue-900" },
                { id: "light", label: "Clean White", bg: "bg-white text-black border-slate-300" },
                { id: "ruled", label: "Ruled Notebook", bg: "bg-slate-100 text-black border-slate-300" },
              ].map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => {
                    setSlides((prev) => {
                      const updated = [...prev];
                      const target = updated[currentSlideIndex];
                      if (target) {
                        updated[currentSlideIndex] = {
                          ...target,
                          theme: theme.id as WhiteboardSlide["theme"],
                        };
                      }
                      return updated;
                    });
                    setShowThemeModal(false);
                  }}
                  className={`p-3 rounded-2xl border text-xs font-bold text-left transition ${theme.bg} ${
                    safeCurrentSlide.theme === theme.id ? "ring-2 ring-purple-500" : ""
                  }`}
                >
                  {theme.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
