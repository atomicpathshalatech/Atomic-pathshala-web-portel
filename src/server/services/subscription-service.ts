import "server-only";
import { prisma } from "@/lib/db";
import {
  razorpay,
  verifyOrderPaymentSignature,
  verifySubscriptionPaymentSignature,
} from "@/lib/payments/razorpay";
import {
  FREE_TRIAL_DAYS,
  getCycleDays,
  RECURRING_BILLING_CYCLES,
} from "@/lib/subscription/config";
import { getPlanPrice } from "@/lib/subscription/pricing";
import type { BillingCycle, Subscription, SubscriptionPlan } from "@prisma/client";

export class SubscriptionError extends Error {}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isRecurring(cycle: BillingCycle): boolean {
  return RECURRING_BILLING_CYCLES.includes(cycle);
}

/**
 * Step 1 of the card-upfront trial flow: creates a Razorpay Subscription
 * whose first charge is delayed to the end of the trial window
 * (`start_at`). The Checkout widget still runs its normal
 * card-authorization step immediately, so the student's payment method is
 * captured now — nothing is billed until the trial ends.
 *
 * Deliberately does NOT write to our DB yet — that only happens in
 * `confirmTrialCheckout` once Razorpay confirms the card was actually
 * verified. If we persisted a TRIAL row here, a student who opens
 * checkout and closes the modal without completing it would get free
 * access with no payment method on file at all.
 */
export async function startTrialCheckout(studentId: string, plan: SubscriptionPlan) {
  const existing = await prisma.subscription.findUnique({ where: { studentId } });
  if (existing) {
    throw new SubscriptionError("A subscription already exists for this student.");
  }

  const now = new Date();
  const trialEndsAt = addDays(now, FREE_TRIAL_DAYS);
  const amount = await getPlanPrice(plan, "MONTHLY");
  const razorpayPlanId = await getOrCreateRazorpayPlanId(plan, "MONTHLY");

  const razorpaySub = await razorpay.subscriptions.create({
    plan_id: razorpayPlanId,
    customer_notify: 1,
    total_count: 120,
    start_at: Math.floor(trialEndsAt.getTime() / 1000),
    notes: {
      studentId,
      plan,
      trialEndsAt: trialEndsAt.toISOString(),
      amount: String(amount),
    },
  });

  return { razorpaySubscriptionId: razorpaySub.id, trialEndsAt, amount };
}

/**
 * Step 2: called after the Checkout widget's success callback. Verifies
 * the signature, re-fetches the subscription from Razorpay (never trusts
 * plan/amount from the client), and only NOW creates the Subscription row
 * with an entitled (future) `currentPeriodEnd`.
 */
export async function confirmTrialCheckout(
  studentId: string,
  payload: { razorpay_subscription_id: string; razorpay_payment_id: string; razorpay_signature: string }
) {
  const valid = verifySubscriptionPaymentSignature({
    subscriptionId: payload.razorpay_subscription_id,
    paymentId: payload.razorpay_payment_id,
    signature: payload.razorpay_signature,
  });
  if (!valid) throw new SubscriptionError("Payment signature verification failed.");

  const razorpaySub = await razorpay.subscriptions.fetch(payload.razorpay_subscription_id);
  const notes = (razorpaySub.notes ?? {}) as Record<string, string>;

  if (notes.studentId !== studentId) {
    throw new SubscriptionError("This checkout does not belong to this student.");
  }
  if (!notes.plan || !notes.trialEndsAt || !notes.amount) {
    throw new SubscriptionError("Malformed subscription — missing plan details.");
  }

  const plan = notes.plan as SubscriptionPlan;
  const trialEndsAt = new Date(notes.trialEndsAt);
  const amount = Number(notes.amount);
  const now = new Date();

  return prisma.subscription.upsert({
    where: { studentId },
    create: {
      studentId,
      plan,
      billingCycle: "MONTHLY",
      status: "TRIAL",
      trialEndsAt,
      currentPeriodStart: now,
      currentPeriodEnd: trialEndsAt,
      amount,
      razorpaySubscriptionId: payload.razorpay_subscription_id,
    },
    // Idempotent in case the confirm call is retried after already succeeding.
    update: {
      status: "TRIAL",
      trialEndsAt,
      currentPeriodEnd: trialEndsAt,
      razorpaySubscriptionId: payload.razorpay_subscription_id,
    },
  });
}

/**
 * Razorpay Subscriptions require a `plan_id` pre-registered on their side.
 * We create it on first use per (plan, cycle) and cache it in-memory for
 * the life of the process. For production, persist the returned plan_id
 * (e.g. in an env var or a tiny config table) instead of recreating it —
 * this is just enough to keep the checkout endpoint self-contained.
 */
const razorpayPlanIdCache = new Map<string, string>();

