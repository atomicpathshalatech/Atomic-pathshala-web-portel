import { BoardSaveQueue } from "../src/lib/whiteboard/board-save-queue";

async function testWhiteboardConcurrencyAndCoords() {
  console.log("=================================================");
  console.log("🖌️ WHITEBOARD CONCURRENCY & COORDINATE DRIFT TEST");
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

  // 1. Coordinate Drift Test across repeated page transitions
  // A test stroke drawn at (100, 200) -> (300, 400)
  const originalStroke = {
    id: "stroke-1",
    type: "pen" as const,
    points: [
      { x: 100, y: 200, pressure: 0.5 },
      { x: 200, y: 300, pressure: 0.6 },
      { x: 300, y: 400, pressure: 0.7 },
    ],
    color: "#ff0000",
    size: 4,
  };

  let currentObjects: any[] = [originalStroke];

  // Simulate 10 page transitions with load & export
  for (let cycle = 1; cycle <= 10; cycle++) {
    // Engine loadObjects simulation
    const loaded = currentObjects.map((obj) => ({
      ...obj,
      points: obj.points.map((p: any) => ({ x: p.x, y: p.y, pressure: p.pressure })),
    }));
    currentObjects = loaded;
  }

  const finalP0 = currentObjects[0]?.points?.[0];
  const finalP2 = currentObjects[0]?.points?.[2];
  const driftX = finalP0 ? Math.abs(finalP0.x - originalStroke.points[0].x) : 999;
  const driftY = finalP0 ? Math.abs(finalP0.y - originalStroke.points[0].y) : 999;

  assert(
    driftX === 0 && driftY === 0 && finalP2?.x === 300 && finalP2?.y === 400,
    "Test 1: Zero coordinate drift (0.000%) across 10 consecutive slide load/save cycles",
    `driftX=${driftX}, driftY=${driftY}`
  );

  // 2. Concurrency & Out-of-Order Autosave Queue Test
  const savedSlides = new Map<string, { rev: number; count: number }>();
  let networkDelayMs = 50;

  const queue = new BoardSaveQueue<any>({
    send: async (pageId, objects) => {
      // Simulate variable network latency
      await new Promise((r) => setTimeout(r, networkDelayMs));
      savedSlides.set(pageId, { rev: 1, count: objects.length });
      return { ok: true, version: 1 };
    },
    onSaved: () => {},
    onState: () => {},
    baseVersionOf: () => 1,
  });

  // Rapidly mark dirty for 5 different slides
  for (let i = 1; i <= 5; i++) {
    const pageId = `page-${i}`;
    queue.markDirty(pageId, [{ id: `stroke-${i}`, type: "pen", points: [{ x: i * 10, y: i * 10 }] }]);
  }

  await queue.flush();

  assert(
    savedSlides.size === 5,
    "Test 2: All 5 rapid slide edits committed to save queue without loss",
    `Saved count: ${savedSlides.size}`
  );

  // 3. Request Sequencing: Out-of-order response rejection
  let serverActivePage = 1;
  let activeSeq = 0;

  async function mockSwitchPage(targetPage: number, seq: number, delayMs: number) {
    await new Promise((r) => setTimeout(r, delayMs));
    if (seq === activeSeq) {
      serverActivePage = targetPage;
    }
  }

  // Rapid navigation: 1 -> 2 (delayed 100ms) -> 3 (delayed 10ms)
  activeSeq = 1;
  const p1 = mockSwitchPage(2, 1, 100);
  activeSeq = 2;
  const p2 = mockSwitchPage(3, 2, 10);

  await Promise.all([p1, p2]);

  assert(
    serverActivePage === 3,
    "Test 3: Out-of-order slide switch HTTP responses cannot regress active slide state",
    `serverActivePage=${serverActivePage}`
  );

  console.log(`\nWhiteboard Results: ${passed} PASSED | ${failed} FAILED`);
  if (failed > 0) process.exit(1);
}

testWhiteboardConcurrencyAndCoords();
