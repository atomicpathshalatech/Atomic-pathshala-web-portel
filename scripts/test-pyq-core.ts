/**
 * Pure (no database) checks for the PYQ import building blocks: exam/year
 * tag detection, the deterministic question parser, metadata resolution,
 * fingerprints and chapter classification.
 *
 * Run: npx tsx scripts/test-pyq-core.ts
 */
import { buildOccurrenceKey, normalizeExamKey, formatOccurrenceLabel } from "../src/lib/pyq/keys";
import { findExamTags, headingTagForLine, resolveQuestionMeta, patternForExamName, BUILTIN_EXAM_PATTERNS } from "../src/lib/pyq/metadata-detect";
import { parsePyqText, splitOptions, parseAnswerKey, parseQuality } from "../src/lib/pyq/text-parser";
import { questionFingerprint, compareQuestions } from "../src/lib/pyq/fingerprint";
import { classifyQuestion } from "../src/lib/pyq/classify";

let passed = 0;
let failed = 0;
function assert(cond: unknown, name: string, detail?: unknown) {
  if (cond) {
    passed++;
    console.log(`  [PASS] ${name}`);
  } else {
    failed++;
    console.log(`  [FAIL] ${name}${detail !== undefined ? ` -> ${JSON.stringify(detail)}` : ""}`);
  }
}

console.log("— exam keys");
assert(normalizeExamKey("JEE Mains 2021") === "jeemains", "JEE Mains 2021 -> jeemains", normalizeExamKey("JEE Mains 2021"));
assert(normalizeExamKey("NEET (UG)") === "neetug", "NEET (UG) -> neetug");
assert(normalizeExamKey("IUPSC") === "iupsc", "custom exam key kept");
assert(
  buildOccurrenceKey({ questionId: "q", examId: "e", year: 2024, session: " January ", questionNumber: "12" }) === "q|e|2024|january|||12",
  "occurrence key normalisation matches the SQL backfill"
);
assert(formatOccurrenceLabel({ examName: "NEET UG", year: 2024 }) === "NEET UG 2024", "label NEET UG 2024");

console.log("— tag detection");
const t1 = findExamTags("A ball is thrown up. [NEET 2019]");
assert(t1.length === 1 && t1[0]!.year === 2019 && t1[0]!.examId === "pyqexam_neet_ug", "trailing [NEET 2019]", t1);
const t2 = findExamTags("[JEE Main 2021, 26 Feb, Shift-II]");
assert(t2[0]?.examId === "pyqexam_jee_main" && t2[0]?.year === 2021 && t2[0]?.shift === "Shift 2" && t2[0]?.session === "February", "JEE Main with session+shift", t2);
const t3 = findExamTags("JEE Advanced 2019 Paper 1");
assert(t3[0]?.examId === "pyqexam_jee_adv" && t3[0]?.paper === "Paper 1", "JEE Advanced paper", t3);
const t4 = findExamTags("(AIPMT 2015)");
assert(t4[0]?.examId === "pyqexam_neet_ug" && t4[0]?.year === 2015, "AIPMT counts as NEET UG lineage", t4);
assert(findExamTags("In 2019 the value of g was measured").length === 0, "a bare year is not a tag");
const custom = patternForExamName("ex_iupsc", "IUPSC")!;
const t5 = findExamTags("IUPSC 2018", [custom, ...BUILTIN_EXAM_PATTERNS]);
assert(t5[0]?.examId === "ex_iupsc" && t5[0]?.year === 2018, "custom exam IUPSC recognised, not renamed", t5);
assert(findExamTags("IUPSC 2018").length === 0, "unknown exam is not folded into NEET/JEE");
assert(headingTagForLine("NEET 2023")?.year === 2023, "heading line NEET 2023");
assert(headingTagForLine("NEET (UG) - 2022 Questions")?.year === 2022, "heading with filler words");
assert(headingTagForLine("12. Which of the following was asked in NEET 2020?") === null, "numbered question line is not a heading");

console.log("— metadata resolution");
const doc = { examId: "pyqexam_neet_ug", examName: "NEET UG", year: 2024 };
const single = resolveQuestionMeta({ yearMode: "SINGLE", document: doc, questionTag: null, sectionTag: null });
assert(single.year === 2024 && single.method === "ADMIN_DOCUMENT", "single-sitting PDF inherits document year");
const conflict = resolveQuestionMeta({ yearMode: "SINGLE", document: doc, questionTag: t1[0]!, sectionTag: null });
assert(conflict.year === 2024 && conflict.conflicts.length === 1, "disagreeing tag is reported, not silently applied", conflict);
const multiNone = resolveQuestionMeta({ yearMode: "MULTI", document: doc, questionTag: null, sectionTag: null });
assert(multiNone.year === null && multiNone.method === "NONE", "multi-year PDF never inherits the document year");
const multiSec = resolveQuestionMeta({ yearMode: "MULTI", document: doc, questionTag: null, sectionTag: headingTagForLine("NEET 2021") });
assert(multiSec.year === 2021 && multiSec.method === "SECTION_HEADING", "multi-year PDF uses the section heading");

