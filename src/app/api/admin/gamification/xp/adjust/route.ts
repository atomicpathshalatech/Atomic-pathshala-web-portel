import { NextRequest } from "next/server";
import { requireGamificationAdmin } from "@/lib/gamification/admin-guard";
import { handleApiError, apiSuccess, apiError } from "@/lib/api/response";
import { manualAdjustStudentXp } from "@/lib/gamification/xp-engine";
import { z } from "zod";

export const dynamic = "force-dynamic";

const adjustSchema = z.object({
  studentId: z.string().min(1),
  amount: z.number().int().refine((val) => val !== 0, {
    message: "Adjustment amount cannot be zero (use positive for addition, negative for deduction).",
  }),
  reason: z.string().min(3).max(256),
});

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireGamificationAdmin();
    const body = await req.json();
    const parsed = adjustSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.errors.map((e) => e.message).join(", "), 400);
    }

    const { studentId, amount, reason } = parsed.data;
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined;

    const result = await manualAdjustStudentXp({
      studentId,
      adminId: user.id,
      amount,
      reason,
      ipAddress,
    });

    return apiSuccess({
      message: `Successfully adjusted XP by ${amount > 0 ? "+" : ""}${amount} XP.`,
      result,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
