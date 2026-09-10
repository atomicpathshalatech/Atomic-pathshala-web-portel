/**
 * One-shot production cleanup:
 *   1. Create (or repair) the single permanent Super Admin from env vars.
 *   2. Delete the confirmed seeded / demo / throw-away accounts, by EXACT email.
 *
 * It never touches anything outside the hard-coded SEEDED_EMAILS list, never
 * deletes the account named by SUPER_ADMIN_EMAIL, and never prints the
 * password. Ambiguous accounts (real public email domains, real phone
 * numbers) are listed for you to judge by hand — this script will not remove
 * them.
 *
 * Usage:
 *   # dry run — shows exactly what WOULD happen, changes nothing
 *   SUPER_ADMIN_EMAIL=you@company.com SUPER_ADMIN_PASSWORD='...' \
 *     npx tsx scripts/cleanup-seeded-accounts.ts
 *
 *   # for real
 *   SUPER_ADMIN_EMAIL=you@company.com SUPER_ADMIN_PASSWORD='...' \
 *     npx tsx scripts/cleanup-seeded-accounts.ts --confirm
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const CONFIRM = process.argv.includes("--confirm");

/**
 * High-confidence seeded / demo accounts. Every one of these is created by a
 * committed seed script or was an obvious internal demo row:
 *   - *.test@atomicpathshala.local   -> prisma/seed.ts
 *   - *@atomicpathshala.com (Atomic Admin / Test Teacher / Test Student)
 *                                    -> prisma/test-accounts.ts
 *   - *@atp.test (Demo Student, Ananya Sharma, Rahul Verma, Priya Singh,
 *                 Rakesh Sharma)     -> ad-hoc demo data, non-routable TLD
 */
const SEEDED_EMAILS = [
  "admin.test@atomicpathshala.local",
  "teacher.test@atomicpathshala.local",
  "student.test@atomicpathshala.local",
  "admin@atomicpathshala.com",
  "teacher@atomicpathshala.com",
  "student@atomicpathshala.com",
  "student@atp.test",
  "ananya@atp.test",
  "rahul@atp.test",
  "priya@atp.test",
  "physics.teacher@atp.test",
];

/**
 * NOT deleted by this script. Junk-looking, but on real public domains — could
 * be your own manual testing. Decide by hand from the Team portal.
 */
const REVIEW_BY_HAND = [
  "abc@gmail.com",
  "xyz@gmail.com",
  "firoz@gmail.com",
  "hr@test.com",
  "ali659941@gmail.com",
];

async function ensureSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME?.trim() || "Super Admin";

  if (!email || !password) {
    throw new Error(
      "SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must both be set. Aborting " +
        "before any deletion so you are never left without an admin login."
    );
  }
  if (password.length < 12) {
    throw new Error("SUPER_ADMIN_PASSWORD must be at least 12 characters.");
  }

  const role = await prisma.role.findUnique({ where: { name: "SUPER_ADMIN" } });
  if (!role) {
    throw new Error("SUPER_ADMIN role is not seeded. Run `npm run db:seed` first.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  const passwordHash = await bcrypt.hash(password, 12);

  if (existing) {
    if (CONFIRM) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, roleId: role.id, status: "ACTIVE", name },
      });
    }
    console.log(
      `[super-admin] ${email} already exists -> ${
        CONFIRM ? "role/password/status repaired" : "WOULD repair role/password/status"
      }`
    );
  } else {
    if (CONFIRM) {
      await prisma.user.create({
        data: { email, passwordHash, name, status: "ACTIVE", roleId: role.id },
      });
    }
    console.log(
      `[super-admin] ${email} -> ${CONFIRM ? "CREATED" : "WOULD be created"} (SUPER_ADMIN, ACTIVE)`
    );
  }
  return email;
}

async function deleteSeeded(protectedEmail: string) {
  let removed = 0;
  for (const email of SEEDED_EMAILS) {
    if (email.toLowerCase() === protectedEmail) {
      console.log(`[skip] ${email} — this is your permanent Super Admin, keeping it.`);
      continue;
    }
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, role: { select: { name: true } } },
    });
    if (!user) {
      console.log(`[gone] ${email} — not in DB, nothing to do.`);
      continue;
    }
    if (!CONFIRM) {
      console.log(`[dry-run] WOULD delete ${email}  (${user.role?.name}, "${user.name}")`);
      continue;
    }
    try {
      await prisma.user.delete({ where: { id: user.id } });
      console.log(`[deleted] ${email}  (${user.role?.name}, "${user.name}")`);
      removed++;
    } catch (err) {
      console.error(
        `[FAILED] ${email} — ${(err as Error).message.split("\n")[0]}. ` +
          `Left in place; remove its dependent rows first or delete from the Team portal.`
      );
    }
  }
  return removed;
}

async function main() {
  console.log(CONFIRM ? "=== CLEANUP (LIVE) ===" : "=== CLEANUP (DRY RUN — pass --confirm to apply) ===");

  const protectedEmail = await ensureSuperAdmin();
  const removed = await deleteSeeded(protectedEmail);

  console.log("");
  console.log("Left for manual review (NOT touched):");
  for (const e of REVIEW_BY_HAND) console.log(`  - ${e}`);

  console.log("");
  if (CONFIRM) {
    console.log(`Done. Seeded accounts removed: ${removed}.`);
  } else {
    console.log("Dry run only. Re-run with --confirm to apply.");
  }
}

main()
  .catch((e) => {
    console.error("CLEANUP FAILED:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
