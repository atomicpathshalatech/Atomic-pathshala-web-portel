import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { isEnrolledInCourse } from "@/lib/lecture/access";

export const metadata: Metadata = {
  title: "Chapter",
};

export default async function ChapterPage({
  params,
}: {
  params: { batchId: string; subjectId: string; chapterId: string };
}) {
  const { student } = await requireStudentSession();

  const chapter = await prisma.chapter.findUnique({
    where: { id: params.chapterId },
    include: {
      subject: { include: { course: true } },
      lectures: {
        where: { status: "PUBLISHED" },
        orderBy: { order: "asc" },
        include: { teacher: { include: { user: { select: { name: true } } } } },
      },
    },
  });
  if (!chapter || chapter.subjectId !== params.subjectId) notFound();

  const enrolled = await isEnrolledInCourse(student.id, chapter.subject.courseId);
  if (!enrolled) redirect("/courses");

  return (
    <div className="space-y-stack-lg max-w-4xl">
      <div>
        <p className="flex items-center gap-2 text-label-sm text-on-surface-variant mb-2 flex-wrap">
          <Link href="/courses" className="hover:text-primary">
            Courses
          </Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <Link href={`/courses/${params.batchId}/subjects/${chapter.subject.id}`} className="hover:text-primary">
            {chapter.subject.title}
          </Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className="text-primary">{chapter.title}</span>
        </p>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{chapter.title}</h1>
      </div>

      {chapter.lectures.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant font-body-md">
          No video lectures published for this chapter yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {chapter.lectures.map((l, i) => (
            <li key={l.id}>
              <Link
                href={`/courses/${params.batchId}/subjects/${chapter.subject.id}/chapters/${chapter.id}/lectures/${l.id}`}
                className="glass-card rounded-xl p-4 flex items-center gap-4 hover:shadow-md transition-all block"
              >
                <span className="w-9 h-9 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center font-label-md text-label-md">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-label-md text-label-md text-on-surface truncate">{l.title}</p>
                  <p className="text-label-sm text-on-surface-variant mt-0.5">
                    {l.teacher.user.name} · {l.language}
                  </p>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant shrink-0">play_circle</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
