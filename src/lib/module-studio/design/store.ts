import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { designSchema, type ModuleDesign } from "./model";
import { defaultDesign } from "./presets";
export { designToTemplateData, applyTemplateData } from "./presets";

/**
 * Where designs live.
 *  - A module's design: one ModuleVersion row per module (fixed label — no
 *    schema change), with a revision number so an older save can never
 *    overwrite newer edits (two tabs, two people).
 *  - Saved templates: the module_design_templates table (migration
 *    20261018000000_module_design_templates). Until that migration is applied
 *    the template calls answer with TemplatesUnavailableError instead of failing.
 */

export const DESIGN_LABEL = "Module design";
const KIND = "MODULE_DESIGN";

export class DesignConflictError extends Error {
  constructor(public revision: number) {
    super("This design was saved somewhere else (another tab or person) after you opened it.");
    this.name = "DesignConflictError";
  }
}
export class TemplatesUnavailableError extends Error {
  constructor() {
    super("Saved templates need a one-time database update (migration 20261018000000_module_design_templates) that has not been applied yet.");
    this.name = "TemplatesUnavailableError";
  }
}

type Stored = { kind: string; revision: number; savedAt: string; design: unknown };
const asStored = (v: unknown): Stored | null => {
  const s = v as Stored | null;
  return s && typeof s === "object" && s.kind === KIND && typeof s.revision === "number" ? s : null;
};

export async function moduleForDesign(moduleId: string) {
  return prisma.module.findUnique({
    where: { id: moduleId },
    select: { id: true, code: true, title: true, subject: true, class: true, batch: true, chapter: true, facultyName: true, academicYear: true, brandProfile: { select: { logoUrl: true } } },
  });
}

/** The saved design, or a new one made from the module's details. Invalid old data falls back to a fresh design (reported). */
export async function loadDesign(moduleId: string): Promise<{ design: ModuleDesign; revision: number; savedAt: string | null; isNew: boolean; repaired: boolean } | null> {
  const m = await moduleForDesign(moduleId);
  if (!m) return null;
  const row = await prisma.moduleVersion.findFirst({ where: { moduleId, label: DESIGN_LABEL }, orderBy: { createdAt: "asc" } });
  const stored = row ? asStored(row.snapshot) : null;
  const fresh = defaultDesign({ ...m, logoUrl: m.brandProfile?.logoUrl ?? null });
  if (!stored) return { design: fresh, revision: 0, savedAt: null, isNew: true, repaired: false };
  const parsed = designSchema.safeParse(stored.design);
  return { design: parsed.success ? parsed.data : fresh, revision: stored.revision, savedAt: stored.savedAt, isNew: false, repaired: !parsed.success };
}

export async function saveDesign(moduleId: string, userId: string, design: ModuleDesign, baseRevision: number) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`module-design:${moduleId}`}))`;
    const row = await tx.moduleVersion.findFirst({ where: { moduleId, label: DESIGN_LABEL }, orderBy: { createdAt: "asc" } });
    const cur = row ? asStored(row.snapshot) : null;
    const curRev = cur?.revision ?? 0;
    if (curRev !== baseRevision) throw new DesignConflictError(curRev);
    const next: Stored = { kind: KIND, revision: curRev + 1, savedAt: new Date().toISOString(), design };
    if (row) await tx.moduleVersion.update({ where: { id: row.id }, data: { snapshot: next as any } });
    else await tx.moduleVersion.create({ data: { moduleId, label: DESIGN_LABEL, snapshot: next as any, createdById: userId } });
    return { revision: next.revision, savedAt: next.savedAt };
  });
}

/** Other modules that have a design (to copy one). */
export async function listModuleDesigns(exceptModuleId?: string) {
  const rows = await prisma.moduleVersion.findMany({ where: { label: DESIGN_LABEL, ...(exceptModuleId ? { moduleId: { not: exceptModuleId } } : {}) }, select: { moduleId: true, snapshot: true, module: { select: { title: true, code: true, subject: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  return rows.filter((r) => asStored(r.snapshot)).map((r) => ({ moduleId: r.moduleId, title: r.module.title, code: r.module.code, subject: r.module.subject, savedAt: asStored(r.snapshot)!.savedAt }));
}

export async function designOfModule(moduleId: string): Promise<ModuleDesign | null> {
  const row = await prisma.moduleVersion.findFirst({ where: { moduleId, label: DESIGN_LABEL } });
  const s = row ? asStored(row.snapshot) : null;
  const p = s ? designSchema.safeParse(s.design) : null;
  return p?.success ? p.data : null;
}

const missingTable = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2021" || e.code === "P2022");

export async function listTemplates() {
  try {
    return await prisma.moduleDesignTemplate.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, description: true, createdAt: true, data: true } });
  } catch (e) {
    if (missingTable(e)) throw new TemplatesUnavailableError();
    throw e;
  }
}

export async function createTemplate(input: { name: string; description?: string | null; data: unknown; userId: string }) {
  try {
    // Saving under a name that already exists updates that template (no look-alike duplicates).
    const same = await prisma.moduleDesignTemplate.findFirst({ where: { name: { equals: input.name, mode: "insensitive" } }, select: { id: true } });
    if (same) {
      const t = await prisma.moduleDesignTemplate.update({ where: { id: same.id }, data: { data: input.data as any, description: input.description ?? undefined }, select: { id: true, name: true } });
      return { ...t, updated: true };
    }
    const t = await prisma.moduleDesignTemplate.create({ data: { name: input.name, description: input.description ?? null, data: input.data as any, createdById: input.userId }, select: { id: true, name: true } });
    return { ...t, updated: false };
  } catch (e) {
    if (missingTable(e)) throw new TemplatesUnavailableError();
    throw e;
  }
}

export async function getTemplate(id: string) {
  try {
    return await prisma.moduleDesignTemplate.findUnique({ where: { id } });
  } catch (e) {
    if (missingTable(e)) throw new TemplatesUnavailableError();
    throw e;
  }
}

export async function deleteTemplate(id: string) {
  try {
    await prisma.moduleDesignTemplate.delete({ where: { id } });
  } catch (e) {
    if (missingTable(e)) throw new TemplatesUnavailableError();
    throw e;
  }
}
