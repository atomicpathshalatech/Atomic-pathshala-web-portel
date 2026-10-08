// src/question-similarity/similarity-engine.ts
import { QuestionInputForDetection, SimilarityMatch, SimilarityReport, SimilarityLevel } from "./types";
import { TextNormalizer } from "./text-normalizer";
import { DiffHighlighter } from "./diff-highlighter";

export interface CachedQuestionFingerprint {
  id: string;
  questionCode: string;
  statementEn: string;
  statementHi?: string | null;
  subject: string;
  chapter?: string | null;
  topic?: string | null;
  optionsEn?: Record<string, string> | null;
  optionsHi?: Record<string, string> | null;
  correctAnswer?: string[];
  solutionEn?: string | null;
  exactHash: string;
  conceptCleaned: string;
  structuralTemplate: string;
  shingles: Set<string>;
  numbers: number[];
}

export class QuestionSimilarityEngine {
  private static questionIndex: Map<string, CachedQuestionFingerprint> = new Map();
  private static isInitialized = false;

  /**
   * Initializes / seeds standard test questions into the fingerprint cache
   */
  public static init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Seed mock/reference repository questions for high-speed matching
    this.indexQuestion({
      id: "q_1001",
      questionCode: "C2600012456",
      statementEn: "A body of mass 5 kg moves with an acceleration of 2 m/s^2. What is the net force acting on the body?",
      subject: "Physics",
      chapter: "Laws of Motion",
      topic: "Newton Second Law",
      optionsEn: { A: "10 N", B: "20 N", C: "2.5 N", D: "0.4 N" },
      correctAnswer: ["A"],
      solutionEn: "Using Newton's second law F = m * a = 5 * 2 = 10 N.",
    });

    this.indexQuestion({
      id: "q_1002",
      questionCode: "C2600012890",
      statementEn: "Which of the following statements is correct regarding the structure of benzene?",
      subject: "Chemistry",
      chapter: "Organic Chemistry",
      topic: "Aromatic Hydrocarbons",
      optionsEn: {
        A: "All carbon-carbon bond lengths in benzene are equal",
        B: "Benzene has localized alternating single and double bonds",
        C: "Benzene is non-planar",
        D: "Benzene easily undergoes addition reactions",
      },
      correctAnswer: ["A"],
      solutionEn: "Due to resonance, all C-C bonds in benzene are equivalent and of intermediate length (1.39 A).",
    });

