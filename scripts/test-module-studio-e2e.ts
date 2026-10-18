/**
 * Module Studio end to end, over HTTP against a running server (local only).
 *
 *   E2E_BASE=http://localhost:3111 TEST_DATABASE_URL=postgresql://…localhost…/db \
 *   E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… npx tsx --tsconfig tsconfig.json scripts/test-module-studio-e2e.ts
 *
 * The server must use the same (local) database. Test PDFs are generated and
 * served by this script; uploaded-file storage (R2) is not needed except for
 * the final export, whose response is checked either way.
 */
import http from "node:http";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { PDFDocument, StandardFonts } from "pdf-lib";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { HttpSession } from "./lib/http-session";

const BASE = process.env.E2E_BASE ?? "http://localhost:3111";
const DB = process.env.TEST_DATABASE_URL ?? "";
if (!/localhost|127\.0\.0\.1/.test(DB) || !/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("Refusing to run: E2E_BASE and TEST_DATABASE_URL must be local.");
const prisma = new PrismaClient({ datasources: { db: { url: DB } } });

let passed = 0;
let failed = 0;
const results: string[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  ok ? passed++ : failed++;
  const line = `${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`;
  results.push(line);
  console.log(line);
};

// ---------------------------------------------------------------- fixtures
async function textPdf(pages: number, opts: { hindiNote?: boolean } = {}) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let q = 0;
  for (let i = 1; i <= pages; i++) {
    const p = doc.addPage([595, 842]);
    let y = 780;
    p.drawText(`Mole Concept - page ${i}`, { x: 40, y, size: 16, font });
    for (let k = 0; k < 4; k++) {
      q++;
      y -= 150;
      p.drawText(`${q}. How many moles are there in ${q * 4} g of NaOH (molar mass 40)?`, { x: 40, y, size: 11, font });
      p.drawText(`(1) ${q / 10}   (2) ${q / 5}   (3) ${q}   (4) ${q * 2}`, { x: 50, y: y - 18, size: 11, font });
      p.drawText(`Ans. (${(q % 4) + 1})`, { x: 50, y: y - 36, size: 11, font });
    }
  }
  return Buffer.from(await doc.save());
}

/** Page 1 text, page 2 a picture of text (scanned), page 3 text. */
async function mixedPdf() {
  const { createCanvas } = require("@napi-rs/canvas");
  const c = createCanvas(1190, 1684);
  const x = c.getContext("2d");
  x.fillStyle = "#fff";
  x.fillRect(0, 0, 1190, 1684);
  x.fillStyle = "#111";
  x.font = "36px sans-serif";
  x.fillText("1. The number of electrons in the K shell is", 80, 200);
  x.fillText("(1) 2   (2) 8   (3) 18   (4) 32", 100, 260);
  const png = c.toBuffer("image/png");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const t = (n: number) => {
    const p = doc.addPage([595, 842]);
    p.drawText(`Atomic structure - page ${n}`, { x: 40, y: 790, size: 16, font });
    p.drawText(`${n}. Which subshell is filled after 4s? This question has enough text to be read.`, { x: 40, y: 740, size: 11, font });
    p.drawText(`(1) 3d   (2) 4p   (3) 5s   (4) 4d`, { x: 50, y: 720, size: 11, font });
  };
  t(1);
  doc.addPage([595, 842]).drawImage(await doc.embedPng(png), { x: 0, y: 0, width: 595, height: 842 });
  t(3);
  return Buffer.from(await doc.save());
}

const files = new Map<string, Buffer>();
const server = http.createServer((req, res) => {
  const f = files.get((req.url ?? "").split("?")[0]!);
  if (!f) return res.writeHead(404).end();
  res.writeHead(200, { "Content-Type": "application/pdf", "Access-Control-Allow-Origin": "*" }).end(f);
});
const serve = (name: string, buf: Buffer) => {
  files.set(`/${name}`, buf);
  return `http://127.0.0.1:${(server.address() as any).port}/${name}?v=${crypto.randomUUID()}`;
};

async function newModule(owner: string, title: string, url: string, size: number) {
  return prisma.module.create({ data: { code: `E2E-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`, title, subject: "Chemistry", class: "Class 11", chapter: "Some Basic Concepts of Chemistry", facultyName: "E2E Teacher", academicYear: "2026-27", originalFileUrl: url, originalFileName: `${title}.pdf`, originalFileSize: size, createdById: owner } });
}

