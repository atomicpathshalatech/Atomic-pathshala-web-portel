import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { validateInviteToken } from "@/lib/invitations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  dob: z.string().trim().min(4), // ISO date
  qualification: z.string().trim().min(2).max(200),
  experience: z.string().trim().min(1).max(200),
  password: z.string().min(8).max(200),
});

/**
 * Public: the invitee submits their staff profile.
 *
 * - email + phone are taken from the INVITATION, never the request body.
 * - a User is created with NO role and status APPROVAL_PENDING.
 * - a Teacher profile row is created so the person is a real educator record
 *   immediately (department "Unassigned" until an admin sets it).
 * - the invitation moves to SUBMITTED and is linked to the new user.
 * Email ownership is proven by possession of the single-use link.
 */
export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const result = await validateInviteToken(params.token);
    if (!result.ok) {
      return apiError(
        result.reason === "ALREADY_USED"
          ? "This invitation has already been completed."
          : "This invitation link is expired or invalid.",
        410
      );
    }
    const inv = result.invitation;
    const input = schema.parse(await request.json());

    const dob = new Date(input.dob);
    if (Number.isNaN(dob.getTime())) return apiError("Invalid date of birth.", 422);

    const clashEmail = await prisma.user.findUnique({ where: { email: inv.email } });
    if (clashEmail && clashEmail.status === "ACTIVE") {
      return apiError("An active account already exists for this email.", 409);
    }
    if (clashEmail) {
      // A previous non-active shell for this email — don't create a duplicate.
      return apiError("This email is already registered. Please contact your administrator.", 409);
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const empCode = `EMP-${Date.now().toString().slice(-8)}`;

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: inv.email,
          phone: inv.phone,
          name: input.name,
          passwordHash,
          roleId: null,
          status: "APPROVAL_PENDING",
        },
      });

      await tx.teacher.create({
        data: {
          userId: created.id,
          employeeCode: empCode,
          department: "Unassigned",
          subjects: [],
          bio: `Qualification: ${input.qualification} · Experience: ${input.experience} · DOB: ${dob.toISOString().slice(0, 10)}`,
          // Also stored as a real date (birthday automation reads this
          // column) — bio keeps it too so nothing existing that parses bio
          // text changes.
          dob,
          onboardingStatus: "PENDING_REVIEW",
        },
      });

      await tx.staffInvitation.update({
        where: { id: inv.id },
        data: { status: "SUBMITTED", submittedAt: new Date(), createdUserId: created.id },
      });

      await tx.auditLog.create({
        data: {
          userId: created.id,
          action: "STAFF_PROFILE_SUBMITTED",
          entityType: "USER",
          entityId: created.id,
          metadata: { invitationId: inv.id, email: inv.email },
        },
      });
      await tx.auditLog.create({
        data: {
          userId: created.id,
          action: "STAFF_VERIFICATION_COMPLETED",
          entityType: "STAFF_INVITATION",
          entityId: inv.id,
          metadata: { method: "invite-link-possession", email: inv.email },
        },
      });

      return created;
    });

    return apiSuccess({ userId: user.id, status: "APPROVAL_PENDING" }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