    this.indexQuestion({
      id: "q_1003",
      questionCode: "C2600013500",
      statementEn: "In a Young's double slit experiment, if the distance between the slits is halved and distance between slit and screen is doubled, what will happen to fringe width?",
      subject: "Physics",
      chapter: "Wave Optics",
      topic: "Interference",
      optionsEn: { A: "Becomes four times", B: "Remains unchanged", C: "Becomes halved", D: "Becomes double" },
      correctAnswer: ["A"],
      solutionEn: "Fringe width beta = (lambda * D) / d. If d' = d/2 and D' = 2D, beta' = (lambda * 2D) / (d/2) = 4 * beta.",
    });
  }

  /**
   * Adds or updates a question in the in-memory fingerprint index
   */
  public static indexQuestion(q: {
    id: string;
    questionCode: string;
    statementEn: string;
    statementHi?: string | null;
    subject: string;
    chapter?: string | null;
    topic?: string | null;
    optionsEn?: Record<string, string> | null;
    optionsHi?: Record<string, string> | null;
    correctAnswer?: string[];
    solutionEn?: string | null;
  }): void {
    const exactHash = TextNormalizer.hash(q.statementEn);
    const conceptCleaned = TextNormalizer.stripBoilerplate(q.statementEn);
    const structuralTemplate = TextNormalizer.extractStructuralTemplate(q.statementEn);
    const shingles = TextNormalizer.getShingles(conceptCleaned, 2);
    const numbers = TextNormalizer.extractNumbers(q.statementEn);

    this.questionIndex.set(q.id, {
      ...q,
      exactHash,
      conceptCleaned,
      structuralTemplate,
      shingles,
      numbers,
    });
  }

  /**
   * Computes multi-dimensional similarity for an input question against the repository
   */
  public static async analyze(input: QuestionInputForDetection): Promise<SimilarityReport> {
    this.init();
    const startTime = Date.now();

    const statementEn = input.statementEn?.trim() || "";
    const statementHi = input.statementHi?.trim() || "";

    if (!statementEn && !statementHi) {
      return {
        overallScore: 0,
        classification: "LOW_SIMILARITY",
        duplicateDetected: false,
        isExactDuplicate: false,
        highestMatch: null,
        totalMatchesFound: 0,
        matches: [],
        analysisTimeMs: Date.now() - startTime,
      };
    }

    const inputExactHash = TextNormalizer.hash(statementEn);
    const inputConceptCleaned = TextNormalizer.stripBoilerplate(statementEn);
    const inputStructuralTemplate = TextNormalizer.extractStructuralTemplate(statementEn);
    const inputShingles = TextNormalizer.getShingles(inputConceptCleaned, 2);
    const inputNumbers = TextNormalizer.extractNumbers(statementEn);

    const matches: SimilarityMatch[] = [];

    // Scan indexed candidates
    for (const [candidateId, candidate] of this.questionIndex.entries()) {
      if (input.excludeQuestionId && candidateId === input.excludeQuestionId) {
        continue;
      }
      if (input.id && candidateId === input.id) {
        continue;
      }

      // 1. Exact Duplicate Calculation
      let exactDuplicatePct = 0;
      if (inputExactHash === candidate.exactHash) {
        exactDuplicatePct = 100;
      } else {
        const exactJaccard = this.computeSetOverlap(
          new Set(TextNormalizer.clean(statementEn).split(/\s+/)),
          new Set(TextNormalizer.clean(candidate.statementEn).split(/\s+/))
        );
        exactDuplicatePct = exactJaccard;
      }

      // 2. Content / Concept Similarity Calculation (Boilerplate Stripped)
      let conceptOverlap = this.computeSetOverlap(inputShingles, candidate.shingles);
      if (inputConceptCleaned && candidate.conceptCleaned && inputConceptCleaned === candidate.conceptCleaned) {
        conceptOverlap = 100;
      }

      let contentSimilarityPct = conceptOverlap;

      // Option Comparison boost
      let optionOverlap = 0;
      if (input.optionsEn && candidate.optionsEn) {
        const optValuesInput = Object.values(input.optionsEn).map((o) => TextNormalizer.clean(o)).join(" ");
        const optValuesCand = Object.values(candidate.optionsEn).map((o) => TextNormalizer.clean(o)).join(" ");
        const optShinglesInput = TextNormalizer.getShingles(optValuesInput, 1);
        const optShinglesCand = TextNormalizer.getShingles(optValuesCand, 1);
        optionOverlap = this.computeSetOverlap(optShinglesInput, optShinglesCand);

        if (optionOverlap > 60) {
          contentSimilarityPct = Math.round(contentSimilarityPct * 0.6 + optionOverlap * 0.4);
        }
      }

      // 3. Structural / Formula / Numerical Pattern Similarity
      let structuralSimilarityPct = 0;
      if (inputStructuralTemplate === candidate.structuralTemplate && inputStructuralTemplate.length > 20) {
        structuralSimilarityPct = 98;
      } else {
        const structShinglesInput = TextNormalizer.getShingles(inputStructuralTemplate, 2);
        const structShinglesCand = TextNormalizer.getShingles(candidate.structuralTemplate, 2);
        structuralSimilarityPct = this.computeSetOverlap(structShinglesInput, structShinglesCand);
      }

      // Check number match
      const numbersMatch = this.compareNumbers(inputNumbers, candidate.numbers);
      if (numbersMatch && structuralSimilarityPct > 65) {
        structuralSimilarityPct = Math.min(100, structuralSimilarityPct + 15);
      }

      // 4. Overall Weighted Score Calculation
      let overallSimilarityPct = 0;
      if (exactDuplicatePct >= 98) {
        overallSimilarityPct = 100;
      } else if (conceptOverlap >= 90) {
        // High concept equivalence even if boilerplate wording differed
        overallSimilarityPct = Math.round(conceptOverlap * 0.7 + (optionOverlap || structuralSimilarityPct) * 0.3);
      } else {
        overallSimilarityPct = Math.round(
          contentSimilarityPct * 0.50 +
          structuralSimilarityPct * 0.30 +
          exactDuplicatePct * 0.20
        );
      }

      // Clamp between 0 and 100
      overallSimilarityPct = Math.min(100, Math.max(0, overallSimilarityPct));

      // Collect match if score >= 20%
      if (overallSimilarityPct >= 20) {
        const classification = this.classifyScore(overallSimilarityPct);
        const highlightedDiff = DiffHighlighter.generateHighlightedDiff(candidate.statementEn, statementEn);

        matches.push({
          questionId: candidate.id,
          questionCode: candidate.questionCode,
          statementEn: candidate.statementEn,
          statementHi: candidate.statementHi,
          subject: candidate.subject,
          chapter: candidate.chapter,
          topic: candidate.topic,
          optionsEn: candidate.optionsEn,
          optionsHi: candidate.optionsHi,
          correctAnswer: candidate.correctAnswer,
          solutionEn: candidate.solutionEn,
          exactDuplicatePct,
          contentSimilarityPct,
          structuralSimilarityPct,
          overallSimilarityPct,
          classification,
          highlightedDiff,
        });
      }
    }

    // Sort descending by overall similarity
    matches.sort((a, b) => b.overallSimilarityPct - a.overallSimilarityPct);

    const highestMatch = matches[0] || null;
    const overallScore = highestMatch ? highestMatch.overallSimilarityPct : 0;
    const classification = this.classifyScore(overallScore);

    return {
      overallScore,
      classification,
      duplicateDetected: overallScore >= 70,
      isExactDuplicate: overallScore >= 90,
      highestMatch,
      totalMatchesFound: matches.length,
      matches: matches.slice(0, 10),
      analysisTimeMs: Date.now() - startTime,
    };
  }

  public static classifyScore(score: number): SimilarityLevel {
    if (score >= 90) return "EXACT_OR_NEAR_DUPLICATE";
    if (score >= 70) return "HIGHLY_SIMILAR";
    if (score >= 30) return "SIMILAR";
    return "LOW_SIMILARITY";
  }

  private static computeSetOverlap(setA: Set<string>, setB: Set<string>): number {
    if (setA.size === 0 || setB.size === 0) return 0;
    let intersection = 0;
    setA.forEach((item) => {
      if (setB.has(item)) intersection++;
    });
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : Math.round((intersection / union) * 100);
  }

  private static compareNumbers(numsA: number[], numsB: number[]): boolean {
    if (numsA.length === 0 && numsB.length === 0) return true;
    if (numsA.length !== numsB.length) return false;
    for (let i = 0; i < numsA.length; i++) {
      if (numsA[i] !== numsB[i]) return false;
    }
    return true;
  }
}
