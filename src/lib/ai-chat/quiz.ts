const QUIZ_TIMER_DIRECTIVE = /^\s*\[ATOMIC_QUIZ_TIMER:(\d{1,4})\]\s*\n?/i;

export function getQuizTimerSeconds(content: string) {
  const directive = content.match(QUIZ_TIMER_DIRECTIVE);
  if (directive) {
    const seconds = Number(directive[1]);
    return Number.isFinite(seconds) ? Math.min(Math.max(seconds, 10), 3_600) : null;
  }
  return /quiz\s+start|question\s*1\s*:/i.test(content) ? 60 : null;
}

export function stripQuizTimerDirective(content: string) {
  return content.replace(QUIZ_TIMER_DIRECTIVE, "");
}

export function containsDevanagari(content: string) {
  return /[\u0900-\u097F]/.test(content);
}

// ===== Structured Quiz Mode =====

export type QuizSubject = "Biology" | "Physics" | "Chemistry" | "Full NEET";
type SingleSubject = Exclude<QuizSubject, "Full NEET">;

export type QuizLevel = "Easy" | "Medium" | "Hard" | "Mixed";

export interface QuizConfigEntry {
  subject: SingleSubject;
  questionCount: number;
  timerSeconds: number;
}

export const QUIZ_SUBJECT_CONFIG: Record<SingleSubject, QuizConfigEntry> = {
  Biology: { subject: "Biology", questionCount: 20, timerSeconds: 60 },
  Physics: { subject: "Physics", questionCount: 10, timerSeconds: 90 },
  Chemistry: { subject: "Chemistry", questionCount: 10, timerSeconds: 90 },
};

// ----- Question format types (NEET Question Format Engine) -----
export type QuestionType =
  | "single_correct"
  | "table_based"
  | "assertion_reason"
  | "statement_based"
  | "two_statement"
  | "match_2_column"
  | "match_3_column"
  | "match_conceptual"
  | "sequence"
  | "correct_incorrect"
  | "except"
  | "numerical"
  | "diagram_based"
  | "figure_table"
  | "flowchart"
  | "multi_statement_combination"
  | "concept_table"
  | "image_statement"
  | "graph_based"
  | "case_based";

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single_correct: "Single Correct MCQ",
  table_based: "Table-based MCQ",
  assertion_reason: "Assertion-Reason",
  statement_based: "Statement-based",
  two_statement: "Two-Statement",
  match_2_column: "Match the Column (2 columns)",
  match_3_column: "Match the Column (3 columns)",
  match_conceptual: "Match the Column (conceptual)",
  sequence: "Sequence / Arrangement",
  correct_incorrect: "Correct / Incorrect Statement",
  except: "EXCEPT type",
  numerical: "Numerical / Calculation",
  diagram_based: "Diagram-based",
  figure_table: "Figure Identification + Table",
  flowchart: "Flowchart-based",
  multi_statement_combination: "Multi-Statement Combination",
  concept_table: "Concept + Table Combination",
  image_statement: "Image + Statement Combination",
  graph_based: "Graph-based",
  case_based: "Case / Passage-based",
};

export interface LabeledItem {
  label: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  subject: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  chapter?: string;
  topic?: string;
  difficulty?: string;
  questionType?: QuestionType;

  // Generic structured fields — populated only for the question types that need them.
  passage?: string; // case_based
  statements?: string[]; // statement_based, two_statement, multi_statement_combination, flowchart interpretive statements
  assertionText?: string; // assertion_reason — Assertion (A), kept fully separate from reasonText
  reasonText?: string; // assertion_reason — Reason (R), kept fully separate from assertionText
  columnI?: LabeledItem[]; // match_2_column, match_3_column, match_conceptual
  columnII?: LabeledItem[];
  columnIII?: LabeledItem[]; // match_3_column only
  sequenceItems?: LabeledItem[]; // sequence
  tableHeaders?: string[]; // table_based, concept_table, figure_table
  tableRows?: string[][]; // one row per option, aligned with tableHeaders
  flowchartSteps?: string[]; // flowchart (top-to-bottom process steps, blanks shown as "____")
  imageRequired?: boolean; // diagram_based, figure_table, graph_based, image_statement
  imageDescription?: string; // precise description of the required diagram/graph/figure
  explanationSteps?: string[]; // point-wise solution steps (preferred over the plain "explanation" paragraph)
}

export interface QuizAnswer {
  questionId: string;
  selectedIndex: number | null;
  correct: boolean;
  timeTakenSeconds: number;
}

