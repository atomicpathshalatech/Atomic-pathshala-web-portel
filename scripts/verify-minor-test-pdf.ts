require.cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  filename: require.resolve("server-only"),
  loaded: true,
  exports: {},
} as any;

import { prisma } from "../src/lib/db";

async function verify() {
  const { fetchCanonicalTestData, generateTestPaperHtml } = await import("../src/lib/pdf/test-export-engine");
  const minorTest = await prisma.test.findFirst({
    where: { name: { contains: "Minor Test" } },
    select: { id: true, name: true },
  });

  if (!minorTest) return;

  const data = await fetchCanonicalTestData(minorTest.id);
  if (!data) return;

  const qWithImg = data.allQuestions.filter((q) => Boolean(q.imageUrl));
  console.log(`Questions with q.imageUrl in testData: ${qWithImg.length}`);
  for (const q of qWithImg) {
    console.log(`Q${q.number} (ID: ${q.id}) -> imageUrl: ${q.imageUrl}`);
  }

  const html = generateTestPaperHtml(data, { withSolution: false });
  const regex = /https?:\/\/[^\s"'<>]+/g;
  const urls = Array.from(new Set(html.match(regex) || []));
  console.log(`All URLs embedded in generated PDF HTML:`, urls);
}

verify()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
