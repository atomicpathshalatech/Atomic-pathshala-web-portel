import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { isEnrolledInCourse } from "@/lib/lecture/access";
import { checkLectureAccess } from "@/lib/chapters/progression";
import { LecturePlayer } from "@/components/student/LecturePlayer";

export const metadata: Metadata = {
  title: "Lecture",
};

export default async function LecturePlayerPage({
  params,
}: {
  params: { batchId: string; subjectId: string; chapterId: string; lectureId: string };
}) {
  const { student } = await requireStudentSession();
  const lectureId = decodeURIComponent(params.lectureId).trim();

  let lecture: any = await prisma.lecture.findUnique({
    where: { id: lectureId },
    include: {
      chapter: { include: { subject: { include: { course: true } } } },
      teacher: { include: { user: { select: { name: true } } } },
      batchSchedules: {
        include: {
          liveWhiteboardSession: true,
        },
      },
    },
  });

  // If not found by lecture ID, check if it is a BatchSchedule ID
  if (!lecture) {
    const schedule = await prisma.batchSchedule.findUnique({
      where: { id: lectureId },
      include: {
        lecture: {
          include: {
            chapter: { include: { subject: { include: { course: true } } } },
            teacher: { include: { user: { select: { name: true } } } },
            batchSchedules: {
              include: {
                liveWhiteboardSession: true,
              },
            },
          },
        },
      },
    });

    if (schedule) {
      if (schedule.lecture) {
        lecture = schedule.lecture;
      } else {
        redirect(`/live-class/${schedule.id}`);
      }
    }
  }

  if (!lecture) {
    redirect("/courses");
  }

  // If this lecture has an active or recent live class schedule, or videoUrl is a live link, redirect to live-class
  if (lecture.videoUrl?.startsWith("/live-class") || lecture.videoUrl?.startsWith("/classroom")) {
    redirect(lecture.videoUrl);
  }

  const activeLiveSchedule = lecture.batchSchedules?.find(
    (s: any) => s.status === "LIVE" || s.liveWhiteboardSession?.status === "ACTIVE"
  );
  if (activeLiveSchedule) {
    redirect(`/live-class/${activeLiveSchedule.id}`);
  }

  const enrolled =
    (await isEnrolledInCourse(student.id, lecture.chapter.subject.courseId)) ||
    (await prisma.batchEnrollment.count({
      where: { studentId: student.id, status: "ACTIVE" },
    })) > 0;

  if (!enrolled) redirect("/courses");

  // prev/next among this chapter's lectures, ordered by `order`
  const siblings = await prisma.lecture.findMany({
    where: { chapterId: lecture.chapterId, status: { in: ["PUBLISHED", "DRAFT"] } },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  const index = siblings.findIndex((s) => s.id === lecture.id);
  const chapterPath = `/courses/${params.batchId}/subjects/${lecture.chapter.subjectId}/chapters/${lecture.chapterId}`;
  const basePath = `${chapterPath}/lectures`;
  const prevHref = index > 0 ? `${basePath}/${siblings[index - 1]!.id}` : null;
  const nextHref = index >= 0 && index < siblings.length - 1 ? `${basePath}/${siblings[index + 1]!.id}` : null;

  // Lecture-driven DPP progression gate
  const lecturePosition = index + 1;
  const access = await checkLectureAccess(student.id, lecture.chapterId, lecturePosition);
  if (!access.unlocked && access.requiredDppCount > 0) {
    redirect(`${chapterPath}?locked=${lecturePosition}&required=${access.requiredDppCount}&submitted=${access.submittedDppCount}`);
  }

  const progress = await prisma.lectureProgress.findUnique({
    where: { lectureId_studentId: { lectureId: lecture.id, studentId: student.id } },
  });

  return (
    <LecturePlayer
      lectureId={lecture.id}
      title={lecture.title}
      language={lecture.language}
      subjectTitle={lecture.chapter.subject.title}
      teacherId={lecture.teacherId}
      teacherName={lecture.teacher.user.name}
      videoUrl={lecture.videoUrl}
      educatorVideoUrl={lecture.educatorVideoUrl}
      slidesUrl={lecture.slidesUrl}
      prevHref={prevHref}
      nextHref={nextHref}
      isCompleted={progress !== null}
    />
  );
}
