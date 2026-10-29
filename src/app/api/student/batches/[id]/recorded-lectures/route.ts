import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { activeEnrollment, recordedForBatchWhere } from "@/lib/recorded-lectures/access";
import { recordedWatchPath } from "@/lib/recorded-lectures/service";
import { signedThumbnailUrl } from "@/lib/recorded-lectures/storage";
import { pickPremiere, premiereState, RECORDED_CLASS_MODE } from "@/lib/recorded-lectures/premiere";

export const dynamic = "force-dynamic";

/**
 * Published recorded lectures of a batch the student is actively enrolled
 * in, grouped Subject → Chapter → lectures. Drafts, unverified uploads and
 * archived lectures never appear; another batch's lectures never appear.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const student = await prisma.student.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!student) return apiError("Student profile not found.", 404);
    const enrolled = await activeEnrollment(student.id, params.id);
    if (!enrolled) return apiError("You are not enrolled in this batch.", 403);

    const lectures = await prisma.lecture.findMany({
      where: recordedForBatchWhere(enrolled.batch),
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        language: true,
        durationMin: true,
        chapter: { select: { id: true, title: true, order: true, subject: { select: { id: true, title: true } } } },
        teacher: { select: { displayName: true, user: { select: { name: true } } } },
        recordedMedia: { select: { durationSec: true, lectureNumber: true, thumbnailKey: true, publishedAt: true } },
        summaries: { where: { status: "PUBLISHED", kind: "SUMMARY" }, select: { content: true }, take: 1 },
        progress: { where: { studentId: student.id }, select: { id: true }, take: 1 },
      },
    });

    // Lectures scheduled for this batch: when each plays live.
    const slots = await prisma.batchSchedule.findMany({
      where: { batchId: enrolled.batch.id, classMode: RECORDED_CLASS_MODE, status: { not: "CANCELLED" }, lectureId: { in: lectures.map((l) => l.id) } },
      select: { lectureId: true, startsAt: true, endsAt: true },
    });
    const now = new Date();
    const premiereOf = (lectureId: string) => {
      const slot = pickPremiere(slots.filter((s) => s.lectureId === lectureId), now);
      return slot ? { startsAt: slot.startsAt.toISOString(), state: premiereState(slot, now) } : null;
    };

    // Thumbnails are private objects: signed for an hour, only for lectures listed here.
    const thumbs = await Promise.all(
      lectures.map((l) => (l.recordedMedia?.thumbnailKey ? signedThumbnailUrl(l.recordedMedia.thumbnailKey).catch(() => null) : null))
    );

    const subjects = new Map<string, { id: string; title: string; chapters: Map<string, { id: string; title: string; order: number; lectures: unknown[] }> }>();
    lectures.forEach((l, i) => {
      const s = subjects.get(l.chapter.subject.id) ?? { id: l.chapter.subject.id, title: l.chapter.subject.title, chapters: new Map() };
      const c = s.chapters.get(l.chapter.id) ?? { id: l.chapter.id, title: l.chapter.title, order: l.chapter.order, lectures: [] };
      const summary = l.summaries[0]?.content ?? null;
      c.lectures.push({
        id: l.id,
        title: l.title,
        language: l.language,
        teacher: l.teacher.displayName || l.teacher.user.name,
        lectureNumber: l.recordedMedia?.lectureNumber ?? null,
        durationSec: l.recordedMedia?.durationSec ?? (l.durationMin ? l.durationMin * 60 : null),
        thumbnailUrl: thumbs[i],
        publishedAt: l.recordedMedia?.publishedAt ?? null,
        // A short preview of the approved summary (first lines) for the card.
        summaryPreview: summary ? summary.replace(/^#+\s.*$/gm, "").replace(/^[-*]\s(\[ \]\s)?/gm, "").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 2).join(" · ").slice(0, 220) : null,
        completed: l.progress.length > 0,
        href: recordedWatchPath(l.id),
        premiere: premiereOf(l.id),
      });
      s.chapters.set(l.chapter.id, c);
      subjects.set(l.chapter.subject.id, s);
    });

    return apiSuccess({
      batch: { id: enrolled.batch.id, name: enrolled.batch.name },
      subjects: Array.from(subjects.values()).map((s) => ({
        id: s.id,
        title: s.title,
        chapters: Array.from(s.chapters.values()).sort((a, b) => a.order - b.order),
      })),
      total: lectures.length,
    });
  } catch (error) {
    // Deployed before the recorded-lectures migration ran: no tables yet, so
    // nothing to show — the batch page must not turn into an error for that.
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022")) {
      return apiSuccess({ batch: { id: params.id, name: "" }, subjects: [], total: 0 });
    }
    return handleApiError(error);
  }
}
