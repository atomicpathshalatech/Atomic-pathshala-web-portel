/**
 * NEET Pattern Alignment & Difficulty Analysis Module
 * Analyzes:
 * 1. Question-level difficulty scoring and classification (Easy / Moderate / Difficult / Very Difficult)
 * 2. NEET Pattern Alignment (Below NEET / NEET Standard / Slightly Above / Significantly Above)
 * 3. Subject-wise distribution (Physics / Chemistry / Biology)
 * 4. Chapter distribution and concept repetition
 */

import { QuestionAuditCandidate } from "./duplicate-detector";

export interface QuestionDifficultyResult {
  questionId: string;
  difficulty: "EASY" | "MODERATE" | "DIFFICULT" | "VERY_DIFFICULT";
  difficultyScore: number; // 1.0 to 5.0
  reason: string;
  patternType: "DIRECT_MCQ" | "ASSERTION_REASON" | "MULTI_STATEMENT" | "MATCH_LIST" | "NUMERICAL";
}

export interface NeetAuditSummary {
  overallAlignment: "BELOW_NEET_LEVEL" | "NEET_STANDARD" | "SLIGHTLY_ABOVE_NEET" | "SIGNIFICANTLY_ABOVE_NEET";
  averageDifficulty: number;
  difficultyBreakdown: {
    easy: number;
    moderate: number;
    difficult: number;
    veryDifficult: number;
    easyPercent: number;
    moderatePercent: number;
    difficultPercent: number;
    veryDifficultPercent: number;
  };
  subjectDistribution: {
    physics: number;
    chemistry: number;
    biology: number;
    other: number;
  };
  chapterDistribution: Record<string, number>;
  patternBreakdown: Record<string, number>;
  alignmentNotes: string;
}

