import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Checking for SectionQuestion rows with testId: null...");
  const nullRows = await prisma.sectionQuestion.findMany({
    where: { testId: null },
    include: { section: { select: { testId: true } } },
  });

  console.log(`Found ${nullRows.length} SectionQuestion rows with testId: null.`);

  let updatedCount = 0;
  for (const row of nullRows) {
    if (row.section?.testId) {
      // Check if another row with this testId and questionId exists
      const duplicate = await prisma.sectionQuestion.findFirst({
        where: {
          testId: row.section.testId,
          questionId: row.questionId,
          id: { not: row.id },
        },
      });

      if (duplicate) {
        console.warn(`Removing duplicate link for qId ${row.questionId} in test ${row.section.testId}`);
        await prisma.sectionQuestion.delete({ where: { id: row.id } });
      } else {
        await prisma.sectionQuestion.update({
          where: { id: row.id },
          data: { testId: row.section.testId },
        });
        updatedCount++;
      }
    }
  }

  console.log(`Successfully updated ${updatedCount} SectionQuestion rows with their testId.`);
}

main().finally(() => prisma.$disconnect());
