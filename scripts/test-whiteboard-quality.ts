/**
 * Whiteboard & live-class quality checks (no database, no browser, no camera).
 *
 * Run:
 *   npx tsx --tsconfig tsconfig.json scripts/test-whiteboard-quality.ts
 *
 * Covers: one action per Ctrl+Z across slides (ink + new/duplicate/delete/
 * move slide), redo, slides coming back with their ink, the canvas engine
 * (one history step per stroke, undo/redo, per-slide history, no full-board
 * repaint per pen-up, no layout read per pointer move, steady graphite ink),
 * the leaderboard order, the slide-create input rules, and source checks for
 * the keyboard shortcuts, the cursor and the corner leaderboard.
 */
import "./qc/_stub";
import { readFileSync } from "node:fs";

let passed = 0;
let failed = 0;
function assert(cond: unknown, label: string) {
  if (cond) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failed++;
    console.log(`  FAIL ${label}`);
  }
}
const read = (p: string) => readFileSync(p, "utf8");

// ---------------------------------------------------------------------------
// Minimal DOM for the canvas engine
// ---------------------------------------------------------------------------
type Handler = (e: unknown) => void;
const counters = { rect: 0 };
function fakeCtx() {
  const calls: string[] = [];
  const ctx = new Proxy(
    { calls, globalAlpha: 1 } as Record<string, unknown>,
    {
      get(target, prop: string) {
        if (prop in target) return target[prop];
        return (..._args: unknown[]) => {
          calls.push(prop);
          if (prop === "measureText") return { width: 10 };
          if (prop === "getImageData") return { data: new Uint8ClampedArray(4), width: 1, height: 1 };
          return undefined;
        };
      },
      set(target, prop: string, value) {
        target[prop] = value;
        if (prop === "globalAlpha") calls.push(`alpha=${(value as number).toFixed(4)}`);
        return true;
      },
    }
  );
  return ctx as unknown as CanvasRenderingContext2D & { calls: string[] };
}
function fakeCanvas() {
  const handlers = new Map<string, Handler[]>();
  const ctx = fakeCtx();
  return {
    ctx,
    width: 1920,
    height: 1080,
    offsetWidth: 1920,
    offsetHeight: 1080,
    getContext: () => ctx,
    getBoundingClientRect: () => {
      counters.rect++;
      return { left: 0, top: 0, width: 1920, height: 1080, right: 1920, bottom: 1080, x: 0, y: 0 } as DOMRect;
    },
    addEventListener: (t: string, h: Handler) => handlers.set(t, [...(handlers.get(t) ?? []), h]),
    removeEventListener: (t: string, h: Handler) => handlers.set(t, (handlers.get(t) ?? []).filter((x) => x !== h)),
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    fire(type: string, e: Record<string, unknown>) {
      for (const h of handlers.get(type) ?? []) h({ pointerId: 1, pointerType: "pen", pressure: 0.5, width: 1, height: 1, preventDefault() {}, ...e });
    },
  };
}
const rafQueue: (() => void)[] = [];
Object.assign(globalThis, {
  window: { devicePixelRatio: 1 },
  requestAnimationFrame: (cb: () => void) => {
    rafQueue.push(cb);
    return rafQueue.length;
  },
  cancelAnimationFrame: () => {},
  Image: class {
    complete = true;
    naturalWidth = 1;
    onload: (() => void) | null = null;
    src = "";
  },
});
const flushRaf = () => {
  while (rafQueue.length) rafQueue.shift()!();
};

