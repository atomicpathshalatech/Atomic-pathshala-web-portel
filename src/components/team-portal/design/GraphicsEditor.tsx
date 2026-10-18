"use client";

import React, { useRef, useState } from "react";
import type { DesignGraphic } from "@/lib/module-studio/design/model";
import { designId } from "@/lib/module-studio/design/presets";
import * as G from "@/lib/module-studio/design/graphics-ops";
import { uploadFileToR2 } from "@/lib/storage/upload-client";

const iconBtn = "p-1.5 rounded-lg border border-outline-variant/40 hover:bg-surface-container-high disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

/**
 * Page-template graphics (cover / master page): place, move, resize, align,
 * distribute, group, lock, duplicate and stack logos, pictures, shapes and
 * text. Positions are mm from the top-left of the page.
 */
export function GraphicsEditor({
  graphics,
  onChange,
  page,
  logoUrl,
  moduleId,
  label,
}: {
  graphics: DesignGraphic[];
  onChange: (next: DesignGraphic[]) => void;
  page: { w: number; h: number };
  logoUrl: string | null;
  moduleId: string;
  label: string;
}) {
  const [sel, setSel] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ mode: "move" | "resize"; id: string; sx: number; sy: number; start: DesignGraphic[]; pid: number } | null>(null);
  const width = 300;
  const k = width / page.w; // px per mm
  const selected = graphics.filter((g) => sel.includes(g.id));
  const single = selected.length === 1 ? selected[0]! : null;
  const anyLocked = selected.some((g) => g.locked);
  // Shift-click adds an object (or its group) to the selection, or takes it out again.
  const toggle = (id: string) => {
    const ids = G.expandToGroups(graphics, [id]);
    setSel((cur) => (cur.includes(id) ? cur.filter((x) => !ids.includes(x)) : [...new Set([...cur, ...ids])]));
  };
  const toMm = (e: { clientX: number; clientY: number }) => {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
  };
  const add = (kind: DesignGraphic["kind"], extra: Partial<DesignGraphic> = {}) => {
    const z = Math.max(0, ...graphics.map((g) => g.z)) + 1;
    const g: DesignGraphic = {
      id: designId("g"),
      kind,
      x: page.w / 2 - 25,
      y: page.h / 2 - 15,
      w: kind === "LINE" ? 60 : 50,
      h: kind === "LINE" ? 0.5 : kind === "TEXT" ? 12 : 30,
      z,
      ...(kind === "RECT" || kind === "ELLIPSE" ? { fill: "#e0f2fe", stroke: "#0284c7", strokeWidthPt: 1 } : {}),
      ...(kind === "LINE" ? { stroke: "#0f172a", strokeWidthPt: 1.5 } : {}),
      ...(kind === "TEXT" ? { text: "Text", fontSizePt: 14, color: "#0f172a", align: "left" as const } : {}),
      ...extra,
    };
    onChange([...graphics, g]);
    setSel([g.id]);
  };
  const upload = async (f: File) => {
    setUploading(true);
    try {
      const r = await uploadFileToR2(f, { prefix: "modules", fileType: "IMAGE", visibility: "PUBLIC", entityId: moduleId });
      if (r.url) add("IMAGE", { src: r.url, w: 60, h: 40 });
    } finally {
      setUploading(false);
    }
  };
  const apply = (next: DesignGraphic[]) => onChange(next);
  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("input,textarea,select")) return;
    const mod = e.ctrlKey || e.metaKey;
    if (!sel.length) return;
    if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      const s = e.shiftKey ? 5 : 1;
      apply(G.moveBy(graphics, sel, e.key === "ArrowLeft" ? -s : e.key === "ArrowRight" ? s : 0, e.key === "ArrowUp" ? -s : e.key === "ArrowDown" ? s : 0));
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      apply(G.remove(graphics, sel));
      setSel([]);
    } else if (mod && e.key.toLowerCase() === "d") {
      e.preventDefault();
      const r = G.duplicate(graphics, sel);
      apply(r.graphics);
      setSel(r.newIds);
    } else if (mod && e.key.toLowerCase() === "g") {
      e.preventDefault();
      apply(e.shiftKey ? G.ungroup(graphics, sel) : G.group(graphics, sel).graphics);
    } else if (e.key === "Escape") setSel([]);
  };

  return (
    <div className="space-y-2" onKeyDown={onKey}>
      <div className="flex flex-wrap items-center gap-1 text-[11px]" role="toolbar" aria-label={`${label} graphics`}>
        <span className="font-semibold text-on-surface-variant mr-1">Add</span>
        <button type="button" className={iconBtn} onClick={() => add("LOGO", { w: 30, h: 30, x: 15, y: 15 })} title="Logo (from the setup)" disabled={!logoUrl}>
          <span className="material-symbols-outlined text-base">verified</span>
        </button>
        <label className={`${iconBtn} cursor-pointer`} title="Picture (upload)">
          <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <span className="material-symbols-outlined text-base">{uploading ? "sync" : "image"}</span>
        </label>
        <button type="button" className={iconBtn} onClick={() => add("RECT")} title="Box">
          <span className="material-symbols-outlined text-base">crop_square</span>
        </button>
        <button type="button" className={iconBtn} onClick={() => add("ELLIPSE")} title="Ellipse">
          <span className="material-symbols-outlined text-base">circle</span>
        </button>
        <button type="button" className={iconBtn} onClick={() => add("LINE")} title="Line">
          <span className="material-symbols-outlined text-base">horizontal_rule</span>
        </button>
        <button type="button" className={iconBtn} onClick={() => add("TEXT")} title="Text">
          <span className="material-symbols-outlined text-base">title</span>
        </button>
      </div>

      <div className="flex gap-3">
        <div
          ref={boxRef}
          tabIndex={0}
          aria-label={`${label}: page template canvas. Click to select, drag to move, arrow keys to nudge.`}
          className="relative bg-white border border-outline-variant/60 shadow-sm shrink-0 overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          style={{ width, height: page.h * k }}
          onPointerDown={(e) => {
            if (e.target === boxRef.current) setSel([]);
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d || d.pid !== e.pointerId) return;
            const p = toMm(e);
            const dx = p.x - d.sx;
            const dy = p.y - d.sy;
            if (d.mode === "move") onChange(G.moveBy(d.start, sel, dx, dy));
            else onChange(d.start.map((g) => (g.id === d.id && !g.locked ? { ...g, w: Math.max(2, Math.round((g.w + dx) * 10) / 10), h: Math.max(0.5, Math.round((g.h + dy) * 10) / 10) } : g)));
          }}
          onPointerUp={() => (drag.current = null)}
        >
          <div className="absolute inset-0 pointer-events-none border border-dashed border-primary/20" />
          {[...graphics].sort((a, b) => a.z - b.z).map((g) => {
            const isSel = sel.includes(g.id);
            const style: React.CSSProperties = { position: "absolute", left: g.x * k, top: g.y * k, width: g.w * k, height: Math.max(2, g.h * k), opacity: g.opacity ?? 1, zIndex: 10 + g.z, cursor: g.locked ? "not-allowed" : "move" };
            return (
              <div
                key={g.id}
                role="button"
                tabIndex={-1}
                aria-label={`${g.kind.toLowerCase()}${g.locked ? " (locked)" : ""}${g.z < 0 ? " behind text" : ""}`}
                aria-pressed={isSel}
                style={style}
                className={isSel ? "outline outline-2 outline-primary" : "hover:outline hover:outline-1 hover:outline-primary/50"}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (e.shiftKey) {
                    toggle(g.id);
                    return;
                  }
                  const nextSel = sel.includes(g.id) ? sel : G.expandToGroups(graphics, [g.id]);
                  setSel(nextSel);
                  boxRef.current?.focus();
                  try {
                    boxRef.current?.setPointerCapture(e.pointerId);
                  } catch {}
                  const p = toMm(e);
                  drag.current = { mode: "move", id: g.id, sx: p.x, sy: p.y, start: graphics, pid: e.pointerId };
                }}
              >
                {g.kind === "LOGO" || g.kind === "IMAGE" ? (
                  (g.kind === "LOGO" ? logoUrl : g.src) ? <img src={(g.kind === "LOGO" ? logoUrl : g.src)!} alt="" className="w-full h-full object-contain pointer-events-none" draggable={false} /> : <div className="w-full h-full bg-surface-container-high text-[9px] flex items-center justify-center">no picture</div>
                ) : g.kind === "TEXT" ? (
                  <div className="w-full h-full overflow-hidden leading-tight" style={{ fontSize: (g.fontSizePt ?? 12) * 0.3528 * k, color: g.color, fontWeight: g.bold ? 700 : 400, textAlign: g.align }}>
                    {g.text}
                  </div>
                ) : g.kind === "LINE" ? (
                  <svg width="100%" height="100%" className="overflow-visible" preserveAspectRatio="none">
                    <line x1="0" y1="0" x2="100%" y2="100%" stroke={g.stroke ?? "#000"} strokeWidth={Math.max(1, (g.strokeWidthPt ?? 1) * 0.3528 * k)} />
                  </svg>
                ) : (
                  <div className="w-full h-full" style={{ background: g.fill ?? "transparent", border: g.stroke ? `${Math.max(1, (g.strokeWidthPt ?? 1) * 0.3528 * k)}px solid ${g.stroke}` : undefined, borderRadius: g.kind === "ELLIPSE" ? "50%" : 0 }} />
                )}
                {isSel && single?.id === g.id && !g.locked && (
                  <div
                    className="absolute -right-1.5 -bottom-1.5 w-3 h-3 bg-primary border border-white cursor-nwse-resize"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      try {
                        boxRef.current?.setPointerCapture(e.pointerId);
                      } catch {}
                      const p = toMm(e);
                      drag.current = { mode: "resize", id: g.id, sx: p.x, sy: p.y, start: graphics, pid: e.pointerId };
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex-1 min-w-0 space-y-2 text-[11px]">
          {!selected.length ? (
            <p className="text-on-surface-variant">
              {graphics.length ? "Click an object to select it (Shift-click for more). Drag to move; the corner handle resizes." : "No graphics on this page template yet — add a logo, picture, shape or text."}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1" role="group" aria-label="Align">
                {(
                  [
                    ["left", "align_horizontal_left"],
                    ["hcenter", "align_horizontal_center"],
                    ["right", "align_horizontal_right"],
                    ["top", "align_vertical_top"],
                    ["vmiddle", "align_vertical_center"],
                    ["bottom", "align_vertical_bottom"],
                  ] as const
                ).map(([op, icon]) => (
                  <button key={op} type="button" className={iconBtn} onClick={() => apply(G.align(graphics, sel, op, page))} title={`Align ${op} (${selected.length > 1 ? "to each other" : "to the page"})`} aria-label={`Align ${op}`}>
                    <span className="material-symbols-outlined text-base">{icon}</span>
                  </button>
                ))}
                <button type="button" className={iconBtn} disabled={G.expandToGroups(graphics, sel).length < 3} onClick={() => apply(G.distribute(graphics, sel, "h"))} title="Distribute horizontally (3 or more)" aria-label="Distribute horizontally">
                  <span className="material-symbols-outlined text-base">horizontal_distribute</span>
                </button>
                <button type="button" className={iconBtn} disabled={G.expandToGroups(graphics, sel).length < 3} onClick={() => apply(G.distribute(graphics, sel, "v"))} title="Distribute vertically (3 or more)" aria-label="Distribute vertically">
                  <span className="material-symbols-outlined text-base">vertical_distribute</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                <button type="button" className={iconBtn} disabled={selected.length < 2} onClick={() => apply(G.group(graphics, sel).graphics)} title="Group (Ctrl+G)">
                  Group
                </button>
                <button type="button" className={iconBtn} disabled={!selected.some((g) => g.groupId)} onClick={() => apply(G.ungroup(graphics, sel))} title="Ungroup (Ctrl+Shift+G)">
                  Ungroup
                </button>
                <button type="button" className={iconBtn} onClick={() => apply(G.setLocked(graphics, sel, !anyLocked))} aria-pressed={anyLocked}>
                  {anyLocked ? "Unlock" : "Lock"}
                </button>
                <button
                  type="button"
                  className={iconBtn}
                  onClick={() => {
                    const r = G.duplicate(graphics, sel);
                    apply(r.graphics);
                    setSel(r.newIds);
                  }}
                  title="Duplicate (Ctrl+D)"
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className={`${iconBtn} text-red-600`}
                  disabled={selected.every((g) => g.locked)}
                  onClick={() => {
                    apply(G.remove(graphics, sel));
                    setSel([]);
                  }}
                  title="Delete (Del)"
                >
                  Delete
                </button>
              </div>
              <div className="flex flex-wrap gap-1 items-center">
                {(["front", "forward", "backward", "back"] as const).map((op) => (
                  <button key={op} type="button" className={iconBtn} onClick={() => apply(G.arrange(graphics, sel, op))}>
                    {op === "front" ? "To front" : op === "back" ? "To back" : op === "forward" ? "Forward" : "Backward"}
                  </button>
                ))}
                <label className="flex items-center gap-1 ml-1">
                  <input type="checkbox" checked={selected.every((g) => g.z < 0)} onChange={(e) => apply(G.setBehindText(graphics, sel, e.target.checked))} />
                  Behind text
                </label>
              </div>
              {single && <GraphicProps g={single} onChange={(patch) => apply(graphics.map((x) => (x.id === single.id ? { ...x, ...patch } : x)))} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function GraphicProps({ g, onChange }: { g: DesignGraphic; onChange: (p: Partial<DesignGraphic>) => void }) {
  const num = (key: "x" | "y" | "w" | "h", label: string) => (
    <label className="block">
      <span className="block text-[10px] text-on-surface-variant">{label} (mm)</span>
      <input type="number" step={0.5} disabled={g.locked} value={g[key]} onChange={(e) => Number.isFinite(Number(e.target.value)) && onChange({ [key]: Number(e.target.value) })} className="w-full rounded border border-outline-variant/40 px-1.5 py-1 bg-surface-container-lowest" />
    </label>
  );
  return (
    <div className="space-y-2 pt-2 border-t border-outline-variant/30">
      <div className="grid grid-cols-4 gap-1.5">
        {num("x", "X")}
        {num("y", "Y")}
        {num("w", "W")}
        {num("h", "H")}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(g.kind === "RECT" || g.kind === "ELLIPSE") && (
          <label className="block">
            <span className="block text-[10px] text-on-surface-variant">Fill</span>
            <div className="flex gap-1">
              <input type="color" value={g.fill ?? "#ffffff"} onChange={(e) => onChange({ fill: e.target.value })} className="h-7 flex-1" />
              <button type="button" className="text-[10px] px-1 border rounded" onClick={() => onChange({ fill: null })}>
                None
              </button>
            </div>
          </label>
        )}
        {g.kind !== "TEXT" && g.kind !== "LOGO" && g.kind !== "IMAGE" && (
          <label className="block">
            <span className="block text-[10px] text-on-surface-variant">Line</span>
            <div className="flex gap-1">
              <input type="color" value={g.stroke ?? "#000000"} onChange={(e) => onChange({ stroke: e.target.value })} className="h-7 flex-1" />
              <input type="number" min={0} max={10} step={0.5} value={g.strokeWidthPt ?? 1} onChange={(e) => onChange({ strokeWidthPt: Number(e.target.value) })} className="w-12 rounded border px-1" aria-label="Line width (pt)" />
            </div>
          </label>
        )}
        <label className="block">
          <span className="block text-[10px] text-on-surface-variant">Opacity {Math.round((g.opacity ?? 1) * 100)}%</span>
          <input type="range" min={0.05} max={1} step={0.05} value={g.opacity ?? 1} onChange={(e) => onChange({ opacity: Number(e.target.value) })} className="w-full" />
        </label>
      </div>
      {g.kind === "TEXT" && (
        <div className="space-y-1.5">
          <input value={g.text ?? ""} onChange={(e) => onChange({ text: e.target.value })} className="w-full rounded border border-outline-variant/40 px-2 py-1" aria-label="Text" />
          <div className="flex gap-1.5 items-center">
            <input type="number" min={4} max={96} value={g.fontSizePt ?? 12} onChange={(e) => onChange({ fontSizePt: Number(e.target.value) })} className="w-14 rounded border px-1" aria-label="Font size (pt)" />
            <input type="color" value={g.color ?? "#000000"} onChange={(e) => onChange({ color: e.target.value })} className="h-7 w-10" aria-label="Text colour" />
            <button type="button" className={`px-2 py-0.5 rounded border ${g.bold ? "bg-primary/10 border-primary" : ""}`} onClick={() => onChange({ bold: !g.bold })} aria-pressed={!!g.bold}>
              B
            </button>
            <select value={g.align ?? "left"} onChange={(e) => onChange({ align: e.target.value as any })} className="rounded border px-1 py-0.5" aria-label="Text alignment">
              <option value="left">Left</option>
              <option value="center">Centre</option>
              <option value="right">Right</option>
            </select>
          </div>
          <p className="text-[10px] text-on-surface-variant">On body pages, text graphics use a built-in Latin font (Hindi text there is left out — use the header/footer for Hindi). On the cover any language works.</p>
        </div>
      )}
    </div>
  );
}
