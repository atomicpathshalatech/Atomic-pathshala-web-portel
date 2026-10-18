import type { DesignGraphic } from "./model";
import { designId } from "./presets";

/**
 * Operations on a page template's graphics (cover / master page). Pure
 * functions; a group is a set of graphics sharing a groupId and is selected,
 * moved, aligned and locked as one.
 */

export type Box = { x: number; y: number; w: number; h: number };

export const boundsOf = (gs: Box[]): Box => {
  const x = Math.min(...gs.map((g) => g.x));
  const y = Math.min(...gs.map((g) => g.y));
  return { x, y, w: Math.max(...gs.map((g) => g.x + g.w)) - x, h: Math.max(...gs.map((g) => g.y + g.h)) - y };
};

/** Clicking one member of a group selects the whole group. */
export function expandToGroups(all: DesignGraphic[], ids: string[]): string[] {
  const groups = new Set(all.filter((g) => ids.includes(g.id) && g.groupId).map((g) => g.groupId));
  return all.filter((g) => ids.includes(g.id) || (g.groupId && groups.has(g.groupId))).map((g) => g.id);
}

const update = (all: DesignGraphic[], ids: string[], fn: (g: DesignGraphic) => DesignGraphic) => all.map((g) => (ids.includes(g.id) && !g.locked ? fn(g) : g));

export function moveBy(all: DesignGraphic[], ids: string[], dx: number, dy: number) {
  return update(all, ids, (g) => ({ ...g, x: round(g.x + dx), y: round(g.y + dy) }));
}

const round = (v: number) => Math.round(v * 10) / 10;

export type AlignOp = "left" | "hcenter" | "right" | "top" | "vmiddle" | "bottom";

/**
 * Align: several objects (or groups) line up with each other; a single one
 * lines up with the page. Groups move as a unit.
 */
export function align(all: DesignGraphic[], ids: string[], op: AlignOp, page: { w: number; h: number }) {
  const sel = all.filter((g) => ids.includes(g.id) && !g.locked);
  if (!sel.length) return all;
  const units = unitsOf(sel);
  const ref = units.length > 1 ? boundsOf(sel) : { x: 0, y: 0, w: page.w, h: page.h };
  let next = all;
  for (const u of units) {
    const b = boundsOf(u);
    const dx = op === "left" ? ref.x - b.x : op === "right" ? ref.x + ref.w - (b.x + b.w) : op === "hcenter" ? ref.x + ref.w / 2 - (b.x + b.w / 2) : 0;
    const dy = op === "top" ? ref.y - b.y : op === "bottom" ? ref.y + ref.h - (b.y + b.h) : op === "vmiddle" ? ref.y + ref.h / 2 - (b.y + b.h / 2) : 0;
    next = moveBy(next, u.map((g) => g.id), dx, dy);
  }
  return next;
}

/** Equal gaps between three or more objects/groups, keeping the outer two in place. */
export function distribute(all: DesignGraphic[], ids: string[], axis: "h" | "v") {
  const units = unitsOf(all.filter((g) => ids.includes(g.id) && !g.locked)).map((u) => ({ u, b: boundsOf(u) }));
  if (units.length < 3) return all;
  units.sort((a, b) => (axis === "h" ? a.b.x - b.b.x : a.b.y - b.b.y));
  const first = units[0]!.b;
  const last = units[units.length - 1]!.b;
  const span = axis === "h" ? last.x + last.w - first.x : last.y + last.h - first.y;
  const sizes = units.reduce((n, x) => n + (axis === "h" ? x.b.w : x.b.h), 0);
  const gap = (span - sizes) / (units.length - 1);
  let pos = axis === "h" ? first.x : first.y;
  let next = all;
  for (const { u, b } of units) {
    const d = pos - (axis === "h" ? b.x : b.y);
    next = moveBy(next, u.map((g) => g.id), axis === "h" ? d : 0, axis === "v" ? d : 0);
    pos += (axis === "h" ? b.w : b.h) + gap;
  }
  return next;
}

