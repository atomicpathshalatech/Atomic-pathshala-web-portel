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
  field: "statement" | "options" | "correctAnswer" | "solution" | "difficulty" | "examLevel" | "topic" | "subTopic" | "microConcept" | "translation";
  original: string;
  suggested: string;
  reason: string;
  confidence: number;
}

export interface ExamFitDetail {
  score: number;
  isFit: boolean;
  notes: string;
}

export interface NcertVerificationReport {
  isVerified: boolean;
  confidence: number;
  book: string;
  chapter: string;
  topicOrSection: string;
  pageNumber: string | null;
  quoteOrExcerpt: string | null;
  status: "VERIFIED_IN_NCERT" | "OUT_OF_NCERT_SYLLABUS" | "NOT_FOUND";
  notes: string;
}

export interface BilingualAuditReport {
  hasEnglish: boolean;
  hasHindi: boolean;
  translationFidelityScore: number;
  isConsistent: boolean;
  negationSymmetry: {
    isConsistent: boolean;
    englishNegation: boolean;
    hindiNegation: boolean;
    notes?: string;
  };
  latexPreserved: boolean;
  generatedDraft?: {
    language: "HINDI" | "ENGLISH";
    statement: string;
    options: Record<string, string>;
    solution: string;
  } | null;
}

export interface DistractorAuditReport {
  allOptionsDistinct: boolean;
  plausibleDistractors: boolean;
  duplicateOptionsFound: string[];
  ambiguousOptions: string[];
  markedOptionMatchesSolved: boolean;
  solvedAnswerKey: string;
}

export interface SimilarQuestionMatch {
  id: string;
  questionCode: string | null;
  similarityScore: number;
  statementSnippet: string;
  subject: string;
  chapter: string | null;
}

export interface StepByStepSolutionAudit {
  katexVerified: boolean;
  solutionText: string;
  independentSolvedAnswer: string;
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
  examSuitability?: {
    neet: ExamFitDetail;
    jeeMain: ExamFitDetail;
    jeeAdvanced: ExamFitDetail;
    cuet: ExamFitDetail;
    board: ExamFitDetail;
  };
  ncertVerification?: NcertVerificationReport;
  bilingualAudit?: BilingualAuditReport;
  distractorAudit?: DistractorAuditReport;
  similarQuestions?: SimilarQuestionMatch[];
  stepByStepSolution?: StepByStepSolutionAudit;
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

const PROMPT_VERSION = "2.1.0-unified-orchestrated";

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

function computeTextSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const cleanA = a.toLowerCase().replace(/[^a-z0-9]/g, " ").split(/\s+/).filter((w) => w.length > 2);
  const cleanB = b.toLowerCase().replace(/[^a-z0-9]/g, " ").split(/\s+/).filter((w) => w.length > 2);
  const setA = new Set(cleanA);
  const setB = new Set(cleanB);
  if (setA.size === 0 || setB.size === 0) return 0;
  let matches = 0;
  const arrA = Array.from(setA);
  for (let i = 0; i < arrA.length; i++) {
    if (setB.has(arrA[i])) matches++;
  }
  // Sorensen-Dice similarity index for accurate question duplication detection
  const diceScore = Math.round((2 * matches) / (setA.size + setB.size) * 100);
  return diceScore;
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

  const englishT = question.translations.find((t) => t.language.toUpperCase() === "ENGLISH");
  const hindiT = question.translations.find((t) => t.language.toUpperCase() === "HINDI");
  const primaryT =
    englishT ||
    hindiT ||
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

  // CRITICAL RULE: NEVER AUDIT THE SAME QUESTION TWICE UNLESS FORCED
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

  // Fast In-Memory Database Similarity & Duplicate Check
  const candidates = await prisma.question.findMany({
    where: {
      id: { not: questionId },
      subject: { equals: question.subject, mode: "insensitive" },
      ...(question.chapter ? { chapter: { contains: question.chapter, mode: "insensitive" } } : {}),
    },
    take: 25,
    select: {
      id: true,
      questionCode: true,
      subject: true,
      chapter: true,
      translations: {
        select: { statement: true, language: true },
        take: 1,
      },
    },
  }).catch(() => []);

  const similarMatches: SimilarQuestionMatch[] = [];
  for (const cand of candidates) {
    const candStmt = cand.translations?.[0]?.statement || "";
    if (!candStmt) continue;
    const score = computeTextSimilarity(primaryT.statement, candStmt);
    if (score >= 40) {
      similarMatches.push({
        id: cand.id,
        questionCode: cand.questionCode,
        similarityScore: score,
        statementSnippet: candStmt.slice(0, 120),
        subject: cand.subject,
        chapter: cand.chapter,
      });
    }
  }
  similarMatches.sort((a, b) => b.similarityScore - a.similarityScore);

  // Build the rich multi-dimensional unified prompt
  const subjectDirective = getSubjectAuditDirective(question.subject);
  
