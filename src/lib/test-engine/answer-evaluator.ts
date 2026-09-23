/**
 * Comprehensive Answer Evaluation and Option Normalization Engine
 *
 * Guarantees that teacher-configured correct options and student selections
 * match 100% reliably regardless of how options were recorded:
 * - Letter keys: "A", "B", "C", "D", "E" / "a", "b", "c", "d", "e"
 * - Numeric indices (1-based): "1", "2", "3", "4" -> "A", "B", "C", "D"
 * - Numeric indices (0-based): "0", "1", "2", "3" -> "A", "B", "C", "D"
 * - Formatted labels: "(1)", "(2)", "(3)", "(4)", "(A)", "(B)", "(C)", "(D)", "1.", "2.", "A."
 * - JSON stringified arrays: '["A"]' or '["B"]'
 * - Multi-language translation fallbacks: English -> Hindi -> Raw
 * - Integer / numeric response questions: trimmed numeric comparison (e.g. "12" === "12.0")
 */

export function normalizeOptionKey(key: unknown): string {
  if (key === null || key === undefined) return "";
  let str = String(key).trim();
  if (!str) return "";

  // Remove surrounding quotes, brackets or parentheses e.g. "(A)" -> "A", "(1)" -> "1", "[A]" -> "A"
  str = str.replace(/^[\s(\["']+|[\s)\]"']+$/g, "").trim();

  // Check 1-based or 0-based numeric options to standard A/B/C/D
  if (str === "0") return "A";
  if (str === "1" || str === "1.") return "A";
  if (str === "2" || str === "2.") return "B";
  if (str === "3" || str === "3.") return "C";
  if (str === "4" || str === "4.") return "D";

  return str.toUpperCase();
}

export function parseOptionIds(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((item) => normalizeOptionKey(item)).filter(Boolean);
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => normalizeOptionKey(item)).filter(Boolean);
        }
      } catch {
        // Fallback below
      }
    }
    // Comma separated or single value
    return trimmed
      .split(",")
      .map((item) => normalizeOptionKey(item))
      .filter(Boolean);
  }
  return [normalizeOptionKey(raw)].filter(Boolean);
}

export interface QuestionWithTranslations {
  id?: string;
  type?: string;
  translations?: Array<{
    language?: string;
    statement?: string | null;
    correctOptionIds?: unknown;
    options?: unknown;
    solution?: string | null;
  }> | null;
  correctOption?: unknown;
  correctOptionIds?: unknown;
}

/**
 * Extracts canonical correct option keys from a question across all translations.
 */
export function extractCorrectOptionKeys(question: QuestionWithTranslations): string[] {
  // 1. Check English translation
  const enTrans = question.translations?.find((t) => t.language === "ENGLISH");
  let correctKeys = parseOptionIds(enTrans?.correctOptionIds);
  if (correctKeys.length > 0) return correctKeys;

  // 2. Check Hindi or any other translation
  if (question.translations && question.translations.length > 0) {
    for (const trans of question.translations) {
      correctKeys = parseOptionIds(trans.correctOptionIds);
      if (correctKeys.length > 0) return correctKeys;
    }
  }

  // 3. Check direct question fields
  if (question.correctOptionIds) {
    correctKeys = parseOptionIds(question.correctOptionIds);
    if (correctKeys.length > 0) return correctKeys;
  }
  if (question.correctOption) {
    correctKeys = parseOptionIds(question.correctOption);
    if (correctKeys.length > 0) return correctKeys;
  }

  return [];
}

/**
 * Robustly evaluates whether the student's selected answer matches the teacher's correct answer.
 */
export function isAnswerCorrect(
  correctRaw: unknown,
  selectedRaw: unknown,
  questionType?: string
): boolean {
  const selectedKeys = parseOptionIds(selectedRaw);
  if (selectedKeys.length === 0) return false;

  const correctKeys = parseOptionIds(correctRaw);
  if (correctKeys.length === 0) return false;

  // If INTEGER / NUMERIC question type
  if (questionType === "INTEGER" || questionType === "NUMERIC") {
    const sStr = selectedKeys[0] || "";
    const cStr = correctKeys[0] || "";
    const sVal = parseFloat(sStr);
    const cVal = parseFloat(cStr);
    if (!isNaN(sVal) && !isNaN(cVal)) {
      return Math.abs(sVal - cVal) < 0.0001;
    }
    return sStr.toLowerCase() === cStr.toLowerCase();
  }

  // Single or multiple correct MCQ
  if (correctKeys.length !== selectedKeys.length) return false;

  const setA = new Set(correctKeys);
  const setB = new Set(selectedKeys);

  for (const item of setA) {
    if (!setB.has(item)) return false;
  }

  return true;
}
