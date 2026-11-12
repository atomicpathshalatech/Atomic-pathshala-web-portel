import { createCanvas } from "@napi-rs/canvas";
import { CanvasEngine, StrokeObject } from "../src/lib/canvas/canvas-engine";
import { BoardSaveQueue, BoardSaveResult } from "../src/lib/whiteboard/board-save-queue";
import {
  validateAndSetSessionPageSwitchSeq,
  resetSessionPageSwitchSeq,
  getSessionPageSwitchSeq,
} from "../src/lib/whiteboard/session-sequence";

async function testRealWhiteboardEngineAndConcurrency() {
  console.log("=================================================");
  console.log("🖌️ REAL CANVAS ENGINE & SERVER CONCURRENCY TEST");
  console.log("=================================================\n");

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

  // -------------------------------------------------------------
  // TEST 1: Real CanvasEngine Coordinate Stability & Slide Cycling
  // -------------------------------------------------------------
  const baseCanvas = createCanvas(1920, 1080) as any;
  const activeCanvas = createCanvas(1920, 1080) as any;
  baseCanvas.style = {};
  activeCanvas.style = {};
  baseCanvas.addEventListener = () => {};
  activeCanvas.addEventListener = () => {};
  baseCanvas.removeEventListener = () => {};
  activeCanvas.removeEventListener = () => {};

  const engine = new CanvasEngine(baseCanvas, activeCanvas);

  const initialStroke: StrokeObject = {
    id: "stroke-init-1",
    type: "pen",
    tool: "pen",
    color: "#2563eb",
    size: 4,
    points: [
      { x: 150.5, y: 220.25, pressure: 0.5 },
      { x: 350.75, y: 480.5, pressure: 0.7 },
      { x: 550.0, y: 720.0, pressure: 0.9 },
    ],
  };

  let currentSlideObjects: StrokeObject[] = [initialStroke];

  // Run 10 rapid slide transition cycles through the REAL CanvasEngine
  for (let cycle = 1; cycle <= 10; cycle++) {
    engine.loadObjects(currentSlideObjects);
    const retrieved = engine.getObjects();
    currentSlideObjects = retrieved;
  }

  const finalObj = currentSlideObjects[0] as any;
  const origP0 = (initialStroke as any).points[0];
  const origP2 = (initialStroke as any).points[2];
  const finalP0 = finalObj.points[0];
  const finalP2 = finalObj.points[2];

  const driftX0 = Math.abs(finalP0.x - origP0.x);
  const driftY0 = Math.abs(finalP0.y - origP0.y);
  const driftX2 = Math.abs(finalP2.x - origP2.x);
  const driftY2 = Math.abs(finalP2.y - origP2.y);

  assert(
    driftX0 === 0 && driftY0 === 0 && driftX2 === 0 && driftY2 === 0,
    "Test 1: Zero coordinate drift (0.000%) across 10 cycles of real CanvasEngine loadObjects & getObjects",
    `driftX0=${driftX0}, driftY0=${driftY0}`
  );

  // -------------------------------------------------------------
  // TEST 2: Real Server-Side Sequence Validation (session-sequence)
  // -------------------------------------------------------------
  const testSessionId = `test_sess_${Date.now()}`;
  resetSessionPageSwitchSeq(testSessionId, 0);

  // Client request 1: seq 1 (switches to page 2)
  const req1 = validateAndSetSessionPageSwitchSeq(testSessionId, 1);
  assert(req1.ok && req1.currentSeq === 1, "Test 2.1: First sequence (seq: 1) accepted by server");

  // Client request 2: seq 2 (switches to page 3)
  const req2 = validateAndSetSessionPageSwitchSeq(testSessionId, 2);
  assert(req2.ok && req2.currentSeq === 2, "Test 2.2: Second sequence (seq: 2) accepted by server");

  // Out-of-order delayed request: seq 1 arrives AFTER seq 2 has been accepted
  const staleReq = validateAndSetSessionPageSwitchSeq(testSessionId, 1);
  assert(
    !staleReq.ok && staleReq.currentSeq === 2,
    "Test 2.3: Stale out-of-order request (seq: 1) strictly rejected (409 Conflict)",
    `Accepted seq remained at ${staleReq.currentSeq}`
  );

  // Next valid request: seq 3
  const nextReq = validateAndSetSessionPageSwitchSeq(testSessionId, 3);
  assert(nextReq.ok && nextReq.currentSeq === 3, "Test 2.4: Subsequent valid sequence (seq: 3) accepted");

  // -------------------------------------------------------------
  // TEST 3: BoardSaveQueue In-Flight Edits & Conflict Retries
  // -------------------------------------------------------------
  const savedPages = new Map<string, { objects: StrokeObject[]; version: number }>();
  let attemptCount = 0;
  let forceConflictOnce = true;
  let forceNetworkErrorOnce = true;

  const saveQueue = new BoardSaveQueue<StrokeObject>({
    send: async (pageId, objects, baseVersion) => {
      attemptCount++;

      // Simulate transient network failure on first try
      if (forceNetworkErrorOnce) {
        forceNetworkErrorOnce = false;
        throw new Error("Simulated network timeout");
      }

      // Simulate version conflict on second try
      if (forceConflictOnce) {
        forceConflictOnce = false;
        return { ok: false, conflictVersion: 5 };
      }

      const version = (baseVersion ?? 0) + 1;
      savedPages.set(pageId, { objects: [...objects], version });
      return { ok: true, version };
    },
    onSaved: () => {},
    onState: () => {},
    baseVersionOf: () => 1,
  });

  // Mark dirty for page 1
  saveQueue.markDirty("page-1", [{ id: "stroke-p1-v1", type: "pen", points: [{ x: 10, y: 10 }] } as any]);

  // Flush triggers drain -> fails on network error -> retry
  await saveQueue.flush().catch(() => {});

  // Add another edit while save is queued
  saveQueue.markDirty("page-1", [
    { id: "stroke-p1-v1", type: "pen", points: [{ x: 10, y: 10 }] },
    { id: "stroke-p1-v2", type: "pen", points: [{ x: 20, y: 20 }] },
  ] as any);

  // Mark dirty for page 2 (rapid slide switch test)
  saveQueue.markDirty("page-2", [{ id: "stroke-p2-v1", type: "pen", points: [{ x: 30, y: 30 }] } as any]);

  // Second flush recovers from version conflict and persists newest ink
  await saveQueue.flush();

  const p1Saved = savedPages.get("page-1");
  const p2Saved = savedPages.get("page-2");

  assert(
    p1Saved !== undefined && p1Saved.objects.length === 2 && p1Saved.objects[1].id === "stroke-p1-v2",
    "Test 3.1: SaveQueue preserved newest in-flight edits through network retry & version conflict"
  );
  assert(
    p2Saved !== undefined && p2Saved.objects[0].id === "stroke-p2-v1",
    "Test 3.2: Rapid slide navigation strokes for page-2 persisted without cross-page overwrite"
  );

  console.log(`\nWhiteboard Engine & Concurrency Results: ${passed} PASSED | ${failed} FAILED`);
  if (failed > 0) process.exit(1);
}

testRealWhiteboardEngineAndConcurrency();
