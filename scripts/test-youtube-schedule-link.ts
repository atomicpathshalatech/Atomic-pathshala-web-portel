/**
 * The YouTube link typed into a class: every common link form is read,
 * and a video YouTube won't play inside the app is refused with a clear
 * reason. No network — the embed check is stubbed.
 *
 *   npx tsx scripts/test-youtube-schedule-link.ts
 */
import { checkScheduleYouTubeLink } from "../src/lib/youtube/schedule-link";
import type { EmbedCheck } from "../src/lib/youtube/video-link";

let passed = 0;
let failed = 0;
const ok = (cond: unknown, name: string, detail?: unknown) => {
  if (cond) {
    passed++;
    console.log(`  [PASS] ${name}`);
  } else {
    failed++;
    console.log(`  [FAIL] ${name}${detail !== undefined ? ` -> ${JSON.stringify(detail)}` : ""}`);
  }
};
const stub = (r: EmbedCheck) => async () => r;
const ID = "4AgMENEJDKw";

async function main() {
  for (const link of [
    `https://www.youtube.com/watch?v=${ID}`,
    `www.youtube.com/watch?v=${ID}`,
    `youtube.com/watch?v=${ID}&t=120s`,
    `https://m.youtube.com/watch?feature=share&v=${ID}`,
    `https://www.youtube.com/watch?si=abc123&v=${ID}`,
    `https://youtu.be/${ID}?si=xyz`,
    `https://www.youtube.com/live/${ID}?feature=share`,
    `https://youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    ID,
  ]) {
    const r = await checkScheduleYouTubeLink(link, stub("ok"));
    ok(r.ok && r.videoId === ID && r.url === `https://www.youtube.com/watch?v=${ID}`, `reads ${link}`, r);
  }
  const bad = await checkScheduleYouTubeLink("https://www.youtube.com/@atomicpathshala", stub("ok"));
  ok(!bad.ok && /YouTube वीडियो का link नहीं/.test(bad.error), "channel link refused");
  const priv = await checkScheduleYouTubeLink(ID, stub("not_found"));
  ok(!priv.ok && /Private/.test(priv.error), "private / deleted video refused");
  const emb = await checkScheduleYouTubeLink(ID, stub("not_embeddable"));
  ok(!emb.ok && /Allow embedding/.test(emb.error), "embedding-off video refused");
  const net = await checkScheduleYouTubeLink(ID, stub("unknown"));
  ok(net.ok, "a network hiccup never blocks saving");

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main();
