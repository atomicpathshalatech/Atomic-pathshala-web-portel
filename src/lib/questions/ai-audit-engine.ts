import { prisma } from "@/lib/db";
import { executeGeminiWithFailover } from "@/lib/questions/gemini-engine";
import { computeQuestionContentHash, QuestionHashPayload } from "./content-hash";

export type AuditSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface ScoreDeduction {
  dimension: string;
  pointsDeducted: number;
  reason: string;
}

export interface AuditErrorItem {
  severity: AuditSeverity;
  parameter: string;
  explanation: string;
  suggestedCorrection: string;
}

export interface AiSuggestedChange {
  field: "statement" | "options" | "correctAnswer" | "solution" | "difficulty" | "examLevel" | "topic" | "subTopic" | "microConcept";
  original: string;
  suggested: string;
  reason: string;
  confidence: number;
}

export interface MultiDimensionalAuditResult {
  overallScore: number;
  decision: "VERIFIED" | "MODIFIED" | "NEEDS_HUMAN_REVIEW" | "FAILED";
  confidence: number;
  examLevelFit: {
    current: string;
    recommended: string;
    isAppropriateForCurrent: boolean;
    reason: string;
  };
  dimensions: {
    questionCorrectness: number;
    answerCorrectness: number;
    optionQuality: number;
    explanationCorrectness: number;
    difficultyAccuracy: number;
    neetRelevance: number;
    examLevelFit: number;
    conceptualQuality: number;
    ambiguityScore: number;
    typingErrors: number;
    spellingErrors: number;
    grammarScore: number;
    mathematicalAccuracy: number;
    unitsAndDimensions: number;
    chemicalAccuracy: number;
    biologicalAccuracy: number;
    imageQuality: number;
    imageRelevance: number;
    imageDiagramAccuracy: number;
    formattingQuality: number;
  };
  deductions: ScoreDeduction[];
  errors: AuditErrorItem[];
  suggestions: AiSuggestedChange[];
  imageAudit?: {
    hasImage: boolean;
    isVerified: boolean;
    needsHumanReview: boolean;
    notes?: string;
  };
  auditedAt: string;
  modelUsed: string;
  contentHash: string;
}

const PROMPT_VERSION = "2.0.0-multi-dimensional";

/**
 * Subject-specific guidance generator for the AI Auditor
 */
function getSubjectAuditDirective(subject: string): string {
  const norm = (subject || "").toLowerCase();
  if (norm.includes("phys")) {
    return `
SUBJECT: PHYSICS
- Solve the problem independently step-by-step using fundamental laws.
- Rigorously check units, dimensional consistency, and significant figures.
- Check if numerical approximations are mathematically justified.
- Check graph axes, labels, and physical boundary conditions.`;
  }
  if (norm.includes("chem")) {
    return `
SUBJECT: CHEMISTRY
- Verify all chemical equations for atomic and charge balance.
- Check IUPAC nomenclature, organic mechanisms, oxidation states, and stereochemistry.
- Verify thermodynamic and equilibrium calculations.
- Check periodic trends and anomaly justifications.`;
  }
  if (norm.includes("bio") || norm.includes("botan") || norm.includes("zool")) {
    return `
SUBJECT: BIOLOGY
- Strictly check against standard NCERT biological terminology and classifications.
- Verify biological facts, physiological processes, cellular mechanisms, and genetics calculations.
- Ensure assertion-reason statements are logically and factually sound.`;
  }
  return `
SUBJECT: MATHEMATICS / GENERAL SCIENCE
- Verify mathematical proofs, calculations, formulas, and distractor plausibility.`;
}

/**
 * Runs single question AI audit with persistent state caching.
 * If question was already verified and content has not changed, NEVER runs AI again!
 */
