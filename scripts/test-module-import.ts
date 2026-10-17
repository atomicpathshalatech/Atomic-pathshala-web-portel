/**
 * Module PDF import — end-to-end tests against a LOCAL test database.
 *
 * Builds real test PDFs (text, 400 pages, scanned, Hindi + English, two
 * columns, image-heavy, super/subscripts, damaged, not-a-PDF, password-
 * protected), serves them over HTTP like file storage does, and drives the
 * real job service: start → continue slices → retry → OCR page → report.
 * Measures time and memory for the large file.
 *
 *   TEST_DATABASE_URL="postgresql://postgres@localhost:5433/atomic_live" \
 *     npx tsx scripts/test-module-import.ts
 *
 * Needs Google Chrome (CHROME_PATH, default: the Windows install path) to
 * make the Hindi / two-column / image / equation PDFs and the scanned page.
 */
import Module from "node:module";
const M = Module as any;
const resolveOrig = M._resolveFilename;
M._resolveFilename = function (req: string, ...rest: unknown[]) {
  if (req === "server-only") return require.resolve("./fixtures/empty-module.cjs");
  return resolveOrig.call(this, req, ...rest);
};
import http from "node:http";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DB = process.env.TEST_DATABASE_URL;
if (!DB || !/localhost|127\.0\.0\.1/.test(DB)) {
  console.error("Set TEST_DATABASE_URL to a LOCAL test database (never production).");
  process.exit(2);
}
process.env.DATABASE_URL = DB;
process.env.DIRECT_URL = DB;

let passed = 0;
let failed = 0;
const results: string[] = [];
function check(name: string, ok: boolean, detail = "") {
  const line = `${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`;
  results.push(line);
  console.log(line);
  ok ? passed++ : failed++;
}

// ---------------------------------------------------------------- fixtures
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";

async function withChrome<T>(fn: (browser: any) => Promise<T>): Promise<T> {
  const puppeteer = require("puppeteer-core");
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}

