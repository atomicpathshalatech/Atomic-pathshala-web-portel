import { z } from "zod";

export const penaltyRuleSchema = z.object({
  name: z.string().min(3, "Rule name is required"),
  description: z.string().optional(),
  deductionType: z.enum(["FIXED_AMOUNT", "PERCENT_OF_PAYOUT"]),
  deductionValue: z.coerce.number().positive("Must be a positive number"),
  isActive: z.boolean().default(true),
});

export type PenaltyRuleInput = z.infer<typeof penaltyRuleSchema>;

/** month is stored as "YYYY-MM" so records group cleanly into a payout cycle. */
export const penaltyRecordSchema = z.object({
  teacherId: z.string().min(1),
  ruleId: z.string().min(1),
  amount: z.coerce.number().positive("Amount must be positive"),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Use YYYY-MM format"),
  note: z.string().optional(),
});

export type PenaltyRecordInput = z.infer<typeof penaltyRecordSchema>;
