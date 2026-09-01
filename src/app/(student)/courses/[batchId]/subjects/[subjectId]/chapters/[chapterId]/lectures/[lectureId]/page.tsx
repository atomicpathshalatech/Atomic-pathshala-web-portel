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

  const lecture = await prisma.lecture.findUnique({
    where: { id: params.lectureId },
    include: {
      chapter: { include: { subject: { include: { course: true } } } },
      teacher: { include: { user: { select: { name: true } } } },
    },
  });
  if (!lecture || lecture.chapterId !== params.chapterId || lecture.status !== "PUBLISHED") notFound();
  if (lecture.chapter.subjectId !== params.subjectId) notFound();

  const enrolled = await isEnrolledInCourse(student.id, lecture.chapter.subject.courseId);
  if (!enrolled) redirect("/courses");

  // prev/next among this chapter's other PUBLISHED lectures, ordered by
  // `order` — matches the same ordering the chapter list page shows.
  const siblings = await prisma.lecture.findMany({
    where: { chapterId: params.chapterId, status: "PUBLISHED" },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  const index = siblings.findIndex((s) => s.id === lecture.id);
  const chapterPath = `/courses/${params.batchId}/subjects/${params.subjectId}/chapters/${params.chapterId}`;
  const basePath = `${chapterPath}/lectures`;
  const prevHref = index > 0 ? `${basePath}/${siblings[index - 1]!.id}` : null;
  const nextHref = index >= 0 && index < siblings.length - 1 ? `${basePath}/${siblings[index + 1]!.id}` : null;

  // Lecture-driven DPP progression gate — backend-enforced, not just a
  // disabled button in the UI. Position is 1-indexed among this chapter's
  // PUBLISHED lectures; `index` above is already 0-indexed for the same
  // ordering, so position = index + 1.
  const lecturePosition = index + 1;
  const access = await checkLectureAccess(student.id, params.chapterId, lecturePosition);
  if (!access.unlocked) {
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
