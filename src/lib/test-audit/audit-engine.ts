/**
 * Core Test Audit Engine
 * Coordinates deterministic validations, NEET pattern calibration,
 * scoring algorithms, and database persistence.
 */

import { prisma } from "@/lib/db";
import {
  analyzeDuplicates,
  QuestionAuditCandidate,
  DuplicateResult,
} from "./duplicate-detector";
import { auditDiagrams, DiagramAuditResult } from "./diagram-auditor";
import { validateAnswerKeys, AnswerValidationResult } from "./answer-validator";
import {
  analyzeNeetPatternAndDifficulty,
  NeetAuditSummary,
} from "./neet-analyzer";

export interface AuditRunOptions {
  testId: string;
  userId?: string;
}

export interface TestAuditReportResult {
  reportId: string;
  testId: string;
  reportVersion: number;
  engineVersion: string;
  status: string;
  overallScore: number;
  scoreBreakdown: {
    baseScore: number;
    deductions: { reason: string; penalty: number }[];
    finalScore: number;
  };
  neetAlignment: string;
  metrics: {
    totalQuestions: number;
    exactIdDuplicates: number;
    contentDuplicates: number;
    nearDuplicates: number;
    conceptRepetitions: number;
    answerKeyConflicts: number;
    missingDiagrams: number;
    missingSolutions: number;
    neetPatternAlignment: string;
    easyCount: number;
    moderateCount: number;
    difficultCount: number;
    veryDifficultCount: number;
    criticalIssuesCount: number;
  };
  summary: NeetAuditSummary;
}

