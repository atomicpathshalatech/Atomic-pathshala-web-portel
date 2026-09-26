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
    console.error("No biology section found");
    return;
  }

  console.log(`Test: ${test.name} | Bio Section: ${bioSection.name} (${bioSection.id})`);

  // Update targetCount on bioSection to 90
  await prisma.section.update({
    where: { id: bioSection.id },
    data: { targetCount: 90 },
  });

  // Also ensure Physics and Chemistry targetCount are 45
  for (const s of test.sections) {
    if (s.id !== bioSection.id) {
      await prisma.section.update({
        where: { id: s.id },
        data: { targetCount: 45 },
      });
    }
  }

  // Get all section questions ordered by order asc
  const secQuestions = await prisma.sectionQuestion.findMany({
    where: { sectionId: bioSection.id },
    orderBy: { order: "asc" },
  });

  console.log(`Total currently linked to Bio Section: ${secQuestions.length}`);

  // Keep first 90 questions, unlink any extra (> 90)
  if (secQuestions.length > 90) {
    const toRemove = secQuestions.slice(90);
    console.log(`Unlinking ${toRemove.length} extra questions from test section (keeping first 90)...`);
    for (const sq of toRemove) {
      await prisma.sectionQuestion.delete({
        where: { id: sq.id },
      });
    }
  }

  // Re-index remaining 90 questions from 1 to 90
  const remaining = await prisma.sectionQuestion.findMany({
    where: { sectionId: bioSection.id },
    orderBy: { order: "asc" },
  });

  for (let i = 0; i < remaining.length; i++) {
    const item = remaining[i];
    if (!item) continue;
    await prisma.sectionQuestion.update({
      where: { id: item.id },
      data: { order: i + 1 },
    });
  }

  console.log(`Biology section now has exactly ${remaining.length} questions (Order 1 to 90).`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
