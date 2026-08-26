import { z } from "zod";

export const billingCycleSchema = z.enum(["MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUAL"]);
export const subscriptionPlanSchema = z.enum(["BASIC", "PRO"]);

export const checkoutSchema = z.object({
  plan: subscriptionPlanSchema,
  billingCycle: billingCycleSchema,
  // One-time (non-recurring) plans only — see the Coupon model's doc
  // comment in schema.prisma for why MONTHLY doesn't support this yet.
  couponCode: z.string().trim().min(1).max(40).optional(),
});

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export const verifyTrialSchema = z.object({
  razorpay_subscription_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export const changePlanSchema = z.object({
  plan: subscriptionPlanSchema,
});
