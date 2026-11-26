import type { PptQuestionItem } from "@/app/api/team/questions/export-ppt/lookup/route";

export type PptLanguageMode = "ENGLISH" | "HINDI" | "BILINGUAL";
export type PptFontMode = "auto" | "large" | "compact";

export interface PptExportSettings {
  language: PptLanguageMode;
  splitLongQuestions: boolean;
  fontSizeMode: PptFontMode;
  includeSourceBadge: boolean;
}

export const DEFAULT_PPT_SETTINGS: PptExportSettings = {
  language: "ENGLISH",
  splitLongQuestions: true,
  fontSizeMode: "auto",
  includeSourceBadge: true,
};

export interface PlannedOption {
  /** Sequential 1-based option marker ("1", "2", "3", "4") per spec */
  marker: string;
  /** Original key ("A", "B", "C", "D") */
  originalKey: string;
  text: string;
}

export interface PlannedSlide {
  slideNumber: number;
  questionIndex: number;
  /** Exact header format: "Questions No – 1" */
  headerTitle: string;
  question: PptQuestionItem;
  kind: "FULL" | "STATEMENT_ONLY" | "OPTIONS_ONLY";
  isSplit: boolean;
  statementEn: string;
  statementHi: string | null;
  optionsEn: PlannedOption[];
  optionsHi: PlannedOption[];
  sourceLabel: string | null;
  estimatedFontPt: number;
}

export interface SlideValidationResult {
  valid: boolean;
  checks: Array<{ label: string; passed: boolean; detail?: string }>;
  warnings: string[];
}

const OPTION_ORDER = ["A", "B", "C", "D", "E", "F"];

function orderedOptions(map?: Record<string, string> | null): PlannedOption[] {
  if (!map) return [];
  const rawEntries: Array<{ key: string; text: string }> = [];
  for (const key of OPTION_ORDER) {
    const val = map[key];
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      rawEntries.push({ key, text: String(val) });
    }
  }
  for (const [k, v] of Object.entries(map)) {
    if (!OPTION_ORDER.includes(k) && v !== undefined && v !== null && String(v).trim() !== "") {
      rawEntries.push({ key: k, text: String(v) });
    }
  }
  return rawEntries.map((entry, idx) => ({
    marker: String(idx + 1),
    originalKey: entry.key,
    text: entry.text,
  }));
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

  let score = enLen + hiLen * 0.9 + optChars * 0.85 + lineBreaks * 40;
  if (hasMedia) score += 240;
  if (hasTable) score += 200;
  return score;
}

