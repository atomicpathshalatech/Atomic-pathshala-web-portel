"use client";

import React, { useEffect, useRef, useState } from "react";
import type {
  GlobalRemovalItem,
  GlobalReplacementItem,
  BackgroundConfig,
  HeaderFooterConfig,
  WatermarkConfig,
  CoverPageConfig,
} from "@/lib/module-editor/native-pdf-engine";
import { TEXT_LINE_HEIGHT, TEXT_PAD } from "@/lib/module-editor/text-box";
import { newId, type OverlayObject } from "@/lib/module-editor/overlay-model";

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
  | "HIGHLIGHT"
  | "UNDERLINE"
  | "REMOVE_OBJECT"
  | "REPLACE_OBJECT";

/** Tools that draw a box on the page. */
export const BOX_TOOLS: EditorTool[] = ["WHITEOUT", "ADD_TEXT", "REMOVE_OBJECT", "REPLACE_OBJECT", "RECTANGLE", "CIRCLE", "LINE", "HIGHLIGHT", "UNDERLINE"];

const SHAPE_DEFAULTS: Record<string, Partial<OverlayObject>> = {
  RECTANGLE: { type: "rect", strokeColor: "#ea580c", strokeWidth: 2, opacity: 1 } as any,
  CIRCLE: { type: "circle", strokeColor: "#2563eb", strokeWidth: 2, opacity: 1 } as any,
  LINE: { type: "line", strokeColor: "#111827", strokeWidth: 2, opacity: 1 } as any,
  HIGHLIGHT: { type: "highlight", fillColor: "#facc15", opacity: 0.4 } as any,
  UNDERLINE: { type: "underline", strokeColor: "#dc2626", strokeWidth: 2, opacity: 1 } as any,
};

export function isPageInRange(pageNumber: number, range?: "ALL" | "ODD" | "EVEN" | "CUSTOM", customPages?: number[], excludeFirstPage?: boolean): boolean {
  if (excludeFirstPage && pageNumber === 1) return false;
  if (!range || range === "ALL") return true;
  if (range === "ODD") return pageNumber % 2 !== 0;
  if (range === "EVEN") return pageNumber % 2 === 0;
  if (range === "CUSTOM") return Array.isArray(customPages) && customPages.includes(pageNumber);
  return true;
}

export function replaceVariables(template: string, vars: { page: number; totalPages: number; subject: string; chapter: string; teacher: string; date: string; moduleNumber: string }): string {
  return template
    .replace(/\{page\}/gi, String(vars.page))
    .replace(/\{totalPages\}/gi, String(vars.totalPages))
    .replace(/\{subject\}/gi, vars.subject)
    .replace(/\{chapter\}/gi, vars.chapter)
    .replace(/\{teacher\}/gi, vars.teacher)
    .replace(/\{date\}/gi, vars.date)
    .replace(/\{moduleNumber\}/gi, vars.moduleNumber);
}

const fontCss = (f?: string) => (f === "times" ? '"Times New Roman", Times, serif' : f === "courier" ? '"Courier New", Courier, monospace' : "Helvetica, Arial, sans-serif");

type Box = { x: number; y: number; width: number; height: number };
type Drag = { id: string; mode: "move" | "resize"; startX: number; startY: number; orig: Box; pointerId: number; moved: boolean };

