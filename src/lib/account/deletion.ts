import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";

/**
 * Account deletion (required by Google Play for apps with sign-up).
 *
 *  1. The student asks for it (app → Settings, or /delete-account on the
 *     website). The account is switched off at once: no more sign-in, every
 *     device signed out.
 *  2. A super admin erases the personal data on Team → Account Deletions
 *     (promised within 30 days). Rows are anonymised rather than removed:
 *     payment records must be kept for accounting/tax law, and test results
 *     stay in rank lists without a name.
 */
export const DELETION_REQUESTED = "ACCOUNT_DELETION_REQUESTED";
export const DELETION_COMPLETED = "ACCOUNT_DELETION_COMPLETED";
export const DELETION_CANCELLED = "ACCOUNT_DELETION_CANCELLED";

/** Roles that may delete their own account; staff accounts are closed by an admin. */
export const SELF_DELETE_ROLES = new Set(["STUDENT", "PARENT", "GUEST"]);

export async function requestAccountDeletion(userId: string, reason: string | null) {
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { status: "INACTIVE" } }),
    prisma.deviceSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: "Account deletion requested" },
    }),
    prisma.auditLog.create({
      data: { userId, action: DELETION_REQUESTED, entityType: "User", entityId: userId, metadata: { reason } },
    }),
  ]);
}

/** Pending requests: asked for, not yet erased or cancelled. */
export async function listPendingDeletions() {
  const logs = await prisma.auditLog.findMany({
    where: { entityType: "User", action: { in: [DELETION_REQUESTED, DELETION_COMPLETED, DELETION_CANCELLED] } },
    orderBy: { createdAt: "asc" },
    select: { entityId: true, action: true, createdAt: true, metadata: true },
  });
  const latest = new Map<string, (typeof logs)[number]>();
  for (const l of logs) if (l.entityId) latest.set(l.entityId, l);
  const pending = [...latest.values()].filter((l) => l.action === DELETION_REQUESTED);
  if (!pending.length) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: pending.map((p) => p.entityId!) } },
    select: { id: true, name: true, email: true, phone: true, status: true, student: { select: { studentIdCode: true } } },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return pending
    .filter((p) => byId.has(p.entityId!))
    .map((p) => {
      const u = byId.get(p.entityId!)!;
      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        studentIdCode: u.student?.studentIdCode ?? null,
        requestedAt: p.createdAt.toISOString(),
        reason: ((p.metadata as { reason?: string } | null)?.reason ?? null) || null,
      };
    });
}

/** Erase the personal data of an account whose deletion was requested. Irreversible. */
export async function eraseAccount(userId: string, adminId: string) {
  const placeholder = `deleted-${userId}@deleted.invalid`;
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        name: "Deleted user",
        email: placeholder,
        phone: null,
        photoUrl: null,
        emailVerified: null,
        // Random, never a valid bcrypt hash: nobody can sign in with it.
        passwordHash: `deleted:${crypto.randomBytes(32).toString("hex")}`,
        securityQuestion: null,
        securityAnswerHash: null,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
        status: "INACTIVE",
      },
    });
    await tx.student.updateMany({
      where: { userId },
      data: {
        fatherName: "-",
        motherName: "-",
        dob: new Date(2000, 0, 1),
        school: "-",
        city: "-",
        state: "-",
        address: null,
        bloodGroup: null,
        emergencyContact: null,
        qrCodeUrl: null,
      },
    });
    await tx.deviceSession.deleteMany({ where: { userId } });
    await tx.auditLog.create({
      data: { userId: adminId, action: DELETION_COMPLETED, entityType: "User", entityId: userId },
    });
  });
}

/** The student changed their mind (asked support): switch the account back on. */
export async function cancelAccountDeletion(userId: string, adminId: string) {
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { status: "ACTIVE" } }),
    prisma.auditLog.create({ data: { userId: adminId, action: DELETION_CANCELLED, entityType: "User", entityId: userId } }),
  ]);
}