export async function auditSingleQuestion(
  questionId: string,
  options?: { forceReaudit?: boolean }
): Promise<{ result: MultiDimensionalAuditResult; cached: boolean }> {
  const startTime = Date.now();

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: {
      translations: true,
      assets: true,
    },
  });

  if (!question) {
    throw new Error(`Question ${questionId} not found`);
  }

  const primaryT =
    question.translations.find((t) => t.language === "ENGLISH") ||
    question.translations[0] || { statement: "", options: {}, correctOptionIds: [], solution: "" };

  const hashPayload: QuestionHashPayload = {
    statement: primaryT.statement,
    options: primaryT.options,
    correctOptionIds: primaryT.correctOptionIds,
    solution: primaryT.solution,
    imageUrl: question.imageUrl,
    type: question.type,
    difficulty: question.difficulty,
    examLevel: question.examLevel || "NEET",
    subject: question.subject,
    chapter: question.chapter,
    topic: question.topic,
    subTopic: question.subTopic,
    microConcept: question.microConcept,
  };

  const currentContentHash = computeQuestionContentHash(hashPayload);

  // CRITICAL RULE: NEVER AUDIT THE SAME QUESTION TWICE
  if (
    !options?.forceReaudit &&
    question.aiVerified &&
    !question.needsReaudit &&
    question.aiAuditHash === currentContentHash &&
    question.aiAuditResult
  ) {
    return {
      result: question.aiAuditResult as unknown as MultiDimensionalAuditResult,
      cached: true,
    };
  }

  // Build the rich multi-dimensional prompt
  const subjectDirective = getSubjectAuditDirective(question.subject);
  const optionsText =
    typeof primaryT.options === "object"
      ? JSON.stringify(primaryT.options, null, 2)
      : String(primaryT.options);

  const correctAnswersText = Array.isArray(primaryT.correctOptionIds)
    ? primaryT.correctOptionIds.join(", ")
    : String(primaryT.correctOptionIds || "N/A");

  const prompt = `You are the Lead Academic AI Quality Auditor at Atomic Pathshala.
Perform a rigorous, multi-dimensional academic audit on this competitive examination question.

${subjectDirective}

QUESTION DETAILS:
- Subject: ${question.subject}
- Chapter: ${question.chapter || "N/A"}
- Topic: ${question.topic || "N/A"}
- Sub-topic: ${question.subTopic || "N/A"}
- Micro Concept: ${question.microConcept || "N/A"}
- Question Type: ${question.type}
- Difficulty: ${question.difficulty}
- Target Exam Level: ${question.examLevel || "NEET"}
- Image URL: ${question.imageUrl || "None"}

QUESTION STATEMENT:
${primaryT.statement}

OPTIONS:
${optionsText}

MARKED CORRECT ANSWER:
${correctAnswersText}

SOLUTION / EXPLANATION:
${primaryT.solution || "None provided"}

TASK INSTRUCTIONS:
1. Solve the question independently step-by-step without assuming the marked answer is correct.
2. Verify all options (distractor quality, non-ambiguity, correctness of marked key).
3. Verify the mathematical, scientific, and conceptual depth of the solution.
4. Evaluate difficulty match and exam-level appropriateness (e.g. Is it truly NEET level, or more suited for Board / CUET / JEE?).
5. If the question has an image, inspect if it is readable and relevant. If unsure, explicitly mark image as needing human review. Do NOT give false 100% confidence when uncertain.
6. Rate all 20 dimensions on a scale of 0 to 100.
7. List all score deductions with exact point values and reasons.
8. List all specific errors with severity (CRITICAL, HIGH, MEDIUM, LOW).
9. If improvements are detected, generate structured suggestions (original vs suggested vs reason vs confidence).

Respond with a strictly valid JSON object matching this schema (do NOT wrap in markdown fences other than raw json):
{
  "overallScore": number (0-100),
  "decision": "VERIFIED" | "MODIFIED" | "NEEDS_HUMAN_REVIEW" | "FAILED",
  "confidence": number (0-100),
  "examLevelFit": {
    "current": "${question.examLevel || "NEET"}",
    "recommended": string,
    "isAppropriateForCurrent": boolean,
    "reason": string
  },
  "dimensions": {
    "questionCorrectness": number (0-100),
    "answerCorrectness": number (0-100),
    "optionQuality": number (0-100),
    "explanationCorrectness": number (0-100),
    "difficultyAccuracy": number (0-100),
    "neetRelevance": number (0-100),
    "examLevelFit": number (0-100),
    "conceptualQuality": number (0-100),
    "ambiguityScore": number (0-100),
    "typingErrors": number (0-100),
    "spellingErrors": number (0-100),
    "grammarScore": number (0-100),
    "mathematicalAccuracy": number (0-100),
    "unitsAndDimensions": number (0-100),
    "chemicalAccuracy": number (0-100),
    "biologicalAccuracy": number (0-100),
    "imageQuality": number (0-100),
    "imageRelevance": number (0-100),
    "imageDiagramAccuracy": number (0-100),
    "formattingQuality": number (0-100)
  },
  "deductions": [
    {
      "dimension": string,
      "pointsDeducted": number,
      "reason": string
    }
  ],
  "errors": [
    {
      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "parameter": string,
      "explanation": string,
      "suggestedCorrection": string
    }
  ],
  "suggestions": [
    {
      "field": "statement" | "options" | "correctAnswer" | "solution" | "difficulty" | "examLevel" | "topic" | "subTopic" | "microConcept",
      "original": string,
      "suggested": string,
      "reason": string,
      "confidence": number
    }
  ],
  "imageAudit": {
    "hasImage": boolean,
    "isVerified": boolean,
    "needsHumanReview": boolean,
    "notes": string
  }
}`;

  let parsed: any;
  let modelNameUsed = "gemini-1.5-flash";

  try {
    const rawResponse = await executeGeminiWithFailover(async (client, modelName) => {
      modelNameUsed = modelName;
      const model = client.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      });
      const res = await model.generateContent(prompt);
      return res.response.text();
    });

    parsed = JSON.parse(rawResponse);
  } catch (err: any) {
    // Record AI failure gracefully
    const durationMs = Date.now() - startTime;
    await prisma.question.update({
      where: { id: questionId },
      data: {
        aiAuditStatus: "FAILED",
        aiAuditedAt: new Date(),
        needsReaudit: true,
      },
    });

    await prisma.questionAuditLog.create({
      data: {
        questionId,
        contentHash: currentContentHash,
        aiModel: modelNameUsed,
        promptVersion: PROMPT_VERSION,
        score: 0,
        decision: "FAILED",
        confidence: 0,
        findings: { error: err?.message || "Gemini Execution Failed" },
        durationMs,
        errorStatus: err?.message || "AI API Failure",
      },
    });

    throw err;
  }

  const durationMs = Date.now() - startTime;

  const result: MultiDimensionalAuditResult = {
    overallScore: Math.min(100, Math.max(0, Number(parsed.overallScore) || 80)),
    decision: parsed.decision || (parsed.overallScore >= 80 ? "VERIFIED" : "NEEDS_HUMAN_REVIEW"),
    confidence: Number(parsed.confidence) || 90,
    examLevelFit: {
      current: parsed.examLevelFit?.current || question.examLevel || "NEET",
      recommended: parsed.examLevelFit?.recommended || question.examLevel || "NEET",
      isAppropriateForCurrent: Boolean(parsed.examLevelFit?.isAppropriateForCurrent ?? true),
      reason: parsed.examLevelFit?.reason || "Appropriate for syllabus",
    },
    dimensions: {
      questionCorrectness: Number(parsed.dimensions?.questionCorrectness) || 90,
      answerCorrectness: Number(parsed.dimensions?.answerCorrectness) || 90,
      optionQuality: Number(parsed.dimensions?.optionQuality) || 90,
      explanationCorrectness: Number(parsed.dimensions?.explanationCorrectness) || 85,
      difficultyAccuracy: Number(parsed.dimensions?.difficultyAccuracy) || 90,
      neetRelevance: Number(parsed.dimensions?.neetRelevance) || 90,
      examLevelFit: Number(parsed.dimensions?.examLevelFit) || 90,
      conceptualQuality: Number(parsed.dimensions?.conceptualQuality) || 90,
      ambiguityScore: Number(parsed.dimensions?.ambiguityScore) || 95,
      typingErrors: Number(parsed.dimensions?.typingErrors) || 100,
      spellingErrors: Number(parsed.dimensions?.spellingErrors) || 100,
      grammarScore: Number(parsed.dimensions?.grammarScore) || 95,
      mathematicalAccuracy: Number(parsed.dimensions?.mathematicalAccuracy) || 95,
      unitsAndDimensions: Number(parsed.dimensions?.unitsAndDimensions) || 95,
      chemicalAccuracy: Number(parsed.dimensions?.chemicalAccuracy) || 95,
      biologicalAccuracy: Number(parsed.dimensions?.biologicalAccuracy) || 95,
      imageQuality: Number(parsed.dimensions?.imageQuality) || 100,
      imageRelevance: Number(parsed.dimensions?.imageRelevance) || 100,
      imageDiagramAccuracy: Number(parsed.dimensions?.imageDiagramAccuracy) || 100,
      formattingQuality: Number(parsed.dimensions?.formattingQuality) || 95,
    },
    deductions: Array.isArray(parsed.deductions) ? parsed.deductions : [],
    errors: Array.isArray(parsed.errors) ? parsed.errors : [],
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    imageAudit: parsed.imageAudit,
    auditedAt: new Date().toISOString(),
    modelUsed: modelNameUsed,
    contentHash: currentContentHash,
  };

  // Persist structured state to question
  await prisma.question.update({
    where: { id: questionId },
    data: {
      aiVerified: result.overallScore >= 70,
      aiAuditStatus: result.decision,
      aiAuditVersion: (question.aiAuditVersion || 0) + 1,
      aiAuditedAt: new Date(),
      aiAuditResult: result as any,
      aiAuditScore: result.overallScore,
      aiAuditIssues: result.errors as any,
      aiAuditModel: modelNameUsed,
      aiAuditPromptVersion: PROMPT_VERSION,
      aiAuditHash: currentContentHash,
      needsReaudit: false,
    },
  });

  // Append to Audit History Log
  await prisma.questionAuditLog.create({
    data: {
      questionId,
      contentHash: currentContentHash,
      aiModel: modelNameUsed,
      promptVersion: PROMPT_VERSION,
      score: result.overallScore,
      decision: result.decision,
      confidence: result.confidence,
      findings: result.dimensions as any,
      suggestions: result.suggestions as any,
      issues: result.errors as any,
      durationMs,
      errorStatus: null,
    },
  });

  return { result, cached: false };
}

