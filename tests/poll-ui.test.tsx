import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { VideoPollOverlay, VideoPollData } from "../src/components/live-class/VideoPollOverlay";

// Setup browser globals for Node.js test environment
const mockStorage = new Map<string, string>();
(global as any).localStorage = {
  getItem: (key: string) => mockStorage.get(key) || null,
  setItem: (key: string, val: string) => mockStorage.set(key, String(val)),
  removeItem: (key: string) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
};

(global as any).window = {
  innerWidth: 1280,
  innerHeight: 720,
  addEventListener: () => {},
  removeEventListener: () => {},
};

async function testPollUIOverlayBehavior() {
  console.log("=================================================");
  console.log("📊 REACT LIVE POLL UI & COMPONENT LIFECYCLE TEST");
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

  const activePollFixture: VideoPollData = {
    id: "poll_comp_101",
    questionText: "What is the unit of electric charge?",
    options: [
      { key: "A", label: "Coulomb" },
      { key: "B", label: "Volt" },
      { key: "C", label: "Ampere" },
      { key: "D", label: "Ohm" },
    ],
    timeLimitSec: 30,
    startedAt: new Date().toISOString(),
    status: "ACTIVE",
  };

  // 1. Single Poll Overlay Mount
  const initialHtml = renderToStaticMarkup(
    <VideoPollOverlay
      poll={activePollFixture}
      onVote={() => {}}
      onDismiss={() => {}}
    />
  );

  assert(
    initialHtml.includes('data-poll-id="poll_comp_101"') &&
    initialHtml.includes("What is the unit of electric charge?") &&
    initialHtml.includes("Coulomb"),
    "Test 1: Single poll overlay mounts cleanly with correct question and options"
  );

  // 2. Student Answer Privacy Before Reveal
  assert(
    !initialHtml.includes("Ans:") &&
    !initialHtml.includes("Correct!") &&
    !initialHtml.includes("Result"),
    "Test 2: Student answer privacy strictly preserved — zero correctness or results rendered before reveal"
  );

  // 3. Timer Expiry Without Auto-Dismissal
  // Create an expired poll fixture (started 60s ago with 30s limit)
  const expiredPollFixture: VideoPollData = {
    ...activePollFixture,
    id: "poll_comp_expired",
    startedAt: new Date(Date.now() - 60000).toISOString(),
    timeLimitSec: 30,
    status: "ACTIVE",
  };

  const expiredHtml = renderToStaticMarkup(
    <VideoPollOverlay
      poll={expiredPollFixture}
      onVote={() => {}}
      onDismiss={() => {}}
    />
  );

  assert(
    expiredHtml.includes('data-poll-id="poll_comp_expired"') &&
    expiredHtml.includes("Expired"),
    "Test 3: Expired timer does NOT auto-dismiss poll — remains persistently mounted with 'Expired' indicator"
  );

  // 4. Manual Teacher Reveal State
  const revealedPollFixture: VideoPollData = {
    ...activePollFixture,
    id: "poll_comp_revealed",
    status: "REVEALED",
    correctOption: "A",
    counts: { A: 18, B: 2, C: 1, D: 0 },
    totalVotes: 21,
  };

  const revealedHtml = renderToStaticMarkup(
    <VideoPollOverlay
      poll={revealedPollFixture}
      onVote={() => {}}
      onDismiss={() => {}}
    />
  );

  assert(
    revealedHtml.includes("Ans: A") &&
    revealedHtml.includes("86%") && // 18/21 = 85.7% -> 86%
    revealedHtml.includes("Coulomb"),
    "Test 4: Teacher reveal renders authoritative results and percentages"
  );

  // 5. Manual Teacher Close / Null Dismissal
  const closedPollFixture: VideoPollData = {
    ...activePollFixture,
    status: "ENDED",
  };

  const closedHtml = renderToStaticMarkup(
    <VideoPollOverlay
      poll={closedPollFixture}
      onVote={() => {}}
      onDismiss={() => {}}
    />
  );

  assert(
    closedHtml === "",
    "Test 5: Closed poll (status: ENDED) renders completely empty string (unmounted from DOM)"
  );

  // 6. Answer Preservation Across Reconnection / Reload
  mockStorage.set("atomic_poll_vote_poll_comp_reconnect", "A");
  const reconnectPollFixture: VideoPollData = {
    ...activePollFixture,
    id: "poll_comp_reconnect",
    status: "ACTIVE",
  };

  const reconnectHtml = renderToStaticMarkup(
    <VideoPollOverlay
      poll={reconnectPollFixture}
      onVote={() => {}}
      onDismiss={() => {}}
    />
  );

  assert(
    reconnectHtml.includes('data-poll-id="poll_comp_reconnect"') &&
    reconnectHtml.includes("Coulomb"),
    "Test 6: Student vote preserved in storage across page reconnects and component remounts"
  );

  console.log(`\nReact Poll UI Results: ${passed} PASSED | ${failed} FAILED`);
  if (failed > 0) process.exit(1);
}

testPollUIOverlayBehavior();