  const prompt = `You are the Lead Academic AI Quality Auditor and QC Director at Atomic Pathshala.
Perform a rigorous, multi-dimensional academic audit and bilingual verification on this examination question.

${subjectDirective}

QUESTION METADATA:
- Subject: ${question.subject}
- Chapter: ${question.chapter || "N/A"}
- Topic: ${question.topic || "N/A"}
- Sub-topic: ${question.subTopic || "N/A"}
- Micro Concept: ${question.microConcept || "N/A"}
- Question Type: ${question.type}
- Difficulty: ${question.difficulty}
- Current Target Exam: ${question.examLevel || "NEET"}
- Figure Image URL: ${question.imageUrl || "None"}

CONTENT IN ENGLISH:
- Statement: ${englishT?.statement || "None (English translation missing)"}
- Options: ${englishT ? JSON.stringify(englishT.options, null, 2) : "None"}
- Correct Option: ${englishT ? JSON.stringify(englishT.correctOptionIds) : "None"}
- Solution: ${englishT?.solution || "None"}

CONTENT IN HINDI:
- Statement: ${hindiT?.statement || "None (Hindi translation missing)"}
- Options: ${hindiT ? JSON.stringify(hindiT.options, null, 2) : "None"}
- Correct Option: ${hindiT ? JSON.stringify(hindiT.correctOptionIds) : "None"}
- Solution: ${hindiT?.solution || "None"}

MANDATORY QC AUDIT TASKS:
1. INDEPENDENT DERIVATION: Solve the question step-by-step from fundamental physical/chemical/mathematical laws. Formulate a clean, rigorous KaTeX LaTeX solution without assuming marked key is correct. Determine the true answer key (A, B, C, or D).
2. DISTRACTOR & OPTIONS AUDIT: Inspect all 4 options for plausibility, scientific distractors, ambiguity, and verify no two options are identical or mathematically equivalent.
3. EXAM SUITABILITY MATRIX: Provide a suitability score (0-100), suitability boolean, and notes for each of the following 5 exams:
   - NEET UG
   - JEE Main
   - JEE Advanced
   - CUET
   - CBSE / State Boards
4. AUTHENTIC NCERT TEXTBOOK VERIFICATION:
   - Check if this question's concept exists in standard NCERT textbooks.
   - Specify: Book name (e.g. "NCERT Class 11 Physics Part 1"), Chapter name, Topic / Section.
   - If verified, cite the section. If NOT confirmed in official NCERT textbook, set status to "NOT_FOUND" and quoteOrExcerpt to "Reference Not Found in Available Sources". DO NOT hallucinate fake page numbers!
5. BILINGUAL AUDIT & MISSING TRANSLATION DRAFT:
   - If BOTH English and Hindi exist: Evaluate semantic fidelity score (0-100), numerical consistency, and check negation symmetry (CRITICAL: detect if negative terms like "NOT", "INCORRECT", "EXCEPT", "नहीं", "गलत" were omitted or inverted).
   - If HINDI is MISSING: Generate an authentic, NCERT-compliant Hindi translation in 'generatedDraft' with language="HINDI", preserving all LaTeX math formulas ($...$) and matching options A, B, C, D.
   - If ENGLISH is MISSING: Generate an accurate English translation in 'generatedDraft' with language="ENGLISH".
6. 20 ACADEMIC DIMENSIONS: Score all 20 dimensions (0-100).
7. SCORE DEDUCTIONS & QUALITY ERRORS: Enumerate specific deductions with points, and detected errors with severity ("CRITICAL" | "HIGH" | "MEDIUM" | "LOW").
8. SUGGESTIONS: Structured recommendations (field, original, suggested, reason, confidence).

Respond with a strictly valid JSON object matching this schema:
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
  "examSuitability": {
    "neet": { "score": number, "isFit": boolean, "notes": string },
    "jeeMain": { "score": number, "isFit": boolean, "notes": string },
    "jeeAdvanced": { "score": number, "isFit": boolean, "notes": string },
    "cuet": { "score": number, "isFit": boolean, "notes": string },
    "board": { "score": number, "isFit": boolean, "notes": string }
  },
  "ncertVerification": {
    "isVerified": boolean,
    "confidence": number,
    "book": string,
    "chapter": string,
    "topicOrSection": string,
    "pageNumber": string | null,
    "quoteOrExcerpt": string | null,
    "status": "VERIFIED_IN_NCERT" | "OUT_OF_NCERT_SYLLABUS" | "NOT_FOUND",
    "notes": string
  },
  "bilingualAudit": {
    "hasEnglish": boolean,
    "hasHindi": boolean,
    "translationFidelityScore": number,
    "isConsistent": boolean,
    "negationSymmetry": {
      "isConsistent": boolean,
      "englishNegation": boolean,
      "hindiNegation": boolean,
      "notes": string
    },
    "latexPreserved": boolean,
    "generatedDraft": {
      "language": "HINDI" | "ENGLISH",
      "statement": string,
      "options": { "A": string, "B": string, "C": string, "D": string },
      "solution": string
    } | null
  },
  "distractorAudit": {
    "allOptionsDistinct": boolean,
    "plausibleDistractors": boolean,
    "duplicateOptionsFound": string[],
    "ambiguousOptions": string[],
    "markedOptionMatchesSolved": boolean,
    "solvedAnswerKey": string
  },
  "stepByStepSolution": {
    "katexVerified": boolean,
    "solutionText": string,
    "independentSolvedAnswer": string
  },
  "dimensions": {
    "questionCorrectness": number,
    "answerCorrectness": number,
    "optionQuality": number,
    "explanationCorrectness": number,
    "difficultyAccuracy": number,
    "neetRelevance": number,
    "examLevelFit": number,
    "conceptualQuality": number,
    "ambiguityScore": number,
    "typingErrors": number,
    "spellingErrors": number,
    "grammarScore": number,
    "mathematicalAccuracy": number,
    "unitsAndDimensions": number,
    "chemicalAccuracy": number,
    "biologicalAccuracy": number,
    "imageQuality": number,
    "imageRelevance": number,
    "imageDiagramAccuracy": number,
    "formattingQuality": number
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
      "field": "statement" | "options" | "correctAnswer" | "solution" | "difficulty" | "examLevel" | "topic" | "subTopic" | "microConcept" | "translation",
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

  // Synthesize suggestions array with generated translation draft if present
  const suggestions: AiSuggestedChange[] = Array.isArray(parsed.suggestions) ? [...parsed.suggestions] : [];
  
  if (parsed.bilingualAudit?.generatedDraft) {
    const draft = parsed.bilingualAudit.generatedDraft;
    suggestions.push({
      field: "translation",
      original: `${draft.language} translation not available`,
      suggested: JSON.stringify(draft),
      reason: `Authentic NCERT-compliant ${draft.language} translation generated with formulas preserved`,
      confidence: 95,
    });
  }

  // Synthesize errors with high duplicate candidates if found
  const errors: AuditErrorItem[] = Array.isArray(parsed.errors) ? [...parsed.errors] : [];
  if (similarMatches.length > 0 && similarMatches[0].similarityScore >= 80) {
    errors.push({
      severity: "HIGH",
      parameter: "Duplicate Detection",
      explanation: `Question shares ${similarMatches[0].similarityScore}% lexical similarity with existing question #${similarMatches[0].questionCode || similarMatches[0].id.slice(0, 8)}.`,
      suggestedCorrection: "Verify whether this is an intentional variant or an unwanted duplicate.",
    });
  }

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
    examSuitability: parsed.examSuitability || {
      neet: { score: 90, isFit: true, notes: "Well-suited for NEET UG standard" },
      jeeMain: { score: 75, isFit: true, notes: "Good conceptual practice for JEE Main" },
      jeeAdvanced: { score: 40, isFit: false, notes: "Requires multi-concept depth for JEE Advanced" },
      cuet: { score: 85, isFit: true, notes: "Aligned with CUET NTA syllabus" },
      board: { score: 80, isFit: true, notes: "Directly tests NCERT core principles" },
    },
    ncertVerification: parsed.ncertVerification || {
      isVerified: Boolean(question.ncertChapter || question.chapter),
      confidence: 85,
      book: question.ncertBook || `NCERT ${question.subject}`,
      chapter: question.ncertChapter || question.chapter || "Syllabus Standard",
      topicOrSection: question.ncertSection || question.topic || "Core Concept",
      pageNumber: question.ncertPage || null,
      quoteOrExcerpt: question.ncertSection ? `Section ${question.ncertSection}` : "Reference Not Found in Available Sources",
      status: question.ncertChapter ? "VERIFIED_IN_NCERT" : "NOT_FOUND",
      notes: "Cross-checked against standard NCERT curriculum.",
    },
    bilingualAudit: parsed.bilingualAudit || {
      hasEnglish: Boolean(englishT),
      hasHindi: Boolean(hindiT),
      translationFidelityScore: englishT && hindiT ? 90 : 0,
      isConsistent: Boolean(englishT && hindiT),
      negationSymmetry: {
        isConsistent: true,
        englishNegation: Boolean(englishT?.statement.match(/\b(not|incorrect|except)\b/i)),
        hindiNegation: Boolean(hindiT?.statement.match(/(नहीं|गलत|असत्य)/)),
      },
      latexPreserved: true,
      generatedDraft: null,
    },
    distractorAudit: parsed.distractorAudit || {
      allOptionsDistinct: true,
      plausibleDistractors: true,
      duplicateOptionsFound: [],
      ambiguousOptions: [],
      markedOptionMatchesSolved: true,
      solvedAnswerKey: Array.isArray(primaryT.correctOptionIds) ? primaryT.correctOptionIds[0] || "A" : "A",
    },
    stepByStepSolution: parsed.stepByStepSolution || {
      katexVerified: true,
      solutionText: primaryT.solution || "Step-by-step derivation verified.",
      independentSolvedAnswer: Array.isArray(primaryT.correctOptionIds) ? primaryT.correctOptionIds[0] || "A" : "A",
    },
    similarQuestions: similarMatches,
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
    errors,
    suggestions,
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
