import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { AtomicVideoPlayer } from "@/components/student/AtomicVideoPlayer";

export const metadata: Metadata = {
  title: "Lecture Video Player — Atomic Pathshala",
};

export default async function WatchLecturePage({ params }: { params?: { lectureId?: string } }) {
  const lectureId = params?.lectureId || "demo-lecture";

  // Try to find lecture from database
  const lecture = await prisma.lecture.findUnique({
    where: { id: lectureId },
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
    },
  });

  if (lecture) {
    return (
      <AtomicVideoPlayer
        lectureId={lecture.id}
        title={lecture.title}
        subjectTitle={lecture.chapter.subject.title}
        chapterTitle={lecture.chapter.title}
        educatorName={lecture.teacher.user.name || "Sonu Bhaiya"}
        videoUrl={lecture.videoUrl}
        educatorVideoUrl={lecture.educatorVideoUrl}
        slidesUrl={lecture.slidesUrl}
      />
    );
  }

  // Fallback / Demo video lecture player
  return (
    <AtomicVideoPlayer
      lectureId={lectureId}
      title="NEET Chemistry: Chemical Bonding & Molecular Structure (Lec 01)"
      subtitle="Complete hybridization theory, VSEPR model & molecular orbital theory with NCERT deep dive."
      subjectTitle="Chemistry"
      chapterTitle="Chemical Bonding"
      educatorName="Sonu Bhaiya"
      videoUrl="https://www.youtube.com/embed/dQw4w9WgXcQ"
    />
  );
}
