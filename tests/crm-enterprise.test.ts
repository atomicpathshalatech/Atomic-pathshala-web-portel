import { prisma } from "../src/lib/db";
import {
  createLead,
  updateLead,
  getLeads,
  getLeadById,
  assignLeads,
  mergeLeads,
  logCall,
  scheduleCounselling,
  getFollowUps,
  convertLeadToAdmission,
  getCrmDashboardMetrics,
  calculateLeadScore,
  normalizePhoneNumber,
} from "../src/lib/crm/crm-service";
import { CRMLeadStatus, CRMLeadPriority, CRMLeadSource } from "@prisma/client";

async function runTestSuite() {
  console.log("=================================================");
  console.log("🚀 STARTING ATOMIC PATHSHALA CRM TEST SUITE");
  console.log("=================================================\n");

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      testsPassed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${detail ? `- ${detail}` : ""}`);
      testsFailed++;
    }
  }

  // TEST 1: Phone Normalization
  try {
    const n1 = normalizePhoneNumber("9876543210");
    const n2 = normalizePhoneNumber("+91 98765 43210");
    const n3 = normalizePhoneNumber("09876543210");
    assert(
      n1.cleanPhone === "9876543210" && n2.cleanPhone === "9876543210" && n3.cleanPhone === "9876543210",
      "Phone Number Normalization (+91, leading 0, spaces)"
    );
  } catch (e: any) {
    assert(false, "Phone Number Normalization", e.message);
  }

  // TEST 2: Lead Scoring Calculation
  try {
    const scoreNormal = calculateLeadScore({});
    const scoreHot = calculateLeadScore({
      hasVisitedCourse: true,
      hasVisitedPayment: true,
      hasAttendedDemo: true,
      targetExam: "NEET",
    });
    assert(scoreNormal.priority === "COLD" && scoreNormal.score === 20, "Scoring: Base lead score");
    assert(scoreHot.priority === "HOT" && scoreHot.score >= 70, "Scoring: Hot lead with payment intent and demo");
  } catch (e: any) {
    assert(false, "Lead Scoring Calculation", e.message);
  }

  // Fetch admin user & active batch for tests
  const admin = await prisma.user.findFirst({
    where: { role: { name: { in: ["SUPER_ADMIN", "ADMIN"] } } },
  });
  const batch = await prisma.batch.findFirst();

  let testLeadA: any;
  let testLeadB: any;

  // TEST 3: Lead Creation with Lead Code Generation
  try {
    testLeadA = await createLead(
      {
        name: "Test Aspirant A",
        phone: "+919999900001",
        email: "aspirant.a@testcrm.com",
        targetExam: "NEET",
        studentClass: "Class 12",
        medium: "HINDI",
        source: CRMLeadSource.WEBSITE,
        city: "Lucknow",
      },
      admin?.id
    );
    assert(
      testLeadA && testLeadA.leadCode.startsWith("APL-") && testLeadA.cleanPhone === "9999900001",
      "Lead Creation with Unique APL Code and Activity Log"
    );
  } catch (e: any) {
    assert(false, "Lead Creation", e.message);
  }

  // TEST 4: Lead Details & Activity Timeline
  try {
    const detail = await getLeadById(testLeadA.id);
    assert(
      detail !== null && detail.activities.length > 0 && detail.activities[0].title === "Lead Captured",
      "Lead Detail 360-View with Activity Timeline"
    );
  } catch (e: any) {
    assert(false, "Lead Detail & Activity Timeline", e.message);
  }

  // TEST 5: Status Update & Stage Transition
  try {
    const updated = await updateLead(
      testLeadA.id,
      { status: CRMLeadStatus.INTERESTED, notes: "Interested in Selection Pro Batch" },
      admin?.id
    );
    const detailAfter = await getLeadById(testLeadA.id);
    const hasStatusActivity = detailAfter?.activities.some((a) => a.title.includes("INTERESTED"));
    assert(
      updated.status === CRMLeadStatus.INTERESTED && Boolean(hasStatusActivity),
      "Lead Status Transition with Audit History"
    );
  } catch (e: any) {
    assert(false, "Lead Status Transition", e.message);
  }

  // TEST 6: Lead Assignment
  try {
    if (admin) {
      await assignLeads([testLeadA.id], admin.id, admin.id);
      const assignedLead = await prisma.cRMLead.findUnique({ where: { id: testLeadA.id } });
      assert(assignedLead?.assignedUserId === admin.id, "Lead Counsellor Assignment");
    } else {
      console.log("⚠️ SKIP: Admin user not found for assignment test");
    }
  } catch (e: any) {
    assert(false, "Lead Assignment", e.message);
  }

  // TEST 7: Call Record Logging
  try {
    const call = await logCall({
      leadId: testLeadA.id,
      counsellorId: admin?.id,
      outcome: "INTERESTED",
      durationSeconds: 240,
      notes: "Discussed batch pricing, student requested demo class",
    });
    const calls = await prisma.cRMCallRecord.findMany({ where: { leadId: testLeadA.id } });
    assert(calls.length > 0 && call.durationSeconds === 240, "Call Record Logging with Outcome & Duration");
  } catch (e: any) {
    assert(false, "Call Record Logging", e.message);
  }

  // TEST 8: Counselling Scheduling
  try {
    const counsellingDate = new Date(Date.now() + 86400000);
    const session = await scheduleCounselling({
      leadId: testLeadA.id,
      counsellorId: admin?.id,
      scheduledAt: counsellingDate,
      mode: "GOOGLE_MEET",
      notes: "Explain 1-on-1 mentor guidance",
    });
    assert(session.mode === "GOOGLE_MEET", "1-on-1 Counselling Scheduling");
  } catch (e: any) {
    assert(false, "Counselling Scheduling", e.message);
  }

  // TEST 9: Follow-up Tasks Queue
  try {
    const followUps = await getFollowUps({ dateFilter: "all" });
    assert(Array.isArray(followUps), "Follow-up Task Queue Retrieval");
  } catch (e: any) {
    assert(false, "Follow-up Queue", e.message);
  }

  // TEST 10: Deduplication & Merge Operation
  try {
    // Create duplicate lead B with same phone
    testLeadB = await createLead(
      {
        name: "Test Aspirant Duplicate",
        phone: "+919999900001",
        email: "aspirant.b@testcrm.com",
        targetExam: "NEET",
      },
      admin?.id
    );

    const mergeResult = await mergeLeads(testLeadA.id, testLeadB.id, admin?.id);
    const mergedB = await prisma.cRMLead.findUnique({ where: { id: testLeadB.id } });
    assert(
      mergeResult.success && mergedB?.status === CRMLeadStatus.DUPLICATE && mergedB?.duplicateOfId === testLeadA.id,
      "Duplicate Lead Detection & History-Preserving Merge"
    );
  } catch (e: any) {
    assert(false, "Deduplication & Merge", e.message);
  }

  // TEST 11: Admission Conversion & LMS Batch Enrollment
  try {
    if (batch) {
      const admission = await convertLeadToAdmission({
        leadId: testLeadA.id,
        batchId: batch.id,
        courseFee: 30000,
        discount: 5000,
        finalAmount: 25000,
        paymentTransactionId: "TEST_PAY_TX_9999",
        performedById: admin?.id,
      });

      const convertedLead = await prisma.cRMLead.findUnique({ where: { id: testLeadA.id } });
      const enrollment = await prisma.batchEnrollment.findFirst({
        where: { batchId: batch.id, studentId: admission.studentId },
      });

      assert(
        convertedLead?.isConverted === true &&
          convertedLead?.status === CRMLeadStatus.ENROLLED &&
          enrollment?.status === "ACTIVE",
        "Lead to LMS Admission & Batch Enrollment Integration"
      );
    } else {
      console.log("⚠️ SKIP: No batch available for admission test");
    }
  } catch (e: any) {
    assert(false, "Admission & Enrollment Integration", e.message);
  }

  // TEST 12: Real Database Dashboard Metrics
  try {
    const metrics = await getCrmDashboardMetrics();
    assert(
      metrics.kpis.totalLeads > 0 &&
        Array.isArray(metrics.funnel) &&
        metrics.funnel.length > 0 &&
        Array.isArray(metrics.sourceCounts),
      "Real Database Dashboard Metrics & Acquisition Funnel"
    );
  } catch (e: any) {
    assert(false, "Dashboard Metrics", e.message);
  }

  // Clean up test leads
  try {
    if (testLeadB) await prisma.cRMLead.delete({ where: { id: testLeadB.id } }).catch(() => {});
    if (testLeadA) await prisma.cRMLead.delete({ where: { id: testLeadA.id } }).catch(() => {});
  } catch {
    // cleanup
  }

  console.log("\n=================================================");
  console.log(`📊 TEST RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log("=================================================\n");

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTestSuite()
  .catch((err) => {
    console.error("Test execution fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
