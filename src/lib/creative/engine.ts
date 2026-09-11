import "server-only";
import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";
import { uploadFile } from "@/lib/storage";
import type { CreativeType } from "@prisma/client";
import type { LayoutConfig } from "./layout-types";
import type { BackgroundValue } from "./background-types";
import { DEFAULT_THEMES } from "./background-types";
import { DEFAULT_TEMPLATES_BY_TYPE } from "./default-templates";
import { buildCreativeElement } from "./render";
import { computeSourceVersionHash } from "./hash";
import { loadDefaultCreativeFont } from "./fonts";
import { resolveBatchContent } from "./resolvers/batch";
import { resolveTestSeriesContent } from "./resolvers/test-series";
import { resolveChapterContent } from "./resolvers/chapter";
import { resolveLectureContent, resolveLectureStartSlideContent } from "./resolvers/lecture";
import type { CreativeContentData } from "./content-types";

const SOURCE_ENTITY_TYPE: Record<CreativeType, string> = {
  BATCH: "Batch",
  TEST_SERIES: "TestSeries",
  CHAPTER: "Chapter",
  LECTURE: "Lecture",
  LECTURE_START_SLIDE: "BatchSchedule",
};

async function resolveContent(type: CreativeType, entityId: string): Promise<CreativeContentData | null> {
  switch (type) {
    case "BATCH":
      return resolveBatchContent(entityId);
    case "TEST_SERIES":
      return resolveTestSeriesContent(entityId);
    case "CHAPTER":
      return resolveChapterContent(entityId);
    case "LECTURE":
      return resolveLectureContent(entityId);
    case "LECTURE_START_SLIDE":
      return resolveLectureStartSlideContent(entityId);
  }
}

async function loadTemplate(type: CreativeType, templateId?: string | null) {
  if (templateId) {
    const t = await prisma.creativeTemplate.findUnique({ where: { id: templateId } });
    if (t && t.isActive) return t;
  }
  const t = await prisma.creativeTemplate.findFirst({ where: { type, isActive: true, isDefault: true } });
  if (t) return t;
  // Nothing seeded/selected yet — fall back to the built-in default so
  // generation never hard-fails just because the admin hasn't visited the
  // Templates page.
  return { id: null as string | null, layoutConfig: DEFAULT_TEMPLATES_BY_TYPE[type] as unknown };
}

async function loadBackground(backgroundId?: string | null) {
  if (backgroundId) {
    const b = await prisma.creativeBackground.findUnique({ where: { id: backgroundId } });
    if (b && b.isActive) return b;
  }
  const b = await prisma.creativeBackground.findFirst({ where: { isActive: true, isDefault: true } });
  if (b) return b;
  return { id: null as string | null, value: (DEFAULT_THEMES[0]?.value ?? { kind: "SOLID", color: "#0f172a" }) as unknown };
}

export type GenerateCreativeResult =
  | { ok: true; skipped: true; assetUrl: string }
  | { ok: true; skipped: false; assetUrl: string }
  | { ok: false; reason: string };

/**
 * The reusable creative-generation entry point (spec section 13). One call
 * shape for every type — BATCH, TEST_SERIES, CHAPTER, LECTURE,
 * LECTURE_START_SLIDE — nothing type-specific happens outside the small
 * resolver + default-template lookup above.
 *
 * Idempotent by design: computes the content-derived hash first and skips
 * the actual render (Satori + upload) entirely when it matches what's
 * already stored — this is what makes it safe to call from a hot path like
 * "Start Class" without regenerating on every request.
 */
