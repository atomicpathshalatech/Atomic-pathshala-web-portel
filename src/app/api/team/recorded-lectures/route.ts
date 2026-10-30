import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { apiSuccess } from "@/lib/api/response";
import { ForbiddenError, hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rate-limit";
import { recordedLectureCreateSchema } from "@/lib/recorded-lectures/schemas";
import { canManageRecordedLectures } from "@/lib/recorded-lectures/access";
import { createRecordedDraft } from "@/lib/recorded-lectures/service";
import { recordedApiError, requireUserId } from "@/lib/recorded-lectures/api";
import { recordedStorageStatus } from "@/lib/recorded-lectures/config";

export const dynamic = "force-dynamic";

/**
 * Recorded lectures list. Managers (Admin / Super Admin / granted) see all;
 * a teacher sees only the recorded lectures they teach (to write the About
 * and the summary) — never another teacher's.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    // Super Admin only — recorded lectures are private.
    const manage = await canManageRecordedLectures(userId);
    if (!manage) throw new ForbiddenError();

    const sp = request.nextUrl.searchParams;
    const where: Prisma.LectureWhereInput = { recordedMedia: { isNot: null } };
    const and: Prisma.LectureWhereInput[] = [];
    if (!manage) and.push({ teacher: { userId } });
    const batchId = sp.get("batchId");
    if (batchId) and.push({ recordedMedia: { is: { batchId } } });
    const chapterId = sp.get("chapterId");
    if (chapterId) and.push({ chapterId });
    const state = sp.get("state");
    if (state === "published") and.push({ status: "PUBLISHED", recordedMedia: { is: { archivedAt: null } } });
    if (state === "draft") and.push({ status: "DRAFT", recordedMedia: { is: { archivedAt: null } } });
    if (state === "archived") and.push({ recordedMedia: { is: { archivedAt: { not: null } } } });
    if (state !== "archived" && state !== "all") and.push({ recordedMedia: { is: { archivedAt: null } } });
    const q = sp.get("q")?.trim();
    if (q) and.push({ title: { contains: q, mode: "insensitive" } });
    if (and.length) where.AND = and;

    const lectures = await prisma.lecture.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      take: 200,
      select: {
        id: true,
        title: true,
        status: true,
        order: true,
        language: true,
        chapter: { select: { id: true, title: true, subject: { select: { title: true } } } },
        teacher: { select: { user: { select: { name: true } } } },
        recordedMedia: {
          select: { uploadStatus: true, sizeBytes: true, durationSec: true, lectureNumber: true, archivedAt: true, batch: { select: { id: true, name: true } } },
        },
        summaries: { where: { status: "PUBLISHED" }, select: { id: true, outdated: true }, take: 1 },
        updatedAt: true,
      },
    });

    return apiSuccess({
      canManage: manage,
      storage: manage ? recordedStorageStatus() : undefined,
      lectures: lectures.map((l) => ({
        id: l.id,
        title: l.title,
        status: l.status,
        language: l.language,
        chapter: l.chapter.title,
        subject: l.chapter.subject.title,
        teacher: l.teacher.user.name,
        batch: l.recordedMedia?.batch ?? null,
        uploadStatus: l.recordedMedia?.uploadStatus ?? null,
        sizeBytes: Number(l.recordedMedia?.sizeBytes ?? 0),
        durationSec: l.recordedMedia?.durationSec ?? null,
        lectureNumber: l.recordedMedia?.lectureNumber ?? null,
        archived: Boolean(l.recordedMedia?.archivedAt),
        summary: l.summaries[0] ? (l.summaries[0].outdated ? "OUTDATED" : "PUBLISHED") : "NONE",
        updatedAt: l.updatedAt,
      })),
    });
  } catch (error) {
    return recordedApiError(error);
  }
}

/** Creates a draft recorded lecture (metadata + About); the video is uploaded to it next. */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    if (!(await canManageRecordedLectures(userId))) throw new ForbiddenError("Only Admin / Super Admin can add recorded lectures.");
    const rate = await checkRateLimit(request, "GENERAL", `recorded-create:${userId}`);
    if (!rate.success) return rateLimitExceededResponse(rate);

    const input = recordedLectureCreateSchema.parse(await request.json());
    const lectureId = await createRecordedDraft(input, userId);
    await prisma.auditLog
      .create({ data: { userId, action: "RECORDED_LECTURE_CREATE", entityType: "Lecture", entityId: lectureId, metadata: { title: input.title } } })
      .catch(() => null);
    return apiSuccess({ lectureId }, 201);
  } catch (error) {
    return recordedApiError(error);
  }
}