export interface PdfPageCanvasProps {
  pdfDocProxy: any;
  /** The page's id in the editor (overlay-model). */
  pageId: number;
  /** Source PDF page shown (0 = blank page). */
  sourcePage: number;
  /** Position in the finished document (1-based) — used for page numbers in headers. */
  displayNumber: number;
  totalPages: number;
  zoom: number;
  /** Extra turn by the user (degrees). */
  rotation: number;
  /** Size of a blank page (and the placeholder before a page is drawn). */
  defaultSize: { width: number; height: number };
  activeTool: EditorTool;
  objects: OverlayObject[];
  globalRemovals: GlobalRemovalItem[];
  globalReplacements: GlobalReplacementItem[];
  selectedObjectId: string | null;
  editingTextId: string | null;
  onSelectObject: (id: string | null) => void;
  onStartEditText: (id: string | null) => void;
  onAddObject: (obj: OverlayObject) => void;
  onUpdateObject: (id: string, patch: Record<string, unknown>) => void;
  onTargetBoxSelected: (box: Box) => void;
  onToolDone: () => void;
  /** A new drag / drawing starts: the previous edit becomes its own undo step. */
  onGestureStart?: () => void;
  headerFooter?: HeaderFooterConfig;
  watermark?: WatermarkConfig;
  background?: BackgroundConfig;
  coverPage?: CoverPageConfig;
  moduleData?: { subject: string | null; chapter: string | null; title: string; facultyName: string | null; code: string } | null;
}

/**
 * One page of the PDF editor: the original page drawn by pdf.js (only while it
 * is on or near the screen), and the editable objects above it in their
 * stacking order. Coordinates are PDF points from the top-left of the page as
 * shown (after turning); the PDF writer uses the same ones.
 */
