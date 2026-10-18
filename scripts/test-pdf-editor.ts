/**
 * PDF editor ("Original PDF" mode): document model + exported PDF.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/test-pdf-editor.ts
 *
 * No database. The exported PDFs are rendered with pdf.js and the pixels / text
 * positions are compared with what the editor shows. The Hindi cases need a
 * local Chrome/Edge and internet (the Hindi web font), as the server does.
 * HINDI_PNG=dir writes the rendered Hindi pages there for a look.
 */
import Module from "node:module";
const origResolve = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (req: string, ...a: any[]) {
  if (req === "server-only") return require("node:path").join(__dirname, "fixtures/empty-module.cjs");
  return origResolve.call(this, req, ...a);
};
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  normalizeProject,
  addObject,
  arrange,
  objectsOnPage,
  duplicateObject,
  removeObject,
  updateObject,
  movePage,
  movePageTo,
  duplicatePage,
  insertBlankPage,
  toggleDeletePage,
  rotatePage,
  exportPlan,
  placeNewObjects,
  type PdfProject,
} from "../src/lib/module-editor/overlay-model";
import { processNativePdfEdits, TEXT_PAD, TEXT_LINE_HEIGHT } from "../src/lib/module-editor/native-pdf-engine";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

const DEFAULTS = { background: {}, headerFooter: {} as any, watermark: {} as any, coverPage: {} as any };
const empty = (pages: number): PdfProject => normalizeProject({}, pages, DEFAULTS);

async function sourcePdf(pages: number, rotate = 0): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) {
    const p = doc.addPage([595, 842]);
    p.drawText(`SOURCE PAGE ${i}`, { x: 40, y: 800, size: 14, font });
    // a grey band where an "old header" sits
    p.drawRectangle({ x: 0, y: 772, width: 595, height: 70, color: rgb(0.6, 0.6, 0.6) });
    if (rotate) p.setRotation({ type: "degrees", angle: rotate } as any);
  }
  return Buffer.from(await doc.save());
}

let pdfjs: any;
async function render(bytes: Uint8Array, pageNo: number) {
  pdfjs ??= await import(pathToFileURL(path.join(__dirname, "../node_modules/pdfjs-dist/legacy/build/pdf.mjs")).href);
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), disableFontFace: true, verbosity: 0, standardFontDataUrl: path.join(__dirname, "../node_modules/pdfjs-dist/standard_fonts") + path.sep }).promise;
  const page = await doc.getPage(pageNo);
  const viewport = page.getViewport({ scale: 1 });
  // pdf.js (Node build) draws with @napi-rs/canvas through the document's own canvas factory.
  const factory = (doc as any).canvasFactory;
  const { canvas, context: ctx } = factory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  const text = await page.getTextContent();
  const items = (text.items as any[]).filter((i) => i.str?.trim()).map((i) => {
    const [x, y] = viewport.convertToViewportPoint(i.transform[4], i.transform[5]);
    return { str: i.str as string, x, y };
  });
  const px = (x: number, y: number) => {
    const d = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
    return [d[0]!, d[1]!, d[2]!];
  };
  const dark = (x: number, y: number, w: number, h: number) => {
    // share of clearly dark pixels inside a box (text strokes)
    const d = ctx.getImageData(Math.round(x), Math.round(y), Math.round(w), Math.round(h)).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i]! < 90 && d[i + 1]! < 90 && d[i + 2]! < 90) n++;
    return n / (d.length / 4);
  };
  const ink = (x: number, y: number, w: number, h: number) => {
    // share of pixels that are not white (any colour of text)
    const d = ctx.getImageData(Math.round(x), Math.round(y), Math.round(w), Math.round(h)).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i]! < 200 || d[i + 1]! < 200 || d[i + 2]! < 200) n++;
    return n / (d.length / 4);
  };
  const png = () => canvas.toBuffer("image/png") as Buffer;
  const out = { width: viewport.width, height: viewport.height, items, px, dark, ink, png, pages: doc.numPages };
  await doc.destroy();
  return out;
}

