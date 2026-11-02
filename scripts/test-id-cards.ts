/**
 * ID cards — pure logic tests (no database).
 *   npx tsx scripts/test-id-cards.ts
 */
import assert from "node:assert/strict";
import QRCode from "qrcode";
import {
  academicYearLabel,
  formatCardDate,
  isValidPublicToken,
  maskIdentifier,
  nameFontPx,
  safeImageUrl,
  verificationState,
} from "../src/lib/id-card/format";
import { photoProblem, sniffImage } from "../src/lib/id-card/image-sniff";
import { escapeHtml, renderIdCardHtml, type IdCardModel } from "../src/lib/id-card/render";
import { qrSvg } from "../src/lib/id-card/qr";
import { formatEnrollmentNumber, generateEnrollmentNumber, legacyEnrollmentSpelling } from "../src/lib/utils/id-generator";
import { planNormalization } from "./normalize-enrollment-numbers";
import { idCardEmail, idCardPagePath, idCardWhatsApp } from "../src/lib/id-card/email";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

console.log("enrollment numbers");
test("display strips dashes / spaces and upper-cases", () => {
  assert.equal(formatEnrollmentNumber("AP-2026-123456"), "AP2026123456");
  assert.equal(formatEnrollmentNumber("ap 2026 123456"), "AP2026123456");
  assert.equal(formatEnrollmentNumber("AP2026123456"), "AP2026123456");
  assert.equal(formatEnrollmentNumber(null), "");
});
test("new numbers have no separators", () => {
  for (let i = 0; i < 50; i++) assert.match(generateEnrollmentNumber(), /^AP\d{4}\d{6}$/);
});
test("legacy spelling of a dashless number", () => {
  assert.equal(legacyEnrollmentSpelling("AP2026123456"), "AP-2026-123456");
  assert.equal(legacyEnrollmentSpelling("XYZ"), null);
});
test("normalisation plan: changes, keeps clean ones, skips collisions", () => {
  const { changes, skipped } = planNormalization([
    { id: "a", enrollmentNumber: "AP-2026-111111" },
    { id: "b", enrollmentNumber: "AP2026222222" },
    { id: "c", enrollmentNumber: "AP-2026-222222" }, // dashless form already b's
    { id: "d", enrollmentNumber: "AP-2025-333333" },
    { id: "e", enrollmentNumber: "AP 2025 333333" }, // d and e collapse together
  ]);
  assert.deepEqual(changes, [{ id: "a", old: "AP-2026-111111", next: "AP2026111111" }]);
  assert.deepEqual(skipped.map((s) => s.id).sort(), ["c", "d", "e"]);
});

console.log("formatting");
test("dates in IST, short month", () => {
  assert.equal(formatCardDate(new Date("1998-04-14T20:00:00Z")), "15 Apr 1998"); // 01:30 IST next day
  assert.equal(formatCardDate(null), null);
  assert.equal(formatCardDate("not a date"), null);
});
test("academic year from batch dates, else Apr–Mar session", () => {
  assert.equal(academicYearLabel({ batchStart: new Date("2026-04-01"), batchEnd: new Date("2027-03-31") }), "2026–2027");
  assert.equal(academicYearLabel({ batchStart: new Date("2026-06-01"), batchEnd: new Date("2026-12-01") }), "2026–2027");
  assert.equal(academicYearLabel({ fallbackDate: new Date("2026-02-10") }), "2025–2026");
  assert.equal(academicYearLabel({ fallbackDate: new Date("2026-05-10") }), "2026–2027");
  assert.equal(academicYearLabel({ fallbackDate: new Date("2026-03-31T19:00:00Z") }), "2026–2027"); // 1 Apr 00:30 IST
});
test("public masking hides the middle", () => {
  assert.equal(maskIdentifier("AP-2026-482731"), "AP2026••••31");
  assert.ok(!maskIdentifier("AP2026482731").includes("4827"));
});
test("long names get smaller", () => {
  assert.ok(nameFontPx("Mohammad Abdul Rahman Siddiqui Khan") < nameFontPx("Firoz Ali"));
});
test("only http(s) images", () => {
  assert.equal(safeImageUrl("javascript:alert(1)"), null);
  assert.equal(safeImageUrl("data:image/png;base64,AAA"), null);
  assert.equal(safeImageUrl("https://cdn.example.com/a.jpg"), "https://cdn.example.com/a.jpg");
});

