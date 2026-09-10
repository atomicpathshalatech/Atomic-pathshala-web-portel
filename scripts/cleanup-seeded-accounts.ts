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
import { randomBytes } from "crypto";
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
  let neutralised = 0;
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
      // A handful of authored-artifact tables reference User with a required
      // FK (no cascade / no SetNull), so a seeded account that was ever used
      // to edit a question or kick off an AI generation batch can't be
      // deleted outright. These rows are byproducts of the seeded account
      // itself — safe to drop. Nullable authorship (Question.createdById,
      // AuditLog.userId, ...) is SetNull'd automatically by the DB.
      const code = (err as { code?: string }).code;
      if (code !== "P2003") {
        console.error(`[FAILED] ${email} — ${(err as Error).message.split("\n")[0]}.`);
        continue;
      }
      const [qv, gb] = await Promise.all([
        prisma.questionVersion.deleteMany({ where: { editedById: user.id } }),
        prisma.aiGenerationBatch.deleteMany({ where: { createdById: user.id } }),
      ]);
      try {
        await prisma.user.delete({ where: { id: user.id } });
        console.log(
          `[deleted] ${email}  (${user.role?.name}, "${user.name}") ` +
            `[+${qv.count} question_versions, +${gb.count} ai_generation_batches]`
        );
        removed++;
      } catch (err2) {
        // Still blocked: this seeded account authored other artifacts
        // (home sections, extraction jobs, staff invitations, ...) behind
        // required FKs. Rather than cascade-delete real-looking content,
        // NEUTRALISE it: unusable email, no password, no role, INACTIVE.
        // It can no longer log in, holds no privileges, and its address no
        // longer matches the seed upsert so `db:seed` won't revive it.
        const blocker = (err2 as { meta?: { field_name?: string } }).meta?.field_name ?? "unknown FK";
        const deadEmail = `disabled+${Date.now()}.${email.replace(/[@.]/g, "_")}@seed.invalid`;
        const deadHash = await bcrypt.hash(randomBytes(24).toString("hex"), 12);
        await prisma.user.update({
          where: { id: user.id },
          data: { email: deadEmail, passwordHash: deadHash, roleId: null, status: "INACTIVE" },
        });
        neutralised++;
        console.log(
          `[neutralised] ${email} — hard delete blocked by ${blocker}; ` +
            `account disabled (no login, no role), email parked as ${deadEmail}.`
        );
      }
    }
  }
  return { removed, neutralised };
}

async function main() {
  console.log(CONFIRM ? "=== CLEANUP (LIVE) ===" : "=== CLEANUP (DRY RUN — pass --confirm to apply) ===");

  const protectedEmail = await ensureSuperAdmin();
  const { removed, neutralised } = await deleteSeeded(protectedEmail);

  console.log("");
  console.log("Left for manual review (NOT touched):");
  for (const e of REVIEW_BY_HAND) console.log(`  - ${e}`);

  console.log("");
  if (CONFIRM) {
    console.log(`Done. Removed: ${removed}. Neutralised (disabled, un-deletable): ${neutralised}.`);
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
