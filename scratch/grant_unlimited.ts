import { prisma } from "../src/lib/db";

async function main() {
  const targetEmails = [
    "shaniyakhatoon400@gmail.com",
    "israt237419@gmail.com",
    "taibaishrat786@gmail.com",
  ];

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { in: targetEmails } },
        { name: { contains: "Shaniya", mode: "insensitive" } },
        { name: { contains: "Saniya", mode: "insensitive" } },
        { name: { contains: "Ishrat", mode: "insensitive" } },
      ],
    },
  });

  console.log(`Found ${users.length} target users:`);
  for (const u of users) {
    const access = await prisma.userAccess.upsert({
      where: { userId: u.id },
      create: {
        userId: u.id,
        plan: "PRO",
        accessType: "LIFETIME_ACCESS",
        status: "ACTIVE",
        startsAt: new Date(),
        expiresAt: new Date("2099-12-31T23:59:59.000Z"),
      },
      update: {
        plan: "PRO",
        accessType: "LIFETIME_ACCESS",
        status: "ACTIVE",
        expiresAt: new Date("2099-12-31T23:59:59.000Z"),
      },
    });
    console.log(`Granted UNLIMITED LIFETIME PRO access for: ${u.name} (${u.email}) [ID: ${u.id}]`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