console.log("verification");
test("token format", () => {
  assert.ok(isValidPublicToken("AbCdEfGhIjKlMnOpQrStUv"));
  assert.ok(!isValidPublicToken("clx123")); // a cuid / db id never passes
  assert.ok(!isValidPublicToken("../../etc/passwd_xxxxx"));
});
test("revoked never valid; inactive never active", () => {
  const base = { kind: "TEAM" as const, cardStatus: "ACTIVE" as const, userStatus: "ACTIVE", hasRole: true };
  assert.equal(verificationState(base), "ACTIVE");
  assert.equal(verificationState({ ...base, cardStatus: "REVOKED" }), "REVOKED");
  assert.equal(verificationState({ ...base, userStatus: "SUSPENDED" }), "INACTIVE");
  assert.equal(verificationState({ ...base, hasRole: false }), "INACTIVE");
  const st = { kind: "STUDENT" as const, cardStatus: "ACTIVE" as const, userStatus: "ACTIVE", hasRole: false };
  assert.equal(verificationState({ ...st, studentStatus: "ACTIVE" }), "ACTIVE");
  assert.equal(verificationState({ ...st, studentStatus: "GRADUATED" }), "ALUMNI");
  assert.equal(verificationState({ ...st, studentStatus: "DROPPED" }), "INACTIVE");
  assert.equal(verificationState({ ...st, studentStatus: "ACTIVE", cardStatus: "REVOKED" }), "REVOKED");
});

console.log("photo validation");
const png = (w: number, h: number) => {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return b;
};
const jpeg = (w: number, h: number) =>
  new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 0, 0, 0, 0]);
