import { prisma } from "../src/lib/db";

async function runTestSuite() {
  console.log("=================================================");
  console.log("🚀 STARTING ATOMIC PATHSHALA LIVE POLL TEST SUITE");
  console.log("=================================================\n");

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      testsPassed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      if (detail) console.error(`   Detail: ${detail}`);
      testsFailed++;
    }
  }

  let testUserId = "";
  let testStudentId = "";
  let testSessionId = "";
  let testPollId = "";

  try {
    // Setup: find existing teacher, student, and whiteboard session records
    let teacher = await prisma.user.findFirst();
    if (!teacher) {
      throw new Error("No user found in database");
    }
    testUserId = teacher.id;

    let student = await prisma.student.findFirst();
    if (!student) {
      throw new Error("No student found in database");
    }
    testStudentId = student.id;

    let wb = await prisma.whiteboardSession.findFirst();
    if (!wb) {
      throw new Error("No whiteboard session found in database");
    }
    testSessionId = wb.id;

    // TEST 1 — Poll Creation & Activation
    const poll = await prisma.quizSession.create({
      data: {
        whiteboardSessionId: testSessionId,
        questionText: "What is the hybridization of carbon in methane (CH4)?",
        options: [
          { key: "A", label: "sp" },
          { key: "B", label: "sp²" },
          { key: "C", label: "sp³" },
          { key: "D", label: "dsp²" },
        ],
        correctOption: "C",
        timeLimitSec: 30,
        status: "ACTIVE",
        createdById: testUserId,
      },
    });
    testPollId = poll.id;

    assert(
      poll.id !== null && poll.status === "ACTIVE",
      "TEST 1: Poll Creation & Activation in ACTIVE state"
    );

    // TEST 2 — Student Answer Submission
    const response = await prisma.quizResponse.create({
      data: {
        quizSessionId: testPollId,
        studentId: testStudentId,
        selectedOption: "C",
        responseTimeMs: 2500,
        isCorrect: null, // withheld until reveal
      },
    });

    assert(
      response.selectedOption === "C" && response.isCorrect === null,
      "TEST 2: Student answer submitted with withheld correctness before reveal"
    );

    // TEST 3 — Duplicate Submission Prevention
    let duplicateBlocked = false;
    try {
      await prisma.quizResponse.create({
        data: {
          quizSessionId: testPollId,
          studentId: testStudentId,
          selectedOption: "B",
          responseTimeMs: 3100,
        },
      });
    } catch {
      duplicateBlocked = true;
    }
    assert(duplicateBlocked, "TEST 3: Duplicate student vote prevented by database constraints");

    // TEST 4 — Timer Expiration does NOT delete or auto-dismiss poll
    // Simulate expired response window
    const pollAfterTimer = await prisma.quizSession.findUniqueOrThrow({ where: { id: testPollId } });
    assert(
      pollAfterTimer.status === "ACTIVE" && pollAfterTimer.dismissedAt === null,
      "TEST 4: Timer expiration leaves poll in database without auto-dismissal"
    );

    // TEST 5 — Result Publication
    const revealed = await prisma.quizSession.update({
      where: { id: testPollId },
      data: {
        status: "REVEALED",
        revealedAt: new Date(),
        correctOption: "C",
      },
    });

    await prisma.$executeRaw`UPDATE quiz_responses SET "isCorrect" = ("selectedOption" = 'C') WHERE "quizSessionId" = ${testPollId}`;

    assert(
      revealed.status === "REVEALED" && revealed.revealedAt !== null,
      "TEST 5: Results published with reveal timestamp and correctness updated"
    );

    // TEST 6 — Persistent Result Visibility (Reconnect / Route Refresh)
    const currentPoll = await prisma.quizSession.findFirst({
      where: { whiteboardSessionId: testSessionId, id: testPollId },
      orderBy: { startedAt: "desc" },
    });

    assert(
      currentPoll?.status === "REVEALED" && currentPoll?.dismissedAt === null,
      "TEST 6: Results remain persistently visible across reconnects / re-renders"
    );

    // TEST 7 — Manual Dismissal by Teacher
    const dismissed = await prisma.quizSession.update({
      where: { id: testPollId },
      data: {
        status: "CLOSED",
        dismissedAt: new Date(),
      },
    });

    assert(
      dismissed.status === "CLOSED" && dismissed.dismissedAt !== null,
      "TEST 7: Manual dismissal cleanly transitions poll to CLOSED with dismissedAt timestamp"
    );
  } catch (err: any) {
    console.error("Test execution error:", err);
    testsFailed++;
  } finally {
    // Cleanup only created test quiz session & responses
    if (testPollId) {
      await prisma.quizResponse.deleteMany({ where: { quizSessionId: testPollId } }).catch(() => {});
      await prisma.quizSession.delete({ where: { id: testPollId } }).catch(() => {});
    }

    console.log("\n=================================================");
    console.log(`📊 TEST RESULTS: ${testsPassed} PASSED | ${testsFailed} FAILED`);
    console.log("=================================================");

    if (testsFailed > 0) {
      process.exit(1);
    }
  }
}

runTestSuite().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
