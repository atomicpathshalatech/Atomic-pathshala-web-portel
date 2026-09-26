import { prisma } from "../src/lib/db";

async function main() {
  const sessions = await prisma.whiteboardSession.findMany({ include: { pages: true } });
  for (const s of sessions) {
    if (s.pages.length === 0) {
      console.log("Creating page 1 for session:", s.id, s.title);
      await prisma.whiteboardPage.create({
        data: { sessionId: s.id, pageNumber: 1, objects: [] }
      });
    }
  }
  console.log("Checked all sessions for missing pages.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
