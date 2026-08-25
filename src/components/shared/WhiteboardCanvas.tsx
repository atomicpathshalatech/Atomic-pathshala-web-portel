"use client";

import { useEffect, useRef, useState } from "react";

type Point = { x: number; y: number };

type FreehandStroke = {
  id: string;
  tool: "pen" | "eraser";
  color: string;
  size: number;
  points: Point[];
};

type ShapeStroke = {
  id: string;
  tool: "line" | "rectangle" | "circle" | "triangle" | "arrow";
  color: string;
  size: number;
  start: Point;
  end: Point;
};

type TextStroke = {
  id: string;
  tool: "text";
  color: string;
  size: number;
  x: number;
  y: number;
  text: string;
};

// Phase B: one-click science/math templates, stamped at the click point
// (no drag needed). Kept to plain canvas paths — no formula-typesetting
// library (KaTeX/MathJax) is wired in yet, so this covers geometry/physics/
// chemistry diagram shapes only, not rendered equations.
type StampStroke = {
  id: string;
  tool:
    | "coordinate-plane"
    | "number-line"
    | "benzene-ring"
    | "free-body-point"
    | "resistor"
    | "battery"
    | "spring"
    | "cell-diagram";
  color: string;
  size: number;
  x: number;
  y: number;
};

type Stroke = FreehandStroke | ShapeStroke | TextStroke | StampStroke;

type SavedBoard = {
  id: string;
  title: string;
  thumbnailDataUrl: string;
  updatedAt: string;
};

const CANVAS_WIDTH = 1400;
const CANVAS_HEIGHT = 800;

const COLOR_PRESETS = [
  "#131b2e",
  "#0050cb",
  "#ba1a1a",
  "#006643",
  "#8b5cf6",
  "#f59e0b",
  "#ffffff",
];

type BackgroundStyle = "plain-light" | "plain-dark" | "lined-light" | "lined-dark";

const BACKGROUND_CONFIG: Record<
  BackgroundStyle,
  { fill: string; lineColor: string; lined: boolean; label: string }
> = {
  "plain-light": { fill: "#ffffff", lineColor: "", lined: false, label: "Plain · Light" },
  "plain-dark": { fill: "#1a1f2e", lineColor: "", lined: false, label: "Plain · Dark" },
  "lined-light": { fill: "#ffffff", lineColor: "#c2c6d8", lined: true, label: "Lined · Light" },
  "lined-dark": { fill: "#1a1f2e", lineColor: "#3a4257", lined: true, label: "Lined · Dark" },
};

