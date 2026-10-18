/**
 * Module PDF storage: private bucket, signed links, server reads, adoption of
 * browser uploads, deletion — against a local S3-compatible server.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/test-module-files.ts
 */
import Module from "node:module";
import path from "node:path";
const origResolve = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (req: string, ...a: any[]) {
  if (req === "server-only") return path.join(__dirname, "fixtures/empty-module.cjs");
  return origResolve.call(this, req, ...a);
};

import { startFakeS3 } from "./lib/fake-s3";

const PORT = 9561;
const BASE = `http://127.0.0.1:${PORT}`;
for (const k of ["CLOUDFLARE_ACCOUNT_ID", "STORAGE_ACCOUNT_ID", "STORAGE_PUBLIC_URL", "STORAGE_BUCKET_NAME"]) delete process.env[k];
Object.assign(process.env, {
  R2_ACCESS_KEY_ID: "test-key",
  R2_SECRET_ACCESS_KEY: "test-secret",
  STORAGE_ENDPOINT: BASE,
  R2_BUCKET_NAME: "main",
  R2_PUBLIC_BASE_URL: `${BASE}/main`,
});

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || detail === undefined ? "" : `  — ${typeof detail === "string" ? detail : JSON.stringify(detail)}`}`);
}

async function main() {
  const s3 = await startFakeS3(PORT, ["priv"]);
  const mf = await import("../src/lib/module-studio/module-files");
  const pdf = Buffer.from("%PDF-1.4\n% test module\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

  // ── without a private bucket: behaviour as before (public link stored) ──
  delete process.env.R2_PRIVATE_BUCKET_NAME;
  const pub = await mf.storeModuleFile({ key: "modules/M1/a.pdf", body: pdf, contentType: "application/pdf" });
  check("no private bucket → public link stored", pub === `${BASE}/main/modules/M1/a.pdf`, pub);
  check("server reads a public-bucket file with credentials", (await mf.readModuleFile(pub)).equals(pdf));
  const pubLink = await mf.moduleFileLink(pub);
  check("link to an old public file is a signed one", !!pubLink && pubLink.includes("X-Amz-Signature"), pubLink);

  // ── with a private bucket ──
  process.env.R2_PRIVATE_BUCKET_NAME = "priv";
  const priv = await mf.storeModuleFile({ key: "modules/M2/b.pdf", body: pdf, contentType: "application/pdf" });
  check("private bucket → stored as private:<key>", priv === "private:modules/M2/b.pdf", priv);
  check("file is in the private bucket", s3.objects.has("priv/modules/M2/b.pdf"));
  check("nothing written to the public bucket", !s3.objects.has("main/modules/M2/b.pdf"));
  const bare = await fetch(`${BASE}/priv/modules/M2/b.pdf`);
  check("a bare link to the private file is refused (403)", bare.status === 403, bare.status);
  check("server reads the private file", (await mf.readModuleFile(priv)).equals(pdf));

  const link = (await mf.moduleFileLink(priv))!;
  const viaLink = await fetch(link);
  check("signed link opens the file", viaLink.ok && Buffer.from(await viaLink.arrayBuffer()).equals(pdf), viaLink.status);
  check("signed link is inline + PDF", viaLink.headers.get("content-disposition") === "inline" && viaLink.headers.get("content-type") === "application/pdf", [...viaLink.headers]);
  check("signed link lasts 10 minutes", new URL(link).searchParams.get("X-Amz-Expires") === "600", link);
  const dl = await fetch((await mf.moduleFileLink(priv, { downloadName: 'Rasayan "Ch 1" हिंदी.pdf' }))!);
  const cd = dl.headers.get("content-disposition") || "";
  check("download link asks to save, with a safe UTF-8 name", cd.startsWith("attachment; filename*=UTF-8''") && !cd.includes('"'), cd);
  const ranged = await fetch(link, { headers: { Range: "bytes=0-7" } });
  check("signed link serves byte ranges (pdf.js)", ranged.status === 206 && (await ranged.text()) === "%PDF-1.4", ranged.status);

  // expired link
  const u = new URL(link);
  u.searchParams.set("X-Amz-Date", "20200101T000000Z");
  check("an expired signed link is refused", (await fetch(u)).status === 403);

  // ── a browser upload (public bucket) adopted into the private bucket ──
  s3.objects.set("main/modules/upload-1/c.pdf", { body: pdf, type: "application/pdf" });
  const adopted = await mf.adoptUploadedModuleFile("modules/upload-1/c.pdf", "modules/M3/c.pdf");
  check("browser upload moves to the private bucket", adopted === "private:modules/M3/c.pdf" && s3.objects.has("priv/modules/M3/c.pdf"), adopted);
  check("the public copy of the upload is removed", !s3.objects.has("main/modules/upload-1/c.pdf"));
  check("public link of the removed upload answers 404", (await fetch(`${BASE}/main/modules/upload-1/c.pdf`)).status === 404);

  // ── refs ──
  const r2style = mf.moduleFileRef("https://acct.r2.cloudflarestorage.com/main/modules/M9/x.pdf?X-Amz-Signature=abc");
  check("signed R2 link → main bucket key", JSON.stringify(r2style) === JSON.stringify({ bucket: "main", key: "modules/M9/x.pdf" }), r2style);
  check("someone else's link is passed through", JSON.stringify(mf.moduleFileRef("https://example.org/a.pdf")) === JSON.stringify({ external: "https://example.org/a.pdf" }));
  check("garbage → no file", mf.moduleFileRef("not a link") === null);
  delete process.env.R2_PRIVATE_BUCKET_NAME;
  check("private file without the bucket configured → unreachable, not public", mf.moduleFileRef(priv) === null);
  let missingErr = "";
  await mf.readModuleFile(priv).catch((e: Error) => (missingErr = e.name));
  check("reading it then fails clearly", missingErr === "ModuleFileMissingError", missingErr);
  process.env.R2_PRIVATE_BUCKET_NAME = "priv";
  missingErr = "";
  await mf.readModuleFile("private:modules/none.pdf").catch((e: Error) => (missingErr = e.name));
  check("a missing object fails clearly", missingErr === "ModuleFileMissingError", missingErr);

  // ── API shape: no stored value reaches the browser ──
  const shaped = mf.withModuleFileRoutes({
    id: "mod1",
    originalFileUrl: priv,
    exportHistory: [{ id: "e1", fileUrl: "private:module-exports/x.pdf" }],
    versions: [
      { id: "v1", snapshot: { fileUrl: pub, textEdits: [] } },
      { id: "v2", snapshot: [{ pageNumber: 1 }] },
    ],
  });
  const text = JSON.stringify(shaped);
  check("module JSON holds no storage link or key", !text.includes("private:") && !text.includes(BASE), text);
  check("source → /file?src=original", shaped.originalFileUrl === "/api/team/modules/mod1/file?src=original");
  check("export → /file?src=export:id", shaped.exportHistory[0].fileUrl === "/api/team/modules/mod1/file?src=export%3Ae1");
  check("revision → /file?src=version:id", (shaped.versions[0].snapshot as any).fileUrl === "/api/team/modules/mod1/file?src=version%3Av1");
  check("block-editor versions (arrays) untouched", Array.isArray(shaped.versions[1].snapshot));

  // ── delete ──
  check("delete removes a private file", (await mf.deleteModuleFile(priv)) && !s3.objects.has("priv/modules/M2/b.pdf"));
  check("delete removes a public file", (await mf.deleteModuleFile(pub)) && !s3.objects.has("main/modules/M1/a.pdf"));
  check("delete ignores someone else's link", (await mf.deleteModuleFile("https://example.org/a.pdf")) === false);

  await s3.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
