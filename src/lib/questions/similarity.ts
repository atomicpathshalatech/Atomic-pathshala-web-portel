import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

export interface SimilarityMatch {
  questionId: string;
  questionCode: string;
  statementEn: string;
  statementHi?: string | null;
  subject: string;
  chapter?: string | null;
  topic?: string | null;
  subTopic?: string | null;
  difficulty: string;
  optionsEn?: Record<string, string> | null;
  optionsHi?: Record<string, string> | null;
  correctAnswer?: string[];
  solutionEn?: string | null;
  overallScore: number; // 0 - 100
  textSimilarity: number;
  conceptSimilarity: number;
  optionSimilarity: number;
  structureSimilarity: number;
  classification:
    | "EXACT_DUPLICATE"
    | "NEAR_DUPLICATE"
    | "HIGHLY_SIMILAR"
    | "SIMILAR"
    | "RELATED"
    | "LOW_SIMILARITY";
  matchHighlights?: string[];
}

export interface SimilarityReport {
  duplicateRisk: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE";
  highestScore: number;
  highestMatch?: SimilarityMatch | null;
  totalMatches: number;
  exactCount: number;
  nearDuplicateCount: number;
  highlySimilarCount: number;
  similarCount: number;
  relatedCount: number;
  matches: SimilarityMatch[];
}

/**
 * Normalizes text for exact hash matching and fuzzy token comparison
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, " ") // Strip HTML tags
    .replace(/[^\w\s\u0900-\u097F]/gi, " ") // Keep alphanumeric + Devanagari
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Generates SHA-256 hash of normalized text
 */
export function getContentHash(text: string): string {
  const norm = normalizeText(text);
  return crypto.createHash("sha256").update(norm).digest("hex");
}

/**
 * Strips numerical quantities to create a structural template
 * e.g. "A car moves at 20 m/s for 5 sec" -> "a car moves at #NUM m/s for #NUM sec"
 */
export function extractStructuralTemplate(text: string): string {
  return normalizeText(text).replace(/\b\d+(\.\d+)?\b/g, "#NUM");
}

/**
 * Computes Token Jaccard Similarity (0 to 100)
 */
export function computeJaccardSimilarity(textA: string, textB: string): number {
  const tokensA = new Set(normalizeText(textA).split(/\s+/).filter(Boolean));
  const tokensB = new Set(normalizeText(textB).split(/\s+/).filter(Boolean));

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) intersection++;
  });

  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : Math.round((intersection / union) * 100);
}

/**
 * Classifies similarity score into defined categories
 */
export function classifySimilarityScore(
  score: number
): SimilarityMatch["classification"] {
  if (score >= 100) return "EXACT_DUPLICATE";
  if (score >= 90) return "NEAR_DUPLICATE";
  if (score >= 75) return "HIGHLY_SIMILAR";
  if (score >= 60) return "SIMILAR";
  if (score >= 40) return "RELATED";
  return "LOW_SIMILARITY";
}

/**
 * Executes multi-stage similarity analysis against existing Question Bank
 */
