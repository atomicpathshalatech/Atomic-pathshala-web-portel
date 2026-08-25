import type { Metadata } from "next";
import Link from "next/link";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Courses",
};

export default async function CoursesPage() {
  const { student } = await requireStudentSession();

  const enrollments = await prisma.batchEnrollment.findMany({
    where: { studentId: student.id, status: "ACTIVE" },
    include: { batch: { include: { course: true } } },
    orderBy: { enrolledAt: "desc" },
  });

  return (
    <div className="space-y-stack-lg max-w-4xl">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Courses</h1>
        <p className="text-on-surface-variant font-body-md mt-1">
          Recorded lectures, chapter-wise, for the batches you're enrolled in.
        </p>
      </div>

      {enrollments.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant font-body-md">
          You're not enrolled in any batch yet.
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {enrollments.map((e) => (
            <li key={e.id}>
              {e.batch.course ? (
                <Link
                  href={`/courses/${e.batch.id}`}
                  className="glass-card rounded-xl p-5 flex items-center justify-between gap-3 hover:shadow-md transition-all block"
                >
                  <div>
                    <p className="font-label-md text-label-md text-on-surface">{e.batch.name}</p>
                    <p className="text-label-sm text-on-surface-variant mt-0.5">{e.batch.course.title}</p>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
                </Link>
              ) : (
                <div className="glass-card rounded-xl p-5 opacity-60">
                  <p className="font-label-md text-label-md text-on-surface">{e.batch.name}</p>
                  <p className="text-label-sm text-on-surface-variant mt-0.5">
                    No course content linked to this batch yet.
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
