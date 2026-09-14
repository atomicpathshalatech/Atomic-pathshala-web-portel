"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Room, RoomEvent } from "livekit-client";

export type WhiteboardElement =
  | {
      id: string;
      type: "stroke";
      points: { x: number; y: number }[];
      color: string;
      width: number;
      isHighlighter?: boolean;
    }
  | {
      id: string;
      type: "line";
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      color: string;
      width: number;
    }
  | {
      id: string;
      type: "arrow";
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      color: string;
      width: number;
    }
  | {
      id: string;
      type: "rect";
      startX: number;
      startY: number;
      width: number;
      height: number;
      color: string;
      strokeWidth: number;
    }
  | {
      id: string;
      type: "circle";
      centerX: number;
      centerY: number;
      radiusX: number;
      radiusY: number;
      color: string;
      strokeWidth: number;
    }
  | {
      id: string;
      type: "text";
      x: number;
      y: number;
      text: string;
      color: string;
      fontSize: number;
    };

export type ToolMode =
  | "pen"
  | "highlighter"
  | "line"
  | "arrow"
  | "rect"
  | "circle"
  | "text"
  | "eraser";

const PALETTE_COLORS = [
  "#ffffff", // White
  "#facc15", // Bright Yellow
  "#4ade80", // Emerald Green
  "#38bdf8", // Sky Blue
  "#f87171", // Soft Red
  "#fb923c", // Orange
  "#c084fc", // Purple / Violet
  "#f472b6", // Pink
];

const STROKE_WIDTHS = [
  { label: "Fine", value: 2 },
  { label: "Medium", value: 4 },
  { label: "Bold", value: 8 },
];

