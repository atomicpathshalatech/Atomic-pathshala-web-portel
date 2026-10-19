/**
 * PYQ Library — database-backed end-to-end checks on a DISPOSABLE local
 * database (never production; same guard as scripts/lib/test-db.ts).
 *
 *  1. Builds the pre-PYQ schema (merge-base with origin/main), inserts legacy
 *     PYQ-tagged questions, applies prisma/migrations/20261018000000_pyq_library
 *     and checks the database then matches prisma/schema.prisma exactly.
 *  2. Generates real PDFs (pdf-lib) and runs them through the import:
 *     single-year NEET 2024, a multi-year collection, a custom exam (IUPSC),
 *     a scanned page (OCR flow), a later paper repeating a question
 *     (duplicate -> linked occurrence), and a re-import of the same paper.
 *  3. Review/approval, year/chapter/exam filters, a module with reordering,
 *     custom items, the printable PDF (rendered with local Chrome/Edge), and
 *     linking a PYQ into a DPP and a Test.
 *
 * Run:
 *   TEST_DATABASE_URL="postgresql://postgres@localhost:5433/atomic_test" \
 *     npx tsx --conditions=react-server scripts/test-pyq-db.ts
 */
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createAsserts, requireTestDatabase } from "./lib/test-db";

// No AI in this test: the import must work on its own, and nothing may be
// sent to an outside service. (Keys shorter than 11 chars are ignored.)
process.env.GEMINI_FREE_KEYS = "disabled";
process.env.GEMINI_PAID_KEYS = "disabled";
process.env.GEMINI_API_KEY = "";
process.env.GEMINI_API_KEYS = "";

const { testUrl } = requireTestDatabase();
const { assert, finish } = createAsserts();
const env = { ...process.env, DATABASE_URL: testUrl, DIRECT_URL: testUrl };
const sh = (cmd: string) => execSync(cmd, { env, stdio: "pipe" }).toString();

// ---------------------------------------------------------------- PDF helpers
async function makePdf(pages: (string[] | "SCANNED")[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const lines of pages) {
    const page = doc.addPage([595, 842]);
    if (lines === "SCANNED") {
      // No text layer at all — like a scanned page.
      page.drawRectangle({ x: 60, y: 300, width: 460, height: 400, color: rgb(0.85, 0.85, 0.85) });
      continue;
    }
    let y = 800;
    for (const line of lines) {
      page.drawText(line, { x: 50, y, size: 10, font });
      y -= 16;
    }
  }
  return Buffer.from(await doc.save());
}

const Q = {
  kinetics: "The half-life of a first order reaction with rate constant 0.0693 per minute is",
  mitochondria: "Which organelle is called the powerhouse of the cell and contains cristae?",
  vague: "Which of the following is correct?",
  ohm: "The resistance of a wire is doubled when its length is stretched. The resistivity of the wire",
  photosynthesis: "During photosynthesis the light reaction takes place in the thylakoid membrane of the chloroplast. Which pigment acts as the reaction centre?",
  coordination: "The coordination number of the central metal ion in the complex ion [Co(NH3)6] 3+ is",
};

