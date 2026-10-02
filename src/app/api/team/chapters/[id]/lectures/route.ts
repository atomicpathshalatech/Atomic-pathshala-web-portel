import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { LectureStatus } from "@prisma/client";
import { getChapterSequenceState } from "@/lib/chapters/sequence";
import { computeISTScheduleDates } from "@/lib/date-utils";
import { newTimeBlockReason } from "@/lib/schedule/reschedule-guard";
import { regenerateCreativeAwaited } from "@/lib/creative/engine";
import { assertChapterAccess } from "@/lib/chapters/access";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LECTURE_READ);
    await assertChapterAccess(session?.user?.id ?? "", params.id, "read");

    const lectures = await prisma.lecture.findMany({
      where: { chapterId: params.id },
      include: {
        teacher: { include: { user: { select: { name: true, email: true } } } },
      },
      orderBy: { order: "asc" },
    });

    return apiSuccess({ lectures });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LECTURE_CREATE);
    await assertChapterAccess(session?.user?.id ?? "", params.id, "write");

    const chapter = await prisma.chapter.findUnique({
      where: { id: params.id },
      include: { subject: true },
    });
    if (!chapter) return apiError("Chapter not found", 404);

    const body = await request.json();
    const {
      title,
      scheduledDate,
      startTime,
      endTime,
      durationMin,
      videoUrl,
      language,
      order,
      slidesUrl,
      educatorVideoUrl,
      status,
      teacherId: passedTeacherId,
    } = body;

    if (!title?.trim()) {
      return apiError("Lecture title is required", 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true },
    });
    const isAdmin = user?.role?.name === "SUPER_ADMIN" || user?.role?.name === "ADMIN";

    // Authoring lock check (Admins can add lectures anytime even after publish)
    if (!isAdmin) {
      const sequence = await getChapterSequenceState(chapter.id);
      if (!sequence.nextLectureUnlocked) {
        const requiredSlot = sequence.requiredDppSlotForNextLecture;
        return apiError(
          `Cannot create Lecture ${sequence.nextLecturePosition}. DPP ${requiredSlot} must be created in this chapter first.`,
          409,
          {
            code: "CHAPTER_SEQUENCE_LOCKED",
            details: { chapterId: chapter.id, requiredContent: `DPP_${requiredSlot}` },
          }
        );
      }
    }

    // Resolve teacher (defaults to the actual creator user)
    let teacherId = passedTeacherId;
    if (!teacherId) {
      let myTeacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
      if (!myTeacher) {
        myTeacher = await prisma.teacher.create({
          data: {
            userId: session.user.id,
            employeeCode: `EMP_${session.user.id.slice(0, 6).toUpperCase()}`,
            department: "ACADEMICS",
            subjects: [chapter.subject.title],
          },
        });
      }
      teacherId = myTeacher.id;
    }

    // Find next order if not passed
    let lectureOrder = typeof order === "number" ? order : 0;
    if (lectureOrder === 0) {
      const last = await prisma.lecture.findFirst({
        where: { chapterId: chapter.id },
        orderBy: { order: "desc" },
      });
      lectureOrder = (last?.order ?? 0) + 1;
    }

    const parsedDate = scheduledDate ? new Date(scheduledDate) : null;
    // A YouTube class's length comes from the video itself, never typed in.
    const { extractYouTubeVideoId: ytIdOf } = await import("@/lib/live-class/youtube");
    const linkedVideoId = videoUrl ? ytIdOf(videoUrl) : null;
    // A new live class must be in the future (an old YouTube class records
    // when it was taught, so its date may be past).
    if (parsedDate && !linkedVideoId) {
      const { startsAt: newStart } = computeISTScheduleDates(parsedDate, startTime, Number(durationMin) || 60);
      const past = newTimeBlockReason(newStart);
      if (past) return apiError(past, 400, { code: "TIME_IN_PAST" });
    }
    const { youtubeVideoDurationMin } = await import("@/lib/youtube/video-duration");
    const parsedDuration = (linkedVideoId ? await youtubeVideoDurationMin(linkedVideoId) : null) ?? (durationMin ? Number(durationMin) : 60);

    const lecture = await prisma.lecture.create({
      data: {
        chapterId: chapter.id,
        title: title.trim(),
        scheduledDate: parsedDate,
        startTime: startTime?.trim() || null,
        endTime: endTime?.trim() || null,
        durationMin: parsedDuration,
        videoUrl: videoUrl?.trim() || "",
        language: language || (chapter.medium === "HINDI" ? "Hindi" : chapter.medium === "HINGLISH" ? "Hinglish" : "English"),
        order: lectureOrder,
        slidesUrl: slidesUrl?.trim() || null,
        educatorVideoUrl: educatorVideoUrl?.trim() || null,
        status: status && Object.values(LectureStatus).includes(status) ? status : LectureStatus.PUBLISHED,
        teacherId,
      },
      include: {
        teacher: { include: { user: { select: { name: true } } } },
      },
    });

    // Auto-sync BatchSchedule and WhiteboardSession with accurate IST dates across all assigned batches.
    // Only a lecture with a date becomes a class: an undated lecture used to
    // become a class "today at 10:00". Dates are set when the chapter is
    // submitted (weekdays + duration).
    if (parsedDate) try {
      const { startsAt, endsAt } = computeISTScheduleDates(parsedDate, startTime, parsedDuration);
      const { extractYouTubeVideoId } = await import("@/lib/live-class/youtube");
      const ytVideoId = videoUrl ? extractYouTubeVideoId(videoUrl) : null;
      const isPastCompletedClass = Boolean(ytVideoId);

      // Every batch that has this chapter — assigned/imported, or already
      // holding its classes (older imports never made the assignment row).
      const { chapterBatchIds } = await import("@/lib/chapters/lecture-batch-sync");
      const batchIds = await chapterBatchIds(chapter.id);

      const syncSchedule = async (scheduleKey: string, batchId: string) => {
        await prisma.batchSchedule.upsert({
          where: { id: scheduleKey },
          update: {
            title: lecture.title,
            subject: chapter.subject?.title || null,
            teacherId: lecture.teacherId,
            chapterId: chapter.id,
            lectureId: lecture.id,
            startsAt,
            endsAt,
            ...(isPastCompletedClass && { status: "COMPLETED" }),
          },
          create: {
            id: scheduleKey,
            title: lecture.title,
            subject: chapter.subject?.title || null,
            type: "LIVE_CLASS",
            batchId,
            teacherId: lecture.teacherId,
            chapterId: chapter.id,
            lectureId: lecture.id,
            startsAt,
            endsAt,
            status: isPastCompletedClass ? "COMPLETED" : "SCHEDULED",
            createdById: session.user.id,
          },
        });

        if (isPastCompletedClass && ytVideoId) {
          await prisma.whiteboardSession.upsert({
            where: { batchScheduleId: scheduleKey },
            update: {
              status: "ENDED",
              livePhase: "ENDED",
              videoTransport: "YOUTUBE",
              youtubeVideoId: ytVideoId,
              recordingStatus: "READY",
            },
            create: {
              batchScheduleId: scheduleKey,
              teacherId: lecture.teacherId,
              title: lecture.title,
              status: "ENDED",
              livePhase: "ENDED",
              videoTransport: "YOUTUBE",
              youtubeVideoId: ytVideoId,
              recordingStatus: "READY",
              actualStartedAt: startsAt || new Date(),
              actualEndedAt: endsAt || new Date(),
              pages: { create: { pageNumber: 1, objects: [] } },
            },
          });
        } else {
          // Scheduled Live Class: create WhiteboardSession and pre-schedule unlisted YouTube broadcast
          await prisma.whiteboardSession.upsert({
            where: { batchScheduleId: scheduleKey },
            update: {
              title: lecture.title,
              teacherId: lecture.teacherId,
              videoTransport: "YOUTUBE",
              scheduledStart: startsAt,
              scheduledEnd: endsAt,
            },
            create: {
              batchScheduleId: scheduleKey,
              teacherId: lecture.teacherId,
              title: lecture.title,
              status: "ACTIVE",
              livePhase: "SCHEDULED",
              videoTransport: "YOUTUBE",
              scheduledStart: startsAt,
              scheduledEnd: endsAt,
              pages: { create: { pageNumber: 1, objects: [] } },
            },
          });

          // No YouTube broadcast is pre-created here: each class gets its own
          // broadcast + pooled stream slot at Start Class
          // (src/lib/live-session/app-youtube.ts), never the shared master key.
        }
      };

      // Only the batches this chapter is assigned to. A chapter in no batch
      // used to be dropped into the first ACTIVE batch's timetable while the
      // chapter still said "not assigned"; assigning the chapter to a batch
      // later schedules its lectures there (batches/[id]/chapter-assignments).
      for (let i = 0; i < batchIds.length; i++) {
        const batchId = batchIds[i];
        if (!batchId) continue;
        const scheduleKey = i === 0 ? lecture.id : `${lecture.id}-${batchId}`;
        await syncSchedule(scheduleKey, batchId);
      }
    } catch (syncErr) {
      console.error("[multi_batch_schedule_sync_error]", syncErr);
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "LECTURE_CREATED",
        entityType: "Lecture",
        entityId: lecture.id,
        metadata: {
          chapterId: chapter.id,
          title: lecture.title,
          scheduledDate: lecture.scheduledDate,
          durationMin: lecture.durationMin,
        },
      },
    });

    // New lecture -> both its own creative and the parent chapter's
    // (lecture count, and possibly the derived primary educator) update
    // automatically (spec section 8-9) — never a manual re-upload.
    await regenerateCreativeAwaited("LECTURE", lecture.id);
    await regenerateCreativeAwaited("CHAPTER", chapter.id);

    return apiSuccess({ lecture }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}