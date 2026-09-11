/**
 * Revokes STUDENT_READ_ANY from the TEACHER role in the database.
 *
 * Why this script exists: prisma/seed.ts only UPSERTS RolePermission rows
 * from ROLE_PERMISSION_DEFAULTS — it adds grants that are missing, it never
 * removes one that used to be in the code defaults and no longer is. So
 * removing PERMISSIONS.STUDENT_READ_ANY from ROLE_PERMISSION_DEFAULTS.TEACHER
 * in src/lib/rbac/permissions.ts is necessary but not sufficient: the DB
 * still has the old RolePermission(TEACHER, student.read.any) row from when
 * it was seeded, and hasPermission()/getUserPermissionCodes() check that
 * table as a fallback independent of the code array. This deletes that row.
 *
 * Safe to re-run: no-ops if the row is already gone. Dry-run by default.
 *
 * Usage:
 *   npx tsx scripts/revoke-teacher-student-access.ts            # dry run
 *   npx tsx scripts/revoke-teacher-student-access.ts --confirm  # apply
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const CONFIRM = process.argv.includes("--confirm");

async function main() {
  console.log(CONFIRM ? "=== REVOKE (LIVE) ===" : "=== REVOKE (DRY RUN — pass --confirm to apply) ===");

  const role = await prisma.role.findUnique({ where: { name: "TEACHER" } });
  if (!role) throw new Error("TEACHER role not found.");

  const permission = await prisma.permission.findUnique({ where: { code: "student.read.any" } });
  if (!permission) {
    console.log("Permission 'student.read.any' not in DB — nothing to revoke.");
    return;
  }

  const existing = await prisma.rolePermission.findUnique({
    where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
  });

  if (!existing) {
    console.log("TEACHER already has no RolePermission row for student.read.any. Nothing to do.");
    return;
  }

  if (!CONFIRM) {
    console.log("WOULD delete RolePermission(TEACHER, student.read.any) — id:", existing.id);
    return;
  }

  await prisma.rolePermission.delete({ where: { id: existing.id } });
  console.log("Deleted RolePermission(TEACHER, student.read.any). Teacher accounts lose STUDENT_READ_ANY immediately (no cache to bust).");

  // Sanity check: confirm no per-teacher override re-grants it, and no other
  // still-permitted role accidentally lost anything (this script only ever
  // touches the one row above; this is just visibility).
  const overrides = await prisma.userPermissionOverride.findMany({
    where: { permissionCode: "student.read.any", granted: true },
    include: { user: { select: { email: true, role: { select: { name: true } } } } },
  });
  const teacherOverrides = overrides.filter((o) => o.user.role?.name === "TEACHER");
  if (teacherOverrides.length > 0) {
    console.warn(
      "WARNING: the following TEACHER accounts have a per-user override that STILL grants " +
        "student.read.any (overrides win over role permissions — remove these individually " +
        "in /team/roles or via UserPermissionOverride if they should also be denied):"
    );
    for (const o of teacherOverrides) console.warn(`  - ${o.user.email}`);
  } else {
    console.log("No per-teacher UserPermissionOverride grants student.read.any. Clean.");
  }
}

main()
  .catch((e) => {
    console.error("REVOKE FAILED:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
