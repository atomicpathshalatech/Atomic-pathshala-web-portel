import type { Metadata } from "next";
import Link from "next/link";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { DoubtForm } from "@/components/student-portal/DoubtForm";
import { AiDoubtSolver } from "@/components/student/AiDoubtSolver";

export const metadata: Metadata = {
  title: "Doubts",
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Pending",
  RESOLVED: "Resolved",
  FLAGGED: "Flagged for Review",
};

const STATUS_CLASS: Record<string, string> = {
  OPEN: "bg-secondary-container text-on-secondary-container",
  RESOLVED: "bg-primary-container text-on-primary",
  FLAGGED: "bg-error/10 text-error",
};

export default async function DoubtsPage() {
  const { student } = await requireStudentSession();

  const doubts = await prisma.doubt.findMany({
    where: { studentId: student.id },
    orderBy: { createdAt: "desc" },
    include: { resolvedBy: { select: { name: true } } },
  });

  return (
    <div className="space-y-stack-lg max-w-6xl">
      <header>
        <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface">Doubt Portal</h1>
        <p className="text-body-lg text-on-surface-variant mt-2">
          Stuck on something? Use Atomic AI Tutor for instant step-by-step assistance or ask a faculty expert.
        </p>
      </header>

      <AiDoubtSolver />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_1.3fr] gap-gutter items-start">
        <DoubtForm />

        <div className="space-y-3">
          <h2 className="font-headline-md text-headline-md text-on-surface">Your Doubts</h2>
          {doubts.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant font-body-md">
              You haven&apos;t asked any doubts yet. Use the form to ask your first one.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {doubts.map((doubt) => (
                <Link
                  key={doubt.id}
                  href={`/doubts/${doubt.id}`}
                  className="glass-card rounded-xl p-4 flex flex-col gap-2 hover:bg-surface-container-high transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {doubt.subject && (
                        <span className="text-label-sm text-on-surface-variant shrink-0">{doubt.subject}</span>
                      )}
                      {doubt.priority === "HIGH" && (
                        <span className="text-label-sm text-error font-semibold shrink-0">Urgent</span>
                      )}
                    </div>
                    <span
                      className={`shrink-0 text-label-sm font-semibold px-2.5 py-1 rounded-full ${
                        STATUS_CLASS[doubt.status] ?? "bg-surface-container text-on-surface-variant"
                      }`}
                    >
                      {STATUS_LABEL[doubt.status] ?? doubt.status}
                    </span>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface line-clamp-2">{doubt.body}</p>
                  <p className="text-label-sm text-on-surface-variant flex items-center gap-1.5">
                    {doubt.createdAt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                    {doubt.attachmentUrl && (
                      <span className="material-symbols-outlined text-sm" title="Has an attached photo">
                        photo
                      </span>
                    )}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
