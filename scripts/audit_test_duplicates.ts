import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("=== AUDITING TESTS FOR DUPLICATE QUESTION IDS ===");

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
                  chapter: true,
                  translations: {
                    select: { language: true, statement: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`Total tests in database: ${tests.length}`);

  let testsWithDuplicates = 0;
  let totalDuplicateInstances = 0;

  for (const test of tests) {
    const questionIdToSlots = new Map<string, { sectionName: string; order: number; questionCode: string | null }[]>();

    for (const sec of test.sections) {
      for (const sq of sec.questions) {
        const qId = sq.questionId;
        const slots = questionIdToSlots.get(qId) || [];
        slots.push({
          sectionName: sec.name,
          order: sq.order,
          questionCode: sq.question.questionCode,
        });
        questionIdToSlots.set(qId, slots);
      }
    }

    const duplicates = Array.from(questionIdToSlots.entries()).filter(([_, slots]) => slots.length > 1);

    if (duplicates.length > 0) {
      testsWithDuplicates++;
      console.log(`\n[DUPLICATE DETECTED] Test ID: ${test.id} | Name: "${test.name}" | Status: ${test.status}`);
      for (const [qId, slots] of duplicates) {
        totalDuplicateInstances += (slots.length - 1);
        console.log(`  Question ID: ${qId} (${slots[0].questionCode || "NO_CODE"}) appears ${slots.length} times:`);
        for (const slot of slots) {
          console.log(`    - Section: "${slot.sectionName}", Order/Slot: ${slot.order}`);
        }
      }
    }
  }

  console.log(`\n=== AUDIT SUMMARY ===`);
  console.log(`Total Tests: ${tests.length}`);
  console.log(`Tests with Duplicate Question IDs: ${testsWithDuplicates}`);
  console.log(`Total Duplicate Question Associations: ${totalDuplicateInstances}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
