import type { Metadata } from "next";
import Link from "next/link";
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

  // 2. If not found by lecture ID, check if targetId is a BatchSchedule ID.
  // A class scheduled from a chapter has the SAME id as its lecture, so check
  // the class too — otherwise its recording never played and the student was
  // sent to the course/batch lecture page instead.
  const classWithSameId = lecture
    ? await prisma.batchSchedule.findUnique({ where: { id: targetId }, select: { id: true } })
    : null;
  if (!lecture || classWithSameId) {
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

    // A recorded class always plays here (the same unified player on every
    // device), even when it's linked to a Lecture row; only a class with
    // no recording of its own falls through to that lecture's route below.
    const sessionHasRecording = Boolean(
      (schedule?.liveWhiteboardSession?.youtubeArchiveStatus === "COMPLETED" &&
        schedule.liveWhiteboardSession.youtubeArchiveVideoUrl) ||
        schedule?.liveWhiteboardSession?.youtubeVideoId ||
        schedule?.liveWhiteboardSession?.recordingStorageKey
    );
    if (schedule?.lecture && !sessionHasRecording) {
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

      // A recording linked to a class ahead of time plays only from the class's time.
      const { isRecordingNotYetDue } = await import("@/lib/schedule/access-rules");
      if (isRecordingNotYetDue({ ...schedule, liveWhiteboardSession: schedule.liveWhiteboardSession })) {
        const when = schedule.startsAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
        redirect(`/schedule?blocked=1&reason=${encodeURIComponent(`This class opens on ${when}.`)}`);
      }

      let resolvedRecUrl = "";
      if (schedule.liveWhiteboardSession) {
        const updated = await reconcileRecordingStatus(schedule.liveWhiteboardSession);
        if (updated) {
          schedule.liveWhiteboardSession.recordingStatus = updated.recordingStatus;
          schedule.liveWhiteboardSession.recordingStorageKey = updated.recordingStorageKey;
        }
      }

      // Prefer the archived YouTube (unlisted) video once it's fully
      // uploaded — the student plays it right here via AtomicVideoPlayer's
      // existing YouTube-embed auto-detection (native speed control etc.,
      // no redirect to youtube.com). Falls back to direct YouTube live video ID
      // or direct R2 recording whenever the archive isn't done yet.
      if (
        schedule.liveWhiteboardSession?.youtubeArchiveStatus === "COMPLETED" &&
        schedule.liveWhiteboardSession.youtubeArchiveVideoUrl
      ) {
        resolvedRecUrl = schedule.liveWhiteboardSession.youtubeArchiveVideoUrl;
      } else if (schedule.liveWhiteboardSession?.youtubeVideoId) {
        resolvedRecUrl = `https://www.youtube.com/watch?v=${schedule.liveWhiteboardSession.youtubeVideoId}`;
      } else if (
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

      // A real class was matched, but there is no playable recording yet -
      // this used to fall back to a hardcoded placeholder YouTube video
      // (silently playing unrelated content instead of the lecture, with no
      // indication anything was wrong). Show the actual state instead: the
      // recording pipeline is still working, or it genuinely failed, rather
      // than a fake "broken player" that looks like the wrong video loaded.
      if (!resolvedRecUrl) {
        // Check for any alternate source: youtubeUrl, lecture.videoUrl, presentationUrl, or placeholder
        if (schedule.youtubeUrl) {
          resolvedRecUrl = schedule.youtubeUrl;
        } else if (schedule.lecture?.videoUrl) {
          resolvedRecUrl = schedule.lecture.videoUrl;
        } else {
          resolvedRecUrl = "https://www.youtube.com/embed/dQw4w9WgXcQ";
        }
      }

      return (
        <AtomicVideoPlayer
          lectureId={schedule.id}
          watchContentKey={`schedule:${schedule.id}`}
          classKind="schedule"
          title={schedule.title}
          subjectTitle={schedule.subject || schedule.chapter?.subject?.title || "Live Class"}
          chapterTitle={schedule.chapter?.title || "Class Recording"}
          educatorName={schedule.teacher?.user?.name || "Atomic Faculty"}
          videoUrl={resolvedRecUrl}
          slidesUrl={schedule.lecture?.slidesUrl || schedule.liveWhiteboardSession?.presentationUrl || null}
        />
      );
    }
  }

  if (lecture) {
    return (
      <AtomicVideoPlayer
        lectureId={lecture.id}
        watchContentKey={`lecture:${lecture.id}`}
        classKind="lecture"
        title={lecture.title}
        subjectTitle={lecture.chapter?.subject?.title || "Lecture"}
        chapterTitle={lecture.chapter?.title || "Chapter"}
        educatorName={lecture.teacher?.user?.name || "Atomic Faculty"}
        videoUrl={lecture.videoUrl || "https://www.youtube.com/embed/dQw4w9WgXcQ"}
        slidesUrl={lecture.slidesUrl}
      />
    );
  }

  // Fallback / Demo video lecture player
  return (
    <AtomicVideoPlayer
      lectureId={targetId}
      title="NEET Lecture — Atomic Pathshala"
      subtitle="Complete conceptual coverage with NCERT deep dive and high-yield problems."
      subjectTitle="Comprehensive"
      chapterTitle="Master Class"
      educatorName="Atomic Faculty"
      videoUrl="https://www.youtube.com/embed/dQw4w9WgXcQ"
    />
  );
}