test("reads PNG / JPEG / WEBP size from bytes", () => {
  assert.deepEqual(sniffImage(png(600, 750)), { type: "image/png", width: 600, height: 750 });
  assert.deepEqual(sniffImage(jpeg(720, 900)), { type: "image/jpeg", width: 720, height: 900 });
  const webp = new Uint8Array(30);
  webp.set([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBPVP8X")]);
  webp.set([0xcf, 0x02, 0x00, 0x83, 0x03, 0x00], 24); // 720 x 900
  assert.deepEqual(sniffImage(webp), { type: "image/webp", width: 720, height: 900 });
});
test("rejects fakes, tiny and huge images", () => {
  assert.equal(sniffImage(new TextEncoder().encode("<?php echo 1; ?> pretending to be a jpg")), null);
  assert.match(photoProblem(null, 1000)!, /not a valid/);
  assert.match(photoProblem(sniffImage(png(100, 120)), 1000)!, /too small/);
  assert.match(photoProblem(sniffImage(png(600, 750)), 4 * 1024 * 1024)!, /too large/);
  assert.equal(photoProblem(sniffImage(png(600, 750)), 200_000), null);
});

console.log("card markup");
const card: IdCardModel = {
  kind: "STUDENT",
  name: `<script>alert("x")</script>`,
  photoUrl: "https://cdn.example.com/p.jpg",
  badge: null,
  enrollmentNumber: "AP2026482731",
  rows: [{ icon: "mail", label: "Email", value: `a"onerror="x@b.com` }],
  rank: null,
  verifyUrl: "https://ap.atomicpathshala.in/verify/AbCdEfGhIjKlMnOpQrStUv",
  qrSvg: qrSvg("https://ap.atomicpathshala.in/verify/AbCdEfGhIjKlMnOpQrStUv"),
  revoked: false,
};
test("all text is escaped", () => {
  const html = renderIdCardHtml(card, { mode: "screen", logoSrc: "/brand/logo.png" });
  assert.ok(!html.includes("<script>alert"));
  assert.ok(html.includes(escapeHtml(`<script>alert("x")</script>`)));
  assert.ok(!html.includes(`a"onerror`));
});
test("no rank badge without a rank; badge when there is one", () => {
  assert.ok(!renderIdCardHtml(card, { mode: "screen", logoSrc: "x" }).includes('class="abs rank"'));
  const ranked = renderIdCardHtml({ ...card, rank: { title: "Test Rank", value: "#12", sub: "of 340" } }, { mode: "screen", logoSrc: "x" });
  assert.ok(ranked.includes('class="abs rank"') && ranked.includes("#12") && !/AIR|All India/i.test(ranked));
});
test("pdf mode is CR80 size; signature image used when given", () => {
  const html = renderIdCardHtml(card, { mode: "pdf", logoSrc: "x", signatureSrc: "data:image/png;base64,AAA" });
  assert.ok(html.includes("2.125in 3.37in"));
  assert.ok(html.includes('class="sig-img"') && !html.includes('class="sig-script"'));
  assert.ok(renderIdCardHtml(card, { mode: "pdf", logoSrc: "x" }).includes('class="sig-script"'));
});
test("revoked cards carry the watermark", () => {
  assert.ok(renderIdCardHtml({ ...card, revoked: true }, { mode: "screen", logoSrc: "x" }).includes(">REVOKED<"));
});
test("QR svg encodes exactly the verify URL's modules, filled (no strokes)", () => {
  const url = card.verifyUrl;
  const svg = qrSvg(url);
  assert.ok(!svg.includes("stroke"));
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const grid = new Array(n * n).fill(0);
  for (const m of svg.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    const [x, y, run] = [Number(m[1]), Number(m[2]), Number(m[3])];
    for (let i = 0; i < run; i++) grid[y * n + x + i] = 1;
  }
  assert.deepEqual(grid, Array.from(qr.modules.data, (v) => (v ? 1 : 0)));
});

console.log("emails");
test("card email: attachment wording + card page link", () => {
  const m = idCardEmail({ mode: "card", kind: "STUDENT", name: "Aman Kumar", baseUrl: "https://ap.atomicpathshala.in" });
  assert.match(m.subject, /Student ID Card/);
  assert.ok(m.html.includes('https://ap.atomicpathshala.in/id-card"') && m.html.includes("attached"));
  assert.ok(m.html.includes("Dear Aman,"));
  assert.ok(!m.html.includes("photo is missing"));
});
test("photo-missing email: exact message + direct upload link", () => {
  const m = idCardEmail({ mode: "nophoto", kind: "TEAM", name: "Nigar Rao", baseUrl: "https://ap.atomicpathshala.in" });
  assert.ok(m.html.includes("Your photo is missing. Kindly upload your photo and re-download your ID card."));
  assert.ok(m.html.includes("https://ap.atomicpathshala.in/team/id-card#photo"));
  assert.ok(m.text.includes("/team/id-card#photo"));
});
test("names are escaped in emails; page paths per kind", () => {
  const m = idCardEmail({ mode: "card", kind: "STUDENT", name: "<b>x</b>", baseUrl: "https://a.in" });
  assert.ok(!m.html.includes("<b>x</b>"));
  assert.equal(idCardPagePath("STUDENT", true), "/id-card#photo");
  assert.equal(idCardPagePath("TEAM"), "/team/id-card");
});

test("WhatsApp: card and photo-missing texts + template params", () => {
  const c = idCardWhatsApp({ mode: "card", kind: "STUDENT", name: "Aman Kumar", baseUrl: "https://ap.atomicpathshala.in" });
  assert.ok(c.text.startsWith("Dear Aman,") && c.text.includes("https://ap.atomicpathshala.in/id-card"));
  assert.deepEqual(c.params, { "1": "Aman", "2": "https://ap.atomicpathshala.in/id-card" });
  const n = idCardWhatsApp({ mode: "nophoto", kind: "TEAM", name: "Nigar Rao", baseUrl: "https://ap.atomicpathshala.in" });
  assert.ok(n.text.includes("your photo is missing. Kindly upload your photo and re-download your ID card."));
  assert.equal(n.params["2"], "https://ap.atomicpathshala.in/team/id-card#photo");
});

console.log(`\n${passed} passed`);