/** Selected graphics split into units: a group counts as one. */
function unitsOf(sel: DesignGraphic[]): DesignGraphic[][] {
  const byGroup = new Map<string, DesignGraphic[]>();
  const out: DesignGraphic[][] = [];
  for (const g of sel) {
    if (g.groupId) {
      if (!byGroup.has(g.groupId)) {
        byGroup.set(g.groupId, []);
        out.push(byGroup.get(g.groupId)!);
      }
      byGroup.get(g.groupId)!.push(g);
    } else out.push([g]);
  }
  return out;
}

export function group(all: DesignGraphic[], ids: string[]): { graphics: DesignGraphic[]; groupId: string | null } {
  if (ids.length < 2) return { graphics: all, groupId: null };
  const gid = designId("grp");
  return { graphics: all.map((g) => (ids.includes(g.id) ? { ...g, groupId: gid } : g)), groupId: gid };
}

export function ungroup(all: DesignGraphic[], ids: string[]) {
  return all.map((g) => (ids.includes(g.id) ? { ...g, groupId: null } : g));
}

export function setLocked(all: DesignGraphic[], ids: string[], locked: boolean) {
  return all.map((g) => (ids.includes(g.id) ? { ...g, locked } : g));
}

export function duplicate(all: DesignGraphic[], ids: string[]): { graphics: DesignGraphic[]; newIds: string[] } {
  const top = Math.max(0, ...all.map((g) => g.z));
  const groups = new Map<string, string>();
  const copies = all
    .filter((g) => ids.includes(g.id))
    .map((g, i) => ({ ...g, id: designId("g"), x: round(g.x + 5), y: round(g.y + 5), z: top + 1 + i, locked: false, groupId: g.groupId ? (groups.get(g.groupId) ?? (groups.set(g.groupId, designId("grp")), groups.get(g.groupId)!)) : null }));
  return { graphics: [...all, ...copies], newIds: copies.map((c) => c.id) };
}

export function remove(all: DesignGraphic[], ids: string[]) {
  return all.filter((g) => !ids.includes(g.id) || g.locked);
}

/**
 * Stacking inside a layer: graphics behind the text (z < 0) and in front of it
 * (z >= 0) are two layers; front/forward/backward/back reorder within the
 * selection's own layer (setBehindText moves between layers).
 */
export function arrange(all: DesignGraphic[], ids: string[], op: "front" | "forward" | "backward" | "back") {
  const layer = (behind: boolean) => {
    const sorted = all.filter((g) => (g.z < 0) === behind).sort((a, b) => a.z - b.z);
    const isSel = (g: DesignGraphic) => ids.includes(g.id);
    let order = sorted.slice();
    if (op === "front") order = [...sorted.filter((g) => !isSel(g)), ...sorted.filter(isSel)];
    else if (op === "back") order = [...sorted.filter(isSel), ...sorted.filter((g) => !isSel(g))];
    else if (op === "forward") {
      for (let i = order.length - 2; i >= 0; i--) if (isSel(order[i]!) && !isSel(order[i + 1]!)) [order[i], order[i + 1]] = [order[i + 1]!, order[i]!];
    } else {
      for (let i = 1; i < order.length; i++) if (isSel(order[i]!) && !isSel(order[i - 1]!)) [order[i], order[i - 1]] = [order[i - 1]!, order[i]!];
    }
    return order.map((g, i) => ({ ...g, z: behind ? i - order.length : i }));
  };
  const next = [...layer(true), ...layer(false)];
  return all.map((g) => next.find((n) => n.id === g.id)!);
}

export function setBehindText(all: DesignGraphic[], ids: string[], behind: boolean) {
  const min = Math.min(0, ...all.map((g) => g.z));
  const max = Math.max(0, ...all.map((g) => g.z));
  return all.map((g) => (ids.includes(g.id) ? { ...g, z: behind ? (g.z < 0 ? g.z : min - 1) : g.z >= 0 ? g.z : max + 1 } : g));
}
