import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Course",
};

export default async function BatchCoursePage({ params }: { params: { batchId: string } }) {
  const { student } = await requireStudentSession();

  const enrollment = await prisma.batchEnrollment.findUnique({
    where: { batchId_studentId: { batchId: params.batchId, studentId: student.id } },
    include: { batch: { include: { course: { include: { subjects: true } } } } },
  });
  if (!enrollment || enrollment.status !== "ACTIVE") redirect("/courses");
  if (!enrollment.batch.course) notFound();

  const course = enrollment.batch.course;

  return (
    <div className="space-y-stack-lg max-w-4xl">
      <div>
        <p className="flex items-center gap-2 text-label-sm text-on-surface-variant mb-2">
          <Link href="/courses" className="hover:text-primary">
            Courses
          </Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className="text-primary">{enrollment.batch.name}</span>
        </p>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{course.title}</h1>
        {course.description && <p className="text-on-surface-variant font-body-md mt-1">{course.description}</p>}
      </div>

      {course.subjects.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant font-body-md">
          No subjects added to this course yet.
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {course.subjects.map((s) => (
            <li key={s.id}>
              <Link
                href={`/courses/${enrollment.batch.id}/subjects/${s.id}`}
                className="glass-card rounded-xl p-5 flex items-center justify-between gap-3 hover:shadow-md transition-all block"
              >
                <p className="font-label-md text-label-md text-on-surface">{s.title}</p>
                <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