export function getEntriesForSubject(subject: QuizSubject, customQuestionCount?: number): QuizConfigEntry[] {
  if (subject === "Full NEET") {
    return [QUIZ_SUBJECT_CONFIG.Biology, QUIZ_SUBJECT_CONFIG.Physics, QUIZ_SUBJECT_CONFIG.Chemistry];
  }
  const base = QUIZ_SUBJECT_CONFIG[subject];
  if (customQuestionCount) {
    return [{ ...base, questionCount: customQuestionCount }];
  }
  return [base];
}

export function timerForQuestion(question: QuizQuestion, entries: QuizConfigEntry[]) {
  const entry = entries.find((item) => item.subject === question.subject);
  return entry?.timerSeconds ?? 60;
}

const QUIZ_JSON_BLOCK = /\[ATOMIC_QUIZ_JSON\]([\s\S]*?)\[\/ATOMIC_QUIZ_JSON\]/i;

function getLevelRulesText(level: QuizLevel): string {
  switch (level) {
    case "Easy":
      return `QUIZ LEVEL: EASY
- Simple NEET-based questions.
- Direct NCERT/concept-based.
- Low calculation and low time requirement.
- Every question in this set must be Easy difficulty.`;
    case "Medium":
      return `QUIZ LEVEL: MEDIUM
- NEET-based questions with increased conceptual difficulty.
- Multi-step, application-based or time-taking questions.
- Avoid unnecessarily tricky wording.
- Every question in this set must be Medium difficulty.`;
    case "Hard":
      return `QUIZ LEVEL: HARD
- Biology: AIIMS-level conceptual/application questions.
- Physics & Chemistry: JEE Main-level questions.
- Multi-concept, calculation-intensive and time-taking questions.
- Must remain syllabus-relevant (NCERT/NEET syllabus boundaries, do not go outside it).
- Every question in this set must be Hard difficulty.`;
    case "Mixed":
      return `QUIZ LEVEL: MIXED
- Exactly 20% of the questions must be Easy (simple NEET-based, direct NCERT/concept-based, low calculation).
- Exactly 50% of the questions must be Medium (NEET-based, increased conceptual difficulty, multi-step/application-based).
- Exactly 30% of the questions must be Hard (Biology: AIIMS-level; Physics & Chemistry: JEE Main-level; multi-concept, calculation-intensive).
- Distribute the difficulty levels randomly across the question order (do not group all Easy questions first, then Medium, then Hard).
- Tag each question's "difficulty" field with its ACTUAL individual difficulty (Easy, Medium, or Hard) — do not mark every question the same.`;
  }
}

