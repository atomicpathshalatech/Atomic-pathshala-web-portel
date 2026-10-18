/**
 * Moves module PDFs (sources, exports, saved revisions) from the public bucket
 * into the private bucket (R2_PRIVATE_BUCKET_NAME) and points the rows at them.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/move-module-pdfs-private.ts            # dry run: lists what would move
 *   npx tsx --tsconfig tsconfig.json scripts/move-module-pdfs-private.ts --apply    # copy + update rows
 *   npx tsx --tsconfig tsconfig.json scripts/move-module-pdfs-private.ts --apply --delete-public
 *
 * Safe to run again: rows already private are skipped. Each file is copied and
 * its size checked before any row changes. A public copy is deleted only with
 * --delete-public, and only when no module row (page content, version, export,
 * source) still mentions its link. Prints counts and keys, never file contents.
 */
import Module from "node:module";
import path from "node:path";
const origResolve = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (req: string, ...a: any[]) {
  if (req === "server-only") return path.join(__dirname, "fixtures/empty-module.cjs");
  return origResolve.call(this, req, ...a);
};

import { PrismaClient } from "@prisma/client";

const apply = process.argv.includes("--apply");
const deletePublic = process.argv.includes("--delete-public");
const prisma = new PrismaClient();

async function main() {
  // Loaded after the server-only stub above is in place.
  const { copyObject, deleteObject, getObjectBuffer, keyFromPublicUrl, mainBucketName, privateBucketName } = await import("../src/lib/storage");
  const main = mainBucketName();
  const priv = privateBucketName();
  if (!main) throw new Error("Storage is not configured (R2_* variables).");
  if (!priv) throw new Error("Set R2_PRIVATE_BUCKET_NAME to the private bucket first.");
  if (priv === main) throw new Error("R2_PRIVATE_BUCKET_NAME must be a different bucket from R2_BUCKET_NAME.");

  // Every public link a module PDF row holds, with the rows that hold it.
  const links = new Map<string, { modules: string[]; exports: string[]; versions: string[] }>();
  const add = (url: string, kind: "modules" | "exports" | "versions", id: string) => {
    if (!url || url.startsWith("private:") || !keyFromPublicUrl(url)) return;
    const e = links.get(url) ?? { modules: [], exports: [], versions: [] };
    e[kind].push(id);
    links.set(url, e);
  };
  for (const m of await prisma.module.findMany({ select: { id: true, originalFileUrl: true } })) add(m.originalFileUrl, "modules", m.id);
  for (const e of await prisma.moduleExport.findMany({ select: { id: true, fileUrl: true } })) add(e.fileUrl, "exports", e.id);
  for (const v of await prisma.moduleVersion.findMany({ select: { id: true, snapshot: true } })) {
    const f = (v.snapshot as { fileUrl?: unknown } | null)?.fileUrl;
    if (typeof f === "string" && !Array.isArray(v.snapshot)) add(f, "versions", v.id);
  }

  console.log(`${links.size} public module file(s) found${apply ? "" : " (dry run — nothing changes; pass --apply)"}.`);
  let moved = 0;
  let failed = 0;
  let deleted = 0;
  for (const [url, rows] of links) {
    const key = decodeURIComponent(keyFromPublicUrl(url)!);
    const label = `${key}  (sources ${rows.modules.length}, exports ${rows.exports.length}, revisions ${rows.versions.length})`;
    if (!apply) {
      console.log("  would move", label);
      continue;
    }
    try {
      const original = await getObjectBuffer(main, key);
      if (!original) {
        console.warn("  missing in storage, left as it is:", key);
        failed++;
        continue;
      }
      await copyObject({ fromBucket: main, fromKey: key, toBucket: priv, toKey: key });
      const copy = await getObjectBuffer(priv, key);
      if (!copy || copy.length !== original.length) throw new Error("the copy does not match the original");
      const stored = `private:${key}`;
      await prisma.$transaction(async (tx) => {
        if (rows.modules.length) await tx.module.updateMany({ where: { id: { in: rows.modules }, originalFileUrl: url }, data: { originalFileUrl: stored } });
        if (rows.exports.length) await tx.moduleExport.updateMany({ where: { id: { in: rows.exports }, fileUrl: url }, data: { fileUrl: stored } });
        for (const id of rows.versions) {
          const v = await tx.moduleVersion.findUnique({ where: { id }, select: { snapshot: true } });
          const snap = v?.snapshot as Record<string, unknown> | null;
          if (snap && snap.fileUrl === url) await tx.moduleVersion.update({ where: { id }, data: { snapshot: { ...snap, fileUrl: stored } as any } });
        }
      });
      moved++;
      console.log("  moved", label);

      if (deletePublic) {
        const pattern = `%${url.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
        const [still] = await prisma.$queryRaw<{ n: bigint }[]>`
          SELECT (SELECT COUNT(*) FROM "modules" WHERE "originalFileUrl" = ${url})
               + (SELECT COUNT(*) FROM "module_exports" WHERE "fileUrl" = ${url})
               + (SELECT COUNT(*) FROM "module_versions" WHERE "snapshot"::text LIKE ${pattern})
               + (SELECT COUNT(*) FROM "module_pages" WHERE "elements"::text LIKE ${pattern} OR "referenceImageUrl" = ${url}) AS n`;
        if (Number(still?.n ?? 1) === 0) {
          await deleteObject(main, key);
          deleted++;
        } else {
          console.log("    public copy kept — still mentioned by", Number(still.n), "row(s)");
        }
      }
    } catch (err) {
      failed++;
      console.error("  FAILED", key, "—", err instanceof Error ? err.message : err);
    }
  }
  if (apply) console.log(`Done: ${moved} moved, ${failed} failed${deletePublic ? `, ${deleted} public copies deleted` : " (public copies kept; run again with --delete-public to remove them)"}.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
