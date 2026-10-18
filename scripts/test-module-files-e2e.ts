/**
 * Private module PDFs end to end, over HTTP against a running local server
 * that uses a local S3-compatible store with a private bucket:
 *
 *   E2E_BASE=http://localhost:3111 E2E_S3=http://127.0.0.1:9555 \
 *   TEST_DATABASE_URL=postgresql://…localhost…/db npx tsx --tsconfig tsconfig.json scripts/test-module-files-e2e.ts
 *
 * The server must run with R2_BUCKET_NAME=main, R2_PRIVATE_BUCKET_NAME=priv,
 * STORAGE_ENDPOINT=$E2E_S3 (see scripts/lib/fake-s3.ts). Test accounts are
 * created in the local database with random passwords.
 */
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
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
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail && !ok ? `  — ${detail}` : ""}`);
};

async function textPdf(pages: number, title: string) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) {
    const p = doc.addPage([595, 842]);
    p.drawText(`${title} - page ${i}`, { x: 40, y: 790, size: 16, font });
    p.drawText(`${i}. How many moles are there in ${i * 4} g of NaOH (molar mass 40)?`, { x: 40, y: 740, size: 11, font });
    p.drawText(`(1) ${i / 10}   (2) ${i / 5}   (3) ${i}   (4) ${i * 2}`, { x: 50, y: 720, size: 11, font });
  }
  return Buffer.from(await doc.save());
}

async function userWithRole(role: string) {
  const r = await prisma.role.findFirst({ where: { name: role } });
  if (!r) throw new Error(`role ${role} missing — seed the local database`);
  const password = crypto.randomBytes(12).toString("base64url");
  const email = `e2e-files-${role.toLowerCase()}-${Date.now()}-${crypto.randomUUID().slice(0, 4)}@test.local`;
  const user = await prisma.user.create({ data: { email, name: `E2E ${role}`, passwordHash: await bcrypt.hash(password, 10), roleId: r.id, status: "ACTIVE" } as any });
  const s = new HttpSession(BASE);
  await s.login(email, password);
  return { s, user };
}

async function studentIn(batchId: string | null) {
  const { s, user } = await userWithRole("STUDENT");
  const tag = crypto.randomUUID().slice(0, 8);
  const st = await prisma.student.create({
    data: { userId: user.id, enrollmentNumber: `E2E-${tag}`, studentIdCode: `E2E-${tag}`, fatherName: "-", motherName: "-", dob: new Date("2009-01-01"), gender: "OTHER", class: "11", targetExam: "NEET", school: "-", city: "-", state: "-" } as any,
  });
  if (batchId) await prisma.batchEnrollment.create({ data: { batchId, studentId: st.id } });
  return s;
}

const bare = (bucket: string, key: string) => fetch(`${S3}/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`);
const noStorageText = (v: unknown) => {
  const t = JSON.stringify(v);
  return !t.includes("private:") && !t.includes(S3) && !t.includes("127.0.0.1:9555");
};

(async () => {
  const { s: admin, user: adminUser } = await userWithRole("SUPER_ADMIN");
  const { s: sales } = await userWithRole("SALES");
  const anon = new HttpSession(BASE);
  const batch = await prisma.batch.findFirst({ select: { id: true, code: true, name: true } });
  if (!batch) throw new Error("no batch in the local database — seed it first");
  const enrolled = await studentIn(batch.id);
  const outsider = await studentIn(null);
  check("test accounts signed in (admin, sales, enrolled student, outsider)", true);

  // ───────────────────────── upload → private bucket
  const pdf = await textPdf(3, "Mole Concept");
  const form = new FormData();
  form.append("file", new Blob([pdf], { type: "application/pdf" }), "mole concept.pdf");
  form.append("metadata", JSON.stringify({ title: "E2E private PDF", subject: "Chemistry" }));
  const up = await admin.fetch("/api/team/modules", { method: "POST", body: form });
  const upBody = await up.json().catch(() => null);
  const mod = upBody?.data?.module;
  check("upload succeeds", up.status === 201 && !!mod?.id, `${up.status} ${upBody?.error ?? ""}`);
  const row = await prisma.module.findUnique({ where: { id: mod.id } });
  check("source PDF stored in the private bucket (private:<key>)", !!row?.originalFileUrl.startsWith("private:modules/"), row?.originalFileUrl.slice(0, 20));
  const key = row!.originalFileUrl.slice("private:".length);
  check("a bare storage link to it is refused (403)", (await bare("priv", key)).status === 403);
  check("no public copy exists", (await bare("main", key)).status === 404);
  check("upload response holds no storage link", noStorageText(upBody) && mod.originalFileUrl === `/api/team/modules/${mod.id}/file?src=original`, mod.originalFileUrl);

  const one = await admin.json(`/api/team/modules/${mod.id}`);
  const list = await admin.json(`/api/team/modules`);
  check("module and module list JSON hold no storage link", one.status === 200 && list.status === 200 && noStorageText(one.body) && noStorageText(list.body));

  // ───────────────────────── /file access
  const route = `/api/team/modules/${mod.id}/file?src=original`;
  const st = await Promise.all([anon, enrolled, sales].map(async (s) => (await s.fetch(route)).status));
  check("file route: signed out 401, student 403, SALES 403", st.join(",") === "401,403,403", st.join(","));
  const r1 = await admin.fetch(route);
  const loc = r1.headers.get("location") || "";
  check("file route: team member gets a redirect to a signed link", r1.status === 302 && loc.startsWith(`${S3}/priv/`) && loc.includes("X-Amz-Signature"), `${r1.status} ${loc.slice(0, 60)}`);
  check("file route: no caching, no referrer", /no-store/.test(r1.headers.get("cache-control") || "") && /(^|,\s*)no-referrer$/.test(r1.headers.get("referrer-policy") || ""));
  check("signed link expires in 10 minutes", new URL(loc).searchParams.get("X-Amz-Expires") === "600");
  const got = Buffer.from(await (await fetch(loc)).arrayBuffer());
  check("signed link returns the uploaded PDF, byte for byte", got.equals(pdf));
  const dl = (await admin.fetch(`${route}&download=1`)).headers.get("location") || "";
  check("download=1 asks the browser to save it", decodeURIComponent(new URL(dl).searchParams.get("response-content-disposition") || "").startsWith("attachment;"));
  const other = await prisma.module.findFirst({ where: { id: { not: mod.id } }, select: { id: true } });
  const exportElsewhere = await prisma.moduleExport.findFirst({ where: { moduleId: { not: mod.id } }, select: { id: true } });
  if (exportElsewhere) {
    const cross = await admin.fetch(`/api/team/modules/${mod.id}/file?src=export:${exportElsewhere.id}`);
    check("another module's export cannot be opened through this module", cross.status === 404, String(cross.status));
  }
  check("unknown src refused", (await admin.fetch(`/api/team/modules/${mod.id}/file?src=../../etc`)).status === 400);
  void other;

  // ───────────────────────── server reads it with credentials
  const t0 = Date.now();
  let p = await admin.json(`/api/team/modules/${mod.id}/process`, { method: "POST", body: "{}" });
  for (let i = 0; p.body?.success && !p.body.data.done && i < 100; i++) p = await admin.json(`/api/team/modules/${mod.id}/process?action=continue`, { method: "POST" });
  const job = (await admin.json(`/api/team/modules/${mod.id}/process`)).body?.data?.job;
  check("extraction reads the private PDF from storage", job?.status === "completed" && (await prisma.modulePage.count({ where: { moduleId: mod.id } })) === 3, `${job?.status} in ${Date.now() - t0} ms`);
  const an = await Promise.all([enrolled, admin].map(async (s) => (await s.fetch(`/api/team/modules/${mod.id}/analyze`, { method: "POST" })).status));
  check("analyze: student 403 (was open to any signed-in user), team 200", an.join(",") === "403,200", an.join(","));

  // ───────────────────────── Original PDF editor save → private revision
  const sv = await admin.json(`/api/team/modules/${mod.id}/save-native`, { method: "POST", body: JSON.stringify({ textEdits: [], changeSummary: "E2E save" }) });
  check("save-native succeeds", sv.status === 200 && sv.body?.success, `${sv.status} ${sv.body?.error ?? ""}`);
  check("save-native answers with a /file link", sv.body?.data?.fileUrl === `/api/team/modules/${mod.id}/file?src=version%3A${sv.body?.data?.versionId}` && noStorageText(sv.body), sv.body?.data?.fileUrl);
  const ver = await prisma.moduleVersion.findUnique({ where: { id: sv.body.data.versionId } });
  check("revision stored privately", String((ver?.snapshot as any)?.fileUrl).startsWith("private:modules/"));
  const verLoc = (await admin.fetch(sv.body.data.fileUrl)).headers.get("location") || "";
  const verPdf = await PDFDocument.load(Buffer.from(await (await fetch(verLoc)).arrayBuffer()));
  check("revision opens through its link and is a valid 3-page PDF", verPdf.getPageCount() === 3);
  const versions = await admin.json(`/api/team/modules/${mod.id}/versions`);
  const proj = await admin.json(`/api/team/modules/${mod.id}/editor-project`);
  check("versions and editor project JSON hold no storage link", noStorageText(versions.body) && noStorageText(proj.body));

  // ───────────────────────── design export → private
  const ex = await admin.json(`/api/team/modules/${mod.id}/design/render`, { method: "POST", body: JSON.stringify({ mode: "export", acknowledgeIssues: true }) });
  check("design export succeeds with storage configured", ex.status === 201, `${ex.status} ${ex.body?.error ?? ""}`);
  const exportId = ex.body?.data?.export?.id;
  check("export answers with a /file link only", ex.body?.data?.fileUrl === `/api/team/modules/${mod.id}/file?src=export%3A${exportId}` && noStorageText(ex.body));
  const exRow = await prisma.moduleExport.findUnique({ where: { id: exportId } });
  check("export stored privately", !!exRow?.fileUrl.startsWith("private:module-exports/"));
  const exLoc = (await admin.fetch(ex.body.data.fileUrl)).headers.get("location") || "";
  const exPdf = await PDFDocument.load(Buffer.from(await (await fetch(exLoc)).arrayBuffer()));
  check("exported PDF opens through its link", exPdf.getPageCount() > 0, String(exPdf.getPageCount()));
  check("exports JSON holds no storage link", noStorageText((await admin.json(`/api/team/modules/${mod.id}/export`)).body));

  // ───────────────────────── student download
  const sd = `/api/student/batches/${batch.id}/modules/${mod.id}/download`;
  check("student: a draft module cannot be downloaded (404)", (await enrolled.fetch(sd)).status === 404);
  await prisma.module.update({ where: { id: mod.id }, data: { status: "PUBLISHED", batch: "Some other batch" } });
  check("student: a published module of another batch cannot be downloaded (404)", (await enrolled.fetch(sd)).status === 404);
  await prisma.module.update({ where: { id: mod.id }, data: { batch: batch.code } });
  const sres = await enrolled.fetch(sd);
  const sloc = sres.headers.get("location") || "";
  check("student: published module of their batch → 5-minute signed link", sres.status === 302 && new URL(sloc).searchParams.get("X-Amz-Expires") === "300", `${sres.status}`);
  const sPdf = await PDFDocument.load(Buffer.from(await (await fetch(sloc)).arrayBuffer()));
  check("student gets the latest export", sPdf.getPageCount() === exPdf.getPageCount());
  check("student outside the batch: 403", (await outsider.fetch(sd)).status === 403);
  check("signed out: 401", (await anon.fetch(sd)).status === 401);
  await prisma.module.update({ where: { id: mod.id }, data: { status: "DRAFT" } });

  // ───────────────────────── existing public files → private (script)
  const legacyKey = `modules/E2E-LEGACY-${Date.now()}/old.pdf`;
  const legacy = await textPdf(2, "Legacy");
  await fetch(`${S3}/main/${legacyKey}`, { method: "PUT", body: legacy, headers: { "Content-Type": "application/pdf", Authorization: "test" } });
  const legacyUrl = `${S3}/main/${legacyKey}`;
  const lm = await prisma.module.create({ data: { code: `E2E-L-${Date.now()}`, title: "E2E legacy", originalFileUrl: legacyUrl, originalFileName: "old.pdf", originalFileSize: legacy.length, createdById: adminUser.id } });
  const lexp = await prisma.moduleExport.create({ data: { moduleId: lm.id, fileUrl: legacyUrl, fileName: "old.pdf", fileSize: legacy.length, createdById: adminUser.id } as any });
  check("legacy public file readable without a signature (the old gap)", (await bare("main", legacyKey)).ok);
  const env = {
    ...process.env,
    DATABASE_URL: DB,
    DIRECT_URL: DB,
    CLOUDFLARE_ACCOUNT_ID: "",
    STORAGE_ACCOUNT_ID: "",
    R2_ACCESS_KEY_ID: "local-test",
    R2_SECRET_ACCESS_KEY: "local-test",
    STORAGE_ENDPOINT: S3,
    R2_BUCKET_NAME: "main",
    R2_PUBLIC_BASE_URL: `${S3}/main`,
    R2_PRIVATE_BUCKET_NAME: "priv",
  };
  const run = (...args: string[]) =>
    execFileSync(process.execPath, [path.join(__dirname, "../node_modules/tsx/dist/cli.mjs"), "--tsconfig", path.join(__dirname, "../tsconfig.json"), path.join(__dirname, "move-module-pdfs-private.ts"), ...args], { env, encoding: "utf8", cwd: path.join(__dirname, "..") });
  const dry = run();
  check("move script dry run lists the file and changes nothing", dry.includes(legacyKey) && (await prisma.module.findUnique({ where: { id: lm.id } }))!.originalFileUrl === legacyUrl);
  const applied = run("--apply");
  const lm2 = await prisma.module.findUnique({ where: { id: lm.id } });
  const lexp2 = await prisma.moduleExport.findUnique({ where: { id: lexp.id } });
  check("--apply: source and export rows now private", lm2!.originalFileUrl === `private:${legacyKey}` && lexp2!.fileUrl === `private:${legacyKey}`, applied.split("\n").slice(-2).join(" "));
  check("--apply: public copy kept until asked", (await bare("main", legacyKey)).ok);
  const lLoc = (await admin.fetch(`/api/team/modules/${lm.id}/file?src=original`)).headers.get("location") || "";
  check("moved file opens through the file route", Buffer.from(await (await fetch(lLoc)).arrayBuffer()).equals(legacy));
  const again = run("--apply", "--delete-public");
  check("second run is a no-op for moved rows", /0 public module file\(s\) found|^0 /m.test(again) || !again.includes(legacyKey), again.split("\n")[0]);
  // the public copy is no longer referenced by any row → a dedicated delete run removes it
  const lm3 = await prisma.module.create({ data: { code: `E2E-L2-${Date.now()}`, title: "E2E legacy 2", originalFileUrl: `${S3}/main/${legacyKey.replace("old.pdf", "two.pdf")}`, originalFileName: "two.pdf", originalFileSize: legacy.length, createdById: adminUser.id } });
  await fetch(`${S3}/main/${legacyKey.replace("old.pdf", "two.pdf")}`, { method: "PUT", body: legacy, headers: { "Content-Type": "application/pdf", Authorization: "test" } });
  run("--apply", "--delete-public");
  check("--delete-public removes the public copy once nothing points at it", (await bare("main", legacyKey.replace("old.pdf", "two.pdf"))).status === 404 && (await bare("priv", legacyKey.replace("old.pdf", "two.pdf"))).status === 403);

  // ───────────────────────── delete removes private files
  const del = await admin.json(`/api/team/modules/${lm3.id}`, { method: "DELETE" });
  const leftover = await fetch(`${S3}/priv/${legacyKey.replace("old.pdf", "two.pdf")}`, { headers: { Authorization: "test" } });
  check("deleting a module removes its private file", del.status === 200 && leftover.status === 404, `${del.status} ${leftover.status}`);

  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
