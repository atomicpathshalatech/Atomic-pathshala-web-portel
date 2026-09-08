/**
 * PRODUCTION LIVE MEDIA & SFU PLAYER TEST SUITE
 */

import { AccessToken, TokenVerifier } from "livekit-server-sdk";

// LiveKit constants
const LIVEKIT_API_KEY = "devkey";
const LIVEKIT_API_SECRET = "secret_key_1234567890_32_characters_long_for_test";

export function videoRoomName(whiteboardSessionId: string) {
  return `wb-session-${whiteboardSessionId}`;
}

export async function createTeacherPublisherToken(opts: {
  identity: string;
  name: string;
  roomName: string;
}) {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: opts.identity,
    name: opts.name,
    ttl: "4h",
  });
  at.addGrant({
    room: opts.roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  return at.toJwt();
}

export async function createStudentViewerToken(opts: {
  identity: string;
  name: string;
  roomName: string;
}) {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: opts.identity,
    name: opts.name,
    ttl: "4h",
  });
  at.addGrant({
    room: opts.roomName,
    roomJoin: true,
    canPublish: false,
    canSubscribe: true,
    canPublishData: false,
  });
  return at.toJwt();
}

export async function createApprovedSpeakerToken(opts: {
  identity: string;
  name: string;
  roomName: string;
  audioOnly: boolean;
}) {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: opts.identity,
    name: opts.name,
    ttl: "2h",
  });
  at.addGrant({
    room: opts.roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
  });
  return at.toJwt();
}

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`❌ [FAIL] ${testName} ${detail ? `-> ${detail}` : ""}`);
    failedCount++;
  }
}

async function runMediaTests() {
  console.log("================================================================================");
  console.log("🎥 RUNNING PRODUCTION LIVE MEDIA & SFU VIDEO PLAYER TEST SUITE");
  console.log("================================================================================\n");

  const sessionId = "session-test-media-101";
  const expectedRoomName = `wb-session-${sessionId}`;
  const verifier = new TokenVerifier(LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

  // ---------------------------------------------------------------------------
  // TEST 1: Deterministic Room Name Mapping
  // ---------------------------------------------------------------------------
  {
    const room = videoRoomName(sessionId);
    assert(
      room === expectedRoomName,
      "Test 1: videoRoomName produces deterministic room name matching session id",
      `Expected ${expectedRoomName}, got ${room}`
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Teacher Publisher Token Grants & Claims
  // ---------------------------------------------------------------------------
  {
    const token = await createTeacherPublisherToken({
      identity: "teacher-user-1",
      name: "Prof. Einstein",
      roomName: expectedRoomName,
    });

    const claims = await verifier.verify(token);

    assert(
      claims.sub === "teacher-user-1" &&
      claims.name === "Prof. Einstein" &&
      claims.video?.room === expectedRoomName &&
      claims.video?.roomJoin === true &&
      claims.video?.canPublish === true &&
      claims.video?.canSubscribe === true &&
      claims.video?.canPublishData === true,
      "Test 2: Teacher token has FULL PUBLISHER permissions (canPublish: true, canSubscribe: true)",
      JSON.stringify(claims.video)
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Student Viewer Token Grants & Claims (Zero Publish Privilege)
  // ---------------------------------------------------------------------------
  {
    const token = await createStudentViewerToken({
      identity: "student-user-1",
      name: "Alice Student",
      roomName: expectedRoomName,
    });

    const claims = await verifier.verify(token);

    assert(
      claims.sub === "student-user-1" &&
      claims.name === "Alice Student" &&
      claims.video?.room === expectedRoomName &&
      claims.video?.roomJoin === true &&
      claims.video?.canPublish === false &&
      claims.video?.canSubscribe === true &&
      claims.video?.canPublishData === false,
      "Test 3: Student viewer token has VIEW-ONLY permissions (canPublish: false, canSubscribe: true)",
      JSON.stringify(claims.video)
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 4: Approved Speaker Token (Hand-Raise Approved by Teacher)
  // ---------------------------------------------------------------------------
  {
    const token = await createApprovedSpeakerToken({
      identity: "student-user-speaker-1",
      name: "Bob Speaker",
      roomName: expectedRoomName,
      audioOnly: true,
    });

    const claims = await verifier.verify(token);

    assert(
      claims.sub === "student-user-speaker-1" &&
      claims.video?.room === expectedRoomName &&
      claims.video?.roomJoin === true &&
      claims.video?.canPublish === true &&
      claims.video?.canSubscribe === true,
      "Test 4: Approved Speaker token grants publishing permission dynamically",
      JSON.stringify(claims.video)
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 5: Security — Token Signed with Secret, Invalid Signature Fails
  // ---------------------------------------------------------------------------
  {
    const badVerifier = new TokenVerifier(LIVEKIT_API_KEY, "wrong_secret_key_12345678901234567");
    const validToken = await createStudentViewerToken({
      identity: "student-user-2",
      name: "Charlie",
      roomName: expectedRoomName,
    });

    let failed = false;
    try {
      await badVerifier.verify(validToken);
    } catch {
      failed = true;
    }

    assert(
      failed,
      "Test 5: Token security -> verification fails with wrong secret, protecting against forgery"
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 6: Unauthorized Student Elevation Protection
  // ---------------------------------------------------------------------------
  {
    const studentViewerToken = await createStudentViewerToken({
      identity: "student-user-3",
      name: "Dave",
      roomName: expectedRoomName,
    });

    const claims = await verifier.verify(studentViewerToken);

    assert(
      claims.video?.canPublish === false,
      "Test 6: Student cannot publish without explicit teacher approval token"
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 7: Token Expiration Validity
  // ---------------------------------------------------------------------------
  {
    const token = await createTeacherPublisherToken({
      identity: "teacher-user-1",
      name: "Prof. Einstein",
      roomName: expectedRoomName,
    });

    const claims = await verifier.verify(token);
    const nowSec = Math.floor(Date.now() / 1000);

    assert(
      claims.exp !== undefined && claims.exp > nowSec,
      "Test 7: Token contains valid future expiration timestamp",
      `exp=${claims.exp}, now=${nowSec}`
    );
  }

  console.log("\n================================================================================");
  console.log(`📊 MEDIA TEST RESULTS: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log("================================================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runMediaTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
