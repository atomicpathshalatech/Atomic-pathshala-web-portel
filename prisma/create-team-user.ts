import { PrismaClient, GlobalRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Override any of these with environment variables before running, e.g.:
//   $env:SEED_ROLE="QUESTION_TEAM"; npm run create-team-user
const EMAIL = process.env.SEED_EMAIL ?? "teacher@test.com";
const NAME = process.env.SEED_NAME ?? "Test Teacher";
const PASSWORD = process.env.SEED_PASSWORD ?? "Teacher@123";
const ROLE_NAME = (process.env.SEED_ROLE ?? "TEACHER") as GlobalRole;

async function main() {
  const role = await prisma.role.findUnique({ where: { name: ROLE_NAME } });
  if (!role) {
    console.error(`Role "${ROLE_NAME}" not found. Run "npm run db:seed" first.`);
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (existing) {
    console.log(`A user with email ${EMAIL} already exists (id: ${existing.id}). Nothing to do.`);
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const user = await prisma.user.create({
    data: {
      email: EMAIL,
      name: NAME,
      passwordHash,
      roleId: role.id,
      status: "ACTIVE",
    },
  });

  console.log("Created team-portal user:");
  console.log(`  role:     ${ROLE_NAME}`);
  console.log(`  email:    ${EMAIL}`);
  console.log(`  password: ${PASSWORD}`);
  console.log(`  id:       ${user.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
