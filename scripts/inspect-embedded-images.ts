import { prisma } from "../src/lib/db";

async function run() {
  const qs = await prisma.questionTranslation.findMany({
    where: {
      OR: [
        { statement: { contains: "pub-dfdc1ecb5e9b4183a8dc9ac9cc695380" } },
        { solution: { contains: "pub-dfdc1ecb5e9b4183a8dc9ac9cc695380" } },
      ],
    },
    select: {
      questionId: true,
      language: true,
      statement: true,
      solution: true,
    },
  });

  console.log(`Translations with embedded image URLs: ${qs.length}`);
  for (const q of qs) {
    console.log(`QId: ${q.questionId} | Lang: ${q.language}`);
    console.log(`Statement: ${q.statement}`);
    console.log(`--------------------------------------------------`);
  }
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
