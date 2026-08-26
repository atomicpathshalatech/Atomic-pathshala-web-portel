import { z } from "zod";
import { subscriptionPlanSchema } from "./subscription";

export const couponTypeSchema = z.enum(["PERCENT", "FLAT"]);

export const couponCreateSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, "Code must be at least 3 characters")
      .max(40)
      .transform((s) => s.toUpperCase()),
    type: couponTypeSchema,
    value: z.number().positive("Value must be greater than 0"),
    plan: subscriptionPlanSchema.optional(),
    maxRedemptions: z.number().int().positive().optional(),
    expiresAt: z.coerce.date().optional(),
  })
  .refine((v) => v.type !== "PERCENT" || v.value <= 100, {
    message: "A percent coupon can't exceed 100",
    path: ["value"],
  });
export type CouponCreateInput = z.infer<typeof couponCreateSchema>;

export const couponUpdateSchema = z.object({
  isActive: z.boolean().optional(),
  maxRedemptions: z.number().int().positive().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
});
export type CouponUpdateInput = z.infer<typeof couponUpdateSchema>;

export const refundCreateSchema = z.object({
  amount: z.number().positive("Refund amount must be greater than 0"),
  reason: z.string().max(500).optional(),
});
export type RefundCreateInput = z.infer<typeof refundCreateSchema>;
