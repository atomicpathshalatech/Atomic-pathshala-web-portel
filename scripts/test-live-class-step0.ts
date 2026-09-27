/**
 * Step 0 live-class hotfix checks (no database, no YouTube, no Pusher).
 *
 * Run: npx tsx --conditions=react-server scripts/test-live-class-step0.ts
 *
 * DATABASE_URL is forced to an unreachable host before anything imports
 * Prisma, so a code path that unexpectedly queries the DB fails here instead
 * of touching a real database.
 */
process.env.DATABASE_URL = "postgresql://nobody:nothing@127.0.0.1:1/step0_test_must_not_connect";
process.env.AUTH_SECRET = process.env.AUTH_SECRET || "step0-test-secret";

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passCount++;
  } else {
    console.error(`❌ FAIL: ${testName}${detail ? ` - ${detail}` : ""}`);
    failCount++;
  }
}

async function run() {
  const { effectiveClassEnd, isPastGracePeriod } = await import("../src/lib/whiteboard/lifecycle");
  const { isNonRetryableYoutubeError } = await import("../src/lib/youtube/live-broadcast");
  const { createBroadcastToken, verifyBroadcastToken } = await import("../src/lib/live-class/broadcast-token");
  const { GET: obsStageGET } = await import("../src/app/api/live-class/obs-stage/[scheduleId]/route");
  const { NextRequest } = await import("next/server");

  // ---- Extend class: auto-end honours the extended end -------------------
  const scheduleEnd = new Date("2026-09-27T10:00:00Z");
  const extendedEnd = new Date("2026-09-27T10:30:00Z");
  const at1015 = new Date("2026-09-27T10:15:00Z"); // past original end + 10 min grace
  assert(
    isPastGracePeriod(scheduleEnd, at1015) === true,
    "Original end alone would force-end at 10:15 (reproduces the bug)"
  );
  assert(
    isPastGracePeriod(effectiveClassEnd(scheduleEnd, extendedEnd), at1015) === false,
    "Extended class is NOT auto-ended at the old end time"
  );
  assert(
    isPastGracePeriod(effectiveClassEnd(scheduleEnd, extendedEnd), new Date("2026-09-27T10:41:00Z")) === true,
    "Extended class IS auto-ended after the new end + grace"
  );
  assert(
    effectiveClassEnd(scheduleEnd, null).getTime() === scheduleEnd.getTime(),
    "No session end falls back to schedule end"
  );
  assert(
    effectiveClassEnd(scheduleEnd, new Date("2026-09-27T09:00:00Z")).getTime() === scheduleEnd.getTime(),
    "An earlier session end never shortens the class"
  );

  // ---- Quota-aware retry classification ----------------------------------
  const quotaErr = new Error(
    'YouTube API /liveBroadcasts failed (403): {"error":{"errors":[{"reason":"quotaExceeded"}]}}'
  );
  const permErr = new Error('YouTube API /liveBroadcasts failed (403): {"reason":"insufficientLivePermissions"}');
  const invalidErr = new Error('YouTube API /liveBroadcasts failed (400): {"reason":"invalidScheduledStartTime"}');
  assert(isNonRetryableYoutubeError(quotaErr), "quotaExceeded is never retried");
  assert(isNonRetryableYoutubeError(permErr), "insufficientLivePermissions is never retried");
  assert(!isNonRetryableYoutubeError(invalidErr), "Validation errors still fall through to the next config tier");

  // ---- OBS stage token binding (rejected before any DB access) -----------
  const tokenA = createBroadcastToken("schedule-A", "teacher-user-1");
  assert(verifyBroadcastToken(tokenA)?.scheduleId === "schedule-A", "Token verifies for the class it was minted for");

  const call = (scheduleId: string, token: string | null) =>
    obsStageGET(
      new NextRequest(
        `https://example.test/api/live-class/obs-stage/${scheduleId}${token !== null ? `?token=${encodeURIComponent(token)}` : ""}`
      ),
      { params: { scheduleId } }
    );

  const noToken = await call("schedule-A", null);
  assert(noToken.status === 401, "Stage without a token is rejected (was: served board + quiz answers)", `got ${noToken.status}`);

  const badToken = await call("schedule-A", "garbage.token");
  assert(badToken.status === 401, "Stage with a forged token is rejected", `got ${badToken.status}`);

  const crossClass = await call("schedule-B", tokenA);
  assert(crossClass.status === 401, "Class A token used on Class B is rejected", `got ${crossClass.status}`);

  console.log(`\n${passCount} passed, ${failCount} failed`);
  if (failCount > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
