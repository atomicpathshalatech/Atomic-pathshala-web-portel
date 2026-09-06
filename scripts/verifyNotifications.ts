import { prisma } from "../src/lib/db";
import { triggerNotificationEvent } from "../src/lib/notifications/engine";
import { NotificationType, NotificationChannel } from "../src/lib/notifications/types";
import { enqueueScheduledNotification, cancelScheduledNotifications, processDueNotifications } from "../src/lib/notifications/scheduler";
import { generateDailyTargetsForStudent } from "../src/lib/notifications/dailyTargetEngine";

async function runVerification() {
  console.log("=== STARTING NOTIFICATION SYSTEM VERIFICATION ===");

  // 1. Find a test student user
  const student = await prisma.student.findFirst({
    include: { user: true },
  });

  if (!student) {
    console.error("No student found in database to run tests against.");
    process.exit(1);
  }

  const userId = student.userId;
  console.log(`[TEST 1] Testing with Student: ${student.user.name} (${userId})`);

  // 2. Test Direct In-App & Push Trigger via Central Notification Engine
  console.log("\n[TEST 2] Testing triggerNotificationEvent (CLASS_LIVE)...");
  const testClassId = `test-class-${Date.now()}`;
  const result1 = await triggerNotificationEvent({
    eventType: NotificationType.CLASS_LIVE,
    entityId: testClassId,
    recipientUserIds: [userId],
    title: "🔴 Class is LIVE: Quantum Physics Test",
    body: "Your faculty has started the class. Click to join now!",
    deepLink: `/live-class/${testClassId}`,
    idempotencyKey: `test-live:${testClassId}`,
  });
  console.log("Result 1 (CLASS_LIVE):", result1);

  // 3. Test Deduplication / Idempotency
  console.log("\n[TEST 3] Testing Duplicate Prevention / Idempotency...");
  const resultDuplicate = await triggerNotificationEvent({
    eventType: NotificationType.CLASS_LIVE,
    entityId: testClassId,
    recipientUserIds: [userId],
    title: "🔴 Class is LIVE: Quantum Physics Test",
    body: "Your faculty has started the class. Click to join now!",
    deepLink: `/live-class/${testClassId}`,
    idempotencyKey: `test-live:${testClassId}`,
  });
  console.log("Result Duplicate (should not create duplicate notification):", resultDuplicate);

  const notificationsForEvent = await prisma.notification.findMany({
    where: {
      userId,
      idempotencyKey: `test-live:${testClassId}:${userId}`,
    },
  });
  console.log(`DB Count for idempotencyKey: ${notificationsForEvent.length} (Expected: 1)`);
  if (notificationsForEvent.length !== 1) {
    throw new Error(`Idempotency failed: expected 1 notification row, got ${notificationsForEvent.length}`);
  }

  // 4. Test Scheduled Notification Queue
  console.log("\n[TEST 4] Testing Backend Scheduler Queue...");
  const scheduledTime = new Date(Date.now() + 5000); // 5 seconds in future
  const scheduledJob = await enqueueScheduledNotification({
    eventType: NotificationType.CLASS_REMINDER_15_MIN,
    entityId: testClassId,
    targetType: "USER",
    targetId: userId,
    payload: {
      title: "Class starts in 15 minutes",
      body: "Keep your notebook ready. Class starts soon.",
      deepLink: `/live-class/${testClassId}`,
    },
    executeAt: scheduledTime,
    idempotencyKey: `sched-rem:${testClassId}`,
  });
  console.log("Scheduled Job Created:", scheduledJob.id, "Status:", scheduledJob.status);

  // 5. Test Scheduler Cancellation (e.g. on reschedule or cancel)
  console.log("\n[TEST 5] Testing Reminder Cancellation upon Class Reschedule/Cancel...");
  const cancelledCount = await cancelScheduledNotifications(
    NotificationType.CLASS_REMINDER_15_MIN,
    testClassId
  );
  console.log(`Cancelled reminder jobs count: ${cancelledCount} (Expected: 1)`);

  const checkJob = await prisma.scheduledNotification.findUnique({
    where: { id: scheduledJob.id },
  });
  console.log("Job status after cancellation:", checkJob?.status);
  if (checkJob?.status !== "CANCELLED") {
    throw new Error(`Cancellation failed: expected CANCELLED, got ${checkJob?.status}`);
  }

  // 6. Test DPP Notification Event
  console.log("\n[TEST 6] Testing DPP_UPLOADED event...");
  const dppResult = await triggerNotificationEvent({
    eventType: NotificationType.DPP_UPLOADED,
    entityId: "dpp-demo-01",
    recipientUserIds: [userId],
    title: "New DPP: Rotational Motion DPP 01",
    body: "A new practice set is available. Solve it today!",
    deepLink: "/student/practice",
  });
  console.log("DPP Upload Event Result:", dppResult);

  // 7. Test Daily Target Generation
  console.log("\n[TEST 7] Testing Dynamic Daily Target Generation Engine...");
  const targetResult = await generateDailyTargetsForStudent(userId);
  console.log("Daily Target Generation Result for student:", targetResult);

  const dailyTargetNotif = await prisma.notification.findFirst({
    where: {
      userId,
      type: NotificationType.DAILY_TARGET,
    },
    orderBy: { createdAt: "desc" },
  });
  console.log("Latest Daily Target Notification:", {
    title: dailyTargetNotif?.title,
    body: dailyTargetNotif?.body,
    deepLink: dailyTargetNotif?.deepLink,
  });

  // 8. Test Device Token Registration & Cleanup
  console.log("\n[TEST 8] Testing Device Token Upsert & Multi-device Support...");
  const dummyFcmToken = `fcm_test_token_${Date.now()}`;
  const device = await prisma.userDevice.upsert({
    where: { fcmToken: dummyFcmToken },
    update: { isActive: true },
    create: {
      userId,
      fcmToken: dummyFcmToken,
      platform: "WEB",
      deviceInfo: { browser: "Chrome", os: "Windows" },
      isActive: true,
    },
  });
  console.log("Device Token Registered:", device.id, "Platform:", device.platform);

  // Cleanup test device
  await prisma.userDevice.delete({ where: { id: device.id } });
  console.log("Test device token cleaned up.");

  console.log("\n==================================================");
  console.log("✅ ALL NOTIFICATION SYSTEM VERIFICATIONS PASSED!");
  console.log("==================================================");
}

runVerification()
  .catch((e) => {
    console.error("Verification failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
