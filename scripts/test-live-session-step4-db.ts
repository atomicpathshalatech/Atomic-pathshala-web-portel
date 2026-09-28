/**
 * Step 4 DB-backed checks: APP channel stream pool, per-class leases,
 * YouTube health gate, end/complete + lease release, recording readiness.
 * Real disposable Postgres; YouTube is a FAKE (global fetch stub) — no
 * quota spent, nothing created on any channel.
 *
 * Run (same safety rules as scripts/lib/test-db.ts):
 *   TEST_DB_SETUP=base-plus-migration TEST_DATABASE_URL="postgresql://postgres@localhost:5433/atomic_test" \
 *     npx tsx --conditions=react-server scripts/test-live-session-step4-db.ts
 */
import { createAsserts, prepareTestDatabase, requireTestDatabase } from "./lib/test-db";

const { testUrl, parsed } = requireTestDatabase();
const { assert, rejects, finish } = createAsserts();

// ---- Fake YouTube ------------------------------------------------------------
Object.assign(process.env, {
  YOUTUBE_CLIENT_ID: "client",
  YOUTUBE_CLIENT_SECRET: "secret",
  YOUTUBE_APP_REFRESH_TOKEN: "app-refresh",
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "test-secret-for-stream-key-encryption",
});
delete process.env.YOUTUBE_APP_CHANNEL_ID;
delete process.env.YOUTUBE_CHANNEL_ID;
delete process.env.YOUTUBE_MAIN_REFRESH_TOKEN;

type Call = { method: string; path: string; query: URLSearchParams; body: any };
const calls: Call[] = [];
const fake = {
  streamSeq: 0,
  broadcastSeq: 0,
  streamStatus: new Map<string, string>(),
  lifecycle: new Map<string, string>(),
  video: new Map<string, { uploadStatus: string; liveBroadcastContent: string }>(),
  // Embedding per broadcast. Starts OFF: the creation-time videos.update
  // (part=status,snippet) is refused below, like it silently was in production.
  embeddable: new Map<string, boolean>(),
  refuseEmbed: false,
};
globalThis.fetch = (async (input: any, init?: any) => {
  const url = new URL(String(input));
  const method = init?.method ?? "GET";
  const body = init?.body ? JSON.parse(String(init.body).startsWith("{") ? String(init.body) : "{}") : null;
  const json = (status: number, b: unknown) => new Response(JSON.stringify(b), { status });
  if (url.hostname === "oauth2.googleapis.com") return json(200, { access_token: "fake-access", expires_in: 3600 });
  if (!url.hostname.endsWith("googleapis.com")) return json(200, {}); // pusher etc.
  const path = url.pathname.replace("/youtube/v3", "");
  calls.push({ method, path, query: url.searchParams, body });

  if (path === "/liveStreams" && method === "POST") {
    const id = `STREAM${++fake.streamSeq}`;
    fake.streamStatus.set(id, "ready");
    return json(200, { id, cdn: { ingestionInfo: { ingestionAddress: "rtmp://a.rtmp.youtube.com/live2", rtmpsIngestionAddress: "rtmps://a.rtmps.youtube.com/live2", streamName: `key-${id}` } } });
  }
  if (path === "/liveStreams" && method === "GET") {
    const id = url.searchParams.get("id")!;
    return json(200, { items: [{ id, status: { streamStatus: fake.streamStatus.get(id) ?? "ready", healthStatus: { status: "good" } } }] });
  }
  if (path === "/liveBroadcasts" && method === "POST") {
    const id = `BCAST${String(++fake.broadcastSeq).padStart(6, "0")}`;
    fake.lifecycle.set(id, "created");
    fake.embeddable.set(id, false);
    return json(200, { id, snippet: { liveChatId: `chat-${id}` } });
  }
  if (path === "/liveBroadcasts" && method === "GET") {
    const id = url.searchParams.get("id")!;
    return json(200, { items: [{ id, status: { lifeCycleStatus: fake.lifecycle.get(id) ?? "created" } }] });
  }
  if (path === "/liveBroadcasts" && method === "DELETE") return new Response(null, { status: 204 });
  if (path === "/liveBroadcasts/bind") {
    fake.lifecycle.set(url.searchParams.get("id")!, "ready");
    return json(200, { id: url.searchParams.get("id") });
  }
  if (path === "/liveBroadcasts/transition") {
    fake.lifecycle.set(url.searchParams.get("id")!, url.searchParams.get("broadcastStatus")!);
    return json(200, {});
  }
  if (path === "/videos" && method === "PUT") {
    const refuse = { error: { code: 403, errors: [{ reason: "forbidden" }] } };
    if (String(url.searchParams.get("part")).includes("snippet") || fake.refuseEmbed) return json(403, refuse);
    if (body?.status?.embeddable === true) fake.embeddable.set(body.id, true);
    return json(200, {});
  }
  if (path === "/videos" && method === "GET") {
    const id = url.searchParams.get("id")!;
    const v = fake.video.get(id);
    const embeddable = fake.embeddable.get(id);
    if (v) return json(200, { items: [{ id, snippet: { channelId: "UC_APP", liveBroadcastContent: v.liveBroadcastContent }, status: { uploadStatus: v.uploadStatus, embeddable } }] });
    return json(200, embeddable !== undefined ? { items: [{ id, snippet: { channelId: "UC_APP", liveBroadcastContent: "upcoming" }, status: { embeddable } }] } : { items: [] });
  }
  return json(404, { error: { errors: [{ reason: "notFound" }] } });
}) as typeof fetch;

