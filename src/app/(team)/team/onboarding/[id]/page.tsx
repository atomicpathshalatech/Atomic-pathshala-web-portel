import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";
import { DocumentVerificationPanel } from "@/components/team-portal/DocumentVerificationPanel";
import { ContractComposeForm } from "@/components/team-portal/ContractComposeForm";
import { RejectApplicationButton } from "@/components/team-portal/RejectApplicationButton";

export const metadata: Metadata = { title: "Review Educator Onboarding" };

export default async function OnboardingReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await requireTeamSession();

  const canReview = await hasPermission(user.id, PERMISSIONS.ONBOARDING_REVIEW);
  if (!canReview) redirect("/team");

  const teacher = await prisma.teacher.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      documents: { orderBy: { createdAt: "desc" } },
      contracts: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!teacher) notFound();

  const latestContract = teacher.contracts[0];

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <Link href="/team/onboarding" className="text-label-md font-label-md text-on-surface-variant hover:text-primary">
          ← Onboarding Queue
        </Link>
        <h1 className="font-headline-lg text-headline-lg text-primary mt-2">{teacher.user.name}</h1>
        <p className="text-on-surface-variant font-body-md mt-1">
          {teacher.user.email} · {teacher.department} · Employee Code: {teacher.employeeCode}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Identity Documents</h2>
        <DocumentVerificationPanel documents={teacher.documents} />
      </section>

      {teacher.onboardingStatus === "PENDING_CONTRACT" && !latestContract && (
        <section className="space-y-3">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Send Contract</h2>
          <p className="text-on-surface-variant font-body-sm">
            Documents are verified. Compose and send the employment contract for e-signature.
          </p>
          <ContractComposeForm teacherId={teacher.id} />
        </section>
      )}

      {latestContract && (
        <section className="space-y-3">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Contract Status</h2>
          <div className="glass-card rounded-xl p-stack-md flex items-center justify-between">
            <div>
              <div className="font-label-lg text-label-lg text-on-surface">{latestContract.title}</div>
              <div className="text-label-sm text-on-surface-variant mt-1">Status: {latestContract.status}</div>
            </div>
            <Link
              href={`/team/contracts/${latestContract.id}`}
              className="font-label-md text-label-md text-primary hover:underline"
            >
              View
            </Link>
          </div>
        </section>
      )}

      {teacher.onboardingStatus !== "REJECTED" && (
        <section className="pt-2 border-t border-outline-variant/20 pt-6">
          <RejectApplicationButton teacherId={teacher.id} />
        </section>
      )}
    </div>
  );
}
