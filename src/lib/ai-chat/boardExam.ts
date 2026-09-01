// ===== Board Exam Hub =====
// AI generates content on demand, nothing is stored in a static question bank.

export interface BoardOption {
  value: string;
  label: string;
}

export const BOARDS: BoardOption[] = [
  { value: "CBSE", label: "CBSE" },
  { value: "UP_BOARD", label: "UP Board (UPMSP)" },
  { value: "BIHAR_BOARD", label: "Bihar Board (BSEB)" },
  { value: "MP_BOARD", label: "MP Board (MPBSE)" },
  { value: "RAJASTHAN_BOARD", label: "Rajasthan Board (RBSE)" },
  { value: "UTTARAKHAND_BOARD", label: "Uttarakhand Board (UBSE)" },
  { value: "HARYANA_BOARD", label: "Haryana Board (HBSE)" },
  { value: "JHARKHAND_BOARD", label: "Jharkhand Board (JAC)" },
  { value: "CHHATTISGARH_BOARD", label: "Chhattisgarh Board (CGBSE)" },
  { value: "HIMACHAL_BOARD", label: "Himachal Pradesh Board (HPBOSE)" },
  { value: "JAC_BOARD", label: "Jammu & Kashmir Board (JKBOSE)" },
];

export type BoardClass = "10th" | "12th";

export const CLASSES: { value: BoardClass; label: string }[] = [
  { value: "10th", label: "Class 10th" },
  { value: "12th", label: "Class 12th (Science)" },
];

export const SUBJECTS_BY_CLASS: Record<BoardClass, string[]> = {
  "10th": ["Science", "Mathematics", "Social Science", "Hindi", "English"],
  "12th": ["Physics", "Chemistry", "Biology", "Mathematics", "Hindi", "English"],
};

export type BoardLanguage = "hindi" | "english" | "hinglish";

export const LANGUAGES: { value: BoardLanguage; label: string }[] = [
  { value: "hindi", label: "Hindi (Devanagari)" },
  { value: "english", label: "English" },
  { value: "hinglish", label: "Hinglish" },
];

export type BoardMode = "pyq" | "model_paper";

export const MODES: { value: BoardMode; label: string; description: string }[] = [
  {
    value: "pyq",
    label: "PYQ Practice",
    description: "Previous-year-style questions in the board's exact section pattern.",
  },
  {
    value: "model_paper",
    label: "Model Paper",
    description: "A full expected paper covering the most likely repeat topics.",
  },
];

export type BoardQuestionType = "mcq" | "assertion_reason" | "short" | "long";

export interface BoardSubPart {
  label: string;
  text: string;
  marks: number;
  type: BoardQuestionType;
  options?: string[];
  correctIndex?: number;
  answer?: string;
}

export interface BoardQuestion {
  id: string;
  sectionTitle: string;
  questionNumber: number;
  subParts: BoardSubPart[];
  orAlternative?: BoardSubPart[];
}

export interface BoardPaper {
  board: string;
  className: BoardClass;
  subject: string;
  mode: BoardMode;
  totalMarks: number;
  timeAllowed: string;
  questions: BoardQuestion[];
}

interface BuildPromptParams {
  board: string;
  boardLabel: string;
  className: BoardClass;
  subject: string;
  language: BoardLanguage;
  mode: BoardMode;
}

