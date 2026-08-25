import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Doubt Detail",
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

export default async function DoubtDetailPage({ params }: { params: { id: string } }) {
  const { student } = await requireStudentSession();

  const doubt = await prisma.doubt.findFirst({
    where: { id: params.id, studentId: student.id },
    include: { resolvedBy: { select: { name: true } } },
  });
  if (!doubt) notFound();

  return (
    <div className="space-y-stack-lg max-w-3xl">
      <div className="flex items-center gap-3">
        <Link
          href="/doubts"
          className="p-2 rounded-full border border-outline-variant/40 bg-surface-container-lowest hover:bg-surface-container-high transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <div className="flex items-center gap-2">
          {doubt.subject && <span className="text-label-sm text-on-surface-variant">{doubt.subject}</span>}
          <span
            className={`text-label-sm font-semibold px-2.5 py-1 rounded-full ${
              STATUS_CLASS[doubt.status] ?? "bg-surface-container text-on-surface-variant"
            }`}
          >
            {STATUS_LABEL[doubt.status] ?? doubt.status}
          </span>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-5 space-y-3">
        <p className="text-label-sm text-on-surface-variant">
          Asked on{" "}
          {doubt.createdAt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
          {doubt.priority === "HIGH" && <span className="text-error font-semibold"> · Urgent</span>}
        </p>
        <p className="font-body-lg text-body-lg text-on-surface whitespace-pre-wrap">{doubt.body}</p>
        {doubt.attachmentUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- uploaded to external object storage, not a next.config image domain
          <img
            src={doubt.attachmentUrl}
            alt="Attached to this doubt"
            className="max-w-xs rounded-lg border border-outline-variant/40"
          />
        )}
      </div>

      {doubt.status === "RESOLVED" && doubt.expertExplanation ? (
        <div className="glass-card rounded-2xl p-5 space-y-3 border-l-4 border-l-primary">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">verified</span>
            <h2 className="font-headline-md text-headline-md text-on-surface">Expert Explanation</h2>
          </div>
          <p className="font-body-md text-body-md text-on-surface whitespace-pre-wrap">{doubt.expertExplanation}</p>
          {doubt.videoUrl && (
            <a
              href={doubt.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-primary font-label-md text-label-md hover:underline"
            >
              <span className="material-symbols-outlined text-base">play_circle</span>
              Watch video explanation
            </a>
          )}
          {doubt.resolvedBy && (
            <p className="text-label-sm text-on-surface-variant">
              Resolved by {doubt.resolvedBy.name}
              {doubt.resolvedAt &&
                ` on ${doubt.resolvedAt.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`}
            </p>
          )}
        </div>
      ) : (
        <div className="glass-card rounded-xl p-4 flex items-center gap-3 text-on-surface-variant">
          <span className="material-symbols-outlined shrink-0">hourglass_top</span>
          <p className="text-body-md">
            {doubt.status === "FLAGGED"
              ? "This doubt has been flagged for review by our team — you'll be notified once it's resolved."
              : "Our experts haven't answered this one yet. You'll see the explanation here as soon as it's ready."}
          </p>
        </div>
      )}
    </div>
  );
}