async function getOrCreateRazorpayPlanId(plan: SubscriptionPlan, cycle: BillingCycle) {
  const cacheKey = `${plan}:${cycle}`;
  const cached = razorpayPlanIdCache.get(cacheKey);
  if (cached) return cached;

  const amount = await getPlanPrice(plan, cycle);
  const created = await razorpay.plans.create({
    period: "monthly",
    interval: 1,
    item: {
      name: `Atomic Pathshala — ${plan} (${cycle})`,
      amount: Math.round(amount * 100), // paise
      currency: "INR",
    },
  });

  razorpayPlanIdCache.set(cacheKey, created.id);
  return created.id;
}

/**
 * Creates the Razorpay object the client-side Checkout widget needs:
 * a Subscription (recurring, MONTHLY) or an Order (one-time, fixed
 * duration). Also writes a PENDING Subscription + SubscriptionPayment row
 * so the webhook / verify step has something to update.
 */
export async function createCheckout(
  studentId: string,
  plan: SubscriptionPlan,
  billingCycle: BillingCycle
) {
  const amount = await getPlanPrice(plan, billingCycle);
  const now = new Date();

  if (isRecurring(billingCycle)) {
    const razorpayPlanId = await getOrCreateRazorpayPlanId(plan, billingCycle);
    const razorpaySub = await razorpay.subscriptions.create({
      plan_id: razorpayPlanId,
      customer_notify: 1,
      total_count: 120, // ~10 years of monthly cycles; Razorpay requires a cap
    });

    const subscription = await upsertSubscriptionShell(studentId, {
      plan,
      billingCycle,
      amount,
      razorpaySubscriptionId: razorpaySub.id,
    });

    return { type: "subscription" as const, razorpaySubscriptionId: razorpaySub.id, subscription };
  }

  const order = await razorpay.orders.create({
    amount: Math.round(amount * 100),
    currency: "INR",
    notes: { studentId, plan, billingCycle },
  });

  const subscription = await upsertSubscriptionShell(studentId, {
    plan,
    billingCycle,
    amount,
    razorpayOrderId: order.id,
  });

  await prisma.subscriptionPayment.create({
    data: {
      subscriptionId: subscription.id,
      amount,
      status: "PENDING",
      razorpayOrderId: order.id,
      periodStart: now,
      periodEnd: addDays(now, getCycleDays(billingCycle)),
    },
  });

  return { type: "order" as const, razorpayOrderId: order.id, amount, subscription };
}

/** Creates the Subscription row on first checkout, or updates it in place
 *  for a returning student (re-subscribing after expiry, or renewing). */
async function upsertSubscriptionShell(
  studentId: string,
  data: {
    plan: SubscriptionPlan;
    billingCycle: BillingCycle;
    amount: number;
    razorpaySubscriptionId?: string;
    razorpayOrderId?: string;
  }
): Promise<Subscription> {
  const now = new Date();
  return prisma.subscription.upsert({
    where: { studentId },
    create: {
      studentId,
      plan: data.plan,
      billingCycle: data.billingCycle,
      status: "TRIAL", // flips to ACTIVE once payment actually confirms
      amount: data.amount,
      currentPeriodStart: now,
      currentPeriodEnd: now, // not entitled until confirm flips status
      razorpaySubscriptionId: data.razorpaySubscriptionId,
      razorpayOrderId: data.razorpayOrderId,
    },
    update: {
      razorpaySubscriptionId: data.razorpaySubscriptionId,
      razorpayOrderId: data.razorpayOrderId,
      amount: data.amount,
    },
  });
}

/**
 * Confirms a one-time (fixed-duration) Order payment after the client-side
 * Razorpay Checkout success callback. Recurring MONTHLY confirmation
 * instead comes via the `subscription.charged` webhook — see
 * `handleWebhookEvent` below — since Razorpay charges those on its own.
 */
export async function verifyAndActivateOrderPayment(
  studentId: string,
  payload: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
) {
  const valid = verifyOrderPaymentSignature({
    orderId: payload.razorpay_order_id,
    paymentId: payload.razorpay_payment_id,
    signature: payload.razorpay_signature,
  });
  if (!valid) throw new SubscriptionError("Payment signature verification failed.");

  const subscription = await prisma.subscription.findUnique({ where: { studentId } });
  if (!subscription || subscription.razorpayOrderId !== payload.razorpay_order_id) {
    throw new SubscriptionError("No matching order for this student.");
  }

  const now = new Date();
  const periodEnd = addDays(now, getCycleDays(subscription.billingCycle));

  const [updatedSub] = await prisma.$transaction([
    prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      },
    }),
    prisma.subscriptionPayment.updateMany({
      where: { subscriptionId: subscription.id, razorpayOrderId: payload.razorpay_order_id },
      data: {
        status: "SUCCESS",
        razorpayPaymentId: payload.razorpay_payment_id,
        razorpaySignature: payload.razorpay_signature,
      },
    }),
  ]);

  return updatedSub;
}

