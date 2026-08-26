import type { Metadata } from "next";
import Link from "next/link";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Batches",
};

// Same rotating accent set as the Home tab's batch carousels — kept in
// sync so a batch card looks the same whether it's seen on Home or here.
const CARD_ACCENTS = [
  "from-primary/25 via-primary/10 to-transparent",
  "from-secondary/25 via-secondary/10 to-transparent",
  "from-error/20 via-error/5 to-transparent",
  "from-primary/15 via-secondary/15 to-transparent",
];

export default async function CoursesPage() {
  const { student } = await requireStudentSession();

  const enrollments = await prisma.batchEnrollment.findMany({
    where: { studentId: student.id, status: "ACTIVE" },
    include: {
      batch: {
        include: {
          course: true,
          teachers: { select: { id: true } },
          schedules: { where: { endsAt: { gte: new Date() } }, select: { id: true } },
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });

  const enrolledBatchIds = enrollments.map((e) => e.batch.id);

  // "Store" section — every other open batch, ranked by real enrollment
  // count (not invented popularity). No self-serve enroll flow exists yet,
  // so these route to /subscription, same as the Home tab's Popular
  // Batches carousel.
  const otherBatches = await prisma.batch.findMany({
    where: {
      status: { in: ["ACTIVE", "UPCOMING"] },
      id: { notIn: enrolledBatchIds },
    },
    include: {
      course: { select: { title: true } },
      _count: { select: { enrollments: true } },
    },
    orderBy: { enrollments: { _count: "desc" } },
  });

  return (
    <div className="space-y-stack-lg max-w-6xl">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Batches</h1>
        <p className="text-on-surface-variant font-body-md mt-1">
          Your enrolled batches, and every other batch open right now.
        </p>
      </div>

      {/* My Batches */}
      <section>
        <h2 className="font-headline-md text-headline-md text-on-surface mb-3">My Batches</h2>
        {enrollments.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant font-body-md">
            You&apos;re not enrolled in any batch yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {enrollments.map((e, i) => (
              <Link
                key={e.id}
                href={`/courses/${e.batch.id}`}
                className={`rounded-2xl p-5 border border-outline-variant/30 bg-gradient-to-br ${CARD_ACCENTS[i % CARD_ACCENTS.length]} bg-surface-container-lowest hover:border-primary/40 transition-colors block`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="material-symbols-outlined text-on-surface text-2xl">
                    {e.batch.course ? "science" : "hourglass_top"}
                  </span>
                  <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
                </div>
                <h3 className="font-label-lg text-label-lg text-on-surface mt-3">{e.batch.name}</h3>
                <p className="text-label-sm text-on-surface-variant mt-0.5">
                  {e.batch.course ? e.batch.course.title : "No course content linked to this batch yet"}
                </p>
                <p className="text-label-sm text-on-surface-variant mt-3">
                  {e.batch.teachers.length} faculty · {e.batch.schedules.length} upcoming
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Store-style browse section — real batches, real enrollment counts */}
      {otherBatches.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-headline-md text-headline-md text-on-surface">Explore More Batches</h2>
            <Link href="/subscription" className="font-label-md text-label-md text-primary hover:underline">
              See plans
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherBatches.map((b, i) => (
              <Link
                key={b.id}
                href="/subscription"
                className={`rounded-2xl p-5 border border-outline-variant/30 bg-gradient-to-br ${CARD_ACCENTS[(i + 1) % CARD_ACCENTS.length]} bg-surface-container-lowest hover:border-primary/40 transition-colors block`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="material-symbols-outlined text-on-surface text-2xl">auto_stories</span>
                  {b.status === "UPCOMING" && (
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-secondary-container/60 text-secondary shrink-0">
                      Upcoming
                    </span>
                  )}
                </div>
                <h3 className="font-label-lg text-label-lg text-on-surface mt-3">{b.name}</h3>
                <p className="text-label-sm text-on-surface-variant mt-0.5 truncate">
                  {b.course?.title ?? b.targetExam ?? "General"}
                </p>
                <p className="text-label-sm text-on-surface-variant mt-3">
                  {b._count.enrollments} student{b._count.enrollments === 1 ? "" : "s"} enrolled
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
