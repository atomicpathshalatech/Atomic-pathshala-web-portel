import "server-only";
import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";
import { uploadFile } from "@/lib/storage";
import type { CreativeType } from "@prisma/client";
import type { LayoutConfig } from "./layout-types";
import type { BackgroundValue } from "./background-types";
import { DEFAULT_THEMES } from "./background-types";
import { DEFAULT_TEMPLATES_BY_TYPE } from "./default-templates";
import { buildCreativeElement, cleanElementForSatori } from "./render";
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
 * A remote (non-data:) educator image URL is pre-fetched and embedded as a
 * data: URI before being handed to Satori, rather than letting Satori fetch
 * it directly. Confirmed via a separate, real bug in vercel/satori's own
 * SSRF-safe fetch (`safeServerFetch`, src/handler/url-safety.ts): it does
 * `new URL(location, currentUrl)` on a redirect's `Location` header while
 * following redirects, and throws a bare, contextless "Invalid URL"
 * TypeError if that header is malformed or relative in a way it can't
 * resolve — Cloudflare R2's public `pub-*.r2.dev` bucket URLs can issue
 * exactly this kind of redirect. A plain Node `fetch()` (used here) follows
 * redirects correctly with no such bug. Any failure here falls back to the
 * existing placeholder silhouette rather than failing the whole generation.
 */
