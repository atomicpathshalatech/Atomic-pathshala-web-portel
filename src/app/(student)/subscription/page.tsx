import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { syncSubscriptionStatus } from "@/lib/subscription/guard";
import { SubscriptionManager } from "@/components/student/SubscriptionManager";

export default async function SubscriptionPage() {
  const { student } = await requireStudentSession();

  const raw = await prisma.subscription.findUnique({ where: { studentId: student.id } });
  const subscription = raw ? await syncSubscriptionStatus(raw) : null;

  return (
    <div className="space-y-stack-lg">
      <div>
        <h1 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg">
          Your <span className="text-primary">Subscription</span>
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Every plan unlocks all batches, test series, notes and the full question bank —
          Pro adds mentorship, NEET UG Assure, and more.
        </p>
      </div>

      <SubscriptionManager
        initialSubscription={
          subscription
            ? {
                id: subscription.id,
                plan: subscription.plan,
                status: subscription.status,
                billingCycle: subscription.billingCycle,
                pendingPlan: subscription.pendingPlan,
                trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
                currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
                cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
              }
            : null
        }
        studentName={student.user.name}
        studentEmail={student.user.email}
      />
    </div>
  );
}