export function analyzeNeetPatternAndDifficulty(questions: QuestionAuditCandidate[]): {
  questionDifficulties: Map<string, QuestionDifficultyResult>;
  summary: NeetAuditSummary;
} {
  const questionDifficulties = new Map<string, QuestionDifficultyResult>();
  const chapterCounts: Record<string, number> = {};
  const patternCounts: Record<string, number> = {
    DIRECT_MCQ: 0,
    ASSERTION_REASON: 0,
    MULTI_STATEMENT: 0,
    MATCH_LIST: 0,
    NUMERICAL: 0,
  };

  const subjectCounts = {
    physics: 0,
    chemistry: 0,
    biology: 0,
    other: 0,
  };

  let totalScore = 0;
  let easyCount = 0;
  let modCount = 0;
  let diffCount = 0;
  let vDiffCount = 0;

  for (const q of questions) {
    const text = `${q.statementEn || ""} ${q.statementHi || ""}`;
    const normSubject = (q.subject || "").toLowerCase();
    const chapterName = q.chapter || "Uncategorized";
    chapterCounts[chapterName] = (chapterCounts[chapterName] || 0) + 1;

    // Categorize subject
    if (normSubject.includes("phys")) {
      subjectCounts.physics++;
    } else if (normSubject.includes("chem")) {
      subjectCounts.chemistry++;
    } else if (normSubject.includes("bio") || normSubject.includes("bot") || normSubject.includes("zoo")) {
      subjectCounts.biology++;
    } else {
      subjectCounts.other++;
    }

    // Detect NEET question pattern type
    let patternType: QuestionDifficultyResult["patternType"] = "DIRECT_MCQ";
    let patternWeight = 0;

    if (/\b(?:assertion|reason)\b/i.test(text)) {
      patternType = "ASSERTION_REASON";
      patternWeight = 0.6;
    } else if (/\b(?:statement\s*i|statement\s*1)\b/i.test(text) && /\b(?:statement\s*ii|statement\s*2)\b/i.test(text)) {
      patternType = "MULTI_STATEMENT";
      patternWeight = 0.7;
    } else if (/\b(?:match\s+list|list\s*i\b|column\s*i\b)/i.test(text)) {
      patternType = "MATCH_LIST";
      patternWeight = 0.5;
    } else if (/[0-9]+\s*(?:m\/s|kg|mol|volt|ampere|joule|watt|ohm|hz|nm|cm|kpa|atm)\b/i.test(text) || /\b(?:calculate|find\s+the\s+value|ratio\s+of)\b/i.test(text)) {
      patternType = "NUMERICAL";
      patternWeight = 0.8;
    }

    patternCounts[patternType] = (patternCounts[patternType] || 0) + 1;

    // Base score from configured difficulty
    let baseScore = 2.5; // default moderate
    const confDiff = (q.difficulty || "").toUpperCase();
    if (confDiff === "EASY") baseScore = 1.8;
    else if (confDiff === "DIFFICULT" || confDiff === "HARD") baseScore = 3.8;
    else if (confDiff === "VERY_DIFFICULT" || confDiff === "VERY_HARD") baseScore = 4.6;

    // Word count factor (longer stems with complex conditions increase cognitive load)
    const wordCount = text.split(/\s+/).length;
    const lengthFactor = wordCount > 80 ? 0.4 : wordCount > 40 ? 0.2 : 0;

    const finalScore = Math.min(5.0, Math.max(1.0, Math.round((baseScore + patternWeight + lengthFactor) * 10) / 10));
    totalScore += finalScore;

    let difficultyClass: QuestionDifficultyResult["difficulty"];
    let reasonText = "";

    if (finalScore <= 2.2) {
      difficultyClass = "EASY";
      easyCount++;
      reasonText = `Direct concept recall / factual question (${patternType.replace("_", " ")}).`;
    } else if (finalScore <= 3.5) {
      difficultyClass = "MODERATE";
      modCount++;
      reasonText = `Standard NEET difficulty with single/dual-step conceptual application (${patternType.replace("_", " ")}).`;
    } else if (finalScore <= 4.3) {
      difficultyClass = "DIFFICULT";
      diffCount++;
      reasonText = `Multi-step calculation or analytical reasoning test (${patternType.replace("_", " ")}).`;
    } else {
      difficultyClass = "VERY_DIFFICULT";
      vDiffCount++;
      reasonText = `High cognitive load question with combined concepts and multi-statement validation.`;
    }

    questionDifficulties.set(q.id, {
      questionId: q.id,
      difficulty: difficultyClass,
      difficultyScore: finalScore,
      reason: reasonText,
      patternType,
    });
  }

  const total = questions.length || 1;
  const avgDiff = Math.round((totalScore / total) * 10) / 10;
  const easyPct = Math.round((easyCount / total) * 100);
  const modPct = Math.round((modCount / total) * 100);
  const diffPct = Math.round((diffCount / total) * 100);
  const vDiffPct = Math.round((vDiffCount / total) * 100);

  // Overall NEET Alignment
  let overallAlignment: NeetAuditSummary["overallAlignment"] = "NEET_STANDARD";
  let alignmentNotes = "";

  if (total >= 150) {
    // Full mock test scenario
    const hasBalancedSubjects = subjectCounts.physics >= 35 && subjectCounts.chemistry >= 35 && subjectCounts.biology >= 70;
    if (!hasBalancedSubjects) {
      overallAlignment = "BELOW_NEET_LEVEL";
      alignmentNotes = `Subject distribution deviates from standard 180-Q NEET blueprint (Physics: ${subjectCounts.physics}, Chemistry: ${subjectCounts.chemistry}, Biology: ${subjectCounts.biology}).`;
    } else if (avgDiff < 2.3) {
      overallAlignment = "BELOW_NEET_LEVEL";
      alignmentNotes = `Test difficulty (${avgDiff}/5.0) is overly simplistic compared to standard NTA NEET requirements.`;
    } else if (avgDiff >= 2.3 && avgDiff <= 3.6) {
      overallAlignment = "NEET_STANDARD";
      alignmentNotes = `Test conforms well to NEET blueprint with balanced Easy (${easyPct}%), Moderate (${modPct}%) and Advanced (${diffPct + vDiffPct}%) questions.`;
    } else if (avgDiff > 3.6 && avgDiff <= 4.2) {
      overallAlignment = "SLIGHTLY_ABOVE_NEET";
      alignmentNotes = `Test is slightly harder than typical NEET standard (${diffPct + vDiffPct}% difficult/very difficult), suitable for rank-booster preparation.`;
    } else {
      overallAlignment = "SIGNIFICANTLY_ABOVE_NEET";
      alignmentNotes = `Test significantly exceeds standard NEET difficulty (${avgDiff}/5.0), approaching JEE Advanced calculation intensity.`;
    }
  } else {
    // DPP / Chapter Test
    if (avgDiff < 2.2) {
      overallAlignment = "BELOW_NEET_LEVEL";
      alignmentNotes = `Chapter practice test is primarily basic recall questions (${avgDiff}/5.0).`;
    } else if (avgDiff <= 3.6) {
      overallAlignment = "NEET_STANDARD";
      alignmentNotes = `Chapter test well-calibrated for NEET chapter mastery (${avgDiff}/5.0).`;
    } else {
      overallAlignment = "SLIGHTLY_ABOVE_NEET";
      alignmentNotes = `Challenging chapter test with high proportion of multi-concept questions.`;
    }
  }

  return {
    questionDifficulties,
    summary: {
      overallAlignment,
      averageDifficulty: avgDiff,
      difficultyBreakdown: {
        easy: easyCount,
        moderate: modCount,
        difficult: diffCount,
        veryDifficult: vDiffCount,
        easyPercent: easyPct,
        moderatePercent: modPct,
        difficultPercent: diffPct,
        veryDifficultPercent: vDiffPct,
      },
      subjectDistribution: subjectCounts,
      chapterDistribution: chapterCounts,
      patternBreakdown: patternCounts,
      alignmentNotes,
    },
  };
}
