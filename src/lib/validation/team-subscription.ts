import { z } from "zod";
import { billingCycleSchema, subscriptionPlanSchema } from "@/lib/validation/subscription";

export const grantSubscriptionSchema = z.object({
  plan: subscriptionPlanSchema,
  billingCycle: billingCycleSchema,
  periodDays: z.number().int().positive().max(3650),
  amount: z.number().nonnegative(),
  note: z.string().max(500).optional(),
});

export const updatePricingSchema = z.object({
  entries: z
    .array(
      z.object({
        plan: subscriptionPlanSchema,
        billingCycle: billingCycleSchema,
        amount: z.number().nonnegative(),
      })
    )
    .min(1)
    .max(8),
});
