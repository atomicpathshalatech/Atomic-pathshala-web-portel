// End-to-end check of the QC pipeline against a THROWAWAY database (never production):
// seeds two questions (one with a wrong key, one clean), runs both agents with the real
// models, then approves / rejects corrections and checks what was written.
//   DATABASE_URL=postgresql://postgres@localhost:5433/qc_test node --env-file=.env ... scripts/qc/test-pipeline.ts
import "./_stub";
import { prisma } from "../../src/lib/db";
import { decideCorrection, runQcForQuestion } from "../../src/lib/qc/pipeline";

const url = process.env.DATABASE_URL ?? "";
if (!/localhost|127\.0\.0\.1/.test(url)) {
  console.error("Refusing to run: DATABASE_URL is not a local database.");
  process.exit(1);
}

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok || detail === undefined ? "" : " → " + JSON.stringify(detail)}`);
};

(async () => {
  await prisma.question.deleteMany({ where: { questionCode: { in: ["QCT-WRONG", "QCT-CLEAN"] } } });
  const user = (await prisma.user.findFirst({ where: { email: "qc-test@example.test" } })) ?? (await prisma.user.create({ data: { email: "qc-test@example.test", name: "QC Test", passwordHash: "x" } as never }));

  const make = (code: string, key: string, solution: string) =>
    prisma.question.create({
      data: {
        questionCode: code,
        subject: "Physics",
        chapter: "Motion in a Straight Line",
        topic: "Equations of motion",
        type: "SINGLE_CORRECT",
        difficulty: "EASY",
        createdById: user.id,
        translations: {
          create: [
            {
              language: "ENGLISH",
              statement: "A car starts from rest and moves with a constant acceleration of 2 m/s². What is its speed after 5 s?",
              options: { A: "5 m/s", B: "10 m/s", C: "20 m/s", D: "25 m/s" },
              correctOptionIds: [key],
              solution,
            },
          ],
        },
      } as never,
    });
  const wrong = await make("QCT-WRONG", "C", "v = u + at = 0 + 2 × 5 = 20 m/s.");
  const clean = await make("QCT-CLEAN", "B", "v = u + at = 0 + 2 × 5 = 10 m/s.");

  const [rw, rc] = await Promise.all([runQcForQuestion(wrong.id, user.id), runQcForQuestion(clean.id, user.id)]);
  console.log("wrong →", JSON.stringify(rw));
  console.log("clean →", JSON.stringify(rc));
  check("wrong-key question is not verified", rw.status === "FAILED" || rw.status === "NEEDS_HUMAN_REVIEW", rw);
  check("clean question is verified", rc.status === "VERIFIED", rc);

  const wq = await prisma.question.findUnique({ where: { id: wrong.id }, include: { translations: true } });
  check("status stored on the question", wq?.qcStatus === rw.status && Boolean(wq?.qcHash) && Boolean(wq?.qcReviewedAt));
  check("question content untouched by the review", JSON.stringify(wq?.translations[0]?.correctOptionIds) === '["C"]' && wq?.version === wrong.version);
  const reviews = await prisma.qcReview.findMany({ where: { questionId: wrong.id }, include: { findings: true } });
  check("an EXPERT and a DIRECTOR review are stored", reviews.some((r) => r.agent === "EXPERT") && reviews.some((r) => r.agent === "DIRECTOR"), reviews.map((r) => r.agent));
  check("the two agents used different models", new Set(reviews.map((r) => r.model)).size === 2, reviews.map((r) => r.model));
  check("findings are stored", reviews.flatMap((r) => r.findings).length > 0);
  const usage = await prisma.aiUsageLog.count({ where: { questionId: wrong.id } });
  check("model usage is logged (3 calls or more)", usage >= 3, usage);

  // Same content again → reused, no new reviews.
  const again = await runQcForQuestion(wrong.id, user.id);
  check("a second run on unchanged content is reused", again.reused === true && (await prisma.qcReview.count({ where: { questionId: wrong.id } })) === reviews.length);

  const corrections = await prisma.qcCorrection.findMany({ where: { questionId: wrong.id, status: "PROPOSED" } });
  console.log("corrections:", corrections.map((c) => `${c.field}: ${c.originalValue} → ${c.proposedValue.slice(0, 50)}`));
  const keyFix = corrections.find((c) => c.field === "correctAnswer");
  check("a correctAnswer correction is proposed", Boolean(keyFix), corrections.map((c) => c.field));

  if (keyFix) {
    const other = corrections.find((c) => c.id !== keyFix.id);
    const applied = await decideCorrection(keyFix.id, user.id, "approve");
    const after = await prisma.question.findUnique({ where: { id: wrong.id }, include: { translations: true, versions: true } as never });
    const a = after as any;
    check("approve → APPLIED", applied.status === "APPLIED" && applied.appliedVersion === wrong.version + 1, applied);
    check("the key is now B", JSON.stringify(a.translations[0].correctOptionIds) === '["B"]', a.translations[0].correctOptionIds);
    check("the old version is kept with the old key", a.versions.length === 1 && JSON.stringify(a.versions[0].snapshot.translations[0].correctOptionIds) === '["C"]' && a.versions[0].changeType === "QC_CORRECTION");
    check("the edited question must be reviewed again", a.qcStatus === "UNREVIEWED" && a.version === wrong.version + 1);
    if (other) {
      const o = await prisma.qcCorrection.findUnique({ where: { id: other.id } });
      check("a proposal for another field stays open", o?.status === "PROPOSED", o?.status);
      const second = await decideCorrection(other.id, user.id, "approve");
      const q2 = (await prisma.question.findUnique({ where: { id: wrong.id }, include: { translations: true, versions: true } as never })) as any;
      check("the second correction applies too (solution rewritten, two versions kept)", second.status === "APPLIED" && q2.versions.length === 2 && String(q2.translations[0].solution).includes("10"), { status: second.status, versions: q2.versions.length });
    }
    let threw = "";
    try {
      await decideCorrection(keyFix.id, user.id, "approve");
    } catch (e) {
      threw = e instanceof Error ? e.message : String(e);
    }
    check("a decided correction cannot be decided twice", threw.includes("already"), threw);

    const rerun = await runQcForQuestion(wrong.id, user.id);
    console.log("after fix →", JSON.stringify(rerun));
    check("after the fix a fresh review runs (not reused)", rerun.reused === false);
    check("after the fix the question is verified", rerun.status === "VERIFIED", rerun);
  }

  // Reject leaves the question alone; a stale proposal cannot be applied.
  const fake = await prisma.qcCorrection.create({ data: { questionId: clean.id, contentHash: (await prisma.question.findUnique({ where: { id: clean.id } }))!.qcHash!, field: "correctAnswer", originalValue: "B", proposedValue: "D", reason: "test" } });
  const rej = await decideCorrection(fake.id, user.id, "reject", "not right");
  const cq = await prisma.question.findUnique({ where: { id: clean.id }, include: { translations: true } });
  check("reject → REJECTED, question unchanged", rej.status === "REJECTED" && JSON.stringify(cq?.translations[0]?.correctOptionIds) === '["B"]' && cq?.qcStatus === "VERIFIED");
  const bad = await prisma.qcCorrection.create({ data: { questionId: clean.id, contentHash: cq!.qcHash!, field: "correctAnswer", originalValue: "B", proposedValue: "Z", reason: "test" } });
  let badErr = "";
  try {
    await decideCorrection(bad.id, user.id, "approve");
  } catch (e) {
    badErr = e instanceof Error ? e.message : String(e);
  }
  check("an answer key that is not an option is refused", badErr.includes("not a valid answer key"), badErr);
  const stale = await prisma.qcCorrection.create({ data: { questionId: clean.id, contentHash: "old-hash", field: "correctAnswer", originalValue: "B", proposedValue: "A", reason: "test" } });
  let staleErr = "";
  try {
    await decideCorrection(stale.id, user.id, "approve");
  } catch (e) {
    staleErr = e instanceof Error ? e.message : String(e);
  }
  check("a proposal for older content is refused and marked STALE", staleErr.includes("edited after") && (await prisma.qcCorrection.findUnique({ where: { id: stale.id } }))?.status === "STALE", staleErr);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
