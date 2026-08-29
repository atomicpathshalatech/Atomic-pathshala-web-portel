import type { Metadata } from "next";
import Link from "next/link";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

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

      {dppSchedules.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant font-body-md space-y-2">
          <span className="material-symbols-outlined text-primary/40 text-4xl">assignment_late</span>
          <p className="font-label-lg text-on-surface">No DPPs Assigned Yet</p>
          <p className="text-body-sm text-on-surface-variant">
            Daily practice problems will show up here as your educators schedule them for your batches.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
          {Object.entries(subjectsMap).map(([subjectName, dpps]) => (
            <div key={subjectName} className="flex flex-col gap-stack-md">
              <div className="flex items-center gap-2 px-2">
                <span className="material-symbols-outlined text-primary">science</span>
                <h2 className="font-headline-md text-on-surface">{subjectName}</h2>
                <span className="text-xs bg-surface-container-high px-2 py-0.5 rounded-full text-on-surface-variant font-bold ml-auto">
                  {dpps.length}
                </span>
              </div>
              {dpps.map((dpp) => {
                const attempt = dpp.test?.attempts[0] ?? null;
                const status = statusOfDpp(now, dpp.startsAt, dpp.endsAt, attempt);
                const test = dpp.test;
                const canAttempt =
                  test &&
                  !attempt &&
                  now >= dpp.startsAt &&
                  now <= dpp.endsAt;
                const canResume =
                  test &&
                  attempt?.status === "IN_PROGRESS" &&
                  now <= dpp.endsAt;
                const canViewResult = test && attempt && attempt.status !== "IN_PROGRESS";

                return (
                  <div
                    key={dpp.id}
                    className="glass-card p-stack-md rounded-xl hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${status.tone}`}>
                          {status.label}
                        </span>
                        <span className="text-label-sm font-bold text-on-surface-variant">
                          {status.meta}
                        </span>
                      </div>
                      <h3 className="font-headline-md text-headline-md mb-1 text-on-surface">{dpp.title}</h3>
                      <p className="text-on-surface-variant text-label-sm mb-4">
                        {dpp.teacher?.user.name ? `Assigned by ${dpp.teacher.user.name}` : dpp.batch.name} •{" "}
                        {dpp.startsAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </p>
                      {dpp.notes && (
                        <p className="text-body-sm text-on-surface-variant line-clamp-2 mb-4 bg-surface-container-low p-2 rounded-lg">
                          {dpp.notes}
                        </p>
                      )}
                    </div>

                    <div className="pt-2">
                      {test ? (
                        canAttempt || canResume ? (
                          <Link
                            href={`/tests/${test.id}/attempt`}
                            className="w-full py-2.5 rounded-lg font-label-md flex items-center justify-center gap-2 bg-primary text-on-primary hover:opacity-90 transition-all text-center"
                          >
                            <span className="material-symbols-outlined text-sm">play_arrow</span>
                            {canResume ? "Resume DPP" : "Start DPP"}
                          </Link>
                        ) : canViewResult ? (
                          <Link
                            href={`/tests/${test.id}/result`}
                            className="w-full py-2.5 rounded-lg font-label-md flex items-center justify-center gap-2 border border-primary text-primary hover:bg-primary/5 transition-all text-center"
                          >
                            <span className="material-symbols-outlined text-sm">analytics</span>
                            Review Analysis
                          </Link>
                        ) : (
                          <button
                            disabled
                            className="w-full py-2.5 rounded-lg font-label-md flex items-center justify-center gap-2 bg-surface-container-high text-on-surface opacity-70 cursor-not-allowed"
                          >
                            <span className="material-symbols-outlined text-sm">lock</span>
                            {now < dpp.startsAt ? "Opens Soon" : "Closed"}
                          </button>
                        )
                      ) : (
                        <div className="w-full py-2.5 rounded-lg font-label-sm text-center text-on-surface-variant bg-surface-container-high">
                          Scheduled for {dpp.startsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
