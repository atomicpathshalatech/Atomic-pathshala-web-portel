import { prisma } from "../src/lib/db";
import { awardActivityXp, manualAdjustStudentXp, levelForXp } from "../src/lib/gamification/xp-engine";

interface TestReport {
  scenario: string;
  expected: string;
  actual: string;
  passed: boolean;
}

const results: TestReport[] = [];

function assert(scenario: string, expected: string, actual: string, condition: boolean) {
  results.push({
    scenario,
    expected,
    actual,
    passed: condition,
  });
  console.log(`${condition ? "✅ PASS" : "❌ FAIL"}: ${scenario}`);
  if (!condition) {
    console.error(`   Expected: ${expected}`);
    console.error(`   Actual:   ${actual}`);
  }
}

async function runTestSuite() {
  console.log("==========================================================");
  console.log("RUNNING ATOMIC PATHSHALA XP ENGINE VERIFICATION TEST SUITE");
  console.log("==========================================================\n");

  // Pick two real existing students
  const existingStudents = await prisma.student.findMany({
    take: 2,
    orderBy: { createdAt: "desc" },
    include: { user: true },
  });

  if (existingStudents.length < 2) {
    throw new Error("Need at least 2 existing students for testing.");
  }

  const testStudentA = existingStudents[0];
  const testStudentB = existingStudents[1];

  console.log(`Test Student A: ${testStudentA.user.name} (${testStudentA.id}) - Initial XP: ${testStudentA.xp}`);
  console.log(`Test Student B: ${testStudentB.user.name} (${testStudentB.id}) - Initial XP: ${testStudentB.xp}\n`);

  // Super admin user
  let adminUser = await prisma.user.findFirst({
    where: { role: { name: { in: ["SUPER_ADMIN", "ADMIN", "FOUNDER"] } } },
  });
  if (!adminUser) {
    adminUser = testStudentA.user;
  }

  // -------------------------------------------------------------------------
  // TEST 1: Two students complete the same eligible activity -> Same configured reward
  // -------------------------------------------------------------------------
  const res1A = await awardActivityXp({
    studentId: testStudentA.id,
    activityName: "LIVE_CLASS_ATTENDANCE",
    sourceEntityId: `test_sess_1_${Date.now()}`,
  });
  const res1B = await awardActivityXp({
    studentId: testStudentB.id,
    activityName: "LIVE_CLASS_ATTENDANCE",
    sourceEntityId: `test_sess_2_${Date.now()}`,
  });
  assert(
    "1. Two students complete the same eligible activity",
    "Both receive same configured reward (20 XP)",
    `Student A received ${res1A.xpAwarded} XP, Student B received ${res1B.xpAwarded} XP`,
    res1A.xpAwarded === 20 && res1B.xpAwarded === 20
  );

  // -------------------------------------------------------------------------
  // TEST 2: Student repeats an activity with frequency limit (ONCE_PER_DAY)
  // -------------------------------------------------------------------------
  const todayKey = new Date().toISOString().split("T")[0];
  const res2First = await awardActivityXp({
    studentId: testStudentA.id,
    activityName: "DAILY_LOGIN",
    sourceEntityId: `test_login_${todayKey}`,
    idempotencyKey: `test_daily_login_${todayKey}_${testStudentA.id}_first`,
  });
  const res2Second = await awardActivityXp({
    studentId: testStudentA.id,
    activityName: "DAILY_LOGIN",
    sourceEntityId: `test_login_${todayKey}_repeat`,
    idempotencyKey: `test_daily_login_${todayKey}_${testStudentA.id}_second`,
  });
  assert(
    "2. Student repeats an activity -> Frequency limits respected",
    "First attempt awarded or checked, second attempt blocked with frequency limit",
    `First awarded: ${res2First.awarded} (${res2First.xpAwarded} XP), Second awarded: ${res2Second.awarded} (reason: ${res2Second.skippedReason})`,
    res2Second.awarded === false && res2Second.xpAwarded === 0
  );

  // -------------------------------------------------------------------------
  // TEST 3: Duplicate event received -> No duplicate XP (Idempotency)
  // -------------------------------------------------------------------------
  const fixedIdempotencyKey = `idemp_test_event_${Date.now()}`;
  const res3A = await awardActivityXp({
    studentId: testStudentA.id,
    activityName: "DPP_COMPLETION",
    sourceEntityId: "dpp_unique_101",
    idempotencyKey: fixedIdempotencyKey,
  });
  const res3B = await awardActivityXp({
    studentId: testStudentA.id,
    activityName: "DPP_COMPLETION",
    sourceEntityId: "dpp_unique_101",
    idempotencyKey: fixedIdempotencyKey,
  });
  assert(
    "3. Duplicate event received -> No duplicate XP",
    "First call awards 25 XP, second call returns duplicate with 0 XP",
    `First awarded: ${res3A.awarded} (${res3A.xpAwarded} XP), Second awarded: ${res3B.awarded} (${res3B.xpAwarded} XP)`,
    res3A.awarded === true && res3B.awarded === false && res3B.xpAwarded === 0
  );

  // -------------------------------------------------------------------------
  // TEST 4: Two concurrent requests with different keys -> Atomic Balance Updates
  // -------------------------------------------------------------------------
  const studentBeforeConcur = await prisma.student.findUnique({
    where: { id: testStudentA.id },
    select: { xp: true },
  });
  const startXp = studentBeforeConcur?.xp ?? 0;

  // Run 5 concurrent distinct rewards in parallel using ASSIGNMENT_COMPLETION (no daily limit)
  const concurrentCalls = Array.from({ length: 5 }, (_, i) =>
    awardActivityXp({
      studentId: testStudentA.id,
      activityName: "ASSIGNMENT_COMPLETION",
      sourceEntityId: `concur_assign_${Date.now()}_${i}`,
      idempotencyKey: `concur_key_${Date.now()}_${i}`,
    })
  );
  await Promise.all(concurrentCalls);
  const updatedStudentA = await prisma.student.findUnique({
    where: { id: testStudentA.id },
    select: { xp: true },
  });
  const expectedEnd = startXp + 5 * 30; // 5 awards of 30 XP
  assert(
    "4. Concurrent distinct requests -> Atomic transaction safety without drift",
    `Student balance increases from ${startXp} to ${expectedEnd}`,
    `Final balance is ${updatedStudentA?.xp}`,
    updatedStudentA?.xp === expectedEnd
  );

  // -------------------------------------------------------------------------
  // TEST 5: Concurrent identical requests -> Blocked by Unique Constraint
  // -------------------------------------------------------------------------
  const raceKey = `race_condition_test_${Date.now()}`;
  const raceCalls = Array.from({ length: 4 }, () =>
    awardActivityXp({
      studentId: testStudentB.id,
      activityName: "RECORDED_LECTURE",
      sourceEntityId: `lecture_race_${Date.now()}`,
      idempotencyKey: raceKey,
    })
  );
  const raceResults = await Promise.all(raceCalls);
  const awardedCount = raceResults.filter((r) => r.awarded).length;
  assert(
    "5. Concurrent duplicate requests -> Safely blocked, exactly 1 succeeds",
    "Exactly 1 awarded, 3 blocked as duplicates",
    `${awardedCount} awarded out of 4 concurrent calls`,
    awardedCount === 1
  );

  // -------------------------------------------------------------------------
  // TEST 6: Super Admin adjusts XP -> Audit transaction & XPAdjustment created
  // -------------------------------------------------------------------------
  const studentBeforeAdjust = await prisma.student.findUnique({
    where: { id: testStudentA.id },
    select: { xp: true },
  });
  const adjRes = await manualAdjustStudentXp({
    studentId: testStudentA.id,
    adminId: adminUser.id,
    amount: 50,
    reason: "Excellence in National Science Olympiad",
  });
  const studentAfterAdjust = await prisma.student.findUnique({
    where: { id: testStudentA.id },
    select: { xp: true },
  });
  const adjustmentRow = await prisma.xPAdjustment.findUnique({
    where: { transactionId: adjRes.transactionId },
  });
  const auditLogRow = await prisma.xPAuditLog.findFirst({
    where: { entityId: testStudentA.id, action: "MANUAL_XP_ADJUSTED" },
    orderBy: { createdAt: "desc" },
  });
  assert(
    "6. Super Admin adjusts XP -> Immutable audit transaction & XPAdjustment created",
    `Balance increases by +50 with audit log`,
    `Previous: ${adjRes.previousBalance}, Updated: ${adjRes.updatedBalance}, AdjustmentRow exists: ${Boolean(adjustmentRow)}, AuditLog exists: ${Boolean(auditLogRow)}`,
    studentAfterAdjust?.xp === (studentBeforeAdjust?.xp ?? 0) + 50 && Boolean(adjustmentRow) && Boolean(auditLogRow)
  );

  // -------------------------------------------------------------------------
  // TEST 7: Admin changes rule -> Rule versioning preserved
  // -------------------------------------------------------------------------
  const ruleBefore = await prisma.xPRewardRule.findUnique({
    where: { activityName: "QUESTION_PRACTICE" },
  });
  const originalXp = ruleBefore?.xpPoints ?? 5;
  const originalVersion = ruleBefore?.version ?? 1;

  // Update rule points
  await prisma.xPRewardRule.update({
    where: { activityName: "QUESTION_PRACTICE" },
    data: { xpPoints: 8, version: originalVersion + 1 },
  });
  await prisma.xPRuleVersion.create({
    data: {
      ruleId: ruleBefore!.id,
      version: originalVersion + 1,
      displayLabel: ruleBefore!.displayLabel,
      xpPoints: 8,
      category: ruleBefore!.category,
      frequencyLimit: ruleBefore!.frequencyLimit,
      isActive: true,
      changeReason: "Testing version retention",
      createdById: adminUser.id,
    },
  });

  const ruleVersionsCount = await prisma.xPRuleVersion.count({
    where: { ruleId: ruleBefore!.id },
  });

  // Award with new rule version
  const res7 = await awardActivityXp({
    studentId: testStudentB.id,
    activityName: "QUESTION_PRACTICE",
    sourceEntityId: `ver_test_${Date.now()}`,
  });

  // Revert rule back
  await prisma.xPRewardRule.update({
    where: { activityName: "QUESTION_PRACTICE" },
    data: { xpPoints: originalXp, version: originalVersion + 2 },
  });

  assert(
    "7. Admin changes rule -> Historical versions visible & new version used",
    `Rule version incremented, awarded new point value (8 XP), versions count >= 2`,
    `Awarded: ${res7.xpAwarded} XP, Version count: ${ruleVersionsCount}`,
    res7.xpAwarded === 8 && ruleVersionsCount >= 2
  );

  // -------------------------------------------------------------------------
  // TEST 8: Invalid activity event -> No XP awarded
  // -------------------------------------------------------------------------
  const res8 = await awardActivityXp({
    studentId: testStudentA.id,
    activityName: "INVALID_UNKNOWN_ACTIVITY_EVENT",
  });
  assert(
    "8. Invalid activity event -> Gracefully handled, no XP awarded",
    "awarded: false, xpAwarded: 0, reason: rule not found",
    `awarded: ${res8.awarded}, xpAwarded: ${res8.xpAwarded}, reason: ${res8.skippedReason}`,
    res8.awarded === false && res8.xpAwarded === 0
  );

  // -------------------------------------------------------------------------
  // TEST 9: Student XP balance matches sum of confirmed ledger transactions
  // -------------------------------------------------------------------------
  const allStudents = await prisma.student.findMany({
    select: {
      id: true,
      xp: true,
      user: { select: { name: true } },
      xpTransactions: { where: { status: "SUCCESSFUL" }, select: { amount: true } },
    },
  });
  let allReconciled = true;
  let mismatchCount = 0;
  for (const s of allStudents) {
    const sum = s.xpTransactions.reduce((acc, t) => acc + t.amount, 0);
    if (s.xp !== sum) {
      allReconciled = false;
      mismatchCount++;
      console.log(`Mismatch on ${s.user.name}: Stored = ${s.xp}, Ledger = ${sum}`);
    }
  }
  assert(
    "9. Existing student XP balance vs confirmed transaction ledger",
    "All students in the database have zero ledger drift",
    `All reconciled: ${allReconciled} (${mismatchCount} mismatches out of ${allStudents.length} students)`,
    allReconciled === true
  );

  console.log("\n==========================================================");
  console.log(`TEST RESULTS: ${results.filter((r) => r.passed).length} / ${results.length} PASSED`);
  console.log("==========================================================");
}

runTestSuite()
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
