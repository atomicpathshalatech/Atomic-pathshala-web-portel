import { prisma } from "@/lib/db";

export type NEETPredictionResult = {
  rawScore: number;
  maxMarks: number;
  neetEquivalentScore: number;
  isNormalized: boolean;
  estimatedAIR: number;
  minAIR: number;
  maxAIR: number;
  confidence: "EXACT" | "HIGH" | "MEDIUM" | "LOW";
  isExactReference: boolean;
  percentile?: number | null;
  sourceDocument: string;
  sourcePage: number;
  datasetYear: number;
  disclaimer: string;
  categoryPrediction?: {
    category: string;
    isExact: boolean;
    estimatedCategoryRank?: number | null;
    minCategoryRank?: number | null;
    maxCategoryRank?: number | null;
    statusText: string;
    sourcePage?: number;
  };
  rank1Benchmark: {
    title: string;
    score: number;
    maxScore: number;
    gapMarks: number;
    sourcePage: number;
  };
};

/**
 * Predicts NEET All India Rank (AIR) and category rank based on the active
 * versioned NEET dataset (default: NEET 2026 from the official 15-page NTA document).
 */
export async function predictNEETRank({
  marks,
  maxMarks = 720,
  category,
}: {
  marks: number;
  maxMarks?: number;
  category?: string | null;
}): Promise<NEETPredictionResult> {
  // 1. Score scale validation & normalization
  const isNormalized = maxMarks !== 720 && maxMarks > 0;
  const neetEquivalentScore = isNormalized
    ? Math.round(((marks / maxMarks) * 720) * 10) / 10
    : Math.round(marks * 10) / 10;

  // Clamped score between 0 and 720
  const clampedScore = Math.max(0, Math.min(720, neetEquivalentScore));

  // 2. Fetch active dataset
  const dataset = await prisma.nEETRankDataset.findFirst({
    where: { isActive: true },
    orderBy: { year: "desc" },
    include: {
      references: { orderBy: { marks: "desc" } },
      categoryReferences: true,
      marksBrackets: { orderBy: { marksFrom: "desc" } },
    },
  });

  const datasetYear = dataset?.year ?? 2026;
  const sourceDoc = dataset?.sourceDocument ?? "Official NTA NEET (UG)-2026 Result PDF";

  // Rank 1 Benchmark
  const rank1Benchmark = {
    title: "NEET 2026 Rank 1 Performer",
    score: 720,
    maxScore: 720,
    gapMarks: Math.max(0, Math.round(720 - clampedScore)),
    sourcePage: 1,
  };

  const disclaimer =
    "This is an estimate based on available NEET 2026 marks-rank reference data and is not an official NTA rank.";

  if (!dataset || dataset.references.length === 0) {
    // Fallback if DB is empty
    return {
      rawScore: marks,
      maxMarks,
      neetEquivalentScore: clampedScore,
      isNormalized,
      estimatedAIR: 50000,
      minAIR: 45000,
      maxAIR: 55000,
      confidence: "LOW",
      isExactReference: false,
      sourceDocument: sourceDoc,
      sourcePage: 14,
      datasetYear,
      disclaimer,
      rank1Benchmark,
    };
  }

  const refs = dataset.references;

  // 3. Exact reference check
  const exactMatch = refs.find((r) => Math.abs(r.marks - clampedScore) < 0.01);
  if (exactMatch) {
    const rangeSpan = Math.max(50, Math.round(exactMatch.neetRank * 0.05));
    const minAIR = Math.max(1, exactMatch.neetRank - Math.round(rangeSpan / 2));
    const maxAIR = exactMatch.neetRank + Math.round(rangeSpan / 2);

    const catPrediction = evaluateCategoryRank(
      category,
      clampedScore,
      exactMatch.neetRank,
      dataset.categoryReferences
    );

    return {
      rawScore: marks,
      maxMarks,
      neetEquivalentScore: clampedScore,
      isNormalized,
      estimatedAIR: exactMatch.neetRank,
      minAIR,
      maxAIR,
      confidence: "EXACT",
      isExactReference: true,
      percentile: exactMatch.percentile,
      sourceDocument: sourceDoc,
      sourcePage: exactMatch.sourcePage,
      datasetYear,
      disclaimer,
      categoryPrediction: catPrediction,
      rank1Benchmark,
    };
  }

  // 4. Interpolation between nearest reference points
  // refs are ordered marks: "desc"
  const higherRef = refs.slice().reverse().find((r) => r.marks >= clampedScore) || refs[0];
  const lowerRef = refs.find((r) => r.marks <= clampedScore) || refs[refs.length - 1];

  let estimatedAIR: number;
  let confidence: "EXACT" | "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";
  let sourcePage = 14;

  if (clampedScore >= 720) {
    estimatedAIR = 1;
    confidence = "HIGH";
    sourcePage = 1;
  } else if (clampedScore <= 38) {
    estimatedAIR = 1950000;
    confidence = "LOW";
    sourcePage = 15;
  } else if (higherRef && lowerRef && higherRef.neetRank !== lowerRef.neetRank) {
    const marksSpan = higherRef.marks - lowerRef.marks;
    if (marksSpan <= 0) {
      estimatedAIR = higherRef.neetRank;
    } else {
      const frac = (higherRef.marks - clampedScore) / marksSpan;
      estimatedAIR = Math.round(higherRef.neetRank + frac * (lowerRef.neetRank - higherRef.neetRank));
    }

    if (marksSpan <= 15) confidence = "HIGH";
    else if (marksSpan <= 35) confidence = "MEDIUM";
    else confidence = "LOW";

    sourcePage = higherRef.sourcePage;
  } else {
    estimatedAIR = higherRef ? higherRef.neetRank : 100000;
    confidence = "LOW";
  }

  // Calculate dynamic defensible rank range
  const uncertaintyFactor = confidence === "HIGH" ? 0.04 : confidence === "MEDIUM" ? 0.08 : 0.15;
  const rankDelta = Math.max(50, Math.round(estimatedAIR * uncertaintyFactor));
  const minAIR = Math.max(1, estimatedAIR - rankDelta);
  const maxAIR = estimatedAIR + rankDelta;

  const catPrediction = evaluateCategoryRank(
    category,
    clampedScore,
    estimatedAIR,
    dataset.categoryReferences
  );

  return {
    rawScore: marks,
    maxMarks,
    neetEquivalentScore: clampedScore,
    isNormalized,
    estimatedAIR,
    minAIR,
    maxAIR,
    confidence,
    isExactReference: false,
    sourceDocument: sourceDoc,
    sourcePage,
    datasetYear,
    disclaimer,
    categoryPrediction: catPrediction,
    rank1Benchmark,
  };
}