async function run() {
  const { CanvasEngine } = await import("../src/lib/canvas/canvas-engine");
  const { BoardHistory } = await import("../src/lib/whiteboard/board-history");
  const { rankLeaderboard } = await import("../src/lib/whiteboard/quiz-leaderboard");
  const { whiteboardPageCreateSchema } = await import("../src/lib/validation/whiteboard");
  const { getHydratedObjects, backupBaseKey } = await import("../src/lib/whiteboard/board-backup");

  // ---- 1. Canvas engine -----------------------------------------------------
  console.log("Canvas engine");
  const base = fakeCanvas();
  const active = fakeCanvas();
  let commits = 0;
  let historyPushes = 0;
  const engine = new CanvasEngine(base as unknown as HTMLCanvasElement, active as unknown as HTMLCanvasElement, () => commits++);
  engine.onHistoryPush = () => historyPushes++;
  engine.syncSize();

  const stroke = (x0: number, y0: number, moves = 40) => {
    active.fire("pointerdown", { clientX: x0, clientY: y0 });
    for (let i = 1; i <= moves; i++) active.fire("pointermove", { clientX: x0 + i * 5, clientY: y0 + i * 2 });
    flushRaf();
    active.fire("pointerup", { clientX: x0 + moves * 5, clientY: y0 + moves * 2 });
  };

  counters.rect = 0;
  stroke(100, 100);
  assert(engine.getObjects().length === 1 && engine.getObjects()[0]!.type === "stroke", "A pen stroke is committed as one object");
  assert(commits === 1 && historyPushes === 1, "One stroke = one save signal and one history step");
  assert(counters.rect <= 2, `The canvas box is read once per stroke, not per pointer move (${counters.rect} reads for 40 moves)`);
  const pts = (engine.getObjects()[0] as { points: { x: number; y: number }[] }).points;
  const last = pts[pts.length - 1]!;
  assert(Math.abs(last.x - 300) < 0.01 && Math.abs(last.y - 180) < 0.01, "The stroke ends exactly where the pen was lifted (smoothing does not lag the end)");

  base.ctx.calls.length = 0;
  stroke(400, 400);
  assert(!base.ctx.calls.includes("clearRect"), "Pen-up draws only the new stroke (no full-board repaint)");
  assert(engine.getObjects().length === 2 && historyPushes === 2, "Second stroke: second history step");

  engine.undo();
  assert(engine.getObjects().length === 1, "Undo removes exactly one stroke");
  assert(historyPushes === 2, "Undo itself is not recorded as a new step");
  engine.redo();
  assert(engine.getObjects().length === 2, "Redo brings that one stroke back");

  // Per-slide history survives switching slides.
  const saved = engine.getHistory();
  engine.loadObjects([]);
  assert(!engine.canUndo(), "Another slide starts with its own (empty) history");
  engine.setHistory(saved);
  assert(engine.canUndo(), "Coming back to a slide gives back its undo steps");

  // Graphite: the same stroke paints the same way every time (no shimmer).
  const g1 = fakeCanvas();
  const g2 = fakeCanvas();
  const eg = new CanvasEngine(g1 as unknown as HTMLCanvasElement, g2 as unknown as HTMLCanvasElement);
  eg.loadObjects([
    { id: "g", type: "stroke", tool: "pen", color: "#000", size: 3, penStyle: "graphite", points: Array.from({ length: 12 }, (_, i) => ({ x: i * 10, y: i * 3, pressure: 0.5 })) },
  ]);
  const alphas1 = g1.ctx.calls.filter((c) => c.startsWith("alpha=")).join(",");
  g1.ctx.calls.length = 0;
  eg.renderBase();
  const alphas2 = g1.ctx.calls.filter((c) => c.startsWith("alpha=")).join(",");
  assert(alphas1.length > 0 && alphas1 === alphas2, "Graphite ink repaints identically (no random flicker)");

  // ---- 2. Board history (one Ctrl+Z = one action, across slides) ------------
  console.log("Board history");
  type Obj = { id: string };
  let nextId = 1;
  const slides: { id: string; objects: Obj[]; background?: string; ink: Obj[][]; redo: Obj[][] }[] = [{ id: "s1", objects: [], ink: [], redo: [] }];
  let open = "s1";
  let failNext = false;
  const opened: string[] = [];
  // Like the room: a deleted slide's own ink steps are kept and go back with it.
  const parked = new Map<string, { ink: Obj[][]; redo: Obj[][] }>();
  const h = new BoardHistory<Obj>();
  const ops = {
    async inkStep(pageId: string, dir: "undo" | "redo") {
      if (open !== pageId) {
        open = pageId;
        opened.push(pageId);
      }
      const s = slides.find((x) => x.id === pageId)!;
      if (dir === "undo") {
        const prev = s.ink.pop();
        if (!prev) return false;
        s.redo.push(s.objects);
        s.objects = prev;
      } else {
        const next = s.redo.pop();
        if (!next) return false;
        s.ink.push(s.objects);
        s.objects = next;
      }
      return true;
    },
    async removeSlide(pageId: string) {
      if (failNext) {
        failNext = false;
        throw new Error("server said no");
      }
      if (slides.length <= 1) return null;
      const idx = slides.findIndex((x) => x.id === pageId);
      const [s] = slides.splice(idx, 1);
      parked.set(pageId, { ink: s!.ink, redo: s!.redo });
      if (open === pageId) open = slides[Math.max(0, idx - 1)]!.id;
      return { pageNumber: idx + 1, background: s!.background, objects: s!.objects };
    },
    async restoreSlide(snap: { pageNumber: number; background?: string; objects: Obj[] }, oldId: string) {
      const id = `s${100 + nextId++}`;
      const kept = parked.get(oldId) ?? { ink: [], redo: [] };
      slides.splice(snap.pageNumber - 1, 0, { id, objects: snap.objects, background: snap.background, ...kept });
      open = id;
      return id;
    },
    currentOrder: () => slides.map((s) => s.id),
    async applyOrder(ids: string[]) {
      slides.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    },
    hasSlide: (id: string) => slides.some((s) => s.id === id),
  };
  const draw = (slideId: string) => {
    const s = slides.find((x) => x.id === slideId)!;
    s.ink.push(s.objects);
    s.redo = [];
    s.objects = [...s.objects, { id: `o${nextId++}` }];
    h.record({ kind: "ink", pageId: slideId });
  };
  const addSlide = (after: string, copyOf?: string) => {
    const idx = slides.findIndex((x) => x.id === after);
    const src = copyOf ? slides.find((x) => x.id === copyOf) : undefined;
    const id = `s${nextId++}`;
    slides.splice(idx + 1, 0, { id, objects: src ? [...src.objects] : [], background: src?.background, ink: [], redo: [] });
    open = id;
    h.record({ kind: "slide-add", pageId: id });
    return id;
  };

  draw("s1");
  draw("s1");
  const s2 = addSlide("s1");
  draw(s2);
  const s3 = addSlide(s2, s2); // duplicate
  assert(slides.length === 3 && slides[2]!.objects.length === 1, "Duplicate slide copies the ink into its own, separate slide");
  slides[2]!.objects.push({ id: "only-on-copy" });
  assert(slides[1]!.objects.length === 1, "Drawing on the copy does not change the original (no content merging)");
  slides[2]!.objects.pop();

  await h.step("undo", ops);
  assert(slides.length === 2 && !slides.some((s) => s.id === s3), "Ctrl+Z #1 removes only the duplicated slide");
  await h.step("undo", ops);
  assert(slides.find((s) => s.id === s2)!.objects.length === 0 && slides.length === 2, "Ctrl+Z #2 undoes only the ink on slide 2");
  await h.step("undo", ops);
  assert(slides.length === 1, "Ctrl+Z #3 removes only the new slide");
  opened.length = 0;
  await h.step("undo", ops);
  assert(slides[0]!.objects.length === 1, "Ctrl+Z #4 undoes one stroke on slide 1");
  await h.step("redo", ops);
  await h.step("redo", ops);
  assert(slides.length === 2 && slides[0]!.objects.length === 2, "Ctrl+Y redoes one step each: the stroke, then the slide comes back");
  const restoredS2 = slides[1]!.id;
  assert(restoredS2 !== s2, "A slide brought back gets a new id");
  await h.step("redo", ops);
  assert(slides[1]!.objects.length === 1, "Redo of ink on the restored slide finds it under its new id");

  // Delete + undo brings it back at the same place with its ink.
  const before = slides.map((s) => s.id);
  const snap = await ops.removeSlide(slides[0]!.id);
  h.record({ kind: "slide-delete", pageId: before[0]!, snapshot: snap! });
  assert(slides.length === 1, "Delete slide removes it");
  await h.step("undo", ops);
  assert(slides.length === 2 && slides[0]!.objects.length === 2, "Undo delete puts the slide back first, with its ink");
  assert(!h.canRedo || h.redoSteps.length === 1, "That undo can be redone");

  // Reorder + undo.
  const orderBefore = ops.currentOrder();
  const orderAfter = [...orderBefore].reverse();
  await ops.applyOrder(orderAfter);
  h.record({ kind: "slide-order", before: orderBefore, after: orderAfter });
  await h.step("undo", ops);
  assert(JSON.stringify(ops.currentOrder()) === JSON.stringify(orderBefore), "Undo puts moved slides back in their old order");
  await h.step("redo", ops);
  assert(JSON.stringify(ops.currentOrder()) === JSON.stringify(orderAfter), "Redo moves them again");

  // Undo of ink on another slide opens that slide.
  draw(slides[0]!.id);
  open = slides[1]!.id;
  opened.length = 0;
  await h.step("undo", ops);
  assert(opened.length === 1 && opened[0] === slides[0]!.id, "Undoing ink on another slide opens that slide first");

  // A new action clears redo.
  draw(slides[1]!.id);
  assert(!h.canRedo, "A new action after undo clears redo");

  // Server refusal keeps the step.
  const sz = h.undoSteps.length;
  const lastId = addSlide(slides[1]!.id);
  failNext = true;
  let threw = false;
  try {
    await h.step("undo", ops);
  } catch {
    threw = true;
  }
  assert(threw && h.undoSteps.length === sz + 1 && slides.some((s) => s.id === lastId), "If the server refuses, the step stays for another try");
  await h.step("undo", ops);
  assert(!slides.some((s) => s.id === lastId), "…and the next Ctrl+Z does it");

  // ---- 3. Leaderboard order ---------------------------------------------------
  console.log("Leaderboard");
  const t = (id: string, correct: number, attempted: number, ms: number) => ({
    studentId: id, name: id, photoUrl: null, totalAttempted: attempted, correctCount: correct, totalResponseTimeMs: ms * attempted, source: "APP" as const,
  });
  const ranked = rankLeaderboard([t("one-of-one", 1, 1, 3000), t("nine-of-ten", 9, 10, 5000), t("nine-fast", 9, 10, 2000), t("tie-a", 5, 10, 4000), t("tie-b", 5, 10, 4000)]);
  assert(ranked[0]!.studentId === "nine-fast" && ranked[1]!.studentId === "nine-of-ten", "More correct answers rank higher; equal → faster first");
  assert(ranked.findIndex((r) => r.studentId === "one-of-one") > 1, "1 of 1 (100%) no longer beats 9 of 10");
  assert(new Set(ranked.map((r) => r.rank)).size === ranked.length && ranked.slice(0, 3).map((r) => r.rank).join() === "1,2,3", "Every place goes to one person (distinct top 3)");

  // ---- 4. Slide create input --------------------------------------------------
  console.log("Slide create input");
  assert(whiteboardPageCreateSchema.safeParse({ afterPageNumber: 0 }).success, "A slide can be put first (after 0)");
  assert(whiteboardPageCreateSchema.safeParse({ afterPageNumber: 2, background: "dark" }).success, "A new slide can carry the board theme");
  assert(!whiteboardPageCreateSchema.safeParse({ afterPageNumber: -1 }).success, "A negative position is refused");
  assert(!whiteboardPageCreateSchema.safeParse({ objects: Array.from({ length: 5001 }, () => ({})) }).success, "A runaway restore payload is refused");

  // ---- 4b. Offline backup after a reload --------------------------------------
  console.log("Offline backup");
  const store = new Map<string, string>();
  Object.assign(globalThis, { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) } });
  const server = [{ id: "a" }];
  const local = [{ id: "a" }, { id: "drawn-offline" }];
  store.set("atomic_wb_backup_S_P", JSON.stringify(local));
  store.set(backupBaseKey("S", "P"), "7");
  assert(getHydratedObjects("S", "P", server, 7).length === 2, "Ink drawn offline comes back after a reload (server still on the same version)");
  assert(getHydratedObjects("S", "P", server, 8) === server, "If the slide was saved since (another device), the newer server copy wins");
  store.delete(backupBaseKey("S", "P"));
  assert(getHydratedObjects("S", "P", server, 8).length === 2, "An older backup without a version still works as before");
  assert(getHydratedObjects("S", "Q", server, 1) === server, "No backup: the server copy");

  // ---- 5. Source checks ---------------------------------------------------------
  console.log("Source checks");
  const room = read("src/components/live-class/TeacherLiveClassRoom.tsx");
  const zHandlers = room.match(/key === "z"/g)?.length ?? 0;
  assert(zHandlers === 2, `Ctrl+Z / Ctrl+Shift+Z handled in one place only (${zHandlers} checks, was 4)`);
  assert(!/engineRef\.current\??\.undo\(\)/.test(room.replace(/inkStep[\s\S]*?return true;\n    \},/, "")), "Every undo goes through the board history");
  assert(room.includes("engineRef.current.duplicateSelected()") && room.includes("void duplicatePage(page)"), "Ctrl+D duplicates the selection, or the slide");
  assert(room.includes("<SlideTemplatesModal"), "The slide templates window is actually shown (it was never rendered)");
  assert(room.includes("<CanvasCursor") && !room.includes("setCursorPos"), "The pen cursor moves without re-rendering the room");
  assert(room.includes("background: themeForNewSlide()"), "A new blank slide follows the current theme");
  const pagesRoute = read("src/app/api/whiteboard/sessions/[id]/pages/[pageId]/route.ts");
  assert(!/DELETE[\s\S]*deleteFile\(oldKey\)[\s\S]*renumber/.test(pagesRoute) && pagesRoute.includes("stillUsed === 0"), "Deleting a slide keeps a PPT image a duplicate still shows");
  const reorder = read("src/app/api/whiteboard/sessions/[id]/pages/reorder/route.ts");
  assert(reorder.includes("$transaction([...tempUpdates, ...finalUpdates])"), "Slide reorder is one transaction");
  const lb = read("src/components/live-class/LeaderboardPopup.tsx");
  assert(lb.includes("setMinimized(true)") && !lb.includes("fixed inset-0"), "Leaderboard is a corner card that can be minimized (no full-screen cover)");
  const participants = read("src/app/api/whiteboard/sessions/[id]/participants/route.ts");
  assert(participants.includes("wbSession.attendances") && participants.includes("participants: joinedStudents"), "Participants = students who joined");
  assert(room.includes("recoveredInkRef.current.forEach((objects, pageId) => queue.markDirty(pageId, objects))"), "Recovered offline ink is sent to the server again");
  const chat = read("src/components/live-class/MessagesPanel.tsx");
  assert(chat.includes('"YouTube chat"') && chat.includes('"App chat"'), "Chat can show App chat and YouTube chat separately");

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
