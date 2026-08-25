import type { BillingCycle, SubscriptionPlan } from "@prisma/client";

/**
 * Seed/fallback prices (INR). Derived from the ANNUAL price
 * (BASIC ₹2,400/yr, PRO ₹3,600/yr) — the shorter cycles are that annual
 * rate split proportionally by days, rounded to a clean ₹X99 figure.
 *
 * These are ONLY the seed values and the fallback used if a `PlanPricing`
 * row is somehow missing. The live, admin-editable numbers live in the
 * `PlanPricing` table — edit them at /team/subscriptions/pricing (requires
 * the SUBSCRIPTION_MANAGE permission), not here.
 *
 * Deliberately has NO "server-only" import (unlike pricing.ts) — this file
 * holds plain data only, so it's safe to import from prisma/seed.ts (which
 * runs under plain Node/tsx, not the Next.js server runtime that
 * "server-only" requires).
 */
export const DEFAULT_PLAN_PRICING: Record<SubscriptionPlan, Record<BillingCycle, number>> = {
  BASIC: {
    MONTHLY: 199,
    QUARTERLY: 599,
    HALF_YEARLY: 1199,
    ANNUAL: 2400,
  },
  PRO: {
    MONTHLY: 299,
    QUARTERLY: 899,
    HALF_YEARLY: 1799,
    ANNUAL: 3600,
  },
};
