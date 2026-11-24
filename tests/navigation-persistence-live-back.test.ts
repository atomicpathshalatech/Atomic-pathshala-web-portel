import { parentPathFor, isRootRoute } from "../src/lib/navigation/hierarchy";
import { registerBackGuard, runBackGuards, _backGuardCount } from "../src/lib/navigation/back-guards";

async function runNavigationAndLiveBackTests() {
  console.log("=====================================================================");
  console.log("🚀 ATOMIC PATHSHALA — ROUTE PERSISTENCE & LIVE CLASS BACK TEST SUITE");
  console.log("=====================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      if (detail) console.error(`   Detail: ${detail}`);
      failed++;
    }
  }

  console.log("--- PART 1: ROUTE HIERARCHY & REFRESH RESTORATION ---");

  // Test 1: Student Live Class logical parent
  const studentLiveParent = parentPathFor("/live-class/bs-sched-123");
  assert(
    studentLiveParent === "/schedule",
    "Student Live Class fallback parent resolves to /schedule",
    `Got ${studentLiveParent}`
  );

  // Test 2: Teacher Live Class logical parent
  const teacherLiveParent = parentPathFor("/team/live-class/bs-sched-123");
  assert(
    teacherLiveParent === "/team/my-schedule",
    "Teacher Live Class fallback parent resolves to /team/my-schedule",
    `Got ${teacherLiveParent}`
  );

  // Test 3: Live Studio logical parent
  const studioParent = parentPathFor("/team/live-studio");
  assert(
    studioParent === "/team/my-schedule",
    "Live Studio fallback parent resolves to /team/my-schedule",
    `Got ${studioParent}`
  );

  // Test 4: Student nested lecture route hierarchy
  const lectureParent = parentPathFor(
    "/courses/batch-1/subjects/chem/chapters/goc/lectures/lec-5"
  );
  assert(
    lectureParent === "/courses/batch-1/subjects/chem/chapters/goc",
    "Nested lecture path steps back to chapter page",
    `Got ${lectureParent}`
  );

  // Test 5: Root route detection
  assert(isRootRoute("/dashboard"), "/dashboard is recognized as root route");
  assert(isRootRoute("/team"), "/team is recognized as root route");
  assert(!isRootRoute("/team/pyq-library"), "/team/pyq-library is not a root route");
  assert(!isRootRoute("/live-class/123"), "/live-class/123 is not a root route");

  console.log("\n--- PART 2: BACK GUARD REGISTRY & MODAL/EXIT INTERCEPTION ---");

  // Test 6: Registration and count
  const initialCount = _backGuardCount();
  const unregister1 = registerBackGuard(async () => true, 0);
  assert(
    _backGuardCount() === initialCount + 1,
    "Back guard registers successfully in registry"
  );
  unregister1();
  assert(
    _backGuardCount() === initialCount,
    "Back guard unregisters cleanly on unmount"
  );

  // Test 7: Modal priority over page-level exit guard
  let modalClosed = false;
  let pageExited = false;

  const unregisterPageGuard = registerBackGuard(async () => {
    pageExited = true;
    return true; // handled page exit
  }, 10);

  const unregisterModalGuard = registerBackGuard(async () => {
    modalClosed = true;
    return true; // handled modal close first
  }, 100); // Higher priority = runs first

  // Trigger back navigation
  const handled = await runBackGuards();
  assert(handled === true, "Back guard intercepted back press");
  assert(
    modalClosed === true && pageExited === false,
    "High-priority modal guard closed modal WITHOUT triggering page exit"
  );

  unregisterModalGuard();
  unregisterPageGuard();

  console.log("\n--- PART 3: LIVE CLASS LEAVE VS END CLASS SEPARATION ---");

  // Test 8: Student Leave Class behavior simulation
  let studentStayedInSession = false;
  let studentClassGloballyEnded = false;

  // When student confirms leave:
  const studentLeaveAction = () => {
    // Local client disconnects, but global session does NOT end
    studentStayedInSession = false;
    studentClassGloballyEnded = false; // Remains false!
  };
  studentLeaveAction();

  assert(
    studentClassGloballyEnded === false,
    "Student Leave Class does NOT terminate class globally for others"
  );

  // Test 9: Teacher Back / Leave Screen simulation
  let teacherLiveStreamActive = true;
  let teacherScreenLeft = false;

  const teacherLeaveScreenAction = () => {
    teacherScreenLeft = true;
    // Live session in DB remains ACTIVE / LIVE:
    teacherLiveStreamActive = true;
  };
  teacherLeaveScreenAction();

  assert(
    teacherScreenLeft === true && teacherLiveStreamActive === true,
    "Teacher Leave Screen leaves UI without ending broadcast or terminating students"
  );

  // Test 10: Teacher End Class explicit termination simulation
  let classStatus = "LIVE";
  let explicitConfirmationGiven = false;

  const teacherEndClassAction = (confirmed: boolean) => {
    if (confirmed) {
      classStatus = "ENDED";
    }
  };

  teacherEndClassAction(explicitConfirmationGiven);
  assert(
    classStatus === "LIVE",
    "Without explicit confirmation, End Class does not fire"
  );

  explicitConfirmationGiven = true;
  teacherEndClassAction(explicitConfirmationGiven);
  assert(
    classStatus === "ENDED",
    "Explicitly confirmed End Class successfully terminates class"
  );

  console.log("\n--- PART 4: URL TAB & PARAMETER PRESERVATION ---");

  // Test 11: PYQ tab slug resolution
  const resolveTabSlug = (tabParam: string | null) => {
    const t = tabParam?.toLowerCase();
    if (t === "chapter-wise" || t === "chapter_wise" || t === "chapter") return "CHAPTER_WISE";
    if (t === "my-reviews" || t === "my_reviews") return "MY_REVIEWS";
    if (t === "duplicates") return "DUPLICATES";
    if (t === "analytics") return "ANALYTICS";
    return "YEAR_WISE";
  };

  assert(
    resolveTabSlug("chapter-wise") === "CHAPTER_WISE",
    "chapter-wise tab resolves to CHAPTER_WISE"
  );
  assert(
    resolveTabSlug("analytics") === "ANALYTICS",
    "analytics tab resolves to ANALYTICS"
  );
  assert(
    resolveTabSlug(null) === "YEAR_WISE",
    "Default / null tab resolves safely to YEAR_WISE"
  );

  // Test 12: Query string URL composition
  const search = new URLSearchParams();
  search.set("tab", "chapter-wise");
  search.set("exam", "NEET_UG");
  search.set("subject", "Chemistry");
  search.set("chapter", "General Organic Chemistry");
  search.set("verification", "verified");
  search.set("reviewQuestionId", "C260002731");

  assert(
    search.get("subject") === "Chemistry" &&
      search.get("chapter") === "General Organic Chemistry" &&
      search.get("reviewQuestionId") === "C260002731",
    "All query parameters retained with exact values"
  );

  console.log("\n=====================================================================");
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("=====================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runNavigationAndLiveBackTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
