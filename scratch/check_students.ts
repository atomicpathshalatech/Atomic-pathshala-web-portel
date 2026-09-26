import { prisma } from "../src/lib/db";

async function main() {
  const allUsers = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      student: true,
    },
  });

  const matching = allUsers.filter(u => {
    const n = (u.name || "").toLowerCase();
    const e = (u.email || "").toLowerCase();
    return n.includes("san") || n.includes("ish") || e.includes("san") || e.includes("ish");
  });

  console.log("Matching users:", JSON.stringify(matching, null, 2));

  for (const user of matching) {
    const access = await prisma.userAccess.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
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
    console.log(`Updated lifetime PRO access for: ${user.name} (${user.email} / ${user.phone}) ->`, access.status, access.plan, access.accessType);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