export async function generateCreative(
  type: CreativeType,
  entityId: string,
  opts: { templateId?: string | null; backgroundId?: string | null; force?: boolean } = {}
): Promise<GenerateCreativeResult> {
  try {
    const content = await resolveContent(type, entityId);
    if (!content) return { ok: false, reason: "Source entity not found." };

    const existing = await prisma.generatedCreative.findUnique({ where: { type_sourceEntityId: { type, sourceEntityId: entityId } } });
    const templateId = opts.templateId ?? existing?.templateId ?? null;
    const backgroundId = opts.backgroundId ?? existing?.backgroundId ?? null;

    const template = await loadTemplate(type, templateId);
    const background = await loadBackground(backgroundId);
    const layout = template.layoutConfig as unknown as LayoutConfig;
    const backgroundValue = background.value as unknown as BackgroundValue;

    const hash = computeSourceVersionHash(content, template.id, background.id);

    if (!opts.force && existing?.status === "READY" && existing.sourceVersionHash === hash && existing.assetUrl) {
      return { ok: true, skipped: true, assetUrl: existing.assetUrl };
    }

    const element = buildCreativeElement(layout, content, backgroundValue);
    const image = new ImageResponse(element, {
      width: layout.width,
      height: layout.height,
      fonts: [{ name: "Inter", data: loadDefaultCreativeFont(), weight: 400, style: "normal" }],
    });
    const arrayBuffer = await image.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const key = `creatives/${type.toLowerCase()}/${entityId}-${Date.now()}.png`;
    const assetUrl = await uploadFile({ key, body: buffer, contentType: "image/png" });

    await prisma.generatedCreative.upsert({
      where: { type_sourceEntityId: { type, sourceEntityId: entityId } },
      create: {
        type,
        sourceEntityType: SOURCE_ENTITY_TYPE[type],
        sourceEntityId: entityId,
        templateId: template.id,
        backgroundId: background.id,
        assetUrl,
        width: layout.width,
        height: layout.height,
        sourceVersionHash: hash,
        status: "READY",
      },
      update: {
        templateId: template.id,
        backgroundId: background.id,
        assetUrl,
        width: layout.width,
        height: layout.height,
        sourceVersionHash: hash,
        status: "READY",
        errorMessage: null,
      },
    });

    // Batch/TestSeries already have a thumbnailUrl field that every existing
    // listing/card already renders — writing the freshly generated asset
    // there means zero new UI wiring for those two types, and respects a
    // manual override (thumbnailIsAuto flips to false the moment an admin
    // uploads their own thumbnail through the existing ThumbnailUploader).
    if (type === "BATCH") {
      await prisma.batch
        .updateMany({ where: { id: entityId, thumbnailIsAuto: true }, data: { thumbnailUrl: assetUrl } })
        .catch(() => {});
    } else if (type === "TEST_SERIES") {
      await prisma.testSeries
        .updateMany({ where: { id: entityId, thumbnailIsAuto: true }, data: { thumbnailUrl: assetUrl } })
        .catch(() => {});
    }

    return { ok: true, skipped: false, assetUrl };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Unknown rendering error";
    console.error(`[creative] generation failed for ${type}:${entityId}:`, err);
    await prisma.generatedCreative
      .upsert({
        where: { type_sourceEntityId: { type, sourceEntityId: entityId } },
        create: { type, sourceEntityType: SOURCE_ENTITY_TYPE[type], sourceEntityId: entityId, status: "FAILED", errorMessage: reason },
        update: { status: "FAILED", errorMessage: reason },
      })
      .catch(() => {});
    return { ok: false, reason };
  }
}

/**
 * Auto-regeneration hook (spec section 14/24) — call this, AWAITED, right
 * after batch/test-series teacher assignment changes, chapter/lecture
 * create, or an educator PNG update. It never throws (a failed/slow render
 * must not fail the real mutation — same principle as the email/
 * notification systems), so it's safe to await unconditionally; the
 * mutation's own response is only delayed by however long a single Satori
 * render + upload takes (typically well under a second), which is
 * deliberate — a true fire-and-forget call here is NOT safe, since a
 * serverless function's background work is not guaranteed to keep running
 * once its response has been sent (the same reasoning that ruled out
 * fire-and-forget for the email campaign queue).
 */
export async function regenerateCreativeAwaited(type: CreativeType, entityId: string): Promise<void> {
  await generateCreative(type, entityId).catch((err) =>
    console.error(`[creative] regenerate failed for ${type}:${entityId}:`, err)
  );
}
