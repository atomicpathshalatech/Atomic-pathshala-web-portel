import type { Metadata } from "next";
import Link from "next/link";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { DppSubjectChapterView } from "@/components/student/DppSubjectChapterView";

export const metadata: Metadata = {
  title: "DPP Portal",
};

function statusOfDpp(
  now: Date,
  startsAt: Date,
  endsAt: Date,
  attempt: { status: string; score: number | null } | null
) {
  if (attempt) {
    if (attempt.status === "IN_PROGRESS") {
      return { label: "In Progress", meta: "Incomplete", tone: "bg-secondary-container text-on-secondary-container" };
    }
    return {
      label: "Completed",
      meta: attempt.score !== null ? `Score: ${attempt.score}` : "Submitted",
      tone: "bg-tertiary-container text-on-tertiary-container",
    };
  }
  if (now < startsAt) {
    return { label: "Upcoming", meta: "Opens Soon", tone: "bg-surface-container-high text-on-surface-variant" };
  }
  if (now > endsAt) {
    return { label: "Closed", meta: "Past Due", tone: "bg-error-container text-on-error-container" };
  }
  return { label: "Pending", meta: "Available Now", tone: "bg-primary-container text-on-primary-container" };
}

export default async function DppPortalPage() {
  const { student } = await requireStudentSession();
  const now = new Date();

  const enrollments = await prisma.batchEnrollment.findMany({
    where: { studentId: student.id, status: "ACTIVE" },
    select: { batchId: true },
  });
  const batchIds = enrollments.map((e) => e.batchId);

  const dppSchedules =
    batchIds.length === 0
      ? []
      : await prisma.batchSchedule.findMany({
          where: {
            batchId: { in: batchIds },
            type: "DPP",
          },
          include: {
            batch: { select: { id: true, name: true, code: true } },
            teacher: { include: { user: { select: { name: true } } } },
            test: {
              include: {
                attempts: {
                  where: { studentId: student.id },
                  select: { id: true, status: true, score: true },
                },
              },
            },
          },
          orderBy: { startsAt: "desc" },
        });

  // Group by Subject or Batch
  const subjectsMap: Record<string, typeof dppSchedules> = {};
  for (const dpp of dppSchedules) {
    const subjectName = dpp.subject || "General Practice";
    if (!subjectsMap[subjectName]) {
      subjectsMap[subjectName] = [];
    }
    subjectsMap[subjectName].push(dpp);
  }

  const totalAssigned = dppSchedules.length;
  const totalCompleted = dppSchedules.filter((d) => {
    const attempt = d.test?.attempts[0];
    return attempt && attempt.status !== "IN_PROGRESS";
  }).length;

  return (
    <div className="space-y-stack-lg max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-stack-md">
        <div>
          <p className="flex items-center gap-2 text-label-sm text-on-surface-variant mb-2">
            <span>My Courses</span>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
            <span className="text-primary">DPP Portal</span>
          </p>
          <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface mb-2">
            Daily Practice Problems (DPP)
          </h1>
          <p className="text-on-surface-variant max-w-2xl font-body-lg">
            Practice papers assigned by your batch faculty to reinforce topics covered in lectures.
          </p>
        </div>
        <div className="w-full md:w-auto flex items-center gap-4 bg-primary-container/10 p-4 rounded-xl border border-primary/20">
          <span className="material-symbols-outlined text-primary text-4xl shrink-0">history_edu</span>
          <div>
            <div className="text-primary font-bold">Your Progress</div>
            <div className="text-on-surface-variant text-label-md">
              {totalAssigned} Assigned • {totalCompleted} Completed
            </div>
          </div>
        </div>
      </div>

      {/* Hierarchical Subject -> Chapter -> DPP Interactive View */}
      <DppSubjectChapterView dbDpps={dppSchedules} />
    </div>
  );
}