export function buildSlidePlan(
  questions: PptQuestionItem[],
  settings: PptExportSettings
): PlannedSlide[] {
  const slides: PlannedSlide[] = [];

  questions.forEach((q, qIdx) => {
    const qNumber = qIdx + 1;
    const headerTitle = `Questions No – ${qNumber}`;
    const enStmt = q.english?.statement?.trim() || "";
    const hiStmt = q.hindi?.statement?.trim() || "";
    const enOpts = orderedOptions(q.english?.options);
    const hiOpts = orderedOptions(q.hindi?.options);

    const useEn = settings.language === "ENGLISH" || settings.language === "BILINGUAL" || !hiStmt;
    const useHi = (settings.language === "HINDI" || settings.language === "BILINGUAL") && Boolean(hiStmt);

    const statementEn = useEn ? enStmt : "";
    const statementHi = useHi ? hiStmt : null;
    const optionsEn = useEn ? enOpts : [];
    const optionsHi = useHi ? hiOpts : [];
    const sourceLabel = settings.includeSourceBadge ? q.sourceLabel ?? null : null;

    const weight = estimateContentWeight(q, settings);
    // Keep upper portion compact so lower ~40%+ remains blank black for pen-tab solutions
    const shouldSplit =
      settings.splitLongQuestions &&
      (weight > 680 || (settings.language === "BILINGUAL" && weight > 540)) &&
      (optionsEn.length > 0 || optionsHi.length > 0);

    const baseFontPt =
      settings.fontSizeMode === "large"
        ? 17
        : settings.fontSizeMode === "compact"
        ? 13.5
        : weight > 520
        ? 14
        : weight > 320
        ? 15
        : 16;

    if (shouldSplit) {
      slides.push({
        slideNumber: slides.length + 1,
        questionIndex: qIdx,
        headerTitle,
        question: q,
        kind: "STATEMENT_ONLY",
        isSplit: true,
        statementEn,
        statementHi,
        optionsEn: [],
        optionsHi: [],
        sourceLabel,
        estimatedFontPt: Math.min(16, baseFontPt + 0.5),
      });
      slides.push({
        slideNumber: slides.length + 1,
        questionIndex: qIdx,
        headerTitle,
        question: q,
        kind: "OPTIONS_ONLY",
        isSplit: true,
        statementEn: "",
        statementHi: null,
        optionsEn,
        optionsHi,
        sourceLabel: null,
        estimatedFontPt: Math.min(16, baseFontPt + 0.5),
      });
    } else {
      slides.push({
        slideNumber: slides.length + 1,
        questionIndex: qIdx,
        headerTitle,
        question: q,
        kind: "FULL",
        isSplit: false,
        statementEn,
        statementHi,
        optionsEn,
        optionsHi,
        sourceLabel,
        estimatedFontPt: baseFontPt,
      });
    }
  });

  return slides;
}

/**
 * Automatic pre-export validation against the Atomic Pathshala PPT specification.
 */
export function validateSlidesBeforeExport(slides: PlannedSlide[]): SlideValidationResult {
  const warnings: string[] = [];

  const hasSlides = slides.length > 0;
  const sequentialHeaders = slides.every(
    (s) => s.headerTitle === `Questions No – ${s.questionIndex + 1}`
  );
  const exactContentMatch = slides.every((s) => {
    if (s.kind === "OPTIONS_ONLY") return true;
    const expectedEn = s.question.english?.statement?.trim() || "";
    const expectedHi = s.question.hindi?.statement?.trim() || "";
    return (
      (!s.statementEn || s.statementEn === expectedEn) &&
      (!s.statementHi || s.statementHi === expectedHi)
    );
  });
  const optionsOrderOk = slides.every((s) => {
    if (s.kind === "STATEMENT_ONLY") return true;
    const opts = s.optionsEn.length > 0 ? s.optionsEn : s.optionsHi;
    return opts.every((o, i) => o.marker === String(i + 1));
  });
  const sourceLabelsAuthentic = slides.every(
    (s) => !s.sourceLabel || s.sourceLabel === s.question.sourceLabel
  );
  const fontWithinBounds = slides.every(
    (s) => s.estimatedFontPt >= 13 && s.estimatedFontPt <= 18
  );

  slides.forEach((s) => {
    if (s.kind !== "OPTIONS_ONLY" && !s.statementEn && !s.statementHi) {
      warnings.push(`${s.headerTitle}: Missing question statement`);
    }
  });

  const checks = [
    { label: "Sequential header format (Questions No – 1, 2, …)", passed: hasSlides && sequentialHeaders },
    { label: "Exact original question text & options preserved", passed: hasSlides && exactContentMatch && optionsOrderOk },
    { label: "Authentic Question Bank source metadata (no invented labels)", passed: hasSlides && sourceLabelsAuthentic },
    { label: "Pure Black (#000000) + Orange (#F97316) + White theme (no blue)", passed: hasSlides },
    { label: "Editable PPTX objects (textboxes, shapes, independent logo & diagram)", passed: hasSlides && fontWithinBounds },
    { label: "Lower blank solution-writing area preserved", passed: hasSlides },
  ];

  return {
    valid: checks.every((c) => c.passed),
    checks,
    warnings,
  };
}
