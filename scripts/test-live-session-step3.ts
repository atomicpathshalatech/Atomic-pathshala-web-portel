/**
 * Step 3 checks that need no database: the lifecycle transition table and
 * delivery-mode rules in src/lib/live-session/states.ts.
 *
 * Run: npx tsx scripts/test-live-session-step3.ts
 * DB-backed checks (concurrency, SQL invariants, extend, simulcast):
 *      scripts/test-live-session-step3-db.ts
 */
import {
  LIVE_SESSION_STATES,
  LIVE_TRANSITIONS,
  OPEN_STATES,
  TERMINAL_STATES,
  canTransition,
  deliveryModeFor,
  predecessorsOf,
  stateAfterEnd,
} from "../src/lib/live-session/states";

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

// ---- Transition table ------------------------------------------------------
assert(!canTransition("SCHEDULED", "LIVE"), "SCHEDULED cannot jump straight to LIVE");
assert(!canTransition("READY", "LIVE"), "READY cannot jump straight to LIVE (must pass STARTING)");
assert(canTransition("STARTING", "YOUTUBE_CONNECTING") && canTransition("YOUTUBE_CONNECTING", "YOUTUBE_ACTIVE") && canTransition("YOUTUBE_ACTIVE", "LIVE"), "YouTube path STARTING → CONNECTING → ACTIVE → LIVE");
assert(!canTransition("LIVE", "COMPLETED") && !canTransition("LIVE", "RECORDING_READY"), "LIVE must pass ENDING first");
assert(!canTransition("ENDING", "RECORDING_READY"), "Recording can't be READY straight from ENDING (YouTube must confirm)");
assert(canTransition("RECORDING_PROCESSING", "RECORDING_READY"), "RECORDING_PROCESSING → RECORDING_READY");
assert(canTransition("ENDING", "LIVE"), "Undo End Class allowed while ENDING");
assert(TERMINAL_STATES.every((s) => LIVE_TRANSITIONS[s].length === 0), "Terminal states have no way out");
assert(LIVE_SESSION_STATES.every((s) => s in LIVE_TRANSITIONS), "Every state has a transition entry");

const livePreds = predecessorsOf("LIVE").sort().join(",");
assert(livePreds === ["ENDING", "STARTING", "YOUTUBE_ACTIVE"].sort().join(","), "LIVE's CAS predecessors are exactly STARTING/YOUTUBE_ACTIVE/ENDING", livePreds);
assert(!OPEN_STATES.includes("RECORDING_PROCESSING"), "An ended class (recording processing) is not 'open' — a re-run may start");
assert(OPEN_STATES.includes("ENDING"), "ENDING is still open (one open occurrence per schedule)");

// ---- Delivery modes ---------------------------------------------------------
let d = deliveryModeFor({ videoTransport: "BOTH", youtubeBroadcastId: "B", youtubeVideoId: "B" });
assert(d.deliveryMode === "APP_YOUTUBE" && d.youtubeChannel === "APP", "Atomic-created broadcast → APP_YOUTUBE/APP");
d = deliveryModeFor({ videoTransport: "YOUTUBE", youtubeVideoId: "V" });
assert(d.deliveryMode === "EXTERNAL_YOUTUBE" && d.youtubeChannel === null, "Pasted id → EXTERNAL_YOUTUBE, no channel");
d = deliveryModeFor({ videoTransport: "YOUTUBE", youtubeVideoId: "V", verifiedMainChannel: true });
assert(d.deliveryMode === "MAIN_YOUTUBE" && d.youtubeChannel === "MAIN", "Verified MAIN video → MAIN_YOUTUBE/MAIN");
d = deliveryModeFor({ videoTransport: "YOUTUBE", verifiedMainChannel: true });
assert(d.deliveryMode === "LEGACY_LIVEKIT", "MAIN flag without a video id does not claim MAIN");
d = deliveryModeFor({ videoTransport: "LIVEKIT", youtubeBroadcastId: "B", youtubeVideoId: "B" });
assert(d.deliveryMode === "LEGACY_LIVEKIT" && d.youtubeChannel === null, "LiveKit transport ignores stray YouTube ids");

// ---- After END ---------------------------------------------------------------
assert(stateAfterEnd("APP_YOUTUBE", false) === "RECORDING_PROCESSING", "APP_YOUTUBE end → RECORDING_PROCESSING (never READY)");
assert(stateAfterEnd("MAIN_YOUTUBE", false) === "RECORDING_PROCESSING", "MAIN_YOUTUBE end → RECORDING_PROCESSING");
assert(stateAfterEnd("LEGACY_LIVEKIT", false) === "COMPLETED", "Room class without recording → COMPLETED");
assert(stateAfterEnd("LEGACY_LIVEKIT", true) === "RECORDING_PROCESSING", "Room class with Egress recording → RECORDING_PROCESSING");

console.log(`\n${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