export function buildBoardExamPrompt(params: BuildPromptParams): string {
  const { boardLabel, className, subject, language, mode } = params;

  const languageLine =
    language === "hindi"
      ? "Write every question, option, and answer ONLY in Hindi using Devanagari script. Do not use Romanized Hindi."
      : language === "hinglish"
        ? "Write in Hinglish (Hindi conversational tone using Roman/English script)."
        : "Write in clear English.";

  const modeLine =
    mode === "pyq"
      ? "Generate PYQ-style practice questions: match the exact difficulty, phrasing style, and section pattern seen in this board's real past-year papers. Do NOT copy any actual official question verbatim - generate original questions in that same style."
      : "Generate one complete model/expected question paper: prioritize topics and question types that repeat most often in this board's exam trend, so it reads like a realistic 'most expected paper' for this subject, while still following the board's official section pattern below.";

  return `Generate a board exam paper for:
Board: ${boardLabel}
Class: ${className}
Subject: ${subject}

${modeLine}
${languageLine}

Follow this exact section structure, which matches how ${boardLabel}-style Class ${className} papers are actually organized (this pattern is common across CBSE and most Hindi-medium state boards):

1. "Multiple Choice Questions" - ONE question (questionNumber 1) containing 4 sub-parts (a-d), 1 mark each. One of the 4 sub-parts may optionally be an "assertion_reason" type (a statement labeled Assertion (A) and one labeled Reason (R), with 4 standard options about whether A and R are true/false and whether R explains A).
2. "Very Short Answer Type Questions" - ONE question (questionNumber 2) containing 5 sub-parts (a-e), 1 mark each, each needing a one-line answer.
3. "Short Answer Type Questions - I" - ONE question (questionNumber 3) containing 4-5 sub-parts (a-e), 1-2 marks each.
4. "Short Answer Type Questions - II" - THREE questions (questionNumber 4, 5, 6), each containing 3-4 sub-parts worth 3 marks each. At least one sub-part across these three questions should be based on a labeled diagram description or a short paragraph the student must read and answer from (describe the diagram/paragraph in the "text" field since no image can be generated).
5. "Long Answer Type Questions" - THREE questions (questionNumber 7, 8, 9), each worth 5 marks total, each with ONE main sub-part AND an "orAlternative" containing an alternative question of equal difficulty and marks (matching the real board pattern of offering an "OR" choice on long-answer questions).

Target a total of around 70 marks and a time allowance of "3 hours 15 minutes" (adjust total marks slightly if the subject convention differs, but stay close to this).

Respond with ONLY valid JSON in this exact shape, no markdown fences, no commentary:
{
  "totalMarks": 70,
  "timeAllowed": "3 hours 15 minutes",
  "questions": [
    {
      "id": "q1",
      "sectionTitle": "Multiple Choice Questions",
      "questionNumber": 1,
      "subParts": [
        {
          "label": "a",
          "text": "question text",
          "marks": 1,
          "type": "mcq",
          "options": ["option1", "option2", "option3", "option4"],
          "correctIndex": 0
        }
      ]
    },
    {
      "id": "q7",
      "sectionTitle": "Long Answer Type Questions",
      "questionNumber": 7,
      "subParts": [
        { "label": "a", "text": "main long question", "marks": 5, "type": "long", "answer": "model answer outline" }
      ],
      "orAlternative": [
        { "label": "a", "text": "alternative long question of equal difficulty", "marks": 5, "type": "long", "answer": "model answer outline" }
      ]
    }
  ]
}`;
}

const JSON_BLOCK = /```(?:json)?\s*([\s\S]*?)\s*```/i;

export function parseBoardExamJson(
  content: string,
  board: string,
  className: BoardClass,
  subject: string,
  mode: BoardMode
): BoardPaper | null {
  const match = content.match(JSON_BLOCK);
  // match[1] is typed string | undefined under noUncheckedIndexedAccess
  // even though the capture group always matches something when `match`
  // is non-null (it's a plain (...), never optional) — ?? content is the
  // same fallback as the original ternary, just typed correctly.
  const raw = match?.[1] ?? content;

  try {
    const parsed = JSON.parse(raw.trim()) as {
      totalMarks?: number;
      timeAllowed?: string;
      questions?: BoardQuestion[];
    };
    if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      return null;
    }

    const computedTotal = parsed.questions.reduce((sum, q) => {
      const mainMarks = (q.subParts ?? []).reduce((s, sp) => s + (sp.marks || 0), 0);
      return sum + mainMarks;
    }, 0);

    return {
      board,
      className,
      subject,
      mode,
      totalMarks: parsed.totalMarks ?? computedTotal,
      timeAllowed: parsed.timeAllowed ?? "3 hours 15 minutes",
      questions: parsed.questions,
    };
  } catch {
    return null;
  }
}
