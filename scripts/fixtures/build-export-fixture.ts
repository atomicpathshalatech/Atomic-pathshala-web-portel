/**
 * Builds a FormattedExportTest from the real-question samples, for testing the
 * PDF export without a database (scripts/test-test-portal-render.ts and local previews).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FormattedExportTest, FormattedExportQuestion } from "../../src/lib/pdf/test-export-engine";

type Sample = {
  no: number; subject: string; type: string; correct: string;
  en: { statement: string; options: Record<string, string>; solution: string };
  hi: { statement: string; options: Record<string, string>; solution: string };
};

export function buildExportFixture(opts: { repeat?: number } = {}): FormattedExportTest {
  const samples: Sample[] = JSON.parse(readFileSync(join(__dirname, "minor-test-01-samples.json"), "utf8"));
  const order = ["Physics", "Chemistry", "Biology"];
  const repeat = opts.repeat ?? 1;
  let n = 0;
  const sections = order.map((subject, si) => {
    const base = samples.filter((s) => s.subject === subject);
    const qs: FormattedExportQuestion[] = [];
    for (let r = 0; r < repeat; r++) {
      for (const s of base) {
        n++;
        qs.push({
          number: n,
          id: `q${n}`,
          subject,
          sectionName: subject,
          statementEn: s.en.statement,
          statementHi: s.hi.statement,
          options: ["A", "B", "C", "D"].map((k, i) => ({
            key: String(i + 1),
            label: `(${i + 1})`,
            textEn: s.en.options[k] ?? "",
            textHi: s.hi.options[k] ?? "",
            isCorrect: k === s.correct,
          })),
          correctOptionKey: String(["A", "B", "C", "D"].indexOf(s.correct) + 1),
          correctOptionLabel: `(${["A", "B", "C", "D"].indexOf(s.correct) + 1})`,
          solutionEn: s.en.solution,
          solutionHi: s.hi.solution,
          imageUrl: null,
          camDrawSvg: null,
        });
      }
    }
    return { id: `s${si}`, name: subject, subject, order: si, targetCount: qs.length, marksPerQuestion: 4, negativeMarks: 1, syllabus: "", questions: qs };
  });
  const all = sections.flatMap((s) => s.questions);
  return {
    id: "cmucf0ymq0001tjv1q437dxq8",
    name: "Minor Test : 01",
    code: "MT01-SPB",
    examType: "NEET",
    durationMin: 180,
    totalMarks: all.length * 4,
    totalQuestions: all.length,
    correctMarks: 4,
    incorrectMarks: -1,
    description: "",
    instructions: "",
    createdAt: new Date("2026-09-22T00:00:00Z"),
    seriesName: "Selection Pro Batch Neet",
    batchName: "Selection Pro Batch",
    sections,
    allQuestions: all,
  };
}