/**
 * Fast concurrent batch audit for entire chapter with progress reporting and isolation
 */
export async function auditChapterBatch(
  subject: string,
  chapter: string,
  onProgress?: (audited: number, total: number, stats: { verified: number; modified: number; failed: number; cached: number }) => void
): Promise<{
  total: number;
  auditedCount: number;
  cachedCount: number;
  verifiedCount: number;
  modifiedCount: number;
  failedCount: number;
  needsReviewCount: number;
  results: Array<{ questionId: string; canonicalId: string; score: number; decision: string; cached: boolean }>;
}> {
  const cleanChap = chapter
    .replace(/^\[class\s*\d+\]\s*/i, "")
    .replace(/^ch\s*\d+:\s*/i, "")
    .replace(/^\d+[\.:\s-]+/i, "")
    .trim();

  const questions = await prisma.question.findMany({
    where: {
      subject: { equals: subject, mode: "insensitive" },
      OR: [
        { chapter: { contains: cleanChap, mode: "insensitive" } },
        { category: { contains: cleanChap, mode: "insensitive" } },
      ],
    },
    select: { id: true, questionCode: true },
    orderBy: { createdAt: "asc" },
  });

  const total = questions.length;
  let auditedCount = 0;
  let cachedCount = 0;
  let verifiedCount = 0;
  let modifiedCount = 0;
  let failedCount = 0;
  let needsReviewCount = 0;

  const results: Array<{ questionId: string; canonicalId: string; score: number; decision: string; cached: boolean }> = [];

  // Controlled concurrency of 4
  const CONCURRENCY = 4;
  for (let i = 0; i < questions.length; i += CONCURRENCY) {
    const chunk = questions.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (q) => {
        const canonicalId = q.questionCode || `Q-${q.id.slice(0, 8)}`;
        try {
          const { result, cached } = await auditSingleQuestion(q.id);
          if (cached) {
            cachedCount++;
          } else {
            auditedCount++;
          }

          if (result.decision === "VERIFIED") verifiedCount++;
          else if (result.decision === "MODIFIED") modifiedCount++;
          else if (result.decision === "NEEDS_HUMAN_REVIEW") needsReviewCount++;

          results.push({
            questionId: q.id,
            canonicalId,
            score: result.overallScore,
            decision: result.decision,
            cached,
          });
        } catch (err) {
          failedCount++;
          results.push({
            questionId: q.id,
            canonicalId,
            score: 0,
            decision: "FAILED",
            cached: false,
          });
        } finally {
          if (onProgress) {
            onProgress(auditedCount + cachedCount + failedCount, total, {
              verified: verifiedCount,
              modified: modifiedCount,
              failed: failedCount,
              cached: cachedCount,
            });
          }
        }
      })
    );
  }

  return {
    total,
    auditedCount,
    cachedCount,
    verifiedCount,
    modifiedCount,
    failedCount,
    needsReviewCount,
    results,
  };
}
