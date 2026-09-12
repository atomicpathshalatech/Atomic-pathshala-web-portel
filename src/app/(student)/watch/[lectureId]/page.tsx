import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AtomicVideoPlayer } from "@/components/student/AtomicVideoPlayer";
import { createPresignedDownloadUrl } from "@/lib/storage/r2-client";
import { reconcileRecordingStatus } from "@/lib/livekit/egress";

export const metadata: Metadata = {
  title: "Lecture Video Player — Atomic Pathshala",
};

/**
 * This route used to have ZERO entitlement checks — any logged-in student
 * could watch any batch's lecture (or mint a signed recording URL for any
 * class) just by navigating here with a guessed/shared id, bypassing the
 * enrollment, PUBLISHED-status, and DPP-progression gates the "real" lecture
 * route enforces. Fixed by requiring a session up front, redirecting a
 * resolved Lecture to the real, fully-gated route instead of re-serving it
 * here, and inline-gating the recording-playback branch with
 * resolveBatchAccess (the same centralized check every other batch-gated
 * route now uses).
 */
export default async function WatchLecturePage({ params }: { params?: { lectureId?: string } }) {
  const { student } = await requireStudentSession();
  const targetId = params?.lectureId || "demo-lecture";

  // 1. Try to find lecture from database
  let lecture = await prisma.lecture.findUnique({
    where: { id: targetId },
    include: {
      chapter: {
        include: {
          subject: true,
        },
      },
      teacher: {
        include: {
          user: {
            select: { name: true },
          },
        },
      },
      batchSchedules: {
        include: {
          liveWhiteboardSession: true,
        },
      },
    },
  });

  // 2. If not found by lecture ID, check if targetId is a BatchSchedule ID
  if (!lecture) {
    const schedule = await prisma.batchSchedule.findUnique({
      where: { id: targetId },
      include: {
        lecture: {
          include: {
            chapter: {
              include: {
                subject: true,
              },
            },
            teacher: {
              include: {
                user: {
                  select: { name: true },
                },
              },
            },
            batchSchedules: {
              include: {
                liveWhiteboardSession: true,
              },
            },
          },
        },
        chapter: {
          include: {
            subject: true,
          },
        },
        teacher: {
          include: {
            user: {
              select: { name: true },
            },
          },
        },
        liveWhiteboardSession: true,
      },
    });

    if (schedule?.lecture) {
      lecture = schedule.lecture;
    } else if (schedule) {
      const { resolveBatchAccess } = await import("@/lib/batch/entitlement");
      const access = await resolveBatchAccess(student.userId, schedule.batchId);
      if (
        access.status !== "ACTIVE_ENROLLMENT" &&
        access.status !== "ACTIVE_SUBSCRIPTION" &&
        access.status !== "ADMIN_GRANTED"
      ) {
        redirect("/schedule");
      }

      let resolvedRecUrl = "";
      if (schedule.liveWhiteboardSession) {
        const updated = await reconcileRecordingStatus(schedule.liveWhiteboardSession);
        if (updated) {
          schedule.liveWhiteboardSession.recordingStatus = updated.recordingStatus;
          schedule.liveWhiteboardSession.recordingStorageKey = updated.recordingStorageKey;
        }
      }
      if (
        schedule.liveWhiteboardSession?.recordingStorageKey &&
        schedule.liveWhiteboardSession.recordingStatus === "READY"
      ) {
        try {
          resolvedRecUrl = await createPresignedDownloadUrl({
            key: schedule.liveWhiteboardSession.recordingStorageKey,
            expiresInSeconds: 7200,
          });
        } catch (e) {
          console.error("Failed to create presigned download URL for recording", e);
        }
      }

      return (
        <AtomicVideoPlayer
          lectureId={schedule.id}
          title={schedule.title}
          subjectTitle={schedule.subject || schedule.chapter?.subject?.title || "Live Class"}
          chapterTitle={schedule.chapter?.title || "Class Recording"}
          educatorName={schedule.teacher?.user?.name || "Atomic Faculty"}
          videoUrl={resolvedRecUrl || "https://www.youtube.com/embed/dQw4w9WgXcQ"}
        />
      );
    }
  }

  if (lecture) {
    // Redirect to the real, fully access-checked lecture route instead of
    // re-serving the same content here — that route enforces enrollment,
    // PUBLISHED status, and the DPP-progression gate; duplicating those
    // checks here a second time would just create a fifth copy of the same
    // access rule to keep in sync. Any Batch under this lecture's course
    // works for the URL — the real route's own access check
    // (isEnrolledInCourse) is course-scoped, not tied to a specific batch.
    const batch = await prisma.batch.findFirst({
      where: { courseId: lecture.chapter.subject.courseId },
      select: { id: true },
    });
    if (batch) {
      redirect(
        `/courses/${batch.id}/subjects/${lecture.chapter.subjectId}/chapters/${lecture.chapterId}/lectures/${lecture.id}`
      );
    }
    redirect("/courses");
  }

  // Fallback / Demo video lecture player
  return (
    <AtomicVideoPlayer
      lectureId={targetId}
      title="NEET Chemistry: Chemical Bonding & Molecular Structure (Lec 01)"
      subtitle="Complete hybridization theory, VSEPR model & molecular orbital theory with NCERT deep dive."
      subjectTitle="Chemistry"
      chapterTitle="Chemical Bonding"
      educatorName="Sonu Bhaiya"
      videoUrl="https://www.youtube.com/embed/dQw4w9WgXcQ"
    />
  );
}
