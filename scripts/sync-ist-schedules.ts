import { PrismaClient } from "@prisma/client";
import { computeISTScheduleDates } from "../src/lib/date-utils";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Starting IST Schedule Synchronization Pass...");

  // 1. Fetch all lectures
  const lectures = await prisma.lecture.findMany({
    include: { chapter: { include: { subject: true } } },
  });
  console.log(`Found ${lectures.length} lectures in database.`);

  const defaultBatch =
    (await prisma.batch.findFirst({ where: { status: "ACTIVE" } })) ||
    (await prisma.batch.findFirst());

  let syncedCount = 0;
  for (const lec of lectures) {
    const { startsAt, endsAt } = computeISTScheduleDates(
      lec.scheduledDate,
      lec.startTime,
      lec.durationMin || 60
    );

    if (defaultBatch) {
      await prisma.batchSchedule.upsert({
        where: { id: lec.id },
        update: {
          title: lec.title,
          subject: lec.chapter?.subject?.title || null,
          teacherId: lec.teacherId,
          chapterId: lec.chapterId,
          startsAt,
          endsAt,
        },
        create: {
          id: lec.id,
          title: lec.title,
          subject: lec.chapter?.subject?.title || null,
          type: "LIVE_CLASS",
          batchId: defaultBatch.id,
          teacherId: lec.teacherId,
          chapterId: lec.chapterId,
          startsAt,
          endsAt,
          createdById: lec.teacherId,
        },
      });
      syncedCount++;
    }
  }

  console.log(`✅ Successfully synchronized ${syncedCount} lecture schedules to exact IST timestamps!`);
}

main()
  .catch((e) => {
    console.error("Sync error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
