import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Faculty Onboarding Queue" };

const STAGE_LABELS: Record<string, string> = {
  PENDING_DOCUMENTS: "Awaiting Documents",
  PENDING_REVIEW: "Docs Under Review",
  PENDING_CONTRACT: "Awaiting Contract",
  REJECTED: "Rejected",
};

const STAGE_STYLES: Record<string, string> = {
  PENDING_DOCUMENTS: "bg-secondary/10 text-secondary",
  PENDING_REVIEW: "bg-primary/10 text-primary",
  PENDING_CONTRACT: "bg-tertiary/10 text-tertiary",
  REJECTED: "bg-error/10 text-error",
};

export default async function OnboardingQueuePage() {
  const { user } = await requireTeamSession();

  const canReview = await hasPermission(user.id, PERMISSIONS.ONBOARDING_REVIEW);
  if (!canReview) redirect("/team");

  const applications = await prisma.teacher.findMany({
    where: { onboardingStatus: { not: "ACTIVE" } },
    include: {
      user: { select: { name: true, email: true, createdAt: true } },
      documents: { select: { status: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary">Faculty Onboarding Queue</h1>
        <p className="text-on-surface-variant font-body-md mt-1">
          {applications.length} application{applications.length === 1 ? "" : "s"} in progress
        </p>
      </div>

      {applications.length === 0 ? (
        <div className="glass-card rounded-xl p-stack-lg text-center text-on-surface-variant font-body-md">
          No pending applications — the queue is clear.
        </div>
      ) : (
        <div className="glass-card rounded-xl divide-y divide-outline-variant/20">
          {applications.map((app) => {
            const verifiedCount = app.documents.filter((d) => d.status === "VERIFIED").length;
            return (
              <Link
                key={app.id}
                href={`/team/onboarding/${app.id}`}
                className="flex items-center justify-between gap-4 p-stack-md hover:bg-surface-container-high/40 transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-label-lg text-label-lg text-on-surface">{app.user.name}</div>
                  <div className="text-label-sm text-on-surface-variant truncate">
                    {app.user.email} · {app.department}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-label-sm text-on-surface-variant">
                    {verifiedCount}/{app.documents.length || 0} docs verified
                  </span>
                  <span className={`text-label-sm font-label-sm px-2.5 py-1 rounded-full ${STAGE_STYLES[app.onboardingStatus]}`}>
                    {STAGE_LABELS[app.onboardingStatus]}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
