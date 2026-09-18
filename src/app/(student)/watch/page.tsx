import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { AtomicVideoPlayer } from "@/components/student/AtomicVideoPlayer";
import { createPresignedDownloadUrl } from "@/lib/storage/r2-client";

function RecordingNotReady({ title, status }: { title: string; status?: string }) {
  const failed = status === "FAILED" || status === "RECORDING_FAILED";
  return (
    <div className="min-h-screen-safe w-full bg-[#031635] text-white flex flex-col items-center justify-center gap-4 px-6 text-center">
      <span className={`material-symbols-outlined text-5xl ${failed ? "text-rose-400" : "text-blue-400"}`}>
        {failed ? "error" : "hourglass_top"}
      </span>
      <h1 className="text-lg font-bold">{title}</h1>
      <p className="text-sm text-slate-300 max-w-md">
        {failed
          ? "This class's recording could not be generated. Please contact support if you need this lecture."
          : "Recording is being processed. It will be available shortly — please check back in a few minutes."}
      </p>
      <Link
        href="/schedule"
        className="mt-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition"
      >
        Back to Schedule
      </Link>
    </div>
  );
}

export const metadata: Metadata = {
  title: "Lecture Video Player — Atomic Pathshala",
};

export default async function WatchLecturePage({ params }: { params?: { lectureId?: string } }) {
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
      let resolvedRecUrl = "";
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

      if (!resolvedRecUrl) {
        return <RecordingNotReady title={schedule.title} status={schedule.liveWhiteboardSession?.recordingStatus} />;
      }

      return (
        <AtomicVideoPlayer
          lectureId={schedule.id}
          title={schedule.title}
          subjectTitle={schedule.subject || schedule.chapter?.subject?.title || "Live Class"}
          chapterTitle={schedule.chapter?.title || "Class Recording"}
          educatorName={schedule.teacher?.user?.name || "Atomic Faculty"}
          videoUrl={resolvedRecUrl}
        />
      );
    }
  }

  if (lecture) {
    let resolvedVideoUrl = lecture.videoUrl;
    let pendingSessionStatus: string | undefined;

    // If lecture.videoUrl is not set, check if any attached batchSchedule has a ready recording
    if (!resolvedVideoUrl) {
      const scheduleWithRec = lecture.batchSchedules?.find(
        (s) =>
          s.liveWhiteboardSession?.recordingStatus === "READY" &&
          s.liveWhiteboardSession.recordingStorageKey
      );
      if (scheduleWithRec?.liveWhiteboardSession?.recordingStorageKey) {
        try {
          resolvedVideoUrl = await createPresignedDownloadUrl({
            key: scheduleWithRec.liveWhiteboardSession.recordingStorageKey,
            expiresInSeconds: 7200,
          });
        } catch (e) {
          console.error("Failed to create presigned download URL for lecture recording", e);
        }
      } else {
        // No ready recording — if a live class actually happened for this
        // lecture, surface its real status instead of silently playing an
        // unrelated placeholder video.
        pendingSessionStatus = lecture.batchSchedules?.find((s) => s.liveWhiteboardSession)
          ?.liveWhiteboardSession?.recordingStatus;
      }
    }

    if (!resolvedVideoUrl && pendingSessionStatus) {
      return <RecordingNotReady title={lecture.title} status={pendingSessionStatus} />;
    }

    return (
      <AtomicVideoPlayer
        lectureId={lecture.id}
        title={lecture.title}
        subjectTitle={lecture.chapter.subject.title}
        chapterTitle={lecture.chapter.title}
        educatorName={lecture.teacher.user.name || "Sonu Bhaiya"}
        videoUrl={resolvedVideoUrl || "https://www.youtube.com/embed/dQw4w9WgXcQ"}
        educatorVideoUrl={lecture.educatorVideoUrl}
        slidesUrl={lecture.slidesUrl}
      />
    );
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