/**
 * Honest, evidence-based evaluation of category rank based on official NTA reference data.
 */
function evaluateCategoryRank(
  category: string | null | undefined,
  score: number,
  air: number,
  categoryRefs: any[]
) {
  if (!category || category === "General" || category === "GENERAL" || category === "UR") {
    return {
      category: "General (UR)",
      isExact: false,
      statusText: "All India Rank (AIR) applies directly for General / Unreserved category.",
    };
  }

  const normCat = category.toUpperCase().trim();
  const matchedRefs = categoryRefs.filter((r) => r.category.toUpperCase().includes(normCat));

  if (matchedRefs.length === 0) {
    return {
      category,
      isExact: false,
      statusText: "Category rank cannot be determined exactly from the available NEET 2026 reference data.",
    };
  }

  // Check if candidate score is near category topper references
  const exactCatMatch = matchedRefs.find((r) => r.marks && Math.abs(r.marks - score) < 0.5);
  if (exactCatMatch) {
    return {
      category,
      isExact: true,
      estimatedCategoryRank: exactCatMatch.categoryRank,
      minCategoryRank: exactCatMatch.categoryRank,
      maxCategoryRank: exactCatMatch.categoryRank,
      statusText: `Exact category reference point: Category Rank #${exactCatMatch.categoryRank} (AIR #${exactCatMatch.neetRank}).`,
      sourcePage: exactCatMatch.sourcePage,
    };
  }

  // When only selected category toppers exist in source dataset, we give an honest estimation status
  return {
    category,
    isExact: false,
    statusText:
      "Category rank cannot be determined exactly from available NEET 2026 reference data (only selected category toppers are published in official NTA report).",
  };
}
