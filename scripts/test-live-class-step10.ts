/**
 * Step 10 checks: legacy removal (Classroom module, media relay) and the
 * LiveKit room demoted to a fallback transport.
 *
 *   - pickVideoTransport: LIVEKIT only while App YouTube is unavailable
 *   - appYoutubeAvailable: needs YouTube credentials AND a usable APP slot
 *     (real disposable Postgres; slots inserted directly — no YouTube calls)
 *   - static: removed code really gone, nothing still points at it
 *
 * Run (same safety rules as scripts/lib/test-db.ts):
 *   TEST_DB_SETUP=base-plus-migration TEST_DATABASE_URL="postgresql://postgres@localhost:5433/atomic_test" \
 *     npx tsx --conditions=react-server scripts/test-live-class-step10.ts
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createAsserts, prepareTestDatabase, requireTestDatabase } from "./lib/test-db";
import { pickVideoTransport } from "../src/lib/live-session/delivery-options";

const { testUrl, parsed } = requireTestDatabase();
const { assert, finish } = createAsserts();
const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

// ---- 1. Transport choice (pure) -----------------------------------------------
assert(pickVideoTransport("LIVEKIT", null, true) === "YOUTUBE", "LIVEKIT request becomes an App YouTube class once App YouTube is available");
assert(pickVideoTransport("LIVEKIT", null, false) === "LIVEKIT", "LIVEKIT stays as the fallback when App YouTube isn't set up");
assert(pickVideoTransport(undefined, "LIVEKIT", true) === "YOUTUBE", "A stale stored LIVEKIT choice is upgraded too");
assert(pickVideoTransport(undefined, undefined, true) === "YOUTUBE", "No choice at all → App YouTube when available");
assert(pickVideoTransport(undefined, undefined, false) === "LIVEKIT", "No choice at all → LiveKit room when App YouTube is unavailable");
assert(pickVideoTransport("YOUTUBE", "LIVEKIT", false) === "YOUTUBE", "An explicit YouTube choice is never downgraded");
assert(pickVideoTransport("BOTH", null, true) === "BOTH", "BOTH is kept as-is");
assert(pickVideoTransport("junk", "YOUTUBE", false) === "YOUTUBE", "Junk request falls back to the stored choice");

// ---- 2. Static: removed code is gone and nothing points at it ------------------
for (const p of [
  "src/components/classroom",
  "src/lib/classroom",
  "src/app/api/classroom",
  "src/app/api/team/classroom",
  "src/app/api/cron/classroom-recording",
  "infra/media-relay",
]) {
  assert(!existsSync(join(root, p)), `Removed: ${p}`);
}
function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|mjs|json)$/.test(name)) out.push(p);
  }
  return out;
}
const offenders = walk(join(root, "src"))
  .concat([join(root, "vercel.json"), join(root, "middleware.ts")])
  .filter((f) => /@\/lib\/classroom|@\/components\/classroom|\/api\/classroom|\/api\/team\/classroom|classroom-recording|MEDIA_RELAY|presence-classroom/.test(readFileSync(f, "utf8")));
assert(offenders.length === 0, "No source file references the removed Classroom module / media relay", offenders.join(", "));
assert(read("src/app/(student)/classroom/[scheduleId]/page.tsx").includes("redirect(`/live-class/"), "Old student /classroom links redirect to the live class");
assert(read("src/app/(team)/team/classroom/[scheduleId]/page.tsx").includes("redirect(`/team/live-class/"), "Old teacher /team/classroom links redirect to the teacher room");
assert(existsSync(join(root, "src/components/live-class/VideoPollOverlay.tsx")), "Video poll overlay kept (moved to live-class)");
const wbPatch = read("src/app/api/whiteboard/sessions/[id]/route.ts");
assert(wbPatch.includes(`!isAlreadyRecording && existing.videoTransport === "LIVEKIT")`), "Paid LiveKit Egress only for a LiveKit-fallback class (never BOTH/YouTube)");
const start = read("src/app/api/team/live-class/[scheduleId]/start/route.ts");
assert(start.includes("pickVideoTransport(") && start.includes("appYoutubeAvailable()"), "Start Class decides the transport server-side");
assert(read("src/app/api/team/live-class/[scheduleId]/preflight/route.ts").includes(`livePhase !== "LIVE" ? { videoTransport }`), "Preflight never switches transport under a live class");
assert(existsSync(join(root, "src/lib/livekit/server.ts")), "LiveKit kept for student calls and doubt sessions");

// ---- 3. appYoutubeAvailable against a real DB ---------------------------------
async function run() {
  prepareTestDatabase(testUrl, parsed);
  const { prisma } = await import("../src/lib/db");
  const { appYoutubeAvailable } = await import("../src/lib/live-session/delivery-options");

  for (const k of ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_APP_REFRESH_TOKEN", "YOUTUBE_REFRESH_TOKEN", "YOUTUBE_MAIN_REFRESH_TOKEN"]) delete process.env[k];
  const slot = (id: string, status: "AVAILABLE" | "LEASED" | "DISABLED" | "RETIRED", channel: "APP" | "MAIN" = "APP") =>
    prisma.youtubeIngestStream.create({ data: { id, channel, youtubeStreamId: `yt-${id}`, ingestAddress: "rtmps://a.rtmps.youtube.com/live2", streamNameEnc: "x", status } });

  await slot("s1", "AVAILABLE");
  assert((await appYoutubeAvailable()) === false, "No YouTube credentials → not available (even with a slot)");

  Object.assign(process.env, { YOUTUBE_CLIENT_ID: "client", YOUTUBE_CLIENT_SECRET: "secret", YOUTUBE_APP_REFRESH_TOKEN: "app-refresh" });
  await prisma.youtubeIngestStream.deleteMany();
  assert((await appYoutubeAvailable()) === false, "Credentials but no stream slots → not available (LiveKit fallback)");

  await slot("s2", "DISABLED");
  await slot("s3", "RETIRED");
  assert((await slot("s4", "AVAILABLE", "MAIN").then(() => false, () => true)) === true, "DB refuses a MAIN-channel slot (MAIN is read-only)");
  assert((await appYoutubeAvailable()) === false, "Only disabled/retired slots → not available");

  await slot("s5", "LEASED");
  assert((await appYoutubeAvailable()) === true, "A leased APP slot counts (pool exists; start waits/fails per class)");
  await slot("s6", "AVAILABLE");
  assert((await appYoutubeAvailable()) === true, "Credentials + an APP slot → available");

  await prisma.$disconnect();
}

run()
  .then(() => finish())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