async function main() {
  // ----------------------------------------------------- 1. migration check
  const base = sh("git merge-base HEAD origin/main").trim();
  const dir = mkdtempSync(join(tmpdir(), "pyq-test-"));
  writeFileSync(join(dir, "schema.prisma"), sh(`git show ${base}:prisma/schema.prisma`));
  sh(`npx prisma db push --force-reset --skip-generate --accept-data-loss --schema "${join(dir, "schema.prisma")}"`);

  const { prisma } = await import("../src/lib/db");
  // Legacy PYQ tags written by the editor before this feature.
  await prisma.$executeRawUnsafe(`INSERT INTO "questions" ("id","subject","chapter","pyqExam","pyqYear","isPublished","status") VALUES
    ('legacy_neet19','Biology','Cell: The Unit of Life','NEET',2019,true,'PUBLISHED'),
    ('legacy_neet_noyear','Biology','Cell: The Unit of Life','NEET',NULL,true,'PUBLISHED'),
    ('legacy_jee19','Physics','Current Electricity','JEE_MAINS',2019,true,'PUBLISHED'),
    ('legacy_jee21','Physics','Current Electricity','JEE_MAINS',2021,true,'PUBLISHED'),
    ('legacy_jee24','Physics','Current Electricity','JEE_MAINS',2024,true,'PUBLISHED'),
    ('legacy_jee20_draft','Physics','Current Electricity','JEE_MAINS',2020,false,'DRAFT'),
    ('legacy_aiims','Biology',NULL,'AIIMS',2018,true,'PUBLISHED')`);
  for (const id of ["legacy_neet19", "legacy_neet_noyear", "legacy_jee19", "legacy_jee21", "legacy_jee24", "legacy_jee20_draft", "legacy_aiims"]) {
    await prisma.$executeRawUnsafe(`INSERT INTO "question_translations" ("id","questionId","language","statement","options","correctOptionIds") VALUES ($1,$2,'ENGLISH',$3,'{"A":"a","B":"b","C":"c","D":"d"}','["A"]')`, `tr_${id}`, id, `Legacy question ${id} about current and cells`);
  }

  sh(`npx prisma db execute --file prisma/migrations/20261018000000_pyq_library/migration.sql --schema prisma/schema.prisma`);
  // Shipped together with the PYQ Library (exercises reuse the same question bank).
  sh(`npx prisma db execute --file prisma/migrations/20261019000000_exercise_builder/migration.sql --schema prisma/schema.prisma`);
  let drift = "";
  try {
    sh(`npx prisma migrate diff --from-url "${testUrl}" --to-schema-datamodel prisma/schema.prisma --exit-code`);
  } catch (e: any) {
    drift = String(e.stdout ?? e.message).slice(0, 400);
  }
  assert(drift === "", "Migration brings the old database exactly to the new schema (no drift)", drift);

  const exams = await prisma.pyqExam.findMany();
  const neet = exams.find((e) => e.slug === "neet-ug")!;
  const jeeMain = exams.find((e) => e.slug === "jee-main")!;
  assert(Boolean(neet && jeeMain && exams.find((e) => e.slug === "jee-advanced")), "Seeded NEET UG, JEE Main, JEE Advanced");
  const aiims = exams.find((e) => e.legacyCode === "AIIMS");
  assert(Boolean(aiims) && aiims!.canonicalType === "OTHER", "Unknown legacy exam 'AIIMS' kept as its own exam (not renamed to NEET)");
  const legacyOcc = await prisma.pyqOccurrence.findMany();
  assert(legacyOcc.length === 7, "One occurrence backfilled per legacy-tagged question", String(legacyOcc.length));
  assert(legacyOcc.find((o) => o.questionId === "legacy_neet19")?.verificationStatus === "VERIFIED", "Published legacy tag -> VERIFIED");
  assert(legacyOcc.find((o) => o.questionId === "legacy_jee20_draft")?.verificationStatus === "UNVERIFIED", "Draft legacy tag -> UNVERIFIED");

  // ----------------------------------------------------- services
  const svc = await import("../src/lib/pyq/import-service");
  const pipe = await import("../src/lib/pyq/import-pipeline");
  const review = await import("../src/lib/pyq/review-service");
  const lib = await import("../src/lib/pyq/library-query");
  const examsSvc = await import("../src/lib/pyq/exams-service");
  const mod = await import("../src/lib/pyq/module-service");
  const html = await import("../src/lib/pyq/module-html");

  const user = await prisma.user.create({ data: { email: "pyq-admin@test.local", passwordHash: "x", name: "PYQ Admin" } });
  const startImport = async (pdf: Buffer, o: { examId: string; yearMode: "SINGLE" | "MULTI"; year?: number | null; title: string; subject?: string | null }) => {
    const job = await svc.createPyqImportJob({
      userId: user.id,
      examId: o.examId,
      yearMode: o.yearMode,
      year: o.year ?? null,
      subject: o.subject ?? null,
      sourceTitle: o.title,
      fileName: `${o.title}.pdf`,
      fileUrl: `https://files.example.test/${encodeURIComponent(o.title)}.pdf`,
      fileSize: pdf.length,
      pdf,
    });
    await svc.runPyqImport(job.id, { pdf, budgetMs: 120_000 });
    return job.id;
  };
  const rowsOf = (jobId: string) => prisma.extractedQuestion.findMany({ where: { jobId }, orderBy: [{ sourcePage: "asc" }, { originalNumber: "asc" }] });

  // ----------------------------------------------------- 2a. NEET 2024 single paper
  const neet2024 = await makePdf([
    [
      "NEET (UG) 2024 Question Paper",
      `1. ${Q.kinetics}`,
      "(1) 1 minute (2) 10 minutes (3) 100 minutes (4) 0.1 minute",
      `2. ${Q.mitochondria}`,
      "(1) Ribosome (2) Mitochondria (3) Golgi body (4) Lysosome",
      `3. ${Q.vague}`,
      "(1) Statement one (2) Statement two (3) Statement three (4) Statement four",
      `4. ${Q.ohm}`,
      "(1) doubles (2) halves (3) remains the same (4) becomes four times",
      "Sol. Resistivity is a property of the material, it does not depend on length.",
    ],
    [
      `5. ${Q.photosynthesis}`,
      "(1) P680 and P700 (2) Carotene (3) Xanthophyll (4) Chlorophyll b",
      `6. ${Q.coordination}`,
      "(1) 3 (2) 4 (3) 6 (4) 2",
      "Answer Key",
      "1. (2) 2. (2) 4. (3) 5. (1) 6. (3)",
    ],
  ]);
  const job1 = await startImport(neet2024, { examId: neet.id, yearMode: "SINGLE", year: 2024, title: "NEET 2024 paper" });
  let r1 = await rowsOf(job1);
  const j1 = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job1 } });
  assert(r1.length === 6, "NEET 2024 PDF: 6 printed questions -> 6 extracted (counts reconcile)", String(r1.length));
  assert(j1.status === "REVIEW_REQUIRED" && j1.progress === 100, "Import finished with real progress, waiting for review", `${j1.status} ${j1.progress}`);
  assert(r1.every((r) => r.pyqYear === 2024 && r.pyqExamId === neet.id && r.metadataMethod === "ADMIN_DOCUMENT"), "Single-sitting paper: every question NEET UG 2024 from the import settings");
  assert(r1.every((r) => r.reviewDecision === "PENDING") && !(await prisma.pyqOccurrence.count({ where: { extractionJobId: job1 } })), "Nothing auto-verified: all pending, no library occurrence yet");
  assert(r1.every((r) => r.extractionMethod === "TEXT_PARSER" && r.sourcePage >= 1), "Text extracted without AI, with source page numbers");
  const kin = r1.find((r) => r.originalNumber === 1)!;
  assert(kin.chapter === "Chemical Kinetics" && kin.subject === "Chemistry" && kin.correctAnswer === "B", "Q1 classified Chemistry > Chemical Kinetics, answer from the key", `${kin.subject}/${kin.chapter}/${kin.correctAnswer}`);
  const vague = r1.find((r) => r.originalNumber === 3)!;
  assert(vague.needsChapterReview && vague.chapter === null && vague.correctAnswer === "", "Uncertain question flagged: needs chapter review, no invented answer");
  assert(review.approvalBlockers(vague).some((b) => /answer/i.test(b)) && review.approvalBlockers(vague).some((b) => /Chapter/i.test(b)), "Blockers explain what to fix");
  const q4 = r1.find((r) => r.originalNumber === 4)!;
  assert(Boolean(q4.solution?.includes("Resistivity")), "Inline solution kept");

  // Lock: two runners at once -> one is refused.
  await prisma.extractionJob.update({ where: { id: job1 }, data: { lockedUntil: new Date(Date.now() + 60_000) } });
  const busy = await pipe.processPyqChunk(job1, 0, async () => neet2024);
  assert(busy.busy === true, "Second runner is refused while the job is locked");
  await prisma.extractionJob.update({ where: { id: job1 }, data: { lockedUntil: null } });

  // Fix + approve.
  await review.updateExtracted(vague.id, { correctAnswer: "A", subject: "Physics", chapter: "Units and Measurement" }, user.id);
  const unresolved = (await rowsOf(job1)).filter((r) => r.needsChapterReview || !r.chapter);
  if (unresolved.length) await review.bulkSetChapter(unresolved.map((r) => r.id), "Biology", "Photosynthesis in Higher Plants", null, user.id);
  r1 = await rowsOf(job1);
  const approve1 = await review.approveExtracted(r1.map((r) => r.id), user.id, true);
  assert(approve1.every((a) => a.ok), "All corrected NEET 2024 questions approve", JSON.stringify(approve1.filter((a) => !a.ok)));
  const occ2024 = await prisma.pyqOccurrence.findMany({ where: { extractionJobId: job1 } });
  assert(occ2024.length === 6 && occ2024.every((o) => o.verificationStatus === "VERIFIED" && o.year === 2024), "6 verified NEET UG 2024 occurrences");
  const again = await review.approveExtracted([r1[0]!.id], user.id, true);
  assert(!again[0]!.ok && (await prisma.question.count({ where: { pyqOccurrences: { some: { extractionJobId: job1 } } } })) === 6, "Approving twice creates nothing new");

  // Retry: re-run a finished page group -> same rows, reviewer work untouched.
  const before = await prisma.extractedQuestion.count({ where: { jobId: job1 } });
  const j1b = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job1 } });
  const rep = j1b.reportJson as any;
  rep.chunkPlan.chunks[0].status = "FAILED";
  await prisma.extractionJob.update({ where: { id: job1 }, data: { reportJson: rep } });
  await svc.requeueChunks(job1, "FAILED");
  await svc.runPyqImport(job1, { pdf: neet2024 });
  const after = await rowsOf(job1);
  assert(after.length === before && after.every((r) => r.reviewDecision === "APPROVED"), "Retrying failed pages creates no duplicates and keeps approvals", `${before} -> ${after.length}`);

  // ----------------------------------------------------- 2b. multi-year collection
  const multi = await makePdf([
    [
      "NEET 2023",
      `1. ${Q.coordination.replace("[Co(NH3)6] 3+", "[Fe(CN)6] 4-")}`,
      "(1) 2 (2) 4 (3) 6 (4) 8",
      "Ans. (3)",
      "2. The SI unit of electric charge is the coulomb. One coulomb equals",
      "(1) one ampere second (2) one volt ampere (3) one joule per second (4) one ohm",
      "Ans. (1)",
      "NEET 2022",
      "1. In the human heart the tricuspid valve is located between the right atrium and",
      "(1) right ventricle (2) left ventricle (3) aorta (4) pulmonary vein",
      "Ans. (1)",
    ],
    [
      "2. The rate of a zero order reaction does not depend on concentration of the reactant [AIPMT 2015]",
      "(1) true always (2) false (3) only at high temperature (4) only for gases",
      "Ans. (1)",
    ],
  ]);
  const job2 = await startImport(multi, { examId: neet.id, yearMode: "MULTI", title: "NEET chapterwise multi-year" });
  const r2 = await rowsOf(job2);
  assert(r2.length === 4 && new Set(r2.map((r) => r.sourceKey)).size === 4, "Multi-year PDF: repeated Q1/Q2 per year kept as 4 separate questions", r2.map((r) => r.sourceKey).join(","));
  const y = (n: number, page: number) => r2.find((r) => r.originalNumber === n && r.sourcePage === page)?.pyqYear;
  assert(r2.filter((r) => r.pyqYear === 2023).length === 2 && r2.filter((r) => r.metadataMethod === "SECTION_HEADING").length === 3, "Years come from the section headings", JSON.stringify(r2.map((r) => [r.originalNumber, r.pyqYear, r.metadataMethod])));
  const tagged = r2.find((r) => r.sourcePage === 2)!;
  assert(tagged.pyqYear === 2015 && tagged.metadataMethod === "QUESTION_TAG" && !tagged.statement.includes("AIPMT"), "Question-level tag [AIPMT 2015] wins and is stripped from the text", `${tagged.pyqYear} ${tagged.metadataMethod}`);
  assert(y(1, 1) !== null && !r2.some((r) => r.pyqYear === null), "No question left without a year here; none inherited a document year");
  await review.bulkSetChapter(r2.filter((r) => !r.chapter).map((r) => r.id), "Chemistry", "Chemical Kinetics", null, user.id);
  const fix2 = (await rowsOf(job2)).filter((r) => r.duplicateOfQuestionId);
  for (const f of fix2) await review.resolveDuplicate(f.id, "KEEP_SEPARATE", user.id);
  const approve2 = await review.approveExtracted((await rowsOf(job2)).map((r) => r.id), user.id, true);
  assert(approve2.every((a) => a.ok), "Multi-year questions approve", JSON.stringify(approve2.filter((a) => !a.ok)));

  // ----------------------------------------------------- 2c. custom exam IUPSC
  const iupsc = await examsSvc.ensureExam("IUPSC", user.id);
  assert(iupsc.slug === "iupsc" && iupsc.canonicalType === "OTHER", "Custom exam IUPSC created as its own exam");
  assert((await examsSvc.ensureExam("iupsc 2019", user.id)).id === iupsc.id, "Same custom exam resolved again (no duplicate exam)");
  assert(await (async () => {
    try {
      await examsSvc.ensureExam("JEE", user.id);
      return false;
    } catch (e) {
      return e instanceof examsSvc.AmbiguousExamError;
    }
  })(), "'JEE' alone is ambiguous — asks instead of guessing");
  const iupscPdf = await makePdf([
    [
      "IUPSC 2019",
      "1. The ozone layer in the stratosphere protects living organisms from harmful ultraviolet radiation of the sun",
      "(1) true (2) false (3) partly true (4) cannot say",
      "Ans. (1)",
    ],
  ]);
  const job3 = await startImport(iupscPdf, { examId: iupsc.id, yearMode: "SINGLE", year: 2019, title: "IUPSC 2019", subject: "Biology" });
  const r3 = await rowsOf(job3);
  assert(r3.length === 1 && r3[0]!.pyqExamId === iupsc.id && r3[0]!.pyqYear === 2019, "IUPSC question keeps the IUPSC identity");
  await review.updateExtracted(r3[0]!.id, { chapter: "Environmental Issues" }, user.id);
  assert((await review.approveExtracted([r3[0]!.id], user.id, true))[0]!.ok, "IUPSC question approved");

  // ----------------------------------------------------- 2d. scanned page -> OCR
  const scanned = await makePdf(["SCANNED"]);
  const job4 = await startImport(scanned, { examId: neet.id, yearMode: "SINGLE", year: 2021, title: "NEET 2021 scanned" });
  let s4 = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job4 } });
  assert(s4.status === "NEEDS_OCR" && pipe.pagesNeedingOcr(s4.reportJson as any).join() === "1", "Scanned page waits for OCR (no AI configured)", s4.status);
  // What the browser OCR posts: the same paper repeats NEET 2024's kinetics question.
  await svc.saveOcrPage(job4, 1, [`1. ${Q.kinetics}`, "(1) 1 minute (2) 10 minutes (3) 100 minutes (4) 0.1 minute", "Ans. (2)"].join("\n"), 88);
  await svc.runPyqImport(job4, { pdf: scanned });
  const r4 = await rowsOf(job4);
  s4 = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job4 } });
  assert(r4.length === 1 && r4[0]!.extractionMethod === "OCR_PARSER" && s4.status === "REVIEW_REQUIRED", "OCR text parsed into a question", `${r4.length} ${s4.status}`);
  const kinQ = approve1.find((a) => a.id === kin.id)!.questionId!;
  assert(r4[0]!.duplicateOfQuestionId === kinQ && r4[0]!.duplicateScore === 100, "Same question in a later year flagged as a duplicate of the existing one");
  assert(!(await review.approveExtracted([r4[0]!.id], user.id, true))[0]!.ok, "Cannot approve until the duplicate is decided");
  await review.resolveDuplicate(r4[0]!.id, "LINKED", user.id);
  const link = await review.approveExtracted([r4[0]!.id], user.id, true);
  assert(link[0]!.ok && link[0]!.linked && link[0]!.questionId === kinQ, "Linked: no new question");
  const kinOcc = await prisma.pyqOccurrence.findMany({ where: { questionId: kinQ }, orderBy: { year: "asc" } });
  assert(kinOcc.map((o) => o.year).join() === "2021,2024", "The question now carries both NEET UG 2021 and 2024", kinOcc.map((o) => o.year).join());

  // ----------------------------------------------------- 2e. re-import the same paper
  const job5 = await startImport(neet2024, { examId: neet.id, yearMode: "SINGLE", year: 2024, title: "NEET 2024 paper (again)" });
  const r5 = await rowsOf(job5);
  assert(r5.length === 6 && r5.filter((r) => r.duplicateOfQuestionId).length >= 5, "Re-import: duplicates detected", `${r5.filter((r) => r.duplicateOfQuestionId).length}`);
  const kin5 = r5.find((r) => r.originalNumber === 1)!;
  await review.resolveDuplicate(kin5.id, "LINKED", user.id);
  await review.approveExtracted([kin5.id], user.id, true);
  assert((await prisma.pyqOccurrence.count({ where: { questionId: kinQ } })) === 2, "Re-importing the same paper adds no second identical occurrence");
  const questionsTotal = await prisma.question.count();

  // ----------------------------------------------------- 3. filters
  const F = (q: string) => lib.parseLibraryFilters(new URLSearchParams(q));
  const neet24 = await lib.queryLibrary(F(`exam=${neet.id}&years=2024`), 1, 100);
  assert(neet24.total === 6, "NEET UG + 2024 -> exactly the 6 questions of the 2024 paper", String(neet24.total));
  assert(neet24.items.every((i) => i.occurrences.length > 0 && i.occurrences.every((o) => o.year === 2024 && o.exam.id === neet.id)), "Every result shows only its matching NEET UG 2024 occurrence (2021 hidden)");
  const n21 = await lib.queryLibrary(F(`exam=${neet.id}&years=2021`), 1, 100);
  assert(n21.total === 1 && n21.items[0]!.id === kinQ, "NEET UG + 2021 -> only the repeated question");
  const multiYears = await lib.queryLibrary(F(`exam=${neet.id}&years=2022,2023`), 1, 100);
  assert(multiYears.total === 3 && multiYears.items.every((i) => i.occurrences.every((o) => o.year === 2022 || o.year === 2023)), "Several years selected -> only those years", String(multiYears.total));
  const chem = await lib.queryLibrary(F(`exam=${neet.id}&subject=Chemistry&chapter=Chemical Kinetics`), 1, 100);
  assert(chem.total >= 2 && chem.items.every((i) => i.chapter === "Chemical Kinetics"), "NEET UG + Chemistry + Chemical Kinetics across years", String(chem.total));
  const jeeRange = await lib.queryLibrary(F(`exam=${jeeMain.id}&yearFrom=2020&yearTo=2023`), 1, 100);
  assert(jeeRange.total === 1 && jeeRange.items[0]!.id === "legacy_jee21", "JEE Main 2020–2023 -> only the 2021 question (draft 2020 is unverified)", String(jeeRange.total));
  const jeeAll = await lib.queryLibrary(F(`exam=${jeeMain.id}&yearFrom=2020&yearTo=2023&verification=ALL`), 1, 100);
  assert(jeeAll.total === 2, "…and including unverified adds the 2020 draft", String(jeeAll.total));
  const iupscOnly = await lib.queryLibrary(F(`exam=${iupsc.id}`), 1, 100);
  assert(iupscOnly.total === 1 && iupscOnly.items[0]!.occurrences[0]!.exam.name === "IUPSC", "Custom exam filter -> only IUPSC");
  const noYearExcluded = await lib.queryLibrary(F(`exam=${neet.id}&years=2019`), 1, 100);
  assert(noYearExcluded.total === 1 && noYearExcluded.items[0]!.id === "legacy_neet19", "Year filter never includes unknown-year questions");
  const neetAll = await lib.queryLibrary(F(`exam=${neet.id}`), 1, 100);
  assert(neetAll.items.some((i) => i.id === "legacy_neet_noyear"), "Without a year filter the unknown-year question is listed");
  const page2 = await lib.queryLibrary(F(`exam=${neet.id}`), 2, 5);
  assert(page2.items.length > 0 && page2.items.length <= 5 && page2.total === neetAll.total, "Server-side pagination");
  const ids = await lib.allMatchingIds(F(`exam=${neet.id}&years=2024`));
  assert(ids.ids.length === 6 && !ids.capped, "Select all matching -> 6 ids");
  const tree = await lib.libraryTree();
  assert(tree.find((e) => e.id === neet.id)!.years.find((x) => x.year === 2024)?.count === 6, "Library tree: NEET UG -> 2024 (6)");

  // ----------------------------------------------------- 4. module + PDF
  const qm = await prisma.questionModule.create({ data: { title: "Chemical Kinetics — PYQ Practice", displayFormat: "SOLUTIONS_SECTION", createdById: user.id, sections: { create: { title: "Exercise 1: NEET PYQs", order: 0 } } }, include: { sections: true } });
  const ex1 = qm.sections[0]!.id;
  const ex2 = (await mod.addSection(qm.id, "Exercise 2: Year-wise PYQ Practice")).id;
  const add = await mod.addQuestions(qm.id, ex1, ids.ids, { examIds: [neet.id], years: [2024] });
  assert(add.added === 6, "6 PYQs added to the module");
  assert((await mod.addQuestions(qm.id, ex1, ids.ids)).added === 0, "Adding again skips questions already in the module");
  await mod.addQuestions(qm.id, ex2, ["legacy_jee21"]);
  let m1 = (await mod.getModule(qm.id))!;
  const firstItem = m1.sections[0]!.items[0]!;
  await mod.addCustomItem(qm.id, ex1, "NOTE", { text: "Questions below are from NEET UG 2024." }, null);
  await mod.addCustomItem(qm.id, ex1, "CUSTOM_QUESTION", { statement: "Custom: define the rate constant.", options: { A: "k", B: "t", C: "c", D: "r" }, answer: "A" }, firstItem.id);
  m1 = (await mod.getModule(qm.id))!;
  assert(m1.sections[0]!.items[1]!.kind === "CUSTOM_QUESTION", "Custom question inserted right after the chosen item");
  const reversed = m1.sections.map((s) => ({ sectionId: s.id, itemIds: [...s.items].reverse().map((i) => i.id) })).reverse();
  await mod.reorder(qm.id, reversed);
  m1 = (await mod.getModule(qm.id))!;
  assert(m1.sections[0]!.id === ex2 && m1.sections[1]!.items[0]!.kind === "NOTE", "Exercises and items reordered");
  const kinItem = m1.sections[1]!.items.find((i) => i.questionId === kinQ)!;
  assert(m1.sections[1]!.items.find((i) => i.questionId === kinQ)!.occurrenceId === kinOcc.find((o) => o.year === 2024)!.id, "Item labelled with the occurrence it was selected under (2024)");
  const render = mod.toRenderModule(m1, null);
  const out = html.renderModuleHtml(render);
  assert(out.includes("NEET UG 2024") && out.includes("Answer Key") && out.includes("Detailed Solutions") && out.includes(">Exercise 1: NEET PYQs<") && !out.includes("Exercise 2: Exercise"), "Printable HTML has labels, answer key and solutions");
  assert(!out.includes("JEE Main 2021") || out.includes("[JEE Main 2021]"), "JEE label only from a verified occurrence");
  await prisma.questionModuleItem.delete({ where: { id: kinItem.id } });
  assert((await prisma.question.count({ where: { id: kinQ } })) === 1, "Removing an item from the module keeps the question");
  const pf = html.preflightModule(render);
  assert(pf.some((w) => /no solution/i.test(w.message)) && !pf.some((w) => w.level === "error"), "Pre-export check warns about missing solutions, no errors");

  try {
    const { renderHtmlPdf } = await import("../src/lib/pdf/html-to-pdf");
    const pdf = await renderHtmlPdf(out, { footerTemplate: '<div style="font-size:8px;width:100%;text-align:center">Page <span class="pageNumber"></span></div>', headerTemplate: "<span></span>" });
    const pages = (await PDFDocument.load(pdf)).getPageCount();
    const { extractTextFromPdfBuffer } = await import("../src/lib/extraction/pdf-extractor");
    const text = (await extractTextFromPdfBuffer(pdf)).fullText;
    writeFileSync(join(dir, "qm.pdf"), pdf);
    assert(pages >= 3 && /half-life of a first order reaction/i.test(text) && /Answer Key/.test(text) && /Detailed Solutions/.test(text), `Module PDF renders (${pages} pages) with questions, answer key and solutions — ${join(dir, "qm.pdf")}`);
  } catch (e: any) {
    assert(false, "Module PDF renders", e.message);
  }

  // ----------------------------------------------------- 5. DPP / Test linking
  const anyKin = neet24.items.find((i) => i.id === kinQ)!;
  const dpp = await prisma.dpp.create({ data: { code: "DPP-PYQ-T1", name: "Kinetics PYQ DPP", subject: "Chemistry", chapter: "Chemical Kinetics", questions: { create: { questionId: anyKin.id, order: 0 } } } });
  const test = await prisma.test.create({ data: { name: "NEET 2024 PYQ test", durationMin: 60, sections: { create: { name: "Chemistry", subject: "Chemistry", questions: { create: neet24.items.map((i, n) => ({ questionId: i.id, order: n })) } } } } });
  const linked = await prisma.dppQuestion.findFirstOrThrow({ where: { dppId: dpp.id }, include: { question: { include: { pyqOccurrences: { include: { exam: true } } } } } });
  assert(linked.question.pyqOccurrences.length === 2, "PYQ in a DPP keeps its exam/year occurrences (no copy)");
  const inTest = await prisma.sectionQuestion.count({ where: { section: { testId: test.id }, question: { pyqOccurrences: { some: { examId: neet.id, year: 2024, verificationStatus: "VERIFIED" } } } } });
  assert(inTest === 6, "A test built only from NEET UG 2024 questions", String(inTest));
  assert((await prisma.question.count()) === questionsTotal, "Linking into DPP/Test created no question copies");

  // Cancel
  const job6 = await svc.createPyqImportJob({ userId: user.id, examId: neet.id, yearMode: "SINGLE", year: 2020, sourceTitle: "cancel me", fileName: "c.pdf", fileUrl: "https://files.example.test/c.pdf", fileSize: neet2024.length, pdf: neet2024 });
  await prisma.extractionJob.update({ where: { id: job6.id }, data: { cancelRequested: true } });
  const c = await pipe.processPyqChunk(job6.id, 0, async () => neet2024);
  assert(c.cancelled === true && (await prisma.extractionJob.findUniqueOrThrow({ where: { id: job6.id } })).status === "CANCELLED", "Cancel stops the import before the next page group");
  await svc.requeueChunks(job6.id, "ALL_UNFINISHED");
  await svc.runPyqImport(job6.id, { pdf: neet2024 });
  assert((await prisma.extractedQuestion.count({ where: { jobId: job6.id } })) === 6, "Resume after cancel finishes the import");

  await prisma.$disconnect();
}

main()
  .then(() => finish())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
