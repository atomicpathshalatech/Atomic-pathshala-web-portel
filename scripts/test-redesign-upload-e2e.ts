/**
 * Redesign Studio "Extract & Build": a PDF larger than a Vercel request (4.5MB)
 * goes in by file id (uploaded straight to storage), against a running local
 * server that uses a local S3-compatible store (see test-module-files-e2e.ts).
 *
 *   E2E_BASE=http://localhost:3111 E2E_S3=http://127.0.0.1:9555 \
 *   TEST_DATABASE_URL=postgresql://…localhost…/db npx tsx --tsconfig tsconfig.json scripts/test-redesign-upload-e2e.ts
 */
import crypto from "node:crypto";
import { PDFDocument, StandardFonts } from "pdf-lib";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { HttpSession } from "./lib/http-session";

const BASE = process.env.E2E_BASE ?? "http://localhost:3111";
const S3 = process.env.E2E_S3 ?? "http://127.0.0.1:9555";
const DB = process.env.TEST_DATABASE_URL ?? "";
for (const v of [BASE, S3, DB]) if (!/localhost|127\.0\.0\.1/.test(v)) throw new Error("Refusing to run: E2E_BASE, E2E_S3 and TEST_DATABASE_URL must be local.");
const prisma = new PrismaClient({ datasources: { db: { url: DB } } });

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  ok ? passed++ : failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

/** Text pages plus one incompressible picture, so the file is bigger than a Vercel request. */
async function bigPdf(pages: number, padBytes: number) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) {
    const p = doc.addPage([595, 842]);
    p.drawText(`IUPAC Nomenclature - page ${i}`, { x: 40, y: 790, size: 16, font });
    p.drawText(`${i}. Write the IUPAC name of CH3-CH2-CH(CH3)-CH3.`, { x: 40, y: 740, size: 11, font });
    p.drawText(`(1) 2-methylbutane   (2) pentane   (3) 3-methylbutane   (4) isopentane`, { x: 50, y: 720, size: 11, font });
  }
  if (padBytes) {
    const { createCanvas } = require("@napi-rs/canvas");
    const side = Math.ceil(Math.sqrt(padBytes / 3));
    const c = createCanvas(side, side);
    const x = c.getContext("2d");
    const img = x.createImageData(side, side);
    crypto.randomFillSync(img.data);
    for (let k = 3; k < img.data.length; k += 4) img.data[k] = 255;
    x.putImageData(img, 0, 0);
    const png = await doc.embedPng(c.toBuffer("image/png"));
    doc.getPage(0).drawImage(png, { x: 300, y: 300, width: 200, height: 200 });
  }
  return Buffer.from(await doc.save());
}

async function asset(ownerId: string, name: string, buf: Buffer) {
  const key = `modules/e2e-redesign/${crypto.randomUUID()}/${name}`;
  const put = await fetch(`${S3}/main/${key}`, { method: "PUT", body: buf, headers: { "Content-Type": "application/pdf", Authorization: "test" } });
  if (!put.ok) throw new Error(`fake S3 put failed ${put.status}`);
  return prisma.fileAsset.create({ data: { ownerId, fileType: "PDF", bucket: "main", storageKey: key, originalFilename: name, mimeType: "application/pdf", sizeBytes: buf.length, status: "ACTIVE", visibility: "PUBLIC" } });
}

(async () => {
  const role = await prisma.role.findFirst({ where: { name: "SUPER_ADMIN" } });
  const pw = crypto.randomBytes(12).toString("base64url");
  const user = await prisma.user.create({ data: { email: `e2e-redesign-${Date.now()}@test.local`, name: "E2E redesign", passwordHash: await bcrypt.hash(pw, 10), roleId: role!.id, status: "ACTIVE" } as any });
  const other = await prisma.user.create({ data: { email: `e2e-redesign-o-${Date.now()}@test.local`, name: "E2E other", passwordHash: "x", roleId: role!.id, status: "ACTIVE" } as any });
  const s = new HttpSession(BASE);
  await s.login(user.email, pw);

  const main = await bigPdf(6, 6_000_000);
  const ref = await bigPdf(2, 0);
  check("test PDF is bigger than a Vercel request (4.5 MB)", main.length > 4_500_000, `${(main.length / 1e6).toFixed(1)} MB`);

  // The old way: the whole PDF in the request. (Locally there is no 4.5MB cap; on Vercel this is the 413.)
  const a = await asset(user.id, "iupac.pdf", main);
  const r = await asset(user.id, "ncert-iupac.pdf", ref);
  const t0 = Date.now();
  const res = await s.json("/api/modules/redesign/process", {
    method: "POST",
    body: JSON.stringify({ mainFileAssetId: a.id, referenceFileAssetIds: [r.id], subject: "CHEMISTRY", moduleNumber: "Module 03", chapterName: "IUPAC Nomenclature", targetExam: "NEET (UG)", facultyName: "E2E" }),
  });
  const d = res.body?.data;
  check("extract by file id succeeds", res.status === 200 && res.body?.success, `${res.status} ${res.body?.error ?? ""} (${Date.now() - t0} ms)`);
  check("pages and content extracted", d?.totalPages === 6 && Array.isArray(d?.ast) && d.ast.length > 0, `pages=${d?.totalPages} elements=${d?.totalElements}`);
  check("reference PDF read too", d?.referenceSourcesCount === 1);
  const mod = await prisma.module.findUnique({ where: { id: d?.moduleId }, include: { _count: { select: { pages: true } } } });
  check("module saved with its pages", mod?._count.pages === 6 && mod?.title === "Module 03: IUPAC Nomenclature");
  check("source stored in the private bucket (server set up with one)", !!mod?.originalFileUrl.startsWith("private:"), mod?.originalFileUrl.slice(0, 12));
  check("request and answer are small (no PDF in them)", JSON.stringify(res.body).length < 4_500_000);

  const stolen = await asset(other.id, "someone-elses.pdf", ref);
  const r2 = await s.json("/api/modules/redesign/process", { method: "POST", body: JSON.stringify({ mainFileAssetId: stolen.id }) });
  check("another user's upload cannot be used", r2.status === 400 && /not found/i.test(r2.body?.error ?? ""), `${r2.status} ${r2.body?.error}`);
  const notPdf = await asset(user.id, "notes.pdf", Buffer.from("this is not a pdf"));
  const r3 = await s.json("/api/modules/redesign/process", { method: "POST", body: JSON.stringify({ mainFileAssetId: notPdf.id }) });
  check("a non-PDF is refused by its bytes", r3.status === 400 && /not a PDF/.test(r3.body?.error ?? ""), `${r3.status} ${r3.body?.error}`);
  const r4 = await s.json("/api/modules/redesign/process", { method: "POST", body: "{}" });
  check("no file → clear 400", r4.status === 400 && /No PDF/.test(r4.body?.error ?? ""), `${r4.status} ${r4.body?.error}`);

  // Small PDFs still work as a form (fallback).
  const fd = new FormData();
  fd.append("mainPdf", new Blob([ref], { type: "application/pdf" }), "small.pdf");
  fd.append("subject", "PHYSICS");
  const r5 = await s.fetch("/api/modules/redesign/process", { method: "POST", body: fd });
  const b5 = await r5.json().catch(() => null);
  check("small PDF as a form still works", r5.status === 200 && b5?.data?.totalPages === 2, `${r5.status} ${b5?.error ?? ""}`);

  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
