import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Batch -> Subject -> Chapter -> Lecture recorded-content tree for the
 * student "My Lectures" feature. Every chapter returned here comes from an
 * explicit BatchChapter assignment (never implicitly via shared
 * Subject/Course) - this is the query that actually enforces the
 * batch-isolation fix; a chapter assigned only to a different batch will
 * never appear, even if that batch shares the same course.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const student = await prisma.student.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!student) return apiError("Student profile not found", 404);

    const { resolveBatchAccess } = await import("@/lib/batch/entitlement");
    const access = await resolveBatchAccess(session.user.id, params.id);
    if (access.status !== "ACTIVE_ENROLLMENT" && access.status !== "ACTIVE_SUBSCRIPTION" && access.status !== "ADMIN_GRANTED") {
      return apiError("You are not enrolled in this batch.", 403);
    }

    const batch = await prisma.batch.findUnique({ where: { id: params.id }, select: { id: true, name: true } });
    if (!batch) return apiError("Batch not found", 404);

    const assignments = await prisma.batchChapter.findMany({
      where: { batchId: params.id, chapter: { status: { in: ["PUBLISHED", "APPROVED"] } } },
      select: {
        chapter: {
          select: {
            id: true,
            title: true,
            order: true,
            subject: { select: { id: true, title: true } },
            lectures: {
              select: {
                id: true,
                title: true,
                order: true,
                videoUrl: true,
                slidesUrl: true,
                status: true,
                durationMin: true,
                teacher: { select: { user: { select: { name: true } } } },
                batchSchedules: {
                  where: { batchId: params.id },
                  select: {
                    id: true,
                    startsAt: true,
                    liveWhiteboardSession: {
                      select: {
                        id: true,
                        recordingStatus: true,
                        pdfStatus: true,
                        youtubeArchiveStatus: true,
                        youtubeArchiveVideoUrl: true,
                      },
                    },
                  },
                  orderBy: { startsAt: "desc" },
                  take: 1,
                },
              },
              where: { status: "PUBLISHED" },
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    // Group by subject, preserving chapter order within each subject.
    const subjectsById = new Map<
      string,
      { id: string; title: string; chapters: any[] }
    >();

    for (const { chapter } of assignments) {
      let subjectEntry = subjectsById.get(chapter.subject.id);
      if (!subjectEntry) {
        subjectEntry = { id: chapter.subject.id, title: chapter.subject.title, chapters: [] };
        subjectsById.set(chapter.subject.id, subjectEntry);
      }

      const lectures = chapter.lectures.map((lecture) => {
        const schedule = lecture.batchSchedules[0];
        const wb = schedule?.liveWhiteboardSession;

        let recordingStatus: "NOT_SCHEDULED" | "SCHEDULED" | "PROCESSING" | "AVAILABLE" = "NOT_SCHEDULED";
        let watchHref: string | null = null;

        if (lecture.videoUrl) {
          recordingStatus = "AVAILABLE";
          watchHref = `/watch/${lecture.id}`;
        } else if (wb) {
          if (wb.youtubeArchiveStatus === "COMPLETED" && wb.youtubeArchiveVideoUrl) {
            recordingStatus = "AVAILABLE";
            watchHref = `/watch/${schedule!.id}`;
          } else if (wb.recordingStatus === "READY") {
            recordingStatus = "AVAILABLE";
            watchHref = `/watch/${schedule!.id}`;
          } else if (["RECORDING", "RECORDING_STARTING", "STARTING", "PROCESSING"].includes(wb.recordingStatus)) {
            recordingStatus = "PROCESSING";
          } else if (schedule) {
            recordingStatus = "SCHEDULED";
          }
        } else if (schedule) {
          recordingStatus = "SCHEDULED";
        }

        const slidesAvailable = Boolean(lecture.slidesUrl) || wb?.pdfStatus === "READY";
        const slidesSessionId = !lecture.slidesUrl && wb?.pdfStatus === "READY" ? wb.id : null;

        return {
          id: lecture.id,
          title: lecture.title,
          teacherName: lecture.teacher?.user?.name || null,
          durationMin: lecture.durationMin,
          recordingStatus,
          watchHref,
          slidesAvailable,
          slidesHref: lecture.slidesUrl || null,
          slidesSessionId,
        };
      });

      subjectEntry.chapters.push({
        id: chapter.id,
        title: chapter.title,
        order: chapter.order,
        lectureCount: lectures.length,
        lectures,
      });
    }

    for (const s of subjectsById.values()) {
      s.chapters.sort((a, b) => a.order - b.order);
    }

    return apiSuccess({
      batch: { id: batch.id, name: batch.name },
      subjects: Array.from(subjectsById.values()).sort((a, b) => a.title.localeCompare(b.title)),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
