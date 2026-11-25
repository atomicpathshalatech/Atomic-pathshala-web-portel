import type { PptQuestionItem } from "@/app/api/team/questions/export-ppt/lookup/route";

export type PptLanguageMode = "ENGLISH" | "HINDI" | "BILINGUAL";
export type PptFontMode = "auto" | "large" | "compact";

export interface PptExportSettings {
  includeBranding: boolean;
  includeQuestionNumber: boolean;
  includeQuestionId: boolean;
  includeCorrectAnswer: boolean;
  includeSubjectHeader: boolean;
  language: PptLanguageMode;
  splitLongQuestions: boolean;
  fontSizeMode: PptFontMode;
  headerSubtitle: string;
}

export const DEFAULT_PPT_SETTINGS: PptExportSettings = {
  includeBranding: true,
  includeQuestionNumber: true,
  includeQuestionId: true,
  includeCorrectAnswer: true,
  includeSubjectHeader: true,
  language: "ENGLISH",
  splitLongQuestions: true,
  fontSizeMode: "auto",
  headerSubtitle: "NEET | QUESTION PRACTICE",
};

export interface PlannedSlide {
  slideNumber: number;
  questionIndex: number;
  question: PptQuestionItem;
  kind: "FULL" | "STATEMENT_ONLY" | "OPTIONS_ONLY";
  isSplit: boolean;
  statementEn: string;
  statementHi: string | null;
  optionsEn: Array<{ key: string; text: string }>;
  optionsHi: Array<{ key: string; text: string }>;
  correctAnswerLabel: string | null;
  estimatedFontPt: number;
}

const OPTION_ORDER = ["A", "B", "C", "D", "E", "F"];

function orderedOptions(map?: Record<string, string> | null): Array<{ key: string; text: string }> {
  if (!map) return [];
  const entries: Array<{ key: string; text: string }> = [];
  for (const key of OPTION_ORDER) {
    const val = map[key];
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      entries.push({ key, text: String(val) });
    }
  }
  for (const [k, v] of Object.entries(map)) {
    if (!OPTION_ORDER.includes(k) && v !== undefined && v !== null && String(v).trim() !== "") {
      entries.push({ key: k, text: String(v) });
    }
  }
  return entries;
}

function estimateContentWeight(q: PptQuestionItem, settings: PptExportSettings): number {
  const enLen = q.english?.statement?.length ?? 0;
  const hiLen = settings.language !== "ENGLISH" ? (q.hindi?.statement?.length ?? 0) : 0;
  const opts = orderedOptions(q.english?.options);
  const optChars = opts.reduce((acc, o) => acc + o.text.length, 0);
  const hasMedia = Boolean(q.camDrawData || q.imageUrl);
  const hasTable = /<table|<tr|\\begin\{(matrix|pmatrix|bmatrix|array)/i.test(
    `${q.english?.statement ?? ""} ${q.hindi?.statement ?? ""}`
  );
  const lineBreaks = (q.english?.statement?.match(/\n|<br\s*\/?>/gi) ?? []).length;

  let score = enLen + hiLen * 0.9 + optChars * 0.85 + lineBreaks * 45;
  if (hasMedia) score += 280;
  if (hasTable) score += 220;
  return score;
}

export function buildSlidePlan(
  questions: PptQuestionItem[],
  settings: PptExportSettings
): PlannedSlide[] {
  const slides: PlannedSlide[] = [];

  questions.forEach((q, qIdx) => {
    const enStmt = q.english?.statement?.trim() || "";
    const hiStmt = q.hindi?.statement?.trim() || "";
    const enOpts = orderedOptions(q.english?.options);
    const hiOpts = orderedOptions(q.hindi?.options);

    const primaryCorrect =
      q.english?.correctOptionIds?.length
        ? q.english.correctOptionIds
        : q.hindi?.correctOptionIds ?? [];
    const correctAnswerLabel =
      primaryCorrect.length > 0 ? primaryCorrect.join(", ") : null;

    const useEn = settings.language === "ENGLISH" || settings.language === "BILINGUAL" || !hiStmt;
    const useHi = (settings.language === "HINDI" || settings.language === "BILINGUAL") && Boolean(hiStmt);

    const statementEn = useEn ? enStmt : "";
    const statementHi = useHi ? hiStmt : null;
    const optionsEn = useEn ? enOpts : [];
    const optionsHi = useHi ? hiOpts : [];

    const weight = estimateContentWeight(q, settings);
    const shouldSplit =
      settings.splitLongQuestions &&
      (weight > 780 || (settings.language === "BILINGUAL" && weight > 620)) &&
      (optionsEn.length > 0 || optionsHi.length > 0);

    const baseFontPt =
      settings.fontSizeMode === "large"
        ? 19
        : settings.fontSizeMode === "compact"
        ? 14
        : weight > 650
        ? 14
        : weight > 420
        ? 16
        : 18;

    if (shouldSplit) {
      slides.push({
        slideNumber: slides.length + 1,
        questionIndex: qIdx,
        question: q,
        kind: "STATEMENT_ONLY",
        isSplit: true,
        statementEn,
        statementHi,
        optionsEn: [],
        optionsHi: [],
        correctAnswerLabel: null,
        estimatedFontPt: Math.min(18, baseFontPt + 1),
      });
      slides.push({
        slideNumber: slides.length + 1,
        questionIndex: qIdx,
        question: q,
        kind: "OPTIONS_ONLY",
        isSplit: true,
        statementEn: "",
        statementHi: null,
        optionsEn,
        optionsHi,
        correctAnswerLabel,
        estimatedFontPt: Math.min(18, baseFontPt + 1),
      });
    } else {
      slides.push({
        slideNumber: slides.length + 1,
        questionIndex: qIdx,
        question: q,
        kind: "FULL",
        isSplit: false,
        statementEn,
        statementHi,
        optionsEn,
        optionsHi,
        correctAnswerLabel,
        estimatedFontPt: baseFontPt,
      });
    }
  });

  return slides;
}
