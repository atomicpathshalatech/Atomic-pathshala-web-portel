import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { ROLE_PERMISSION_DEFAULTS } from "@/lib/rbac/permissions";
import { newInviteToken, inviteExpiry, buildInviteUrl } from "@/lib/invitations";
import { sendMail, staffInviteEmailHtml } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  phone: z.string().trim().min(6).max(20),
  intendedRoleName: z.string().trim().optional().nullable(),
});

/** GET /api/team/invitations — every invitation, newest first. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.STAFF_INVITE);

    const invitations = await prisma.staffInvitation.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        invitedBy: { select: { name: true } },
        createdUser: {
          select: {
            id: true,
            name: true,
            status: true,
            role: { select: { name: true } },
            teacher: { select: { department: true, subjects: true, bio: true } },
          },
        },
      },
    });
    return apiSuccess({ invitations });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/team/invitations — create + (attempt to) email an invitation. */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.STAFF_INVITE);

    const input = createSchema.parse(await request.json());

    // Don't invite someone who already has a working account.
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing && existing.status === "ACTIVE") {
      return apiError("A user with that email already has an active account.", 409);
    }

    if (input.intendedRoleName && !ROLE_PERMISSION_DEFAULTS[input.intendedRoleName]) {
      return apiError(`Unknown role "${input.intendedRoleName}".`, 422);
    }

    // Supersede any still-open invitation for the same email.
    await prisma.staffInvitation.updateMany({
      where: { email: input.email, status: { in: ["PENDING", "OPENED"] } },
      data: { status: "EXPIRED" },
    });

    const { raw, hash } = newInviteToken();
    const invitation = await prisma.staffInvitation.create({
      data: {
        email: input.email,
        phone: input.phone,
        tokenHash: hash,
        intendedRoleName: input.intendedRoleName || null,
        invitedById: session.user.id,
        expiresAt: inviteExpiry(),
      },
      include: { invitedBy: { select: { name: true } } },
    });

    const inviteUrl = buildInviteUrl(raw);
    const mail = await sendMail({
      to: input.email,
      subject: "You're invited to join Atomic Pathshala",
      html: staffInviteEmailHtml({
        inviteUrl,
        invitedByName: invitation.invitedBy.name,
        expiresAt: invitation.expiresAt,
      }),
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "STAFF_INVITED",
        entityType: "STAFF_INVITATION",
        entityId: invitation.id,
        metadata: {
          email: input.email,
          phone: input.phone,
          intendedRoleName: input.intendedRoleName || null,
          emailDelivered: mail.delivered,
        },
      },
    });

    if (mail.delivered) {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "STAFF_INVITE_SENT",
          entityType: "STAFF_INVITATION",
          entityId: invitation.id,
          metadata: { channel: "email", to: input.email },
        },
      });
    }

    // The raw token is returned exactly once so the admin can copy the link
    // (essential when email delivery isn't configured).
    return apiSuccess(
      {
        invitation: { id: invitation.id, email: invitation.email, expiresAt: invitation.expiresAt },
        inviteUrl,
        emailDelivered: mail.delivered,
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
