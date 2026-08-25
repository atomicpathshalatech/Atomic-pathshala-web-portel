import "server-only";
import { prisma } from "@/lib/db";
import type { BillingCycle, SubscriptionPlan } from "@prisma/client";
import { DEFAULT_PLAN_PRICING } from "./plan-pricing-defaults";

export { DEFAULT_PLAN_PRICING };

/** The price actually charged at checkout — DB value if the admin has set
 *  one, otherwise the seed default above. */
export async function getPlanPrice(plan: SubscriptionPlan, cycle: BillingCycle): Promise<number> {
  const row = await prisma.planPricing.findUnique({
    where: { plan_billingCycle: { plan, billingCycle: cycle } },
  });
  return row?.amount ?? DEFAULT_PLAN_PRICING[plan]![cycle]!;
}

/** Full 2-plan x 4-cycle price grid, DB values merged over the defaults —
 *  used by the admin pricing page. */
export async function getAllPlanPricing(): Promise<
  Record<SubscriptionPlan, Record<BillingCycle, number>>
> {
  const rows = await prisma.planPricing.findMany();
  const result: Record<SubscriptionPlan, Record<BillingCycle, number>> = {
    BASIC: { ...DEFAULT_PLAN_PRICING.BASIC },
    PRO: { ...DEFAULT_PLAN_PRICING.PRO },
  };
  for (const row of rows) {
    result[row.plan]![row.billingCycle] = row.amount;
  }
  return result;
}

/** Upserts one or more (plan, cycle) -> amount entries. Existing
 *  subscriptions are unaffected — a price change only applies to new
 *  checkouts and future renewal cycles. */
export async function updatePlanPricing(
  entries: { plan: SubscriptionPlan; billingCycle: BillingCycle; amount: number }[],
  updatedBy: string
) {
  return prisma.$transaction(
    entries.map((e) =>
      prisma.planPricing.upsert({
        where: { plan_billingCycle: { plan: e.plan, billingCycle: e.billingCycle } },
        create: { plan: e.plan, billingCycle: e.billingCycle, amount: e.amount, updatedBy },
        update: { amount: e.amount, updatedBy },
      })
    )
  );
}
