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
import type { BillingCycle, Coupon, CouponType, Subscription, SubscriptionPlan } from "@prisma/client";

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
 * A generated, gapless-per-year receipt number — assigned once, the
 * moment a SubscriptionPayment reaches SUCCESS (never on PENDING/FAILED),
 * by every path that can flip a payment to SUCCESS: order verification,
 * the recurring-charge webhook, and a manually-granted offline payment.
 * Counts existing invoice numbers within the same calendar year, so a
 * fresh year always restarts at 000001. Not wrapped in the same
 * transaction as the count-then-assign — a theoretical race could produce
 * a duplicate number under heavy concurrent traffic, acceptable at this
 * app's current scale (same tradeoff already made for the leaderboard's
 * O(n) scoring query).
 */
async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  const count = await prisma.subscriptionPayment.count({
    where: { invoiceNumber: { not: null }, createdAt: { gte: yearStart, lt: yearEnd } },
  });
  return `INV-${year}-${String(count + 1).padStart(6, "0")}`;
}

/**
 * Validates a coupon code against a specific checkout attempt: active,
 * not expired, plan-eligible, under its redemption cap, and not already
 * used by this student. Coupons only apply to one-time (Order) checkouts
 * — see the Coupon model's doc comment in schema.prisma for why MONTHLY
 * is out of scope.
 */
export async function validateCoupon(
  code: string,
  plan: SubscriptionPlan,
  billingCycle: BillingCycle,
  studentId: string
): Promise<Coupon> {
  if (isRecurring(billingCycle)) {
    throw new SubscriptionError(
      "Coupons can only be applied to one-time plans (Quarterly, Half-Yearly, or Annual) right now."
    );
  }

  const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
  if (!coupon || !coupon.isActive) {
    throw new SubscriptionError("This coupon code isn't valid.");
  }
  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    throw new SubscriptionError("This coupon has expired.");
  }
  if (coupon.plan && coupon.plan !== plan) {
    throw new SubscriptionError(`This coupon only applies to the ${coupon.plan} plan.`);
  }
  if (coupon.maxRedemptions !== null && coupon.redeemedCount >= coupon.maxRedemptions) {
    throw new SubscriptionError("This coupon has reached its redemption limit.");
  }

  const alreadyUsed = await prisma.subscriptionPayment.findFirst({
    where: { couponId: coupon.id, status: "SUCCESS", subscription: { studentId } },
  });
  if (alreadyUsed) {
    throw new SubscriptionError("You've already used this coupon.");
  }

  return coupon;
}

/** PERCENT (0-100) or FLAT (rupees) off, never below zero. Rounded to
 *  paise (2 decimal places) since that's what actually reaches Razorpay. */
