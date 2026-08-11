import type { Metadata } from "next";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { DoubtForm } from "@/components/student-portal/DoubtForm";

export const metadata: Metadata = {
  title: "Ask a Doubt",
};

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-primary-container text-on-primary-container",
  RESOLVED: "bg-tertiary-container text-on-tertiary-container",
  FLAGGED: "bg-error-container text-on-error-container",
};

export default async function DoubtsPage() {
  const { student } = await requireStudentSession();

  const doubts = await prisma.doubt.findMany({
    where: { studentId: student.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-stack-lg max-w-3xl">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Ask a Doubt</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Stuck on something? Submit it here and a subject expert will respond.
        </p>
      </div>

      <DoubtForm />

      <div className="space-y-4">
        <h2 className="font-headline-md text-headline-md text-on-surface">Your Doubts</h2>

        {doubts.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center text-on-surface-variant font-body-md">
            You haven&apos;t submitted any doubts yet.
          </div>
        ) : (
          <div className="space-y-3">
            {doubts.map((d) => (
              <div key={d.id} className="glass-card rounded-xl p-4">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex items-center gap-2">
                    {d.subject && (
                      <span className="text-label-sm font-label-sm text-primary font-bold">{d.subject}</span>
                    )}
                    <span className="text-label-sm text-on-surface-variant">
                      {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(d.createdAt)}
                    </span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${STATUS_STYLES[d.status]}`}>
                    {d.status}
                  </span>
                </div>
                <p className="text-body-md text-on-surface mb-2">{d.body}</p>
                {d.status === "RESOLVED" && d.expertExplanation && (
                  <div className="mt-3 bg-tertiary-container/10 border border-tertiary/20 rounded-lg p-3">
                    <p className="text-label-sm font-label-sm text-tertiary font-bold mb-1">Expert Answer</p>
                    <p className="text-body-md text-on-surface">{d.expertExplanation}</p>
                    {d.videoUrl && (
                      <a
                        href={d.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-label-sm text-primary hover:underline"
                      >
                        <span className="material-symbols-outlined text-base">play_circle</span>
                        Watch video walkthrough
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
