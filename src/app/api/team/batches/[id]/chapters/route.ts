import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { getMasterChapterById } from "@/lib/batch/master-chapters";
import { checkScheduleConflict } from "@/lib/batch/schedule-conflict";
import { computeISTScheduleDates } from "@/lib/date-utils";
import { z } from "zod";

const importChapterSchema = z.object({
  chapterIdOrCode: z.string().min(1, "Chapter ID or code is required"),
  startDate: z.string().optional(),
  dailyStartTime: z.string().default("10:00"),
  durationMinutes: z.number().int().positive().default(60),
  teacherId: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BATCH_SCHEDULE_MANAGE);

    const batch = await prisma.batch.findUnique({
      where: { id: params.id },
      include: { teachers: true },
    });
    if (!batch) return apiError("Batch not found", 404);

    const body = await request.json();
    const input = importChapterSchema.parse(body);

    const masterChapter = await getMasterChapterById(input.chapterIdOrCode);
    if (!masterChapter) {
      return apiError(`Master Chapter "${input.chapterIdOrCode}" not found.`, 404);
    }

    const assignedTeacherId =
      input.teacherId ||
      batch.teachers.find((t) => t.subject?.toLowerCase() === masterChapter.subject.toLowerCase())
        ?.teacherId ||
      batch.teachers[0]?.teacherId ||
      null;

    const rawBaseDate = input.startDate ? new Date(input.startDate) : new Date(Date.now() + 24 * 60 * 60 * 1000);

    const createdSchedules = [];

    // Check if masterChapter maps to a real DB Chapter
    const dbChapter = await prisma.chapter.findFirst({
      where: {
        OR: [
          { id: masterChapter.id },
          { chapterId: masterChapter.chapterCode },
          { title: masterChapter.title },
        ],
      },
      select: { id: true },
    });

    for (let i = 0; i < masterChapter.lectures.length; i++) {
      const lecture = masterChapter.lectures[i];
      if (!lecture) continue;

      const targetDay = new Date(rawBaseDate.getTime() + i * 24 * 60 * 60 * 1000);
      const { startsAt, endsAt } = computeISTScheduleDates(
        targetDay,
        input.dailyStartTime || "10:00",
        input.durationMinutes || lecture.durationMinutes || 60
      );

      // Check conflict before creating
      const conflict = await checkScheduleConflict({
        batchId: batch.id,
        teacherId: assignedTeacherId,
        startsAt,
        endsAt,
      });

      // If conflict, adjust time or record with title
      const title = `${masterChapter.title} — ${lecture.lectureCode}: ${lecture.title}`;

      const schedule = await prisma.batchSchedule.create({
        data: {
          batchId: batch.id,
          title,
          subject: masterChapter.subject,
          type: "LIVE_CLASS",
          teacherId: assignedTeacherId,
          chapterId: dbChapter?.id || null,
          startsAt,
          endsAt,
          notes: `Imported from Master Chapter ${masterChapter.chapterCode} (${masterChapter.title})`,
          createdById: session.user.id,
        },
      });

      createdSchedules.push(schedule);
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "BATCH_CHAPTER_IMPORTED",
        entityType: "Batch",
        entityId: batch.id,
        metadata: {
          chapterCode: masterChapter.chapterCode,
          chapterTitle: masterChapter.title,
          lecturesCount: masterChapter.lectures.length,
        },
      },
    });

    return apiSuccess(
      {
        message: `Successfully imported "${masterChapter.title}" (${masterChapter.lectures.length} lectures scheduled).`,
        chapter: masterChapter,
        schedules: createdSchedules,
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
