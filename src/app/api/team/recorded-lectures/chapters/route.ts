import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/api/response";
import { ForbiddenError } from "@/lib/rbac/guard";
import { isCanonicalCourseSlug } from "@/lib/academic/canonical-courses";
import { generateChapterId } from "@/lib/chapters/code";
import { getMasterNcertChapters } from "@/lib/academic/master-ncert-catalog";
import { canManageRecordedLectures } from "@/lib/recorded-lectures/access";
import { recordedApiError, requireUserId } from "@/lib/recorded-lectures/api";
import { recordedStorageStatus } from "@/lib/recorded-lectures/config";

export const dynamic = "force-dynamic";

const CREATED_HERE = "RECORDED_CHAPTER_CREATE";

const createSchema = z.object({
  subjectId: z.string().trim().min(1, "Choose the subject"),
  title: z.string().trim().min(2, "Enter the chapter name").max(200),
  medium: z.enum(["HINDI", "ENGLISH", "HINGLISH"]).default("HINGLISH"),
  description: z.string().trim().max(2000).nullish(),
  batchIds: z.array(z.string().min(1)).max(50).default([]),
});

/**
 * Recorded-lecture chapters: chapters that hold recorded lectures or were
 * created here, newest first; `q` searches every chapter (to use an
 * existing one). Also the subjects (approved courses) and batches the
 * "Create chapter" form offers.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    if (!(await canManageRecordedLectures(userId))) throw new ForbiddenError();
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const subjectId = request.nextUrl.searchParams.get("subjectId") ?? "";

    const createdHere = await prisma.auditLog.findMany({
      where: { action: CREATED_HERE, entityType: "Chapter" },
      select: { entityId: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    const ids = createdHere.map((a) => a.entityId).filter((x): x is string => Boolean(x));

    const where: Prisma.ChapterWhereInput = {
      ...(subjectId && { subjectId }),
      ...(q
        ? { title: { contains: q, mode: "insensitive" } }
        : { OR: [{ id: { in: ids } }, { lectures: { some: { recordedMedia: { isNot: null } } } }] }),
    };

    const [chapters, subjects, batches] = await Promise.all([
      prisma.chapter.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: 150,
        select: {
          id: true,
          title: true,
          chapterId: true,
          subject: { select: { id: true, title: true, course: { select: { title: true } } } },
          batchAssignments: { select: { batch: { select: { id: true, name: true } } } },
          lectures: {
            where: { recordedMedia: { isNot: null } },
            select: { status: true, recordedMedia: { select: { archivedAt: true, uploadStatus: true } } },
          },
          updatedAt: true,
        },
      }),
      prisma.subject.findMany({
        select: { id: true, title: true, course: { select: { title: true, slug: true } } },
        orderBy: [{ course: { title: "asc" } }, { title: "asc" }],
      }),
      prisma.batch.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ]);

    return apiSuccess({
      storage: recordedStorageStatus(),
      chapters: chapters.map((c) => {
        const live = c.lectures.filter((l) => !l.recordedMedia?.archivedAt);
        return {
          id: c.id,
          code: c.chapterId,
          title: c.title,
          subject: c.subject.title,
          course: c.subject.course.title,
          batches: c.batchAssignments.map((b) => b.batch),
          lectures: live.length,
          published: live.filter((l) => l.status === "PUBLISHED").length,
          updatedAt: c.updatedAt,
        };
      }),
      subjects: subjects
        .filter((s) => isCanonicalCourseSlug(s.course.slug))
        .map((s) => ({ id: s.id, title: s.title, course: s.course.title })),
      // Standard NCERT chapter names per subject title, suggested in the form.
      ncertNames: Object.fromEntries(
        Array.from(new Set(subjects.map((s) => s.title))).map((t) => {
          try {
            return [t, getMasterNcertChapters(t).map((c) => c.title)];
          } catch {
            return [t, []];
          }
        })
      ),
      batches,
    });
  } catch (error) {
    return recordedApiError(error);
  }
}

/** Creates a chapter (the existing Chapter record, same rules as the Chapters module) and adds it to batches. */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    if (!(await canManageRecordedLectures(userId))) throw new ForbiddenError("Only Admin / Super Admin can create recorded-lecture chapters.");
    const input = createSchema.parse(await request.json());

    const subject = await prisma.subject.findUnique({ where: { id: input.subjectId }, select: { id: true, course: { select: { slug: true } } } });
    if (!subject) return apiError("Subject not found.", 404);
    if (!isCanonicalCourseSlug(subject.course.slug)) {
      return apiError("This subject's course is not one of the approved courses (Class 11th, Class 12th, NEET, JEE).", 400);
    }
    const batches = input.batchIds.length
      ? await prisma.batch.findMany({ where: { id: { in: input.batchIds } }, select: { id: true } })
      : [];
    if (batches.length !== new Set(input.batchIds).size) return apiError("One of the chosen batches does not exist.", 400);

    const order = ((await prisma.chapter.aggregate({ where: { subjectId: input.subjectId }, _max: { order: true } }))._max.order ?? 0) + 1;
    let chapter: { id: string } | null = null;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3 && !chapter; attempt++) {
      try {
        const code = await generateChapterId(prisma);
        chapter = await prisma.$transaction(async (tx) => {
          const c = await tx.chapter.create({
            data: {
              chapterId: code,
              title: input.title,
              subjectId: input.subjectId,
              medium: input.medium,
              order,
              description: input.description ?? null,
              createdById: userId,
            },
            select: { id: true },
          });
          if (batches.length) {
            await tx.batchChapter.createMany({
              data: batches.map((b) => ({ batchId: b.id, chapterId: c.id, assignedById: userId })),
              skipDuplicates: true,
            });
          }
          await tx.auditLog.create({
            data: { userId, action: CREATED_HERE, entityType: "Chapter", entityId: c.id, metadata: { title: input.title, batches: batches.length } },
          });
          return c;
        });
      } catch (err) {
        lastError = err;
        if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") throw err;
      }
    }
    if (!chapter) throw lastError instanceof Error ? lastError : new Error("Could not create the chapter.");
    return apiSuccess({ chapterId: chapter.id }, 201);
  } catch (error) {
    return recordedApiError(error);
  }
}