async function htmlToPdf(browser: any, html: string): Promise<Buffer> {
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:"Nirmala UI","Mangal","Noto Sans Devanagari",Arial,sans-serif;font-size:13px;margin:0}</style></head><body>${html}</body></html>`, { waitUntil: "load" });
  const pdf = Buffer.from(await page.pdf({ format: "A4", printBackground: true, margin: { top: "60px", bottom: "60px", left: "50px", right: "50px" } }));
  await page.close();
  return pdf;
}

async function textPdf(pages: number): Promise<Buffer> {
  const { PDFDocument, StandardFonts } = require("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([595, 842]);
    let y = 790;
    page.drawText(`Mole Concept — Page ${i}`, { x: 50, y, size: 16, font });
    for (let q = 1; q <= 5; q++) {
      y -= 120;
      page.drawText(`${(i - 1) * 5 + q}. How many moles are present in ${q * 4} g of NaOH?`, { x: 50, y, size: 11, font });
      page.drawText(`(1) ${q * 0.1}   (2) ${q * 0.2}   (3) ${q * 0.3}   (4) ${q * 0.4}`, { x: 60, y: y - 18, size: 11, font });
      page.drawText(`Ans. (2)`, { x: 60, y: y - 36, size: 11, font });
    }
  }
  return Buffer.from(await doc.save());
}

async function scannedPdf(browser: any): Promise<{ pdf: Buffer; png: Buffer }> {
  // A "scan": the page is one picture of printed text, with no text layer.
  const page = await browser.newPage();
  await page.setViewport({ width: 1240, height: 1754 });
  await page.setContent(`<body style="margin:80px;font:28px Georgia;line-height:1.6;background:#fff">
    <h2>Chapter 2: Atomic Structure</h2>
    <p>1. The number of electrons in the K shell is</p><p>(1) 2 (2) 8 (3) 18 (4) 32</p>
    <p>2. Which particle has no charge?</p><p>(1) proton (2) electron (3) neutron (4) positron</p></body>`);
  const png = Buffer.from(await page.screenshot({ type: "png" }));
  await page.close();
  const { PDFDocument } = require("pdf-lib");
  const doc = await PDFDocument.create();
  const img = await doc.embedPng(png);
  const p = doc.addPage([595, 842]);
  p.drawImage(img, { x: 0, y: 0, width: 595, height: 842 });
  return { pdf: Buffer.from(await doc.save()), png };
}

/** A tiny hand-written PDF protected with a user password (RC4 40-bit, PDF 1.3 standard security). */
function encryptedPdf(): Buffer {
  const rc4 = (key: Buffer, data: Buffer) => {
    const s = Array.from({ length: 256 }, (_, i) => i);
    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (j + s[i]! + key[i % key.length]!) & 255;
      [s[i], s[j]] = [s[j]!, s[i]!];
    }
    const out = Buffer.alloc(data.length);
    let i = 0;
    j = 0;
    for (let k = 0; k < data.length; k++) {
      i = (i + 1) & 255;
      j = (j + s[i]!) & 255;
      [s[i], s[j]] = [s[j]!, s[i]!];
      out[k] = data[k]! ^ s[(s[i]! + s[j]!) & 255]!;
    }
    return out;
  };
  const PAD = Buffer.from("28BF4E5E4E758A4164004E56FFFA01082E2E00B6D0683E802F0CA9FE6453697A", "hex");
  const pad = (pw: string) => Buffer.concat([Buffer.from(pw, "latin1"), PAD]).subarray(0, 32);
  const md5 = (...b: Buffer[]) => crypto.createHash("md5").update(Buffer.concat(b)).digest();
  const id = crypto.randomBytes(16);
  const P = -44; // permissions
  const pBuf = Buffer.alloc(4);
  pBuf.writeInt32LE(P);
  const O = rc4(md5(pad("owner-secret")).subarray(0, 5), pad("user-secret"));
  const key = md5(pad("user-secret"), O, pBuf, id).subarray(0, 5);
  const U = rc4(key, PAD);
  const objKey = (num: number) => md5(key, Buffer.from([num & 255, (num >> 8) & 255, (num >> 16) & 255, 0, 0])).subarray(0, 10);
  const content = rc4(objKey(4), Buffer.from("BT /F1 24 Tf 72 720 Td (Secret module) Tj ET", "latin1"));
  const hex = (b: Buffer) => `<${b.toString("hex")}>`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    null, // stream
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Filter /Standard /V 1 /R 2 /O ${hex(O)} /U ${hex(U)} /P ${P} >>`,
  ];
  const parts: Buffer[] = [Buffer.from("%PDF-1.3\n%\xE2\xE3\xCF\xD3\n", "latin1")];
  const offsets: number[] = [];
  let pos = parts[0]!.length;
  objs.forEach((o, i) => {
    offsets.push(pos);
    const body =
      o === null
        ? Buffer.concat([Buffer.from(`${i + 1} 0 obj\n<< /Length ${content.length} >>\nstream\n`, "latin1"), content, Buffer.from("\nendstream\nendobj\n", "latin1")])
        : Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`, "latin1");
    parts.push(body);
    pos += body.length;
  });
  const xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Encrypt 6 0 R /ID [${hex(id)} ${hex(id)}] >>\nstartxref\n${pos}\n%%EOF\n`;
  parts.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(parts);
}

// ----------------------------------------------------------------- the run
(async () => {
  const files = new Map<string, { status: number; body: Buffer }>();
  const server = http.createServer((req, res) => {
    const f = files.get(req.url ?? "");
    if (!f) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(f.status, { "Content-Type": "application/pdf" });
    res.end(f.body);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const serve = (name: string, body: Buffer, status = 200) => {
    // A different trailing comment per file: identical bytes would be served from the import cache.
    files.set(`/${name}`, { status, body: status === 200 && body.subarray(0, 5).toString() === "%PDF-" ? Buffer.concat([body, Buffer.from(`\n%${name}\n`)]) : body });
    return `${base}/${name}`;
  };

  console.log("Building test PDFs…");
  const fx = await withChrome(async (browser) => {
    const hindi = await htmlToPdf(browser, `<h1>अध्याय 3 : मोल संकल्पना (Mole Concept)</h1>
      <p>1. NaOH के 40 g में कितने मोल होते हैं? How many moles are in 40 g of NaOH?</p>
      <p>(1) 1 मोल (2) 2 मोल (3) 0.5 मोल (4) 4 मोल</p>
      <p>उत्तर: (1)</p>`);
    const twoCol = await htmlToPdf(browser, `<div style="columns:2;column-gap:40px">${Array.from({ length: 14 }, (_, i) => `<p>${i + 1}. Column question number ${i + 1} about stoichiometry and limiting reagents.</p><p>(1) A${i + 1} (2) B${i + 1} (3) C${i + 1} (4) D${i + 1}</p>`).join("")}</div>`);
    const pixel = (c: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='300' height='180'><rect width='300' height='180' fill='${c}'/><circle cx='150' cy='90' r='60' fill='white'/></svg>`)}`;
    const imgPage = await browser.newPage();
    await imgPage.setViewport({ width: 600, height: 360 });
    const photos: string[] = [];
    for (const c of ["#e11d48", "#2563eb", "#16a34a", "#9333ea"]) {
      await imgPage.setContent(`<img src="${pixel(c)}" style="display:block">`);
      photos.push(`data:image/png;base64,${Buffer.from(await imgPage.screenshot({ type: "png", clip: { x: 0, y: 0, width: 300, height: 180 } })).toString("base64")}`);
    }
    await imgPage.close();
    const imageHeavy = await htmlToPdf(browser, `<h2>Diagrams</h2>${photos.map((p, i) => `<p>Figure ${i + 1}: apparatus ${i + 1}</p><img src="${p}" width="300" height="180">`).join("")}`);
    const equations = await htmlToPdf(browser, `<h2>Formulae</h2>
      <p>1. Water is H<sub>2</sub>O and sulphuric acid is H<sub>2</sub>SO<sub>4</sub>.</p>
      <p>2. Kinetic energy E = mv<sup>2</sup>/2 and area = πr<sup>2</sup>.</p>
      <p>3. The ion Ca<sup>2+</sup> has 18 electrons; ΔH = −40 kJ mol<sup>−1</sup>.</p>`);
    const scanned = await scannedPdf(browser);
    // Hindi text whose conjuncts cannot be decoded (→ OCR) next to a small picture.
    const hindiPic = await htmlToPdf(browser, `<h2>अध्याय 4 : रासायनिक बंधन</h2><p>1. आयनिक बंध कैसे बनता है?</p><img src="${photos[0]}" width="240" height="144">`);
    return { hindi, twoCol, imageHeavy, equations, scanned, hindiPic };
  });

  const { prisma } = await import("../src/lib/db");
  const svc = await import("../src/lib/module-studio/extraction-job-service");
  const user = await prisma.user.create({ data: { email: `import-test-${Date.now()}@test.local`, name: "Import Tester", passwordHash: "x" } as any });
  const mk = (code: string, url: string, bytes = 1) =>
    prisma.module.create({ data: { code: `${code}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title: code, originalFileUrl: url, originalFileName: `${code}.pdf`, originalFileSize: bytes, createdById: user.id } });
  const runToEnd = async (moduleId: string, first: any) => {
    let slice = first?.slice ?? first;
    let requests = 1;
    while (slice && !slice.done && requests < 200) {
      slice = await svc.continueExtractionJob(moduleId, user.id);
      requests++;
    }
    return { slice, requests };
  };
  const pages = (moduleId: string) => prisma.modulePage.findMany({ where: { moduleId }, orderBy: { pageNumber: "asc" } });
  const allText = (els: any) => (els as any[]).map((e) => e.content).join(" \n ");

  // 1. Ordinary text PDF
  {
    const m = await mk("text", serve("text.pdf", await textPdf(3)));
    const r = await runToEnd(m.id, await svc.startExtractionJob(m.id, user.id, {}));
    const ps = await pages(m.id);
    const els = ps.flatMap((p) => p.elements as any[]);
    const st = await svc.getJobStatus(m.id);
    check("text PDF: completed, every page from the text layer", st?.status === "completed" && st.textPages === 3, `status=${st?.status} text=${st?.textPages}`);
    check("text PDF: questions, options and answers become blocks", els.some((e) => e.type === "QUESTION") && els.some((e) => e.type === "OPTION") && els.some((e) => e.type === "ANSWER"), [...new Set(els.map((e) => e.type))].join(","));
    check("text PDF: blocks carry their source page and box", els.filter((e) => e.type !== "HEADER" && e.type !== "FOOTER").every((e) => e.sourcePage >= 1) && els.filter((e) => e.bbox).length >= els.length * 0.8, `${els.filter((e) => e.bbox).length}/${els.length} with a box`);
    void r;
  }

  // 2. Large multipage PDF (time + memory measured)
  {
    const big = await textPdf(400);
    const m = await mk("large", serve("large.pdf", big), big.length);
    process.env.MODULE_SLICE_BUDGET_MS = "1500";
    const t0 = Date.now();
    let peakRss = process.memoryUsage().rss;
    const timer = setInterval(() => (peakRss = Math.max(peakRss, process.memoryUsage().rss)), 100);
    const r = await runToEnd(m.id, await svc.startExtractionJob(m.id, user.id, {}));
    clearInterval(timer);
    const secs = (Date.now() - t0) / 1000;
    const count = await prisma.modulePage.count({ where: { moduleId: m.id } });
    const st = await svc.getJobStatus(m.id);
    check("large PDF (400 pages): all pages imported over several requests", count === 400 && st?.status === "completed" && r.requests > 1, `requests=${r.requests}`);
    check("large PDF: measured", true, `${secs.toFixed(1)} s total (${((secs * 1000) / 400).toFixed(0)} ms/page), peak RSS ${Math.round(peakRss / 1048576)} MB, file ${Math.round(big.length / 1024)} KB`);
    delete process.env.MODULE_SLICE_BUDGET_MS;
  }

  // 3. Scanned PDF → NEEDS_OCR, then an OCR result for the page
  {
    const m = await mk("scanned", serve("scanned.pdf", fx.scanned.pdf));
    await runToEnd(m.id, await svc.startExtractionJob(m.id, user.id, {}));
    const st = await svc.getJobStatus(m.id);
    check("scanned PDF: detected, marked as needing OCR (not failed, not 'complete')", st?.ocrPendingPages === 1 && st.status === "completed_with_errors" && st.failedPages === 0, `status=${st?.status} pending=${st?.ocrPendingPages}`);
    const pg = (await pages(m.id))[0]!;
    check("scanned PDF: the page picture is kept as an image block", (pg.elements as any[]).some((e) => e.type === "IMAGE" && e.source === "IMAGE_REGION"));
    const ocr = await svc.submitOcrPage(m.id, user.id, {
      pageNumber: 1,
      confidence: 88,
      width: 595,
      height: 842,
      lines: [
        { text: "1. The number of electrons in the K shell is", bbox: { x: 40, y: 100, w: 400, h: 14 }, confidence: 91 },
        { text: "(1) 2 (2) 8 (3) 18 (4) 32", bbox: { x: 40, y: 120, w: 200, h: 14 }, confidence: 62 },
        { text: "(1) Proton (2) Neutron (3) Electron (4) Photon", bbox: { x: 40, y: 140, w: 300, h: 14 }, confidence: 90 },
      ],
    });
    const after = await svc.getJobStatus(m.id);
    const ocrEls = (await pages(m.id))[0]!.elements as any[];
    check("scanned PDF: OCR result stored with source and confidence; job becomes completed", ocr.ocrPendingPages === 0 && after?.status === "completed" && ocrEls.every((e) => e.source === "OCR" && typeof e.confidence === "number"), `status=${after?.status}`);
    check("OCR: option lines that start with a word stay options; low-confidence block flagged", ocrEls.filter((e) => e.type === "OPTION").length === 2 && (after?.pageStatuses[1]?.warnings ?? []).some((w: string) => /low OCR confidence/.test(w)), ocrEls.map((e) => e.type).join(","));
    check("OCR: replacing the full-page scan picture is reported, not silent", (after?.pageStatuses[1]?.warnings ?? []).some((w: string) => /full-page scan picture was replaced/.test(w)));
  }

  // 4. Hindi + English
  {
    const m = await mk("hindi", serve("hindi.pdf", fx.hindi));
    await runToEnd(m.id, await svc.startExtractionJob(m.id, user.id, {}));
    const text = allText((await pages(m.id))[0]!.elements);
    const st = await svc.getJobStatus(m.id);
    const p1 = st?.pageStatuses[1];
    // "ि" stored before its consonant is put back ("िकतने" → "कितने"); marks the PDF dropped
    // entirely ("हैं" → "ह") cannot be recovered from the text layer — the next check covers that.
    check("Hindi/English PDF: Devanagari kept as Unicode (visual-order ि repaired)", /कितने मोल होते/.test(text) && /मोल संकल्पना/.test(text) && !/(^|\s)ि/.test(text), text.split(" \n ").find((l) => /NaOH/.test(l))?.slice(0, 120) ?? text.slice(0, 120));
    // Chrome writes the conjunct "ध्य" without a Unicode mapping, so the PDF itself has lost it.
    // That must be detected and the page sent to OCR — not reported as a clean import.
    check("Hindi PDF: letters the PDF cannot decode are detected; page flagged for OCR", p1?.status === "NEEDS_OCR" && (p1?.warnings ?? []).some((w: string) => /cannot be decoded/.test(w)) && st?.status === "completed_with_errors", `page=${p1?.status} job=${st?.status}`);
    check("Hindi/English PDF: English and the Hindi answer line kept", /How many moles/.test(text) && /उत्तर/.test(text));
  }

  // 4b. Undecodable Hindi + a picture → OCR replaces the text, the picture stays
  {
    const m = await mk("hindipic", serve("hindipic.pdf", fx.hindiPic));
    await runToEnd(m.id, await svc.startExtractionJob(m.id, user.id, {}));
    const before = await svc.getJobStatus(m.id);
    const pic = ((await pages(m.id))[0]!.elements as any[]).find((e) => e.type === "IMAGE");
    await svc.submitOcrPage(m.id, user.id, { pageNumber: 1, confidence: 90, width: 595.92, height: 841.92, lines: [{ text: "अध्याय 4 : रासायनिक बंधन", bbox: { x: 36, y: 60, w: 200, h: 18 }, confidence: 92 }, { text: "1. आयनिक बंध कैसे बनता है?", bbox: { x: 36, y: 90, w: 220, h: 14 }, confidence: 91 }] });
    const els = (await pages(m.id))[0]!.elements as any[];
    const pg = await prisma.modulePage.findFirst({ where: { moduleId: m.id, pageNumber: 1 } });
    check("OCR on a text page: picture kept, text replaced, page stays DIGITAL", before?.pageStatuses[1]?.status === "NEEDS_OCR" && !!pic && els.some((e) => e.type === "IMAGE" && e.bbox?.w === pic.bbox?.w) && els.some((e) => /आयनिक बंध कैसे बनता है/.test(e.content)) && pg?.pdfType === "DIGITAL", `before=${before?.pageStatuses[1]?.status} types=${els.map((e) => e.type).join(",")} pdfType=${pg?.pdfType}`);
  }

  // 5. Two columns
  {
    const m = await mk("twocol", serve("twocol.pdf", fx.twoCol));
    await runToEnd(m.id, await svc.startExtractionJob(m.id, user.id, {}));
    const st = await svc.getJobStatus(m.id);
    const text = allText((await pages(m.id))[0]!.elements);
    const idx = (n: number) => text.indexOf(`${n}. Column question number ${n} `);
    const order = [1, 2, 3, 4, 5, 6, 7, 8].map(idx);
    check("two-column PDF: detected as two columns", st?.pageStatuses[1]?.columns === 2, `columns=${st?.pageStatuses[1]?.columns}`);
    check("two-column PDF: questions read in order (down the left column, then the right)", order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1]!)), order.join(","));
  }

  // 6. Image-heavy
  {
    const m = await mk("images", serve("images.pdf", fx.imageHeavy));
    await runToEnd(m.id, await svc.startExtractionJob(m.id, user.id, {}));
    const els = (await pages(m.id)).flatMap((p) => p.elements as any[]);
    const pics = els.filter((e) => e.type === "IMAGE");
    check("image-heavy PDF: every picture kept as a positioned image block", pics.length >= 4 && pics.every((e) => e.bbox && e.bbox.w > 50), `${pics.length} picture blocks, widths ${pics.map((e) => e.bbox?.w).join("/")}`);
  }

  // 7. Equations, superscripts, subscripts
  {
    const m = await mk("equations", serve("equations.pdf", fx.equations));
    await runToEnd(m.id, await svc.startExtractionJob(m.id, user.id, {}));
    const text = allText((await pages(m.id))[0]!.elements);
    check("equations: subscripts recovered (H₂O, H₂SO₄)", /H₂O/.test(text) && /H₂SO₄/.test(text), text.match(/H\S{1,6}O/g)?.join(" ") ?? text.slice(0, 80));
    check("equations: superscripts recovered (mv², πr², Ca²⁺)", /v²/.test(text) && /r²/.test(text) && /Ca²⁺/.test(text), (text.match(/\S*[²⁺⁻¹]\S*/g) ?? []).join(" "));
    check("equations: symbols kept (π, Δ, −)", /π/.test(text) && /Δ/.test(text) && /−/.test(text));
  }

  // 8. Damaged / not a PDF / password-protected
  {
    const good = await textPdf(2);
    const cases: [string, Buffer, RegExp, string][] = [
      ["corrupted", good.subarray(0, Math.floor(good.length * 0.4)), /damaged|incomplete/i, "CORRUPTED"],
      ["notpdf", Buffer.from("This is a Word document renamed to .pdf"), /not a PDF/i, "NOT_A_PDF"],
      ["encrypted", encryptedPdf(), /password/i, "PASSWORD_PROTECTED"],
    ];
    for (const [name, body, msg, code] of cases) {
      const m = await mk(name, serve(`${name}.pdf`, body));
      await svc.startExtractionJob(m.id, user.id, {});
      const st = await svc.getJobStatus(m.id);
      check(`${name} PDF: fails clearly (${code})`, st?.status === "failed" && st.errorCode === code && msg.test(st.errorMessage ?? ""), `${st?.errorCode}: ${st?.errorMessage?.slice(0, 90)}`);
    }
  }

  // 9. Partial failure → completed_with_errors → retry → completed
  {
    const m = await mk("partial", serve("partial.pdf", await textPdf(10)));
    await runToEnd(m.id, await svc.startExtractionJob(m.id, user.id, { testFailPages: [3, 7] } as any));
    const st = await svc.getJobStatus(m.id);
    check("partial failure: other pages imported, the 2 bad pages recorded with their error", st?.status === "completed_with_errors" && st.failedPages === 2 && st.pageStatuses[3]?.error === "Simulated failure (test)" && (await prisma.modulePage.count({ where: { moduleId: m.id } })) === 10, `status=${st?.status} failed=${st?.failedPages}`);
    const r = await svc.retryFailedPages(m.id, user.id);
    const after = await svc.getJobStatus(m.id);
    check("retry: only the failed pages are processed again; job completes", r?.done === true && after?.status === "completed" && after.failedPages === 0 && after.pageStatuses[3]?.attempts === 2 && after.pageStatuses[1]?.attempts === 1, `status=${after?.status} attempts p3=${after?.pageStatuses[3]?.attempts} p1=${after?.pageStatuses[1]?.attempts}`);
  }

  // 10. Resume after an interruption + duplicate-job prevention + cancel
  {
    process.env.MODULE_SLICE_BUDGET_MS = "1";
    process.env.MODULE_BATCH_PAGES = "5";
    const m = await mk("resume", serve("resume.pdf", await textPdf(30)));
    const first = await svc.startExtractionJob(m.id, user.id, {});
    check("resume: first request stops after one batch, progress saved", first.slice?.done === false && (await prisma.modulePage.count({ where: { moduleId: m.id } })) === 5, `saved=${await prisma.modulePage.count({ where: { moduleId: m.id } })}`);
    let dup = "";
    try {
      await svc.startExtractionJob(m.id, user.id, {});
    } catch (e: any) {
      dup = e?.name;
    }
    check("duplicate start while a job runs is refused", dup === "ExtractionConflictError");
    const mid = await svc.getJobStatus(m.id);
    check("progress is below 100% until the backend has finished", (mid?.progress ?? 100) < 100 && mid?.status === "processing", `progress=${mid?.progress}`);
    // "the browser was closed" — later, carry on
    const r = await runToEnd(m.id, await svc.continueExtractionJob(m.id, user.id));
    check("resume: carried on from the saved page to the end", r.slice?.done === true && (await prisma.modulePage.count({ where: { moduleId: m.id } })) === 30 && (await svc.getJobStatus(m.id))?.progress === 100);
    const c = await mk("cancel", serve("cancel.pdf", await textPdf(30)));
    await svc.startExtractionJob(c.id, user.id, {});
    await svc.cancelJob(c.id);
    const nothing = await svc.continueExtractionJob(c.id, user.id);
    const cs = await svc.getJobStatus(c.id);
    check("cancel: job stops and stays cancelled", nothing === null && cs?.status === "cancelled", `status=${cs?.status}`);
    delete process.env.MODULE_SLICE_BUDGET_MS;
    delete process.env.MODULE_BATCH_PAGES;
  }

  // 11. Storage failure
  {
    const m = await mk("storage", serve("storage.pdf", Buffer.from("x"), 503));
    let err = "";
    try {
      await svc.startExtractionJob(m.id, user.id, {});
    } catch (e: any) {
      err = String(e?.message);
    }
    check("storage failure: clear error, no job left hanging", /HTTP 503/.test(err) && (await prisma.processingJob.count({ where: { moduleId: m.id, finishedAt: null } })) === 0, err.slice(0, 100));
  }

  // 12. Report
  {
    const m = await prisma.module.findFirst({ where: { title: "partial", createdById: user.id } });
    const report: any = await svc.getJobReport(m!.id);
    check("report: per-page status, attempts and totals", report?.pages?.length === 10 && report.totals.failed === 0 && report.pages[2].attempts === 2 && report.job.status === "completed");
  }

  // 13. Database failure (separate process with an unreachable database)
  {
    const t0 = Date.now();
    const child = spawnSync(process.execPath, ["--import", "tsx", "-e", `
      process.env.DATABASE_URL = "postgresql://postgres@127.0.0.1:5999/nowhere?connect_timeout=3";
      const Module = require("node:module"); const o = Module._resolveFilename;
      Module._resolveFilename = function (r, ...a) { if (r === "server-only") return ${JSON.stringify(require.resolve("./fixtures/empty-module.cjs"))}; return o.call(this, r, ...a); };
      import(${JSON.stringify(pathToFileURL(path.join(__dirname, "../src/lib/module-studio/extraction-job-service.ts")).href)}).then((s) => (s.startExtractionJob ? s : s.default).startExtractionJob("nope", "nope", {}))
        .then(() => { console.log("UNEXPECTED_OK"); process.exit(0); }, (e) => { console.log("ERR:" + String(e && e.message).split("\\n").slice(-1)[0].slice(0, 120)); process.exit(0); });
    `], { encoding: "utf8", timeout: 60_000, cwd: path.join(__dirname, "..") });
    const out = `${child.stdout}`.trim().split("\n").pop() ?? "";
    check("database failure: the request fails with an error (no hang)", out.startsWith("ERR:") && /reach|connect|database|ECONNREFUSED/i.test(out) && Date.now() - t0 < 60_000, `${((Date.now() - t0) / 1000).toFixed(1)} s, ${out.slice(0, 110)}`);
  }

  server.close();
  await prisma.$disconnect();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
