import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS, ROLE_PERMISSION_DEFAULTS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { newInviteToken, inviteExpiry, buildInviteUrl } from "@/lib/invitations";
import { staffInviteEmailHtml } from "@/lib/mail";
import { dispatchEmail } from "@/lib/email/dispatch";
import { generateTempPassword, sendStaffApprovalEmail } from "@/lib/email/credentials";
import { getLoginUrl } from "@/lib/email/app-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  action: z.enum(["approve", "reject", "resend"]),
  reviewNote: z.string().trim().max(500).optional(),
  // On approve: optionally assign a role now (overrides intendedRoleName).
  roleName: z.string().trim().optional().nullable(),
});

async function audit(actorId: string, action: string, entityId: string, metadata: unknown) {
  await prisma.auditLog.create({
    data: {
      userId: actorId,
      action,
      entityType: "STAFF_INVITATION",
      entityId,
      metadata: metadata as never,
    },
  });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.STAFF_INVITE);
    const actorId = session.user.id;

    const { action, reviewNote, roleName } = bodySchema.parse(await request.json());

    const invitation = await prisma.staffInvitation.findUnique({
      where: { id: params.id },
      include: { createdUser: { select: { id: true, teacher: { select: { id: true } } } } },
    });
    if (!invitation) return apiError("Invitation not found.", 404);

    // ---- RESEND ----------------------------------------------------------
    if (action === "resend") {
      if (invitation.status === "APPROVED" || invitation.status === "SUBMITTED") {
        return apiError("This invitation has already been used.", 409);
      }
      const { raw, hash } = newInviteToken();
      const updated = await prisma.staffInvitation.update({
        where: { id: invitation.id },
        data: { tokenHash: hash, expiresAt: inviteExpiry(), status: "PENDING", openedAt: null },
        include: { invitedBy: { select: { name: true } } },
      });
      const inviteUrl = buildInviteUrl(raw);
      const dispatched = await dispatchEmail({
        // A fresh key per explicit resend click (a new tokenHash/expiry was
        // just issued above) — this is a deliberate new send, not a retry
        // of the original invite, so it must not be deduped against it.
        idempotencyKey: `invitation:${invitation.id}:resend:${updated.expiresAt.getTime()}`,
        to: updated.email,
        recipientName: updated.email,
        recipientType: "STAFF",
        emailType: "INVITATION",
        subject: "Your Atomic Pathshala invitation (resent)",
        html: staffInviteEmailHtml({
          inviteUrl,
          invitedByName: updated.invitedBy.name,
          expiresAt: updated.expiresAt,
        }),
      });
      const mail = { delivered: dispatched.outcome === "sent" };
      await audit(actorId, "STAFF_INVITE_RESENT", invitation.id, {
        emailDelivered: mail.delivered,
      });
      return apiSuccess({ inviteUrl, emailDelivered: mail.delivered });
    }

    // approve / reject need a submitted profile
    if (invitation.status !== "SUBMITTED") {
      return apiError("This invitation has no submitted profile to review yet.", 409);
    }
    const targetUserId = invitation.createdUserId;
    if (!targetUserId) return apiError("Linked user record is missing.", 409);

    // ---- REJECT --------------------------------------------------------
    if (action === "reject") {
      await prisma.$transaction([
        prisma.staffInvitation.update({
          where: { id: invitation.id },
          data: {
            status: "REJECTED",
            reviewedById: actorId,
            reviewedAt: new Date(),
            reviewNote: reviewNote ?? null,
          },
        }),
        // Profile + audit are preserved; the account just can't get in.
        prisma.user.update({
          where: { id: targetUserId },
          data: { status: invitation.createdUser?.teacher ? "EX_EDUCATOR" : "EX_TEAM_MEMBER" },
        }),
      ]);
      await audit(actorId, "STAFF_REJECTED", invitation.id, { targetUserId, reviewNote: reviewNote ?? null });
      return apiSuccess({ status: "REJECTED" });
    }

    // ---- APPROVE ------------------------------------------------------
    // This is the ONLY place a newly-approved staff account gets a working
    // login — the account was created earlier at invite-registration time
    // with no usable password, so a genuine first approval must mint one
    // here. Fetched before the transaction so "genuine first approval" is
    // judged from the real current status, not assumed from the invitation
    // record (which an admin could revisit after other changes happened).
    const currentTargetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { status: true, email: true, name: true, department: true, teacher: { select: { department: true } } },
    });
    if (!currentTargetUser) return apiError("Linked user record is missing.", 409);
    const isFirstApproval = currentTargetUser.status === "APPROVAL_PENDING";
    // The invite-registration flow (POST /api/invite/[token]/register) only
    // ever sets Teacher.department, never User.department — so for an
    // educator, Teacher.department is the real assigned value and
    // User.department is always empty. Prefer it when present.
    const departmentForEmail = currentTargetUser.teacher?.department || currentTargetUser.department || "—";

    const roleToAssign = (roleName || invitation.intendedRoleName || "").trim() || null;
    if (roleToAssign && !ROLE_PERMISSION_DEFAULTS[roleToAssign]) {
      return apiError(`Unknown role "${roleToAssign}".`, 422);
    }

    let assignedRoleId: string | null = null;
    let assignedRoleLabel: string | null = null;
    if (roleToAssign) {
      const role =
        (await prisma.role.findUnique({ where: { name: roleToAssign as never } })) ??
        (await prisma.role.create({
          data: { name: roleToAssign as never, label: roleToAssign.replace(/_/g, " "), isSystem: true },
        }));
      assignedRoleId = role.id;
      assignedRoleLabel = role.label;
    }

    // Generate + hash a temp password ONLY for a genuine first approval —
    // an already-active user having their role changed later through this
    // same endpoint must never have their real password silently replaced.
    const tempPassword = isFirstApproval ? generateTempPassword() : null;
    const newPasswordHash = tempPassword ? await bcrypt.hash(tempPassword, 12) : undefined;

    await prisma.$transaction([
      prisma.staffInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "APPROVED",
          reviewedById: actorId,
          reviewedAt: new Date(),
          reviewNote: reviewNote ?? null,
        },
      }),
      prisma.user.update({
        where: { id: targetUserId },
        data: {
          // Approved => account is ACTIVE. Role is only set if one was
          // pre-authorised or chosen here; otherwise the user stays roleless
          // and lands on /access-denied until an admin assigns a role.
          status: "ACTIVE",
          ...(assignedRoleId ? { roleId: assignedRoleId } : {}),
          ...(newPasswordHash ? { passwordHash: newPasswordHash } : {}),
        },
      }),
    ]);

    await audit(actorId, "STAFF_APPROVED", invitation.id, { targetUserId, roleAssigned: roleToAssign });
    if (roleToAssign) {
      await prisma.auditLog.create({
        data: {
          userId: actorId,
          action: "ROLE_ASSIGNED",
          entityType: "USER",
          entityId: targetUserId,
          metadata: { roleName: roleToAssign, via: "staff-invitation-approval" },
        },
      });
    }

    // Credentials email — sent after the transaction has committed (never
    // before), awaited so it actually completes before this serverless
    // response is returned, but its failure must not turn a successful
    // approval into an error response. idempotencyKey deliberately matches
    // the one src/app/api/team/users/[id]/route.ts uses for the identical
    // APPROVAL_PENDING -> ACTIVE event, so whichever admin path fires first
    // is the only one that ever sends it.
    let emailDelivered = false;
    if (isFirstApproval && tempPassword) {
      try {
        const result = await sendStaffApprovalEmail({
          idempotencyKey: `registration:${targetUserId}`,
          recipientUserId: targetUserId,
          fullName: currentTargetUser.name,
          email: currentTargetUser.email,
          password: tempPassword,
          loginUrl: getLoginUrl(),
          roleLabel: assignedRoleLabel ?? roleToAssign?.replace(/_/g, " ") ?? "Team Member",
          department: departmentForEmail,
        });
        emailDelivered = result.outcome === "sent";
      } catch (err) {
        console.error("[staff_approval_email_error]", err);
      }
    }

    return apiSuccess({ status: "APPROVED", roleAssigned: roleToAssign, emailDelivered });
  } catch (error) {
    return handleApiError(error);
  }
}
