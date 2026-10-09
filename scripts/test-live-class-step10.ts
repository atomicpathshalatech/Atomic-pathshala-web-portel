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
assert(pickVideoTransport("LIVEKIT", null, false) === "YOUTUBE", "LiveKit is never a class transport, even when App YouTube is not set up");
assert(pickVideoTransport(undefined, "LIVEKIT", true) === "YOUTUBE", "A stale stored LIVEKIT choice is upgraded too");
assert(pickVideoTransport(undefined, undefined, true) === "YOUTUBE", "No choice at all → App YouTube when available");
assert(pickVideoTransport(undefined, undefined, false) === "YOUTUBE", "No choice at all → YouTube");
assert(pickVideoTransport("YOUTUBE", "LIVEKIT", false) === "YOUTUBE", "An explicit YouTube choice is never downgraded");
assert(pickVideoTransport("BOTH", null, true) === "YOUTUBE", "BOTH becomes a plain YouTube class");
assert(pickVideoTransport("junk", "YOUTUBE", false) === "YOUTUBE", "Junk request falls back to the stored choice");

// ---- 1b. Teacher camera layout reaches the class video ---------------------------
{
  const { parseFreeCameraLayout, formatFreeCameraLayout, cameraRect } = require("../src/lib/live-class/stage-compositor") as typeof import("../src/lib/live-class/stage-compositor");
  const enc = formatFreeCameraLayout(0.7, 0.05, 0.3);
  assert(enc === "FREE:0.700,0.050,0.300", "Free camera layout encodes as fractions of the board", enc);
  assert(JSON.stringify(parseFreeCameraLayout(enc)) === JSON.stringify({ x: 0.7, y: 0.05, size: 0.3 }), "…and parses back");
  assert(parseFreeCameraLayout("UPPER_RIGHT") === null && parseFreeCameraLayout("FREE:2,0,0.3") === null, "Corner names / junk are not free layouts");
  const box = cameraRect(enc, 1920, 1080, 280, 38);
  assert(box.x === 1344 && box.y === 54 && box.w === 324 && box.h === 324, "Stage draws the camera where and as big as the teacher placed it", JSON.stringify(box));
  const corner = cameraRect("LOWER_LEFT", 1920, 1080, 280, 38);
  assert(corner.x === 38 && corner.y === 1080 - 38 - 280, "Corner layouts still work");
  const { isBrandedTemplate } = require("../src/lib/live-class/stage-compositor") as typeof import("../src/lib/live-class/stage-compositor");
  assert(isBrandedTemplate("atomic_white") && isBrandedTemplate("atomic_dark") && isBrandedTemplate(null), "Atomic slides (and the default) carry the logo band");
  assert(!isBrandedTemplate("blank") && !isBrandedTemplate("black") && !isBrandedTemplate("grid") && !isBrandedTemplate("dotted"), "Blank / black / grid / dots stay completely clean");
  const { INBUILT_SLIDE_TEMPLATES } = require("../src/lib/whiteboard/templates") as typeof import("../src/lib/whiteboard/templates");
  const ids = INBUILT_SLIDE_TEMPLATES.map((t) => t.id);
  assert(["blank", "light", "black", "ruled", "grid", "dotted"].every((id) => ids.includes(id)), "Template picker offers blank, white, black, lines, square grid and dots", ids.join(","));
  const ck = require("../src/lib/live-class/chroma-key") as typeof import("../src/lib/live-class/chroma-key");
  const frame = new Uint8ClampedArray(100 * 60 * 4);
  for (let i = 0; i < frame.length; i += 4) { frame[i] = 10; frame[i + 1] = 170; frame[i + 2] = 60; frame[i + 3] = 255; }
  assert(ck.detectKeyColor(frame, 100, 60) === "#0aaa3c", "Auto-detect reads the screen colour from the frame edges");
  const grey = new Uint8ClampedArray(100 * 60 * 4).fill(128);
  assert(ck.detectKeyColor(grey, 100, 60) === null, "Auto-detect refuses a grey wall (no screen)");
  const bad = ck.sanitizeChroma({ enabled: 1, keyColor: "red", similarity: 9, gamma: -3, denoise: 7.6 });
  assert(bad.enabled === true && bad.keyColor === ck.DEFAULT_CHROMA.keyColor && bad.similarity === 1 && bad.gamma === 0.5 && bad.denoise === 3, "Chroma settings from storage/IPC are clamped to safe ranges");
  const vfm = require("../src/lib/live-class/voice-filter") as typeof import("../src/lib/live-class/voice-filter");
  const P = vfm.DEFAULT_GATE;
  const run = (levels: number[], start = { open: false, holdLeftMs: 0, gain: Math.pow(10, P.floorDb / 20) }) =>
    levels.reduce((st, db) => vfm.gateStep(st, db, 10, P), start);
  const speaking = run(Array(30).fill(-25));
  assert(speaking.open && speaking.gain > 0.95, "Close-talk voice (-25 dBFS) opens the gate fully");
  const roomNoise = run(Array(100).fill(-55));
  assert(!roomNoise.open && roomNoise.gain < 0.03, "Room noise ~1 m away (-55 dBFS) stays gated down (~-32 dB)");
  const pause = run(Array(15).fill(-60), speaking);
  assert(pause.open && pause.gain > 0.9, "Short pause between words (150 ms) doesn't chop the voice (hold)");
  const quiet = run(Array(90).fill(-60), speaking);
  assert(!quiet.open && quiet.gain < 0.1, "After speech ends the gate closes smoothly within ~0.9 s (hold + soft fade, no background hiss)");
  const soft = run(Array(60).fill(-46), speaking);
  assert(soft.open, "Softer trailing words (between close and open levels) keep the gate open");
  const edge = cameraRect("FREE:0.990,0.990,0.300", 1920, 1080, 280, 38);
  assert(edge.x + edge.w <= 1920 && edge.y + edge.h <= 1080, "A bubble dragged to the edge stays inside the video");
}

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

  // ---- 4. A teacher's Whiteboard Test Lab room is never a schedule conflict ----
  const { checkScheduleConflict } = await import("../src/lib/batch/schedule-conflict");
  const user = await prisma.user.create({ data: { email: "moaz@test.local", passwordHash: "x", name: "Test Teacher" } });
  const teacher = await prisma.teacher.create({ data: { userId: user.id, employeeCode: "T-10", department: "Biology" } });
  const lab = await prisma.batch.create({ data: { name: "Whiteboard Test Lab", code: "LAB", createdById: user.id, status: "ARCHIVED" } });
  const real = await prisma.batch.create({ data: { name: "Real", code: "REAL", createdById: user.id } });
  await prisma.batchSchedule.create({
    data: { batchId: lab.id, teacherId: teacher.id, title: "Whiteboard Test Lab", type: "LIVE_CLASS", status: "LIVE", isTest: true, startsAt: new Date("2020-01-01T00:00:00Z"), endsAt: new Date("2099-01-01T00:00:00Z"), createdById: user.id },
  });
  const slotStart = new Date("2026-09-28T15:05:00Z");
  const slotEnd = new Date("2026-09-28T15:35:00Z");
  const free = await checkScheduleConflict({ batchId: real.id, teacherId: teacher.id, startsAt: slotStart, endsAt: slotEnd });
  assert(!free.hasConflict, "A teacher who opened the Test Lab can still be scheduled", free.message);
  const labBatch = await checkScheduleConflict({ batchId: lab.id, teacherId: null, startsAt: slotStart, endsAt: slotEnd });
  assert(!labBatch.hasConflict, "The Test Lab room doesn't block its own batch either");
  await prisma.batchSchedule.create({
    data: { batchId: real.id, teacherId: teacher.id, title: "Physics", type: "LIVE_CLASS", startsAt: new Date("2026-09-28T15:20:00Z"), endsAt: new Date("2026-09-28T15:50:00Z"), createdById: user.id },
  });
  const other = await prisma.batch.create({ data: { name: "Other", code: "OTH", createdById: user.id } });
  const busy = await checkScheduleConflict({ batchId: other.id, teacherId: teacher.id, startsAt: slotStart, endsAt: slotEnd });
  assert(busy.hasConflict && busy.conflictType === "TEACHER", "A real overlapping class is still a teacher conflict");

  // ---- 5. Reschedule moves a room opened earlier (it auto-ended the class otherwise) ----
  const svc = await import("../src/lib/live-session/service");
  const oldStart = new Date(Date.now() - 3 * 60 * 60_000); // e.g. 11:00, now long past
  const oldEnd = new Date(oldStart.getTime() + 30 * 60_000);
  const mkRoom = async (title: string, livePhase: "PREPARING" | "LIVE") => {
    const sched = await prisma.batchSchedule.create({ data: { batchId: real.id, teacherId: teacher.id, title, type: "LIVE_CLASS", startsAt: oldStart, endsAt: oldEnd, createdById: user.id } });
    const wb = await prisma.whiteboardSession.create({ data: { batchScheduleId: sched.id, teacherId: teacher.id, title, livePhase, scheduledStart: oldStart, scheduledEnd: oldEnd } });
    return { sched, wb };
  };
  const opened = await mkRoom("Opened before reschedule", "PREPARING");
  const newStart = new Date(Date.now() + 5 * 60_000);
  const newEnd = new Date(newStart.getTime() + 30 * 60_000);
  await svc.rescheduleOpenLiveSession(opened.sched.id, newStart, newEnd);
  const movedWb = await prisma.whiteboardSession.findUniqueOrThrow({ where: { id: opened.wb.id } });
  assert(movedWb.scheduledStart?.getTime() === newStart.getTime() && movedWb.scheduledEnd?.getTime() === newEnd.getTime(), "Reschedule moves the room's own clock too (no instant auto-end on Start)");
  const live = await mkRoom("Live right now", "LIVE");
  await svc.rescheduleOpenLiveSession(live.sched.id, newStart, newEnd);
  assert((await prisma.whiteboardSession.findUniqueOrThrow({ where: { id: live.wb.id } })).scheduledEnd?.getTime() === oldEnd.getTime(), "A class that is live is not moved under the teacher");
  const startSrc = read("src/app/api/team/live-class/[scheduleId]/start/route.ts");
  assert(startSrc.includes("!isNewOccurrence && !schedule.liveWhiteboardSession?.actualStartedAt && { scheduledStart, scheduledEnd }"), "First Start takes the room's times from the schedule as it is now");

  // ---- 6. Calls + leaderboard (test class 5 feedback) ----
  const studentRoom = read("src/components/live-class/StudentLiveClassRoom.tsx");
  const desktopAt = studentRoom.indexOf("{isDesktopViewport && (");
  const mobileAt = studentRoom.indexOf("{!isDesktopViewport && (");
  const strips = [...studentRoom.matchAll(/<VideoStrip\s/g)].map((m) => m.index!);
  assert(desktopAt > 0 && mobileAt > desktopAt, "Student room mounts only one layout (desktop OR phone)");
  assert(strips.length > 0 && strips.every((i) => i > desktopAt), "Every call connection (VideoStrip) sits inside a layout that is mounted alone — no second LiveKit connection with the same identity");
  assert((studentRoom.match(/silenced=\{isApprovedSpeaker \|\| teacherAudioConnected \|\| teacherVideoConnected\}/g) ?? []).length === 2, "The stream's delayed audio is silenced during a call (no double teacher voice)");
  const teacherRoom = read("src/components/live-class/TeacherLiveClassRoom.tsx");
  assert((teacherRoom.match(/connectedStudents\.length === 0\s*\n?\s*\}/g) ?? []).length === 2, "A teacher-started call also joins LiveKit (teacher can hear the student)");
  assert(teacherRoom.includes("<LeaderboardPopup") && studentRoom.includes("<LeaderboardPopup"), "Published leaderboard pops up for the teacher and the students");
  assert(studentRoom.includes("secondaryChannel?.bind(WB_EVENTS.QUIZ_LEADERBOARD_PUBLISHED"), "Student hears a leaderboard publish on both channels");
  assert(read("src/components/live-class/LeaderboardPopup.tsx").includes("Array.isArray((data as PublishedLeaderboard).rankings)"), "Leaderboard popup only opens for a real rankings payload");

  // ---- 7. Poll answers typed in the YouTube chat ----
  const { parseChatVote, collectChatVotes, chatVoteHint } = await import("../src/lib/live-class/youtube-poll");
  const abcd = ["A", "B", "C", "D"].map((key) => ({ key, label: `Option ${key}` }));
  const yesNo = [{ key: "A", label: "YES" }, { key: "B", label: "NO" }];
  const asVote = (t: string, o = abcd) => parseChatVote(t, o);
  assert(asVote("B") === "B" && asVote("b") === "B" && asVote(" (c) ") === "C" && asVote("D.") === "D" && asVote("[a]") === "A", "Chat vote: a bare letter in any case / brackets counts");
  assert(asVote("ans B") === "B" && asVote("Answer: c") === "C" && asVote("option d") === "D" && asVote("jawab a") === "A", "Chat vote: 'ans B', 'Answer: c', 'option d', 'jawab a'");
  assert(asVote("E") === null && asVote("I think it's B") === null && asVote("bhai A ya B?") === null && asVote("") === null && asVote("abc") === null, "Chat vote: sentences, unknown letters and chatter don't count");
  assert(asVote("yes", yesNo) === "A" && asVote("Haan", yesNo) === "A" && asVote("nahi", yesNo) === "B" && asVote("NO!", yesNo) === "B" && asVote("b", yesNo) === "B", "Chat vote: YES/NO poll understands yes/haan/no/nahi and the letters");
  assert(asVote("yes") === null, "Chat vote: 'yes' is not a vote on an A-D poll");
  const t0 = new Date("2026-09-30T10:00:00Z");
  const msg = (id: string, ch: string, text: string, secs: number) => ({ id, authorChannelId: ch, authorName: `Viewer ${ch}`, authorPhotoUrl: null, messageText: text, publishedAt: new Date(t0.getTime() + secs * 1000).toISOString() });
  const votes = collectChatVotes(
    [
      msg("m1", "c1", "hello sir", 2),
      msg("m2", "c1", "B", 5), // first valid answer of c1
      msg("m3", "c1", "C", 7), // changing the answer doesn't count
      msg("m4", "c2", "a", -3), // before the poll opened
      msg("m5", "c2", "D", 10),
      msg("m6", "c3", "A", 33), // 30 s poll + 3 s grace → still counts
      msg("m7", "c4", "A", 40), // too late
    ],
    { options: abcd, startedAt: t0, timeLimitSec: 30 }
  );
  assert(votes.map((v) => `${v.authorChannelId}:${v.selectedOption}`).join(",") === "c1:B,c2:D,c3:A", `Chat votes: one per account, first answer, only while open (${votes.map((v) => v.authorChannelId + ":" + v.selectedOption).join(",")})`);
  assert(votes[0]!.responseTimeMs === 5000, "Chat vote response time counts from the poll start");
  assert(chatVoteHint(abcd) === "Type A, B, C or D in the YouTube chat" && chatVoteHint(yesNo) === "Type YES or NO in the YouTube chat", "Video hint tells YouTube viewers what to type");

  const { toStagePoll } = await import("../src/lib/live-class/stage-compositor");
  const openPoll = toStagePoll({ questionText: "Q?", options: abcd, status: "ACTIVE", startedAt: t0.toISOString(), timeLimitSec: 30, correctOption: "B" }, { counts: { B: 3 }, totalResponses: 3 });
  assert(openPoll !== null && openPoll.correctOption === null && openPoll.counts === null, "Open poll in the video never shows the answer or the vote split");
  const shownResult = toStagePoll({ questionText: "Q?", options: abcd, status: "REVEALED", startedAt: t0.toISOString(), timeLimitSec: 30, correctOption: "B" }, { counts: { B: 3 }, totalResponses: 3 });
  assert(shownResult?.correctOption === "B" && shownResult.counts?.B === 3, "Revealed poll in the video shows the answer and the split");
  assert(toStagePoll({ questionText: null, options: abcd, status: "CLOSED", timeLimitSec: 30 }) === null, "Closed poll leaves the video");

  // DB: YouTube answers are counted, marked and ranked (with a YouTube mark).
  const quiz = await prisma.quizSession.create({
    data: { whiteboardSessionId: opened.wb.id, options: abcd, correctOption: "B", timeLimitSec: 30, createdById: user.id, startedAt: t0 },
  });
  await prisma.quizYoutubeVote.createMany({
    data: votes.map((v) => ({ ...v, quizSessionId: quiz.id })),
  });
  const dup = await prisma.quizYoutubeVote.createMany({ data: votes.map((v) => ({ ...v, quizSessionId: quiz.id })), skipDuplicates: true });
  assert(dup.count === 0, "Reading the same chat again adds no duplicate votes");
  const yv = await import("../src/lib/whiteboard/youtube-votes");
  const tally = await yv.youtubeVoteCounts(quiz.id);
  assert(tally.total === 3 && tally.counts.B === 1 && tally.counts.D === 1 && tally.counts.A === 1, "YouTube answers are tallied per option");
  await yv.markYoutubeVotes(quiz.id, "B");
  const marked = await prisma.quizYoutubeVote.findMany({ where: { quizSessionId: quiz.id } });
  assert(marked.find((v) => v.authorChannelId === "c1")?.isCorrect === true && marked.filter((v) => v.isCorrect === false).length === 2, "Reveal marks YouTube answers right/wrong");
  const { buildQuizLeaderboard } = await import("../src/lib/whiteboard/quiz-leaderboard");
  const board = await buildQuizLeaderboard(opened.wb.id, "session");
  assert(board?.rankings[0]?.studentId === "yt:c1" && board.rankings[0].source === "YOUTUBE" && board.rankings[0].correctCount === 1, "Leaderboard ranks YouTube chat answers, marked as YouTube");
  assert(board?.stats.totalParticipants === 3 && board.stats.totalPolls === 1, "Leaderboard stats include YouTube participants");
  assert(yv.addCounts({ A: 2, B: 1 }, { B: 4, C: 1 }).B === 5, "App + YouTube counts add up");

  // ---- 8. Chat join lines + always-reachable leaderboard publish ----
  const chatPanel = read("src/components/live-class/MessagesPanel.tsx");
  assert(!chatPanel.includes("rounded-full text-xs font-semibold bg-emerald-50") && chatPanel.includes("</span> joined") && chatPanel.includes("{joinedAt &&"), "Join notice is one small line with the join time (no big box)");
  assert(teacherRoom.includes("{publishingLeaderboard ? \"Publishing…\" : \"Publish Leaderboard\"}") && !teacherRoom.includes('title="Dock / Undock"'), "Publish Leaderboard is always in the poll window header");
  assert(read("src/app/api/whiteboard/sessions/[id]/quiz/leaderboard/route.ts").includes("board.rankings.length === 0"), "Publishing an empty leaderboard is refused with a clear message");

  await prisma.$disconnect();
}

run()
  .then(() => finish())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