export function DoubtWhiteboard({
  room,
  isTeacher,
  topic,
  description,
  questionImageUrls = [],
  onClose,
}: {
  room: Room;
  isTeacher: boolean;
  topic?: string;
  description?: string;
  questionImageUrls?: string[];
  onClose?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Drawing state
  const [elements, setElements] = useState<WhiteboardElement[]>([]);
  const [undoStack, setUndoStack] = useState<WhiteboardElement[][]>([]);
  const [currentTool, setCurrentTool] = useState<ToolMode>("pen");
  const [currentColor, setCurrentColor] = useState<string>("#ffffff");
  const [strokeWidth, setStrokeWidth] = useState<number>(4);

  // Projected Image State
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);
  const activeImageRef = useRef<string | null>(null);
  activeImageRef.current = activeImageUrl;
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // In-progress drawing
  const isDrawingRef = useRef(false);
  const currentElementRef = useRef<WhiteboardElement | null>(null);
  const elementsRef = useRef<WhiteboardElement[]>(elements);
  elementsRef.current = elements;

  // Text input modal/prompt state
  const [textInput, setTextInput] = useState<{ x: number; y: number; val: string } | null>(null);

  // Helper to publish messages over LiveKit data channel
  const broadcast = useCallback(
    (messageObj: any) => {
      try {
        if (!room?.localParticipant) return;
        const payload = new TextEncoder().encode(JSON.stringify(messageObj));
        room.localParticipant.publishData(payload, { reliable: true });
      } catch (err) {
        console.error("[DoubtWhiteboard] publishData error:", err);
      }
    },
    [room]
  );

  // Load projected image into memory
  useEffect(() => {
    if (!activeImageUrl) {
      setLoadedImage(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setLoadedImage(img);
    };
    img.onerror = () => {
      console.error("[DoubtWhiteboard] Failed to load projected image:", activeImageUrl);
    };
    img.src = activeImageUrl;
  }, [activeImageUrl]);

  // Listen for remote real-time events from LiveKit room
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text);

        if (data.type === "WB_ELEMENT_ADDED" && data.element) {
          setElements((prev) => {
            const next = [...prev.filter((e) => e.id !== data.element.id), data.element];
            return next;
          });
        } else if (data.type === "WB_CLEAR") {
          setElements([]);
          setUndoStack([]);
        } else if (data.type === "WB_UNDO" && Array.isArray(data.elements)) {
          setElements(data.elements);
        } else if (data.type === "WB_SNAPSHOT") {
          if (Array.isArray(data.elements)) {
            setElements(data.elements);
          }
          if (data.activeImageUrl !== undefined) {
            setActiveImageUrl(data.activeImageUrl ?? null);
          }
        } else if (data.type === "WB_SET_IMAGE") {
          setActiveImageUrl(data.url ?? null);
        } else if (data.type === "WB_REQUEST_SYNC" && isTeacher) {
          // Teacher sends full snapshot (elements + active image) to student
          broadcast({
            type: "WB_SNAPSHOT",
            elements: elementsRef.current,
            activeImageUrl: activeImageRef.current,
          });
        }
      } catch (err) {
        console.error("[DoubtWhiteboard] DataReceived parse error:", err);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);

    // If student joined, request snapshot
    if (!isTeacher) {
      broadcast({ type: "WB_REQUEST_SYNC" });
    }

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, isTeacher, broadcast]);

  const handleSetProjectedImage = (url: string | null) => {
    setActiveImageUrl(url);
    broadcast({ type: "WB_SET_IMAGE", url });
    setShowImagePicker(false);
  };

  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "doubt-whiteboard");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (json.success && json.data?.url) {
        handleSetProjectedImage(json.data.url);
      } else {
        alert(json.error?.message || "Failed to upload image");
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Failed to upload image");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Re-draw canvas on elements change or resize
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, w, h);

    // Draw dark chalkboard background with subtle dotted grid
    ctx.fillStyle = "#0f172a"; // slate-900 chalkboard
    ctx.fillRect(0, 0, w, h);

    // Draw subtle grid dots
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    const dotSpacing = 32;
    for (let x = dotSpacing; x < w; x += dotSpacing) {
      for (let y = dotSpacing; y < h; y += dotSpacing) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw projected question image if active
    if (loadedImage) {
      const imgW = loadedImage.naturalWidth || 800;
      const imgH = loadedImage.naturalHeight || 600;
      const imgAspect = imgW / imgH;
      const canvasAspect = w / h;
      let drawW = w;
      let drawH = h;
      if (imgAspect > canvasAspect) {
        drawW = w * 0.85;
        drawH = drawW / imgAspect;
      } else {
        drawH = h * 0.85;
        drawW = drawH * imgAspect;
      }
      const drawX = (w - drawW) / 2;
      const drawY = (h - drawH) / 2;

      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
      ctx.shadowBlur = 24;
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(drawX - 2, drawY - 2, drawW + 4, drawH + 4);
      ctx.drawImage(loadedImage, drawX, drawY, drawW, drawH);
      ctx.restore();
    }

    // Helper to render an individual element
    const drawItem = (el: WhiteboardElement) => {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (el.type === "stroke") {
        if (el.points.length < 2) {
          ctx.restore();
          return;
        }
        ctx.strokeStyle = el.color;
        ctx.lineWidth = el.width;
        if (el.isHighlighter) {
          ctx.globalAlpha = 0.35;
          ctx.lineWidth = el.width * 2.5;
        }

        const first = el.points[0];
        if (!first) {
          ctx.restore();
          return;
        }

        ctx.beginPath();
        ctx.moveTo(first.x * w, first.y * h);
        for (let i = 1; i < el.points.length; i++) {
          const pt = el.points[i];
          if (pt) ctx.lineTo(pt.x * w, pt.y * h);
        }
        ctx.stroke();
      } else if (el.type === "line") {
        ctx.strokeStyle = el.color;
        ctx.lineWidth = el.width;
        ctx.beginPath();
        ctx.moveTo(el.startX * w, el.startY * h);
        ctx.lineTo(el.endX * w, el.endY * h);
        ctx.stroke();
      } else if (el.type === "arrow") {
        ctx.strokeStyle = el.color;
        ctx.fillStyle = el.color;
        ctx.lineWidth = el.width;

        const fromX = el.startX * w;
        const fromY = el.startY * h;
        const toX = el.endX * w;
        const toY = el.endY * h;

        // Line
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();

        // Arrow head
        const angle = Math.atan2(toY - fromY, toX - fromX);
        const headlen = Math.max(10, el.width * 3);
        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(
          toX - headlen * Math.cos(angle - Math.PI / 6),
          toY - headlen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          toX - headlen * Math.cos(angle + Math.PI / 6),
          toY - headlen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      } else if (el.type === "rect") {
        ctx.strokeStyle = el.color;
        ctx.lineWidth = el.strokeWidth;
        const rx = el.startX * w;
        const ry = el.startY * h;
        const rw = el.width * w;
        const rh = el.height * h;
        ctx.strokeRect(rx, ry, rw, rh);
      } else if (el.type === "circle") {
        ctx.strokeStyle = el.color;
        ctx.lineWidth = el.strokeWidth;
        const cx = el.centerX * w;
        const cy = el.centerY * h;
        const rx = Math.abs(el.radiusX * w);
        const ry = Math.abs(el.radiusY * h);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (el.type === "text") {
        ctx.fillStyle = el.color;
        ctx.font = `bold ${Math.max(14, el.fontSize * (w / 800))}px system-ui, -apple-system, sans-serif`;
        ctx.fillText(el.text, el.x * w, el.y * h);
      }

      ctx.restore();
    };

    // Render confirmed elements
    for (const el of elements) {
      drawItem(el);
    }

    // Render element currently being drawn by teacher
    if (currentElementRef.current) {
      drawItem(currentElementRef.current);
    }
  }, [elements, loadedImage]);

  // Handle resize & sync resolution
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        canvas.width = rect.width;
        canvas.height = rect.height;
        renderCanvas();
      }
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [renderCanvas]);

  useEffect(() => {
    renderCanvas();
  }, [elements, loadedImage, renderCanvas]);

  // Pointer event helpers (teacher only)
  const getNormCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    return {
      x: Math.max(0, Math.min(1, clientX / rect.width)),
      y: Math.max(0, Math.min(1, clientY / rect.height)),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isTeacher) return;
    const coords = getNormCoords(e);
    isDrawingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const id = "el_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);

    if (currentTool === "pen" || currentTool === "highlighter") {
      currentElementRef.current = {
        id,
        type: "stroke",
        points: [coords],
        color: currentColor,
        width: strokeWidth,
        isHighlighter: currentTool === "highlighter",
      };
    } else if (currentTool === "line") {
      currentElementRef.current = {
        id,
        type: "line",
        startX: coords.x,
        startY: coords.y,
        endX: coords.x,
        endY: coords.y,
        color: currentColor,
        width: strokeWidth,
      };
    } else if (currentTool === "arrow") {
      currentElementRef.current = {
        id,
        type: "arrow",
        startX: coords.x,
        startY: coords.y,
        endX: coords.x,
        endY: coords.y,
        color: currentColor,
        width: strokeWidth,
      };
    } else if (currentTool === "rect") {
      currentElementRef.current = {
        id,
        type: "rect",
        startX: coords.x,
        startY: coords.y,
        width: 0,
        height: 0,
        color: currentColor,
        strokeWidth,
      };
    } else if (currentTool === "circle") {
      currentElementRef.current = {
        id,
        type: "circle",
        centerX: coords.x,
        centerY: coords.y,
        radiusX: 0,
        radiusY: 0,
        color: currentColor,
        strokeWidth,
      };
    } else if (currentTool === "text") {
      setTextInput({ x: coords.x, y: coords.y, val: "" });
      isDrawingRef.current = false;
    } else if (currentTool === "eraser") {
      // Delete top element near clicked point
      eraseAt(coords);
    }

    renderCanvas();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isTeacher || !isDrawingRef.current || !currentElementRef.current) return;
    const coords = getNormCoords(e);

    const el = currentElementRef.current;
    if (el.type === "stroke") {
      el.points.push(coords);
    } else if (el.type === "line" || el.type === "arrow") {
      el.endX = coords.x;
      el.endY = coords.y;
    } else if (el.type === "rect") {
      el.width = coords.x - el.startX;
      el.height = coords.y - el.startY;
    } else if (el.type === "circle") {
      el.radiusX = Math.abs(coords.x - el.centerX);
      el.radiusY = Math.abs(coords.y - el.centerY);
    } else if (currentTool === "eraser") {
      eraseAt(coords);
    }

    renderCanvas();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isTeacher || !isDrawingRef.current) return;
    isDrawingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    if (currentElementRef.current && currentTool !== "eraser") {
      const finalEl = currentElementRef.current;
      currentElementRef.current = null;

      // Save to undo stack
      setUndoStack((prev) => [...prev, elementsRef.current]);

      // Add to elements
      setElements((prev) => {
        const next = [...prev, finalEl];
        return next;
      });

      // Broadcast to other participants
      broadcast({ type: "WB_ELEMENT_ADDED", element: finalEl });
    }
  };

  // Erase element near point
  const eraseAt = (coords: { x: number; y: number }) => {
    const threshold = 0.03;
    setElements((prev) => {
      const remaining = prev.filter((el) => {
        if (el.type === "stroke") {
          return !el.points.some(
            (p) => Math.hypot(p.x - coords.x, p.y - coords.y) < threshold
          );
        } else if (el.type === "line" || el.type === "arrow") {
          const midX = (el.startX + el.endX) / 2;
          const midY = (el.startY + el.endY) / 2;
          return Math.hypot(midX - coords.x, midY - coords.y) > threshold * 2;
        } else if (el.type === "rect") {
          return (
            coords.x < Math.min(el.startX, el.startX + el.width) - threshold ||
            coords.x > Math.max(el.startX, el.startX + el.width) + threshold ||
            coords.y < Math.min(el.startY, el.startY + el.height) - threshold ||
            coords.y > Math.max(el.startY, el.startY + el.height) + threshold
          );
        } else if (el.type === "circle") {
          return Math.hypot(el.centerX - coords.x, el.centerY - coords.y) > threshold * 2;
        } else if (el.type === "text") {
          return Math.hypot(el.x - coords.x, el.y - coords.y) > threshold * 2;
        }
        return true;
      });

      if (remaining.length !== prev.length) {
        broadcast({ type: "WB_SNAPSHOT", elements: remaining });
      }
      return remaining;
    });
  };

  // Confirm Text input
  const submitText = () => {
    if (!textInput || !textInput.val.trim()) {
      setTextInput(null);
      return;
    }
    const id = "el_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
    const newText: WhiteboardElement = {
      id,
      type: "text",
      x: textInput.x,
      y: textInput.y,
      text: textInput.val.trim(),
      color: currentColor,
      fontSize: strokeWidth * 4 + 10,
    };

    setUndoStack((prev) => [...prev, elementsRef.current]);
    setElements((prev) => [...prev, newText]);
    broadcast({ type: "WB_ELEMENT_ADDED", element: newText });
    setTextInput(null);
  };

  // Undo action
  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    if (!previous) return;
    setUndoStack((prev) => prev.slice(0, prev.length - 1));
    setElements(previous);
    broadcast({ type: "WB_UNDO", elements: previous });
  };

  // Clear action
  const handleClear = () => {
    if (elements.length === 0) return;
    setUndoStack((prev) => [...prev, elementsRef.current]);
    setElements([]);
    broadcast({ type: "WB_CLEAR" });
  };

  return (
    <div className="relative h-full w-full flex flex-col bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 select-none shadow-2xl">
      {/* Top Header / Status Strip */}
      <div className="h-10 px-3.5 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between text-xs text-white z-20 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="font-bold tracking-wide flex items-center gap-1 shrink-0">
            <span className="material-symbols-outlined text-[15px] text-amber-400">draw</span>
            {isTeacher ? "Teacher Whiteboard" : "Live Doubt Whiteboard"}
          </span>
          <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded font-mono shrink-0">
            {isTeacher ? "Instructor Mode" : "Student View"}
          </span>
          {topic && (
            <div className="hidden sm:flex items-center gap-1.5 ml-2 pl-2 border-l border-slate-700 min-w-0">
              <span className="text-[10px] uppercase font-bold text-amber-400 shrink-0">Topic:</span>
              <span className="text-slate-300 font-medium truncate max-w-[200px] lg:max-w-[340px]" title={description || topic}>
                {topic}
              </span>
            </div>
          )}
          {activeImageUrl && (
            <span className="shrink-0 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">image</span>
              Image Projected
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isTeacher && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg text-[11px] font-semibold transition"
              title="Deactivate Whiteboard"
            >
              <span className="material-symbols-outlined text-sm">visibility_off</span>
              <span>Hide Board</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Canvas Area */}
      <div ref={containerRef} className="relative flex-1 w-full h-full overflow-hidden bg-slate-900">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`w-full h-full touch-none ${
            isTeacher
              ? currentTool === "eraser"
                ? "cursor-crosshair"
                : "cursor-crosshair"
              : "cursor-default"
          }`}
        />

        {/* Text Input Popup for Teacher */}
        {textInput && isTeacher && (
          <div
            className="absolute z-30 bg-slate-800 border border-slate-700 p-2 rounded-xl shadow-xl flex items-center gap-1.5"
            style={{
              left: `${textInput.x * 100}%`,
              top: `${textInput.y * 100}%`,
              transform: "translate(-10%, -50%)",
            }}
          >
            <input
              type="text"
              autoFocus
              value={textInput.val}
              onChange={(e) => setTextInput({ ...textInput, val: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitText();
                if (e.key === "Escape") setTextInput(null);
              }}
              placeholder="Type formula or text…"
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-blue-500 w-48"
            />
            <button
              type="button"
              onClick={submitText}
              className="bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold px-2 py-1 rounded-lg"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setTextInput(null)}
              className="text-slate-400 hover:text-white px-1.5 text-xs"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFileUpload}
      />

      {/* Image Projection Picker Popover for Teacher */}
      {isTeacher && showImagePicker && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-40 w-96 max-w-[92vw] bg-slate-900/95 backdrop-blur-md border border-slate-700 p-3.5 rounded-2xl shadow-2xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <span className="material-symbols-outlined text-amber-400 text-sm">photo_library</span>
              <span>Project Question Image</span>
            </div>
            <button
              type="button"
              onClick={() => setShowImagePicker(false)}
              className="text-slate-400 hover:text-white text-xs p-1"
            >
              ✕
            </button>
          </div>

          {/* Student Uploaded Images List */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-slate-400">Student&apos;s Doubt Attachments:</p>
            {questionImageUrls.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {questionImageUrls.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSetProjectedImage(url)}
                    className={`relative aspect-video rounded-lg overflow-hidden border transition group ${
                      activeImageUrl === url
                        ? "border-amber-400 ring-2 ring-amber-400/40"
                        : "border-slate-700 hover:border-slate-500"
                    }`}
                  >
                    <img src={url} alt={`Attachment ${idx + 1}`} className="w-full h-full object-cover" />
                    {activeImageUrl === url && (
                      <div className="absolute inset-0 bg-amber-500/30 flex items-center justify-center">
                        <span className="material-symbols-outlined text-amber-300 text-base font-bold">check_circle</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 italic">No attachments were uploaded by the student.</p>
            )}
          </div>

          {/* Actions: Upload Custom or Remove */}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex-1 py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition"
            >
              <span className="material-symbols-outlined text-[14px]">cloud_upload</span>
              <span>{isUploading ? "Uploading…" : "Upload Device Photo"}</span>
            </button>

            {activeImageUrl && (
              <button
                type="button"
                onClick={() => handleSetProjectedImage(null)}
                className="py-1.5 px-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 text-[11px] font-bold flex items-center gap-1 transition"
                title="Remove projected image"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
                <span>Clear Image</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Teacher Floating Toolbar (Bottom) */}
      {isTeacher && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 p-1.5 px-2.5 rounded-2xl shadow-2xl">
          {/* Tool Selector */}
          <div className="flex items-center gap-1 pr-1.5 border-r border-slate-700">
            <button
              type="button"
              onClick={() => setCurrentTool("pen")}
              className={`p-1.5 rounded-xl transition ${
                currentTool === "pen"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Pen"
            >
              <span className="material-symbols-outlined text-[18px]">edit</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentTool("highlighter")}
              className={`p-1.5 rounded-xl transition ${
                currentTool === "highlighter"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Highlighter"
            >
              <span className="material-symbols-outlined text-[18px]">border_color</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentTool("line")}
              className={`p-1.5 rounded-xl transition ${
                currentTool === "line"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Line"
            >
              <span className="material-symbols-outlined text-[18px]">horizontal_rule</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentTool("arrow")}
              className={`p-1.5 rounded-xl transition ${
                currentTool === "arrow"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Arrow"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_outward</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentTool("rect")}
              className={`p-1.5 rounded-xl transition ${
                currentTool === "rect"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Rectangle"
            >
              <span className="material-symbols-outlined text-[18px]">crop_square</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentTool("circle")}
              className={`p-1.5 rounded-xl transition ${
                currentTool === "circle"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Circle"
            >
              <span className="material-symbols-outlined text-[18px]">radio_button_unchecked</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentTool("text")}
              className={`p-1.5 rounded-xl transition ${
                currentTool === "text"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Text"
            >
              <span className="material-symbols-outlined text-[18px]">title</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentTool("eraser")}
              className={`p-1.5 rounded-xl transition ${
                currentTool === "eraser"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Eraser"
            >
              <span className="material-symbols-outlined text-[18px]">ink_eraser</span>
            </button>

            {/* Project Doubt Image Button */}
            <button
              type="button"
              onClick={() => setShowImagePicker((prev) => !prev)}
              className={`p-1.5 rounded-xl transition relative ${
                activeImageUrl || showImagePicker
                  ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Project Doubt Image / Photo"
            >
              <span className="material-symbols-outlined text-[18px]">photo_library</span>
            </button>
          </div>

          {/* Color Swatches */}
          <div className="flex items-center gap-1 px-1.5 border-r border-slate-700">
            {PALETTE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrentColor(c)}
                className={`w-4 h-4 rounded-full transition-transform ${
                  currentColor === c
                    ? "scale-125 ring-2 ring-white ring-offset-1 ring-offset-slate-900"
                    : "hover:scale-110 opacity-80 hover:opacity-100"
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>

          {/* Stroke Width Selector */}
          <div className="flex items-center gap-1 px-1 border-r border-slate-700">
            {STROKE_WIDTHS.map((sw) => (
              <button
                key={sw.value}
                type="button"
                onClick={() => setStrokeWidth(sw.value)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition ${
                  strokeWidth === sw.value
                    ? "bg-slate-700 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {sw.label}
              </button>
            ))}
          </div>

          {/* Actions: Undo & Clear */}
          <div className="flex items-center gap-1 pl-1">
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition"
              title="Undo"
            >
              <span className="material-symbols-outlined text-[18px]">undo</span>
            </button>

            <button
              type="button"
              onClick={handleClear}
              disabled={elements.length === 0}
              className="p-1.5 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 disabled:opacity-30 disabled:hover:bg-transparent transition"
              title="Clear Board"
            >
              <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
