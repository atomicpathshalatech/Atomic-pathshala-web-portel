import { prisma } from "@/lib/db";
import { triggerNotificationEvent } from "@/lib/notifications/engine";
import {
  NotificationType,
  NotificationCategory,
  NotificationPriority,
} from "@/lib/notifications/types";
import { formatISTDateTime } from "@/lib/date-utils";

/**
 * Synchronizes test syllabus to batch folders and posts announcement notice.
 * Automatically called when:
 * 1. A new test is created in a Test Series (syncs to all batches where the series is imported).
 * 2. A Test Series is newly imported into a batch (syncs all tests in that series to that batch).
 */
export async function syncTestSyllabusToBatches({
  testId,
  batchId,
  testSeriesId,
}: {
  testId?: string;
  batchId?: string;
  testSeriesId?: string;
}) {
  try {
    // 1. Resolve test(s)
    let testsToSync: any[] = [];
    if (testId) {
      const t = await prisma.test.findUnique({
        where: { id: testId },
        include: { testSeries: true },
      });
      if (t) testsToSync.push(t);
    } else if (testSeriesId) {
      testsToSync = await prisma.test.findMany({
        where: { testSeriesId },
        include: { testSeries: true },
      });
    }

    if (testsToSync.length === 0) return;

    // 2. Resolve target batch(es)
    let targetBatchIds: string[] = [];
    if (batchId) {
      targetBatchIds.push(batchId);
    } else {
      // Find all batches importing the test series
      const seriesIds = Array.from(
        new Set(testsToSync.map((t) => t.testSeriesId).filter(Boolean))
      ) as string[];

      if (seriesIds.length > 0) {
        const imported = await prisma.batchTestSeries.findMany({
          where: { testSeriesId: { in: seriesIds } },
          select: { batchId: true },
        });
        targetBatchIds = Array.from(new Set(imported.map((i) => i.batchId)));
      }
    }

    if (targetBatchIds.length === 0) return;

    // 3. For each batch, ensure "Test Syllabus" folder and add files + notice
    for (const bId of targetBatchIds) {
      const batch = await prisma.batch.findUnique({
        where: { id: bId },
        select: { id: true, name: true },
      });
      if (!batch) continue;

      // Find or create "Test Syllabus" folder for this batch
      let syllabusFolder = await prisma.batchFolder.findFirst({
        where: {
          batchId: bId,
          name: "Test Syllabus",
        },
      });

      if (!syllabusFolder) {
        // Find root folder if exists
        const rootFolder = await prisma.batchFolder.findFirst({
          where: { batchId: bId, parentId: null },
        });

        syllabusFolder = await prisma.batchFolder.create({
          data: {
            batchId: bId,
            name: "Test Syllabus",
            parentId: rootFolder ? rootFolder.id : null,
            order: 10,
            isPublished: true,
          },
        });
      }

      for (const test of testsToSync) {
        const syllabusTitle = `Syllabus - ${test.name}`;
        const syllabusFileName = `Syllabus_${test.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
        const syllabusAssetId = `/api/tests/${test.id}/syllabus-pdf?batchId=${batch.id}`;

        // Upsert folder file
        const existingFile = await prisma.batchFolderFile.findFirst({
          where: {
            folderId: syllabusFolder.id,
            title: syllabusTitle,
          },
        });

        if (!existingFile) {
          await prisma.batchFolderFile.create({
            data: {
              folderId: syllabusFolder.id,
              title: syllabusTitle,
              fileName: syllabusFileName,
              fileAssetId: syllabusAssetId,
              mimeType: "application/pdf",
              isPublished: true,
            },
          });
        }

        // Post announcement notice to batch students
        const testDateStr = test.openTime
          ? formatISTDateTime(test.openTime)
          : "Schedule pending";

        const idempotencyKey = `test-syllabus-notice:${bId}:${test.id}`;

        try {
          await triggerNotificationEvent({
            eventType: NotificationType.BATCH_NOTIFICATION,
            category: NotificationCategory.TESTS,
            priority: NotificationPriority.HIGH,
            batchId: bId,
            title: `📢 Upcoming Test: ${test.name}`,
            body: `Test scheduled on ${testDateStr}. Duration: ${test.durationMin} mins. Syllabus has been published in your batch!`,
            deepLink: `/courses/${bId}?tab=tests`,
            actionType: "VIEW_SYLLABUS",
            actionUrl: `/api/tests/${test.id}/syllabus-pdf?batchId=${bId}`,
            idempotencyKey,
            metadata: {
              batchId: bId,
              batchName: batch.name,
              testId: test.id,
              testName: test.name,
              openTime: test.openTime,
            },
          });
        } catch (noticeErr) {
          console.warn("[syncTestSyllabusToBatches] Notice trigger error:", noticeErr);
        }
      }
    }
  } catch (err) {
    console.error("[syncTestSyllabusToBatches] Error:", err);
  }
}
