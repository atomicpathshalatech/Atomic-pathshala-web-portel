import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Running fast SQL backfill for SectionQuestion testId...");
  const updatedCount = await prisma.$executeRawUnsafe(`
    UPDATE section_questions
    SET "testId" = s."testId"
    FROM sections s
    WHERE section_questions."sectionId" = s.id
      AND section_questions."testId" IS NULL;
  `);

  console.log(`Updated ${updatedCount} rows in section_questions.`);
  
  const remainingNull = await prisma.sectionQuestion.count({
    where: { testId: null }
  });
  console.log(`Remaining null testIds: ${remainingNull}`);
}

main()
  .catch((e) => {
    console.error("Error backfilling:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
