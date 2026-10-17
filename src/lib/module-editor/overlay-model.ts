/**
 * The PDF editor's document model ("Original PDF" mode), shared by the editor
 * (browser) and the PDF writer (server) so both draw the same thing.
 *
 * - One stacking order per page across every kind of overlay: an object's `z`
 *   decides what is on top. New objects go on top of everything already on the
 *   page — a text box added after a whiteout is above it, never hidden under it.
 * - Pages have ids. The source PDF's pages keep their numbers (1…N); a
 *   duplicated page or an inserted blank page gets a new id past N, and
 *   `pageSources` says which source page it shows (0 = blank). `pageOrder` is
 *   the document order of page ids; overlays point at a page id. So reordering,
 *   deleting or duplicating pages never moves an object to the wrong page.
 *
 * Everything here is a pure function of plain data (no React), so it is tested
 * directly (scripts/test-pdf-editor-model.ts).
 */
import type {
  TextEditItem,
  WhiteoutItem,
  ImageEditItem,
  ShapeEditItem,
  GlobalRemovalItem,
  GlobalReplacementItem,
  BackgroundConfig,
  HeaderFooterConfig,
  WatermarkConfig,
  CoverPageConfig,
} from "./native-pdf-engine";

export type OverlayKind = "text" | "whiteout" | "image" | "shape";

export type OverlayObject =
  | ({ kind: "text" } & TextEditItem)
  | ({ kind: "whiteout" } & WhiteoutItem)
  | ({ kind: "image" } & ImageEditItem)
  | ({ kind: "shape" } & ShapeEditItem);

export interface PdfProject {
  textEdits: TextEditItem[];
  whiteouts: WhiteoutItem[];
  images: ImageEditItem[];
  shapes: ShapeEditItem[];
  globalRemovals: GlobalRemovalItem[];
  globalReplacements: GlobalReplacementItem[];
  background: BackgroundConfig;
  headerFooter: HeaderFooterConfig;
  watermark: WatermarkConfig;
  coverPage: CoverPageConfig;
  /** Rotation per page id (degrees, multiples of 90). */
  pageRotations: Record<number, number>;
  /** Page ids removed from the document (kept so they can be restored). */
  deletedPages: number[];
  /** Document order of page ids. */
  pageOrder: number[];
  /** Page id → source PDF page (0 = blank page). Ids not listed show their own number. */
  pageSources: Record<number, number>;
}

/** Saved form of a project (the editable document, separate from the source and the exported PDF). */
export const PROJECT_KIND = "PDF_EDITOR_PROJECT";
export const PROJECT_SCHEMA = 2;
export const PROJECT_DRAFT_LABEL = "PDF editor — working copy";

const LISTS = ["textEdits", "whiteouts", "images", "shapes"] as const;
type ListKey = (typeof LISTS)[number];
const KIND_OF: Record<ListKey, OverlayKind> = { textEdits: "text", whiteouts: "whiteout", images: "image", shapes: "shape" };
const LIST_OF: Record<OverlayKind, ListKey> = { text: "textEdits", whiteout: "whiteouts", image: "images", shape: "shapes" };