(async () => {
  // ------------------------------------------------------------ model
  {
    // An old save: no z. It must keep printing as before (whiteout under text under image under shape).
    const legacy = normalizeProject(
      {
        textEdits: [{ id: "t1", pageNumber: 1, x: 10, y: 10, width: 100, height: 20, newText: "a", fontSize: 10 }],
        whiteouts: [{ id: "w1", pageNumber: 1, x: 0, y: 0, width: 595, height: 60 }],
        images: [{ id: "i1", pageNumber: 1, x: 0, y: 0, width: 10, height: 10 }],
        shapes: [{ id: "s1", pageNumber: 1, type: "rect", x: 0, y: 0, width: 10, height: 10 }],
      } as any,
      3,
      DEFAULTS
    );
    check("old saves: stacking order kept (whiteout < text < image < shape)", objectsOnPage(legacy, 1).map((o) => o.id).join(",") === "w1,t1,i1,s1");
    check("old saves: every source page in the page list", legacy.pageOrder.join(",") === "1,2,3");

    // THE layering bug: remove the old header (whiteout), then add text there → text must be on top.
    let p = empty(2);
    p = addObject(p, { kind: "whiteout", id: "hdr", pageNumber: 1, x: 0, y: 0, width: 595, height: 70 });
    p = addObject(p, { kind: "text", id: "new", pageNumber: 1, x: 40, y: 20, width: 200, height: 20, newText: "New header", fontSize: 12 });
    let stack = objectsOnPage(p, 1).map((o) => o.id);
    check("text added after a whiteout is above it", stack.join(",") === "hdr,new", stack.join(","));
    // Any tool or dialog that appends an object without a stacking position still lands on top.
    const appended = placeNewObjects({ ...p, textEdits: [...p.textEdits, { id: "dlg", pageNumber: 1, x: 0, y: 0, width: 10, height: 10, newText: "d", fontSize: 10 }] } as PdfProject);
    check("an object added without z (dialogs, search & replace) goes on top", objectsOnPage(appended, 1).pop()!.id === "dlg");
    check("nothing to fix → same object back (no extra re-render)", placeNewObjects(appended) === appended);
    const twins = placeNewObjects({ ...p, whiteouts: [...p.whiteouts, { ...p.whiteouts[0]! }] } as PdfProject);
    check("a repeated id is replaced", new Set(twins.whiteouts.map((w) => w.id)).size === twins.whiteouts.length);
    // …and still above a whiteout that is moved/edited later (editing must not change the order)
    p = updateObject(p, "hdr", { height: 90 });
    check("editing an object does not change the stacking order", objectsOnPage(p, 1).map((o) => o.id).join(",") === "hdr,new");

    p = addObject(p, { kind: "image", id: "img", pageNumber: 1, x: 0, y: 0, width: 50, height: 50 });
    p = arrange(p, "img", "back");
    check("send to back", objectsOnPage(p, 1)[0]!.id === "img");
    p = arrange(p, "img", "forward");
    check("bring forward one step", objectsOnPage(p, 1).map((o) => o.id).join(",") === "hdr,img,new");
    p = arrange(p, "hdr", "front");
    check("bring to front", objectsOnPage(p, 1).map((o) => o.id).join(",") === "img,new,hdr");
    p = arrange(p, "hdr", "backward");
    check("send backward one step", objectsOnPage(p, 1).map((o) => o.id).join(",") === "img,hdr,new");
    check("z values are explicit and distinct", new Set(objectsOnPage(p, 1).map((o) => o.z)).size === 3);

    const d = duplicateObject(p, "new");
    const dup = objectsOnPage(d.project, 1);
    check("duplicate: new id, placed on top, offset", dup[dup.length - 1]!.id === d.newId && d.newId !== "new" && dup[dup.length - 1]!.x === 52);

    let locked = updateObject(p, "new", { locked: true });
    locked = removeObject(locked, "new");
    check("a locked object cannot be deleted", objectsOnPage(locked, 1).some((o) => o.id === "new"));
    check("other pages are not affected", objectsOnPage(p, 2).length === 0);

    // Pages
    let q = empty(3);
    q = addObject(q, { kind: "text", id: "on1", pageNumber: 1, x: 1, y: 1, width: 10, height: 10, newText: "x", fontSize: 10 });
    q = movePage(q, 1, 1);
    check("move page down", q.pageOrder.join(",") === "2,1,3");
    q = movePageTo(q, 3, 0);
    check("move page to a position", q.pageOrder.join(",") === "3,2,1");
    const dp = duplicatePage(q, 1);
    q = dp.project;
    check("duplicate page: new page id after the original, showing the same source page", q.pageOrder.join(",") === `3,2,1,${dp.pageId}` && q.pageSources[dp.pageId] === 1);
    check("duplicate page: its objects are copies with new ids", objectsOnPage(q, dp.pageId).length === 1 && objectsOnPage(q, dp.pageId)[0]!.id !== "on1");
    const bl = insertBlankPage(q, 3);
    q = bl.project;
    check("insert blank page", q.pageOrder[1] === bl.pageId && q.pageSources[bl.pageId] === 0);
    q = toggleDeletePage(q, 2);
    q = rotatePage(q, 3);
    const plan = exportPlan(q, 3);
    check("export plan: order, deletions, sources, rotation", plan.map((e) => `${e.pageId}:${e.source}:${e.rotation}`).join(" ") === `3:3:90 ${bl.pageId}:0:0 1:1:0 ${dp.pageId}:1:0`, plan.map((e) => `${e.pageId}:${e.source}:${e.rotation}`).join(" "));
    const reloaded = normalizeProject(JSON.parse(JSON.stringify(q)), 3, DEFAULTS);
    check("saved project reloads identically", JSON.stringify(reloaded) === JSON.stringify(q));
  }

  // ------------------------------------------------------------ exported PDF
  {
    const src = await sourcePdf(2);
    // Old header removed with a whiteout, new text on top of it.
    let p = empty(2);
    p = addObject(p, { kind: "whiteout", id: "w", pageNumber: 1, x: 0, y: 0, width: 595, height: 70, color: "#ffffff" });
    p = addObject(p, { kind: "text", id: "t", pageNumber: 1, x: 40, y: 20, width: 300, height: 24, newText: "NEW HEADER TEXT", fontSize: 16, hideOriginal: false });
    const out = await processNativePdfEdits({ originalPdfBuffer: src, ...p });
    const r = await render(out.pdfBytes, 1);
    const grey = r.px(500, 30);
    check("export: whiteout covers the old header", grey[0]! > 240 && grey[1]! > 240, `pixel ${grey.join(",")}`);
    check("export: text added on top of the whiteout is visible", r.dark(40, 20, 300, 24) > 0.03, `dark share ${r.dark(40, 20, 300, 24).toFixed(3)}`);
    const item = r.items.find((i) => i.str.includes("NEW HEADER"));
    const expectBaseline = 20 + TEXT_PAD + 16 * ((TEXT_LINE_HEIGHT - 1.117) / 2 + 0.905);
    check("export: text where the editor shows it (±1.5 pt)", !!item && Math.abs(item.x - (40 + TEXT_PAD)) < 1.5 && Math.abs(item.y - expectBaseline) < 1.5, item ? `x=${item.x.toFixed(1)} y=${item.y.toFixed(1)} expected y=${expectBaseline.toFixed(1)}` : "text missing");
    // A whiteout only covers: the old text is still in the file (copy / search finds it). The editor says so.
    check("export: whiteout is a cover, not a redaction (old text still in the file)", r.items.some((i) => i.str.includes("SOURCE PAGE 1")));

    // Reversed order: whiteout brought to front → hides the text, in the PDF too.
    const hidden = arrange(p, "w", "front");
    const r2 = await render((await processNativePdfEdits({ originalPdfBuffer: src, ...hidden })).pdfBytes, 1);
    check("export follows the stacking order (whiteout in front hides the text)", r2.dark(40, 20, 300, 24) < 0.005, `dark share ${r2.dark(40, 20, 300, 24).toFixed(3)}`);
  }

  {
    // Reordered pages: objects stay on their page.
    const src = await sourcePdf(3);
    let p = empty(3);
    p = addObject(p, { kind: "text", id: "a", pageNumber: 1, x: 40, y: 200, width: 300, height: 20, newText: "EDIT ON PAGE ONE", fontSize: 12 });
    p = addObject(p, { kind: "text", id: "b", pageNumber: 3, x: 40, y: 200, width: 300, height: 20, newText: "EDIT ON PAGE THREE", fontSize: 12 });
    p = movePageTo(p, 1, 2); // order 2,3,1
    p = toggleDeletePage(p, 2); // → 3,1
    const out = await processNativePdfEdits({ originalPdfBuffer: src, ...p });
    const r1 = await render(out.pdfBytes, 1);
    const r2 = await render(out.pdfBytes, 2);
    const t1 = r1.items.map((i) => i.str).join(" | ");
    const t2 = r2.items.map((i) => i.str).join(" | ");
    check("reorder + delete: page count", out.pageCount === 2, `${out.pageCount}`);
    check("reorder + delete: each edit is on its own page", /SOURCE PAGE 3/.test(t1) && /EDIT ON PAGE THREE/.test(t1) && /SOURCE PAGE 1/.test(t2) && /EDIT ON PAGE ONE/.test(t2), `p1: ${t1} || p2: ${t2}`);

    const dup = duplicatePage(p, 1);
    let q = updateObject(dup.project, objectsOnPage(dup.project, dup.pageId)[0]!.id, { newText: "EDIT ON THE COPY" });
    q = insertBlankPage(q, null).project;
    const out2 = await processNativePdfEdits({ originalPdfBuffer: src, ...q });
    const texts = await Promise.all([1, 2, 3, 4].map(async (n) => (await render(out2.pdfBytes, n)).items.map((i) => i.str).join(" ")));
    check("duplicate + blank page: pages and their own edits", out2.pageCount === 4 && texts[0] === "" && /EDIT ON PAGE THREE/.test(texts[1]!) && /EDIT ON PAGE ONE/.test(texts[2]!) && /SOURCE PAGE 1/.test(texts[3]!) && /EDIT ON THE COPY/.test(texts[3]!), texts.map((t, i) => `${i + 1}: ${t}`).join(" || "));
  }

  {
    // A turned page: the box is where the editor shows it on the turned page.
    const src = await sourcePdf(1);
    let p = empty(1);
    p = rotatePage(p, 1);
    // In the editor the turned page is 842 wide, 595 high.
    p = addObject(p, { kind: "text", id: "r", pageNumber: 1, x: 100, y: 300, width: 300, height: 20, newText: "TURNED PAGE TEXT", fontSize: 12 });
    p = addObject(p, { kind: "shape", id: "box", pageNumber: 1, type: "rect", x: 500, y: 100, width: 120, height: 60, fillColor: "#0000ff", opacity: 1 });
    const r = await render((await processNativePdfEdits({ originalPdfBuffer: src, ...p })).pdfBytes, 1);
    const item = r.items.find((i) => i.str.includes("TURNED"));
    const expectBaseline = 300 + TEXT_PAD + 12 * ((TEXT_LINE_HEIGHT - 1.117) / 2 + 0.905);
    check("rotated page: page shown turned", Math.round(r.width) === 842 && Math.round(r.height) === 595, `${r.width}x${r.height}`);
    check("rotated page: text upright at the editor position", !!item && Math.abs(item.x - 102) < 1.5 && Math.abs(item.y - expectBaseline) < 1.5, item ? `x=${item.x.toFixed(1)} y=${item.y.toFixed(1)}` : "missing");
    const blue = r.px(560, 130);
    check("rotated page: shape at the editor position", blue[2]! > 200 && blue[0]! < 60, `pixel ${blue.join(",")}`);
  }

  {
    // Shapes, picture turn, and honest warnings.
    const src = await sourcePdf(1);
    let p = empty(1);
    p = addObject(p, { kind: "shape", id: "hl", pageNumber: 1, type: "highlight", x: 40, y: 300, width: 200, height: 20, fillColor: "#ffff00", opacity: 0.5 });
    p = addObject(p, { kind: "shape", id: "ul", pageNumber: 1, type: "underline", x: 40, y: 400, width: 200, height: 10, strokeColor: "#ff0000", strokeWidth: 3 });
    p = addObject(p, { kind: "shape", id: "c", pageNumber: 1, type: "circle", x: 300, y: 300, width: 100, height: 60, strokeColor: "#00aa00", strokeWidth: 3 });
    p = addObject(p, { kind: "text", id: "hi", pageNumber: 1, x: 40, y: 500, width: 300, height: 20, newText: "Hindi: नमस्ते ok", fontSize: 12 });
    const out = await processNativePdfEdits({ originalPdfBuffer: src, ...p });
    const r = await render(out.pdfBytes, 1);
    const hl = r.px(140, 310);
    const ul = r.px(140, 409);
    const circleEdge = r.px(300.5, 330);
    check("highlight drawn (see-through yellow)", hl[0]! > 230 && hl[1]! > 230 && hl[2]! < 160, `pixel ${hl.join(",")}`);
    check("underline drawn along the bottom of its box", ul[0]! > 200 && ul[1]! < 80, `pixel ${ul.join(",")}`);
    check("ellipse drawn in its box", circleEdge[1]! - circleEdge[0]! > 60, `pixel ${circleEdge.join(",")}`);
    check("a text box with Hindi is written (shaped by the browser engine), and said so", out.warnings.some((w) => /full Hindi shaping/.test(w)) && !out.warnings.some((w) => /left blank/.test(w)) && r.ink(40, 500, 300, 20) > 0.03, out.warnings.join(" | "));
  }

  {
    // Hindi: joined letters and matras, bold, centred, wrapping, on a plain and on a turned page; English boxes unchanged.
    const src = await sourcePdf(2);
    let p = empty(2);
    p = rotatePage(p, 2);
    const hindi = "परमाणु की संरचना — Atomic structure (क्ष, त्र, ज्ञ, श्र, द्ध)";
    p = addObject(p, { kind: "text", id: "h1", pageNumber: 1, x: 60, y: 120, width: 300, height: 60, newText: hindi, fontSize: 16, isBold: true, align: "center", color: "#1d4ed8" });
    p = addObject(p, { kind: "text", id: "e1", pageNumber: 1, x: 60, y: 300, width: 300, height: 20, newText: "Plain English stays real text", fontSize: 12 });
    p = addObject(p, { kind: "text", id: "h2", pageNumber: 2, x: 60, y: 60, width: 260, height: 40, newText: "मोल संकल्पना", fontSize: 18 });
    const t0 = Date.now();
    const out = await processNativePdfEdits({ originalPdfBuffer: src, ...p });
    const ms = Date.now() - t0;
    const r1 = await render(out.pdfBytes, 1);
    const r2 = await render(out.pdfBytes, 2);
    const t1 = r1.items.map((i) => i.str).join(" ");
    check("Hindi boxes laid out, nothing left blank", out.warnings.some((w) => /2 text box\(es\) with Hindi/.test(w)) && !out.warnings.some((w) => /left blank/.test(w)), out.warnings.join(" | ") + ` (${ms} ms)`);
    check("Hindi box drawn inside its own box (ink inside, none just outside)", r1.ink(60, 120, 300, 60) > 0.02 && r1.ink(60, 184, 300, 30) === 0 && r1.ink(364, 120, 60, 60) === 0, `in=${r1.ink(60, 120, 300, 60).toFixed(3)} below=${r1.ink(60, 184, 300, 30)} right=${r1.ink(364, 120, 60, 60)}`);
    check("Hindi box colour kept (blue)", (() => { for (let y = 125; y < 175; y++) for (let x = 70; x < 350; x++) { const c = r1.px(x, y); if (c[2]! > 150 && c[0]! < 80) return true; } return false; })());
    check("English box still written as real text with the PDF font", /Plain English stays real text/.test(t1), t1.slice(0, 120));
    check("Hindi text is in the PDF text layer (searchable at least in part)", /[\u0900-\u097F]/.test(t1) && /Atomic structure/.test(t1), t1.slice(0, 160));
    check("Hindi on a turned page lands where the editor shows it", r2.ink(60, 60, 260, 40) > 0.02 && r2.ink(60, 104, 260, 40) === 0, `ink=${r2.ink(60, 60, 260, 40).toFixed(3)}`);
    check("output reopens with both pages", r1.pages === 2);
    if (process.env.HINDI_PNG) {
      const fs = await import("node:fs");
      fs.writeFileSync(path.join(process.env.HINDI_PNG, "hindi-p1.png"), r1.png());
      fs.writeFileSync(path.join(process.env.HINDI_PNG, "hindi-p2.png"), r2.png());
    }
  }

  {
    // Header/footer text must be real, readable text in the exported PDF (fonts embedded in the right document).
    const src = await sourcePdf(2);
    const p = { ...empty(2), headerFooter: { enabled: true, headerLeft: "ATOMIC PATHSHALA", headerCenter: "Chemistry", headerRight: "Faculty", footerLeft: "Footer note", footerRight: "Page {page} of {totalPages}", pageRange: "ALL" } as any };
    const out = await processNativePdfEdits({ originalPdfBuffer: src, ...p });
    const r = await render(out.pdfBytes, 2);
    const t = r.items.map((i) => i.str).join(" ");
    check("header and footer text readable on every page", /ATOMIC PATHSHALA/.test(t) && /Page 2 of 2/.test(t), t.slice(0, 160));
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