export async function analyzeQuestionSimilarity(
  prisma: PrismaClient,
  input: {
    statementEn?: string;
    statementHi?: string;
    subject?: string;
    chapter?: string;
    topic?: string;
    optionsEn?: Record<string, string>;
    optionsHi?: Record<string, string>;
    excludeQuestionId?: string;
  }
): Promise<SimilarityReport> {
  const statementEn = input.statementEn?.trim() || "";
  const statementHi = input.statementHi?.trim() || "";

  if (!statementEn && !statementHi) {
    return {
      duplicateRisk: "NONE",
      highestScore: 0,
      totalMatches: 0,
      exactCount: 0,
      nearDuplicateCount: 0,
      highlySimilarCount: 0,
      similarCount: 0,
      relatedCount: 0,
      matches: [],
    };
  }

  const queryTemplateEn = statementEn ? extractStructuralTemplate(statementEn) : "";

  // Candidate Retrieval: prioritize questions in same subject/chapter
  const where: any = {
    id: input.excludeQuestionId ? { not: input.excludeQuestionId } : undefined,
  };
  if (input.subject) {
    where.subject = { equals: input.subject, mode: "insensitive" };
  }

  let candidates = await prisma.question.findMany({
    where,
    include: {
      translations: true,
    },
    take: 150,
    orderBy: { createdAt: "desc" },
  });

  // If fewer than 20 candidates in subject, supplement with global pool
  if (candidates.length < 20) {
    const globalCandidates = await prisma.question.findMany({
      where: {
        id: input.excludeQuestionId ? { not: input.excludeQuestionId } : undefined,
      },
      include: {
        translations: true,
      },
      take: 100,
      orderBy: { createdAt: "desc" },
    });
    const existingIds = new Set(candidates.map((c) => c.id));
    for (const gc of globalCandidates) {
      if (!existingIds.has(gc.id)) candidates.push(gc);
    }
  }

  const matches: SimilarityMatch[] = [];

  for (const q of candidates) {
    const existingEnTrans = q.translations.find((t) => t.language === "ENGLISH");
    const existingHiTrans = q.translations.find((t) => t.language === "HINDI");

    const existingEn = existingEnTrans?.statement || "";
    const existingHi = existingHiTrans?.statement || "";

    // 1. Text Similarity (English & Cross-Language)
    let textSimEn = statementEn && existingEn ? computeJaccardSimilarity(statementEn, existingEn) : 0;
    let textSimHi = statementHi && existingHi ? computeJaccardSimilarity(statementHi, existingHi) : 0;
    let textSimilarity = Math.max(textSimEn, textSimHi);

    // Exact check
    if (
      (statementEn && existingEn && normalizeText(statementEn) === normalizeText(existingEn)) ||
      (statementHi && existingHi && normalizeText(statementHi) === normalizeText(existingHi))
    ) {
      textSimilarity = 100;
    }

    // 2. Structural / Template Similarity (Changed Numbers detection)
    let structureSimilarity = 0;
    if (queryTemplateEn && existingEn) {
      const existTemplate = extractStructuralTemplate(existingEn);
      structureSimilarity = computeJaccardSimilarity(queryTemplateEn, existTemplate);
      if (queryTemplateEn === existTemplate && queryTemplateEn.length > 20) {
        structureSimilarity = 95;
      }
    }

    // 3. Concept / Topic Similarity
    let conceptSimilarity = 0;
    if (input.subject && q.subject && input.subject.toLowerCase() === q.subject.toLowerCase()) {
      conceptSimilarity += 30;
      if (input.chapter && q.chapter && input.chapter.toLowerCase() === q.chapter.toLowerCase()) {
        conceptSimilarity += 40;
        if (input.topic && q.topic && input.topic.toLowerCase() === q.topic.toLowerCase()) {
          conceptSimilarity += 30;
        }
      }
    }

    // 4. Option Similarity
    let optionSimilarity = 0;
    if (input.optionsEn && existingEnTrans?.options) {
      const optsA = Object.values(input.optionsEn).join(" ");
      const optsB = Object.values(existingEnTrans.options as Record<string, string>).join(" ");
      optionSimilarity = computeJaccardSimilarity(optsA, optsB);
    }

    // Overall Weighted Score
    let overallScore = 0;
    if (textSimilarity === 100) {
      overallScore = 100;
    } else {
      overallScore = Math.round(
        textSimilarity * 0.45 +
          structureSimilarity * 0.25 +
          conceptSimilarity * 0.15 +
          optionSimilarity * 0.15
      );
    }

    // Only collect matches with score >= 40%
    if (overallScore >= 40) {
      const classification = classifySimilarityScore(overallScore);
      matches.push({
        questionId: q.id,
        questionCode: q.questionCode || q.id.slice(0, 8),
        statementEn: existingEn,
        statementHi: existingHi,
        subject: q.subject,
        chapter: q.chapter,
        topic: q.topic,
        subTopic: q.subTopic,
        difficulty: q.difficulty,
        optionsEn: (existingEnTrans?.options as Record<string, string>) || null,
        optionsHi: (existingHiTrans?.options as Record<string, string>) || null,
        correctAnswer: (existingEnTrans?.correctOptionIds as string[]) || [],
        solutionEn: existingEnTrans?.solution || q.solution,
        overallScore,
        textSimilarity,
        conceptSimilarity,
        optionSimilarity,
        structureSimilarity,
        classification,
      });
    }
  }

  // Sort descending by similarity score
  matches.sort((a, b) => b.overallScore - a.overallScore);

  const highestScore = matches[0]?.overallScore || 0;
  let duplicateRisk: SimilarityReport["duplicateRisk"] = "NONE";
  if (highestScore === 100) duplicateRisk = "CRITICAL";
  else if (highestScore >= 90) duplicateRisk = "HIGH";
  else if (highestScore >= 75) duplicateRisk = "MEDIUM";
  else if (highestScore >= 50) duplicateRisk = "LOW";

  return {
    duplicateRisk,
    highestScore,
    highestMatch: matches[0] || null,
    totalMatches: matches.length,
    exactCount: matches.filter((m) => m.classification === "EXACT_DUPLICATE").length,
    nearDuplicateCount: matches.filter((m) => m.classification === "NEAR_DUPLICATE").length,
    highlySimilarCount: matches.filter((m) => m.classification === "HIGHLY_SIMILAR").length,
    similarCount: matches.filter((m) => m.classification === "SIMILAR").length,
    relatedCount: matches.filter((m) => m.classification === "RELATED").length,
    matches: matches.slice(0, 10),
  };
}