const count = (method: string, path: string) => calls.filter((c) => c.method === method && c.path === path).length;

async function run() {
  prepareTestDatabase(testUrl, parsed);

  const { prisma } = await import("../src/lib/db");
  const pool = await import("../src/lib/youtube/stream-pool");
  const app = await import("../src/lib/live-session/app-youtube");
  const svc = await import("../src/lib/live-session/service");

  // ---- Seed -----------------------------------------------------------------
  const user = await prisma.user.create({ data: { email: "t@test.local", passwordHash: "x", name: "Teacher" } });
  const teacher = await prisma.teacher.create({ data: { userId: user.id, employeeCode: "T-1", department: "Physics" } });
  const batch = await prisma.batch.create({ data: { name: "B", code: "B", createdById: user.id } });
  const start = new Date(Date.now() - 2 * 60_000);
  const end = new Date(start.getTime() + 60 * 60_000);
  const mkClass = async (title: string) => {
    const schedule = await prisma.batchSchedule.create({ data: { batchId: batch.id, teacherId: teacher.id, title, type: "LIVE_CLASS", startsAt: start, endsAt: end, createdById: user.id } });
    const wb = await prisma.whiteboardSession.create({
      data: { batchScheduleId: schedule.id, teacherId: teacher.id, title, videoTransport: "YOUTUBE", scheduledStart: start, scheduledEnd: end, youtubeStreamKey: "old-plaintext-key" },
    });
    return { schedule, wb };
  };
  const begin = (c: Awaited<ReturnType<typeof mkClass>>) =>
    app.beginAppYoutubeStart({ schedule: c.schedule, wbSession: c.wb, teacherId: teacher.id, broadcastTitle: c.schedule.title });

  // ---- Pool provisioning ------------------------------------------------------
  assert(!(await app.appYoutubePoolConfigured()), "Empty pool: App YouTube start is not available (no master-key fallback)");
  const created = await pool.provisionPool(2);
  const streams = await prisma.youtubeIngestStream.findMany();
  assert(created === 2 && streams.length === 2 && streams.every((s) => s.status === "AVAILABLE"), "provisionPool(2) creates two AVAILABLE slots");
  assert(streams.every((s) => !s.streamNameEnc.includes("key-")), "Stream keys are stored encrypted, not in plaintext");
  assert(pool.leaseIngestCredentials(streams[0]!).streamKey.startsWith("key-STREAM"), "Encrypted key decrypts back to the real key");
  assert(streams.every((s) => s.ingestAddress.startsWith("rtmps://")), "RTMPS ingest address preferred");
  assert((await pool.provisionPool(2)) === 0, "provisionPool is idempotent (no extra streams, no extra quota)");
  const createCalls = count("POST", "/liveStreams");

  // ---- Two classes at once: two different streams -----------------------------
  const A = await mkClass("Class A");
  const B = await mkClass("Class B");
  const [ra, rb] = await Promise.all([begin(A), begin(B)]);
  const leaseA = await pool.getActiveLease(ra.liveSession.id);
  const leaseB = await pool.getActiveLease(rb.liveSession.id);
  assert(Boolean(leaseA && leaseB) && leaseA!.streamId !== leaseB!.streamId, "Two simultaneous starts lease DIFFERENT streams (no key collision)");
  assert(ra.youtubeBroadcastId !== rb.youtubeBroadcastId, "Each class gets its own broadcast");
  assert(ra.liveSession.state === "YOUTUBE_CONNECTING" && rb.liveSession.state === "YOUTUBE_CONNECTING", "Started classes wait in YOUTUBE_CONNECTING (not LIVE)");
  const bindCalls = calls.filter((c) => c.path === "/liveBroadcasts/bind");
  assert(
    bindCalls.some((c) => c.query.get("id") === ra.youtubeBroadcastId && c.query.get("streamId") === leaseA!.stream.youtubeStreamId) &&
      bindCalls.some((c) => c.query.get("id") === rb.youtubeBroadcastId && c.query.get("streamId") === leaseB!.stream.youtubeStreamId),
    "Each broadcast is bound to its OWN leased stream"
  );
  const insertBody = calls.find((c) => c.method === "POST" && c.path === "/liveBroadcasts")!.body;
  assert(insertBody.status.privacyStatus === "unlisted" && insertBody.contentDetails.enableAutoStop === false, "Broadcast is unlisted with auto-stop OFF (network blips don't end class)");
  const wbA = await prisma.whiteboardSession.findUniqueOrThrow({ where: { id: A.wb.id } });
  assert(wbA.youtubeStreamKey === null && wbA.youtubeIngestUrl === null, "Stream key is not stored on the session (old plaintext key scrubbed)");

  const again = await begin(A);
  assert(again.youtubeBroadcastId === ra.youtubeBroadcastId && count("POST", "/liveBroadcasts") === 2, "Retrying Start is idempotent (same broadcast, no new insert)");

  // ---- Pool exhausted ---------------------------------------------------------
  const C = await mkClass("Class C");
  assert(await rejects(begin(C), /stream slots are in use/), "Third simultaneous class: clear 'no free slot' error");
  const cSession = await svc.getOpenLiveSession(C.schedule.id);
  assert(cSession?.state === "READY" && !(await pool.getActiveLease(cSession.id)), "Failed start rolls back to READY and holds no lease");

  // ---- Credentials only while leased -------------------------------------------
  const credA = await app.encoderCredentialsForSchedule(A.schedule.id);
  assert(credA?.streamKey === `key-${leaseA!.stream.youtubeStreamId}` && credA.serverUrl.startsWith("rtmps://"), "Class A's controller gets Class A's own key");
  assert((await app.encoderCredentialsForSchedule(C.schedule.id)) === null, "A class without a lease gets no key");

  // ---- Health gate ------------------------------------------------------------
  let st = await app.pollAppYoutubeStatus(ra.liveSession.id);
  assert(st.state === "YOUTUBE_CONNECTING" && !st.becameLive, "No stream from OBS yet → stays connecting");
  fake.streamStatus.set(leaseA!.stream.youtubeStreamId, "active");
  st = await app.pollAppYoutubeStatus(ra.liveSession.id);
  assert(st.state === "YOUTUBE_ACTIVE" && !st.becameLive, "Stream active but broadcast not live → YOUTUBE_ACTIVE (students still not live)");
  assert(!st.embedBlocked && fake.embeddable.get(ra.youtubeBroadcastId) === true, "Embedding left OFF by creation → turned ON before students are let in");
  const embedPuts = calls.filter((c) => c.method === "PUT" && c.path === "/videos" && c.query.get("part") === "status").length;
  await prisma.liveSession.update({ where: { id: ra.liveSession.id }, data: { stateChangedAt: new Date(Date.now() - 20_000) } });
  st = await app.pollAppYoutubeStatus(ra.liveSession.id);
  const transitionLive = calls.filter((c) => c.path === "/liveBroadcasts/transition" && c.query.get("broadcastStatus") === "live");
  assert(transitionLive.length === 1 && transitionLive[0]!.query.get("id") === ra.youtubeBroadcastId, "Auto-start didn't fire in 15s → one explicit go-live for the RIGHT broadcast");
  st = await app.pollAppYoutubeStatus(ra.liveSession.id);
  assert(st.state === "LIVE" && st.becameLive, "Broadcast live on YouTube → class LIVE");
  assert(!st.embedBlocked && calls.filter((c) => c.method === "PUT" && c.path === "/videos" && c.query.get("part") === "status").length === embedPuts, "Going LIVE re-checks embedding (1 unit) without another update when it's already ON");
  assert((await prisma.batchSchedule.findUniqueOrThrow({ where: { id: A.schedule.id } })).status === "LIVE", "Schedule A LIVE");
  const bSession = await prisma.liveSession.findUniqueOrThrow({ where: { id: rb.liveSession.id } });
  assert(bSession.state === "YOUTUBE_CONNECTING", "Class B unaffected by Class A going live");

  // A retried Start / mapping can't skip the gate.
  const forced = await svc.syncLiveSessionOnStart({ schedule: B.schedule, wbSession: { id: B.wb.id, videoTransport: "YOUTUBE", youtubeBroadcastId: rb.youtubeBroadcastId, youtubeVideoId: rb.youtubeBroadcastId }, teacherId: teacher.id, startedAt: new Date() });
  assert(forced[0]!.state === "YOUTUBE_CONNECTING", "Retried Start does not bypass the YouTube health gate");

  // ---- End: complete broadcast, release lease --------------------------------
  await svc.markLiveSessionEnded(ra.liveSession.id, { endedAt: new Date(), hasLegacyRecording: false });
  await app.finishAppYoutubeBroadcast(ra.liveSession.id, false);
  const aEnded = await prisma.liveSession.findUniqueOrThrow({ where: { id: ra.liveSession.id } });
  assert(aEnded.state === "RECORDING_PROCESSING" && aEnded.recordingVideoId === null, "End → RECORDING_PROCESSING, recording NOT marked ready");
  assert(fake.lifecycle.get(ra.youtubeBroadcastId) === "complete", "Class A's broadcast completed on YouTube");
  const aLeaseAfter = await prisma.streamLease.findUniqueOrThrow({ where: { id: leaseA!.id } });
  const aStreamAfter = await prisma.youtubeIngestStream.findUniqueOrThrow({ where: { id: leaseA!.streamId } });
  assert(aLeaseAfter.state === "RELEASED" && aStreamAfter.status === "AVAILABLE", "Lease released, stream back in the pool");
  assert((await app.encoderCredentialsForSchedule(A.schedule.id)) === null, "Class A's key is no longer handed out after the class ends");

  const rc = await begin(C);
  const leaseC = await pool.getActiveLease(rc.liveSession.id);
  assert(leaseC?.streamId === leaseA!.streamId, "Freed stream is reused by the next class (no new stream, no extra quota)");
  assert(count("POST", "/liveStreams") === createCalls, "No liveStreams.insert per class — streams come from the pool");

  // ---- YouTube refuses to enable embedding: class continues, teacher is told ---
  fake.refuseEmbed = true;
  fake.streamStatus.set(leaseC!.stream.youtubeStreamId, "active");
  const stC = await app.pollAppYoutubeStatus(rc.liveSession.id);
  assert(stC.state === "YOUTUBE_ACTIVE" && stC.embedBlocked, "YouTube refuses embedding → class still proceeds, embedBlocked reported to the teacher");
  fake.refuseEmbed = false;

  // ---- End before ever going live -------------------------------------------
  await svc.transitionLiveSession(rb.liveSession.id, "FAILED", { failureReason: "ended_before_live" });
  await app.finishAppYoutubeBroadcast(rb.liveSession.id, true);
  assert(calls.some((c) => c.method === "DELETE" && c.path === "/liveBroadcasts" && c.query.get("id") === rb.youtubeBroadcastId), "Never-live broadcast is deleted (no orphan left behind)");
  assert((await prisma.streamLease.findUniqueOrThrow({ where: { id: leaseB!.id } })).state === "RELEASED", "…and its stream slot is released");

  // ---- Recording readiness ------------------------------------------------------
  const videosGetBefore = count("GET", "/videos");
  fake.video.set(ra.youtubeBroadcastId, { uploadStatus: "uploaded", liveBroadcastContent: "none" });
  assert((await app.checkRecordingReadiness(ra.liveSession.id)) === "RECORDING_PROCESSING", "YouTube still processing → stays RECORDING_PROCESSING");
  assert((await app.checkRecordingReadiness(ra.liveSession.id)) === "RECORDING_PROCESSING" && count("GET", "/videos") === videosGetBefore + 1, "Second check within 2 min makes NO YouTube call (single-flight)");
  fake.video.set(ra.youtubeBroadcastId, { uploadStatus: "processed", liveBroadcastContent: "none" });
  assert((await app.checkRecordingReadiness(ra.liveSession.id, { force: true })) === "RECORDING_READY", "YouTube reports processed → RECORDING_READY");
  const aDone = await prisma.liveSession.findUniqueOrThrow({ where: { id: ra.liveSession.id } });
  const wbDone = await prisma.whiteboardSession.findUniqueOrThrow({ where: { id: A.wb.id } });
  assert(aDone.state === "COMPLETED" && aDone.recordingVideoId === ra.youtubeBroadcastId, "recordingVideoId set only after YouTube confirmed; occurrence COMPLETED");
  assert(wbDone.recordingStatus === "READY" && wbDone.recordingVideoId === ra.youtubeBroadcastId, "Session recording READY only now");

  // ---- Stale lease sweep ------------------------------------------------------
  await prisma.streamLease.update({ where: { id: leaseC!.id }, data: { expiresAt: new Date(Date.now() - 60_000) } });
  const swept = await pool.sweepStaleLeases();
  assert(swept === 1 && (await prisma.youtubeIngestStream.findUniqueOrThrow({ where: { id: leaseC!.streamId } })).status === "AVAILABLE", "Expired lease is swept back into the pool");

  // ---- Two leases on one stream stay impossible ---------------------------------
  const D = await mkClass("Class D");
  const E = await mkClass("Class E");
  const [dRes, eRes] = await Promise.allSettled([begin(D), begin(E)]);
  const dl = dRes.status === "fulfilled" ? await pool.getActiveLease(dRes.value.liveSession.id) : null;
  const el = eRes.status === "fulfilled" ? await pool.getActiveLease(eRes.value.liveSession.id) : null;
  assert(!dl || !el || dl.streamId !== el.streamId, "Concurrent starts never share a stream");

  await prisma.$disconnect();
  finish();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
