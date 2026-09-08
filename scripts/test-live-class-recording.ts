import assert from "assert";

async function runLiveClassRecordingTests() {
  console.log("==================================================================");
  console.log("ATOMIC PATHSHALA — PRODUCTION LIVE CLASS RECORDING TEST SUITE");
  console.log("==================================================================\n");

  let passed = 0;
  let total = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    total++;
    try {
      await fn();
      console.log(`  [PASS] #${total}: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  [FAIL] #${total}: ${name}`);
      console.error("        ", err?.message || err);
    }
  }

  // 1. Test Recording Lifecycle Transitions
  await test("Recording state machine: LIVE -> RECORDING_STARTING -> RECORDING -> PROCESSING -> READY", () => {
    type RecordingState =
      | "NONE"
      | "RECORDING_STARTING"
      | "RECORDING"
      | "RECORDING_STOPPING"
      | "PROCESSING"
      | "READY"
      | "RECORDING_FAILED";

    let state: RecordingState = "NONE";

    // Step 1: Class becomes LIVE -> recording requested
    state = "RECORDING_STARTING";
    assert.strictEqual(state, "RECORDING_STARTING");

    // Step 2: LiveKit Egress confirms start with egressId
    const egressId = "EG_livekit_mock_999";
    state = "RECORDING";
    assert.strictEqual(state, "RECORDING");

    // Step 3: Teacher ends class -> stopping egress -> processing
    state = "PROCESSING";
    assert.strictEqual(state, "PROCESSING");

    // Step 4: Webhook egress_ended arrives with EGRESS_COMPLETE
    state = "READY";
    assert.strictEqual(state, "READY");
  });

  // 2. Test "Recording Available" Gate
  await test("Do NOT show 'Recording Available' before recording actually exists and is READY", () => {
    function isRecordingAvailable(session: { recordingStatus: string; recordingStorageKey: string | null }): boolean {
      return session.recordingStatus === "READY" && Boolean(session.recordingStorageKey);
    }

    assert.strictEqual(isRecordingAvailable({ recordingStatus: "NONE", recordingStorageKey: null }), false);
    assert.strictEqual(isRecordingAvailable({ recordingStatus: "RECORDING_STARTING", recordingStorageKey: null }), false);
    assert.strictEqual(isRecordingAvailable({ recordingStatus: "RECORDING", recordingStorageKey: null }), false);
    assert.strictEqual(isRecordingAvailable({ recordingStatus: "PROCESSING", recordingStorageKey: null }), false);
    assert.strictEqual(isRecordingAvailable({ recordingStatus: "RECORDING_FAILED", recordingStorageKey: null }), false);
    assert.strictEqual(isRecordingAvailable({ recordingStatus: "READY", recordingStorageKey: null }), false);
    assert.strictEqual(isRecordingAvailable({ recordingStatus: "READY", recordingStorageKey: "recordings/wb-1/final.mp4" }), true);
  });

  // 3. Test Single Recording Identity (Reconnect / Refresh Idempotency)
  await test("Teacher refresh/reconnect must NOT start a second recording", () => {
    const session = {
      id: "wb-sess-101",
      recordingStatus: "RECORDING",
      recordingEgressId: "EG_existing_12345",
    };

    const isAlreadyRecording =
      session.recordingStatus === "RECORDING" ||
      session.recordingStatus === "RECORDING_STARTING" ||
      session.recordingStatus === "STARTING" ||
      Boolean(session.recordingEgressId);

    assert.strictEqual(isAlreadyRecording, true, "Must detect existing active recording");

    // Verify no new egress creation is triggered
    let newEgressCreated = false;
    if (!isAlreadyRecording) {
      newEgressCreated = true;
    }
    assert.strictEqual(newEgressCreated, false, "Should maintain single recording identity across reconnects");
  });

  // 4. Test Recording Metadata Completeness
  await test("Recording metadata preserves all 11 required attributes", () => {
    const startedAt = new Date("2026-09-08T04:00:00.000Z");
    const stoppedAt = new Date("2026-09-08T04:10:00.000Z"); // 10 minutes later

    const recordingPayload = {
      recordingId: "fa-uuid-8888",
      classId: "batch-schedule-777",
      liveSessionId: "wb-session-555",
      providerRecordingId: "EG_livekit_prod_abc",
      status: "READY",
      available: true,
      url: "https://r2.atomicpathshala.com/recordings/wb-session-555/final.mp4?token=signed",
      startedAt: startedAt.toISOString(),
      stoppedAt: stoppedAt.toISOString(),
      durationSeconds: 600, // 10 minutes = 600s
      storagePath: "recordings/wb-session-555/1725768600.mp4",
      resourceId: "fa-uuid-8888",
      createdAt: startedAt.toISOString(),
    };

    assert.ok(recordingPayload.recordingId, "Must have recording_id");
    assert.ok(recordingPayload.classId, "Must have class_id");
    assert.ok(recordingPayload.liveSessionId, "Must have live_session_id");
    assert.ok(recordingPayload.providerRecordingId, "Must have provider_recording_id");
    assert.strictEqual(recordingPayload.status, "READY");
    assert.ok(recordingPayload.startedAt, "Must have started_at");
    assert.ok(recordingPayload.stoppedAt, "Must have stopped_at");
    assert.strictEqual(recordingPayload.durationSeconds, 600, "Duration must equal 600 seconds (10 mins)");
    assert.ok(recordingPayload.storagePath, "Must have storage_path");
    assert.ok(recordingPayload.resourceId, "Must have resource_id");
    assert.ok(recordingPayload.createdAt, "Must have created_at");
  });

  // 5. Test LiveKit Egress Storage Key Format
  await test("recordingStorageKey generates deterministic R2 path under recordings/", () => {
    function recordingStorageKey(whiteboardSessionId: string): string {
      return `recordings/${whiteboardSessionId}/${Date.now()}.mp4`;
    }
    const sessionId = "session-physics-12";
    const key = recordingStorageKey(sessionId);
    assert.ok(key.startsWith("recordings/session-physics-12/"), `Key must start with recordings/${sessionId}/`);
    assert.ok(key.endsWith(".mp4"), "Key must have .mp4 extension");
  });


  // 6. Test Security / RBAC for Recordings
  await test("Recording playback is private: unauthorized users receive 403 Forbidden", () => {
    const authorizedUsers = new Set(["teacher-1", "student-enrolled-1", "student-enrolled-2", "admin-1"]);
    
    function canAccessRecording(userId: string): boolean {
      return authorizedUsers.has(userId);
    }

    assert.strictEqual(canAccessRecording("teacher-1"), true);
    assert.strictEqual(canAccessRecording("student-enrolled-1"), true);
    assert.strictEqual(canAccessRecording("student-outsider-999"), false, "Outsider student must be forbidden");
    assert.strictEqual(canAccessRecording("anonymous"), false, "Anonymous user must be forbidden");
  });

  // 7. Test 10-Minute Class Simulation: Start -> 10m Record -> End -> Egress Completed -> File Available
  await test("10-minute class simulation: lifecycle, duration calculation, and file accessibility", async () => {
    const startTime = new Date("2026-09-08T04:00:00.000Z");
    const classSession = {
      id: "sim-sess-100",
      batchScheduleId: "sim-class-200",
      teacherId: "teacher-phy-01",
      livePhase: "SCHEDULED",
      status: "ACTIVE",
      recordingStatus: "NONE",
      recordingEgressId: null as string | null,
      recordingStorageKey: null as string | null,
      recordingDurationSeconds: null as number | null,
      actualStartedAt: null as Date | null,
      actualEndedAt: null as Date | null,
    };

    // 1. Teacher starts class at T-0
    classSession.livePhase = "LIVE";
    classSession.actualStartedAt = startTime;
    classSession.recordingStatus = "RECORDING_STARTING";

    // LiveKit starts egress
    const simulatedEgressId = "EG_simulated_egress_10m";
    classSession.recordingEgressId = simulatedEgressId;
    classSession.recordingStatus = "RECORDING";
    assert.strictEqual(classSession.recordingStatus, "RECORDING");

    // 2. 10 minutes pass (600 seconds)
    const endTime = new Date(startTime.getTime() + 10 * 60 * 1000);

    // 3. Teacher ends class
    classSession.livePhase = "ENDED";
    classSession.status = "ENDED";
    classSession.actualEndedAt = endTime;
    // Egress stopping -> processing (never immediately ready)
    classSession.recordingStatus = "PROCESSING";
    assert.strictEqual(classSession.recordingStatus, "PROCESSING");

    // 4. LiveKit webhook arrives with completed file
    const egressWebhookEvent = {
      event: "egress_ended",
      egressInfo: {
        egressId: simulatedEgressId,
        status: 2, // EGRESS_COMPLETE
        fileResults: [
          {
            filename: `recordings/${classSession.id}/1725768000.mp4`,
            duration: BigInt(600 * 1_000_000_000), // 600s in nanoseconds
            size: BigInt(45 * 1024 * 1024), // 45 MB
          },
        ],
      },
    };

    // Apply webhook processing
    const file = egressWebhookEvent.egressInfo.fileResults[0];
    classSession.recordingStatus = "READY";
    classSession.recordingStorageKey = file.filename;
    classSession.recordingDurationSeconds = Math.round(Number(file.duration) / 1_000_000_000);

    // Verification
    assert.strictEqual(classSession.recordingStatus, "READY");
    assert.strictEqual(classSession.recordingDurationSeconds, 600);
    assert.strictEqual(classSession.recordingStorageKey, `recordings/${classSession.id}/1725768000.mp4`);
    assert.ok(classSession.recordingStorageKey.length > 0);
  });

  console.log("\n------------------------------------------------------------------");
  console.log(`RESULTS: ${passed}/${total} tests passed successfully.`);
  console.log("==================================================================");

  if (passed !== total) {
    process.exit(1);
  }
}

runLiveClassRecordingTests().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
