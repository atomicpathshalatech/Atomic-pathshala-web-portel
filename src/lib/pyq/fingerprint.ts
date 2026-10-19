import { createHash } from "node:crypto";
import { computeJaccardSimilarity, normalizeText } from "@/lib/questions/similarity";

/**
 * Duplicate evidence for PYQ imports. A fingerprint is the normalised
 * statement plus the normalised option set (order-independent, so a paper
 * that shuffles options still matches). Matching only ever produces a
 * warning for review — nothing is merged or deleted on similarity alone.
 */

function clean(text: string): string {
  return normalizeText(
    String(text || "")
      .replace(/\$+/g, " ")
      .replace(/\\(?:text|mathrm|mathbf|left|right|,|;|!)/g, " ")
  );
}

export function questionFingerprint(statement: string, options?: Record<string, string> | null): string {
  const opts = Object.values(options || {})
    .map(clean)
    .filter(Boolean)
    .sort()
    .join("|");
  return createHash("sha1").update(`${clean(statement)}||${opts}`).digest("hex");
}

export type DuplicateEvidence = {
  score: number; // 0-100
  statementScore: number;
  optionsScore: number;
  exact: boolean;
  reasons: string[];
};

export function compareQuestions(
  a: { statement: string; options?: Record<string, string> | null; fingerprint?: string | null },
  b: { statement: string; options?: Record<string, string> | null; fingerprint?: string | null }
): DuplicateEvidence {
  const fa = a.fingerprint ?? questionFingerprint(a.statement, a.options);
  const fb = b.fingerprint ?? questionFingerprint(b.statement, b.options);
  if (fa === fb) {
    return { score: 100, statementScore: 100, optionsScore: 100, exact: true, reasons: ["Identical text and options"] };
  }
  const statementScore = computeJaccardSimilarity(clean(a.statement), clean(b.statement));
  const oa = Object.values(a.options || {}).map(clean).filter(Boolean);
  const ob = new Set(Object.values(b.options || {}).map(clean).filter(Boolean));
  const optionsScore = oa.length && ob.size ? Math.round((oa.filter((o) => ob.has(o)).length / Math.max(oa.length, ob.size)) * 100) : 0;
  const score = oa.length && ob.size ? Math.round(statementScore * 0.7 + optionsScore * 0.3) : statementScore;
  const reasons = [`Question text ${statementScore}% alike`];
  if (oa.length && ob.size) reasons.push(`${optionsScore}% of options identical`);
  // Same words, different numbers ("20 m/s" vs "25 m/s") is a different question.
  const numsA = (clean(a.statement).match(/\d+(?:\.\d+)?/g) || []).join(",");
  const numsB = (clean(b.statement).match(/\d+(?:\.\d+)?/g) || []).join(",");
  if (numsA !== numsB) reasons.push("Numbers in the question differ");
  return { score: numsA !== numsB ? Math.min(score, 84) : score, statementScore, optionsScore, exact: false, reasons };
}

/** Threshold for raising a "possible duplicate" warning. */
export const DUPLICATE_WARNING_SCORE = 85;
