import { PrismaClient, GlobalRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const accounts = [
    {
      email: "admin@atomicpathshala.com",
      password: "Admin@12345",
      name: "Atomic Admin",
      role: "SUPER_ADMIN" as GlobalRole,
    },
    {
      email: "teacher@atomicpathshala.com",
      password: "Teacher@12345",
      name: "Test Teacher",
      role: "TEACHER" as GlobalRole,
    },
    {
      email: "student@atomicpathshala.com",
      password: "Student@12345",
      name: "Test Student",
      role: "STUDENT" as GlobalRole,
    },
  ];

  for (const account of accounts) {
    const role = await prisma.role.findUnique({
      where: { name: account.role },
    });

    if (!role) {
      throw new Error(`Role not found: ${account.role}`);
    }

    const passwordHash = await bcrypt.hash(account.password, 12);

    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: {
        name: account.name,
        passwordHash,
        roleId: role.id,
        status: "ACTIVE" as UserStatus,
      },
      create: {
        email: account.email,
        name: account.name,
        passwordHash,
        roleId: role.id,
        status: "ACTIVE" as UserStatus,
      },
    });

    console.log(`Created/updated: ${user.email} (${account.role})`);
  }

  console.log("\nTEST ACCOUNTS READY");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