export async function runTestAudit(options: AuditRunOptions): Promise<TestAuditReportResult> {
  const { testId, userId } = options;

  // 1. Fetch test with sections and questions
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: {
          questions: {
            orderBy: { order: "asc" },
            include: {
              question: {
                include: {
                  translations: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!test) {
    throw new Error(`Test with ID "${testId}" not found.`);
  }

  // Flatten questions into sequential list
  const candidates: QuestionAuditCandidate[] = [];
  let sequentialNumber = 1;

  for (const section of test.sections) {
    for (const sq of section.questions) {
      const q = sq.question;
      const en = q.translations.find((t) => t.language === "ENGLISH") ?? q.translations[0];
      const hi = q.translations.find((t) => t.language === "HINDI");

      const optionsEn = (en?.options as Record<string, string>) || {};
      const optionsHi = (hi?.options as Record<string, string>) || {};

      // Determine correct answer string
      let correctAnswerStr: string | null = null;
      if (Array.isArray(en?.correctOptionIds) && en.correctOptionIds.length > 0) {
        correctAnswerStr = String(en.correctOptionIds[0]);
      } else if (Array.isArray(hi?.correctOptionIds) && hi.correctOptionIds.length > 0) {
        correctAnswerStr = String(hi.correctOptionIds[0]);
      }

      candidates.push({
        id: q.id,
        questionCode: q.questionCode,
        order: sequentialNumber++,
        sectionName: section.name,
        subject: q.subject || "General",
        chapter: q.chapter || "General",
        statementEn: en?.statement || "",
        statementHi: hi?.statement || "",
        optionsEn,
        optionsHi,
        correctAnswer: correctAnswerStr,
        solution: en?.solution || hi?.solution || q.solution || null,
        imageUrl: q.imageUrl,
        referenceImageUrl: q.referenceImageUrl,
        difficulty: q.difficulty || "MEDIUM",
      });
    }
  }

  // 2. Run validations
  const duplicateMap = analyzeDuplicates(candidates);
  const diagramMap = auditDiagrams(candidates);
  const answerMap = validateAnswerKeys(candidates);
  const { questionDifficulties, summary } = analyzeNeetPatternAndDifficulty(candidates);

  // 3. Count issues and determine severities per question
  let exactIdDuplicates = 0;
  let contentDuplicates = 0;
  let nearDuplicates = 0;
  let conceptRepetitions = 0;
  let answerKeyConflicts = 0;
  let missingDiagrams = 0;
  let missingSolutions = 0;
  let criticalIssuesCount = 0;

  type QuestionAuditData = {
    questionId: string;
    questionNumber: number;
    sectionName: string;
    subject: string;
    chapter: string;
    qualityScore: number;
    severity: string;
    status: string;
    difficulty: string;
    difficultyScore: number;
    difficultyReason: string;
    answerValid: boolean;
    answerNotes: string;
    diagramRequired: boolean;
    diagramPresent: boolean;
    diagramStatus: string;
    duplicateType: string;
    duplicateMatchId: string | null;
    similarityScore: number | null;
    similarityReason: string | null;
    issues: string[];
    ncertReference: string | null;
  };

  const questionAuditList: QuestionAuditData[] = [];

  for (const c of candidates) {
    const dup = duplicateMap.get(c.id) || ({
      duplicateType: "NONE",
      similarityScore: 0,
      reason: null,
      severity: "PASSED",
      matchedQuestionId: null,
    } as DuplicateResult);

    const diag = diagramMap.get(c.id) || ({
      diagramRequired: false,
      diagramPresent: false,
      diagramStatus: "NOT_REQUIRED",
      severity: "PASSED",
      reason: null,
    } as DiagramAuditResult);

    const ans = answerMap.get(c.id) || ({
      answerValid: true,
      hasSolution: true,
      solutionNotes: null,
      severity: "PASSED",
      issues: [],
    } as unknown as AnswerValidationResult);

    const diff = questionDifficulties.get(c.id) || {
      difficulty: "MODERATE",
      difficultyScore: 3.0,
      reason: "Standard",
      patternType: "DIRECT_MCQ",
    };

    // Metric aggregation
    if (dup.duplicateType === "EXACT_ID") exactIdDuplicates++;
    if (dup.duplicateType === "EXACT_CONTENT") contentDuplicates++;
    if (dup.duplicateType === "NEAR_DUPLICATE") nearDuplicates++;
    if (dup.duplicateType === "CONCEPTUAL") conceptRepetitions++;
    if (!ans.answerValid) answerKeyConflicts++;
    if (diag.diagramStatus === "MISSING") missingDiagrams++;
    if (!ans.hasSolution) missingSolutions++;

    const questionIssues: string[] = [];
    if (dup.reason && dup.severity !== "PASSED") questionIssues.push(dup.reason);
    if (diag.reason && diag.severity !== "PASSED") questionIssues.push(diag.reason);
    if (ans.issues.length > 0) questionIssues.push(...ans.issues);

    // Highest severity
    const severities = [dup.severity, diag.severity, ans.severity];
    let highestSeverity = "PASSED";
    if (severities.includes("CRITICAL")) {
      highestSeverity = "CRITICAL";
      criticalIssuesCount++;
    } else if (severities.includes("HIGH")) {
      highestSeverity = "HIGH";
    } else if (severities.includes("MEDIUM")) {
      highestSeverity = "MEDIUM";
    } else if (severities.includes("LOW")) {
      highestSeverity = "LOW";
    }

    // Question quality score
    let qScore = 100;
    if (highestSeverity === "CRITICAL") qScore = 40;
    else if (highestSeverity === "HIGH") qScore = 65;
    else if (highestSeverity === "MEDIUM") qScore = 80;
    else if (highestSeverity === "LOW") qScore = 90;

    questionAuditList.push({
      questionId: c.id,
      questionNumber: c.order,
      sectionName: c.sectionName,
      subject: c.subject,
      chapter: c.chapter,
      qualityScore: qScore,
      severity: highestSeverity,
      status: highestSeverity === "PASSED" ? "AUDITED" : "FLAGGED",
      difficulty: diff.difficulty,
      difficultyScore: diff.difficultyScore,
      difficultyReason: diff.reason,
      answerValid: ans.answerValid,
      answerNotes: ans.solutionNotes || "",
      diagramRequired: diag.diagramRequired,
      diagramPresent: diag.diagramPresent,
      diagramStatus: diag.diagramStatus,
      duplicateType: dup.duplicateType,
      duplicateMatchId: dup.matchedQuestionId,
      similarityScore: dup.similarityScore,
      similarityReason: dup.reason,
      issues: questionIssues,
      ncertReference: c.chapter ? `NCERT Class XI/XII ${c.subject}: ${c.chapter}` : null,
    });
  }

  // 4. Calculate Overall Test Quality Score (Transparent Penalty Ledger)
  const deductions: { reason: string; penalty: number }[] = [];

  if (contentDuplicates > 0) {
    const pen = Math.min(30, contentDuplicates * 15);
    deductions.push({ reason: `${contentDuplicates} Exact Content Duplicate Questions`, penalty: pen });
  }
  if (exactIdDuplicates > 0) {
    const pen = Math.min(30, exactIdDuplicates * 15);
    deductions.push({ reason: `${exactIdDuplicates} Exact ID Duplicate Questions`, penalty: pen });
  }
  if (answerKeyConflicts > 0) {
    const pen = Math.min(30, answerKeyConflicts * 15);
    deductions.push({ reason: `${answerKeyConflicts} Answer Key Conflicts / Ambiguities`, penalty: pen });
  }
  if (missingDiagrams > 0) {
    const pen = Math.min(25, missingDiagrams * 10);
    deductions.push({ reason: `${missingDiagrams} Missing Diagrams in Visual Questions`, penalty: pen });
  }
  if (nearDuplicates > 0) {
    const pen = Math.min(15, nearDuplicates * 5);
    deductions.push({ reason: `${nearDuplicates} Near-Duplicate Questions`, penalty: pen });
  }
  if (missingSolutions > 0) {
    const pen = Math.min(15, Math.ceil(missingSolutions * 1.5));
    deductions.push({ reason: `${missingSolutions} Missing Step-by-Step Solutions`, penalty: pen });
  }
  if (summary.overallAlignment === "BELOW_NEET_LEVEL") {
    deductions.push({ reason: "Syllabus / Pattern Alignment Deviation", penalty: 5 });
  }

  const totalDeductions = deductions.reduce((acc, d) => acc + d.penalty, 0);
  const finalQualityScore = Math.max(0, Math.min(100, 100 - totalDeductions));

  const metrics = {
    totalQuestions: candidates.length,
    exactIdDuplicates,
    contentDuplicates,
    nearDuplicates,
    conceptRepetitions,
    answerKeyConflicts,
    missingDiagrams,
    missingSolutions,
    neetPatternAlignment: summary.overallAlignment,
    easyCount: summary.difficultyBreakdown.easy,
    moderateCount: summary.difficultyBreakdown.moderate,
    difficultCount: summary.difficultyBreakdown.difficult,
    veryDifficultCount: summary.difficultyBreakdown.veryDifficult,
    criticalIssuesCount,
  };

  const scoreBreakdown = {
    baseScore: 100,
    deductions,
    finalScore: finalQualityScore,
  };

  // 5. Atomic persistence into database
  const report = await prisma.$transaction(async (tx) => {
    // Check previous version count
    const prevCount = await tx.testAuditReport.count({ where: { testId } });

    const newReport = await tx.testAuditReport.create({
      data: {
        testId,
        reportVersion: prevCount + 1,
        engineVersion: "1.0.0",
        status: "COMPLETED",
        overallScore: finalQualityScore,
        scoreBreakdown,
        neetAlignment: summary.overallAlignment,
        metrics,
        summary: summary as any,
      },
    });

    // Create question audits in bulk
    await tx.testQuestionAudit.createMany({
      data: questionAuditList.map((qa) => ({
        reportId: newReport.id,
        questionId: qa.questionId,
        questionNumber: qa.questionNumber,
        sectionName: qa.sectionName,
        subject: qa.subject,
        chapter: qa.chapter,
        qualityScore: qa.qualityScore,
        severity: qa.severity,
        status: qa.status,
        difficulty: qa.difficulty,
        difficultyScore: qa.difficultyScore,
        difficultyReason: qa.difficultyReason,
        answerValid: qa.answerValid,
        answerNotes: qa.answerNotes,
        diagramRequired: qa.diagramRequired,
        diagramPresent: qa.diagramPresent,
        diagramStatus: qa.diagramStatus,
        duplicateType: qa.duplicateType,
        duplicateMatchId: qa.duplicateMatchId,
        similarityScore: qa.similarityScore,
        similarityReason: qa.similarityReason,
        issues: qa.issues,
        ncertReference: qa.ncertReference,
      })),
    });

    // Create audit log entry
    await tx.testAuditLog.create({
      data: {
        testId,
        reportId: newReport.id,
        userId: userId || null,
        action: "AUDIT_GENERATED",
        severity: criticalIssuesCount > 0 ? "CRITICAL" : "INFO",
        reason: `Automated test quality audit completed. Score: ${finalQualityScore}/100. Critical issues: ${criticalIssuesCount}.`,
        metadata: { metrics, scoreBreakdown },
      },
    });

    // Update Test status
    const testAuditStatus = criticalIssuesCount > 0 ? "FLAGGED" : "PASSED";
    await tx.test.update({
      where: { id: testId },
      data: {
        lastAuditReportId: newReport.id,
        auditStatus: testAuditStatus,
      },
    });

    return newReport;
  });

  return {
    reportId: report.id,
    testId,
    reportVersion: report.reportVersion,
    engineVersion: report.engineVersion,
    status: report.status,
    overallScore: finalQualityScore,
    scoreBreakdown,
    neetAlignment: summary.overallAlignment,
    metrics,
    summary,
  };
}