export function PdfPageCanvas(props: PdfPageCanvasProps) {
  const { pdfDocProxy, pageId, sourcePage, displayNumber, totalPages, zoom, rotation, defaultSize, activeTool, objects, selectedObjectId, editingTextId } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [pageSize, setPageSize] = useState(defaultSize);
  const [visible, setVisible] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [textSpans, setTextSpans] = useState<Array<{ text: string; x: number; y: number; width: number; height: number; fontSize: number }>>([]);
  const [drawBox, setDrawBox] = useState<{ startX: number; startY: number; currX: number; currY: number; pointerId: number } | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const scale = zoom;

  // Draw only pages on or near the screen; far-away pages give their canvas memory back.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver((entries) => setVisible(entries.some((e) => e.isIntersecting)), { rootMargin: "1200px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (sourcePage === 0) {
      setPageSize(rotation % 180 ? { width: defaultSize.height, height: defaultSize.width } : defaultSize);
      return;
    }
    if (!visible || !pdfDocProxy) {
      const c = canvasRef.current;
      if (c && !visible) {
        c.width = 0;
        c.height = 0;
      }
      return;
    }
    let cancelled = false;
    let task: any = null;
    (async () => {
      try {
        const page = await pdfDocProxy.getPage(sourcePage);
        if (cancelled) return;
        const turn = (((page.rotate ?? 0) + rotation) % 360 + 360) % 360;
        const base = page.getViewport({ scale: 1, rotation: turn });
        setPageSize({ width: base.width, height: base.height });
        const ratio = Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1) * 1.25;
        const viewport = page.getViewport({ scale: zoom * ratio, rotation: turn });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = `${base.width * zoom}px`;
        canvas.style.height = `${base.height * zoom}px`;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        task = page.render({ canvasContext: ctx, viewport });
        await task.promise;
        if (cancelled) return;
        setRenderError(null);
        const content = await page.getTextContent();
        if (cancelled) return;
        const spans: typeof textSpans = [];
        for (const item of content.items as any[]) {
          if (!item.str || !item.str.trim()) continue;
          const [x, y] = base.convertToViewportPoint(item.transform[4], item.transform[5]);
          const h = item.height || Math.hypot(item.transform[2], item.transform[3]) || 12;
          spans.push({ text: item.str, x: Math.max(0, x), y: Math.max(0, y - h), width: item.width || item.str.length * 6, height: h, fontSize: h });
        }
        setTextSpans(spans);
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException" && !cancelled) setRenderError(err?.message || "This page could not be drawn.");
      }
    })();
    return () => {
      cancelled = true;
      try {
        task?.cancel();
      } catch {}
    };
  }, [pdfDocProxy, sourcePage, zoom, rotation, visible, defaultSize]);

  // Keeps receiving the pointer while dragging outside the page; some pointers cannot be captured — dragging still works inside.
  const capture = (pointerId: number) => {
    try {
      overlayRef.current?.setPointerCapture(pointerId);
    } catch {}
  };

  const toPage = (e: { clientX: number; clientY: number }) => {
    const rect = overlayRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
  };

  const onOverlayPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (BOX_TOOLS.includes(activeTool)) {
      props.onGestureStart?.();
      const p = toPage(e);
      capture(e.pointerId);
      setDrawBox({ startX: p.x, startY: p.y, currX: p.x, currY: p.y, pointerId: e.pointerId });
      e.preventDefault();
      return;
    }
    if (e.target === overlayRef.current) {
      props.onSelectObject(null);
      props.onStartEditText(null);
    }
  };

  const startDrag = (e: React.PointerEvent, o: OverlayObject, mode: Drag["mode"]) => {
    if (e.button !== 0 || BOX_TOOLS.includes(activeTool)) return;
    e.stopPropagation();
    props.onSelectObject(o.id);
    if (o.locked || editingTextId === o.id) return;
    props.onGestureStart?.();
    const p = toPage(e);
    capture(e.pointerId);
    dragRef.current = { id: o.id, mode, startX: p.x, startY: p.y, orig: { x: o.x, y: o.y, width: o.width, height: o.height }, pointerId: e.pointerId, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (d && d.pointerId === e.pointerId) {
      const p = toPage(e);
      const dx = p.x - d.startX;
      const dy = p.y - d.startY;
      if (!d.moved && Math.abs(dx) + Math.abs(dy) < 2 / scale) return;
      d.moved = true;
      if (d.mode === "move") props.onUpdateObject(d.id, { x: Math.round((d.orig.x + dx) * 10) / 10, y: Math.round((d.orig.y + dy) * 10) / 10 });
      else props.onUpdateObject(d.id, { width: Math.max(6, Math.round((d.orig.width + dx) * 10) / 10), height: Math.max(6, Math.round((d.orig.height + dy) * 10) / 10) });
      return;
    }
    if (drawBox && drawBox.pointerId === e.pointerId) {
      const p = toPage(e);
      setDrawBox({ ...drawBox, currX: p.x, currY: p.y });
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current && dragRef.current.pointerId === e.pointerId) {
      dragRef.current = null;
      return;
    }
    if (!drawBox || drawBox.pointerId !== e.pointerId) return;
    const x = Math.min(drawBox.startX, drawBox.currX);
    const y = Math.min(drawBox.startY, drawBox.currY);
    const dragged = Math.abs(drawBox.currX - drawBox.startX) > 3 || Math.abs(drawBox.currY - drawBox.startY) > 3;
    const width = dragged ? Math.abs(drawBox.currX - drawBox.startX) : 0;
    const height = dragged ? Math.abs(drawBox.currY - drawBox.startY) : 0;
    setDrawBox(null);
    const base = { pageNumber: pageId, x, y };
    if (activeTool === "WHITEOUT") {
      props.onAddObject({ kind: "whiteout", id: newId("whiteout"), ...base, width: Math.max(10, width), height: Math.max(10, height), color: "#ffffff" });
    } else if (activeTool === "ADD_TEXT") {
      const id = newId("text");
      props.onAddObject({ kind: "text", id, ...base, width: Math.max(160, width), height: Math.max(22, height), newText: "", fontSize: 12, fontFamily: "helvetica", color: "#000000", hideOriginal: false, lineHeight: TEXT_LINE_HEIGHT });
      props.onStartEditText(id);
    } else if (activeTool === "REMOVE_OBJECT" || activeTool === "REPLACE_OBJECT") {
      if (dragged) props.onTargetBoxSelected({ x, y, width, height });
      return;
    } else if (SHAPE_DEFAULTS[activeTool]) {
      const isLine = activeTool === "LINE" || activeTool === "UNDERLINE";
      props.onAddObject({ kind: "shape", id: newId("shape"), ...base, width: Math.max(isLine ? 20 : 12, width || 120), height: activeTool === "UNDERLINE" ? Math.max(4, height || 6) : Math.max(isLine ? 1 : 12, height || (isLine ? 1 : 60)), ...(SHAPE_DEFAULTS[activeTool] as any) });
    }
    props.onToolDone();
  };

  const vars = {
    page: displayNumber,
    totalPages: totalPages || 1,
    subject: props.coverPage?.subject || props.moduleData?.subject || "NEET PREP",
    chapter: props.coverPage?.chapter || props.moduleData?.chapter || props.moduleData?.title || "Academic Module",
    teacher: props.coverPage?.teacher || props.moduleData?.facultyName || "",
    date: new Date().toLocaleDateString("en-IN"),
    moduleNumber: props.coverPage?.moduleNumber || props.moduleData?.code || "Module 01",
  };
  const { headerFooter, watermark, background } = props;
  const inRange = (r?: any, c?: number[], ex?: boolean) => isPageInRange(displayNumber, r, c, ex);
  const showHeader = headerFooter?.enabled && inRange(headerFooter.pageRange, headerFooter.customPages, headerFooter.excludeFirstPage);
  const showWatermark = watermark?.enabled && inRange(watermark.pageRange, watermark.customPages, watermark.excludeFirstPage);
  const showBackground = background?.enabled && inRange(background.pageRange, background.customPages);
  const headerAccent = headerFooter?.accentColor || "#ea580c";
  const headerHeightPt = headerFooter?.headerImageHeight || 36;
  const footerHeightPt = headerFooter?.footerImageHeight || 24;
  const boxTool = BOX_TOOLS.includes(activeTool);

  return (
    <div
      ref={rootRef}
      className="relative shadow-2xl border border-slate-800 bg-white select-none"
      style={{ width: `${pageSize.width * scale}px`, height: `${pageSize.height * scale}px` }}
      role="group"
      aria-label={`Page ${displayNumber} of ${totalPages}${sourcePage === 0 ? " (blank page)" : ""}`}
    >
      {showBackground && (
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: background?.color || "#ffffff", opacity: background?.opacity ?? 0.85, mixBlendMode: "multiply", zIndex: 1 }}>
          {background?.base64Data && <img src={background.base64Data} alt="" className="w-full h-full object-cover opacity-20" />}
        </div>
      )}

      {sourcePage !== 0 && <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }} aria-hidden="true" />}
      {sourcePage !== 0 && !visible && <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-xs">Page {displayNumber}</div>}
      {renderError && <div className="absolute inset-x-0 top-1/2 text-center text-red-600 text-xs px-4">This page could not be drawn: {renderError}</div>}

      {headerFooter?.removeOldHeader && inRange(headerFooter.pageRange, headerFooter.customPages, headerFooter.excludeFirstPage) && (
        <div className="absolute top-0 left-0 right-0 bg-white pointer-events-none" style={{ zIndex: 3, height: `${(headerFooter.oldHeaderHeightPt || 42) * scale}px` }} />
      )}
      {headerFooter?.removeOldFooter && inRange(headerFooter.pageRange, headerFooter.customPages, headerFooter.excludeFirstPage) && (
        <div className="absolute bottom-0 left-0 right-0 bg-white pointer-events-none" style={{ zIndex: 3, height: `${(headerFooter.oldFooterHeightPt || 32) * scale}px` }} />
      )}

      {showWatermark && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden" style={{ zIndex: watermark?.layer === "ABOVE_CONTENT" ? 7 : 4 }}>
          {watermark?.type === "image" && (watermark.base64Data || watermark.imageUrl) ? (
            <img src={watermark.base64Data || watermark.imageUrl} alt="" style={{ width: `${(watermark.imageWidth || 320) * scale}px`, opacity: watermark.opacity ?? 0.08, transform: `rotate(${-(watermark.rotation ?? 0)}deg)` }} />
          ) : (
            <div className="font-black uppercase tracking-widest whitespace-nowrap" style={{ fontSize: `${(watermark?.fontSize || 38) * scale}px`, color: watermark?.color || "#000000", opacity: watermark?.opacity ?? 0.08, transform: `rotate(${-(watermark?.rotation ?? 35)}deg)` }}>
              {watermark?.text || "ATOMIC PATHSHALA"}
            </div>
          )}
        </div>
      )}

      {/* Editable objects. The layer is above the page, masks and watermark; objects inside it
          stack by their own z (100 + z), never by the order React happens to render them. */}
      <div
        ref={overlayRef}
        onPointerDown={onOverlayPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          dragRef.current = null;
          setDrawBox(null);
        }}
        className={`absolute inset-0 overflow-hidden touch-none ${boxTool ? "cursor-crosshair" : ""}`}
        style={{ zIndex: 5 }}
      >
        {props.globalRemovals.map((g) => (
          <div key={g.id} className="absolute pointer-events-none" style={{ zIndex: 10, left: g.x * scale, top: g.y * scale, width: g.width * scale, height: g.height * scale, background: g.color || "#ffffff" }} />
        ))}
        {props.globalReplacements.map((r) => (
          <div key={r.id} className="absolute bg-white overflow-hidden pointer-events-none flex items-center justify-center" style={{ zIndex: 11, left: r.x * scale, top: r.y * scale, width: r.width * scale, height: r.height * scale }}>
            {r.replacementType === "image" && (r.base64Data || r.imageUrl) && <img src={r.base64Data || r.imageUrl} alt="" className="w-full h-full object-contain" />}
            {r.replacementType === "text" && r.newText && <span className="text-slate-900 font-bold px-1" style={{ fontSize: (r.fontSize || 11) * scale }}>{r.newText}</span>}
          </div>
        ))}

        {objects.map((o) => (
          <OverlayView
            key={o.id}
            o={o}
            scale={scale}
            selected={selectedObjectId === o.id}
            editing={editingTextId === o.id}
            interactive={!boxTool && activeTool !== "EDIT_TEXT"}
            onPointerDown={(e) => startDrag(e, o, "move")}
            onResizeDown={(e) => startDrag(e, o, "resize")}
            onDoubleClick={() => o.kind === "text" && !o.locked && props.onStartEditText(o.id)}
            onChangeText={(text) => props.onUpdateObject(o.id, { newText: text })}
            onFinishEdit={() => props.onStartEditText(null)}
          />
        ))}

        {activeTool === "EDIT_TEXT" &&
          textSpans.map((span, idx) => (
            <button
              type="button"
              key={idx}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                const id = newId("text");
                props.onAddObject({ kind: "text", id, pageNumber: pageId, x: span.x - TEXT_PAD, y: span.y - TEXT_PAD, width: span.width + TEXT_PAD * 2 + 4, height: span.height * TEXT_LINE_HEIGHT + TEXT_PAD * 2, originalText: span.text, newText: span.text, fontSize: Math.max(6, Math.round(span.fontSize * 10) / 10), fontFamily: "helvetica", color: "#000000", hideOriginal: true, lineHeight: TEXT_LINE_HEIGHT });
                props.onStartEditText(id);
              }}
              className="absolute border border-transparent hover:border-emerald-500 hover:bg-emerald-500/20 focus-visible:border-emerald-500 cursor-text rounded"
              style={{ zIndex: 100000, left: span.x * scale, top: span.y * scale, width: span.width * scale, height: span.height * scale }}
              title={`Edit: "${span.text}" (covers the original and writes new text on top)`}
              aria-label={`Edit text: ${span.text}`}
            />
          ))}

        {drawBox && (
          <div
            className={`absolute border-2 pointer-events-none ${activeTool === "WHITEOUT" || activeTool === "REMOVE_OBJECT" ? "bg-red-500/20 border-red-500" : activeTool === "REPLACE_OBJECT" ? "bg-cyan-500/20 border-cyan-500" : "bg-blue-500/15 border-blue-500"}`}
            style={{ zIndex: 100001, left: Math.min(drawBox.startX, drawBox.currX) * scale, top: Math.min(drawBox.startY, drawBox.currY) * scale, width: Math.abs(drawBox.currX - drawBox.startX) * scale, height: Math.abs(drawBox.currY - drawBox.startY) * scale }}
          />
        )}
      </div>

      {showHeader && (
        <div className="absolute left-0 right-0 bg-white flex items-center justify-between px-4 pointer-events-none" style={{ zIndex: 6, top: (headerFooter?.headerTopOffsetPt || 0) * scale, height: headerHeightPt * scale, borderBottom: `${2.5 * scale}px solid ${headerAccent}` }}>
          {headerFooter?.headerImageBase64 || headerFooter?.headerImageUrl ? (
            <img src={headerFooter.headerImageBase64 || headerFooter.headerImageUrl} alt="" className="h-[80%] object-contain" />
          ) : (
            <span className="font-bold uppercase tracking-wider" style={{ color: headerAccent, fontSize: (headerFooter?.fontSize || 9) * scale }}>
              {replaceVariables(headerFooter?.headerLeft || "", vars)}
            </span>
          )}
          <span className="text-slate-800 font-semibold truncate px-2" style={{ fontSize: ((headerFooter?.fontSize || 9) - 0.5) * scale }}>
            {replaceVariables(headerFooter?.headerCenter || "", vars)}
          </span>
          <span className="text-slate-500 font-medium truncate" style={{ fontSize: ((headerFooter?.fontSize || 9) - 1) * scale }}>
            {replaceVariables(headerFooter?.headerRight || "", vars)}
          </span>
        </div>
      )}
      {showHeader && (
        <div className="absolute left-0 right-0 bg-white flex items-center justify-between px-4 border-t border-slate-200 pointer-events-none" style={{ zIndex: 6, bottom: (headerFooter?.footerBottomOffsetPt || 0) * scale, height: footerHeightPt * scale }}>
          <span className="text-slate-500 font-medium" style={{ fontSize: 7.5 * scale }}>
            {replaceVariables(headerFooter?.footerLeft || "", vars)}
          </span>
          <span className="font-bold uppercase" style={{ color: headerAccent, fontSize: 8 * scale }}>
            {replaceVariables(headerFooter?.footerRight || "Page {page} of {totalPages}", vars)}
          </span>
        </div>
      )}
    </div>
  );
}