console.log("— option / answer-key parsing");
const so = splitOptions("Which is a noble gas? (1) He (2) N2 (3) O2 (4) H2");
assert(so?.stem === "Which is a noble gas?" && so.options.A === "He" && so.options.D === "H2", "(1)-(4) inline options", so);
const so2 = splitOptions("Unit of force is (a) newton (b) joule (c) watt (d) pascal");
assert(so2?.options.B === "joule", "(a)-(d) options", so2);
const ak = parseAnswerKey("1. (3)  2. (4)  3-a 4) 2");
assert(ak.get(1) === "C" && ak.get(2) === "D" && ak.get(3) === "A" && ak.get(4) === "B", "answer key pairs", Object.fromEntries(ak));

console.log("— whole-document parse (multi-year, repeated numbering)");
const pages = [
  {
    pageNumber: 1,
    text: [
      "NEET 2023",
      "1. Which of the following is a noble gas?",
      "(1) Helium (2) Nitrogen (3) Oxygen (4) Hydrogen",
      "2. The SI unit of force is",
      "(1) newton (2) joule",
      "(3) watt (4) pascal",
      "Ans. (1)",
      "Sol. Force = mass x acceleration, measured in newton.",
    ].join("\n"),
  },
  {
    pageNumber: 2,
    text: [
      "NEET 2024",
      "1. Which organelle is called the powerhouse of the cell?",
      "(1) Ribosome (2) Mitochondria (3) Golgi body (4) Lysosome",
      "2. The figure shows a circuit. Find the current.",
      "(1) 1 A (2) 2 A (3) 3 A (4) 4 A",
      "Answer Key",
      "1. (2) 2. (3)",
    ].join("\n"),
  },
];
const parsed = parsePyqText(pages);
assert(parsed.questions.length === 4, "4 questions found (numbering restarted per section)", parsed.questions.map((q) => q.sourceKey));
assert(new Set(parsed.questions.map((q) => q.sourceKey)).size === 4, "every question has a distinct sourceKey");
const q23_1 = parsed.questions.find((q) => q.sectionTag?.year === 2023 && q.number === 1);
const q23_2 = parsed.questions.find((q) => q.sectionTag?.year === 2023 && q.number === 2);
const q24_1 = parsed.questions.find((q) => q.sectionTag?.year === 2024 && q.number === 1);
const q24_2 = parsed.questions.find((q) => q.sectionTag?.year === 2024 && q.number === 2);
assert(q23_1 && q23_1.answer === null && q23_1.issues.some((i) => i.includes("No answer")), "no printed answer => none invented", q23_1);
assert(q23_2?.answer === "A" && q23_2.answerSource === "INLINE" && q23_2.solution?.includes("newton"), "inline Ans./Sol.", q23_2);
assert(q24_1?.answer === "B" && q24_1.answerSource === "ANSWER_KEY_SECTION" && q24_1.sourcePage === 2, "answer key applies within its own section", q24_1);
assert(q24_2?.answer === "C" && q24_2.hasImageHint, "figure hint flagged", q24_2);
assert(parseQuality(parsed) === 1, "all four questions have stem + options");

console.log("— fingerprints / duplicates");
const fpA = questionFingerprint("Which is a noble gas?", { A: "He", B: "N2", C: "O2", D: "H2" });
const fpB = questionFingerprint("Which  is a NOBLE gas ?", { A: "H2", B: "O2", C: "N2", D: "He" });
assert(fpA === fpB, "fingerprint ignores case, spacing and option order");
const diffNums = compareQuestions(
  { statement: "A car moves at 20 m/s for 5 s. Find the distance.", options: { A: "100 m", B: "50 m", C: "25 m", D: "4 m" } },
  { statement: "A car moves at 25 m/s for 5 s. Find the distance.", options: { A: "125 m", B: "50 m", C: "25 m", D: "5 m" } }
);
assert(!diffNums.exact && diffNums.score < 85, "different numbers are not a duplicate", diffNums);

console.log("— chapter classification");
const c1 = classifyQuestion({ statement: "Which organelle is called the powerhouse of the cell and has cristae?", subjectHint: "Biology" });
assert(c1.candidates.length > 0 && c1.subject === "Biology", "biology question gets biology candidates", c1);
const c2 = classifyQuestion({ statement: "Calculate the half-life of a first order reaction with rate constant 0.0693 per minute.", subjectHint: "Chemistry" });
assert(/kinetics/i.test(c2.candidates[0]?.chapter ?? ""), "first-order half-life -> Chemical Kinetics", c2.candidates);
const vague = classifyQuestion({ statement: "Which of the following is correct?", subjectHint: "Physics" });
assert(!vague.confident && vague.chapter === null, "vague question is not given a chapter", vague);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
