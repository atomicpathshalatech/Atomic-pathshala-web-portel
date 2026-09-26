import { prisma } from "../src/lib/db";

async function runMigration() {
  console.log("=== STARTING REFERENCE IMAGE MIGRATION & DATA CLEANUP ===");

  const allQuestions = await prisma.question.findMany({
    include: {
      assets: true,
      translations: true,
    },
  });

  console.log(`Total questions scanned: ${allQuestions.length}`);

  let changedCount = 0;
  let skippedCount = 0;
  let genuineDiagramCount = 0;
  const changedIds: string[] = [];

  for (const q of allQuestions) {
    const hasReferenceAsset = q.assets.some((a) => a.type === "REFERENCE" && a.publicUrl === q.imageUrl);
    const isExtractedOrPasted =
      Boolean(q.imageUrl) &&
      (hasReferenceAsset ||
        q.tags?.includes("Extracted") ||
        q.imageUrl?.includes("/questions/q_") ||
        q.category?.includes("Source:") ||
        q.category?.includes("PYQ"));

    if (q.imageUrl && (isExtractedOrPasted || hasReferenceAsset)) {
      // Migrate imageUrl -> referenceImageUrl, and clear imageUrl
      await prisma.question.update({
        where: { id: q.id },
        data: {
          referenceImageUrl: q.referenceImageUrl || q.imageUrl,
          imageUrl: null, // Clear from student-facing question content
        },
      });

      // Ensure asset has type REFERENCE
      for (const asset of q.assets) {
        if (asset.publicUrl === q.imageUrl && asset.type !== "REFERENCE") {
          await prisma.questionAsset.update({
            where: { id: asset.id },
            data: { type: "REFERENCE" },
          });
        }
      }

      changedCount++;
      changedIds.push(q.id);
    } else if (q.imageUrl) {
      // Question has genuine diagram
      genuineDiagramCount++;
      skippedCount++;
    } else {
      skippedCount++;
    }
  }

  console.log(`\n=== MIGRATION SUMMARY ===`);
  console.log(`Total records scanned: ${allQuestions.length}`);
  console.log(`Total records changed: ${changedCount}`);
  console.log(`Total records skipped: ${skippedCount}`);
  console.log(`Genuine diagrams preserved: ${genuineDiagramCount}`);
  console.log(`Modified Question IDs sample:`, changedIds.slice(0, 10));

  // Verify Minor Test : 01
  const minorTest = await prisma.test.findFirst({
    where: { name: { contains: "Minor Test" } },
    include: {
      sections: {
        include: {
          questions: {
            include: {
              question: {
                select: {
                  id: true,
                  questionCode: true,
                  imageUrl: true,
                  referenceImageUrl: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (minorTest) {
    const totalQ = minorTest.sections.reduce((acc, s) => acc + s.questions.length, 0);
    const studentFacingImgQ = minorTest.sections.reduce(
      (acc, s) => acc + s.questions.filter((sq) => Boolean(sq.question.imageUrl)).length,
      0
    );
    const referenceImgQ = minorTest.sections.reduce(
      (acc, s) => acc + s.questions.filter((sq) => Boolean(sq.question.referenceImageUrl)).length,
      0
    );
    console.log(`\n=== VERIFICATION: ${minorTest.name} ===`);
    console.log(`Total Questions: ${totalQ}`);
    console.log(`Student-facing image count (should be 0 unless genuine diagrams): ${studentFacingImgQ}`);
    console.log(`Reference image count (preserved for editor): ${referenceImgQ}`);
  }

  console.log("\n=== MIGRATION COMPLETED SUCCESSFULLY ===");
}

runMigration()
  .catch((err) => {
    console.error("Migration error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