let idCounter = 0;
/** Ids that stay unique even when two objects are made in the same millisecond. */
export function newId(prefix: string): string {
  const rnd =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${(idCounter++).toString(36)}-${rnd}`;
}

/** Project as saved before z / page ids existed → current form. Old saves keep exactly how they used to print. */
export function normalizeProject(raw: Partial<PdfProject> | null | undefined, sourcePageCount: number, defaults: Pick<PdfProject, "background" | "headerFooter" | "watermark" | "coverPage">): PdfProject {
  const p = raw ?? {};
  // The old PDF writer drew whiteouts, then text, then images, then shapes; keep that order for objects without a z.
  const base: Record<ListKey, number> = { whiteouts: 1000, textEdits: 2000, images: 3000, shapes: 4000 };
  const seen = new Set<string>();
  const fix = <T extends { id: string; z?: number }>(list: T[] | undefined, key: ListKey): T[] =>
    (Array.isArray(list) ? list : []).map((o, i) => {
      let id = typeof o.id === "string" && o.id ? o.id : newId(KIND_OF[key]);
      if (seen.has(id)) id = newId(KIND_OF[key]);
      seen.add(id);
      return { ...o, id, z: typeof o.z === "number" && Number.isFinite(o.z) ? o.z : base[key] + i };
    });
  const allIds = Array.from({ length: sourcePageCount }, (_, i) => i + 1);
  const pageSources: Record<number, number> = {};
  for (const [k, v] of Object.entries(p.pageSources ?? {})) {
    const id = Number(k);
    if (Number.isInteger(id) && id > 0 && Number.isInteger(v) && v >= 0 && v <= sourcePageCount) pageSources[id] = v;
  }
  const known = (id: number) => (id >= 1 && id <= sourcePageCount) || id in pageSources;
  let pageOrder = Array.isArray(p.pageOrder) ? p.pageOrder.filter((n) => Number.isInteger(n) && known(n)) : [];
  pageOrder = pageOrder.filter((n, i) => pageOrder.indexOf(n) === i);
  // A source page missing from a saved order (older saves) goes back at the end, never lost.
  for (const id of allIds) if (!pageOrder.includes(id)) pageOrder.push(id);
  return {
    textEdits: fix(p.textEdits, "textEdits"),
    whiteouts: fix(p.whiteouts, "whiteouts"),
    images: fix(p.images, "images"),
    shapes: fix(p.shapes, "shapes"),
    globalRemovals: Array.isArray(p.globalRemovals) ? p.globalRemovals : [],
    globalReplacements: Array.isArray(p.globalReplacements) ? p.globalReplacements : [],
    background: p.background ?? defaults.background,
    headerFooter: p.headerFooter ?? defaults.headerFooter,
    watermark: p.watermark ?? defaults.watermark,
    coverPage: p.coverPage ?? defaults.coverPage,
    pageRotations: p.pageRotations ?? {},
    deletedPages: Array.isArray(p.deletedPages) ? p.deletedPages.filter((n) => pageOrder.includes(n)) : [],
    pageOrder,
    pageSources,
  };
}

/**
 * Safety net for every state change in the editor: an object that arrives
 * without a stacking position (added by any tool or dialog) goes on top of its
 * page, and a repeated id is replaced. Returns the same object when nothing
 * needed fixing, so React sees no change.
 */
export function placeNewObjects<P extends PdfProject>(p: P): P {
  let changed = false;
  const top = new Map<number, number>();
  const seen = new Set<string>();
  for (const key of LISTS) for (const o of p[key] as any[]) if (typeof o.z === "number") top.set(o.pageNumber, Math.max(top.get(o.pageNumber) ?? 0, o.z));
  const next: Partial<Record<ListKey, unknown[]>> = {};
  for (const key of LISTS) {
    const list = p[key] as any[];
    let out: any[] | null = null;
    list.forEach((o, i) => {
      let fixed = o;
      if (typeof o.z !== "number" || !Number.isFinite(o.z)) {
        const z = (top.get(o.pageNumber) ?? 0) + 1;
        top.set(o.pageNumber, z);
        fixed = { ...fixed, z };
      }
      if (!fixed.id || seen.has(fixed.id)) fixed = { ...fixed, id: newId(KIND_OF[key]) };
      seen.add(fixed.id);
      if (fixed !== o) {
        out ??= list.slice();
        out[i] = fixed;
      }
    });
    if (out) {
      next[key] = out;
      changed = true;
    }
  }
  return changed ? ({ ...p, ...next } as P) : p;
}

/** All overlays of one page, bottom to top. */
export function objectsOnPage(p: Pick<PdfProject, ListKey>, pageId: number): OverlayObject[] {
  const out: OverlayObject[] = [];
  for (const key of LISTS) for (const o of p[key] as any[]) if (o.pageNumber === pageId) out.push({ ...o, kind: KIND_OF[key] });
  return out.sort((a, b) => (a.z ?? 0) - (b.z ?? 0) || a.id.localeCompare(b.id));
}

export function findObject(p: Pick<PdfProject, ListKey>, id: string): OverlayObject | null {
  for (const key of LISTS) {
    const o = (p[key] as any[]).find((x) => x.id === id);
    if (o) return { ...o, kind: KIND_OF[key] };
  }
  return null;
}

/** z for a new object: above everything on that page. */
export function topZ(p: Pick<PdfProject, ListKey>, pageId: number): number {
  const zs = objectsOnPage(p, pageId).map((o) => o.z ?? 0);
  return (zs.length ? Math.max(...zs) : 0) + 1;
}

/** Adds an object on top of its page. */
export function addObject<P extends PdfProject>(p: P, obj: OverlayObject): P {
  const { kind, ...item } = obj as any;
  const key = LIST_OF[kind as OverlayKind];
  const placed = { ...item, id: item.id || newId(kind), z: topZ(p, item.pageNumber) };
  return { ...p, [key]: [...(p[key] as any[]), placed] };
}

export function updateObject<P extends PdfProject>(p: P, id: string, patch: Record<string, unknown>): P {
  for (const key of LISTS) {
    const list = p[key] as any[];
    const i = list.findIndex((o) => o.id === id);
    if (i >= 0) {
      const next = list.slice();
      next[i] = { ...list[i], ...patch, id };
      return { ...p, [key]: next };
    }
  }
  return p;
}

export function removeObject<P extends PdfProject>(p: P, id: string): P {
  const o = findObject(p, id);
  if (!o || o.locked) return p;
  const key = LIST_OF[o.kind];
  return { ...p, [key]: (p[key] as any[]).filter((x) => x.id !== id) };
}

/** Copy placed slightly down-right, on top. */
export function duplicateObject<P extends PdfProject>(p: P, id: string): { project: P; newId: string | null } {
  const o = findObject(p, id);
  if (!o) return { project: p, newId: null };
  const copy = { ...o, id: newId(o.kind), x: o.x + 12, y: o.y + 12, locked: false } as OverlayObject;
  return { project: addObject(p, copy), newId: copy.id };
}

export type ArrangeOp = "front" | "forward" | "backward" | "back";

/** Changes an object's place in its page's stacking order. Other objects keep their relative order. */
export function arrange<P extends PdfProject>(p: P, id: string, op: ArrangeOp): P {
  const o = findObject(p, id);
  if (!o) return p;
  const stack = objectsOnPage(p, o.pageNumber);
  const i = stack.findIndex((x) => x.id === id);
  const target = op === "front" ? stack.length - 1 : op === "back" ? 0 : op === "forward" ? Math.min(stack.length - 1, i + 1) : Math.max(0, i - 1);
  if (target === i) return p;
  const moved = stack.slice();
  moved.splice(i, 1);
  moved.splice(target, 0, stack[i]!);
  // Renumber the page's stack 1…n so the order is explicit and gaps never collide.
  let next = p;
  moved.forEach((x, idx) => {
    if (x.z !== idx + 1) next = updateObject(next, x.id, { z: idx + 1 });
  });
  return next;
}

// ---------------------------------------------------------------- pages

/** Source PDF page shown by a page id (0 = blank). */
export function sourceOf(p: Pick<PdfProject, "pageSources">, pageId: number): number {
  return p.pageSources[pageId] ?? pageId;
}

function nextPageId(p: PdfProject): number {
  return Math.max(0, ...p.pageOrder, ...Object.keys(p.pageSources).map(Number)) + 1;
}

/** Moves a page one step up (-1) or down (+1) in the document. */
export function movePage<P extends PdfProject>(p: P, pageId: number, dir: -1 | 1): P {
  const i = p.pageOrder.indexOf(pageId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= p.pageOrder.length) return p;
  const order = p.pageOrder.slice();
  [order[i], order[j]] = [order[j]!, order[i]!];
  return { ...p, pageOrder: order };
}

/** Moves a page to an index (drag and drop in the page list). */
export function movePageTo<P extends PdfProject>(p: P, pageId: number, index: number): P {
  const i = p.pageOrder.indexOf(pageId);
  if (i < 0) return p;
  const order = p.pageOrder.slice();
  order.splice(i, 1);
  order.splice(Math.max(0, Math.min(order.length, index)), 0, pageId);
  return { ...p, pageOrder: order };
}

/** Inserts a copy of a page (with copies of its objects) right after it. */
export function duplicatePage<P extends PdfProject>(p: P, pageId: number): { project: P; pageId: number } {
  const id = nextPageId(p);
  const copyList = <T extends { pageNumber: number; id: string }>(list: T[], kind: string) =>
    list.filter((o) => o.pageNumber === pageId).map((o) => ({ ...o, id: newId(kind), pageNumber: id }));
  const order = p.pageOrder.slice();
  order.splice(order.indexOf(pageId) + 1, 0, id);
  return {
    pageId: id,
    project: {
      ...p,
      pageOrder: order,
      pageSources: { ...p.pageSources, [id]: sourceOf(p, pageId) },
      pageRotations: p.pageRotations[pageId] ? { ...p.pageRotations, [id]: p.pageRotations[pageId]! } : p.pageRotations,
      textEdits: [...p.textEdits, ...copyList(p.textEdits, "text")],
      whiteouts: [...p.whiteouts, ...copyList(p.whiteouts, "whiteout")],
      images: [...p.images, ...copyList(p.images, "image")],
      shapes: [...p.shapes, ...copyList(p.shapes, "shape")],
    },
  };
}

/** Inserts an empty page after `afterPageId` (or at the start when null). */
export function insertBlankPage<P extends PdfProject>(p: P, afterPageId: number | null): { project: P; pageId: number } {
  const id = nextPageId(p);
  const order = p.pageOrder.slice();
  order.splice(afterPageId == null ? 0 : order.indexOf(afterPageId) + 1, 0, id);
  return { pageId: id, project: { ...p, pageOrder: order, pageSources: { ...p.pageSources, [id]: 0 } } };
}

export function toggleDeletePage<P extends PdfProject>(p: P, pageId: number): P {
  const deleted = p.deletedPages.includes(pageId) ? p.deletedPages.filter((n) => n !== pageId) : [...p.deletedPages, pageId];
  return { ...p, deletedPages: deleted };
}

export function rotatePage<P extends PdfProject>(p: P, pageId: number): P {
  return { ...p, pageRotations: { ...p.pageRotations, [pageId]: (((p.pageRotations[pageId] ?? 0) + 90) % 360) } };
}

/** Pages of the finished PDF, in order: which page id, what it shows, how it is turned. */
export function exportPlan(p: Pick<PdfProject, "pageOrder" | "deletedPages" | "pageSources" | "pageRotations">, sourcePageCount: number) {
  return p.pageOrder
    .filter((id) => !p.deletedPages.includes(id))
    .map((id) => ({ pageId: id, source: sourceOf(p, id), rotation: p.pageRotations[id] ?? 0 }))
    .filter((e) => e.source === 0 || (e.source >= 1 && e.source <= sourcePageCount));
}

/** Stable text for "did anything change?" checks (history, autosave). */
export function projectFingerprint(p: PdfProject): string {
  return JSON.stringify(p);
}
