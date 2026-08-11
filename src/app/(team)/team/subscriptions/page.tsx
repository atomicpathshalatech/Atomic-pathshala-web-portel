import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Subscriptions" };

const STATUS_STYLES: Record<string, string> = {
  TRIAL: "bg-secondary/10 text-secondary",
  ACTIVE: "bg-tertiary/10 text-tertiary",
  PAST_DUE: "bg-error/10 text-error",
  CANCELLED: "bg-outline-variant/20 text-on-surface-variant",
  EXPIRED: "bg-outline-variant/20 text-on-surface-variant",
};

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { user } = await requireTeamSession();
  const canView = await hasPermission(user.id, PERMISSIONS.FINANCE_READ);
  if (!canView) redirect("/team");
  const canManagePricing = await hasPermission(user.id, PERMISSIONS.SUBSCRIPTION_MANAGE);

  const { q } = await searchParams;

  const [subscriptions, statusCounts] = await Promise.all([
    prisma.subscription.findMany({
      where: q
        ? {
            student: {
              OR: [
                { user: { name: { contains: q, mode: "insensitive" } } },
                { enrollmentNumber: { contains: q, mode: "insensitive" } },
              ],
            },
          }
        : undefined,
      include: { student: { include: { user: { select: { name: true } } } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.subscription.groupBy({ by: ["status"], _count: true }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-primary">Subscriptions</h1>
          <p className="text-on-surface-variant font-body-md mt-1">
            Student plan status, and manual grants for offline/cash payments.
          </p>
        </div>
        {canManagePricing && (
          <Link
            href="/team/subscriptions/pricing"
            className="px-4 py-2 rounded-lg bg-primary/10 text-primary font-label-md text-label-md hover:bg-primary/20 shrink-0"
          >
            Manage pricing
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {["TRIAL", "ACTIVE", "PAST_DUE", "CANCELLED", "EXPIRED"].map((status) => (
          <div key={status} className="glass-card rounded-xl p-4 text-center">
            <div className="font-headline-md text-headline-md text-primary">
              {statusCounts.find((s) => s.status === status)?._count ?? 0}
            </div>
            <div className="text-label-sm font-label-sm text-on-surface-variant">{status}</div>
          </div>
        ))}
      </div>

      <form className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by student name or enrollment number…"
          className="flex-1 px-4 py-2.5 rounded-lg border border-outline-variant/40 bg-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="submit"
          className="px-5 py-2.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:opacity-90"
        >
          Search
        </button>
      </form>

      {subscriptions.length === 0 ? (
        <div className="glass-card rounded-xl p-stack-lg text-center text-on-surface-variant font-body-md">
          No subscriptions found.
        </div>
      ) : (
        <div className="glass-card rounded-xl divide-y divide-outline-variant/20">
          {subscriptions.map((s) => (
            <Link
              key={s.id}
              href={`/team/subscriptions/${s.studentId}`}
              className="flex items-center justify-between gap-4 p-stack-md hover:bg-surface-container-high/40 transition-colors"
            >
              <div className="min-w-0">
                <div className="font-label-lg text-label-lg text-on-surface">
                  {s.student.user.name}
                </div>
                <div className="text-label-sm text-on-surface-variant truncate">
                  {s.student.enrollmentNumber} · {s.plan} · {s.billingCycle}
                  {s.pendingPlan && ` · switching to ${s.pendingPlan} next cycle`}
                </div>
              </div>
              <span
                className={`text-label-sm font-label-sm px-2.5 py-1 rounded-full shrink-0 ${STATUS_STYLES[s.status]}`}
              >
                {s.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
