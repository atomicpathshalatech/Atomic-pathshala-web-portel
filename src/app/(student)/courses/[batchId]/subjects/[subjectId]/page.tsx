import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { isEnrolledInCourse } from "@/lib/lecture/access";

export const metadata: Metadata = {
  title: "Subject",
};

export default async function SubjectPage({
  params,
}: {
  params: { batchId: string; subjectId: string };
}) {
  const { student } = await requireStudentSession();

  const subject = await prisma.subject.findUnique({
    where: { id: params.subjectId },
    include: {
      course: true,
      chapters: {
        where: { status: "PUBLISHED" },
        orderBy: { order: "asc" },
        include: { _count: { select: { lectures: { where: { status: "PUBLISHED" } } } } },
      },
    },
  });
  if (!subject) notFound();

  const enrolled = await isEnrolledInCourse(student.id, subject.courseId);
  if (!enrolled) redirect("/courses");

  return (
    <div className="space-y-stack-lg max-w-4xl">
      <div>
        <p className="flex items-center gap-2 text-label-sm text-on-surface-variant mb-2">
          <Link href="/courses" className="hover:text-primary">
            Courses
          </Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <Link href={`/courses/${params.batchId}`} className="hover:text-primary">
            {subject.course.title}
          </Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className="text-primary">{subject.title}</span>
        </p>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{subject.title}</h1>
      </div>

      {subject.chapters.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant font-body-md">
          No chapters added to this subject yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {subject.chapters.map((c) => (
            <li key={c.id}>
              <Link
                href={`/courses/${params.batchId}/subjects/${subject.id}/chapters/${c.id}`}
                className="glass-card rounded-xl p-4 flex items-center justify-between gap-3 hover:shadow-md transition-all block"
              >
                <div>
                  <p className="font-label-md text-label-md text-on-surface">{c.title}</p>
                  <p className="text-label-sm text-on-surface-variant mt-0.5">
                    {c._count.lectures === 0
                      ? "No video lectures yet"
                      : `${c._count.lectures} lecture${c._count.lectures === 1 ? "" : "s"}`}
                  </p>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
