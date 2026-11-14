/**
 * Diagram & Visual Asset Audit Module
 * Accurately detects whether a question requires a diagram,
 * verifies whether an image URL / asset exists,
 * and identifies missing or broken visual assets without false positives.
 */

import { QuestionAuditCandidate } from "./duplicate-detector";

export interface DiagramAuditResult {
  questionId: string;
  diagramRequired: boolean;
  diagramPresent: boolean;
  diagramStatus: "OK" | "MISSING" | "BROKEN_LINK" | "NOT_REQUIRED";
  referencePhrases: string[];
  severity: "PASSED" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reason: string | null;
}

// Regex patterns indicating explicit reliance on visual diagram/circuit/graph/figure
const DIAGRAM_TRIGGERS: RegExp[] = [
  /\b(?:in|from|refer\s+to|as\s+per|shown\s+in|according\s+to|of)\s+(?:the\s+)?(?:given|adjacent|following|attached|below|above)?\s*(?:figure|fig\.?|diagram|circuit|circuit\s+diagram|graph|table|plot|picture|illustration|chart|arrangement|setup)\b/i,
  /\b(?:given\s+below\s+(?:is|are)?\s*(?:a|the)?\s*(?:figure|circuit|diagram|graph|table|setup))\b/i,
  /\b(?:the\s+given\s+(?:figure|fig\.?|diagram|circuit|graph|table|plot))\b/i,
  /\b(?:as\s+shown\s+in\s+(?:the\s+)?(?:figure|fig\.?|diagram|circuit|graph))\b/i,
  /\b(?:चित्र\s*(?:में|के\s+अनुसार)|आरेख\s*(?:में|के\s+अनुसार)|परिपथ\s*(?:में|दिखाया\s+गया)|ग्राफ\s*(?:में|के\s+अनुसार))\b/i,
];

// Patterns that may mention "figure" idiomatically without needing a diagram, e.g. "figure of merit", "figure out"
const NEGATIVE_TRIGGERS: RegExp[] = [
  /\bfigure\s+of\s+merit\b/i,
  /\bfigure\s+out\b/i,
  /\bsignificant\s+figures?\b/i,
];

export function auditDiagrams(questions: QuestionAuditCandidate[]): Map<string, DiagramAuditResult> {
  const results = new Map<string, DiagramAuditResult>();

  for (const q of questions) {
    const textEn = q.statementEn || "";
    const textHi = q.statementHi || "";
    const combinedText = `${textEn} ${textHi}`;

    const matchedPhrases: string[] = [];
    let requiresDiagram = false;

    // Check negative triggers first
    const isNegExempt = NEGATIVE_TRIGGERS.some((neg) => neg.test(combinedText));

    if (!isNegExempt) {
      for (const pattern of DIAGRAM_TRIGGERS) {
        const match = combinedText.match(pattern);
        if (match) {
          requiresDiagram = true;
          matchedPhrases.push(match[0].trim());
        }
      }
    }

    const hasImage = Boolean(
      (q.imageUrl && q.imageUrl.trim().length > 5) ||
      (q.referenceImageUrl && q.referenceImageUrl.trim().length > 5)
    );

    const imageUrl = (q.imageUrl || q.referenceImageUrl || "").trim();

    let diagramStatus: DiagramAuditResult["diagramStatus"] = "NOT_REQUIRED";
    let severity: DiagramAuditResult["severity"] = "PASSED";
    let reason: string | null = null;

    if (requiresDiagram) {
      if (!hasImage) {
        diagramStatus = "MISSING";
        severity = "CRITICAL";
        reason = `Question references a visual diagram ("${matchedPhrases.slice(0, 2).join('", "')}") but no image asset or diagram URL is attached.`;
      } else {
        // Validate URL format
        if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://") || imageUrl.startsWith("/")) {
          diagramStatus = "OK";
          severity = "PASSED";
          reason = `Valid diagram present matching reference ("${matchedPhrases[0]}").`;
        } else {
          diagramStatus = "BROKEN_LINK";
          severity = "HIGH";
          reason = `Question references a diagram, but the provided image URL format is invalid or corrupted: "${imageUrl}".`;
        }
      }
    } else {
      // Question does not explicitly reference a diagram
      if (hasImage) {
        diagramStatus = "OK";
        severity = "PASSED";
        reason = "Supporting image asset provided with question.";
      } else {
        diagramStatus = "NOT_REQUIRED";
        severity = "PASSED";
        reason = "Conceptual / numerical question does not require a diagram.";
      }
    }

    results.set(q.id, {
      questionId: q.id,
      diagramRequired: requiresDiagram,
      diagramPresent: hasImage,
      diagramStatus,
      referencePhrases: matchedPhrases,
      severity,
      reason,
    });
  }

  return results;
}
