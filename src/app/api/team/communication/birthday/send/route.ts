import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { getBirthdaySubjectById } from "@/lib/birthday/subject-lookup";
import { sendBirthdayWish } from "@/lib/birthday/send";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  subjectType: z.enum(["STUDENT", "TEACHER"]),
  subjectId: z.string().min(1),
  force: z.boolean().optional(),
  testPhone: z.string().trim().optional(),
});

/**
 * POST /api/team/communication/birthday/send — Admin-only manual /
 * force-send / test-send (spec sections 17 & 26). A plain manual send is
 * blocked with a clear message when already sent this year; `force: true`
 * bypasses that and is itself logged as such (never silent). `testPhone`
 * sends to an arbitrary number without touching the subject's real log —
 * the "does not modify actual student birthday log" requirement.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);

    const input = schema.parse(await req.json());
    const subject = await getBirthdaySubjectById(input.subjectType, input.subjectId);
    if (!subject) return apiError("Subject not found (missing profile, or no DOB on file).", 404);

    if (!input.testPhone && !input.force) {
      const year = new Date().getFullYear();
      const existing = await prisma.birthdaySendLog.findUnique({
        where: { subjectType_subjectId_year: { subjectType: input.subjectType, subjectId: input.subjectId, year } },
      });
      if (existing && existing.status !== "SKIPPED" && existing.status !== "FAILED") {
        return apiError("Birthday message has already been sent to this student today.", 409, {
          code: "ALREADY_SENT",
        });
      }
    }

    const outcome = await sendBirthdayWish(subject, {
      triggerType: input.testPhone ? "MANUAL" : input.force ? "FORCE" : "MANUAL",
      testPhone: input.testPhone,
    });

    if (outcome.status === "FAILED") return apiError(`Send failed: ${outcome.reason}`, 502);
    if (outcome.status === "SKIPPED") return apiError(`Skipped: ${outcome.reason}`, 409);

    return apiSuccess({ outcome: outcome.status, logId: "logId" in outcome ? outcome.logId : null });
  } catch (error) {
    return handleApiError(error);
  }
}
