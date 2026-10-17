"use client";

import React from "react";
import type { ArrangeOp, OverlayObject } from "@/lib/module-editor/overlay-model";

const btn = "flex-1 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-30 flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500";

/** Arrange / lock / duplicate / delete and the box of the selected object (any kind). */
export function ObjectArrangePanel({
  o,
  index,
  count,
  onArrange,
  onUpdate,
  onDuplicate,
  onDelete,
}: {
  o: OverlayObject;
  /** Position in the page's stack, 0 = bottom. */
  index: number;
  count: number;
  onArrange: (op: ArrangeOp) => void;
  onUpdate: (patch: Record<string, unknown>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const num = (key: "x" | "y" | "width" | "height", label: string) => (
    <label className="block">
      <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">{label}</span>
      <input
        type="number"
        value={Math.round(o[key] * 10) / 10}
        disabled={o.locked}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onUpdate({ [key]: key === "width" || key === "height" ? Math.max(2, v) : v });
        }}
        className="w-full px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs disabled:opacity-50"
      />
    </label>
  );
  return (
    <div className="space-y-3 pb-3 border-b border-slate-800">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-300">
          Layer {index + 1} of {count} <span className="text-slate-500 font-normal">(1 = bottom)</span>
        </span>
        <button
          type="button"
          onClick={() => onUpdate({ locked: !o.locked })}
          className={`px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 ${o.locked ? "border-amber-500/60 text-amber-400 bg-amber-500/10" : "border-slate-700 text-slate-300"}`}
          aria-pressed={!!o.locked}
          title={o.locked ? "Unlock (allow moving, resizing, deleting)" : "Lock (prevent moving, resizing, deleting)"}
        >
          <span className="material-symbols-outlined text-sm">{o.locked ? "lock" : "lock_open"}</span>
          {o.locked ? "Locked" : "Lock"}
        </button>
      </div>
      <div className="flex gap-1" role="group" aria-label="Arrange">
        <button type="button" className={btn} disabled={index === count - 1} onClick={() => onArrange("front")} title="Bring to front (Ctrl+Shift+])" aria-label="Bring to front">
          <span className="material-symbols-outlined text-base">flip_to_front</span>
        </button>
        <button type="button" className={btn} disabled={index === count - 1} onClick={() => onArrange("forward")} title="Bring forward (Ctrl+])" aria-label="Bring forward">
          <span className="material-symbols-outlined text-base">arrow_upward</span>
        </button>
        <button type="button" className={btn} disabled={index === 0} onClick={() => onArrange("backward")} title="Send backward (Ctrl+[)" aria-label="Send backward">
          <span className="material-symbols-outlined text-base">arrow_downward</span>
        </button>
        <button type="button" className={btn} disabled={index === 0} onClick={() => onArrange("back")} title="Send to back (Ctrl+Shift+[)" aria-label="Send to back">
          <span className="material-symbols-outlined text-base">flip_to_back</span>
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {num("x", "X")}
        {num("y", "Y")}
        {num("width", "W")}
        {num("height", "H")}
      </div>
      {o.kind === "shape" && (
        <div className="grid grid-cols-2 gap-2">
          {o.type !== "highlight" && (
            <label className="block">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Line colour</span>
              <input type="color" value={o.strokeColor || "#000000"} onChange={(e) => onUpdate({ strokeColor: e.target.value })} className="w-full h-7 rounded border border-slate-800 bg-transparent" />
            </label>
          )}
          {(o.type === "rect" || o.type === "circle" || o.type === "highlight" || o.type === "callout") && (
            <label className="block">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Fill</span>
              <div className="flex gap-1">
                <input type="color" value={o.fillColor || "#ffffff"} onChange={(e) => onUpdate({ fillColor: e.target.value })} className="flex-1 h-7 rounded border border-slate-800 bg-transparent" />
                {o.type !== "highlight" && o.fillColor && (
                  <button type="button" onClick={() => onUpdate({ fillColor: undefined })} className="px-1.5 rounded border border-slate-800 text-[10px]" title="No fill">
                    None
                  </button>
                )}
              </div>
            </label>
          )}
          {o.type !== "highlight" && (
            <label className="block">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Line width</span>
              <input type="number" min={0.5} max={20} step={0.5} value={o.strokeWidth ?? 1.5} onChange={(e) => onUpdate({ strokeWidth: Math.max(0.5, Number(e.target.value) || 1) })} className="w-full px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs" />
            </label>
          )}
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Opacity {Math.round((o.opacity ?? 1) * 100)}%</span>
            <input type="range" min={0.1} max={1} step={0.05} value={o.opacity ?? 1} onChange={(e) => onUpdate({ opacity: Number(e.target.value) })} className="w-full accent-orange-500" />
          </label>
        </div>
      )}
      {o.kind === "whiteout" && (
        <p className="text-[11px] text-amber-300/90 leading-snug">
          A cover, not a redaction: it hides this area when printed or viewed, but text underneath stays inside the PDF file (copy and search can still find it).
        </p>
      )}
      <div className="flex gap-1.5">
        <button type="button" onClick={onDuplicate} className={`${btn} gap-1 text-[11px] font-bold`} title="Duplicate (Ctrl+D)">
          <span className="material-symbols-outlined text-sm">content_copy</span> Duplicate
        </button>
        <button type="button" onClick={onDelete} disabled={o.locked} className={`${btn} gap-1 text-[11px] font-bold text-red-400`} title={o.locked ? "Unlock to delete" : "Delete (Del)"}>
          <span className="material-symbols-outlined text-sm">delete</span> Delete
        </button>
      </div>
    </div>
  );
}
