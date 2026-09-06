import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { AtomicVideoPlayer } from "@/components/student/AtomicVideoPlayer";
import { createPresignedDownloadUrl } from "@/lib/storage/r2-client";

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
    let resolvedVideoUrl = lecture.videoUrl;

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
      }
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
