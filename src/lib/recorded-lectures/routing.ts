import "server-only";
import { prisma } from "@/lib/db";
import { RECORDED_CLASS_MODE } from "./premiere";

/**
 * Where a lecture id or a class (schedule) id that belongs to a recorded
 * lecture is played. Old links (/watch/<id>, /live-class/<id>) land on the
 * generic players, which cannot play a recorded lecture — they send the
 * student here instead. Null: not a recorded lecture.
 */
export async function recordedLecturePathFor(id: string): Promise<string | null> {
  const lectureId = await recordedLectureIdFor(id);
  return lectureId ? `/recorded-lectures/${lectureId}` : null;
}

/** The same, for the team portal (the lecture's management page). */
export async function teamRecordedLecturePathFor(id: string): Promise<string | null> {
  const lectureId = await recordedLectureIdFor(id);
  return lectureId ? `/team/recorded-lectures/${lectureId}` : null;
}

async function recordedLectureIdFor(id: string): Promise<string | null> {
  if (!id) return null;
  const [media, slot] = await Promise.all([
    prisma.recordedLectureMedia.findUnique({ where: { lectureId: id }, select: { lectureId: true } }),
    prisma.batchSchedule.findFirst({ where: { id, classMode: RECORDED_CLASS_MODE, lectureId: { not: null } }, select: { lectureId: true } }),
  ]);
  return media?.lectureId ?? slot?.lectureId ?? null;
}
