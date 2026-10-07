import crypto from "crypto";

export interface QuestionHashPayload {
  statement?: string | null;
  options?: any;
  correctOptionIds?: any;
  solution?: string | null;
  imageUrl?: string | null;
  referenceImageUrl?: string | null;
  type?: string | null;
  difficulty?: string | null;
  examLevel?: string | null;
  subject?: string | null;
  chapter?: string | null;
  topic?: string | null;
  subTopic?: string | null;
  microConcept?: string | null;
}

/**
 * Normalizes text content for deterministic hashing:
 * Trims whitespace, standardizes line breaks, and strips redundant spaces.
 */
function normalizeText(text?: string | null): string {
  if (!text) return "";
  return text.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
}

/**
 * Computes a deterministic SHA-256 fingerprint for a question.
 * If question content changes, the hash will change, triggering re-audit eligibility.
 */
export function computeQuestionContentHash(payload: QuestionHashPayload): string {
  const normStatement = normalizeText(payload.statement);
  
  // Normalize options into ordered JSON
  let normOptions: string = "";
  if (payload.options) {
    if (typeof payload.options === "object") {
      const keys = Object.keys(payload.options).sort();
      normOptions = keys.map((k) => `${k}:${normalizeText(String(payload.options[k]))}`).join("|");
    } else {
      normOptions = String(payload.options);
    }
  }

  // Normalize correct answer
  let normAnswer = "";
  if (Array.isArray(payload.correctOptionIds)) {
    normAnswer = [...payload.correctOptionIds].map(String).sort().join(",");
  } else if (payload.correctOptionIds) {
    normAnswer = String(payload.correctOptionIds).trim();
  }

  const normSolution = normalizeText(payload.solution);
  const normImg = (payload.imageUrl || payload.referenceImageUrl || "").trim();
  const normType = (payload.type || "SINGLE_CORRECT").toUpperCase().trim();
  const normDiff = (payload.difficulty || "MEDIUM").toUpperCase().trim();
  const normExam = (payload.examLevel || "NEET").toUpperCase().trim();
  const normSubject = (payload.subject || "").toUpperCase().trim();
  const normChapter = (payload.chapter || "").trim();
  const normTopic = (payload.topic || "").trim();
  const normSubTopic = (payload.subTopic || "").trim();
  const normMicro = (payload.microConcept || "").trim();

  const canonicalString = [
    `STATEMENT:${normStatement}`,
    `OPTIONS:${normOptions}`,
    `ANSWER:${normAnswer}`,
    `SOLUTION:${normSolution}`,
    `IMAGE:${normImg}`,
    `TYPE:${normType}`,
    `DIFF:${normDiff}`,
    `EXAM:${normExam}`,
    `SUB:${normSubject}`,
    `CH:${normChapter}`,
    `TOP:${normTopic}`,
    `SUBTOP:${normSubTopic}`,
    `MICRO:${normMicro}`,
  ].join("###");

  return crypto.createHash("sha256").update(canonicalString, "utf8").digest("hex");
}

/**
 * Determines if a question needs re-audit based on hash comparison.
 */
export function hasQuestionContentChanged(
  existingHash?: string | null,
  newPayload?: QuestionHashPayload
): boolean {
  if (!existingHash) return true;
  if (!newPayload) return false;
  const newHash = computeQuestionContentHash(newPayload);
  return existingHash !== newHash;
}