const QUESTION_FORMAT_ENGINE = `## NEET QUESTION FORMAT ENGINE

Generate questions using the FULL RANGE of NEET-style question structures below, not only plain four-option MCQs. Rotate through multiple formats across the set (do not repeat "single_correct" for every question unless the set is small). Set each question's "questionType" field to exactly one of these values:

1. single_correct — Standard question stem + 4 options, exactly one correct, plausible distractors of similar length/structure.

2. table_based — Question stem, then populate "tableHeaders" (column names) and "tableRows" (exactly 4 rows, one per option — each row is the FULL content of that option). Each option in "options" should be a short label like "Option (1)"; the real content lives in tableRows. Only one complete row is correct.

3. assertion_reason — Do NOT put the assertion/reason inside "text". Instead populate "assertionText" with ONLY the Assertion statement, and "reasonText" with ONLY the Reason statement — these are two fully separate fields and must never be concatenated or merged into one string. Leave "text" empty (""). Options MUST be exactly these four, in this order: "Both A and R are correct and R is the correct explanation of A", "Both A and R are correct but R is not the correct explanation of A", "A is correct but R is incorrect", "Both A and R are incorrect". Vary which one is actually correct across questions. Evaluate the truth of A and the truth of R independently, then separately judge whether R actually explains A, before selecting correctIndex.

4. statement_based — Populate "statements" (3-5 items, each a full roman-numeral statement e.g. "Photosynthesis occurs only in the presence of light."). "text" is just the lead-in instruction (e.g. "Consider the following statements:"). Options are combinations like "I, II and III", "I and IV only", etc.

5. two_statement — Populate "statements" with exactly 2 items ("Statement I: ...", "Statement II: ..."). Options MUST be exactly these four: "Statement I and II both are correct", "Statement I and II both are incorrect", "Only Statement I is correct", "Only Statement II is correct".

6. match_2_column — Populate "columnI" (4 items, labels A-D) and "columnII" (4 items, labels P-S), each item {"label":"A","text":"..."}. Options are 4 different code combinations like "(A-P), (B-Q), (C-R), (D-S)". Vary which option is correct; do not always put it first.

7. match_3_column — Same as match_2_column but also populate "columnIII" (4 items, labels I-IV). Options are combinations across all three columns.

8. match_conceptual — Same structure as match_2_column, but the pairing must test conceptual understanding (e.g. scientist->principle, law->formula) rather than simple factual recall.

9. sequence — Populate "sequenceItems" (4 items, labels a-d, each a step/stage/event). "text" is the instruction (e.g. "Arrange the following in correct order:"). Options are 4 different orderings like "a, b, c, d" / "c, b, d, a".

10. correct_incorrect — Standard 4-option MCQ where the stem explicitly asks "Which of the following is correct/incorrect regarding ___?". Exactly one option must be correct (or incorrect, matching the stem's wording).

11. except — "text" ends with "...EXCEPT:" or similar. Exactly 3 options must be true statements from the same conceptual group, and exactly 1 must be the outlier (the correct answer to select).

12. numerical — "text" contains numerical data; options are 4 numeric values with correct units. Internally verify the calculation before finalizing; exactly one value must be correct.

13. diagram_based — Set "imageRequired": true and "imageDescription" to a precise, self-contained description of the diagram/structure/apparatus needed (detailed enough that a reader can mentally reconstruct it). "text" is the question referring to "the figure above". Options are standard 4-option MCQ.

14. figure_table — Set "imageRequired": true, "imageDescription" describing figures A-D, AND populate "tableHeaders" (["A","B","C","D"]) with "tableRows" (4 rows, each row = one option's identification of A,B,C,D).

15. flowchart — Populate "flowchartSteps" (ordered array of process step labels, top to bottom, using "____" for steps the student must infer) AND "statements" (3-4 interpretive statements labelled (i),(ii),(iii),(iv) about the flowchart). Options are combinations like "(i), (ii), (iv)".

16. multi_statement_combination — Same as statement_based but with 4-5 statements testing different aspects of one topic.

17. concept_table — Conceptual question stem, answer choices presented as a table: populate "tableHeaders" and "tableRows" (4 rows = 4 options), e.g. Quantity/Formula/Unit columns.

18. image_statement — Set "imageRequired": true with "imageDescription", AND populate "statements" (3-4 items). Options are statement combinations referring to the image.

19. graph_based — Set "imageRequired": true, "imageDescription" must describe the graph precisely: what is on each axis (with units), the shape/trend of the curve, and any labelled points — enough detail that the question is solvable from the description alone. Options are standard 4-option MCQ.

20. case_based — Populate "passage" with a short scenario/data paragraph. "text" is the specific question being asked about that passage. Standard 4-option MCQ.

FORMAT SELECTION: If the person explicitly names a format (e.g. "make a match the column question", "assertion reason question", "flowchart question"), use exactly that questionType for that request. Otherwise, distribute a natural mix across the format types above suited to the subject/topic — do not generate only single_correct questions repeatedly.

For every question type NOT listed as needing a particular field above, leave that field as an empty array / omit it / set imageRequired to false — do not populate irrelevant structured fields.`;

