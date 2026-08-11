import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getAllPlanPricing } from "@/lib/subscription/pricing";
import { PlanPricingEditor } from "@/components/team-portal/PlanPricingEditor";

export const metadata: Metadata = { title: "Plan Pricing" };

export default async function PlanPricingPage() {
  const { user } = await requireTeamSession();
  const canManage = await hasPermission(user.id, PERMISSIONS.SUBSCRIPTION_MANAGE);
  if (!canManage) redirect("/team/subscriptions");

  const pricing = await getAllPlanPricing();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary">Plan Pricing</h1>
        <p className="text-on-surface-variant font-body-md mt-1">
          Set BASIC and PRO prices for each billing cycle. Changes take effect immediately for
          new checkouts.
        </p>
      </div>

      <PlanPricingEditor initialPricing={pricing} />
    </div>
  );
}
