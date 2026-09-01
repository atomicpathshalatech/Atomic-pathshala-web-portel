"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";

// Slide Theme Types
type BoardTheme = "dark" | "greenboard" | "grid" | "light" | "ruled";

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
  shapeType?: "rectangle" | "circle" | "benzene" | "coordinate_axes" | "arrow";
}

interface LivePoll {
  id: string;
  question: string;
  options: { key: string; text: string; votes: number }[];
  totalVotes: number;
  isActive: boolean;
  correctOption?: string;
  timerSec: number;
}

interface ChatMessage {
  id: string;
  sender: string;
  role: "TEACHER" | "STUDENT" | "ADMIN";
  message: string;
  time: string;
}

interface DoubtItem {
  id: string;
  studentName: string;
  text: string;
  time: string;
  isAnswered: boolean;
}

const DEFAULT_SLIDE: Slide = {
  id: "s-1",
  theme: "greenboard",
  title: "Slide 1: Reaction Kinetics & Benzene",
  strokes: [],
};

export function AtomicWhiteboardStudio({
  scheduleId = "live-101",
  classTitle = "NEET 2027 Chemistry: Organic Reaction Mechanisms & Benzene Masterclass",
  batchName = "YODHA Batch — Class 11 & 12",
  isTeacher = true,
}: {
  scheduleId?: string;
  classTitle?: string;
  batchName?: string;
  isTeacher?: boolean;
}) {
  // ---- PRE-CLASS SETUP WIZARD STATE ----
  const [setupStep, setSetupStep] = useState<number>(1); // 1: Platform, 2: Camera Layout, 3: Slides, 4: Device Test, 5: Ready
  const [isSetupOpen, setIsSetupOpen] = useState<boolean>(true);
  const [classPlatform, setClassPlatform] = useState<"ATOMIC_APP" | "YOUTUBE">("ATOMIC_APP");
  const [layoutMode, setLayoutMode] = useState<"SQUARE_SPLIT" | "FLOATING_PIP">("SQUARE_SPLIT");
  const [initialSlideType, setInitialSlideType] = useState<"DEFAULT_THEME" | "UPLOAD_SLIDES">("DEFAULT_THEME");
  const [selectedTheme, setSelectedTheme] = useState<BoardTheme>("greenboard");

  // ---- LIVE CLASS & STREAM STATE ----
  const [isLive, setIsLive] = useState(false);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const [viewerCount, setViewerCount] = useState(48);

  // ---- WEBCAM & AUDIO STATE ----
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCamPermission, setHasCamPermission] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [camShape, setCamShape] = useState<"circle" | "rounded">("rounded");
  const [pipPos, setPipPos] = useState<{ x: number; y: number }>({ x: 40, y: 100 });
  const [pipSize, setPipSize] = useState<{ width: number; height: number }>({ width: 220, height: 165 });
  const [isDraggingPip, setIsDraggingPip] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number }>({ x: 0, y: 0, posX: 0, posY: 0 });

  // ---- WHITEBOARD CANVAS STATE ----
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [slides, setSlides] = useState<Slide[]>([DEFAULT_SLIDE]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [tool, setTool] = useState<"pen" | "highlighter" | "eraser" | "shape">("pen");
  const [selectedShape, setSelectedShape] = useState<"rectangle" | "circle" | "benzene" | "coordinate_axes" | "arrow">("benzene");
  const [color, setColor] = useState("#ffffff");
  const [penSize, setPenSize] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<Stroke[][]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[][]>([]);

  // ---- INTERACTIVE POLLS & DOUBTS ----
  const [activePoll, setActivePoll] = useState<LivePoll | null>(null);
  const [isCreatePollOpen, setIsCreatePollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["Electrophilic Addition", "Electrophilic Aromatic Substitution", "Free Radical Substitution", "Nucleophilic Substitution"]);
  const [pollTimer, setPollTimer] = useState(45);
  const [pollRemaining, setPollRemaining] = useState(0);

  // ---- REALTIME CHAT (LOBBY + LIVE) ----
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: "c-1", sender: "Dr. Priya Sharma", role: "TEACHER", message: "Good evening students! Class will start in 2 minutes.", time: "18:28" },
    { id: "c-2", sender: "Rahul Verma", role: "STUDENT", message: "Good evening Sir! Benzene mechanism start karein please.", time: "18:29" },
    { id: "c-3", sender: "Anjali Gupta", role: "STUDENT", message: "Audio & Video clear hai!", time: "18:29" },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(true);

  // ---- IN-CLASS DOUBTS DESK ----
  const [doubts, setDoubts] = useState<DoubtItem[]>([
    { id: "d-1", studentName: "Aman Deep", text: "Why is benzene resonance energy 36 kcal/mol higher than cyclohexatriene?", time: "2m ago", isAnswered: false },
    { id: "d-2", studentName: "Sneha Roy", text: "Sir, what is the role of anhydrous AlCl3 in Friedel-Crafts alkylation?", time: "Just now", isAnswered: false },
  ]);
  const [isDoubtsOpen, setIsDoubtsOpen] = useState(false);

  const activeSlide: Slide = slides[activeSlideIndex] || slides[0] || DEFAULT_SLIDE;

  // ---- LIVE BROADCAST TIMER ----
  useEffect(() => {
    let interval: any = null;
    if (isLive) {
      interval = setInterval(() => setLiveSeconds((s) => s + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isLive]);

  const formatTimer = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${h > 0 ? pad(h) + ":" : ""}${pad(m)}:${pad(s)}`;
  };

  // ---- WEBCAM INITIALIZATION ----
  const initWebcam = useCallback(async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
          audio: true,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasCamPermission(true);
      }
    } catch (err) {
      console.warn("Webcam access optional/blocked:", err);
      setHasCamPermission(false);
    }
  }, []);

  useEffect(() => {
    initWebcam();
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [initWebcam]);

  // ---- RENDER WHITEBOARD CANVAS ----
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Canvas Background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const theme = activeSlide?.theme || "greenboard";

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
      for (let x = 0; x < canvas.width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 30) {
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
      for (let y = 40; y < canvas.height; y += 28) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(255, 99, 71, 0.3)";
      ctx.beginPath();
      ctx.moveTo(60, 0);
      ctx.lineTo(60, canvas.height);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw Slide Image if uploaded
    if (activeSlide?.imageUrl) {
      const img = new Image();
      img.src = activeSlide.imageUrl;
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
    }

    // Draw All Strokes
    const strokes = activeSlide?.strokes || [];
    strokes.forEach((stroke) => {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (stroke.tool === "highlighter") {
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = stroke.color === "#ffffff" ? "#fef08a" : stroke.color;
        ctx.lineWidth = stroke.size * 3;
      } else if (stroke.tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.lineWidth = stroke.size * 5;
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
            const r = Math.hypot(p2.x - p1.x, p2.y - p1.y) / 2 || 40;

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
            const w = Math.abs(p2.x - p1.x) || 120;
            const h = Math.abs(p2.y - p1.y) || 120;

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

  // ---- CANVAS MOUSE / TOUCH DRAWING HANDLERS ----
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
    const pos = getCoordinates(e);
    const theme = activeSlide?.theme || "greenboard";
    const newStroke: Stroke = {
      tool,
      color: theme === "light" || theme === "ruled" ? (color === "#ffffff" ? "#000000" : color) : color,
      size: penSize,
      points: [pos],
      shapeType: tool === "shape" ? selectedShape : undefined,
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

  const handleClear = () => {
    if (!confirm("Are you sure you want to clear this slide?")) return;
    const updated = [...slides];
    if (updated[activeSlideIndex]) {
      updated[activeSlideIndex]!.strokes = [];
      setSlides(updated);
      redrawCanvas();
    }
  };

  // ---- SLIDE MANAGEMENT ----
  const handleAddSlide = (theme: BoardTheme = activeSlide?.theme || "greenboard") => {
    const newSlide: Slide = {
      id: `s-${slides.length + 1}`,
      theme,
      title: `Slide ${slides.length + 1}`,
      strokes: [],
    };
    setSlides([...slides, newSlide]);
    setActiveSlideIndex(slides.length);
  };

  const handleSlideUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      const newSlide: Slide = {
        id: `s-${slides.length + 1}`,
        theme: "light",
        title: file.name,
        imageUrl: url,
        strokes: [],
      };
      setSlides([...slides, newSlide]);
      setActiveSlideIndex(slides.length);
      toast.success(`Slide "${file.name}" uploaded successfully!`);
    };
    reader.readAsDataURL(file);
  };

  // ---- LIVE POLL ENGINE ----
  const handleStartPoll = () => {
    if (!pollQuestion.trim()) return;

    const keys = ["A", "B", "C", "D"];
    const poll: LivePoll = {
      id: `poll-${Date.now()}`,
      question: pollQuestion,
      options: pollOptions.filter(Boolean).map((t, idx) => ({
        key: keys[idx] || `OPT-${idx + 1}`,
        text: t,
        votes: 0,
      })),
      totalVotes: 0,
      isActive: true,
      timerSec: pollTimer,
    };

    setActivePoll(poll);
    setPollRemaining(pollTimer);
    setIsCreatePollOpen(false);
    toast.success("Live MCQ Poll Broadcasted to students!");

    const pollInterval = setInterval(() => {
      setPollRemaining((r) => {
        if (r <= 1) {
          clearInterval(pollInterval);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  };

  // ---- IN-CLASS DOUBT PIN TO BOARD ----
  const handlePinDoubtToBoard = (doubt: DoubtItem) => {
    const updated = [...slides];
    const newSlide: Slide = {
      id: `s-${slides.length + 1}`,
      theme: "dark",
      title: `Doubt by ${doubt.studentName}`,
      strokes: [],
    };
    updated.push(newSlide);
    setSlides(updated);
    setActiveSlideIndex(updated.length - 1);

    toast.success(`Pinned ${doubt.studentName}'s doubt onto a new board slide!`);
    setIsDoubtsOpen(false);
  };

  // ---- REALTIME CHAT SEND ----
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: isTeacher ? "You (Teacher)" : "You (Student)",
      role: isTeacher ? "TEACHER" : "STUDENT",
      message: chatInput.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setChatInput("");
  };

  // ---- FLOATING PIP DRAG HANDLERS ----
  const handlePipMouseDown = (e: React.MouseEvent) => {
    setIsDraggingPip(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: pipPos.x,
      posY: pipPos.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingPip) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPipPos({
        x: Math.max(10, dragStartRef.current.posX + dx),
        y: Math.max(10, dragStartRef.current.posY + dy),
      });
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
  }, [isDraggingPip]);

  return (
    <div className="fixed inset-0 z-50 bg-[#060911] text-white flex flex-col overflow-hidden font-sans select-none">
      {/* ========================================================================= */}
      {/* 1. PRE-CLASS LIVE SETUP WIZARD (POPUP ON ENTERING LIVE CLASS)            */}
      {/* ========================================================================= */}
      {isSetupOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700/80 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-[0_25px_60px_rgba(0,0,0,0.7)] animate-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-400">
                  Step {setupStep} of 4 • Live Class Setup Wizard
                </span>
                <h2 className="text-lg font-black text-white mt-0.5">{classTitle}</h2>
                <p className="text-xs text-slate-400">{batchName}</p>
              </div>

              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4].map((s) => (
                  <div
                    key={s}
                    className={`w-2.5 h-2.5 rounded-full transition ${
                      setupStep === s ? "bg-purple-500 scale-125" : setupStep > s ? "bg-emerald-500" : "bg-slate-700"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* STEP 1: CHOOSE PLATFORM / DESTINATION */}
            {setupStep === 1 && (
              <div className="space-y-4">
                <p className="text-xs font-bold text-slate-300">
                  Select where you want to conduct this live class:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setClassPlatform("ATOMIC_APP")}
                    className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between space-y-3 ${
                      classPlatform === "ATOMIC_APP"
                        ? "bg-purple-950/40 border-purple-500 ring-2 ring-purple-500/30"
                        : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xl">🚀</span>
                      {classPlatform === "ATOMIC_APP" && (
                        <span className="px-2 py-0.5 rounded-full bg-purple-500 text-white text-[9px] font-black uppercase">
                          Selected
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">Atomic App Class</h4>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Encrypted in-app stream, real-time live chat, instant MCQ polls, and student doubt desk.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setClassPlatform("YOUTUBE")}
                    className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between space-y-3 ${
                      classPlatform === "YOUTUBE"
                        ? "bg-red-950/40 border-red-500 ring-2 ring-red-500/30"
                        : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xl">📺</span>
                      {classPlatform === "YOUTUBE" && (
                        <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-black uppercase">
                          Selected
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">YouTube Live Stream</h4>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Conduct open public stream or link YouTube Live broadcast with live whiteboard overlay.
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: CAMERA & SCREEN LAYOUT MODE */}
            {setupStep === 2 && (
              <div className="space-y-4">
                <p className="text-xs font-bold text-slate-300">
                  Select your Teacher Camera &amp; Screen layout preference:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setLayoutMode("SQUARE_SPLIT")}
                    className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between space-y-3 ${
                      layoutMode === "SQUARE_SPLIT"
                        ? "bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/30"
                        : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xl">🔲</span>
                      {layoutMode === "SQUARE_SPLIT" && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-500 text-white text-[9px] font-black uppercase">
                          Selected
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">Square Camera Mode</h4>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Fixed split view: Wide whiteboard on left, Right sidebar with square teacher camera on top and live chat underneath.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLayoutMode("FLOATING_PIP")}
                    className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between space-y-3 ${
                      layoutMode === "FLOATING_PIP"
                        ? "bg-purple-950/40 border-purple-500 ring-2 ring-purple-500/30"
                        : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xl">🔘</span>
                      {layoutMode === "FLOATING_PIP" && (
                        <span className="px-2 py-0.5 rounded-full bg-purple-500 text-white text-[9px] font-black uppercase">
                          Selected
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">Floating PiP Camera Mode</h4>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Infinite canvas with draggable floating camera anywhere on screen. Can be resized and moved as needed.
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: INITIAL SLIDE / BOARD THEME */}
            {setupStep === 3 && (
              <div className="space-y-4">
                <p className="text-xs font-bold text-slate-300">
                  Select your initial lecture slides or default whiteboard theme:
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setInitialSlideType("DEFAULT_THEME")}
                    className={`p-3 rounded-xl border text-left ${
                      initialSlideType === "DEFAULT_THEME"
                        ? "bg-purple-950/40 border-purple-500"
                        : "bg-slate-900/60 border-slate-800"
                    }`}
                  >
                    <p className="font-bold text-xs text-white">Use Board Theme</p>
                    <p className="text-[10px] text-slate-400">Start with themed blackboard/grid</p>
                  </button>

                  <label className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                    initialSlideType === "UPLOAD_SLIDES"
                      ? "bg-purple-950/40 border-purple-500"
                      : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                  }`}>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        setInitialSlideType("UPLOAD_SLIDES");
                        handleSlideUpload(e);
                      }}
                      className="hidden"
                    />
                    <p className="font-bold text-xs text-white">Upload PPT / PDF Slides</p>
                    <p className="text-[10px] text-slate-400">Import lecture slide deck</p>
                  </label>
                </div>

                {initialSlideType === "DEFAULT_THEME" && (
                  <div className="space-y-1.5 pt-2">
                    <label className="text-[10px] font-black uppercase text-slate-400">Board Theme</label>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { key: "greenboard", label: "Chalkboard", bg: "bg-[#0c281e]" },
                        { key: "dark", label: "Dark Space", bg: "bg-[#090d16]" },
                        { key: "grid", label: "Math Grid", bg: "bg-[#0f172a]" },
                        { key: "ruled", label: "Ruled Book", bg: "bg-white text-slate-900" },
                        { key: "light", label: "Clean White", bg: "bg-white text-slate-900" },
                      ].map((t) => (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => {
                            setSelectedTheme(t.key as BoardTheme);
                            const updated = [...slides];
                            if (updated[0]) {
                              updated[0].theme = t.key as BoardTheme;
                              setSlides(updated);
                            }
                          }}
                          className={`p-2 rounded-xl border text-center transition ${t.bg} ${
                            selectedTheme === t.key ? "ring-2 ring-purple-400 border-white" : "border-slate-700"
                          }`}
                        >
                          <span className="text-[10px] font-bold block truncate">{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 4: MIC & CAMERA DEVICE TEST */}
            {setupStep === 4 && (
              <div className="space-y-4">
                <p className="text-xs font-bold text-slate-300">
                  Audio &amp; Video Device Testing:
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* Camera Test Preview */}
                  <div className="relative w-48 h-36 bg-black rounded-2xl overflow-hidden border border-slate-700 shrink-0">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    {!isCameraOn && (
                      <div className="absolute inset-0 bg-slate-900 flex items-center justify-center text-xs text-slate-400">
                        Camera Off
                      </div>
                    )}
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-[9px] font-bold text-white">
                      Live Feed
                    </span>
                  </div>

                  {/* Device Toggles */}
                  <div className="space-y-2.5 flex-1 w-full text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-base text-purple-400">videocam</span>
                        <span>Camera</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsCameraOn(!isCameraOn)}
                        className={`px-3 py-1 rounded-lg font-bold text-xs transition ${
                          isCameraOn ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {isCameraOn ? "ON" : "OFF"}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-base text-purple-400">mic</span>
                        <span>Microphone</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsMicOn(!isMicOn)}
                        className={`px-3 py-1 rounded-lg font-bold text-xs transition ${
                          isMicOn ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {isMicOn ? "ON" : "MUTED"}
                      </button>
                    </div>

                    <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">Mic Level:</span>
                      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 animate-pulse w-3/4 rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Footer Navigation Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                disabled={setupStep === 1}
                onClick={() => setSetupStep((s) => s - 1)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white disabled:opacity-30"
              >
                Back
              </button>

              {setupStep < 4 ? (
                <button
                  type="button"
                  onClick={() => setSetupStep((s) => s + 1)}
                  className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition"
                >
                  Next Step ➔
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsSetupOpen(false);
                    setIsLive(true);
                    toast.success("🔴 Class Live Broadcast Started!");
                  }}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:opacity-90 text-white font-black text-xs shadow-lg shadow-red-600/30 flex items-center gap-1.5 animate-pulse"
                >
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  <span>Start Live Class Broadcast</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TOP STUDIO HEADER TOOLBAR                                              */}
      {/* ========================================================================= */}
      <header className="h-14 bg-[#0a0f1d] border-b border-slate-800 px-4 flex items-center justify-between shrink-0 z-40">
        {/* Left: Branding & Status */}
        <div className="flex items-center gap-3">
          <Link
            href="/team"
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition"
            title="Exit Studio"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span className="font-mono text-xs font-black text-red-500 uppercase tracking-widest">
              {isLive ? `LIVE • ${formatTimer(liveSeconds)}` : "PRE-CLASS LOBBY"}
            </span>
          </div>

          <span className="text-slate-700">|</span>

          <div>
            <h1 className="text-xs font-black text-white truncate max-w-sm">{classTitle}</h1>
            <p className="text-[10px] text-slate-400 truncate">{batchName}</p>
          </div>
        </div>

        {/* Center: Slide Switcher & Themes */}
        <div className="hidden md:flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-full px-3 py-1">
          <button
            type="button"
            disabled={activeSlideIndex === 0}
            onClick={() => setActiveSlideIndex((i) => i - 1)}
            className="text-slate-400 hover:text-white disabled:opacity-30 p-1"
          >
            <span className="material-symbols-outlined text-sm">chevron_left</span>
          </button>

          <span className="text-xs font-bold text-slate-200">
            Slide {activeSlideIndex + 1} / {slides.length}
          </span>

          <button
            type="button"
            disabled={activeSlideIndex === slides.length - 1}
            onClick={() => setActiveSlideIndex((i) => i + 1)}
            className="text-slate-400 hover:text-white disabled:opacity-30 p-1"
          >
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>

          <button
            type="button"
            onClick={() => handleAddSlide()}
            className="px-2 py-0.5 rounded-md bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold ml-1"
          >
            + Slide
          </button>
        </div>

        {/* Right: Layout Switcher, Polls, Doubts, Chat */}
        <div className="flex items-center gap-2">
          {/* Layout Toggle */}
          <button
            type="button"
            onClick={() => setLayoutMode(layoutMode === "SQUARE_SPLIT" ? "FLOATING_PIP" : "SQUARE_SPLIT")}
            className="px-2.5 py-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:border-purple-400 text-xs font-bold flex items-center gap-1 text-slate-300"
            title="Toggle Split View vs Floating PiP"
          >
            <span className="material-symbols-outlined text-sm">
              {layoutMode === "SQUARE_SPLIT" ? "splitscreen" : "picture_in_picture_alt"}
            </span>
            <span className="hidden sm:inline">
              {layoutMode === "SQUARE_SPLIT" ? "Split View" : "Floating PiP"}
            </span>
          </button>

          {/* Quick MCQ Poll */}
          <button
            type="button"
            onClick={() => setIsCreatePollOpen(true)}
            className="px-2.5 py-1.5 rounded-xl bg-amber-600/90 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1 shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">poll</span>
            <span className="hidden sm:inline">Launch Poll</span>
          </button>

          {/* Doubts Drawer */}
          <button
            type="button"
            onClick={() => setIsDoubtsOpen(!isDoubtsOpen)}
            className="px-2.5 py-1.5 rounded-xl bg-blue-600/90 hover:bg-blue-600 text-white text-xs font-bold flex items-center gap-1 relative"
          >
            <span className="material-symbols-outlined text-sm">live_help</span>
            <span className="hidden sm:inline">Doubts</span>
            {doubts.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-red-500 text-[9px] font-black flex items-center justify-center">
                {doubts.length}
              </span>
            )}
          </button>

          {/* Chat Toggle */}
          <button
            type="button"
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`p-1.5 rounded-xl border transition ${
              isChatOpen ? "bg-purple-600 text-white border-purple-500" : "bg-slate-900 text-slate-400 border-slate-700"
            }`}
          >
            <span className="material-symbols-outlined text-base">chat</span>
          </button>

          {/* Class Settings Modal Trigger */}
          <button
            type="button"
            onClick={() => setIsSetupOpen(true)}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Class Settings & Audio/Video Wizard"
          >
            <span className="material-symbols-outlined text-base">settings</span>
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 3. MAIN WORKSPACE: WHITEBOARD + CAMERA + LIVE CHAT                        */}
      {/* ========================================================================= */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT/CENTER: WHITEBOARD CANVAS AREA */}
        <div className="flex-1 flex flex-col relative overflow-hidden bg-black">
          {/* WHITEBOARD DRAWING TOOLBAR */}
          <div className="absolute top-3 left-4 z-30 flex items-center gap-1.5 bg-[#0f172a]/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-1.5 shadow-2xl">
            {/* Pen Tool */}
            <button
              type="button"
              onClick={() => setTool("pen")}
              className={`p-2 rounded-xl transition ${tool === "pen" ? "bg-purple-600 text-white" : "text-slate-400 hover:bg-slate-800"}`}
              title="Pen (Multi-color)"
            >
              <span className="material-symbols-outlined text-base">edit</span>
            </button>

            {/* Neon Highlighter */}
            <button
              type="button"
              onClick={() => setTool("highlighter")}
              className={`p-2 rounded-xl transition ${tool === "highlighter" ? "bg-yellow-500 text-black font-bold" : "text-slate-400 hover:bg-slate-800"}`}
              title="Neon Highlighter"
            >
              <span className="material-symbols-outlined text-base">ink_highlighter</span>
            </button>

            {/* Shape Palette (Benzene, Coordinate Axes, Geometry) */}
            <button
              type="button"
              onClick={() => setTool("shape")}
              className={`p-2 rounded-xl transition ${tool === "shape" ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800"}`}
              title="NEET / Science Diagrams"
            >
              <span className="material-symbols-outlined text-base">shapes</span>
            </button>

            {tool === "shape" && (
              <div className="flex items-center gap-1 pl-1 border-l border-slate-700">
                <button
                  type="button"
                  onClick={() => setSelectedShape("benzene")}
                  className={`px-2 py-1 rounded-lg text-[10px] font-black transition ${
                    selectedShape === "benzene" ? "bg-purple-500 text-white" : "text-slate-300 hover:bg-slate-800"
                  }`}
                  title="Aromatic Benzene Ring"
                >
                  Benzene ⌬
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedShape("coordinate_axes")}
                  className={`px-2 py-1 rounded-lg text-[10px] font-black transition ${
                    selectedShape === "coordinate_axes" ? "bg-purple-500 text-white" : "text-slate-300 hover:bg-slate-800"
                  }`}
                  title="X-Y Coordinate Graph Axes"
                >
                  Axes ✛
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedShape("rectangle")}
                  className={`px-2 py-1 rounded-lg text-[10px] font-black transition ${
                    selectedShape === "rectangle" ? "bg-purple-500 text-white" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  Box ▢
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedShape("circle")}
                  className={`px-2 py-1 rounded-lg text-[10px] font-black transition ${
                    selectedShape === "circle" ? "bg-purple-500 text-white" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  Circle ◯
                </button>
              </div>
            )}

            {/* Eraser */}
            <button
              type="button"
              onClick={() => setTool("eraser")}
              className={`p-2 rounded-xl transition ${tool === "eraser" ? "bg-rose-600 text-white" : "text-slate-400 hover:bg-slate-800"}`}
              title="Eraser"
            >
              <span className="material-symbols-outlined text-base">ink_eraser</span>
            </button>

            {/* Colors */}
            <div className="flex items-center gap-1 pl-1 border-l border-slate-700">
              {["#ffffff", "#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#a855f7"].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-4 h-4 rounded-full border border-slate-600 transition ${
                    color === c ? "scale-125 ring-2 ring-white" : ""
                  }`}
                />
              ))}
            </div>

            {/* Undo / Clear */}
            <div className="flex items-center gap-1 pl-1 border-l border-slate-700">
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
                onClick={handleClear}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400"
                title="Clear Slide"
              >
                <span className="material-symbols-outlined text-base">delete</span>
              </button>
            </div>
          </div>

          {/* CANVAS ELEMENT */}
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

          {/* ACTIVE LIVE MCQ POLL OVERLAY */}
          {activePoll && activePoll.isActive && (
            <div className="absolute top-20 right-6 z-30 bg-[#0f172a]/95 border border-amber-500/50 rounded-3xl p-5 shadow-2xl max-w-sm w-full animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                    Live MCQ Poll ({pollRemaining}s left)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActivePoll(null)}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>

              <h4 className="font-bold text-xs text-white mt-2 leading-snug">{activePoll.question}</h4>

              <div className="space-y-2 mt-3 text-xs">
                {activePoll.options.map((opt) => (
                  <div
                    key={opt.key}
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between"
                  >
                    <span className="font-bold text-slate-200">
                      {opt.key}. {opt.text}
                    </span>
                    <span className="font-mono font-bold text-amber-400 text-xs">
                      {Math.round((opt.votes / (activePoll.totalVotes || 1)) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FLOATING PIP CAMERA MODE (WHEN SELECTED) */}
          {layoutMode === "FLOATING_PIP" && isCameraOn && (
            <div
              style={{
                left: `${pipPos.x}px`,
                top: `${pipPos.y}px`,
                width: `${pipSize.width}px`,
                height: `${pipSize.height}px`,
              }}
              onMouseDown={handlePipMouseDown}
              className={`absolute z-40 bg-black overflow-hidden border-2 border-purple-500 shadow-2xl cursor-move transition-transform ${
                camShape === "circle" ? "rounded-full" : "rounded-2xl"
              }`}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover pointer-events-none"
              />
              <div className="absolute top-1 right-1 flex items-center gap-1 bg-black/60 rounded-full px-1.5 py-0.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCamShape(camShape === "circle" ? "rounded" : "circle");
                  }}
                  className="text-[9px] text-white"
                >
                  {camShape === "circle" ? "🔲" : "🔘"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR: SQUARE CAMERA ON TOP + REALTIME CHAT UNDERNEATH */}
        {layoutMode === "SQUARE_SPLIT" && (
          <aside className="w-80 lg:w-96 bg-[#0a0f1d] border-l border-slate-800 flex flex-col shrink-0 z-30">
            {/* 1. SQUARE TEACHER CAMERA (FIXED ON TOP) */}
            <div className="relative aspect-square w-full bg-black border-b border-slate-800 overflow-hidden shrink-0">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {!isCameraOn && (
                <div className="absolute inset-0 bg-slate-900 flex items-center justify-center text-xs text-slate-400">
                  Camera Muted
                </div>
              )}
              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full text-[10px] font-bold text-white">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{isTeacher ? "Teacher Cam" : "Live Stream"}</span>
              </div>
            </div>

            {/* 2. REAL-TIME LIVE CHAT (UNDERNEATH SQUARE CAMERA) */}
            <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0f1d]">
              {/* Chat Header */}
              <div className="px-3.5 py-2.5 border-b border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-slate-200">Live Chat</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 text-[9px] font-mono">
                    {viewerCount} students
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-bold">Zero-Delay</span>
              </div>

              {/* Chat Messages Feed */}
              <div className="flex-1 p-3 space-y-2.5 overflow-y-auto text-xs scrollbar-thin">
                {chatMessages.map((msg) => (
                  <div key={msg.id} className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                          msg.role === "TEACHER"
                            ? "bg-purple-600 text-white"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {msg.sender}
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono">{msg.time}</span>
                    </div>
                    <p className="text-slate-200 text-xs pl-0.5 leading-snug">{msg.message}</p>
                  </div>
                ))}
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={handleSendChat} className="p-2.5 border-t border-slate-800 bg-[#0f172a]">
                <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5">
                  <input
                    type="text"
                    placeholder="Send a live message..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="flex-1 bg-transparent text-xs text-white outline-none placeholder-slate-500"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center hover:bg-purple-500 disabled:opacity-40 transition"
                  >
                    <span className="material-symbols-outlined text-xs">send</span>
                  </button>
                </div>
              </form>
            </div>
          </aside>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. IN-CLASS STUDENT DOUBTS DESK DRAWER                                    */}
      {/* ========================================================================= */}
      {isDoubtsOpen && (
        <div className="fixed right-0 top-14 bottom-0 w-80 sm:w-96 z-40 bg-[#0f172a] border-l border-slate-800 shadow-2xl p-4 flex flex-col animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-extrabold text-sm text-white">Live Student Doubts</h3>
              <p className="text-[10px] text-slate-400">Questions asked during this lecture</p>
            </div>
            <button
              type="button"
              onClick={() => setIsDoubtsOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-3 space-y-3">
            {doubts.map((d) => (
              <div key={d.id} className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-400">{d.studentName}</span>
                  <span className="text-[10px] text-slate-500">{d.time}</span>
                </div>
                <p className="text-slate-200">{d.text}</p>
                <button
                  type="button"
                  onClick={() => handlePinDoubtToBoard(d)}
                  className="w-full py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">push_pin</span>
                  <span>Explain on Board</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. CREATE LIVE MCQ POLL MODAL                                             */}
      {/* ========================================================================= */}
      {isCreatePollOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-extrabold text-base text-white">Create Instant MCQ Poll</h3>
              <button
                type="button"
                onClick={() => setIsCreatePollOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-300">Poll / Quiz Question</label>
                <input
                  type="text"
                  placeholder="e.g. Which of the following is an aromatic compound?"
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="font-bold text-slate-300">4 Options</label>
                {pollOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-6 font-mono font-black text-purple-400">
                      {["A", "B", "C", "D"][idx]}.
                    </span>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const updated = [...pollOptions];
                        updated[idx] = e.target.value;
                        setPollOptions(updated);
                      }}
                      className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs outline-none"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="font-bold text-slate-300">Timer (Seconds)</label>
                <select
                  value={pollTimer}
                  onChange={(e) => setPollTimer(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold"
                >
                  <option value={30}>30 Seconds</option>
                  <option value={45}>45 Seconds</option>
                  <option value={60}>60 Seconds</option>
                  <option value={90}>90 Seconds</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreatePollOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-400 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStartPoll}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-md"
                >
                  Broadcast Poll
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
