import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const qs = await prisma.question.findMany({
    where: {
      subject: "Biology",
      createdAt: { gte: new Date("2026-09-25T00:00:00Z") },
    },
    orderBy: { createdAt: "asc" },
    include: { sectionLinks: true },
  });

  console.log("Total Biology questions created since 2026-09-25:", qs.length);
  const unlinked = qs.filter((q) => q.sectionLinks.length === 0);
  console.log("Unlinked Biology questions:", unlinked.length);
  unlinked.forEach((q, idx) => {
    console.log(`${idx + 1}. Code: ${q.questionCode} | ID: ${q.id} | Chap: ${q.chapter} | Created: ${q.createdAt.toISOString()}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