function OverlayView({
  o,
  scale,
  selected,
  editing,
  interactive,
  onPointerDown,
  onResizeDown,
  onDoubleClick,
  onChangeText,
  onFinishEdit,
}: {
  o: OverlayObject;
  scale: number;
  selected: boolean;
  editing: boolean;
  interactive: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onResizeDown: (e: React.PointerEvent) => void;
  onDoubleClick: () => void;
  onChangeText: (text: string) => void;
  onFinishEdit: () => void;
}) {
  const box: React.CSSProperties = {
    position: "absolute",
    left: o.x * scale,
    top: o.y * scale,
    width: o.width * scale,
    height: o.height * scale,
    zIndex: 100 + (o.z ?? 0),
    pointerEvents: interactive ? "auto" : "none",
    cursor: interactive ? (o.locked ? "default" : editing ? "text" : "move") : undefined,
  };
  const ring = selected ? (o.locked ? "outline outline-2 outline-amber-500" : "outline outline-2 outline-sky-500") : interactive ? "hover:outline hover:outline-1 hover:outline-sky-400/70" : "";
  const label =
    o.kind === "text" ? `Text: ${o.newText || "(empty)"}` : o.kind === "image" ? "Picture" : o.kind === "whiteout" ? "White cover" : `Shape: ${o.type}`;
  const textStyle: React.CSSProperties =
    o.kind === "text"
      ? {
          fontSize: o.fontSize * scale,
          fontFamily: fontCss(o.fontFamily),
          fontWeight: o.isBold ? 700 : 400,
          fontStyle: o.isItalic ? "italic" : "normal",
          color: o.color || "#000000",
          textAlign: o.align || "left",
          lineHeight: o.lineHeight || TEXT_LINE_HEIGHT,
          padding: TEXT_PAD * scale,
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
        }
      : {};

  return (
    <div
      style={box}
      className={`${ring} outline-offset-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500`}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      tabIndex={interactive ? 0 : -1}
      role="button"
      aria-label={`${label}${o.locked ? " (locked)" : ""}`}
      aria-pressed={selected}
      data-object-id={o.id}
    >
      {o.kind === "whiteout" && <div className="w-full h-full" style={{ background: o.color || "#ffffff" }} />}

      {o.kind === "text" && (
        <>
          {o.hideOriginal !== false && (
            <div className="absolute pointer-events-none" style={{ left: -2 * scale, top: -2 * scale, right: -2 * scale, bottom: -2 * scale, background: o.backgroundColor || "#ffffff" }} />
          )}
          {editing ? (
            <textarea
              autoFocus
              value={o.newText}
              placeholder="Type here"
              onChange={(e) => onChangeText(e.target.value)}
              onBlur={onFinishEdit}
              onKeyDown={(e) => {
                if (e.key === "Escape") onFinishEdit();
                e.stopPropagation();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Text box content"
              className="relative w-full h-full bg-transparent border-0 outline-none resize-none block"
              style={textStyle}
            />
          ) : (
            <div className="relative w-full h-full" style={textStyle}>
              {o.newText || (selected ? <span className="text-slate-400">Double-click to type</span> : null)}
            </div>
          )}
        </>
      )}

      {o.kind === "image" && (
        <img
          src={o.base64Data || o.imageUrl}
          alt=""
          draggable={false}
          className="w-full h-full object-fill pointer-events-none"
          style={{ opacity: o.opacity ?? 1, transform: `rotate(${o.rotation ?? 0}deg)` }}
        />
      )}

      {o.kind === "shape" && <ShapeView s={o} scale={scale} />}

      {selected && !o.locked && !editing && interactive && (
        <div
          onPointerDown={onResizeDown}
          className="absolute -right-1.5 -bottom-1.5 w-3 h-3 bg-sky-500 border border-white rounded-sm cursor-nwse-resize"
          role="presentation"
          title="Drag to resize"
        />
      )}
      {selected && o.locked && <span className="absolute -top-4 left-0 text-[10px] font-bold text-amber-600 bg-white/90 px-1 rounded">Locked</span>}
    </div>
  );
}

function ShapeView({ s, scale }: { s: Extract<OverlayObject, { kind: "shape" }>; scale: number }) {
  const sw = (s.strokeWidth ?? 1.5) * scale;
  const op = s.opacity ?? 1;
  if (s.type === "highlight") return <div className="w-full h-full" style={{ background: s.fillColor || "#ffe633", opacity: s.opacity ?? 0.4 }} />;
  if (s.type === "rect" || s.type === "callout" || s.type === "circle") {
    return (
      <div
        className="w-full h-full box-border"
        style={{
          borderRadius: s.type === "circle" ? "50%" : 0,
          // the PDF draws the border centred on the box edge
          boxShadow: s.strokeColor || !s.fillColor ? `0 0 0 ${sw / 2}px ${s.strokeColor || "#000"}, inset 0 0 0 ${sw / 2}px ${s.strokeColor || "#000"}` : undefined,
          background: s.fillColor || "transparent",
          opacity: op,
        }}
      />
    );
  }
  const w = s.width * scale;
  const h = s.height * scale;
  return (
    <svg width={w} height={h} className="overflow-visible block" style={{ opacity: op }} aria-hidden="true">
      {s.type === "underline" ? (
        <line x1={0} y1={h} x2={w} y2={h} stroke={s.strokeColor || "#000"} strokeWidth={sw} />
      ) : (
        <line x1={0} y1={0} x2={w} y2={h} stroke={s.strokeColor || "#000"} strokeWidth={sw} />
      )}
    </svg>
  );
}
