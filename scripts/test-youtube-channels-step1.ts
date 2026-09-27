/**
 * Step 1 checks: two-channel YouTube abstraction, typed errors and the
 * retry policy. Uses a stubbed global fetch — no real Google/YouTube calls,
 * no quota spent, no database.
 *
 * Run: npx tsx --conditions=react-server scripts/test-youtube-channels-step1.ts
 */
process.env.DATABASE_URL = "postgresql://nobody:nothing@127.0.0.1:1/step1_test_must_not_connect";

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

type Call = { url: string; method: string; body: string };
let calls: Call[] = [];
let handler: (call: Call) => { status: number; body: unknown } = () => ({ status: 500, body: {} });

globalThis.fetch = (async (input: any, init?: any) => {
  const call: Call = { url: String(input), method: init?.method ?? "GET", body: init?.body ? String(init.body) : "" };
  calls.push(call);
  const { status, body } = handler(call);
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
}) as typeof fetch;

const isToken = (c: Call) => c.url.startsWith("https://oauth2.googleapis.com/token");
const isChannels = (c: Call) => c.url.includes("/youtube/v3/channels");
const apiCalls = () => calls.filter((c) => !isToken(c) && !isChannels(c));
const googleError = (status: number, reason: string) => ({ status, body: { error: { code: status, errors: [{ reason }], message: reason } } });
const tokenOk = { status: 200, body: { access_token: "access-token", expires_in: 3600 } };

function setEnv(env: Record<string, string | undefined>) {
  for (const k of [
    "YOUTUBE_CLIENT_ID",
    "YOUTUBE_CLIENT_SECRET",
    "YOUTUBE_REFRESH_TOKEN",
    "YOUTUBE_CHANNEL_ID",
    "YOUTUBE_APP_REFRESH_TOKEN",
    "YOUTUBE_APP_CHANNEL_ID",
    "YOUTUBE_MAIN_REFRESH_TOKEN",
    "YOUTUBE_MAIN_CHANNEL_ID",
  ]) {
    delete process.env[k];
  }
  Object.assign(process.env, { YOUTUBE_CLIENT_ID: "client", YOUTUBE_CLIENT_SECRET: "secret", ...env });
}

