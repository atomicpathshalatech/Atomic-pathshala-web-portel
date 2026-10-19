import "server-only";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { extractYouTubeVideoId } from "@/lib/live-class/youtube";

/**
 * A live class's YouTube stream, saved on its schedule before class by
 * whoever manages the schedule — the teacher then only presses Start.
 *
 * Classes are made from the chapter (one per batch for each lecture), so the
 * link is set once per lecture and goes to every batch's class of it. It is
 * kept in BatchSchedule.youtubeUrl — the same field the lecture Sheet and the
 * recording use, so the live link becomes the class's recording link.
 */

type ScheduleLike = { id: string; lectureId?: string | null; youtubeUrl?: string | null; classMode?: string | null };

/** The YouTube video id the class should stream to, from its saved link (or an upcoming / live class of the same lecture in another batch — never a class that already ran, whose link is its recording). */
export async function scheduledLiveYouTubeId(schedule: ScheduleLike): Promise<string | null> {
  // An App-only class has its own unlisted stream made at Start.
  if (schedule.classMode === "APP_ONLY") return null;
  const own = schedule.youtubeUrl ? extractYouTubeVideoId(schedule.youtubeUrl) : null;
  if (own) return own;
  if (!schedule.lectureId) return null;
  const sibling = await prisma.batchSchedule.findFirst({
    where: { lectureId: schedule.lectureId, id: { not: schedule.id }, type: "LIVE_CLASS", youtubeUrl: { not: null }, status: { in: ["SCHEDULED", "LIVE"] }, OR: [{ classMode: null }, { classMode: "APP_AND_YOUTUBE" }] },
    select: { youtubeUrl: true },
  });
  return sibling?.youtubeUrl ? extractYouTubeVideoId(sibling.youtubeUrl) : null;
}

export type SetLinkResult = { ok: true; updated: number } | { ok: false; status: number; error: string };

/**
 * Saves (or, with an empty link, removes) the YouTube live link of every
 * batch class of a lecture. Only for whoever manages the schedule.
 */
export async function setLectureLiveYouTubeLink(userId: string, lectureId: string, link: unknown): Promise<SetLinkResult> {
  if (link !== null && typeof link !== "string") return { ok: false, status: 400, error: "The YouTube link must be text." };
  if (!(await hasPermission(userId, PERMISSIONS.BATCH_SCHEDULE_MANAGE))) {
    return { ok: false, status: 403, error: "Only whoever manages the schedule can set a class's YouTube link." };
  }
  const trimmed = (link ?? "").trim();
  if (trimmed && !extractYouTubeVideoId(trimmed)) {
    return { ok: false, status: 400, error: "That is not a YouTube link. Paste the link of the scheduled stream (youtube.com/live/… or youtu.be/…)." };
  }
  // Classes that already ran keep their link (it is their recording now).
  const res = await prisma.batchSchedule.updateMany({
    where: { lectureId, type: "LIVE_CLASS", status: { in: ["SCHEDULED"] } },
    data: trimmed ? { youtubeUrl: trimmed, classMode: "APP_AND_YOUTUBE" } : { youtubeUrl: null, classMode: null },
  });
  await prisma.auditLog.create({
    data: { userId, action: "CLASS_YOUTUBE_LINK_SET", entityType: "Lecture", entityId: lectureId, metadata: { link: trimmed || null, classes: res.count } },
  });
  return { ok: true, updated: res.count };
}

/** lectureId → its saved YouTube live link (for the chapter page's lecture form). */
export async function lectureLiveLinks(lectureIds: string[]): Promise<Map<string, string>> {
  const rows = lectureIds.length
    ? await prisma.batchSchedule.findMany({
        where: { lectureId: { in: lectureIds }, type: "LIVE_CLASS", youtubeUrl: { not: null }, status: { in: ["SCHEDULED", "LIVE"] }, OR: [{ classMode: null }, { classMode: "APP_AND_YOUTUBE" }] },
        select: { lectureId: true, youtubeUrl: true },
      })
    : [];
  const map = new Map<string, string>();
  for (const r of rows) if (r.lectureId && r.youtubeUrl && !map.has(r.lectureId)) map.set(r.lectureId, r.youtubeUrl);
  return map;
}
