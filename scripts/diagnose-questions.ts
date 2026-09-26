import { prisma } from "../src/lib/db";

async function main() {
  const totalQuestions = await prisma.question.count();
  const withImage = await prisma.question.findMany({
    where: { imageUrl: { not: null } },
    select: {
      id: true,
      questionCode: true,
      subject: true,
      chapter: true,
      imageUrl: true,
      createdAt: true,
      translations: {
        select: {
          language: true,
          statement: true,
          options: true,
          correctOptionIds: true,
        },
      },
      assets: {
        select: {
          id: true,
          type: true,
          publicUrl: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`\n=== QUESTION BANK AUDIT REPORT ===`);
  console.log(`Total questions in database: ${totalQuestions}`);
  console.log(`Questions with imageUrl populated: ${withImage.length}\n`);

  for (const q of withImage.slice(0, 15)) {
    const en = q.translations.find((t) => t.language === "ENGLISH");
    console.log(`--------------------------------------------------`);
    console.log(`ID: ${q.id} | Code: ${q.questionCode} | Subject: ${q.subject}`);
    console.log(`Statement EN: ${(en?.statement || "").slice(0, 80)}...`);
    console.log(`imageUrl: ${q.imageUrl}`);
    console.log(`Assets count: ${q.assets.length} (${q.assets.map((a) => a.type).join(", ")})`);
  }

  const tests = await prisma.test.findMany({
    include: {
      sections: {
        include: {
          questions: {
            include: {
              question: {
                select: {
                  id: true,
                  questionCode: true,
                  subject: true,
                  imageUrl: true,
                },
              },
            },
          },
        },
      },
    },
  });

  console.log(`\n=== TESTS AUDIT REPORT ===`);
  console.log(`Total tests: ${tests.length}`);
  for (const t of tests) {
    const totalQ = t.sections.reduce((acc, s) => acc + s.questions.length, 0);
    const withImgQ = t.sections.reduce(
      (acc, s) => acc + s.questions.filter((sq) => Boolean(sq.question.imageUrl)).length,
      0
    );
    console.log(`Test ID: ${t.id} | Name: ${t.name} | Total Qs: ${totalQ} | Qs with imageUrl: ${withImgQ}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
