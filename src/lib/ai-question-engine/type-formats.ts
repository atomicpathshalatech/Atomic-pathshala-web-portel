/**
 * What each question type must look like — told to the model in the prompt,
 * and checked on what comes back. Before, the prompt only listed the type ids
 * ("COLUMN_MATCHING: 2 questions") without saying what the type is, and
 * nothing checked the result, so 3-column questions came back as 2-column ones
 * and visual types came back without any figure.
 */

export type FigureNeed = "graph" | "figure" | "source" | null;

export interface TypeFormat {
  /** Exact instructions for the statement / options of this type. */
  format: string;
  /** graph = a "graph" figure; figure = structures or diagram (or a supplied source image); source = only a supplied image. */
  figure: FigureNeed;
  /** Why a returned question is not of this type, or null when it is. */
  check: (q: { statementEn?: string; statementHi?: string; optionsEn?: Record<string, string> }) => string | null;
}

const text = (q: { statementEn?: string; statementHi?: string }) => (q.statementEn?.trim() ? q.statementEn : q.statementHi) || "";
const opts = (q: { optionsEn?: Record<string, string> }) => ["A", "B", "C", "D"].map((k) => String(q.optionsEn?.[k] ?? ""));

/** Rows of the first pipe table in the text: header, then data rows (divider dropped). */
export function tableOf(s: string): string[][] | null {
  const lines = s.split(/\n/).map((l) => l.trim());
  const start = lines.findIndex((l) => l.split("|").length >= 2 && !/^[-|:\s]+$/.test(l));
  if (start < 0) return null;
  const rows: string[][] = [];
  for (let i = start; i < lines.length; i++) {
    const l = lines[i]!;
    if (!l.includes("|")) break;
    if (/^[-|:\s]+$/.test(l)) continue;
    rows.push(l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
  }
  return rows.length ? rows : null;
}

const labelledLines = (s: string, re: RegExp) => s.split(/\n/).filter((l) => re.test(l.trim())).length;
const isNumberish = (o: string) => /[-+]?\d+(\.\d+)?/.test(o) && o.replace(/[\d\s.,+\-×x^()$\\{}a-zA-Z°%/·*]/g, "").length < 6;

const MATCH_OPTIONS = (n: number) => `Options are code combinations covering every row, e.g. ${n === 3 ? '"A-II-R, B-I-P, C-IV-Q, D-III-S"' : '"A-Q, B-P, C-S, D-R"'} — exactly one option is right.`;

export const TYPE_FORMATS: Record<string, TypeFormat> = {
  SINGLE_CORRECT: {
    format: "A direct question stem; four options; exactly one correct.",
    figure: null,
    check: () => null,
  },
  ASSERTION_REASON: {
    format:
      'Statement: "Assertion (A): <claim>\\nReason (R): <explanation>" then "In the light of the above statements, choose the correct answer." Options exactly (in this order): (A) Both A and R are true and R is the correct explanation of A (B) Both A and R are true but R is NOT the correct explanation of A (C) A is true but R is false (D) A is false but R is true. Hindi: "अभिकथन (A):" / "कारण (R):" with the same four options in Hindi.',
    figure: null,
    check: (q) => (/assertion|अभिकथन/i.test(text(q)) && /reason|कारण/i.test(text(q)) ? null : "Assertion (A) and Reason (R) are not both in the statement."),
  },
  TWO_STATEMENT: {
    format:
      'Statement: "Given below are two statements:\\nStatement I: <fact>\\nStatement II: <fact>\\nIn the light of the above statements, choose the correct answer." Options exactly: (A) Both Statement I and Statement II are correct (B) Both Statement I and Statement II are incorrect (C) Statement I is correct but Statement II is incorrect (D) Statement I is incorrect but Statement II is correct. Hindi: "कथन I:" / "कथन II:".',
    figure: null,
    check: (q) => (/statement\s*(i|1)\b[\s\S]*statement\s*(ii|2)\b|कथन\s*(i|1)\b[\s\S]*कथन\s*(ii|2)\b/i.test(text(q)) ? null : "Statement I and Statement II are not both written out."),
  },
  MULTI_STATEMENT_COMBINATION: {
    format:
      'Statement: an intro line, then 4 or 5 statements EACH ON ITS OWN LINE labelled "(a)", "(b)", "(c)", "(d)" [, "(e)"], then "Choose the correct answer from the options given below:". Options are combinations, e.g. "(a) and (c) only", "(b), (c) and (d) only".',
    figure: null,
    check: (q) => (labelledLines(text(q), /^\(?([a-e]|i{1,3}|iv|v|[1-5])[).]\s*\S/i) >= 3 ? null : "Fewer than 3 labelled statements, one per line."),
  },
  CORRECT_INCORRECT_STATEMENT: {
    format: 'Stem: "Which of the following statements is INCORRECT (or CORRECT) regarding <topic>?" — each of the four options is a complete statement; exactly one is the odd one out.',
    figure: null,
    check: (q) => (/incorrect|correct|not true|true|false|गलत|सही|असत्य|सत्य/i.test(text(q)) && opts(q).filter((o) => o.split(/\s+/).length >= 4).length >= 3 ? null : "Options are not full statements to judge as correct/incorrect."),
  },
  MATCH_THE_FOLLOWING: {
    format: `Two-column table in the statement: "Match List-I with List-II.\\n\\nList-I | List-II\\n---|---\\n(A) ... | (I) ...\\n(B) ... | (II) ...\\n(C) ... | (III) ...\\n(D) ... | (IV) ..." — 4 rows, one per line, Column-II order shuffled. ${MATCH_OPTIONS(2)}`,
    figure: null,
    check: (q) => {
      const t = tableOf(text(q));
      if (!t || t.length < 4) return "No two-column table with at least 4 rows.";
      return t.slice(1).every((r) => r.length >= 2) ? null : "Table rows do not have two columns.";
    },
  },
  COLUMN_MATCHING: {
    format: `THREE-column table in the statement (this is NOT a two-column match): "Match Column-I, Column-II and Column-III.\\n\\nColumn-I | Column-II | Column-III\\n---|---|---\\n(A) ... | (I) ... | (P) ...\\n(B) ... | (II) ... | (Q) ...\\n(C) ... | (III) ... | (R) ...\\n(D) ... | (IV) ... | (S) ..." — 4 rows, one per line, every row has exactly three cells, Columns II and III shuffled independently (e.g. Hormone | Gland | Target; Compound | Hybridisation | Shape). ${MATCH_OPTIONS(3)}`,
    figure: null,
    check: (q) => {
      const t = tableOf(text(q));
      if (!t || t.length < 4) return "No three-column table with at least 4 rows.";
      if (!t.every((r) => r.length >= 3)) return "The table does not have three columns in every row (this is a 3-column match).";
      return opts(q).filter((o) => /[A-D]\s*[-–→]\s*\(?[IVX]+\)?\s*[-–→]\s*\(?[P-Sp-s]/.test(o)).length >= 3 ? null : 'Options are not 3-part codes like "A-II-R, B-I-P, …".';
    },
  },
  SEQUENCE_ARRANGEMENT: {
    format: 'Statement: what to arrange, then 4 or 5 items EACH ON ITS OWN LINE labelled "(A)" … "(E)", then "Choose the correct sequence:". Options are orders like "B → A → D → C".',
    figure: null,
    check: (q) => {
      if (labelledLines(text(q), /^\(?[A-E][).]\s*\S/) < 4) return "Fewer than 4 labelled items to arrange, one per line.";
      return opts(q).filter((o) => /[A-E]\s*(→|->|>|,|<)\s*[A-E]/.test(o)).length >= 3 ? null : "Options are not orders of the labelled items.";
    },
  },
  DIAGRAM_BASED: {
    format:
      'The question cannot be answered without the figure. Give a "figure": for chemistry structures {"kind":"structures","items":[{"label":"(A)","smiles":"CC(C)O"}, …]} (valid SMILES, up to 6); otherwise a simple labelled schematic {"kind":"diagram","svg":"<svg viewBox=\\"0 0 400 260\\">…</svg>"} using only line/rect/circle/ellipse/polygon/polyline/path/text, black strokes, labels A, B, C, D or short English words inside the viewBox. The statement refers to the labels ("In the figure, the part labelled B is…"). If a source image ID is offered for this topic, use "sourceImageId" instead.',
    figure: "figure",
    check: () => null,
  },
  IMAGE_BASED: {
    format: 'Only with a supplied source image: set "sourceImageId" to one of the offered Image IDs and ask about what that real image shows.',
    figure: "source",
    check: () => null,
  },
  GRAPH_BASED: {
    format:
      'The question is about a graph. Give "figure": {"kind":"graph","title":"…","xLabel":"Temperature (K)","yLabel":"Rate","series":[{"label":"…","points":[[x,y],…],"style":"curve|line|points"}],"markers":[{"x":…,"y":…,"label":"P"}]} with 6–15 REAL data points that show the behaviour the question is about (the picture is drawn from these numbers). Labels in English/symbols only. The statement refers to the graph and its marked points.',
    figure: "graph",
    check: () => null,
  },
  TABLE_BASED: {
    format: 'A data/property table in the statement (header row, "---|---" divider, 3–6 rows, one per line, 2–4 columns) and a question that needs reading the table.',
    figure: null,
    check: (q) => {
      const t = tableOf(text(q));
      return t && t.length >= 4 && t.every((r) => r.length >= 2) ? null : "No data table (header + at least 3 rows) in the statement.";
    },
  },
  PASSAGE_COMPREHENSION: {
    format: 'Statement: "Read the passage and answer the question.\\n\\n<passage of 80–150 words>\\n\\n<question>".',
    figure: null,
    check: (q) => (text(q).split(/\s+/).length >= 70 ? null : "The passage is too short (needs 80–150 words)."),
  },
  CASE_BASED: {
    format: "Statement: a case/scenario (experiment, observation, patient or field study) of 60–120 words, then the question about it.",
    figure: null,
    check: (q) => (text(q).split(/\s+/).length >= 50 ? null : "The case description is too short (needs 60–120 words)."),
  },
  NUMERICAL_VALUE: {
    format: "A calculation (data given in the stem). Options are four numerical values with units; the solution shows the working.",
    figure: null,
    check: (q) => (opts(q).filter(isNumberish).length >= 3 ? null : "Options are not numerical values."),
  },
  CONCEPT_APPLICATION: {
    format: "Apply a law/concept to a new situation described in the stem; one correct option.",
    figure: null,
    check: () => null,
  },
  EXPERIMENTAL_PRACTICAL: {
    format: "Based on an NCERT practical / lab-manual experiment (procedure, observation, precaution or result); one correct option.",
    figure: null,
    check: () => null,
  },
  NCERT_LINE_BASED: {
    format: "Tests an exact NCERT textbook line/fact; one correct option.",
    figure: null,
    check: () => null,
  },
};

export function formatOf(typeId: string): TypeFormat {
  return TYPE_FORMATS[typeId] ?? TYPE_FORMATS.SINGLE_CORRECT!;
}

/**
 * The Question Bank type of a generated question. Every type here is answered
 * by choosing an option — a "Numerical value" question is a calculation MCQ,
 * not a type-in answer (that mapping made them unanswerable in tests).
 */
export function bankTypeOf(typeId: string): "SINGLE_CORRECT" | "STATEMENT_BASED" | "MATCH_COLUMN" | "ASSERTION_REASON" {
  if (typeId === "ASSERTION_REASON") return "ASSERTION_REASON";
  if (typeId === "MATCH_THE_FOLLOWING" || typeId === "COLUMN_MATCHING") return "MATCH_COLUMN";
  if (typeId === "TWO_STATEMENT" || typeId === "MULTI_STATEMENT_COMBINATION" || typeId === "CORRECT_INCORRECT_STATEMENT") return "STATEMENT_BASED";
  return "SINGLE_CORRECT";
}
