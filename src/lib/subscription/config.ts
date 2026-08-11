import type { BillingCycle, SubscriptionPlan } from "@prisma/client";

/**
 * Subscription Plan Catalogue
 * ---------------------------
 * Every plan is APP-WIDE — a student on either plan gets every course,
 * batch, test series, doubt-solving, notes and QBank feature. Only the
 * features listed in `SUBSCRIPTION_FEATURE_KEYS` differ between plans.
 * Add a new gated feature by adding a key here + to PLAN_FEATURES below —
 * never gate access with an inline `plan === "PRO"` check in feature code.
 */
export const SUBSCRIPTION_FEATURE_KEYS = {
  MENTORSHIP_1_1: "mentorship.1_1",
  NEET_UG_ASSURE: "neet_ug_assure",
  BATCH_WHATSAPP_COMMUNITY: "batch.whatsapp_community",
  SRG_NCERT_REVISION_SERIES: "srg_ncert_revision_series",
} as const;

export type SubscriptionFeatureKey =
  (typeof SUBSCRIPTION_FEATURE_KEYS)[keyof typeof SUBSCRIPTION_FEATURE_KEYS];

/** Which features each plan unlocks, on top of the shared core access. */
export const PLAN_FEATURES: Record<SubscriptionPlan, SubscriptionFeatureKey[]> = {
  BASIC: [],
  PRO: [
    SUBSCRIPTION_FEATURE_KEYS.MENTORSHIP_1_1,
    SUBSCRIPTION_FEATURE_KEYS.NEET_UG_ASSURE,
    SUBSCRIPTION_FEATURE_KEYS.BATCH_WHATSAPP_COMMUNITY,
    SUBSCRIPTION_FEATURE_KEYS.SRG_NCERT_REVISION_SERIES,
  ],
};

/** MONTHLY renews automatically via Razorpay Subscriptions; everything else
 *  is a one-time payment for a fixed duration via Razorpay Orders. */
export const RECURRING_BILLING_CYCLES: BillingCycle[] = ["MONTHLY"];

/** Length of each fixed-duration cycle, in days — used to compute
 *  `currentPeriodEnd` for non-recurring plans. */
export const BILLING_CYCLE_DAYS: Record<BillingCycle, number> = {
  MONTHLY: 30,
  QUARTERLY: 90,
  HALF_YEARLY: 182,
  ANNUAL: 365,
};

// The Records above are exhaustive over their enum keys, so indexing is
// always safe at runtime — these helpers centralize the (harmless) `!`
// non-null assertion `noUncheckedIndexedAccess` otherwise forces at every
// call site.
export function getPlanFeatures(plan: SubscriptionPlan): SubscriptionFeatureKey[] {
  return PLAN_FEATURES[plan]!;
}

export function getCycleDays(cycle: BillingCycle): number {
  return BILLING_CYCLE_DAYS[cycle]!;
}

/** Free trial length for first-time subscribers. Change this one number to
 *  change the trial everywhere. */
export const FREE_TRIAL_DAYS = 7;

/** Short grace window after a failed recurring charge before we cut access. */
export const PAST_DUE_GRACE_DAYS = 3;