/** Stages a plan change to take effect at the START of the next billing
 *  period (per product decision — no proration). */
export async function schedulePlanChange(studentId: string, newPlan: SubscriptionPlan) {
  const subscription = await prisma.subscription.findUnique({ where: { studentId } });
  if (!subscription) throw new SubscriptionError("No subscription found.");
  if (subscription.plan === newPlan) {
    throw new SubscriptionError("Already on this plan.");
  }

  return prisma.subscription.update({
    where: { id: subscription.id },
    data: { pendingPlan: newPlan },
  });
}

/** Cancels at period end — access is NOT cut immediately. */
export async function cancelSubscription(studentId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { studentId } });
  if (!subscription) throw new SubscriptionError("No subscription found.");

  if (subscription.razorpaySubscriptionId) {
    await razorpay.subscriptions.cancel(subscription.razorpaySubscriptionId, true);
  }

  return prisma.subscription.update({
    where: { id: subscription.id },
    data: { cancelAtPeriodEnd: true, status: "CANCELLED" },
  });
}

/**
 * Razorpay webhook dispatcher — call after signature verification
 * (`verifyWebhookSignature`) in the route handler.
 */
export async function handleWebhookEvent(event: string, payload: any) {
  switch (event) {
    case "subscription.charged":
      return onSubscriptionCharged(payload);
    case "subscription.cancelled":
      return onSubscriptionCancelled(payload);
    case "payment.failed":
      return onPaymentFailed(payload);
    default:
      return null; // ignore events we don't act on
  }
}

async function onSubscriptionCharged(payload: any) {
  const razorpaySubscriptionId = payload?.subscription?.entity?.id;
  if (!razorpaySubscriptionId) return null;

  const subscription = await prisma.subscription.findUnique({
    where: { razorpaySubscriptionId },
  });
  if (!subscription) return null;

  const now = new Date();
  // Apply a staged upgrade/downgrade exactly at the new-cycle boundary.
  const plan = subscription.pendingPlan ?? subscription.plan;
  const amount = await getPlanPrice(plan, subscription.billingCycle);
  const periodEnd = addDays(now, getCycleDays(subscription.billingCycle));

  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      plan,
      pendingPlan: null,
      amount,
      status: "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  });

  await prisma.subscriptionPayment.create({
    data: {
      subscriptionId: subscription.id,
      amount,
      status: "SUCCESS",
      razorpayPaymentId: payload?.payment?.entity?.id,
      periodStart: now,
      periodEnd,
    },
  });

  return updated;
}

async function onSubscriptionCancelled(payload: any) {
  const razorpaySubscriptionId = payload?.subscription?.entity?.id;
  if (!razorpaySubscriptionId) return null;

  return prisma.subscription.updateMany({
    where: { razorpaySubscriptionId },
    data: { status: "CANCELLED", cancelAtPeriodEnd: true },
  });
}

async function onPaymentFailed(payload: any) {
  const razorpaySubscriptionId = payload?.payment?.entity?.subscription_id;
  if (!razorpaySubscriptionId) return null;

  return prisma.subscription.updateMany({
    where: { razorpaySubscriptionId },
    data: { status: "PAST_DUE" },
  });
}

/**
 * Manually grants/extends a subscription outside Razorpay — for offline/
 * cash/UPI payments a Finance team member records by hand. Records a
 * SubscriptionPayment with method "OFFLINE" so it's distinguishable from
 * gateway-confirmed payments in reporting.
 */
export async function grantSubscriptionManually(params: {
  studentId: string;
  plan: SubscriptionPlan;
  billingCycle: BillingCycle;
  periodDays: number;
  amount: number;
  note?: string;
}) {
  const now = new Date();
  const periodEnd = addDays(now, params.periodDays);

  const subscription = await prisma.subscription.upsert({
    where: { studentId: params.studentId },
    create: {
      studentId: params.studentId,
      plan: params.plan,
      billingCycle: params.billingCycle,
      status: "ACTIVE",
      amount: params.amount,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
    update: {
      plan: params.plan,
      billingCycle: params.billingCycle,
      status: "ACTIVE",
      amount: params.amount,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      pendingPlan: null,
    },
  });

  await prisma.subscriptionPayment.create({
    data: {
      subscriptionId: subscription.id,
      amount: params.amount,
      status: "SUCCESS",
      method: "OFFLINE",
      failureReason: params.note ? `Note: ${params.note}` : undefined,
      periodStart: now,
      periodEnd,
    },
  });

  return subscription;
}

/** Immediately cuts access — for refunds, disputes, or correcting a
 *  mistaken manual grant. Distinct from cancelSubscription(), which lets
 *  a student-initiated cancellation run out its already-paid period. */
export async function revokeSubscription(studentId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { studentId } });
  if (!subscription) throw new SubscriptionError("No subscription found.");

  return prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: "EXPIRED", cancelAtPeriodEnd: true },
  });
}