function applyCouponDiscount(baseAmount: number, coupon: { type: CouponType; value: number }): number {
  const raw =
    coupon.type === "PERCENT" ? baseAmount - (baseAmount * coupon.value) / 100 : baseAmount - coupon.value;
  return Math.max(0, Math.round(raw * 100) / 100);
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
  billingCycle: BillingCycle,
  couponCode?: string
) {
  const baseAmount = await getPlanPrice(plan, billingCycle);
  const now = new Date();

  if (isRecurring(billingCycle)) {
    if (couponCode) {
      throw new SubscriptionError(
        "Coupons can only be applied to one-time plans (Quarterly, Half-Yearly, or Annual) right now."
      );
    }

    const razorpayPlanId = await getOrCreateRazorpayPlanId(plan, billingCycle);
    const razorpaySub = await razorpay.subscriptions.create({
      plan_id: razorpayPlanId,
      customer_notify: 1,
      total_count: 120, // ~10 years of monthly cycles; Razorpay requires a cap
    });

    const subscription = await upsertSubscriptionShell(studentId, {
      plan,
      billingCycle,
      amount: baseAmount,
      razorpaySubscriptionId: razorpaySub.id,
    });

    return { type: "subscription" as const, razorpaySubscriptionId: razorpaySub.id, subscription };
  }

  let coupon: Coupon | null = null;
  let amount = baseAmount;
  if (couponCode) {
    coupon = await validateCoupon(couponCode, plan, billingCycle, studentId);
    amount = applyCouponDiscount(baseAmount, coupon);
  }

  const order = await razorpay.orders.create({
    amount: Math.round(amount * 100),
    currency: "INR",
    notes: { studentId, plan, billingCycle, ...(coupon ? { couponCode: coupon.code } : {}) },
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
      couponId: coupon?.id,
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

  const payment = await prisma.subscriptionPayment.findFirst({
    where: { subscriptionId: subscription.id, razorpayOrderId: payload.razorpay_order_id },
    orderBy: { createdAt: "desc" },
  });
  if (!payment) throw new SubscriptionError("No matching payment record for this order.");

  const now = new Date();
  const periodEnd = addDays(now, getCycleDays(subscription.billingCycle));
  const invoiceNumber = await generateInvoiceNumber();

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
    prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCESS",
        razorpayPaymentId: payload.razorpay_payment_id,
        razorpaySignature: payload.razorpay_signature,
        invoiceNumber,
      },
    }),
    ...(payment.couponId
      ? [prisma.coupon.update({ where: { id: payment.couponId }, data: { redeemedCount: { increment: 1 } } })]
      : []),
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

  const invoiceNumber = await generateInvoiceNumber();
  await prisma.subscriptionPayment.create({
    data: {
      subscriptionId: subscription.id,
      amount,
      status: "SUCCESS",
      razorpayPaymentId: payload?.payment?.entity?.id,
      periodStart: now,
      periodEnd,
      invoiceNumber,
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

  const invoiceNumber = await generateInvoiceNumber();
  await prisma.subscriptionPayment.create({
    data: {
      subscriptionId: subscription.id,
      amount: params.amount,
      status: "SUCCESS",
      method: "OFFLINE",
      failureReason: params.note ? `Note: ${params.note}` : undefined,
      periodStart: now,
      periodEnd,
      invoiceNumber,
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

/**
 * Refunds a SUCCESS payment. A real Razorpay-gateway payment (method
 * RAZORPAY, with a razorpayPaymentId) gets an actual refund through
 * Razorpay's API; anything else (OFFLINE cash/UPI payments) has no
 * gateway counterpart, so this just records a manual refund — same
 * "was this really paid through the gateway or by hand" distinction
 * grantSubscriptionManually() draws on the payment side.
 *
 * Does NOT revoke the subscription itself — Finance may refund a payment
 * for reasons unrelated to access (a duplicate charge, a goodwill partial
 * refund). Call revokeSubscription() separately if access should also be
 * cut.
 */
export async function createRefund(
  paymentId: string,
  amount: number,
  reason: string | undefined,
  processedById: string
) {
  const payment = await prisma.subscriptionPayment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new SubscriptionError("Payment not found.");
  if (payment.status !== "SUCCESS") {
    throw new SubscriptionError("Only a successful payment can be refunded.");
  }
  if (amount > payment.amount) {
    throw new SubscriptionError("Refund amount can't exceed the original payment amount.");
  }

  if (payment.method === "RAZORPAY" && payment.razorpayPaymentId) {
    try {
      const razorpayRefund = await razorpay.payments.refund(payment.razorpayPaymentId, {
        amount: Math.round(amount * 100),
        notes: reason ? { reason } : undefined,
      });
      return prisma.refund.create({
        data: {
          subscriptionPaymentId: payment.id,
          amount,
          reason,
          status: "SUCCESS",
          razorpayRefundId: razorpayRefund.id,
          processedById,
        },
      });
    } catch (err) {
      await prisma.refund.create({
        data: {
          subscriptionPaymentId: payment.id,
          amount,
          reason,
          status: "FAILED",
          processedById,
        },
      });
      throw new SubscriptionError(
        err instanceof Error ? `Razorpay refund failed: ${err.message}` : "Razorpay refund failed."
      );
    }
  }

  // OFFLINE payment, or a RAZORPAY-method row with no captured payment id
  // (shouldn't normally happen, but fail safe by recording a manual
  // refund rather than crashing) — either way, no gateway call to make.
  return prisma.refund.create({
    data: {
      subscriptionPaymentId: payment.id,
      amount,
      reason,
      status: "SUCCESS",
      processedById,
    },
  });
}