async function toEmbeddableDataUri(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/png";
    const buffer = Buffer.from(await res.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

async function sanitizeEducatorImages(content: CreativeContentData): Promise<CreativeContentData> {
  if (content.educators.length === 0) return content;
  const checked = await Promise.all(
    content.educators.map(async (e) => {
      if (!e.imageUrl) return e;
      if (e.imageUrl.startsWith("data:")) return e; // already embeddable, nothing to fetch
      const dataUri = await toEmbeddableDataUri(e.imageUrl);
      if (dataUri) return { ...e, imageUrl: dataUri };
      console.warn(`[creative] educator image could not be embedded, falling back to placeholder: ${e.imageUrl}`);
      return { ...e, imageUrl: null, isCutout: false };
    })
  );
  return { ...content, educators: checked };
}

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
  // Hoisted so the catch block below can report which image URL(s) were
  // being rendered at the moment of failure — Satori/next-og fetches every
  // <img src> server-side to embed real pixel data, and throws a bare
  // "Invalid URL" with no further context when a src isn't a true absolute
  // URL (a relative path works fine in a normal browser <img> but not here,
  // since there's no page origin to resolve it against). Without this, a
  // bad educator photo/background URL was undiagnosable from the stored
  // error alone.
  let content: CreativeContentData | null = null;
  let backgroundValue: BackgroundValue | null = null;
  try {
    content = await resolveContent(type, entityId);
    if (!content) return { ok: false, reason: "Source entity not found." };
    content = await sanitizeEducatorImages(content);

    const existing = await prisma.generatedCreative.findUnique({ where: { type_sourceEntityId: { type, sourceEntityId: entityId } } });
    const templateId = opts.templateId ?? existing?.templateId ?? null;
    const backgroundId = opts.backgroundId ?? existing?.backgroundId ?? null;

    const template = await loadTemplate(type, templateId);
    const background = await loadBackground(backgroundId);
    const layout = template.layoutConfig as unknown as LayoutConfig;
    backgroundValue = background.value as unknown as BackgroundValue;

    const hash = computeSourceVersionHash(content, template.id, background.id);

    if (!opts.force && existing?.status === "READY" && existing.sourceVersionHash === hash && existing.assetUrl) {
      return { ok: true, skipped: true, assetUrl: existing.assetUrl };
    }

    // KNOWN WINDOWS-ONLY `next dev` ISSUE (confirmed live via the raw stack
    // trace below, not guessed): on Windows, `next/og`'s bundled
    // @vercel/og build constructs a `file://` URL for its own internal
    // fallback font (noto-sans-v27-latin-regular.ttf) using Windows
    // backslash paths, producing a garbled string like
    // ".\file:\C:\...noto-sans-v27-latin-regular.ttf" that Node's URL
    // parser rejects with a bare "Invalid URL" — see
    // https://github.com/vercel/next.js/issues/77164. This is a bug inside
    // node_modules/next/dist/compiled/@vercel/og (vendored/compiled
    // third-party code), NOT in this file or in the request data, so it is
    // deliberately NOT patched here (a node_modules edit is wiped on every
    // reinstall and isn't portable to CI/other machines). It only affects
    // `next dev` on Windows — Vercel's production build runs on Linux,
    // where the same file-path-join logic never produces a Windows-style
    // backslash path to begin with, so this specific failure mode should
    // not occur in production. If "Invalid URL" recurs here in PRODUCTION
    // logs (not local Windows dev), that would point at something else
    // (e.g. a genuinely broken remote image/redirect) and is worth a fresh
    // investigation rather than assuming it's this same issue.
    const element = cleanElementForSatori(buildCreativeElement(layout, content, backgroundValue));
    let buffer: Buffer;
    try {
      const image = new ImageResponse(element, {
        width: layout.width,
        height: layout.height,
        fonts: [{ name: "Inter", data: loadDefaultCreativeFont(), weight: 400, style: "normal" }],
      });
      const arrayBuffer = await image.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } catch (renderErr) {
      const msg = renderErr instanceof Error ? renderErr.message : String(renderErr);
      console.error("[creative] RAW render-phase error (full stack) — see the comment above this try block if this is 'Invalid URL' on Windows dev:", renderErr);
      throw new Error(`[render phase] ${msg}`);
    }

    const key = `creatives/${type.toLowerCase()}/${entityId}-${Date.now()}.png`;
    let assetUrl: string;
    try {
      assetUrl = await uploadFile({ key, body: buffer, contentType: "image/png" });
    } catch (uploadErr) {
      const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
      throw new Error(`[upload phase] ${msg}`);
    }

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
    let reason = err instanceof Error ? err.message : "Unknown rendering error";
    // "Invalid URL" has two confirmed distinct causes in this codebase:
    // (1) a remote educator/background image URL Satori couldn't embed
    // (now largely prevented by sanitizeEducatorImages() above, which
    // pre-fetches and embeds those as data: URIs instead of letting Satori
    // fetch them), or (2) the known Windows-`next dev`-only @vercel/og
    // bundled-font bug documented above the render try block, which has
    // nothing to do with image content at all. Appending the candidate
    // image URLs (when any exist) helps distinguish which one this was
    // without needing to re-read server logs.
    if (reason.includes("Invalid URL") && content) {
      const imageUrls = content.educators
        .map((e) => e.imageUrl)
        .filter((u): u is string => Boolean(u))
        .filter((u) => !u.startsWith("data:"));
      const bgUrl = backgroundValue?.kind === "IMAGE" ? backgroundValue.url : null;
      const candidates = [...imageUrls, ...(bgUrl ? [`background:${bgUrl}`] : [])];
      reason += candidates.length
        ? ` — candidate remote image URLs: ${candidates.join(", ")}`
        : " — no remote image URLs in play; if this is local Windows `next dev`, this is likely the known @vercel/og bundled-font bug (see comment above the render step in engine.ts), not a data problem.";
    }
    console.error(`[creative] generation failed for ${type}:${entityId}:`, err);
    // Capped defensively — this is meant to be a short diagnostic string
    // surfaced in the admin UI (CreativeThumbnail), not an arbitrary blob.
    const storedReason = reason.length > 500 ? `${reason.slice(0, 500)}…` : reason;
    await prisma.generatedCreative
      .upsert({
        where: { type_sourceEntityId: { type, sourceEntityId: entityId } },
        create: { type, sourceEntityType: SOURCE_ENTITY_TYPE[type], sourceEntityId: entityId, status: "FAILED", errorMessage: storedReason },
        update: { status: "FAILED", errorMessage: storedReason },
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