async function run() {
  const errors = await import("../src/lib/youtube/errors");
  const channels = await import("../src/lib/youtube/channels");
  const { youtubeApi } = await import("../src/lib/youtube/client");
  const { createLiveBroadcast } = await import("../src/lib/youtube/live-broadcast");
  const noSleep = async () => {};

  const reset = () => {
    calls = [];
    channels.clearCachedYoutubeToken();
    channels.clearVerifiedYoutubeChannelIdentity();
  };

  // ---- 1. Error classification ------------------------------------------
  const k = (status: number, reason: string | null) => errors.classifyYoutubeResponse(status, reason);
  assert(k(403, "quotaExceeded") === "QUOTA", "quotaExceeded → QUOTA");
  assert(k(403, "rateLimitExceeded") === "RATE_LIMIT", "rateLimitExceeded → RATE_LIMIT");
  assert(k(403, "insufficientLivePermissions") === "PERMISSION", "insufficientLivePermissions → PERMISSION");
  assert(k(403, "liveBroadcastBindingNotAllowed") === "BINDING_NOT_ALLOWED", "liveBroadcastBindingNotAllowed → BINDING_NOT_ALLOWED");
  assert(k(404, "liveBroadcastNotFound") === "INVALID_BROADCAST", "liveBroadcastNotFound → INVALID_BROADCAST");
  assert(k(403, "errorStreamInactive") === "STREAM_NOT_ACTIVE", "errorStreamInactive → STREAM_NOT_ACTIVE");
  assert(k(403, "redundantTransition") === "REDUNDANT_TRANSITION", "redundantTransition → REDUNDANT_TRANSITION");
  assert(k(503, "backendError") === "BACKEND", "backendError → BACKEND");
  assert(k(401, null) === "AUTH_EXPIRED", "401 → AUTH_EXPIRED");
  assert(k(400, "invalidValue") === "INVALID_REQUEST", "other 400 → INVALID_REQUEST");
  assert(errors.extractYoutubeErrorReason(JSON.stringify({ error: "invalid_grant" })) === "invalid_grant", "OAuth token-endpoint error shape parsed");
  assert(errors.classifyYoutubeError(new Error("YouTube chunk upload failed (503): x")) === "BACKEND", "Legacy plain-Error 503 still classified BACKEND");
  assert(errors.classifyYoutubeError(new Error("fetch failed")) === "NETWORK", "fetch failure → NETWORK");
  assert(!errors.isTransientYoutubeError(new errors.YoutubeApiError({ kind: "QUOTA", status: 403, reason: "quotaExceeded", operation: "x" })), "QUOTA is not transient");
  assert(errors.isTerminalYoutubeError(new errors.YoutubeApiError({ kind: "QUOTA", status: 403, reason: "quotaExceeded", operation: "x" })), "QUOTA is terminal");
  const d = errors.backoffDelayMs(3, 800, 8000, () => 1);
  assert(d <= 8000 && errors.backoffDelayMs(0, 800, 8000, () => 0) === 400, "Backoff is jittered and capped");

  // ---- 2. Retry policy ---------------------------------------------------
  setEnv({ YOUTUBE_APP_REFRESH_TOKEN: "app-refresh" });

  reset();
  handler = (c) => (isToken(c) ? tokenOk : googleError(403, "quotaExceeded"));
  let thrown: any = null;
  try {
    await youtubeApi("APP", "/liveBroadcasts", { method: "POST", body: {}, sleep: noSleep });
  } catch (e) {
    thrown = e;
  }
  assert(thrown?.kind === "QUOTA" && apiCalls().length === 1, "Quota error: exactly one request, no retry", `calls=${apiCalls().length}`);

  reset();
  let n = 0;
  handler = (c) => (isToken(c) ? tokenOk : ++n < 3 ? googleError(503, "backendError") : { status: 200, body: { ok: true } });
  const ok = await youtubeApi<{ ok: boolean }>("APP", "/videos", { sleep: noSleep });
  assert(ok?.ok === true && apiCalls().length === 3, "503 twice then 200: retried with backoff and succeeded", `calls=${apiCalls().length}`);

  reset();
  handler = (c) => (isToken(c) ? tokenOk : googleError(403, "rateLimitExceeded"));
  thrown = null;
  try {
    await youtubeApi("APP", "/videos", { sleep: noSleep, maxRetries: 2 });
  } catch (e) {
    thrown = e;
  }
  assert(thrown?.kind === "RATE_LIMIT" && apiCalls().length === 3, "Rate limit gives up after maxRetries", `calls=${apiCalls().length}`);

  reset();
  n = 0;
  handler = (c) => (isToken(c) ? tokenOk : ++n === 1 ? { status: 401, body: {} } : { status: 200, body: {} });
  await youtubeApi("APP", "/videos", { sleep: noSleep });
  assert(calls.filter(isToken).length === 2 && apiCalls().length === 2, "401: token refreshed once, request retried once");

  reset();
  handler = (c) => (isToken(c) ? { status: 400, body: { error: "invalid_grant" } } : { status: 200, body: {} });
  thrown = null;
  try {
    await youtubeApi("APP", "/videos", { sleep: noSleep });
  } catch (e) {
    thrown = e;
  }
  assert(thrown?.kind === "AUTH_REVOKED" && apiCalls().length === 0, "Revoked refresh token: AUTH_REVOKED, no API call");

  // ---- 3. Channel isolation ---------------------------------------------
  setEnv({ YOUTUBE_APP_REFRESH_TOKEN: "app-refresh", YOUTUBE_MAIN_REFRESH_TOKEN: "main-refresh" });
  reset();
  handler = (c) => (isToken(c) ? tokenOk : { status: 200, body: { items: [] } });
  await youtubeApi("APP", "/videos");
  await youtubeApi("MAIN", "/videos");
  const tokenBodies = calls.filter(isToken).map((c) => new URLSearchParams(c.body).get("refresh_token"));
  assert(
    tokenBodies.length === 2 && tokenBodies[0] === "app-refresh" && tokenBodies[1] === "main-refresh",
    "APP and MAIN each use their own refresh token",
    JSON.stringify(tokenBodies)
  );

  reset();
  thrown = null;
  try {
    await youtubeApi("MAIN", "/liveBroadcasts", { method: "POST", body: {} });
  } catch (e) {
    thrown = e;
  }
  assert(thrown?.reason === "mainChannelReadOnly" && calls.length === 0, "MAIN channel refuses writes before any network call");

  setEnv({ YOUTUBE_APP_REFRESH_TOKEN: "same", YOUTUBE_MAIN_REFRESH_TOKEN: "same" });
  reset();
  thrown = null;
  try {
    await youtubeApi("APP", "/videos");
  } catch (e) {
    thrown = e;
  }
  assert(thrown?.kind === "CONFIG" && calls.length === 0, "Same refresh token on both channels is rejected");

  setEnv({ YOUTUBE_REFRESH_TOKEN: "legacy-refresh" });
  assert(channels.youtubeChannelConfigured("APP") && !channels.youtubeChannelConfigured("MAIN"), "Legacy YOUTUBE_REFRESH_TOKEN still configures APP only");

  // ---- 4. Channel identity verification ----------------------------------
  setEnv({ YOUTUBE_APP_REFRESH_TOKEN: "app-refresh", YOUTUBE_APP_CHANNEL_ID: "UC_APP" });
  reset();
  handler = (c) =>
    isToken(c) ? tokenOk : isChannels(c) ? { status: 200, body: { items: [{ id: "UC_MAIN", snippet: { title: "Main" } }] } } : { status: 200, body: {} };
  thrown = null;
  try {
    await youtubeApi("APP", "/liveBroadcasts", { method: "POST", body: {} });
  } catch (e) {
    thrown = e;
  }
  assert(
    thrown?.reason === "channelIdentityMismatch" && apiCalls().length === 0,
    "Token for the wrong channel: refused before creating anything"
  );

  reset();
  handler = (c) =>
    isToken(c) ? tokenOk : isChannels(c) ? { status: 200, body: { items: [{ id: "UC_APP" }] } } : { status: 200, body: {} };
  await youtubeApi("APP", "/videos");
  await youtubeApi("APP", "/videos");
  assert(calls.filter(isChannels).length === 1 && apiCalls().length === 2, "Correct channel: verified once, then cached");

  // ---- 5. Broadcast insert: no quota retry storm ------------------------
  setEnv({ YOUTUBE_APP_REFRESH_TOKEN: "app-refresh" });
  reset();
  handler = (c) => (isToken(c) ? tokenOk : googleError(403, "quotaExceeded"));
  thrown = null;
  try {
    await createLiveBroadcast("Physics", new Date().toISOString());
  } catch (e) {
    thrown = e;
  }
  const inserts = apiCalls().filter((c) => c.url.includes("/liveBroadcasts")).length;
  assert(thrown?.kind === "QUOTA" && inserts === 1, "Quota on insert: 1 insert attempt (was up to 4 × 50 units)", `inserts=${inserts}`);

  reset();
  n = 0;
  handler = (c) => {
    if (isToken(c)) return tokenOk;
    if (c.url.includes("/liveBroadcasts")) return ++n === 1 ? googleError(400, "invalidLatencyPreference") : { status: 200, body: { id: "BCAST1234567", snippet: { liveChatId: "chat" } } };
    return { status: 200, body: {} };
  };
  const created = await createLiveBroadcast("Physics", new Date().toISOString());
  assert(created.id === "BCAST1234567" && n === 2, "Validation rejection still falls back to the next config variant");

  const insertBody = JSON.parse(apiCalls().find((c) => c.url.includes("/liveBroadcasts"))!.body);
  assert(insertBody?.status?.privacyStatus === "unlisted", "Broadcasts are created unlisted");

  console.log(`\n${passCount} passed, ${failCount} failed`);
  if (failCount > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
