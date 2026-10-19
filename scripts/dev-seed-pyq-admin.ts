/**
 * LOCAL DEV ONLY: adds a Super Admin to the disposable local test database
 * so the PYQ Library screens can be checked in a browser after
 * scripts/test-pyq-db.ts has filled it with imports, library questions and
 * a module. Does NOT reset the database.
 *
 *   TEST_DATABASE_URL="postgresql://postgres@localhost:5433/atomic_test" \
 *     npx tsx --conditions=react-server scripts/dev-seed-pyq-admin.ts
 *   node scripts/dev-local-db.mjs        # then sign in at http://localhost:3217
 *
 * Same safety guard as the DB tests (localhost "test" DB only). The
 * generated password is written to .env.dev-accounts (gitignored), never printed.
 */
import { randomBytes } from "node:crypto";
import { appendFileSync } from "node:fs";
import { requireTestDatabase } from "./lib/test-db";

requireTestDatabase();

async function run() {
  const bcrypt = (await import("bcryptjs")).default;
  const { prisma } = await import("../src/lib/db");
  const email = "pyq.admin@atomic.test";
  const password = randomBytes(9).toString("base64url");
  const role =
    (await prisma.role.findFirst({ where: { name: "SUPER_ADMIN" } })) ??
    (await prisma.role.create({ data: { name: "SUPER_ADMIN", label: "Super Admin" } }));
  await prisma.user.upsert({
    where: { email },
    create: { email, name: "PYQ Admin", passwordHash: await bcrypt.hash(password, 10), status: "ACTIVE", roleId: role.id },
    update: { passwordHash: await bcrypt.hash(password, 10), status: "ACTIVE", roleId: role.id },
  });
  appendFileSync(".env.dev-accounts", `PYQ_ADMIN_EMAIL=${email}\nPYQ_ADMIN_PASSWORD=${password}\n`);
  console.log(`Seeded ${email} (Super Admin). Password written to .env.dev-accounts.`);
  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
