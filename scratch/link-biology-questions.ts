import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const test = await prisma.test.findFirst({
    where: { name: { contains: "Minor Test" } },
    include: { sections: true },
    orderBy: { createdAt: "desc" },
  });

  if (!test) {
    console.error("No test found");
    return;
  }

  const bioSection = test.sections.find(
    (s) => s.name.toLowerCase().includes("bio") || s.subject.toLowerCase().includes("bio")
  );

  if (!bioSection) {
    console.error("No biology section found in test", test.name);
    return;
  }

  console.log(`Target Test: ${test.name} (${test.id}) | Biology Section: ${bioSection.name} (${bioSection.id})`);

  // Find all unlinked Biology questions created since 2026-09-25
  const unlinkedQuestions = await prisma.question.findMany({
    where: {
      subject: "Biology",
      createdAt: { gte: new Date("2026-09-25T00:00:00Z") },
      sectionLinks: { none: {} },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${unlinkedQuestions.length} unlinked Biology questions to link.`);

  // Get current max order in biology section
  const currentCount = await prisma.sectionQuestion.count({
    where: { sectionId: bioSection.id },
  });

  console.log(`Current questions in Biology section: ${currentCount}`);

  let added = 0;
  for (let i = 0; i < unlinkedQuestions.length; i++) {
    const q = unlinkedQuestions[i];
    if (!q) continue;
    await prisma.sectionQuestion.create({
      data: {
        sectionId: bioSection.id,
        questionId: q.id,
        order: currentCount + i + 1,
      },
    });

    await prisma.question.update({
      where: { id: q.id },
      data: { usageCount: { increment: 1 } },
    });
    added++;
  }

  console.log(`Successfully linked ${added} Biology questions to ${test.name} -> ${bioSection.name}!`);

  const updatedCount = await prisma.sectionQuestion.count({
    where: { sectionId: bioSection.id },
  });
  console.log(`Updated total questions in Biology section: ${updatedCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
