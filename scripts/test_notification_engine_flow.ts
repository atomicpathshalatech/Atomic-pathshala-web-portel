import { prisma } from "../src/lib/db";
import {
  NotificationType,
  NotificationCategory,
  NotificationPriority,
  NotificationTargetType,
  ScheduledNotificationStatus,
} from "../src/lib/notifications/types";
import {
  enqueueScheduledNotification,
  cancelScheduledNotifications,
  processDueNotifications,
} from "../src/lib/notifications/scheduler";
import { triggerNotificationEvent } from "../src/lib/notifications/engine";

async function main() {
  console.log("=== Notification Engine Verification Test ===");

  // 1. Find a test admin or user
  const admin = await prisma.user.findFirst({
    where: {
      OR: [
        { role: { name: "SUPER_ADMIN" } },
        { email: { contains: "firoz" } },
      ],
    },
    select: { id: true, name: true, email: true },
  }) || await prisma.user.findFirst({
    select: { id: true, name: true, email: true },
  });

  if (!admin) {
    throw new Error("No SUPER_ADMIN found in database");
  }
  console.log(`[PASS] Using admin: ${admin.name} (${admin.id})`);

  // 2. Test Future Scheduling: Enqueue a scheduled notification
  const targetTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour in future
  const idempotencyKey = `test-sched-e2e-${Date.now()}`;
  
  const scheduledJob = await enqueueScheduledNotification({
    eventType: NotificationType.ANNOUNCEMENT_CREATED,
    targetType: NotificationTargetType.USER,
    targetId: admin.id,
    payload: {
      title: "Test Future Scheduled Notification",
      body: "This notification is scheduled for 1 hour from now.",
      category: NotificationCategory.SYSTEM,
      priority: NotificationPriority.HIGH,
      metadata: { testSuite: "e2e_verification" },
    },
    executeAt: targetTime,
    idempotencyKey,
  });

  console.log(`[PASS] Enqueued scheduled notification ID: ${scheduledJob.id}, status: ${scheduledJob.status}`);
  if (scheduledJob.status !== ScheduledNotificationStatus.PENDING) {
    throw new Error(`Expected status PENDING, got ${scheduledJob.status}`);
  }

  // 3. Test Cancellation of scheduled notifications
  const cancelledCount = await cancelScheduledNotifications(
    NotificationType.ANNOUNCEMENT_CREATED,
    undefined,
    admin.id
  );
  console.log(`[PASS] Successfully cancelled ${cancelledCount} scheduled notification(s)`);

  const rechecked = await prisma.scheduledNotification.findUnique({
    where: { id: scheduledJob.id },
  });
  if (rechecked?.status !== ScheduledNotificationStatus.CANCELLED) {
    throw new Error(`Expected CANCELLED status, got ${rechecked?.status}`);
  }
  console.log(`[PASS] Scheduled job status verified as CANCELLED`);

  // 4. Test Due Queue Worker Execution
  const dueTime = new Date(Date.now() - 5000); // 5 seconds in past (due immediately)
  const dueJobKey = `test-due-worker-${Date.now()}`;
  const dueJob = await enqueueScheduledNotification({
    eventType: NotificationType.ANNOUNCEMENT_CREATED,
    targetType: NotificationTargetType.USER,
    targetId: admin.id,
    payload: {
      title: "Immediate Worker Test Notification",
      body: "Should be processed by processDueNotifications()",
      category: NotificationCategory.SYSTEM,
      priority: NotificationPriority.HIGH,
      metadata: { testSuite: "worker_test" },
    },
    executeAt: dueTime,
    idempotencyKey: dueJobKey,
  });

  console.log(`[PASS] Enqueued due job ID: ${dueJob.id}`);
  const workerResult = await processDueNotifications();
  console.log(`[PASS] processDueNotifications finished:`, workerResult);

  const processedJob = await prisma.scheduledNotification.findUnique({
    where: { id: dueJob.id },
  });
  console.log(`[PASS] Due job status after worker: ${processedJob?.status}`);
  if (processedJob?.status !== ScheduledNotificationStatus.PROCESSED) {
    throw new Error(`Expected PROCESSED, got ${processedJob?.status}`);
  }

  // 5. Test Immediate Event Trigger Pipeline
  const eventResult = await triggerNotificationEvent({
    eventType: NotificationType.ANNOUNCEMENT_CREATED,
    category: NotificationCategory.SYSTEM,
    priority: NotificationPriority.NORMAL,
    recipientUserIds: [admin.id],
    title: "Instant Verification Ping",
    body: "Testing in-app notification creation and real-time delivery pipeline",
    deepLink: "/notifications",
    idempotencyKey: `instant-event-${Date.now()}`,
  });

  console.log(`[PASS] triggerNotificationEvent dispatched successfully: dispatchedCount = ${eventResult.dispatchedCount}`);
  if (eventResult.dispatchedCount === 0) {
    throw new Error("Expected at least 1 recipient dispatched");
  }

  // Cleanup test artifacts from database
  await prisma.scheduledNotification.deleteMany({
    where: {
      id: { in: [scheduledJob.id, dueJob.id] },
    },
  });
  await prisma.notification.deleteMany({
    where: {
      userId: admin.id,
      title: "Instant Verification Ping",
    },
  });
  console.log("[PASS] Test cleanup completed successfully.");

  console.log("=== ALL NOTIFICATION PIPELINE TESTS PASSED ===");
}

main()
  .catch((e) => {
    console.error("Test failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
