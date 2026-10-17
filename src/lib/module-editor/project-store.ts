import "server-only";
import { prisma } from "@/lib/db";
import { PROJECT_DRAFT_LABEL, PROJECT_KIND, PROJECT_SCHEMA } from "./overlay-model";

/**
 * The PDF editor's working copy: the editable document (objects, page order,
 * styles), kept apart from the source PDF and from exported PDFs. One row per
 * module (a ModuleVersion with a fixed label — no schema change), saved often
 * by autosave, guarded by a revision number so an older save can never
 * overwrite newer edits (e.g. from a second tab).
 */

export const MAX_PROJECT_BYTES = 3_500_000; // the request limit is ~4.5 MB; pictures travel as storage links

export class ProjectConflictError extends Error {
  constructor(public revision: number, public savedAt: string | null) {
    super("This document was changed somewhere else (another tab or person) after you opened it.");
    this.name = "ProjectConflictError";
  }
}

type Draft = { kind: string; schema: number; revision: number; savedAt: string; savedById: string; project: unknown };

function asDraft(snapshot: unknown): Draft | null {
  const s = snapshot as Draft | null;
  return s && typeof s === "object" && s.kind === PROJECT_KIND && typeof s.revision === "number" ? s : null;
}

/** The working copy, and the newest explicitly saved version of this editor (whichever is newer wins on open). */
export async function loadEditorProject(moduleId: string) {
  const rows = await prisma.moduleVersion.findMany({ where: { moduleId }, orderBy: { createdAt: "desc" }, select: { id: true, label: true, snapshot: true, createdAt: true } });
  const draftRow = rows.find((r) => r.label === PROJECT_DRAFT_LABEL);
  const draft = draftRow ? asDraft(draftRow.snapshot) : null;
  // Saves from this editor are objects with textEdits; the block editor saves arrays of pages.
  const saved = rows.find((r) => r.label !== PROJECT_DRAFT_LABEL && r.snapshot && !Array.isArray(r.snapshot) && Array.isArray((r.snapshot as any).textEdits));
  const savedAt = saved?.createdAt.toISOString() ?? null;
  const useDraft = draft && (!savedAt || draft.savedAt >= savedAt);
  return {
    revision: draft?.revision ?? 0,
    savedAt: useDraft ? draft!.savedAt : savedAt,
    source: useDraft ? ("working-copy" as const) : saved ? ("saved-version" as const) : ("none" as const),
    project: useDraft ? draft!.project : saved ? saved.snapshot : null,
    savedVersionId: saved?.id ?? null,
  };
}

export async function saveEditorProject(moduleId: string, userId: string, project: unknown, baseRevision: number) {
  const body = JSON.stringify(project);
  if (body.length > MAX_PROJECT_BYTES) {
    throw new Error(`The document is too large to save (${Math.round(body.length / 1024)} KB). Pictures should be uploaded, not embedded — try again after they finish uploading.`);
  }
  return prisma.$transaction(async (tx) => {
    // One writer per module at a time; the revision check below then decides who wins.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`module-project:${moduleId}`}))`;
    const row = await tx.moduleVersion.findFirst({ where: { moduleId, label: PROJECT_DRAFT_LABEL }, orderBy: { createdAt: "asc" } });
    const current = row ? asDraft(row.snapshot) : null;
    const currentRevision = current?.revision ?? 0;
    if (currentRevision !== baseRevision) throw new ProjectConflictError(currentRevision, current?.savedAt ?? null);
    const next: Draft = { kind: PROJECT_KIND, schema: PROJECT_SCHEMA, revision: currentRevision + 1, savedAt: new Date().toISOString(), savedById: userId, project };
    if (row) await tx.moduleVersion.update({ where: { id: row.id }, data: { snapshot: next as any } });
    else await tx.moduleVersion.create({ data: { moduleId, label: PROJECT_DRAFT_LABEL, snapshot: next as any, createdById: userId } });
    return { revision: next.revision, savedAt: next.savedAt };
  });
}
