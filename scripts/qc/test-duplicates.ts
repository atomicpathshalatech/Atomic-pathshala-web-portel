// Tests of the duplicate finder (pure) and, when DATABASE_URL is a LOCAL database, of storing and deciding pairs.
//   node node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json scripts/qc/test-duplicates.ts
import "./_stub";
import { deepNormalize, findDuplicateCandidates, maskNumbers, textSimilarity, type DuplicateRow } from "../../src/lib/qc/duplicates";

let pass = 0;
let fail = 0;
const check = (ok: boolean, name: string, detail?: unknown) => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok || detail === undefined ? "" : " → " + JSON.stringify(detail)}`);
};

const row = (id: string, statement: string, options: Record<string, string>, key: string[], over: Partial<DuplicateRow> = {}, language = "ENGLISH"): DuplicateRow => ({
  id,
  subject: "Physics",
  type: "SINGLE_CORRECT",
  imageUrl: null,
  translations: [{ language, statement, options, correctOptionIds: key }],
  ...over,
});
const only = (rows: DuplicateRow[]) => findDuplicateCandidates(rows);
const KE = "A body of mass 2 kg moves with a speed of 3 m/s. What is its kinetic energy?";
const OPT = { A: "9 J", B: "18 J", C: "6 J", D: "3 J" };

check(deepNormalize("<p>The <b>Speed</b> is $5\\text{ m/s}$.</p>") === deepNormalize("the speed is 5 m/s"), "formatting, case and punctuation are ignored", deepNormalize("<p>The <b>Speed</b> is $5\\text{ m/s}$.</p>"));
check(deepNormalize("2.5 kg") !== deepNormalize("25 kg"), "a decimal point inside a number is kept");
check(deepNormalize("हाइड्रोजन का द्रव्यमान") === "हाइड्रोजन का द्रव्यमान", "Hindi text is kept whole", deepNormalize("हाइड्रोजन का द्रव्यमान"));
check(maskNumbers("mass 2 kg speed 3.5 m/s") === "mass # kg speed # m/s", "numbers are masked", maskNumbers("mass 2 kg speed 3.5 m/s"));
check(textSimilarity(["a", "b", "c"], ["a", "b", "c"]) === 1 && textSimilarity(["a", "b"], ["x", "y"]) === 0, "similarity is 1 for equal and 0 for unrelated");

let r = only([row("q1", KE, OPT, ["A"]), row("q2", KE, OPT, ["A"])]);
check(r.length === 1 && r[0]!.category === "EXACT_DUPLICATE" && r[0]!.sameAnswer === true, "identical questions → EXACT_DUPLICATE", r);

r = only([row("q1", KE, OPT, ["A"]), row("q2", `<p>${KE.toUpperCase()}</p>`, { A: "<b>9 J</b>", B: "18 J.", C: "6 J", D: "3 J" }, ["A"])]);
check(r.length === 1 && r[0]!.category === "FORMAT_DUPLICATE", "formatting-only difference → FORMAT_DUPLICATE", r);

r = only([row("q1", KE, OPT, ["A"]), row("q2", KE, { A: "18 J", B: "9 J", C: "3 J", D: "6 J" }, ["B"])]);
check(r.length === 1 && r[0]!.category === "FORMAT_DUPLICATE" && r[0]!.sameAnswer === true && r[0]!.note.includes("different order"), "reordered options → FORMAT_DUPLICATE, answers compared by text not letter", r);

r = only([row("q1", KE, OPT, ["A"]), row("q2", KE, OPT, ["B"])]);
check(r.length === 1 && r[0]!.sameAnswer === false, "identical questions with different keys → sameAnswer false", r);

r = only([row("q1", KE, OPT, ["A"]), row("q2", KE.replace("2 kg", "4 kg").replace("3 m/s", "5 m/s"), { A: "50 J", B: "100 J", C: "20 J", D: "10 J" }, ["A"])]);
check(r.length === 1 && r[0]!.category === "STRUCTURAL_VARIANT", "same wording with other numbers → STRUCTURAL_VARIANT", r);

r = only([
  row("q1", "Consider the following statements about mitosis in a plant cell and choose the correct option from those given below the statements", { A: "Only I", B: "Only II", C: "Both I and II", D: "Neither I nor II" }, ["C"]),
  row("q2", "Consider the following statements about mitosis in plant cell and choose the correct option from those given below the statements", { A: "Only I", B: "Only II", C: "Both I and II", D: "Neither I nor II" }, ["C"]),
]);
check(r.length === 1 && r[0]!.category === "NEEDS_MANUAL_REVIEW" && r[0]!.score >= 0.88, "one word different → close wording, for a person to look at", r);

r = only([row("q1", KE, OPT, ["A"]), row("q2", "Which organelle is called the powerhouse of the cell and why is it given that name?", { A: "Nucleus", B: "Mitochondria", C: "Ribosome", D: "Golgi body" }, ["B"])]);
check(r.length === 0, "unrelated questions → nothing", r);

r = only([row("q1", KE, OPT, ["A"]), row("q2", KE, OPT, ["A"], { subject: "Chemistry" })]);
check(r.length === 0, "questions in different subjects are not compared", r);

r = only([row("q1", KE, OPT, ["A"]), row("q2", KE, OPT, ["A"], {}, "HINDI")]);
check(r.length === 0, "different languages are not compared", r);

r = only([row("q1", "Identify the structure shown in the figure below and name it", { A: "x", B: "y" }, ["A"], { imageUrl: "https://x/1.png" }), row("q2", "Identify the structure shown in the figure below and name it", { A: "x", B: "y" }, ["A"], { imageUrl: "https://x/2.png" })]);
check(r.every((c) => c.category !== "EXACT_DUPLICATE" && c.category !== "FORMAT_DUPLICATE"), "same words around different pictures are not called duplicates", r);

r = only([row("q1", "Choose the correct statement", { A: "p", B: "q" }, ["A"]), row("q2", "Choose the correct statement", { A: "r", B: "s" }, ["A"])]);
check(r.length === 0, "a stock phrase with other options is not a duplicate", r);

r = only([row("q3", KE, OPT, ["A"]), row("q1", KE, OPT, ["A"]), row("q2", KE, OPT, ["A"])]);
check(r.length === 3 && r.every((c) => c.questionAId < c.questionBId), "three copies → three pairs, each stored once (A < B)", r.map((c) => [c.questionAId, c.questionBId]));

r = only([{ ...row("q1", KE, OPT, ["A"]), translations: [{ language: "ENGLISH", statement: KE, options: OPT, correctOptionIds: ["A"] }, { language: "HINDI", statement: "एक पिंड की गतिज ऊर्जा क्या है जिसका द्रव्यमान दिया है", options: OPT, correctOptionIds: ["A"] }] }]);
check(r.length === 0, "a question is never compared with its own translation", r);

(async () => {
  if (/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) {
    const { prisma } = await import("../../src/lib/db");
    const { scanForDuplicates, decideDuplicate } = await import("../../src/lib/qc/duplicate-scan");
    await prisma.question.deleteMany({ where: { questionCode: { startsWith: "DUPT-" } } });
    const user = (await prisma.user.findFirst({ where: { email: "qc-test@example.test" } })) ?? (await prisma.user.create({ data: { email: "qc-test@example.test", name: "QC Test", passwordHash: "x" } as never }));
    const make = (code: string, statement: string, key: string) =>
      prisma.question.create({ data: { questionCode: code, subject: "DupTest", type: "SINGLE_CORRECT", difficulty: "EASY", createdById: user.id, translations: { create: [{ language: "ENGLISH", statement, options: OPT, correctOptionIds: [key] }] } } as never });
    const a = await make("DUPT-1", KE, "A");
    const b = await make("DUPT-2", KE, "B");
    await make("DUPT-3", "Which organelle is called the powerhouse of the cell and why is it given that name?", "B");

    const s1 = await scanForDuplicates("DupTest");
    check(s1.questions === 3 && s1.found === 1 && s1.added === 1, "scan stores the one pair", s1);
    const s2 = await scanForDuplicates("DupTest");
    check(s2.added === 0 && s2.removed === 0, "a second scan adds nothing", s2);
    const pair = await prisma.questionDuplicateCandidate.findFirstOrThrow({ where: { questionA: { subject: "DupTest" } } });
    check(pair.category === "EXACT_DUPLICATE" && pair.sameAnswer === false && pair.status === "PENDING", "the pair is stored with the answers flagged as different", pair);

    const before = JSON.stringify(await prisma.question.findMany({ where: { subject: "DupTest" }, include: { translations: true }, orderBy: { id: "asc" } }));
    await decideDuplicate(pair.id, user.id, "CONFIRMED_DUPLICATE", "same");
    const decided = await prisma.questionDuplicateCandidate.findUniqueOrThrow({ where: { id: pair.id } });
    check(decided.status === "CONFIRMED_DUPLICATE" && decided.decidedById === user.id && decided.decidedAt !== null, "a decision is recorded with who and when");
    check(JSON.stringify(await prisma.question.findMany({ where: { subject: "DupTest" }, include: { translations: true }, orderBy: { id: "asc" } })) === before, "deciding changes no question");

    // An edit that makes them different: a decided pair stays as decided, an undecided one is removed.
    await prisma.questionTranslation.updateMany({ where: { questionId: b.id }, data: { statement: "Which planet in the solar system is known as the red planet because of its colour?" } });
    const s3 = await scanForDuplicates("DupTest");
    check(s3.removed === 0 && (await prisma.questionDuplicateCandidate.count({ where: { id: pair.id } })) === 1, "a decided pair is kept after the questions change", s3);
    await decideDuplicate(pair.id, user.id, "PENDING");
    const reopened = await prisma.questionDuplicateCandidate.findUniqueOrThrow({ where: { id: pair.id } });
    check(reopened.status === "PENDING" && reopened.decidedById === null, "undo reopens the pair");
    const s4 = await scanForDuplicates("DupTest");
    check(s4.removed === 1 && (await prisma.questionDuplicateCandidate.count({ where: { id: pair.id } })) === 0, "an undecided pair that no longer matches is removed", s4);

    await prisma.question.deleteMany({ where: { subject: "DupTest" } });
    void a;
  } else {
    console.log("(database part skipped: DATABASE_URL is not a local database)");
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
