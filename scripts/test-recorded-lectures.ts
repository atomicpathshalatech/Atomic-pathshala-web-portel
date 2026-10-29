/**
 * Recorded lectures + lecture summaries — logic tests (no network, no DB).
 *
 *   npx tsx scripts/test-recorded-lectures.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolveRecordedStorageConfig, DEFAULT_MAX_BYTES } from "../src/lib/recorded-lectures/config";
import { clampToLive, livePositionSec, parseIstLocal, pickPremiere, premiereEnd, premiereState, toIstLocal } from "../src/lib/recorded-lectures/premiere";
import { canStudentJoinClass, canTeacherStartClass, getEffectiveScheduleStatus } from "../src/lib/schedule/access-rules";
import {
  checkVideoDeclaration,
  sniffVideo,
  sniffMatches,
  partSizeFor,
  partCountFor,
  videoObjectKey,
  watermarkLabel,
  MIN_PART_BYTES,
  MAX_PARTS,
} from "../src/lib/recorded-lectures/files";
import {
  buildSummaryPrompt,
  parseSummaryResponse,
  summaryToMarkdown,
  aboutWordCount,
  MIN_ABOUT_WORDS,
} from "../src/lib/recorded-lectures/summary-format";
import { RecordedVideoUploader, type UploadProgress } from "../src/lib/recorded-lectures/uploader";
import { buildSummaryTranslationPrompt, checkSummaryTranslation, sameSummaryLanguage } from "../src/lib/recorded-lectures/summary-format";
import {
  parseTranscriptWindow,
  toVtt,
  lectureSourceText,
  notesSourceText,
  buildNotesPrompt,
  parseNotesResponse,
} from "../src/lib/recorded-lectures/ai/format";

let passed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${(err as Error).message}`);
    process.exitCode = 1;
  }
}

const NEW = {
  RECORDED_R2_ACCOUNT_ID: "acct-new",
  RECORDED_R2_ACCESS_KEY_ID: "key-new",
  RECORDED_R2_SECRET_ACCESS_KEY: "secret-new",
  RECORDED_R2_BUCKET_NAME: "atomic-recorded-lectures",
};
const OLD = {
  CLOUDFLARE_ACCOUNT_ID: "acct-main",
  R2_ACCESS_KEY_ID: "key-main",
  R2_SECRET_ACCESS_KEY: "secret-main",
  R2_BUCKET_NAME: "atomic-pathshala",
  R2_PRIVATE_BUCKET_NAME: "atomic-private",
};

(async () => {
  console.log("Storage isolation");
  await test("1. new uploads use only the RECORDED_R2_* configuration", () => {
    const r = resolveRecordedStorageConfig({ ...OLD, ...NEW });
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.config.accountId, "acct-new");
    assert.equal(r.config.accessKeyId, "key-new");
    assert.equal(r.config.bucket, "atomic-recorded-lectures");
    assert.equal(r.config.endpoint, "https://acct-new.r2.cloudflarestorage.com");
    assert.equal(r.config.maxBytes, DEFAULT_MAX_BYTES);
  });
  await test("3. missing new credentials do NOT fall back to the main account", () => {
    const r = resolveRecordedStorageConfig({ ...OLD });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.problems.length, 4);
    assert.ok(r.problems.some((p) => p.includes("RECORDED_R2_ACCESS_KEY_ID")));
  });
  await test("partial new config is refused with the exact missing settings", () => {
    const r = resolveRecordedStorageConfig({ ...OLD, RECORDED_R2_ACCOUNT_ID: "acct-new", RECORDED_R2_BUCKET_NAME: "b" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.deepEqual(r.problems, ["RECORDED_R2_ACCESS_KEY_ID is missing", "RECORDED_R2_SECRET_ACCESS_KEY is missing"]);
  });
  await test("pointing the new config at the main account / key / bucket is refused", () => {
    const sameAccount = resolveRecordedStorageConfig({ ...OLD, ...NEW, RECORDED_R2_ACCOUNT_ID: "acct-main" });
    assert.equal(sameAccount.ok, false);
    const sameKey = resolveRecordedStorageConfig({ ...OLD, ...NEW, RECORDED_R2_ACCESS_KEY_ID: "key-main" });
    assert.equal(sameKey.ok, false);
    const sameBucketSameAccount = resolveRecordedStorageConfig({
      ...OLD,
      ...NEW,
      RECORDED_R2_ACCOUNT_ID: "acct-main",
      RECORDED_R2_BUCKET_NAME: "atomic-pathshala",
    });
    assert.equal(sameBucketSameAccount.ok, false);
  });
  await test("custom endpoint and size limit are honoured", () => {
    const r = resolveRecordedStorageConfig({ ...NEW, RECORDED_R2_ENDPOINT: "https://media.example.com/", RECORDED_LECTURE_MAX_BYTES: "1073741824" });
    assert.ok(r.ok);
    if (r.ok) {
      assert.equal(r.config.endpoint, "https://media.example.com");
      assert.equal(r.config.maxBytes, 1073741824);
    }
  });
  await test("2/4. the existing R2 clients are unchanged by this work", () => {
    const changed = execSync("git diff --name-only origin/main -- src/lib/storage src/app/api/storage", { encoding: "utf8" }).trim();
    assert.equal(changed, "", `existing storage files modified: ${changed}`);
    const storageSrc = readFileSync("src/lib/recorded-lectures/storage.ts", "utf8");
    assert.ok(!/process\.env\.(R2_|CLOUDFLARE_ACCOUNT_ID)/.test(storageSrc), "recorded storage must not read the main R2 env vars");
    assert.ok(!/@\/lib\/storage/.test(storageSrc), "recorded storage must not import the main storage client");
    assert.ok(!/DeleteObjectCommand/.test(storageSrc), "recorded storage must not delete objects");
  });

  console.log("Upload files");
  await test("video declaration: allowed types, size limit, mismatched type", () => {
    assert.deepEqual(checkVideoDeclaration({ name: "L01.mp4", size: 100, type: "video/mp4" }, 1000), { ok: true, mimeType: "video/mp4" });
    assert.deepEqual(checkVideoDeclaration({ name: "L01.MOV", size: 100, type: "" }, 1000), { ok: true, mimeType: "video/quicktime" });
    assert.equal(checkVideoDeclaration({ name: "notes.pdf", size: 100, type: "application/pdf" }, 1000).ok, false);
    assert.equal(checkVideoDeclaration({ name: "fake.mp4", size: 100, type: "application/pdf" }, 1000).ok, false);
    assert.equal(checkVideoDeclaration({ name: "big.mp4", size: 2000, type: "video/mp4" }, 1000).ok, false);
    assert.equal(checkVideoDeclaration({ name: "empty.mp4", size: 0, type: "video/mp4" }, 1000).ok, false);
  });
  await test("file signature check (not the file name) decides if it is a video", () => {
    const mp4 = new Uint8Array([0, 0, 0, 0x20, ...Buffer.from("ftypisom"), 0, 0, 0, 0]);
    const mov = new Uint8Array([0, 0, 0, 0x14, ...Buffer.from("ftypqt  "), 0, 0, 0, 0]);
    const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4, 5, 6, 7, 8]);
    const pdf = new Uint8Array(Buffer.from("%PDF-1.7 renamed to mp4"));
    assert.equal(sniffVideo(mp4), "video/mp4");
    assert.equal(sniffVideo(mov), "video/quicktime");
    assert.equal(sniffVideo(webm), "video/webm");
    assert.equal(sniffVideo(pdf), null);
    assert.ok(sniffMatches("video/mp4", "video/quicktime"));
    assert.ok(!sniffMatches("video/mp4", null));
    assert.ok(!sniffMatches("video/webm", "video/mp4"));
  });
  await test("6. part sizes keep any file within R2 multipart limits", () => {
    for (const size of [1, 50 * 1024 ** 2, 2 * 1024 ** 3, 10 * 1024 ** 3, 150 * 1024 ** 3]) {
      const part = partSizeFor(size);
      assert.ok(part >= MIN_PART_BYTES);
      assert.ok(partCountFor(size, part) <= MAX_PARTS, `too many parts for ${size}`);
    }
    assert.equal(partSizeFor(2 * 1024 ** 3), 16 * 1024 ** 2);
  });
  await test("object keys are stable, scoped and never contain user text", () => {
    const k = videoObjectKey({ courseId: "c1", chapterId: "ch../2", lectureId: "l 3", uploadToken: "u-1", mimeType: "video/webm" });
    assert.equal(k, "lectures/c1/ch2/l3/u-1.webm");
  });
  await test("watermark masks the student id and shortens the name", () => {
    assert.equal(watermarkLabel("Ravi Kumar Sharma", "STU2026001234"), "Ravi S. · ****1234");
    assert.equal(watermarkLabel("Anjali", ""), "Anjali");
    assert.equal(watermarkLabel(null, "123"), "Student · ****");
  });

  console.log("Lecture summary (from the teacher's About only)");
  const about =
    "Topics: ionic bond, covalent bond and Fajan's rule. Formula: bond order = (Nb - Na)/2. Example: AlCl3 is covalent because Al3+ is small and highly charged. Common mistake: students think every metal-nonmetal bond is ionic. Homework: NCERT exercise 4.1 to 4.10.";
  await test("16/17. prompt is built from the About alone and forbids additions", () => {
    const p = buildSummaryPrompt({ about, title: "Chemical Bonding L03", subject: "Chemistry", chapter: "Chemical Bonding", language: "English" });
    assert.ok(p.includes(about));
    assert.ok(/Use ONLY what the notes say/.test(p));
    assert.ok(/Do NOT add concepts, formulas/.test(p));
    assert.ok(/Never invent homework/.test(p));
    assert.ok(/NCERT page numbers/.test(p));
    const hi = buildSummaryPrompt({ about, title: "t", subject: "s", chapter: "c", language: "Hindi" });
    assert.ok(/Hindi \(Devanagari\)/.test(hi));
  });
  await test("short About is rejected before any AI call", () => {
    assert.ok(aboutWordCount(about) >= MIN_ABOUT_WORDS);
    assert.ok(aboutWordCount("Chemical bonding lecture") < MIN_ABOUT_WORDS);
  });
  await test("AI response validation: insufficient, empty, unknown sections, no topics", () => {
    const ins = parseSummaryResponse({ insufficient: true, reason: "Add the formulas taught." });
    assert.deepEqual(ins, { ok: false, insufficient: true, error: "Add the formulas taught." });
    assert.equal(parseSummaryResponse(null).ok, false);
    assert.equal(parseSummaryResponse({ sections: {} }).ok, false);
    const noTopics = parseSummaryResponse({ sections: { checklist: ["Revise"] } });
    assert.equal(noTopics.ok, false);
    const ok = parseSummaryResponse({ sections: { topics: ["Ionic bond", " "], evil: ["<script>"], formulas: [] } });
    assert.ok(ok.ok);
    if (ok.ok) {
      assert.deepEqual(ok.sections.topics, ["Ionic bond"]);
      assert.equal((ok.sections as Record<string, unknown>).evil, undefined);
      assert.equal(ok.sections.formulas, undefined);
    }
  });
  await test("Markdown has only sections with content; checklist and Hindi headings", () => {
    const md = summaryToMarkdown({ topics: ["Ionic bond"], checklist: ["Can I state Fajan's rule?"] }, "English");
    assert.equal(md, "### Topics Covered\n- Ionic bond\n\n### Revision Checklist\n- [ ] Can I state Fajan's rule?");
    assert.ok(!md.includes("Homework"));
    const hi = summaryToMarkdown({ topics: ["आयनिक बंध"] }, "Hindi");
    assert.ok(hi.startsWith("### पढ़ाए गए विषय"));
  });

  console.log("Browser upload (simulated R2)");
  await test("7. interrupted parts are retried, a resumed upload sends only missing parts, parts are slices", async () => {
    const size = 40 * 1024 * 1024 + 123; // 3 parts of 16 MiB
    const file = new File([new Uint8Array(size)], "lecture.mp4", { type: "video/mp4" });
    const stored = new Map<number, number>();
    const putAttempts = new Map<number, number>();
    let maxBodyBytes = 0;
    let completed: { partNumber: number; etag: string }[] | null = null;
    let initCalls = 0;
    const partSize = 16 * 1024 * 1024;

    (globalThis as any).document = {
      createElement: () => {
        const v: any = {};
        setTimeout(() => v.onerror?.(), 0);
        return v;
      },
    };
    (globalThis as any).URL.createObjectURL = () => "blob:x";
    (globalThis as any).URL.revokeObjectURL = () => undefined;
    (globalThis as any).fetch = async (_url: string, init: any) => {
      const body = JSON.parse(init.body);
      const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });
      if (body.action === "init") {
        initCalls++;
        return ok({ partSize, partCount: 3, uploadedParts: Array.from(stored.keys()).map((n) => ({ partNumber: n, etag: `"e${n}"` })), resumed: stored.size > 0 });
      }
      if (body.action === "sign") return ok({ urls: body.partNumbers.map((n: number) => ({ partNumber: n, url: `https://r2/part/${n}` })) });
      if (body.action === "parts") return ok({ parts: Array.from(stored.keys()).map((n) => ({ partNumber: n, etag: `"e${n}"` })) });
      if (body.action === "complete") {
        completed = body.parts;
        return ok({ verified: true });
      }
      return ok({});
    };
    class FakeXHR {
      upload: any = {};
      status = 0;
      timeout = 0;
      onload: any;
      onerror: any;
      ontimeout: any;
      private url = "";
      open(_m: string, url: string) {
        this.url = url;
      }
      getResponseHeader() {
        return `"e${Number(this.url.split("/").pop())}"`;
      }
      send(blob: Blob) {
        const n = Number(this.url.split("/").pop());
        maxBodyBytes = Math.max(maxBodyBytes, blob.size);
        const attempt = (putAttempts.get(n) ?? 0) + 1;
        putAttempts.set(n, attempt);
        setTimeout(() => {
          // Part 2 fails twice (network drop), then succeeds.
          if (n === 2 && attempt <= 2) return this.onerror?.();
          stored.set(n, blob.size);
          this.status = 200;
          this.onload?.();
        }, 1);
      }
    }
    (globalThis as any).XMLHttpRequest = FakeXHR;
    // No real waiting between retries in the test.
    const realTimeout = globalThis.setTimeout;
    (globalThis as any).setTimeout = (fn: () => void, ms?: number) => realTimeout(fn, Math.min(ms ?? 0, 5));

    const progress: UploadProgress[] = [];
    const up = new RecordedVideoUploader("lec1", file, (p) => progress.push(p));
    const ok = await up.start();
    (globalThis as any).setTimeout = realTimeout;

    assert.ok(ok, progress.at(-1)?.message);
    assert.equal(putAttempts.get(2), 3, "part 2 retried after two failures");
    assert.ok(maxBodyBytes <= partSize, "no request carried more than one part");
    assert.deepEqual(completed?.map((p) => p.partNumber), [1, 2, 3]);
    assert.equal(stored.get(3), size - 2 * partSize);
    assert.equal(progress.at(-1)?.phase, "done");

    // Second run with everything already stored: nothing re-sent.
    const before = Array.from(putAttempts.values()).reduce((a, b) => a + b, 0);
    const again = await new RecordedVideoUploader("lec1", file, () => undefined).start();
    const after = Array.from(putAttempts.values()).reduce((a, b) => a + b, 0);
    assert.ok(again);
    assert.equal(after, before, "a resumed upload sends only the missing parts");
    assert.equal(initCalls, 2);
  });

  // ── Lecture AI pass (speech, board, dictation → notes) ──
  await test("video window: times move onto the video clock, bad items dropped, no overlaps", () => {
    const r = parseTranscriptWindow(
      {
        segments: [
          { s: 5, e: 9, t: "second" },
          { s: 0, e: 6, t: "first" },
          { s: 2, e: 3, t: "  " },
          { s: "x", e: 3, t: "bad" },
          { s: 900, e: 905, t: "outside the window" },
        ],
        board: [{ at: 4, c: "$v = u + at$" }, { at: -1, c: "bad" }],
        dictated: [{ at: 50, c: "Velocity is the rate of change of displacement." }, { at: 20, c: "" }],
      },
      600,
      1200
    );
    assert.deepEqual(r.segments, [
      { s: 600, e: 605, t: "first" },
      { s: 605, e: 609, t: "second" },
    ]);
    assert.deepEqual(r.board, [{ at: 604, c: "$v = u + at$" }]);
    assert.deepEqual(r.dictated, [{ at: 650, c: "Velocity is the rate of change of displacement." }]);
  });

  await test("a window answer without dictation still parses", () => {
    const r = parseTranscriptWindow({ segments: [], board: [{ at: 1, c: "Heading" }] }, 0, 600);
    assert.deepEqual(r.dictated, []);
    assert.equal(r.board.length, 1);
  });

  await test("WebVTT: header, timestamps, text", () => {
    const vtt = toVtt([{ s: 61.5, e: 64, t: "नमस्ते students" }]);
    assert.ok(vtt.startsWith("WEBVTT\n"));
    assert.ok(vtt.includes("00:01:01.500 --> 00:01:04.000"));
    assert.ok(vtt.includes("नमस्ते students"));
  });

  await test("notes source: board + dictation only, in time order (no speech)", () => {
    const txt = notesSourceText([{ at: 70, c: "$H_2O$" }], [{ at: 5, c: "Water is a compound." }]);
    assert.equal(txt, "[0:05] DICTATED: Water is a compound.\n[1:10] BOARD: $H_2O$");
    const all = lectureSourceText([{ s: 10, e: 12, t: "hello" }], [{ at: 5, c: "$H_2O$" }], [{ at: 20, c: "note" }]);
    assert.equal(all, "[0:05] BOARD: $H_2O$\n[0:10] SAID: hello\n[0:20] DICTATED: note");
  });

  await test("notes prompt forbids adding content and asks for the notebook structure", () => {
    const prompt = buildNotesPrompt({ source: "[0:05] BOARD: x", title: "T", subject: "Chemistry", chapter: "C", language: "Hindi" });
    assert.ok(prompt.includes("ONLY what is in the source"));
    assert.ok(prompt.includes("[Diagram:"));
    assert.ok(prompt.includes("Devanagari"));
  });

  await test("notes answer: Markdown with points accepted; empty / shapeless refused", () => {
    assert.deepEqual(parseNotesResponse({ empty: false, markdown: "### Bonds\n- Ionic bond\n> Important!" }), { ok: true, markdown: "### Bonds\n- Ionic bond\n> Important!" });
    assert.equal(parseNotesResponse({ empty: true }).ok, false);
    const empty = parseNotesResponse({ empty: true });
    assert.ok(!empty.ok && empty.empty);
    assert.equal(parseNotesResponse({ markdown: "just a sentence" }).ok, false);
    assert.equal(parseNotesResponse(null).ok, false);
  });

  await test("summary translation keeps headings, points and formulas", () => {
    const en = "### Topics Covered\n- Water is $\text{H}_2\text{O}$\n- [ ] Revise bonds";
    const hi = "### पढ़ाए गए विषय\n- जल $\text{H}_2\text{O}$ है\n- [ ] आबंध दोहराएँ";
    assert.equal(checkSummaryTranslation(en, hi), hi);
    assert.equal(checkSummaryTranslation(en, "### पढ़ाए गए विषय\n- जल $H_2O$ है\n- [ ] आबंध"), null, "a changed formula is refused");
    assert.equal(checkSummaryTranslation(en, "- जल $\text{H}_2\text{O}$\n- [ ] x"), null, "a dropped heading is refused");
    assert.ok(buildSummaryTranslationPrompt({ markdown: en, to: "hi", subject: "Chemistry" }).includes("NCERT"));
    assert.ok(sameSummaryLanguage("Hindi", "हिंदी") && !sameSummaryLanguage("Hindi", "English"));
  });

  await test("scheduled lecture: upcoming → live in its slot → ended", () => {
    const startsAt = new Date("2026-11-01T10:00:00Z");
    const endsAt = premiereEnd(startsAt, 4371);
    assert.equal(endsAt.getTime() - startsAt.getTime(), 4371 * 1000);
    assert.equal(premiereState({ startsAt, endsAt }, new Date("2026-11-01T09:59:59Z")), "UPCOMING");
    assert.equal(premiereState({ startsAt, endsAt }, new Date("2026-11-01T10:00:00Z")), "LIVE");
    assert.equal(premiereState({ startsAt, endsAt }, endsAt), "ENDED");
    // No duration known: a 1-hour slot.
    assert.equal(premiereEnd(startsAt, null).getTime() - startsAt.getTime(), 3600 * 1000);
  });

  await test("live point: where the class is now; no skipping past it", () => {
    const startsAt = new Date("2026-11-01T10:00:00Z");
    assert.equal(livePositionSec(startsAt, new Date("2026-11-01T10:05:00Z")), 300);
    assert.equal(livePositionSec(startsAt, new Date("2026-11-01T09:00:00Z")), 0);
    assert.equal(livePositionSec(startsAt, new Date("2026-11-01T12:00:00Z"), 4371), 4371);
    assert.equal(clampToLive(900, 300), 300, "a seek ahead goes back to the live point");
    assert.equal(clampToLive(120, 300), 120, "going back is allowed");
  });

  await test("which slot applies: the next one not over, else the last one", () => {
    const s = (start: string, end: string) => ({ startsAt: new Date(start), endsAt: new Date(end) });
    const a = s("2026-11-01T10:00:00Z", "2026-11-01T11:00:00Z");
    const b = s("2026-11-03T10:00:00Z", "2026-11-03T11:00:00Z");
    assert.equal(pickPremiere([b, a], new Date("2026-11-01T10:30:00Z")), a);
    assert.equal(pickPremiere([b, a], new Date("2026-11-02T10:00:00Z")), b);
    assert.equal(pickPremiere([b, a], new Date("2026-11-05T10:00:00Z")), b);
    assert.equal(pickPremiere([], new Date()), null);
  });

  await test("date/time input is India time", () => {
    const d = parseIstLocal("2026-11-01T15:30");
    assert.equal(d?.toISOString(), "2026-11-01T10:00:00.000Z");
    assert.equal(toIstLocal(d!), "2026-11-01T15:30");
    assert.equal(parseIstLocal("tomorrow"), null);
  });

  await test("schedule rules: a recorded slot is live by the clock, never 'cancelled' for no teacher", () => {
    const slot = { id: "x", startsAt: "2026-11-01T10:00:00Z", endsAt: "2026-11-01T11:00:00Z", status: "SCHEDULED", type: "LIVE_CLASS", classMode: "RECORDED" };
    assert.equal(getEffectiveScheduleStatus(slot, new Date("2026-11-01T09:00:00Z")), "SCHEDULED");
    assert.equal(getEffectiveScheduleStatus(slot, new Date("2026-11-01T10:40:00Z")), "LIVE");
    assert.equal(getEffectiveScheduleStatus(slot, new Date("2026-11-01T11:30:00Z")), "COMPLETED");
    assert.equal(canStudentJoinClass(slot, new Date("2026-11-01T09:59:00Z")).allowed, false);
    assert.equal(canStudentJoinClass(slot, new Date("2026-11-01T10:00:00Z")).allowed, true);
    assert.equal(canTeacherStartClass(slot, new Date("2026-11-01T10:00:00Z")).allowed, false);
    // An ordinary live class not started 40 minutes in is still treated as before.
    assert.notEqual(getEffectiveScheduleStatus({ ...slot, classMode: null }, new Date("2026-11-01T10:40:00Z")), "LIVE");
  });

  console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
})();
