import "server-only";
import { prisma } from "@/lib/db";
import { deleteFile, keyFromPublicUrl } from "@/lib/storage";

/**
 * Deletes a module together with its files in storage — the source PDF, page
 * reference images, extracted figures and exported PDFs — so the space is
 * actually freed (deleting only the database row left every file behind).
 *
 * A file another module still uses (a copy / re-brand of the same source) is
 * kept: only files nothing else points to are removed.
 */

/** Every storage URL (ours) that appears anywhere inside a JSON value. */
function collectUrls(value: unknown, out: Set<string>): void {
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value) && keyFromPublicUrl(value)) out.add(value);
    else if (value.includes("http")) {
      // Markdown / HTML text with embedded image links.
      for (const m of value.matchAll(/https?:\/\/[^\s"'()<>\\]+/g)) if (keyFromPublicUrl(m[0])) out.add(m[0]);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectUrls(v, out);
    return;
  }
  if (value && typeof value === "object") for (const v of Object.values(value)) collectUrls(v, out);
}

export async function deleteModuleWithFiles(moduleId: string): Promise<{ filesDeleted: number; filesKept: number } | null> {
  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    select: {
      id: true,
      originalFileUrl: true,
      pages: { select: { referenceImageUrl: true, elements: true } },
      assets: { select: { storageUrl: true } },
      versions: { select: { snapshot: true } },
      exportHistory: { select: { fileUrl: true } },
    },
  });
  if (!mod) return null;

  const urls = new Set<string>();
  collectUrls(mod.originalFileUrl, urls);
  for (const p of mod.pages) {
    collectUrls(p.referenceImageUrl, urls);
    collectUrls(p.elements, urls);
  }
  for (const a of mod.assets) collectUrls(a.storageUrl, urls);
  for (const v of mod.versions) collectUrls(v.snapshot, urls);
  for (const e of mod.exportHistory) collectUrls(e.fileUrl, urls);

  // Files still used by another module stay.
  const shared = new Set<string>();
  const list = Array.from(urls);
  if (list.length > 0) {
    const [mods, assets, exportsRows] = await Promise.all([
      prisma.module.findMany({ where: { id: { not: moduleId }, originalFileUrl: { in: list } }, select: { originalFileUrl: true } }),
      prisma.moduleAsset.findMany({ where: { moduleId: { not: moduleId }, storageUrl: { in: list } }, select: { storageUrl: true } }),
      prisma.moduleExport.findMany({ where: { moduleId: { not: moduleId }, fileUrl: { in: list } }, select: { fileUrl: true } }),
    ]);
    for (const m of mods) shared.add(m.originalFileUrl);
    for (const a of assets) shared.add(a.storageUrl);
    for (const e of exportsRows) shared.add(e.fileUrl);

    // Links inside other modules' page content / saved versions.
    const patterns = list.map((u) => `%${u.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    const pageHits = await prisma.$queryRaw<{ body: string }[]>`
      SELECT "elements"::text || ' ' || COALESCE("referenceImageUrl", '') AS body
      FROM "module_pages" WHERE "moduleId" <> ${moduleId} AND ("elements"::text LIKE ANY(${patterns}) OR "referenceImageUrl" = ANY(${list}))`;
    const versionHits = await prisma.$queryRaw<{ body: string }[]>`
      SELECT "snapshot"::text AS body FROM "module_versions" WHERE "moduleId" <> ${moduleId} AND "snapshot"::text LIKE ANY(${patterns})`;
    for (const row of [...pageHits, ...versionHits]) for (const u of list) if (row.body.includes(u)) shared.add(u);
  }

  // Rows first (pages, assets, versions, jobs and exports cascade), then the files.
  await prisma.module.delete({ where: { id: moduleId } });

  let filesDeleted = 0;
  for (const url of list) {
    if (shared.has(url)) continue;
    const key = keyFromPublicUrl(url);
    if (!key) continue;
    try {
      await deleteFile(key);
      filesDeleted++;
    } catch (err) {
      console.warn("[module_delete_file_warning]", key, err instanceof Error ? err.message : err);
    }
  }
  return { filesDeleted, filesKept: shared.size };
}