function drawBackground(ctx: CanvasRenderingContext2D, style: BackgroundStyle, w: number, h: number) {
  const cfg = BACKGROUND_CONFIG[style];
  ctx.fillStyle = cfg.fill;
  ctx.fillRect(0, 0, w, h);
  if (!cfg.lined) return;
  ctx.strokeStyle = cfg.lineColor;
  ctx.lineWidth = 1;
  const gap = 36;
  for (let y = gap; y < h; y += gap) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

function newId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (stroke.tool === "pen" || stroke.tool === "eraser") {
    if (stroke.points.length < 2) return;
    if (stroke.tool === "eraser") {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = stroke.size * 4;
      ctx.beginPath();
      // Non-null: guarded above by `stroke.points.length < 2` returning early.
      ctx.moveTo(stroke.points[0]!.x, stroke.points[0]!.y);
      for (const p of stroke.points.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.beginPath();
    ctx.moveTo(stroke.points[0]!.x, stroke.points[0]!.y);
    for (const p of stroke.points.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
    return;
  }

  if (stroke.tool === "line") {
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.beginPath();
    ctx.moveTo(stroke.start.x, stroke.start.y);
    ctx.lineTo(stroke.end.x, stroke.end.y);
    ctx.stroke();
    return;
  }

  if (stroke.tool === "rectangle") {
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    const w = stroke.end.x - stroke.start.x;
    const h = stroke.end.y - stroke.start.y;
    ctx.strokeRect(stroke.start.x, stroke.start.y, w, h);
    return;
  }

  if (stroke.tool === "circle") {
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    const rx = Math.abs(stroke.end.x - stroke.start.x) / 2;
    const ry = Math.abs(stroke.end.y - stroke.start.y) / 2;
    const cx = (stroke.start.x + stroke.end.x) / 2;
    const cy = (stroke.start.y + stroke.end.y) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  if (stroke.tool === "triangle") {
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    const { start, end } = stroke;
    ctx.beginPath();
    ctx.moveTo((start.x + end.x) / 2, start.y); // apex, top-center
    ctx.lineTo(start.x, end.y); // bottom-left
    ctx.lineTo(end.x, end.y); // bottom-right
    ctx.closePath();
    ctx.stroke();
    return;
  }

  if (stroke.tool === "arrow") {
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    const { start, end } = stroke;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const headLen = 8 + stroke.size * 2;
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x - headLen * Math.cos(angle - Math.PI / 7),
      end.y - headLen * Math.sin(angle - Math.PI / 7)
    );
    ctx.lineTo(
      end.x - headLen * Math.cos(angle + Math.PI / 7),
      end.y - headLen * Math.sin(angle + Math.PI / 7)
    );
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (stroke.tool === "text") {
    ctx.fillStyle = stroke.color;
    ctx.font = `${stroke.size * 4}px Inter, sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillText(stroke.text, stroke.x, stroke.y);
    return;
  }

  if (stroke.tool === "coordinate-plane") {
    const { x: cx, y: cy } = stroke;
    const half = 110;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = 1.5;
    // Axes
    ctx.beginPath();
    ctx.moveTo(cx - half, cy);
    ctx.lineTo(cx + half, cy);
    ctx.moveTo(cx, cy - half);
    ctx.lineTo(cx, cy + half);
    ctx.stroke();
    // Arrowheads
    const arrowheadPoints: [number, number, number, number, number, number][] = [
      [cx + half, cy, cx + half - 8, cy - 5, cx + half - 8, cy + 5],
      [cx - half, cy, cx - half + 8, cy - 5, cx - half + 8, cy + 5],
      [cx, cy - half, cx - 5, cy - half + 8, cx + 5, cy - half + 8],
      [cx, cy + half, cx - 5, cy + half - 8, cx + 5, cy + half - 8],
    ];
    for (const [tipX, tipY, a1x, a1y, a2x, a2y] of arrowheadPoints) {
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(a1x, a1y);
      ctx.lineTo(a2x, a2y);
      ctx.closePath();
      ctx.fillStyle = stroke.color;
      ctx.fill();
    }
    // Tick marks every 20px
    ctx.font = "10px Inter, sans-serif";
    ctx.fillStyle = stroke.color;
    for (let t = -half + 20; t < half; t += 20) {
      if (t === 0) continue;
      ctx.beginPath();
      ctx.moveTo(cx + t, cy - 3);
      ctx.lineTo(cx + t, cy + 3);
      ctx.moveTo(cx - 3, cy + t);
      ctx.lineTo(cx + 3, cy + t);
      ctx.stroke();
    }
    ctx.fillText("x", cx + half + 4, cy - 6);
    ctx.fillText("y", cx - 4, cy - half - 14);
    return;
  }

  if (stroke.tool === "number-line") {
    const { x: cx, y: cy } = stroke;
    const half = 150;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - half, cy);
    ctx.lineTo(cx + half, cy);
    ctx.stroke();
    ctx.font = "10px Inter, sans-serif";
    ctx.fillStyle = stroke.color;
    ctx.textAlign = "center";
    for (let t = -half; t <= half; t += 30) {
      ctx.beginPath();
      ctx.moveTo(cx + t, cy - 5);
      ctx.lineTo(cx + t, cy + 5);
      ctx.stroke();
      ctx.fillText(String(Math.round(t / 30)), cx + t, cy + 14);
    }
    ctx.textAlign = "left";
    return;
  }

  if (stroke.tool === "benzene-ring") {
    const { x: cx, y: cy } = stroke;
    const r = 40;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = 1.5;
    const points: Point[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      points.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
    }
    // Outer hexagon
    ctx.beginPath();
    // Non-null: `points` was just built by the loop above with 6 entries.
    ctx.moveTo(points[0]!.x, points[0]!.y);
    for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.stroke();
    // Inner circle (aromatic ring convention)
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  if (stroke.tool === "free-body-point") {
    const { x: cx, y: cy } = stroke;
    ctx.fillStyle = stroke.color;
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(cx - 30, cy);
    ctx.lineTo(cx + 30, cy);
    ctx.moveTo(cx, cy - 30);
    ctx.lineTo(cx, cy + 30);
    ctx.stroke();
    ctx.setLineDash([]);
    return;
  }

  if (stroke.tool === "resistor") {
    const { x: cx, y: cy } = stroke;
    const half = 45;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - half, cy);
    ctx.lineTo(cx - 25, cy);
    const zigW = 6;
    let x = cx - 25;
    let dir = 1;
    for (let i = 0; i < 6; i++) {
      x += zigW;
      ctx.lineTo(x, cy + dir * 10);
      dir *= -1;
    }
    ctx.lineTo(cx + 25, cy);
    ctx.lineTo(cx + half, cy);
    ctx.stroke();
    return;
  }

  if (stroke.tool === "battery") {
    const { x: cx, y: cy } = stroke;
    const half = 45;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - half, cy);
    ctx.lineTo(cx - 8, cy);
    ctx.moveTo(cx - 8, cy - 16);
    ctx.lineTo(cx - 8, cy + 16);
    ctx.moveTo(cx + 4, cy - 8);
    ctx.lineTo(cx + 4, cy + 8);
    ctx.moveTo(cx + 4, cy);
    ctx.lineTo(cx + half, cy);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 16);
    ctx.lineTo(cx - 8, cy + 16);
    ctx.moveTo(cx + 4, cy - 8);
    ctx.lineTo(cx + 4, cy + 8);
    ctx.stroke();
    ctx.font = "11px Inter, sans-serif";
    ctx.fillStyle = stroke.color;
    ctx.fillText("+", cx - 14, cy - 20);
    ctx.fillText("−", cx + 2, cy - 20);
    return;
  }

  if (stroke.tool === "spring") {
    const { x: cx, y: cy } = stroke;
    const half = 50;
    const coils = 6;
    const coilW = (half * 2 - 20) / coils;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - half, cy);
    ctx.lineTo(cx - half + 10, cy);
    let x = cx - half + 10;
    for (let i = 0; i < coils; i++) {
      const midX = x + coilW / 2;
      const endX = x + coilW;
      ctx.lineTo(midX, cy - 14);
      ctx.lineTo(endX, cy + 14);
      x = endX;
    }
    ctx.lineTo(cx + half, cy);
    ctx.stroke();
    return;
  }

  if (stroke.tool === "cell-diagram") {
    const { x: cx, y: cy } = stroke;
    const rx = 70;
    const ry = 45;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = 1.5;
    // Cell membrane
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Nucleus
    ctx.beginPath();
    ctx.ellipse(cx - 15, cy, 18, 14, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx - 15, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = stroke.color;
    ctx.fill();
    // A couple of organelles (mitochondria-style ovals)
    ctx.beginPath();
    ctx.ellipse(cx + 30, cy - 15, 10, 5, 0.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx + 25, cy + 18, 9, 5, -0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = "9px Inter, sans-serif";
    ctx.fillStyle = stroke.color;
    ctx.fillText("nucleus", cx - 30, cy + 22);
  }
}

type Tool =
  | "pen"
  | "eraser"
  | "line"
  | "rectangle"
  | "circle"
  | "triangle"
  | "arrow"
  | "text"
  | "symbol"
  | "coordinate-plane"
  | "number-line"
  | "benzene-ring"
  | "free-body-point"
  | "resistor"
  | "battery"
  | "spring"
  | "cell-diagram";

const MATH_SYMBOLS = [
  "α", "β", "θ", "λ", "μ", "π", "Σ", "Δ", "∫", "√", "±", "≤", "≥", "≠", "∞", "°", "→", "Ω",
];

export function WhiteboardCanvas({
  initialBoards,
  apiBasePath = "/api/whiteboard",
}: {
  initialBoards: SavedBoard[];
  apiBasePath?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [bgStyle, setBgStyle] = useState<BackgroundStyle>("plain-light");

  // PDF slide import — pages render to data URLs client-side via pdf.js, no
  // server involved. Each slide keeps its own annotations, saved into
  // slideAnnotations when you navigate away from it.
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [pdfImages, setPdfImages] = useState<(HTMLImageElement | null)[]>([]);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [slideAnnotations, setSlideAnnotations] = useState<Record<number, Stroke[]>>({});
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingSymbol, setPendingSymbol] = useState<string>("π");
  const [color, setColor] = useState("#0050cb");
  const [size, setSize] = useState(3);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [current, setCurrent] = useState<Stroke | null>(null);

  const [title, setTitle] = useState("Untitled Board");
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [boards, setBoards] = useState(initialBoards);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Load each PDF page data URL into an actual Image object so it can be
  // drawn onto the canvas (drawImage needs a loaded image, not a raw URL).
  useEffect(() => {
    if (pdfPages.length === 0) {
      setPdfImages([]);
      return;
    }
    let cancelled = false;
    const loaded: (HTMLImageElement | null)[] = new Array(pdfPages.length).fill(null);
    setPdfImages(loaded.slice());

    pdfPages.forEach((dataUrl, i) => {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        setPdfImages((prev) => {
          const next = prev.slice();
          next[i] = img;
          return next;
        });
      };
      img.src = dataUrl;
    });

    return () => {
      cancelled = true;
    };
  }, [pdfPages]);

  // Redraw whenever strokes, the in-progress stroke, background style, or the
  // active slide's rendered image changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const slideImg = pdfImages[activeSlide];
    if (slideImg) {
      ctx.drawImage(slideImg, 0, 0, canvas.width, canvas.height);
    } else {
      drawBackground(ctx, bgStyle, canvas.width, canvas.height);
    }

    for (const s of strokes) drawStroke(ctx, s);
    if (current) drawStroke(ctx, current);
  }, [strokes, current, bgStyle, pdfImages, activeSlide]);

  function getPoint(e: React.MouseEvent<HTMLCanvasElement>): Point {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  const STAMP_TOOLS: Tool[] = [
    "coordinate-plane",
    "number-line",
    "benzene-ring",
    "free-body-point",
    "resistor",
    "battery",
    "spring",
    "cell-diagram",
  ];

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const point = getPoint(e);

    if (tool === "text") {
      const text = window.prompt("Enter text:");
      if (!text) return;
      const stroke: TextStroke = { id: newId(), tool: "text", color, size, x: point.x, y: point.y, text };
      setStrokes((prev) => [...prev, stroke]);
      setRedoStack([]);
      return;
    }

    if (tool === "symbol") {
      const stroke: TextStroke = {
        id: newId(),
        tool: "text",
        color,
        size: size + 3,
        x: point.x,
        y: point.y,
        text: pendingSymbol,
      };
      setStrokes((prev) => [...prev, stroke]);
      setRedoStack([]);
      return;
    }

    if (STAMP_TOOLS.includes(tool)) {
      const stroke: StampStroke = {
        id: newId(),
        tool: tool as StampStroke["tool"],
        color,
        size,
        x: point.x,
        y: point.y,
      };
      setStrokes((prev) => [...prev, stroke]);
      setRedoStack([]);
      return;
    }

    setDrawing(true);
    if (tool === "pen" || tool === "eraser") {
      setCurrent({ id: newId(), tool, color, size, points: [point] });
    } else {
      // Safe: text/symbol/stamp tools all returned early above, so only the
      // ShapeStroke tool variants (line/rectangle/circle/triangle/arrow) can
      // reach here — TS just can't narrow through STAMP_TOOLS.includes().
      setCurrent({ id: newId(), tool: tool as ShapeStroke["tool"], color, size, start: point, end: point });
    }
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing || !current) return;
    const point = getPoint(e);

    if (current.tool === "pen" || current.tool === "eraser") {
      setCurrent({ ...current, points: [...current.points, point] });
    } else if (
      current.tool === "line" ||
      current.tool === "rectangle" ||
      current.tool === "circle" ||
      current.tool === "triangle" ||
      current.tool === "arrow"
    ) {
      setCurrent({ ...current, end: point });
    }
  }

  function commitCurrent() {
    if (current) {
      setStrokes((prev) => [...prev, current]);
      setRedoStack([]);
    }
    setCurrent(null);
    setDrawing(false);
  }

  function handleUndo() {
    setStrokes((prev) => {
      if (prev.length === 0) return prev;
      // Non-null: guarded by the length check above.
      const last = prev[prev.length - 1]!;
      setRedoStack((r) => [...r, last]);
      return prev.slice(0, -1);
    });
  }

  function handleRedo() {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1]!;
      setStrokes((s) => [...s, last]);
      return prev.slice(0, -1);
    });
  }

  function handleClearAll() {
    if (strokes.length === 0) return;
    if (!window.confirm("Clear the entire board? This can't be undone.")) return;
    setStrokes([]);
    setRedoStack([]);
  }

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    if (file.type !== "application/pdf") {
      setPdfError("Please choose a PDF file.");
      return;
    }

    setIsPdfLoading(true);
    setPdfError(null);
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();

      const arrayBuffer = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      const pages: string[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 1 });
        const scale = CANVAS_WIDTH / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        const offscreen = document.createElement("canvas");
        offscreen.width = CANVAS_WIDTH;
        offscreen.height = CANVAS_HEIGHT;
        const offCtx = offscreen.getContext("2d");
        if (!offCtx) continue;
        offCtx.fillStyle = "#ffffff";
        offCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        await page.render({ canvasContext: offCtx, viewport: scaledViewport }).promise;
        pages.push(offscreen.toDataURL("image/png"));
      }

      setPdfPages(pages);
      setPdfFileName(file.name);
      setActiveSlide(0);
      setSlideAnnotations({});
      setStrokes([]);
      setRedoStack([]);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "Couldn't read that PDF.");
    } finally {
      setIsPdfLoading(false);
    }
  }

  function goToSlide(index: number) {
    if (index < 0 || index >= pdfPages.length || index === activeSlide) return;
    setSlideAnnotations((prev) => ({ ...prev, [activeSlide]: strokes }));
    setActiveSlide(index);
    setStrokes(slideAnnotations[index] ?? []);
    setRedoStack([]);
  }

  function handleRemovePdf() {
    if (!window.confirm("Remove the PDF and go back to a blank board?")) return;
    setPdfPages([]);
    setPdfImages([]);
    setPdfFileName(null);
    setActiveSlide(0);
    setSlideAnnotations({});
    setStrokes([]);
    setRedoStack([]);
  }

  function handleExportPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${title.replace(/\s+/g, "-").toLowerCase() || "whiteboard"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  async function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsSaving(true);
    setStatusMsg(null);
    try {
      const thumbnailDataUrl = canvas.toDataURL("image/png");

      let strokesPayload: unknown = strokes;
      if (pdfPages.length > 0) {
        const mergedAnnotations = { ...slideAnnotations, [activeSlide]: strokes };
        strokesPayload = {
          __type: "pdf-deck",
          pdfFileName,
          pdfPages,
          slideAnnotations: mergedAnnotations,
          activeSlide,
        };
      }

      const payload = { title, strokes: strokesPayload, thumbnailDataUrl };

      const res = await fetch(
        activeBoardId ? `${apiBasePath}/${activeBoardId}` : apiBasePath,
        {
          method: activeBoardId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Save failed");

      const saved: SavedBoard = json.data.board;
      setActiveBoardId(saved.id);
      setBoards((prev) => {
        const withoutSaved = prev.filter((b) => b.id !== saved.id);
        return [saved, ...withoutSaved];
      });
      setStatusMsg("Saved");
    } catch (err) {
      // A large multi-page PDF deck can produce a big payload — most likely
      // failure here is size/timeout related, not a code bug.
      setStatusMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
      setTimeout(() => setStatusMsg(null), 2500);
    }
  }

  async function handleLoad(boardId: string) {
    const res = await fetch(`${apiBasePath}/${boardId}`);
    const json = await res.json();
    if (!json.success) {
      setStatusMsg("Couldn't load that board");
      return;
    }
    const board = json.data.board;
    const raw = board.strokes;

    if (raw && typeof raw === "object" && !Array.isArray(raw) && raw.__type === "pdf-deck") {
      const annotations: Record<number, Stroke[]> = {};
      for (const [key, val] of Object.entries(raw.slideAnnotations ?? {})) {
        annotations[Number(key)] = val as Stroke[];
      }
      setPdfPages(raw.pdfPages ?? []);
      setPdfFileName(raw.pdfFileName ?? null);
      setSlideAnnotations(annotations);
      const slide = raw.activeSlide ?? 0;
      setActiveSlide(slide);
      setStrokes(annotations[slide] ?? []);
    } else {
      setPdfPages([]);
      setPdfImages([]);
      setPdfFileName(null);
      setSlideAnnotations({});
      setActiveSlide(0);
      setStrokes(Array.isArray(raw) ? raw : []);
    }

    setRedoStack([]);
    setTitle(board.title);
    setActiveBoardId(board.id);
  }

  async function handleDelete(boardId: string) {
    if (!window.confirm("Delete this board permanently?")) return;
    const res = await fetch(`${apiBasePath}/${boardId}`, { method: "DELETE" });
    const json = await res.json();
    if (!json.success) {
      setStatusMsg("Couldn't delete that board");
      return;
    }
    setBoards((prev) => prev.filter((b) => b.id !== boardId));
    if (activeBoardId === boardId) {
      setActiveBoardId(null);
      setStrokes([]);
      setRedoStack([]);
      setTitle("Untitled Board");
    }
  }

  function handleNewBoard() {
    setStrokes([]);
    setRedoStack([]);
    setActiveBoardId(null);
    setTitle("Untitled Board");
    setPdfPages([]);
    setPdfImages([]);
    setPdfFileName(null);
    setSlideAnnotations({});
    setActiveSlide(0);
  }

  const TOOL_BUTTONS: { tool: Tool; icon: string; label: string }[] = [
    { tool: "pen", icon: "edit", label: "Pen" },
    { tool: "eraser", icon: "ink_eraser", label: "Eraser" },
    { tool: "line", icon: "horizontal_rule", label: "Line" },
    { tool: "rectangle", icon: "crop_square", label: "Rectangle" },
    { tool: "circle", icon: "circle", label: "Circle" },
    { tool: "triangle", icon: "change_history", label: "Triangle" },
    { tool: "arrow", icon: "north_east", label: "Arrow" },
    { tool: "text", icon: "text_fields", label: "Text" },
  ];

  const TEMPLATE_BUTTONS: { tool: Tool; icon: string; label: string }[] = [
    { tool: "coordinate-plane", icon: "grid_4x4", label: "Axes" },
    { tool: "number-line", icon: "linear_scale", label: "Number Line" },
    { tool: "benzene-ring", icon: "hexagon", label: "Benzene" },
    { tool: "free-body-point", icon: "adjust", label: "FBD Point" },
    { tool: "resistor", icon: "waves", label: "Resistor" },
    { tool: "battery", icon: "battery_full", label: "Battery" },
    { tool: "spring", icon: "vibration", label: "Spring" },
    { tool: "cell-diagram", icon: "blur_circular", label: "Cell" },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-gutter">
      {/* Left toolbar */}
      <aside className="w-full lg:w-56 shrink-0 space-y-stack-md">
        <div className="glass-card rounded-xl p-stack-md space-y-2">
          <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wide">
            Page
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(BACKGROUND_CONFIG) as BackgroundStyle[]).map((key) => (
              <button
                key={key}
                onClick={() => setBgStyle(key)}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-colors ${
                  bgStyle === key ? "border-primary" : "border-transparent hover:border-outline-variant/50"
                }`}
                title={BACKGROUND_CONFIG[key].label}
              >
                <span
                  className="w-full h-8 rounded border border-outline-variant/30"
                  style={{
                    backgroundColor: BACKGROUND_CONFIG[key].fill,
                    backgroundImage: BACKGROUND_CONFIG[key].lined
                      ? `repeating-linear-gradient(to bottom, transparent, transparent 6px, ${BACKGROUND_CONFIG[key].lineColor} 6px, ${BACKGROUND_CONFIG[key].lineColor} 7px)`
                      : undefined,
                  }}
                />
                <span className="text-[10px] font-label-sm text-on-surface-variant leading-tight text-center">
                  {BACKGROUND_CONFIG[key].label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-xl p-stack-md space-y-2">
          <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wide">
            Slides
          </h3>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handlePdfUpload}
            className="hidden"
          />
          {pdfPages.length === 0 ? (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isPdfLoading}
                className="w-full flex items-center justify-center gap-2 p-2 rounded-lg bg-surface-container-high/60 text-on-surface-variant text-label-sm hover:bg-primary/10 disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isPdfLoading ? "hourglass_empty" : "upload_file"}
                </span>
                {isPdfLoading ? "Rendering..." : "Upload PDF"}
              </button>
              <p className="text-[10px] text-on-surface-variant/70 leading-tight">
                Export your slide deck to PDF first, then upload — each page becomes a slide you
                can draw over.
              </p>
              {pdfError && <p className="text-[11px] text-error">{pdfError}</p>}
            </>
          ) : (
            <>
              <p className="text-label-sm truncate" title={pdfFileName ?? undefined}>
                {pdfFileName}
              </p>
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => goToSlide(activeSlide - 1)}
                  disabled={activeSlide === 0}
                  className="p-1.5 rounded-lg bg-surface-container-high/60 hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                <span className="text-label-sm font-label-sm">
                  Slide {activeSlide + 1} / {pdfPages.length}
                </span>
                <button
                  onClick={() => goToSlide(activeSlide + 1)}
                  disabled={activeSlide === pdfPages.length - 1}
                  className="p-1.5 rounded-lg bg-surface-container-high/60 hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
              <button
                onClick={handleRemovePdf}
                className="w-full flex items-center justify-center gap-1 p-2 rounded-lg bg-error/10 text-error text-label-sm hover:bg-error/20"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
                Remove PDF
              </button>
            </>
          )}
        </div>

        <div className="glass-card rounded-xl p-stack-md space-y-3">
          <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wide">
            Tools
          </h3>
          <div className="grid grid-cols-3 lg:grid-cols-2 gap-2">
            {TOOL_BUTTONS.map((t) => (
              <button
                key={t.tool}
                onClick={() => setTool(t.tool)}
                title={t.label}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg text-[11px] font-label-sm transition-colors ${
                  tool === t.tool
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-high/60 text-on-surface-variant hover:bg-primary/10"
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          <div className="pt-2 border-t border-outline-variant/20 space-y-2">
            <h4 className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wide">
              Templates
            </h4>
            <p className="text-[10px] text-on-surface-variant/70 leading-tight">
              Click the canvas to stamp — geometry/physics/chemistry diagram shapes, not typeset
              equations.
            </p>
            <div className="grid grid-cols-3 lg:grid-cols-2 gap-2">
              {TEMPLATE_BUTTONS.map((t) => (
                <button
                  key={t.tool}
                  onClick={() => setTool(t.tool)}
                  title={t.label}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg text-[11px] font-label-sm transition-colors ${
                    tool === t.tool
                      ? "bg-secondary text-on-secondary"
                      : "bg-surface-container-high/60 text-on-surface-variant hover:bg-secondary/10"
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-outline-variant/20 space-y-2">
            <h4 className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wide">
              Symbols
            </h4>
            <p className="text-[10px] text-on-surface-variant/70 leading-tight">
              Pick a symbol, then click the canvas to place it (place it again as many times as
              you like).
            </p>
            <div className="grid grid-cols-6 gap-1">
              {MATH_SYMBOLS.map((sym) => (
                <button
                  key={sym}
                  onClick={() => {
                    setPendingSymbol(sym);
                    setTool("symbol");
                  }}
                  className={`flex items-center justify-center h-8 rounded-md text-[15px] font-semibold transition-colors ${
                    tool === "symbol" && pendingSymbol === sym
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container-high/60 text-on-surface hover:bg-primary/10"
                  }`}
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-outline-variant/20 space-y-3">
            <div>
              <label className="text-label-sm font-label-sm text-on-surface-variant block mb-1">
                Color
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-full border-2 ${
                      color === c ? "border-primary" : "border-white"
                    }`}
                  />
                ))}
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-6 h-6 rounded-full overflow-hidden border-none cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="text-label-sm font-label-sm text-on-surface-variant block mb-1">
                Thickness: {size}px
              </label>
              <input
                type="range"
                min={1}
                max={20}
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-outline-variant/20 grid grid-cols-2 gap-2">
            <button
              onClick={handleUndo}
              disabled={strokes.length === 0}
              className="flex items-center justify-center gap-1 p-2 rounded-lg bg-surface-container-high/60 text-on-surface-variant text-label-sm hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">undo</span>
              Undo
            </button>
            <button
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="flex items-center justify-center gap-1 p-2 rounded-lg bg-surface-container-high/60 text-on-surface-variant text-label-sm hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">redo</span>
              Redo
            </button>
            <button
              onClick={handleClearAll}
              className="col-span-2 flex items-center justify-center gap-1 p-2 rounded-lg bg-error/10 text-error text-label-sm hover:bg-error/20"
            >
              <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
              Clear All
            </button>
          </div>
        </div>

        {/* Saved boards */}
        <div className="glass-card rounded-xl p-stack-md space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wide">
              Saved Boards
            </h3>
            <button
              onClick={handleNewBoard}
              title="New board"
              className="text-primary hover:bg-primary/10 rounded-full p-1"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
            </button>
          </div>
          {boards.length === 0 ? (
            <p className="text-label-sm text-on-surface-variant">No saved boards yet.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {boards.map((b) => (
                <div
                  key={b.id}
                  className={`flex items-center gap-2 p-2 rounded-lg border transition-colors cursor-pointer ${
                    activeBoardId === b.id
                      ? "border-primary bg-primary/5"
                      : "border-outline-variant/20 hover:border-primary/30"
                  }`}
                  onClick={() => handleLoad(b.id)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={b.thumbnailDataUrl}
                    alt={b.title}
                    className="w-12 h-8 object-cover rounded border border-outline-variant/30 bg-white"
                  />
                  <span className="flex-1 text-label-sm truncate">{b.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(b.id);
                    }}
                    className="text-on-surface-variant hover:text-error p-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Canvas area */}
      <div className="flex-1 space-y-3 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="font-headline-md text-headline-md bg-transparent border-b border-transparent hover:border-outline-variant/40 focus:border-primary focus:outline-none px-1 min-w-0 flex-1"
          />
          <button
            onClick={handleExportPng}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant font-label-md hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export PNG
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-on-primary font-label-md hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[18px]">
              {isSaving ? "hourglass_empty" : "save"}
            </span>
            {isSaving ? "Saving..." : "Save Board"}
          </button>
          {statusMsg && <span className="text-label-sm text-on-surface-variant">{statusMsg}</span>}
        </div>

        <div className="glass-card rounded-xl p-3 overflow-auto">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={commitCurrent}
            onMouseLeave={commitCurrent}
            style={{ backgroundColor: BACKGROUND_CONFIG[bgStyle].fill }}
            className="w-full h-auto rounded-lg border border-outline-variant/30 cursor-crosshair touch-none"
          />
        </div>
        <p className="text-label-sm text-on-surface-variant">
          Phase A: personal/session whiteboard — no live sync or video calling yet. Text tool uses
          a simple prompt box for now; a proper inline editor comes with Phase D.
        </p>
      </div>
    </div>
  );
}