export function buildQuizRequestPrompt(
  entries: QuizConfigEntry[],
  language: "english" | "hindi" | "hinglish" = "english",
  topic?: string,
  level: QuizLevel = "Medium",
  requestedFormat?: QuestionType
): string {
  const sections = entries
    .map(
      (entry) =>
        `${entry.subject}: exactly ${entry.questionCount} NEET-standard MCQ questions, ${entry.timerSeconds} seconds each.`
    )
    .join("\n");

  const languageLine =
    language === "hindi"
      ? "Write every question, option, and explanation ONLY in Hindi using Devanagari script. Do not use Romanized Hindi."
      : language === "hinglish"
        ? "Write every question, option, and explanation in natural Hinglish (mix of Hindi and English, Roman script)."
        : "Write every question, option, and explanation in English.";

  const topicLine = topic
    ? `Focus ALL questions strictly on this topic/chapter only: "${topic}". Do not include questions from any other topic.`
    : "";

  const formatLine = requestedFormat
    ? `MANDATORY FORMAT: Every question in this set MUST use questionType = "${requestedFormat}" (${QUESTION_TYPE_LABELS[requestedFormat]}). Follow that format's structure exactly as defined below.`
    : "";

  const levelRules = getLevelRulesText(level);

  return `ATOMIC_QUIZ_JSON_REQUEST
Generate a NEET quiz question set matching the difficulty and style of the actual NEET exam and top coaching institute test series (last 3-4 years), NOT basic textbook-recall questions.

${sections}
${topicLine}
${formatLine}

Language instruction: ${languageLine}

${levelRules}

${QUESTION_FORMAT_ENGINE}

SOLUTION FORMAT RULE (mandatory — applies to every question):
- Do NOT write the explanation as one merged paragraph. Populate "explanationSteps" as an array of clear, numbered points (minimum 2, typically 3-5), for example: ["Step 1: identify the relevant formula/concept.", "Step 2: substitute the given values.", "Step 3: solve and match with the verified correct option."].
- Each entry in "explanationSteps" must be a complete, self-contained point — do not split one sentence across two array entries.
- Also populate "explanation" with the same content joined into a short paragraph, purely as a fallback for any legacy display — but "explanationSteps" is the primary field and must always be present and complete.

Question quality requirements (apply to every question regardless of type):
- Exactly one option must be scientifically/mathematically correct.
- Distractors must be genuinely plausible (common misconceptions, near-miss numbers, subtly altered facts), not obviously silly.
- Do not reveal the answer through wording or option length.
- Follow the latest NCERT and NTA NEET syllabus only. Never use deleted or outdated NCERT content. Never invent fake facts.
- Formatting inside "text", "statements", column items, etc.: use actual \\n newline characters to separate distinct lines/statements — never run multiple statements or an Assertion+Reason pair into one paragraph.

STRICT ACCURACY RULES (mandatory — apply before including ANY question in your output):
- Independently verify the question, options, correct answer, and explanation/solution before including it.
- The correctIndex MUST exactly match your own verified solution — recompute or re-derive the answer yourself, do not guess.
- Do NOT include ambiguous, incomplete, contradictory, outdated, or multiple-correct-answer questions.
- Do NOT include any question with a factual, numerical, conceptual, NCERT-reference, formula, option, answer-key, or solution error.
- If you have ANY doubt about a question's correctness, DO NOT include it — silently discard it and generate a different, verified question in its place instead.
- Never output a placeholder, unverified, or "best guess" question. Only fully verified questions may appear in the final output.

Return ONLY the following JSON, wrapped exactly like this, nothing else - no markdown, no extra commentary, no headings, no code fences:

[ATOMIC_QUIZ_JSON]
{
  "questions": [
    {
      "id": "b1",
      "subject": "Biology",
      "questionType": "single_correct",
      "text": "question text or lead-in instruction (may include \\n for multi-line content); leave empty ONLY for assertion_reason type",
      "options": ["option A", "option B", "option C", "option D"],
      "correctIndex": 0,
      "explanation": "short fallback paragraph version of the solution",
      "explanationSteps": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
      "chapter": "broad NCERT chapter name, e.g. Human Reproduction, Thermodynamics",
      "topic": "specific sub-topic within that chapter, e.g. Spermatogenesis, Enthalpy Change",
      "difficulty": "Easy",
      "passage": "",
      "statements": [],
      "assertionText": "",
      "reasonText": "",
      "columnI": [],
      "columnII": [],
      "columnIII": [],
      "sequenceItems": [],
      "tableHeaders": [],
      "tableRows": [],
      "flowchartSteps": [],
      "imageRequired": false,
      "imageDescription": ""
    }
  ]
}
[/ATOMIC_QUIZ_JSON]

Rules:
- correctIndex is zero-based (0=A, 1=B, 2=C, 3=D).
- For assertion_reason type: "text" MUST be empty string "", and "assertionText"/"reasonText" MUST be populated separately. For all other types, "assertionText"/"reasonText" stay empty.
- "difficulty" must be exactly one of: "Easy", "Medium", "Hard" — matching the QUIZ LEVEL instructions above.
- Output must be valid JSON parseable by JSON.parse. No trailing commas, no comments, no text outside the [ATOMIC_QUIZ_JSON] block.`;
}

function isValidQuestion(q: unknown): q is QuizQuestion {
  if (!q || typeof q !== "object") return false;
  const question = q as Partial<QuizQuestion>;

  if (typeof question.text !== "string" || !question.text.trim()) return false;
  if (!Array.isArray(question.options) || question.options.length !== 4) return false;
  if (question.options.some((opt) => typeof opt !== "string" || !opt.trim())) return false;
  if (
    typeof question.correctIndex !== "number" ||
    !Number.isInteger(question.correctIndex) ||
    question.correctIndex < 0 ||
    question.correctIndex > 3
  )
    return false;
  if (typeof question.explanation !== "string" || !question.explanation.trim()) return false;
  if (typeof question.subject !== "string" || !question.subject.trim()) return false;

  return true;
}

export function parseQuizJson(content: string): QuizQuestion[] | null {
  const match = content.match(QUIZ_JSON_BLOCK);
  // Same noUncheckedIndexedAccess quirk as parseBoardExamJson in
  // boardExam.ts — match[1] types as string | undefined even though the
  // capture group always matches something once `match` is non-null.
  const raw = match?.[1] ?? content;

  try {
    const parsed = JSON.parse(raw.trim()) as { questions?: unknown[] };
    if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      return null;
    }

    // Drop any malformed/incomplete question instead of crashing the whole quiz.
    const validQuestions = parsed.questions.filter(isValidQuestion);
    if (validQuestions.length === 0) return null;

    return validQuestions;
  } catch {
    return null;
  }
}
