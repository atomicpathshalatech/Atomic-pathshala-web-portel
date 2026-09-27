/**
 * Step 2 checks: legacy WhiteboardSession → LiveSession mapping used by
 * scripts/backfill-live-sessions.ts, plus static checks on the migration's
 * SQL invariants. No database.
 *
 * Run: npx tsx scripts/test-live-session-step2.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mapLegacyLiveSession, type LegacyWhiteboardSession } from "../src/lib/live-session/legacy-map";

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

const schedule = { id: "sched-1", startsAt: new Date("2026-09-27T09:00:00Z"), endsAt: new Date("2026-09-27T10:00:00Z") };
const base: LegacyWhiteboardSession = {
  id: "wb-1",
  teacherId: "teacher-1",
  status: "ACTIVE",
  livePhase: "SCHEDULED",
  videoTransport: "LIVEKIT",
  youtubeBroadcastId: null,
  youtubeStreamId: null,
  youtubeVideoId: null,
  scheduledStart: null,
  scheduledEnd: null,
  actualStartedAt: null,
  actualEndedAt: null,
  endedAt: null,
  totalExtendedMinutes: 0,
};
const map = (over: Partial<LegacyWhiteboardSession>) => mapLegacyLiveSession({ ...base, ...over }, schedule);

// ---- Delivery mode ---------------------------------------------------------
let m = map({ videoTransport: "BOTH", youtubeBroadcastId: "BCAST", youtubeStreamId: "STREAM", youtubeVideoId: "BCAST" });
assert(m.deliveryMode === "APP_YOUTUBE" && m.youtubeChannel === "APP", "Auto-created broadcast → APP_YOUTUBE on APP");

m = map({ videoTransport: "YOUTUBE", youtubeVideoId: "PASTEDVIDEO" });
assert(m.deliveryMode === "EXTERNAL_YOUTUBE" && m.youtubeChannel === null, "Pasted video id → EXTERNAL_YOUTUBE, no channel claimed");

m = map({ videoTransport: "YOUTUBE" });
assert(m.deliveryMode === "LEGACY_LIVEKIT" && m.youtubeVideoId === null, "YouTube mode with no video → LEGACY_LIVEKIT");

m = map({ videoTransport: "LIVEKIT", youtubeVideoId: "STRAY" });
assert(m.deliveryMode === "LEGACY_LIVEKIT" && m.youtubeVideoId === null, "LiveKit class ignores stray youtubeVideoId");

// ---- State -----------------------------------------------------------------
assert(map({ status: "ENDED", livePhase: "ENDED" }).state === "COMPLETED", "ENDED → COMPLETED");
assert(map({ status: "ENDED", livePhase: "LIVE" }).state === "COMPLETED", "ENDED row with stale LIVE phase → COMPLETED (never LIVE)");
assert(map({ livePhase: "LIVE" }).state === "LIVE", "ACTIVE + LIVE → LIVE");
assert(map({ livePhase: "PREPARING" }).state === "READY", "PREPARING → READY");
assert(map({ livePhase: "WAITING_FOR_STREAM" }).state === "YOUTUBE_CONNECTING", "WAITING_FOR_STREAM → YOUTUBE_CONNECTING");
assert(map({ livePhase: "CANCELLED", status: "ENDED" }).state === "CANCELLED", "CANCELLED preserved");
assert(map({ livePhase: "PROCESSING_RECORDING", status: "ENDED" }).state === "RECORDING_PROCESSING", "PROCESSING_RECORDING → RECORDING_PROCESSING");

// ---- Timing ------------------------------------------------------------------
m = map({ scheduledEnd: new Date("2026-09-27T10:30:00Z"), totalExtendedMinutes: 30 });
assert(m.effectiveEndsAt.toISOString() === "2026-09-27T10:30:00.000Z" && m.totalExtendedMinutes === 30, "Extended class keeps its extended end");

m = map({ scheduledEnd: new Date("2026-09-27T09:30:00Z") });
assert(m.effectiveEndsAt.toISOString() === "2026-09-27T10:00:00.000Z", "Earlier session end never shortens the class");

m = mapLegacyLiveSession({ ...base, scheduledStart: new Date("2026-09-27T11:00:00Z") }, schedule);
assert(m.effectiveEndsAt.getTime() > m.plannedStartsAt.getTime(), "Bad legacy window is repaired so end > start (DB CHECK)");

m = map({ status: "ENDED", livePhase: "ENDED", endedAt: new Date("2026-09-27T10:05:00Z") });
assert(m.actualEndedAt?.toISOString() === "2026-09-27T10:05:00.000Z", "actualEndedAt falls back to endedAt");

// ---- Recording is never trusted from legacy data ---------------------------
m = map({ videoTransport: "BOTH", youtubeBroadcastId: "BCAST", youtubeStreamId: "STREAM", status: "ENDED", livePhase: "ENDED" });
assert(!("recordingVideoId" in m), "Legacy recordingVideoId is not carried over (it was set without YouTube confirming)");

// ---- Every mapping satisfies the channel CHECK constraint ------------------
const combos: Partial<LegacyWhiteboardSession>[] = [
  { videoTransport: "LIVEKIT" },
  { videoTransport: "YOUTUBE" },
  { videoTransport: "BOTH", youtubeVideoId: "X" },
  { videoTransport: "BOTH", youtubeBroadcastId: "B", youtubeStreamId: "S" },
  { videoTransport: "YOUTUBE", youtubeBroadcastId: "B" },
];
const checkOk = (r: ReturnType<typeof map>) =>
  (r.deliveryMode === "APP_YOUTUBE" && r.youtubeChannel === "APP") ||
  (r.deliveryMode === "MAIN_YOUTUBE" && (r.youtubeChannel as string) === "MAIN") ||
  ((r.deliveryMode === "EXTERNAL_YOUTUBE" || r.deliveryMode === "LEGACY_LIVEKIT") && r.youtubeChannel === null);
assert(combos.every((c) => checkOk(map(c))), "All mapped rows satisfy live_sessions_delivery_channel_match");

// ---- Migration SQL contains the invariants ---------------------------------
const sql = readFileSync(
  join(process.cwd(), "prisma/migrations/20260927120000_live_session_youtube_delivery/migration.sql"),
  "utf8"
);
assert(/UNIQUE INDEX "stream_leases_one_active_per_stream"[\s\S]*WHERE "state" IN \('RESERVED', 'BOUND', 'ACTIVE', 'RELEASING'\)/.test(sql), "Migration: one active lease per stream");
assert(/UNIQUE INDEX "stream_leases_one_active_per_session"/.test(sql), "Migration: one active lease per session");
assert(/UNIQUE INDEX "live_sessions_one_open_per_schedule"/.test(sql), "Migration: one open occurrence per schedule");
assert(/"live_sessions_delivery_channel_match" CHECK/.test(sql), "Migration: delivery mode ↔ channel CHECK");
assert(!/DROP (TABLE|COLUMN)|ALTER COLUMN/i.test(sql), "Migration is additive (no drops or column changes)");

console.log(`\n${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
