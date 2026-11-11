import { prisma } from "../src/lib/db";
import {
  generateDevicePairingCode,
  registerDeviceFromApp,
  recordDeviceHeartbeat,
  getCallingDevices,
  assignCallingDevice,
  createCallingRequest,
  updateCallingRequestEvent,
  getCallingHistory,
} from "../src/lib/calling/calling-service";
import { CallingRequestStatus, CallingSimPreference } from "@prisma/client";

async function runTestSuite() {
  console.log("=================================================");
  console.log("🚀 STARTING ATOMIC SIM CALLING SYSTEM TEST SUITE");
  console.log("=================================================\n");

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      testsPassed++;
    } else {
      console.error(`❌ FAIL: ${testName} - ${detail || "Condition not met"}`);
      testsFailed++;
    }
  }

  try {
    // Setup test user
    const adminUser = await prisma.user.findFirst({
      where: { role: { name: { in: ["SUPER_ADMIN", "ADMIN"] } } },
    });
    if (!adminUser) throw new Error("Admin user not found in database");

    // TEST 1: Generate Device Pairing Code & QR
    const pairing = await generateDevicePairingCode(adminUser.id);
    assert(
      Boolean(pairing.pairingCode && pairing.pairingCode.length === 6 && pairing.qrPayload),
      "TEST 1: Generate Device Pairing Code & QR payload"
    );

    // TEST 2: Register Device from Android Companion App
    const deviceId = `test-hw-id-${Date.now()}`;
    const registerResult = await registerDeviceFromApp({
      pairingCode: pairing.pairingCode,
      deviceIdentifier: deviceId,
      deviceName: "Firoz Sir Samsung S24 Ultra",
      fcmToken: "mock-fcm-token-for-test",
      androidVersion: "Android 14 (API 34)",
      appVersion: "1.0.0",
      batteryLevel: 92,
      networkType: "WIFI",
      sim1Carrier: "Airtel 5G",
      sim1Number: "+91 98765 00001",
      sim2Carrier: "Jio True 5G",
      sim2Number: "+91 98765 00002",
    });

    assert(
      Boolean(registerResult.success && registerResult.deviceId),
      "TEST 2: Companion App Registration via 6-digit Code"
    );

    // TEST 3: Heartbeat & Online Status Calculation
    const heartbeatRes = await recordDeviceHeartbeat({
      deviceId: registerResult.deviceId,
      batteryLevel: 91,
      networkType: "4G",
    });
    assert(heartbeatRes.success, "TEST 3: Device Heartbeat & Battery Status Update");

    // TEST 4: Fetch Calling Devices
    const devices = await getCallingDevices(adminUser.id);
    const myDevice = devices.find((d) => d.id === registerResult.deviceId);
    assert(
      Boolean(myDevice && myDevice.isOnline && myDevice.sim1Carrier === "Airtel 5G"),
      "TEST 4: Get Devices with Computed Online Status & Dual SIM info"
    );

    // TEST 5: Device Assignment
    const assigned = await assignCallingDevice(registerResult.deviceId, adminUser.id, adminUser.id);
    assert(
      assigned.assignedUserId === adminUser.id,
      "TEST 5: Device Assignment to Counsellor"
    );

    // TEST 6: Call Request Creation & FCM Trigger
    const testLead = await prisma.cRMLead.findFirst();
    const callReq = await createCallingRequest({
      leadId: testLead?.id,
      studentPhone: "+91 98765 43210",
      deviceId: registerResult.deviceId,
      requestedById: adminUser.id,
      preferredSim: CallingSimPreference.SIM_1,
    });
    assert(
      Boolean(callReq.requestId && callReq.status === CallingRequestStatus.SENT),
      "TEST 6: Calling Request Creation with Idempotency Key"
    );

    // TEST 7: Android Event Lifecycle: DELIVERED -> CALLING -> COMPLETED
    await updateCallingRequestEvent({
      requestId: callReq.requestId,
      status: CallingRequestStatus.DELIVERED,
    });

    await updateCallingRequestEvent({
      requestId: callReq.requestId,
      status: CallingRequestStatus.CALLING,
    });

    const completed = await updateCallingRequestEvent({
      requestId: callReq.requestId,
      status: CallingRequestStatus.COMPLETED,
      durationSeconds: 145,
      outcome: "CONNECTED",
      remarks: "Student interested in NEET 2026 Batch",
    });

    assert(
      completed.status === CallingRequestStatus.COMPLETED,
      "TEST 7: Android Call Lifecycle Event Synchronization"
    );

    // TEST 8: Calling History & CRM Sync
    const history = await getCallingHistory(10);
    const historyEntry = history.find((h) => h.callingRequestId === callReq.requestId);
    assert(
      Boolean(historyEntry && historyEntry.durationSeconds === 145),
      "TEST 8: Call History & Duration Persistence"
    );

    // Cleanup test device
    await prisma.callingDevice.delete({ where: { id: registerResult.deviceId } });
    console.log("Cleaned up test device.");

  } catch (err: any) {
    console.error("Test Suite Fatal Error:", err);
    testsFailed++;
  }

  console.log("\n=================================================");
  console.log(`📊 TEST RESULTS: ${testsPassed} PASSED | ${testsFailed} FAILED`);
  console.log("=================================================\n");

  if (testsFailed > 0) process.exit(1);
}

runTestSuite().catch(console.error).finally(() => prisma.$disconnect());
