// LOCAL ONLY: real HTTP requests to the local server's Sheet webhook, real YouTube oEmbed checks.
const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const BASE = "http://localhost:3111/api/integrations/lecture-sheet";
const SECRET = "local-test-secret-123";
let pass = 0, fail = 0;
const check = (ok, name, d) => { ok ? pass++ : fail++; console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : " → " + JSON.stringify(d)}`); };
const send = async (obj, { ts = String(Math.floor(Date.now() / 1000)), secret = SECRET, tamper = false } = {}) => {
  const body = JSON.stringify(obj);
  const sig = crypto.createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  const res = await fetch(BASE, { method: "POST", headers: { "Content-Type": "application/json", "x-atomic-timestamp": ts, "x-atomic-signature": sig }, body: tamper ? body.replace("}", ',"x":1}') : body });
  return { status: res.status, json: await res.json().catch(() => null) };
};
(async () => {
  if (!/localhost/.test(process.env.DATABASE_URL || "")) throw new Error("local only");
  const p = new PrismaClient();
  const user = await p.user.findFirstOrThrow({ where: { email: "qc-test@example.test" } });
  await p.batch.deleteMany({ where: { code: "HOOK-TEST" } });
  const batch = await p.batch.create({ data: { name: "Hook Test", code: "HOOK-TEST", createdById: user.id } });
  const s = await p.batchSchedule.create({ data: { batchId: batch.id, title: "Hook class", type: "LIVE_CLASS", startsAt: new Date(Date.now() - 3600e3), endsAt: new Date(), createdById: user.id } });

  let r = await send({ lecture_id: s.id, youtube_video_url: "https://youtu.be/C_-nYlIOEtY" }, { secret: "wrong" });
  check(r.status === 401, "wrong secret → 401", r);
  r = await send({ lecture_id: s.id, youtube_video_url: "https://youtu.be/C_-nYlIOEtY" }, { ts: String(Math.floor(Date.now() / 1000) - 900) });
  check(r.status === 401 && /old/.test(r.json?.error), "15-minute-old request → 401", r);
  r = await send({ lecture_id: s.id, youtube_video_url: "https://youtu.be/C_-nYlIOEtY" }, { tamper: true });
  check(r.status === 401, "body changed after signing → 401", r);
  r = await send({ lecture_id: "no-such-class", youtube_video_url: "https://youtu.be/C_-nYlIOEtY" });
  check(r.status === 200 && r.json?.status === "REJECTED", "unknown lecture_id → REJECTED", r.json);
  r = await send({ lecture_id: s.id, youtube_video_url: "https://youtu.be/cvS_ye9ixcA" });
  check(r.json?.status === "REJECTED" && /private, deleted/.test(r.json?.message), "a private/removed YouTube video (real check) → REJECTED", r.json);
  r = await send({ lecture_id: s.id, youtube_video_url: "https://youtu.be/C_-nYlIOEtY?si=abc" });
  const after = await p.batchSchedule.findUnique({ where: { id: s.id } });
  check(r.json?.status === "APPLIED" && after.youtubeUrl === "https://www.youtube.com/watch?v=C_-nYlIOEtY", "a real playable video → APPLIED and stored on the class", { json: r.json, url: after.youtubeUrl });
  r = await send({ lecture_id: s.id, youtube_video_url: "https://www.youtube.com/watch?v=C_-nYlIOEtY" });
  check(r.json?.status === "UNCHANGED", "the same video again → no change", r.json);

  await p.batch.delete({ where: { id: batch.id } });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
