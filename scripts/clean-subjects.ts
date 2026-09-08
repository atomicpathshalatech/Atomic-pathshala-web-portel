import { prisma } from "../src/lib/db";

async function main() {
  const subjects = await prisma.subject.findMany({
    include: { _count: { select: { chapters: true } } },
  });
  console.log("Current DB Subjects:", subjects.map((s) => ({ id: s.id, title: s.title, chapters: s._count.chapters })));

  const deleted = await prisma.subject.deleteMany({
    where: {
      title: { in: ["Mental Ability", "Science"] },
      chapters: { none: {} },
    },
  });
  console.log("Deleted stray subjects count:", deleted.count);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
