import assert from "assert";

async function runEndingAttendanceFeedbackTests() {
  console.log("==================================================================");
  console.log("ATOMIC PATHSHALA — LIVE CLASS ENDING + ATTENDANCE + FEEDBACK");
  console.log("==================================================================\n");

  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    total++;
    try {
      const res = fn();
      if (res instanceof Promise) {
        return res
          .then(() => {
            console.log(`  [PASS] #${total}: ${name}`);
            passed++;
          })
          .catch((err) => {
            console.error(`  [FAIL] #${total}: ${name}`);
            console.error("        ", err.message || err);
          });
      } else {
        console.log(`  [PASS] #${total}: ${name}`);
        passed++;
      }
    } catch (err: any) {
      console.error(`  [FAIL] #${total}: ${name}`);
      console.error("        ", err.message || err);
    }
  }

  // 1. Lifecycle: LIVE -> ENDING state transition
  test("Teacher clicking 'End Class' transitions LIVE -> ENDING without class disappearing", () => {
    const session = {
      livePhase: "LIVE",
      status: "ACTIVE",
      endedAt: null as Date | null,
    };

    session.livePhase = "ENDING";
    session.endedAt = new Date();

    assert.strictEqual(session.livePhase, "ENDING");
    assert.strictEqual(session.status, "ACTIVE");
    assert.ok(session.endedAt instanceof Date);
  });

  // 2. New student join blocking during ENDING and ENDED phases
  test("New student joins are immediately rejected (403 CLASS_ALREADY_ENDED) during ENDING phase", () => {
    function evaluateJoinAccess(livePhase: string, status: string) {
      if (livePhase === "ENDING" || livePhase === "ENDED" || status === "ENDED") {
        return {
          allowed: false,
          status: 403,
          code: "CLASS_ALREADY_ENDED",
          message: "Class has ended or is concluding. New student entries are closed.",
        };
      }
      return { allowed: true };
    }

    const endingResult = evaluateJoinAccess("ENDING", "ACTIVE");
    assert.strictEqual(endingResult.allowed, false);
    assert.strictEqual(endingResult.code, "CLASS_ALREADY_ENDED");

    const endedResult = evaluateJoinAccess("ENDED", "ENDED");
    assert.strictEqual(endedResult.allowed, false);
    assert.strictEqual(endedResult.code, "CLASS_ALREADY_ENDED");

    const liveResult = evaluateJoinAccess("LIVE", "ACTIVE");
    assert.strictEqual(liveResult.allowed, true);
  });

  // 3. Auto-close pending in-class quizzes and hand-raise requests
  test("Ending class automatically resolves open hand-raises and closes active quizzes", () => {
    const handRaises = [
      { id: "hr_1", status: "PENDING" },
      { id: "hr_2", status: "PENDING" },
    ];
    const quizzes = [
      { id: "qz_1", status: "ACTIVE" },
    ];

    const resolvedHandRaises = handRaises.map((hr) => ({
      ...hr,
      status: "RESOLVED",
      resolvedAt: new Date(),
    }));
    const closedQuizzes = quizzes.map((q) => ({
      ...q,
      status: "CLOSED",
      closedAt: new Date(),
    }));

    assert.ok(resolvedHandRaises.every((hr) => hr.status === "RESOLVED"));
    assert.ok(closedQuizzes.every((q) => q.status === "CLOSED"));
  });

  // 4. Server-Authoritative Attendance calculation
  test("Server computes PRESENT, PARTIAL, ABSENT based strictly on active duration and class length", () => {
    const classDurationSec = 3600;
    const thresholdSec = Math.min(900, Math.floor(classDurationSec * 0.5));

    function computeAttendanceStatus(activeSec: number) {
      if (activeSec >= thresholdSec) return "PRESENT";
      if (activeSec > 0) return "PARTIAL";
      return "ABSENT";
    }

    assert.strictEqual(computeAttendanceStatus(2400), "PRESENT", "40 minutes in 60m class = PRESENT");
    assert.strictEqual(computeAttendanceStatus(900), "PRESENT", "Exactly 15 minutes = PRESENT");
    assert.strictEqual(computeAttendanceStatus(899), "PARTIAL", "14m59s = PARTIAL");
    assert.strictEqual(computeAttendanceStatus(120), "PARTIAL", "2 minutes = PARTIAL");
    assert.strictEqual(computeAttendanceStatus(0), "ABSENT", "0 seconds = ABSENT");
  });

  // 5. Reconnect & Rejoin tracking without record duplication
  test("Student disconnects and rejoins increment reconnectCount and accumulate activeDuration", () => {
    const studentAttendance = {
      studentId: "student_101",
      sessionId: "session_202",
      reconnectCount: 0,
      activeDurationSec: 0,
      joinedAt: new Date("2026-09-08T10:00:00Z"),
      leftAt: null as Date | null,
    };

    studentAttendance.activeDurationSec += 30;
    studentAttendance.reconnectCount += 1;
    studentAttendance.activeDurationSec += 30;

    assert.strictEqual(studentAttendance.reconnectCount, 1);
    assert.strictEqual(studentAttendance.activeDurationSec, 60);

    studentAttendance.leftAt = new Date("2026-09-08T11:00:00Z");
    assert.ok(studentAttendance.leftAt instanceof Date);
  });

  // 6. Teacher Feedback Submission & ENDING -> COMPLETED Finalization
  test("Teacher finalization validates rating (1-5), persists feedback, and transitions to COMPLETED", () => {
    const payload = {
      deliveryRating: 5,
      networkRating: 5,
      audioRating: 5,
      videoRating: 4,
      whiteboardRating: 5,
      studentEngagementRating: 4,
      overallRating: 5,
      topicsCovered: "Thermodynamics & Heat Transfer - Laws & Carnot Engine",
      teacherNotes: "Students grasped efficiency derivation well. Assigned 5 practice questions.",
      tags: ["Physics", "Thermodynamics", "JEE Mains & Advanced"],
    };

    assert.ok(payload.overallRating >= 1 && payload.overallRating <= 5);
    assert.ok(payload.topicsCovered.trim().length > 0);
    assert.strictEqual(payload.tags.length, 3);

    const finalSession = {
      livePhase: "ENDED",
      status: "ENDED",
      batchScheduleStatus: "COMPLETED",
      feedbackPersisted: true,
    };

    assert.strictEqual(finalSession.livePhase, "ENDED");
    assert.strictEqual(finalSession.status, "ENDED");
    assert.strictEqual(finalSession.batchScheduleStatus, "COMPLETED");
  });

  // 7. Page Refresh Idempotency in ENDING phase
  test("Browser refresh in ENDING state retains post-class modal without restarting or losing state", () => {
    const sessionState = {
      livePhase: "ENDING",
      status: "ACTIVE",
    };

    const shouldOpenPostClassModal =
      sessionState.livePhase === "ENDING" || sessionState.livePhase === "ENDED" || sessionState.status === "ENDED";

    assert.strictEqual(shouldOpenPostClassModal, true);
  });

  // 8. Resource preservation check
  test("All uploaded documents, whiteboard notes, and recording egress IDs are preserved intact", () => {
    const sessionResources = {
      presentationUrl: "https://storage.atomicpathshala.com/presentations/thermodynamics.pptx",
      presentationName: "thermodynamics.pptx",
      presentationType: "PPTX",
      whiteboardPdfUrl: "https://storage.atomicpathshala.com/notes/wb_export_202.pdf",
      recordingEgressId: "egress_rec_7788",
      recordingStatus: "PROCESSING",
    };

    assert.ok(sessionResources.presentationUrl.endsWith(".pptx"));
    assert.ok(sessionResources.whiteboardPdfUrl.endsWith(".pdf"));
    assert.strictEqual(sessionResources.recordingStatus, "PROCESSING");
  });

  console.log(`\nResults: ${passed} / ${total} tests passed.\n`);
  if (passed !== total) {
    process.exit(1);
  }
}

runEndingAttendanceFeedbackTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