async function userWithRole(role: string) {
  const r = await prisma.role.findFirst({ where: { name: role } });
  if (!r) throw new Error(`role ${role} missing — seed the local database`);
  const password = crypto.randomBytes(12).toString("base64url");
  const email = `e2e-${role.toLowerCase()}-${Date.now()}@test.local`;
  await prisma.user.create({ data: { email, name: `E2E ${role}`, passwordHash: await bcrypt.hash(password, 10), roleId: r.id, status: "ACTIVE" } as any });
  const s = new HttpSession(BASE);
  await s.login(email, password);
  return s;
}

async function runImport(s: HttpSession, moduleId: string) {
  const t0 = Date.now();
  let r = await s.json(`/api/team/modules/${moduleId}/process`, { method: "POST", body: JSON.stringify({}) });
  let requests = 1;
  while (r.body?.success && !r.body.data.done && requests < 300) {
    r = await s.json(`/api/team/modules/${moduleId}/process?action=continue`, { method: "POST" });
    requests++;
  }
  const st = await s.json(`/api/team/modules/${moduleId}/process`);
  return { first: r, job: st.body?.data?.job, requests, ms: Date.now() - t0 };
}

let pdfjs: any;
async function readPdf(buf: Buffer) {
  pdfjs ??= await import(pathToFileURL(path.join(__dirname, "../node_modules/pdfjs-dist/legacy/build/pdf.mjs")).href);
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), verbosity: 0 }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) pages.push(((await (await doc.getPage(i)).getTextContent()).items as any[]).map((x) => x.str).join(" ").replace(/\s+/g, " "));
  await doc.destroy();
  return pages;
}

