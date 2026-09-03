import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { type ChapterStatusValue } from "@/lib/chapters/state-machine";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CHAPTER_UPDATE);

    const body = await request.json().catch(() => ({}));
    const { startDate, startTime = "10:00", durationMin = 90, weekdays } = body;

    const chapter = await prisma.chapter.findUnique({
      where: { id: params.id },
      include: {
        lectures: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
      },
    });
    if (!chapter) return apiError("Chapter not found", 404);

    if (chapter.lectures.length === 0) {
      return apiError("Please add at least one lecture before submitting the chapter.", 400);
    }

    const currentStatus = chapter.status as ChapterStatusValue;

    // Optional Batch Scheduling Calculation across selected Weekdays
    const lectureUpdates: any[] = [];
    if (startDate && Array.isArray(weekdays) && weekdays.length > 0) {
      const parts = String(startDate).split("-").map((p) => parseInt(p, 10));
      const year = parts[0] || new Date().getFullYear();
      const month = (parts[1] || 1) - 1;
      const day = parts[2] || 1;
      const current = new Date(year, month, day);
      const duration = Number(durationMin) || 90;

      for (const lec of chapter.lectures) {
        // Find next matching weekday
        while (!weekdays.includes(current.getDay())) {
          current.setDate(current.getDate() + 1);
        }

        const scheduledDate = new Date(current);
        lectureUpdates.push(
          prisma.lecture.update({
            where: { id: lec.id },
            data: {
              scheduledDate: scheduledDate,
              startTime: startTime || "10:00",
              durationMin: duration,
            },
          })
        );

        // Move to next calendar day for the next iteration
        current.setDate(current.getDate() + 1);
      }
    }

    const [updated] = await prisma.$transaction([
      ...lectureUpdates,
      prisma.chapter.update({
        where: { id: chapter.id },
        data: { status: "UNDER_REVIEW" },
      }),
      prisma.chapterReview.create({
        data: {
          chapterId: chapter.id,
          action: "SUBMITTED",
          actorId: session.user.id,
          previousStatus: currentStatus,
          newStatus: "UNDER_REVIEW",
        },
      }),
      prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CHAPTER_SUBMITTED",
          entityType: "Chapter",
          entityId: chapter.id,
          metadata: {
            from: currentStatus,
            to: "UNDER_REVIEW",
            batchSchedule: startDate ? { startDate, startTime, durationMin, weekdays } : null,
          },
        },
      }),
    ]);

    return apiSuccess({ chapter: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
