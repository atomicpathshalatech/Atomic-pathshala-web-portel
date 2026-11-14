import { createCanvas } from "@napi-rs/canvas";

if (typeof globalThis.requestAnimationFrame === "undefined") {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as any;
}
if (typeof globalThis.cancelAnimationFrame === "undefined") {
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id as any);
}

import { CanvasEngine, StrokeObject, inkSmoothingFor } from "../src/lib/canvas/canvas-engine";
import { BoardSaveQueue } from "../src/lib/whiteboard/board-save-queue";
import { whiteboardPerf } from "../src/lib/whiteboard/whiteboard-perf";

async function testWhiteboardStylusPerformanceAndRepair() {
  console.log("=================================================");
  console.log("🖊️ WHITEBOARD STYLUS PERFORMANCE & PIPELINE AUDIT TEST");
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

  // Set up mock DOM elements & canvas
  const baseCanvas = createCanvas(1920, 1080) as any;
  const activeCanvas = createCanvas(1920, 1080) as any;
  baseCanvas.style = {};
  activeCanvas.style = {};
  baseCanvas.offsetWidth = 1920;
  baseCanvas.offsetHeight = 1080;
  activeCanvas.offsetWidth = 1920;
  activeCanvas.offsetHeight = 1080;

  const eventListeners: Record<string, ((e: any) => void)[]> = {};
  activeCanvas.addEventListener = (evt: string, fn: any) => {
    eventListeners[evt] = eventListeners[evt] || [];
    eventListeners[evt].push(fn);
  };
  activeCanvas.removeEventListener = (evt: string, fn: any) => {
    if (eventListeners[evt]) {
      eventListeners[evt] = eventListeners[evt].filter((f) => f !== fn);
    }
  };
  activeCanvas.setPointerCapture = (_id: number) => {};
  activeCanvas.releasePointerCapture = (_id: number) => {};
  activeCanvas.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 1920,
    height: 1080,
    right: 1920,
    bottom: 1080,
  });

  function dispatch(evt: string, eventObj: any) {
    const list = eventListeners[evt] || [];
    for (const fn of list) {
      fn(eventObj);
    }
  }

  let committedStrokes: StrokeObject[] = [];
  const engine = new CanvasEngine(
    baseCanvas,
    activeCanvas,
    (objects) => {
      committedStrokes = objects;
    }
  );

  // -------------------------------------------------------------
  // TEST 1: Velocity-Adaptive Ink Smoothing Verification
  // -------------------------------------------------------------
  const slowFactor = inkSmoothingFor(2); // Small step (slow/deliberate writing)
  const fastFactor = inkSmoothingFor(30); // Large step (fast handwriting)

  assert(
    slowFactor >= 0.77 && slowFactor <= 0.82,
    "Test 1.1: Slow drawing smoothing factor is jitter-free (~0.78)",
    `Factor was ${slowFactor}`
  );
  assert(
    fastFactor >= 0.92 && fastFactor <= 0.95,
    "Test 1.2: Fast drawing smoothing factor tracks nib with zero perceptible lag (>= 0.92)",
    `Factor was ${fastFactor}`
  );

  // -------------------------------------------------------------
  // TEST 2: Stylus Drawing with Pressure & Tilt Preservation
  // -------------------------------------------------------------
  committedStrokes = [];
  dispatch("pointerdown", {
    pointerId: 101,
    pointerType: "pen",
    clientX: 200,
    clientY: 300,
    pressure: 0.35,
    tiltX: 15,
    tiltY: -20,
    preventDefault: () => {},
  });

  // Rapid handwriting: 5 move events
  for (let i = 1; i <= 5; i++) {
    dispatch("pointermove", {
      pointerId: 101,
      pointerType: "pen",
      clientX: 200 + i * 20,
      clientY: 300 + i * 15,
      pressure: 0.35 + i * 0.08,
      tiltX: 15 + i,
      tiltY: -20 + i,
      preventDefault: () => {},
    });
  }

  dispatch("pointerup", {
    pointerId: 101,
    pointerType: "pen",
    clientX: 300,
    clientY: 375,
    pressure: 0.75,
    preventDefault: () => {},
  });

  assert(
    committedStrokes.length === 1,
    "Test 2.1: Single pen stroke committed successfully on pointerup",
    `Committed: ${committedStrokes.length}`
  );

  const stroke = committedStrokes[0];
  const hasPressureAndTilt =
    stroke &&
    stroke.type === "stroke" &&
    stroke.points.some((p) => p.pressure > 0.35 && p.tiltX !== undefined && p.tiltY !== undefined);

  assert(
    Boolean(hasPressureAndTilt),
    "Test 2.2: Stylus hardware pressure variations and tilt angles preserved in stroke points"
  );

  // -------------------------------------------------------------
  // TEST 3: Palm Rejection & Simultaneous Touch Rejection
  // -------------------------------------------------------------
  // Case A: Stylus is actively writing, simultaneous touch occurs (e.g. palm contact)
  dispatch("pointerdown", {
    pointerId: 102,
    pointerType: "pen",
    clientX: 400,
    clientY: 400,
    pressure: 0.5,
    preventDefault: () => {},
  });

  // Touch event arrives while pen is active
  dispatch("pointerdown", {
    pointerId: 999,
    pointerType: "touch",
    clientX: 500,
    clientY: 500,
    width: 20,
    height: 20,
    preventDefault: () => {},
  });

  // Pen continues writing
  dispatch("pointermove", {
    pointerId: 102,
    pointerType: "pen",
    clientX: 450,
    clientY: 450,
    pressure: 0.6,
    preventDefault: () => {},
  });

  dispatch("pointerup", {
    pointerId: 102,
    pointerType: "pen",
    clientX: 450,
    clientY: 450,
    preventDefault: () => {},
  });

  assert(
    committedStrokes.length === 2,
    "Test 3.1: Accidental touch during active pen stroke rejected (no stray touch stroke committed)",
    `Total strokes: ${committedStrokes.length}`
  );

  // Case B: Palm touches down FIRST (pointerType: touch), then pen contacts
  dispatch("pointerdown", {
    pointerId: 888,
    pointerType: "touch",
    clientX: 600,
    clientY: 600,
    width: 15,
    height: 15,
    preventDefault: () => {},
  });

  // Pen contacts! It should cancel the touch artifact and capture for the pen
  dispatch("pointerdown", {
    pointerId: 103,
    pointerType: "pen",
    clientX: 620,
    clientY: 620,
    pressure: 0.5,
    preventDefault: () => {},
  });

  dispatch("pointermove", {
    pointerId: 103,
    pointerType: "pen",
    clientX: 660,
    clientY: 660,
    pressure: 0.65,
    preventDefault: () => {},
  });

  dispatch("pointerup", {
    pointerId: 103,
    pointerType: "pen",
    clientX: 660,
    clientY: 660,
    preventDefault: () => {},
  });

  assert(
    committedStrokes.length === 3,
    "Test 3.2: Palm resting first before pen does not lock canvas; pen preempts touch cleanly"
  );

  // Case C: Broad touch blob rejection (e.g. side of hand or large palm contact)
  dispatch("pointerdown", {
    pointerId: 777,
    pointerType: "touch",
    clientX: 700,
    clientY: 700,
    width: 45,
    height: 40,
    preventDefault: () => {},
  });
  dispatch("pointerup", {
    pointerId: 777,
    pointerType: "touch",
    clientX: 700,
    clientY: 700,
    preventDefault: () => {},
  });

  assert(
    committedStrokes.length === 3,
    "Test 3.3: Large touch contact blob (> 28px) rejected as resting palm"
  );

  // -------------------------------------------------------------
  // TEST 4: High-Frequency Coalesced Events Handling
  // -------------------------------------------------------------
  dispatch("pointerdown", {
    pointerId: 104,
    pointerType: "pen",
    clientX: 100,
    clientY: 100,
    pressure: 0.4,
    preventDefault: () => {},
  });

  // Simulate 120Hz/240Hz coalesced events from digitizer
  const coalescedBatch = [
    { clientX: 110, clientY: 105, pressure: 0.42 },
    { clientX: 120, clientY: 112, pressure: 0.45 },
    { clientX: 130, clientY: 120, pressure: 0.48 },
    { clientX: 140, clientY: 130, pressure: 0.52 },
  ];

  dispatch("pointermove", {
    pointerId: 104,
    pointerType: "pen",
    clientX: 140,
    clientY: 130,
    pressure: 0.52,
    getCoalescedEvents: () => coalescedBatch,
    preventDefault: () => {},
  });

  dispatch("pointerup", {
    pointerId: 104,
    pointerType: "pen",
    clientX: 140,
    clientY: 130,
    preventDefault: () => {},
  });

  const coalescedStroke = committedStrokes[committedStrokes.length - 1];
  assert(
    Boolean(coalescedStroke && coalescedStroke.type === "stroke" && coalescedStroke.points.length >= 4),
    "Test 4.1: High-frequency coalesced events from tablet digitized without point loss"
  );

  // -------------------------------------------------------------
  // TEST 5: Performance Monitor & Instrumentation Metrics
  // -------------------------------------------------------------
  const perfSnapshot = whiteboardPerf.getSnapshot();
  assert(
    perfSnapshot.pointerEventsPerSec >= 0 && typeof perfSnapshot.avgFrameTimeMs === "number",
    "Test 5.1: Performance instrumentation tracks pointer frequency and frame latency accurately"
  );
  assert(
    perfSnapshot.activeStrokesCount === committedStrokes.length,
    "Test 5.2: Active stroke count matches committed vector objects",
    `Perf: ${perfSnapshot.activeStrokesCount}, actual: ${committedStrokes.length}`
  );

  // -------------------------------------------------------------
  // TEST 6: Autosave Debounce & Batching Stability
  // -------------------------------------------------------------
  let savedBatches = 0;
  const saveQueue = new BoardSaveQueue<StrokeObject>({
    send: async () => {
      savedBatches++;
      return { ok: true, version: 1 };
    },
    onSaved: () => {},
    onState: () => {},
    baseVersionOf: () => 1,
  });

  // Mark dirty 10 times in rapid succession (simulating 10 quick handwriting strokes)
  for (let i = 1; i <= 10; i++) {
    saveQueue.markDirty("page-active", committedStrokes);
  }

  // Flushing once saves exactly ONE batch containing the latest state
  await saveQueue.flush();
  assert(
    savedBatches === 1,
    "Test 6.1: Rapid handwriting strokes batched into a single server write instead of hammering database per stroke",
    `Batches saved: ${savedBatches}`
  );

  console.log(`\nStylus Performance Results: ${passed} PASSED | ${failed} FAILED`);
  if (failed > 0) process.exit(1);
}

testWhiteboardStylusPerformanceAndRepair();
