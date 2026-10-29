/**
 * Recorded lectures + lecture summaries — logic tests (no network, no DB).
 *
 *   npx tsx scripts/test-recorded-lectures.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolveRecordedStorageConfig, DEFAULT_MAX_BYTES } from "../src/lib/recorded-lectures/config";
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

  console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
})();