(async () => {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const admin = new HttpSession(BASE);
  const me = await admin.login(process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  check("admin signs in through the real login", !!me.id, me.role ?? "");

  // ------------------------------------------------ permission enforcement
  const mixed = await mixedPdf();
  const m1 = await newModule(me.id, "E2E mixed", serve("mixed.pdf", mixed), mixed.length);
  const anon = new HttpSession(BASE);
  const student = await userWithRole("STUDENT");
  const sales = await userWithRole("SALES");
  const probes: [string, string, string?][] = [
    ["GET", `/api/team/modules`],
    ["GET", `/api/team/modules/${m1.id}`],
    ["POST", `/api/team/modules/${m1.id}/process`, "{}"],
    ["GET", `/api/team/modules/${m1.id}/process?report=1`],
    ["GET", `/api/team/modules/${m1.id}/editor-project`],
    ["PUT", `/api/team/modules/${m1.id}/editor-project`, "{}"],
    ["GET", `/api/team/modules/${m1.id}/design`],
    ["POST", `/api/team/modules/${m1.id}/design/render`, '{"mode":"preview"}'],
    ["POST", `/api/team/modules/${m1.id}/save-native`, "{}"],
    ["GET", `/api/team/module-design-templates`],
  ];
  const statuses = async (s: HttpSession) => Promise.all(probes.map(async ([m, u, b]) => (await s.fetch(u, { method: m, headers: { "Content-Type": "application/json" }, body: b })).status));
  const a = await statuses(anon);
  check("signed out: every Module Studio API answers 401", a.every((x) => x === 401), a.join(","));
  const st = await statuses(student);
  check("student: every Module Studio API answers 403", st.every((x) => x === 403), st.join(","));
  const sa = await statuses(sales);
  check("team member without module permission (SALES): 403", sa.every((x) => x === 403), sa.join(","));
  // The team shell streams before the page decides, so a refused page arrives as 200 with the
  // not-found screen: what matters is that none of the module (its title, the editor) is in it.
  const pageHtml = await (await student.fetch(`/team/modules/${m1.id}/design`)).text();
  const adminHtml = await (await admin.fetch(`/team/modules/${m1.id}/design`)).text();
  check("student cannot open the module pages (not-found screen, no module content)", !pageHtml.includes("E2E mixed") && /could not be found|404/i.test(pageHtml) && adminHtml.includes("E2E mixed"));
  const fake = new FormData();
  fake.append("file", new Blob([Buffer.from("Hello, this is a Word file renamed.")], { type: "application/pdf" }), "notes.pdf");
  fake.append("metadata", JSON.stringify({ title: "Fake upload" }));
  const up = await admin.fetch("/api/team/modules", { method: "POST", body: fake });
  const upBody = await up.json().catch(() => null);
  check("upload: a non-PDF named .pdf is refused by its bytes", up.status === 400 && /not a PDF/i.test(upBody?.error ?? ""), `${up.status} ${upBody?.error ?? ""}`);

  // ------------------------------------------------ upload → extraction (text + OCR fallback)
  const imp = await runImport(admin, m1.id);
  const ps = imp.job?.pageStatuses ?? {};
  check("extraction: text pages read, scanned page found and marked for OCR", ps[1]?.status === "COMPLETED" && ps[3]?.status === "COMPLETED" && ps[2]?.status === "NEEDS_OCR" && imp.job.status === "completed_with_errors", `status=${imp.job?.status} p2=${ps[2]?.status}`);
  const ocr = await admin.json(`/api/team/modules/${m1.id}/process?action=ocr-page`, {
    method: "POST",
    body: JSON.stringify({ pageNumber: 2, confidence: 90, width: 595, height: 842, lines: [{ text: "1. The number of electrons in the K shell is", bbox: { x: 40, y: 90, w: 400, h: 16 }, confidence: 93 }, { text: "(1) 2 (2) 8 (3) 18 (4) 32", bbox: { x: 50, y: 120, w: 220, h: 16 }, confidence: 91 }] }),
  });
  const afterOcr = (await admin.json(`/api/team/modules/${m1.id}/process`)).body?.data?.job;
  check("OCR fallback: recognised page saved; job becomes completed", ocr.status === 200 && afterOcr?.status === "completed" && afterOcr.pageStatuses[2].status === "OCR_DONE", `status=${afterOcr?.status}`);
  const report = await admin.fetch(`/api/team/modules/${m1.id}/process?report=1`);
  const rep = await report.json();
  check("import report downloads with per-page rows", report.headers.get("content-disposition")?.includes("attachment") === true && rep.pages?.length === 3);

  // ------------------------------------------------ failed-page retry (no duplicates)
  const job = await prisma.processingJob.findFirst({ where: { moduleId: m1.id }, orderBy: { startedAt: "desc" } });
  const ps2 = { ...(job!.pageStatuses as any) };
  ps2[3] = { ...ps2[3], status: "FAILED", error: "Simulated (e2e)" };
  await prisma.processingJob.update({ where: { id: job!.id }, data: { pageStatuses: ps2, metadata: { ...(job!.metadata as any), status: "completed_with_errors" } } });
  const pagesBefore = await prisma.modulePage.count({ where: { moduleId: m1.id } });
  const retry = await admin.json(`/api/team/modules/${m1.id}/process?action=retry`, { method: "POST" });
  const afterRetry = (await admin.json(`/api/team/modules/${m1.id}/process`)).body?.data?.job;
  const pagesAfter = await prisma.modulePage.count({ where: { moduleId: m1.id } });
  const jobs = await prisma.processingJob.count({ where: { moduleId: m1.id } });
  check("retry: the failed page is processed again; no duplicate pages or jobs", retry.status === 200 && afterRetry?.pageStatuses[3]?.status === "COMPLETED" && pagesBefore === pagesAfter && jobs === 1, `p3=${afterRetry?.pageStatuses[3]?.status} pages ${pagesBefore}→${pagesAfter} jobs=${jobs}`);
  const dup = await admin.json(`/api/team/modules/${m1.id}/process?action=continue`, { method: "POST" });
  check("continue on a finished job does nothing harmful", dup.status === 200 && (await prisma.modulePage.count({ where: { moduleId: m1.id } })) === pagesAfter);

  // ------------------------------------------------ large document
  const big = await textPdf(300);
  const mBig = await newModule(me.id, "E2E large", serve("large.pdf", big), big.length);
  const rb = await runImport(admin, mBig.id);
  const bigPages = await prisma.modulePage.count({ where: { moduleId: mBig.id } });
  check("large PDF (300 pages, 1200 questions) imports over HTTP in slices", rb.job?.status === "completed" && bigPages === 300, `${rb.requests} requests, ${(rb.ms / 1000).toFixed(1)} s, ${Math.round(big.length / 1024)} KB`);

  // ------------------------------------------------ extraction → editable project (blocks), save and reopen
  const mText = await textPdf(3);
  const m2 = await newModule(me.id, "E2E blocks", serve("blocks.pdf", mText), mText.length);
  await runImport(admin, m2.id);
  const detail = (await admin.json(`/api/team/modules/${m2.id}`)).body?.data?.module ?? (await admin.json(`/api/team/modules/${m2.id}`)).body?.data;
  const p1 = detail.pages.find((p: any) => p.pageNumber === 1);
  const types = [...new Set(p1.elements.map((e: any) => e.type))];
  check("blocks: questions, options and answers are editable blocks", ["QUESTION", "OPTION", "ANSWER"].every((t) => types.includes(t)), types.join(","));
  const edited = p1.elements.map((e: any) => (e.type === "QUESTION" ? { ...e, content: e.content + " (edited in e2e)" } : e));
  edited.push({ id: "e2e-break", type: "PAGE_BREAK", order: edited.length, content: "" });
  edited[1] = { ...edited[1], layout: { keepTogether: true } };
  const save = await admin.json(`/api/team/modules/${m2.id}/pages/${p1.id}`, { method: "PATCH", body: JSON.stringify({ elements: edited }) });
  const reopened = (await admin.json(`/api/team/modules/${m2.id}`)).body?.data;
  const rp = (reopened.module ?? reopened).pages.find((p: any) => p.pageNumber === 1);
  check("blocks: edits, a page break and a layout override survive save + reopen", save.status === 200 && rp.elements.some((e: any) => /edited in e2e/.test(e.content)) && rp.elements.some((e: any) => e.type === "PAGE_BREAK") && rp.elements[1]?.layout?.keepTogether === true, `PATCH ${save.status}`);

  // ------------------------------------------------ original-PDF mode project: save, reopen, stale-save guard, layering
  const proj = (await admin.json(`/api/team/modules/${m2.id}/editor-project`)).body.data;
  const project = { textEdits: [{ id: "t1", pageNumber: 1, x: 40, y: 20, width: 300, height: 24, newText: "NEW HEADER", fontSize: 14, z: 2 }], whiteouts: [{ id: "w1", pageNumber: 1, x: 0, y: 0, width: 595, height: 60, z: 1 }], images: [], shapes: [], globalRemovals: [], globalReplacements: [], pageOrder: [2, 1, 3], deletedPages: [], pageRotations: {}, pageSources: {} };
  const put = await admin.json(`/api/team/modules/${m2.id}/editor-project`, { method: "PUT", body: JSON.stringify({ baseRevision: proj.revision, project }) });
  const back = (await admin.json(`/api/team/modules/${m2.id}/editor-project`)).body.data;
  check("PDF editor project: saved and reopened as saved (order, objects, stacking)", put.status === 200 && back.project.pageOrder.join() === "2,1,3" && back.project.textEdits[0].z > back.project.whiteouts[0].z);
  const stale = await admin.json(`/api/team/modules/${m2.id}/editor-project`, { method: "PUT", body: JSON.stringify({ baseRevision: proj.revision, project: { ...project, textEdits: [] } }) });
  const still = (await admin.json(`/api/team/modules/${m2.id}/editor-project`)).body.data;
  check("an older save never overwrites a newer one (409)", stale.status === 409 && still.project.textEdits.length === 1);

  // ------------------------------------------------ template + theme, multi-page layout, check, preview, export
  const dres = (await admin.json(`/api/team/modules/${mBig.id}/design`)).body.data;
  const design = dres.design;
  design.theme = { ...design.theme, primary: "#1d4ed8", deep: "#172554", soft: "#eff6ff" };
  design.themeId = "PHYSICS";
  design.sections = design.sections.map((s: any) => ({ ...s, style: s.kind === "COVER" ? "MINIMAL" : "EXAM" }));
  design.watermark.enabled = true;
  design.sections.find((s: any) => s.kind === "QUESTIONS").toPage = 30; // 120 questions
  design.sections.find((s: any) => s.kind === "ANSWER_KEY").toPage = 30;
  design.sections.find((s: any) => s.kind === "SOLUTIONS").enabled = false;
  const dput = await admin.json(`/api/team/modules/${mBig.id}/design`, { method: "PUT", body: JSON.stringify({ baseRevision: dres.revision, design }) });
  const dback = (await admin.json(`/api/team/modules/${mBig.id}/design`)).body.data.design;
  check("design: template style + subject theme saved and reopened", dput.status === 200 && dback.themeId === "PHYSICS" && dback.sections.filter((s: any) => s.kind !== "COVER").every((s: any) => s.style === "EXAM"));
  const t0 = Date.now();
  const chk = await admin.json(`/api/team/modules/${mBig.id}/design/render`, { method: "POST", body: JSON.stringify({ mode: "check" }) });
  check("check before export: report with categories, no file stored", chk.status === 200 && Array.isArray(chk.body?.data?.issues) && (await prisma.moduleExport.count({ where: { moduleId: mBig.id } })) === 0, `${chk.body?.data?.pageCount} pages, ${chk.body?.data?.errors} errors, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  const t1 = Date.now();
  const pv = await admin.fetch(`/api/team/modules/${mBig.id}/design/render`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "preview" }) });
  const pdfBuf = Buffer.from(await pv.arrayBuffer());
  let valid = false;
  let pdfPages: string[] = [];
  try {
    const d = await PDFDocument.load(pdfBuf);
    pdfPages = await readPdf(pdfBuf);
    valid = d.getPageCount() === pdfPages.length && pdfPages.length > 3;
  } catch {}
  check("preview PDF is a valid file that opens (pdf-lib and pdf.js)", pv.status === 200 && pdfBuf.subarray(0, 5).toString() === "%PDF-" && valid, `${pdfPages.length} pages, ${Math.round(pdfBuf.length / 1024)} KB, ${((Date.now() - t1) / 1000).toFixed(1)} s`);
  const split = Array.from({ length: 120 }, (_, i) => i + 1).filter((q) => {
    const qp = pdfPages.findIndex((t) => t.includes(`How many moles are there in ${q * 4} g`));
    if (qp < 0) return false;
    return !/\(4\) \d/.test(pdfPages[qp]!.slice(pdfPages[qp]!.indexOf(`in ${q * 4} g`)));
  });
  check("multi-page layout: 120 questions, none with its options split off", split.length === 0 && pdfPages.filter((t) => /How many moles are there/.test(t)).length >= 5, split.length ? `split: ${split.slice(0, 5).join(",")}` : `${pdfPages.length} pages`);
  check("header, page numbers and watermark on body pages; not on the cover", !/Page \d/.test(pdfPages[0]!) && pdfPages.slice(1).every((t, i) => t.includes(`Page ${i + 1}`) && t.includes("ATOMIC PATHSHALA")));

  // export blocked by unresolved import problems, then explicit choice
  const mFail = await newModule(me.id, "E2E unresolved", serve("unresolved.pdf", mText), mText.length);
  await runImport(admin, mFail.id);
  const fj = await prisma.processingJob.findFirst({ where: { moduleId: mFail.id } });
  await prisma.processingJob.update({ where: { id: fj!.id }, data: { pageStatuses: { ...(fj!.pageStatuses as any), 2: { ...(fj!.pageStatuses as any)[2], status: "FAILED", error: "Simulated" } } } });
  const ex1 = await admin.json(`/api/team/modules/${mFail.id}/design/render`, { method: "POST", body: JSON.stringify({ mode: "export" }) });
  check("export with an unresolved failed page stops and lists the problem (nothing stored)", ex1.status === 409 && ex1.body?.code === "EXPORT_HAS_ISSUES" && JSON.stringify(ex1.body?.details?.issues).includes("failed to import") && (await prisma.moduleExport.count({ where: { moduleId: mFail.id } })) === 0);
  const ex2 = await admin.json(`/api/team/modules/${mFail.id}/design/render`, { method: "POST", body: JSON.stringify({ mode: "export", acknowledgeIssues: true }) });
  if (ex2.status === 201) {
    // The link is the signed-in /file route, which redirects to a short-lived storage link.
    const viaRoute = await admin.fetch(ex2.body.data.fileUrl);
    const dl = await fetch(viaRoute.headers.get("location") || "about:blank");
    const buf = Buffer.from(await dl.arrayBuffer());
    const ok = await PDFDocument.load(buf).then((d) => d.getPageCount() > 0).catch(() => false);
    check("export after confirming: stored, downloadable, opens", ok && (await prisma.moduleExport.count({ where: { moduleId: mFail.id } })) === 1, ex2.body.data.fileUrl);
  } else {
    check("export after confirming: answered clearly (file storage not set up on this machine → 503)", ex2.status === 503 && /storage/i.test(ex2.body?.error ?? ""), `${ex2.status} ${ex2.body?.error?.slice(0, 80)}`);
  }

  // the module is findable in the normal list
  const list = (await admin.json(`/api/team/modules`)).body?.data;
  const rows = list?.modules ?? list;
  check("saved modules are listed in Module Studio", Array.isArray(rows) && [m1.id, m2.id, mBig.id].every((id) => rows.some((r: any) => r.id === id)));

  server.close();
  await prisma.$disconnect();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(async (e) => {
  console.error(e);
  server.close();
  await prisma.$disconnect();
  process.exit(1);
});
