import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { isEnrolledInCourse } from "@/lib/lecture/access";
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
  const basePath = `/courses/${params.batchId}/subjects/${params.subjectId}/chapters/${params.chapterId}/lectures`;
  const prevHref = index > 0 ? `${basePath}/${siblings[index - 1]!.id}` : null;
  const nextHref = index >= 0 && index < siblings.length - 1 ? `${basePath}/${siblings[index + 1]!.id}` : null;

  return (
    <LecturePlayer
      lectureId={lecture.id}
      title={lecture.title}
      language={lecture.language}
      subjectTitle={lecture.chapter.subject.title}
      teacherName={lecture.teacher.user.name}
      videoUrl={lecture.videoUrl}
      educatorVideoUrl={lecture.educatorVideoUrl}
      slidesUrl={lecture.slidesUrl}
      prevHref={prevHref}
      nextHref={nextHref}
    />
  );
}
