import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { getOrCreateIdCard, newPublicToken } from "@/lib/id-card/data";
import { allocateEmployeeCode, canManageCards } from "@/lib/id-card/admin";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("revoke"), kind: z.enum(["STUDENT", "TEAM"]), reason: z.string().trim().min(3).max(300) }),
  z.object({ action: z.literal("reinstate"), kind: z.enum(["STUDENT", "TEAM"]) }),
  z.object({ action: z.literal("reissue"), kind: z.enum(["STUDENT", "TEAM"]) }),
  z.object({ action: z.literal("assignEmployeeId"), kind: z.literal("TEAM") }),
  z.object({
    action: z.literal("setDetails"),
    kind: z.literal("TEAM"),
    joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    designation: z.string().trim().max(120).nullable().optional(),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  }),
]);

/** "2025-04-01" → that day at 00:00 IST (stored as UTC). */
function istDay(v: string): Date {
  return new Date(`${v}T00:00:00+05:30`);
}

/**
 * POST /api/team/id-cards/:userId — admin card actions.
 *   revoke            the card stops verifying (QR page shows "revoked"), downloads stop
 *   reinstate         undo a revoke
 *   reissue           new QR token: every printed copy of the old card stops verifying
 *   assignEmployeeId  staff without a Teacher record get an EMP-######## for their card
 */
export async function POST(request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Please log in.", 401);
    const input = schema.parse(await request.json());
    if (!(await canManageCards(session.user.id, input.kind))) return apiError("You do not have permission to manage these ID cards.", 403);

    const owner = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { id: true, student: { select: { id: true } }, teacher: { select: { employeeCode: true } } },
    });
    if (!owner) return apiError("Person not found.", 404);
    if (input.kind === "STUDENT" && !owner.student) return apiError("This person has no student profile.", 400);

    // Card details HR fills in: joining date (Member Since), designation, date of birth.
    if (input.action === "setDetails") {
      const userData: { contractStart?: Date | null; position?: string | null } = {};
      if (input.joiningDate !== undefined) userData.contractStart = input.joiningDate ? istDay(input.joiningDate) : null;
      if (input.designation !== undefined) userData.position = input.designation || null;
      if (input.dob !== undefined && !owner.teacher) return apiError("Date of birth is kept on the teacher profile; this person has none.", 400);
      await prisma.$transaction([
        prisma.user.update({ where: { id: owner.id }, data: userData }),
        ...(input.dob !== undefined && owner.teacher
          ? [prisma.teacher.update({ where: { userId: owner.id }, data: { dob: input.dob ? istDay(input.dob) : null } })]
          : []),
        prisma.auditLog.create({
          data: {
            userId: session.user.id,
            action: "ID_CARD_DETAILS_UPDATED",
            entityType: "User",
            entityId: owner.id,
            metadata: { joiningDate: input.joiningDate, designation: input.designation, dob: input.dob === undefined ? undefined : input.dob ? "set" : "cleared" },
          },
        }),
      ]);
      return apiSuccess({ ok: true });
    }

    const card = await getOrCreateIdCard(owner.id, input.kind);
    if (!card) return apiError("ID cards are not set up yet — the database migration has not been applied.", 503);

    let data: Parameters<typeof prisma.idCard.update>[0]["data"];
    let meta: Record<string, unknown> = { kind: input.kind };
    switch (input.action) {
      case "revoke":
        data = { status: "REVOKED", revokedAt: new Date(), revokedById: session.user.id, revokeReason: input.reason };
        meta = { ...meta, reason: input.reason };
        break;
      case "reinstate":
        data = { status: "ACTIVE", revokedAt: null, revokedById: null, revokeReason: null };
        break;
      case "reissue":
        data = { publicToken: newPublicToken(), reissuedAt: new Date(), status: "ACTIVE", revokedAt: null, revokedById: null, revokeReason: null };
        break;
      case "assignEmployeeId": {
        if (owner.teacher?.employeeCode || card.employeeCode) return apiError("This team member already has an employee ID.", 409);
        const code = await allocateEmployeeCode();
        data = { employeeCode: code };
        meta = { ...meta, employeeCode: code };
        break;
      }
    }

    const updated = await prisma.idCard.update({ where: { id: card.id }, data, select: { status: true, employeeCode: true, reissuedAt: true } });
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: `ID_CARD_${input.action.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`,
        entityType: "IdCard",
        entityId: card.id,
        metadata: { ...meta, ownerUserId: owner.id } as object,
      },
    });
    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
