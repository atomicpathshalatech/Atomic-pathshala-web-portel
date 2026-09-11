import { createHash } from "crypto";
import type { CreativeContentData } from "./content-types";

/**
 * Cache-invalidation key (spec section 24 — the literal
 * "educatorCreativePngVersion = 4 -> regenerate" example). Built from every
 * input that can change what the rendered pixels look like: each
 * educator's asset version (bumped whenever their cutout PNG changes), the
 * resolved text content, and which template/background were selected.
 * Two calls with identical inputs produce the identical hash — that's the
 * whole mechanism; the engine only re-renders when this differs from the
 * GeneratedCreative row's stored hash.
 */
export function computeSourceVersionHash(
  content: CreativeContentData,
  templateId: string | null,
  backgroundId: string | null
): string {
  const parts = [
    templateId ?? "-",
    backgroundId ?? "-",
    content.title,
    content.subtitle ?? "",
    content.batchName ?? "",
    content.chapterName ?? "",
    content.subjectName ?? "",
    content.lectureLabel ?? "",
    content.lectureTitle ?? "",
    content.lectureCount ?? "",
    content.examOrCourse ?? "",
    content.educators
      .map((e) => `${e.teacherId}:${e.creativeAssetVersion}:${e.name}`)
      .sort()
      .join(","),
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex");
}
