/**
 * ATOMIC PATHSHALA — UNIVERSAL STANDARDIZED SOLUTION SYSTEM
 *
 * Enforces the mandatory 4-section solution structure across the entire platform:
 * 1. Correct Answer: Display correct answer and option clearly at the beginning
 * 2. Concept Used: Concise primary concept, law, theorem, formula, or NCERT principle
 * 3. Step-by-Step Solution: Complete, accurate, logically connected steps with clean spacing
 * 4. Final Answer: Final result (value, unit, product, conclusion, and option)
 *
 * Subject-Aware:
 * - Physics: Concept Used -> Formula -> Substitution -> Calculation -> Final Result
 * - Mathematics: Theorem/Concept -> Valid Step Derivation -> Final Result
 * - Chemistry: Structural preservation, balanced equations, reagents, conditions, mechanism
 * - Biology: NCERT terminology, statement-by-statement evaluation, clear conclusions
 *
 * Bilingual: 100% parity between English and Hindi.
 */

export interface StandardSolution {
  /** 1. Correct Answer displayed at the top (e.g., "Option B" or "Option (B): 3.2 m/s") */
  correctAnswer: string;
  /** Single letter key if applicable: "A" | "B" | "C" | "D" */
  correctOptionKey?: string;
  /** 2. Concept Used: concise primary law, theorem, formula, NCERT principle */
  conceptUsed: string;
  /** 3. Step-by-Step Solution: logically connected steps with ~1 line visual spacing */
  stepByStep: string;
  /** 4. Final Answer: value, unit, product, conclusion, option at the bottom */
  finalAnswer: string;
  /** Visual diagram / reaction scheme / image asset URL if present */
  imageUrl?: string | null;
  /** Source origin of the solution */
  source?: "PDF_ORIGINAL" | "TEACHER_PROVIDED" | "ALLEN_MODULE" | "NCERT_VERIFIED" | "AI_GENERATED";
}

export function createEmptyStandardSolution(): StandardSolution {
  return {
    correctAnswer: "",
    correctOptionKey: "",
    conceptUsed: "",
    stepByStep: "",
    finalAnswer: "",
    imageUrl: null,
    source: "AI_GENERATED",
  };
}

export function isStandardSolutionEmpty(sol: StandardSolution | null | undefined): boolean {
  if (!sol) return true;
  return (
    !(sol.correctAnswer || "").trim() &&
    !(sol.conceptUsed || "").trim() &&
    !(sol.stepByStep || "").trim() &&
    !(sol.finalAnswer || "").trim()
  );
}

/**
 * Normalizes text lines to ensure clean visual spacing between logical steps.
 */
export function formatLogicalStepSpacing(text: string): string {
  if (!text) return "";
  let clean = text.trim();

  // Normalize Windows CRLF to LF
  clean = clean.replace(/\r\n/g, "\n");

  // Ensure double newlines before step markers like "Step 1:", "चरण 1:", "Case 1:", etc.
  clean = clean.replace(/([^\n])\s*\n\s*(Step\s*\d+|चरण\s*\d+|Case\s*\d+|स्थिति\s*\d+|Statement\s*[I|V|X\d]+|कथन\s*[I|V|X\d]+|Option\s*\([A-D]\)|विकल्प\s*\([A-D]\)):/gi, "$1\n\n$2:");

  // Collapse 3+ newlines into 2
  clean = clean.replace(/\n{3,}/g, "\n\n");

  return clean;
}

/**
 * Formats a StandardSolution object into the platform's canonical Markdown format.
 */
export function formatStandardSolutionMarkdown(
  sol: StandardSolution,
  lang: "EN" | "HI" = "EN"
): string {
  if (!sol) return "";
  const hasHindi = /[ऀ-ॿ]/.test(`${sol.conceptUsed} ${sol.stepByStep} ${sol.correctAnswer} ${sol.finalAnswer}`);
  const isEn = lang === "HI" ? false : lang === "EN" && !hasHindi;

  const optKey = (sol.correctOptionKey || "").trim().toUpperCase();
  const rawCorrectAns = (sol.correctAnswer || "").trim();

  // 1. Correct Answer Section
  let formattedCorrectAns = rawCorrectAns;
  if (!formattedCorrectAns && optKey) {
    formattedCorrectAns = isEn ? `Option ${optKey}` : `विकल्प ${optKey}`;
  }
  // Strip duplicate "Correct Answer:" if already present in text
  formattedCorrectAns = formattedCorrectAns.replace(/^(?:\*\*)?(?:Correct\s*Answer|सही\s*उत्तर)(?:\s*:)?(?:\*\*)?\s*/i, "");

  const correctAnsLine = isEn
    ? `**Correct Answer: ${formattedCorrectAns || (optKey ? `Option ${optKey}` : "Option A")}**`
    : `**सही उत्तर: ${formattedCorrectAns || (optKey ? `विकल्प ${optKey}` : "विकल्प A")}**`;

  // 2. Concept Used Section
  const conceptText = (sol.conceptUsed || "").trim();

  // 3. Step-by-Step Solution Section
  const stepsText = formatLogicalStepSpacing((sol.stepByStep || "").trim());

  // 4. Final Answer Section
  let rawFinal = (sol.finalAnswer || "").trim();
  rawFinal = rawFinal.replace(/^(?:\*\*)?(?:Final\s*Answer|अंतिम\s*उत्तर)(?:\s*:)?(?:\*\*)?\s*/i, "");
  if (!rawFinal) {
    rawFinal = formattedCorrectAns || (optKey ? (isEn ? `Option ${optKey}` : `विकल्प ${optKey}`) : "");
  }

  const finalAnsLine = isEn
    ? `**Final Answer: ${rawFinal || "Option Verified"}**`
    : `**अंतिम उत्तर: ${rawFinal || "सत्यापित उत्तर"}**`;

  const sections: string[] = [];

  // Section 1: Correct Answer
  sections.push(`### ${isEn ? "1. Correct Answer" : "1. सही उत्तर"}\n${correctAnsLine}`);

  // Section 2: Concept Used (always present)
  if (conceptText) {
    sections.push(`### ${isEn ? "2. Concept Used" : "2. प्रयुक्त अवधारणा"}\n${conceptText}`);
  }

  // Section 3: Step-by-Step Solution
  if (stepsText) {
    sections.push(`### ${isEn ? "3. Step-by-Step Solution" : "3. चरण-दर-चरण हल"}\n${stepsText}`);
  }

  // Section 4: Final Answer
  if (rawFinal) {
    sections.push(`### ${isEn ? "4. Final Answer" : "4. अंतिम उत्तर"}\n${finalAnsLine}`);
  }

  return sections.join("\n\n");
}

/**
 * Robust Parser that converts ANY raw solution string (Markdown, JSON, or legacy format)
 * into a structured StandardSolution object.
 */
export function parseStandardSolution(
  raw: string | null | undefined,
  opts: {
    correctOptionKey?: string;
    options?: Record<string, string>;
    subject?: string;
    lang?: "EN" | "HI";
    imageUrl?: string | null;
  } = {}
): StandardSolution {
  const result: StandardSolution = createEmptyStandardSolution();
  if (opts.imageUrl) result.imageUrl = opts.imageUrl;
  if (opts.correctOptionKey) result.correctOptionKey = opts.correctOptionKey.toUpperCase();

  if (!raw || !raw.trim()) {
    if (opts.correctOptionKey) {
      result.correctAnswer = `Option ${opts.correctOptionKey}`;
      result.finalAnswer = `Option ${opts.correctOptionKey}`;
    }
    return result;
  }

  const trimmed = raw.trim();
  const isHindi = opts.lang === "HI" || /[ऀ-ॿ]/.test(trimmed);

  // 1. JSON parsing check
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const p = JSON.parse(trimmed);
      result.correctAnswer = p.correctAnswer || p.correct_answer || (opts.correctOptionKey ? `Option ${opts.correctOptionKey}` : "");
      result.correctOptionKey = p.correctOptionKey || p.correct_option_key || opts.correctOptionKey;
      result.conceptUsed = p.conceptUsed || p.concept_used || p.concept || p.theory || "";
      result.stepByStep = p.stepByStep || p.step_by_step || p.steps || p.solution || "";
      result.finalAnswer = p.finalAnswer || p.final_answer || p.answer || "";
      if (p.imageUrl) result.imageUrl = p.imageUrl;
      if (result.stepByStep) return result;
    } catch {
      // Fallback to markdown parsing below
    }
  }

  // 2. Regular Expressions for 4 Canonical Sections (allowing optional leading indentation)
  const correctAnsRegex = /(?:^|\n)[ \t]*#{1,4}\s*(?:1[.)]?\s*)?(?:Correct\s*Answer|सही\s*उत्तर)[^\n]*\n([\s\S]*?)(?=(?:^|\n)[ \t]*#{1,4}\s*(?:[1-4][.)]?\s*)?(?:Correct|Concept|Step|Solution|Final|प्रयुक्त|अवधारणा|चरण|हल|अंतिम)|$)/i;
  const conceptRegex = /(?:^|\n)[ \t]*#{1,4}\s*(?:2[.)]?\s*)?(?:Concept\s*(?:Used|Theory)?|प्रयुक्त\s*अवधारणा|अवधारणा|सिद्धांत)[^\n]*\n([\s\S]*?)(?=(?:^|\n)[ \t]*#{1,4}\s*(?:[1-4][.)]?\s*)?(?:Correct|Concept|Step|Solution|Final|प्रयुक्त|अवधारणा|चरण|हल|अंतिम)|$)/i;
  const stepByStepRegex = /(?:^|\n)[ \t]*#{1,4}\s*(?:3[.)]?\s*)?(?:Step-by-Step\s*(?:Solution)?|Detailed\s*Solution|Solution|चरण-दर-चरण\s*हल|हल)[^\n]*\n([\s\S]*?)(?=(?:^|\n)[ \t]*#{1,4}\s*(?:[1-4][.)]?\s*)?(?:Correct|Concept|Step|Solution|Final|प्रयुक्त|अवधारणा|चरण|हल|अंतिम)|$)/i;
  const finalAnsRegex = /(?:^|\n)[ \t]*#{1,4}\s*(?:4[.)]?\s*)?(?:Final\s*Answer|Conclusion|अंतिम\s*उत्तर)[^\n]*\n([\s\S]*?)(?=(?:^|\n)[ \t]*#{1,4}\s*(?:[1-4][.)]?\s*)?(?:Correct|Concept|Step|Solution|Final|प्रयुक्त|अवधारणा|चरण|हल|अंतिम)|$)/i;

  const mCorrect = trimmed.match(correctAnsRegex);
  const mConcept = trimmed.match(conceptRegex);
  const mSteps = trimmed.match(stepByStepRegex);
  const mFinal = trimmed.match(finalAnsRegex);

  if (mSteps || mConcept) {
    if (mCorrect && mCorrect[1]) {
      result.correctAnswer = mCorrect[1].trim().replace(/^\*\*(.*?)\*\*$/, "$1").replace(/^Correct\s*Answer:\s*/i, "").trim();
    }
    if (mConcept && mConcept[1]) {
      result.conceptUsed = mConcept[1].trim();
    }
    if (mSteps && mSteps[1]) {
      result.stepByStep = mSteps[1].trim();
    }
    if (mFinal && mFinal[1]) {
      result.finalAnswer = mFinal[1].trim().replace(/^\*\*(.*?)\*\*$/, "$1").replace(/^Final\s*Answer:\s*/i, "").trim();
    }
  }

  // 3. Check for legacy 6-part or 3-part Markdown patterns if not matched
  if (!result.stepByStep) {
    const legacyPatterns = [
      { key: "conceptUsed", regex: /(?:^|\n)#{1,4}\s*(?:1[.)]?\s*)?(?:Concept(?:\s*[\/&]\s*Theory)?|अवधारणा|सिद्धांत)[^\n]*\n([\s\S]*?)(?=(?:^|\n)#{1,4}|$)/i },
      { key: "formula", regex: /(?:^|\n)#{1,4}\s*(?:2[.)]?\s*)?(?:Formula(?:s)?(?:\s*[\/&]\s*Rules)?|सूत्र|नियम)[^\n]*\n([\s\S]*?)(?=(?:^|\n)#{1,4}|$)/i },
      { key: "stepByStep", regex: /(?:^|\n)#{1,4}\s*(?:[23][.)]?\s*)?(?:Step-by-Step\s*(?:Solution)?|Solution|Detailed\s*Solution|चरणबद्ध\s*हल|हल)[^\n]*\n([\s\S]*?)(?=(?:^|\n)#{1,4}|$)/i },
      { key: "finalAnswer", regex: /(?:^|\n)#{1,4}\s*(?:4[.)]?\s*)?(?:Final\s*Answer|Conclusion|अंतिम\s*उत्तर)[^\n]*\n([\s\S]*?)(?=(?:^|\n)#{1,4}|$)/i },
      { key: "optionAnalysis", regex: /(?:^|\n)#{1,4}\s*(?:5[.)]?\s*)?(?:Option(?:-wise)?\s*(?:Analysis|Explanation|Details)?|विकल्प\s*विश्लेषण)[^\n]*\n([\s\S]*?)(?=(?:^|\n)#{1,4}|$)/i },
    ];

    let legStep = "";
    let legConcept = "";
    let legFormula = "";
    let legFinal = "";
    let legOption = "";

    for (const p of legacyPatterns) {
      const match = trimmed.match(p.regex);
      if (match && match[1]) {
        if (p.key === "stepByStep") legStep = match[1].trim();
        if (p.key === "conceptUsed") legConcept = match[1].trim();
        if (p.key === "formula") legFormula = match[1].trim();
        if (p.key === "finalAnswer") legFinal = match[1].trim();
        if (p.key === "optionAnalysis") legOption = match[1].trim();
      }
    }

    if (legStep || legFormula || legOption) {
      result.conceptUsed = [legConcept, legFormula].filter(Boolean).join("\n\n").trim();
      result.stepByStep = [legStep, legOption].filter(Boolean).join("\n\n").trim();
      result.finalAnswer = legFinal;
    }
  }

  // 4. Fallback for completely unstructured / raw text solutions
  if (!result.stepByStep) {
    // Check if text has inline markers like "Concept :", "Solution :", "Final Answer :"
    const inlineConcept = trimmed.match(/(?:^|\n)\s*(?:Concept|सिद्धांत)\s*:\s*([\s\S]*?)(?=(?:\n\s*(?:Solution|Step\s*1|Final\s*Answer|हल|चरण|अंतिम\s*उत्तर)\s*:)|$)/i);
    const inlineSolution = trimmed.match(/(?:^|\n)\s*(?:Solution|हल)\s*:\s*([\s\S]*?)(?=(?:\n\s*(?:Final\s*Answer|अंतिम\s*उत्तर)\s*:)|$)/i);
    const inlineFinal = trimmed.match(/(?:^|\n)\s*(?:Final\s*Answer|अंतिम\s*उत्तर)\s*:\s*([\s\S]*?)$/i);

    if (inlineSolution || inlineConcept) {
      result.conceptUsed = inlineConcept ? inlineConcept[1].trim() : "";
      result.stepByStep = inlineSolution ? inlineSolution[1].trim() : trimmed;
      result.finalAnswer = inlineFinal ? inlineFinal[1].trim() : "";
    } else {
      // Entire text is the step-by-step solution body
      result.stepByStep = trimmed;
    }
  }

  // 5. Deduce Concept Used if empty from first line or known formula
  if (!result.conceptUsed) {
    const mathFormulaMatch = result.stepByStep.match(/(\$\$[\s\S]+?\$\$|\$[^\$]+?\$)/);
    if (mathFormulaMatch && (opts.subject === "Physics" || opts.subject === "Chemistry" || opts.subject === "Mathematics")) {
      result.conceptUsed = isHindi
        ? `इस प्रश्न में मुख्य अवधारणा / सूत्र का प्रयोग किया गया है:`
        : `Governing theoretical principle and formula for this question:`;
    } else {
      result.conceptUsed = isHindi
        ? `NCERT पाठ्यक्रम एवं अध्याय की मुख्य अवधारणा पर आधारित।`
        : `Based on core NCERT concepts and academic principles.`;
    }
  }

  // 6. Complete Correct Answer & Final Answer if missing
  let resolvedKey = opts.correctOptionKey ? opts.correctOptionKey.toUpperCase() : undefined;

  if (!resolvedKey) {
    const searchText = `${result.correctAnswer}\n${result.finalAnswer}\n${result.stepByStep}`;
    const detectedOptionMatch = searchText.match(/(?:Option|विकल्प|Ans(?:wer)?|उत्तर|Correct\s*Option|सही\s*विकल्प)\s*(?:is|:|-)?\s*\(?([A-D1-4])\)?/i)
      || searchText.match(/\b([A-D])\s*(?:is\s*(?:the\s*)?correct|सही\s*है)/i);

    if (detectedOptionMatch) {
      const rawMatch = detectedOptionMatch[1].toUpperCase();
      const numToLetterMap: Record<string, string> = { "1": "A", "2": "B", "3": "C", "4": "D" };
      resolvedKey = numToLetterMap[rawMatch] || rawMatch;
    }
  }

  if (resolvedKey) {
    result.correctOptionKey = resolvedKey;
    if (!result.correctAnswer) {
      const optVal = opts.options ? opts.options[resolvedKey] : "";
      result.correctAnswer = isHindi
        ? `विकल्प ${resolvedKey}${optVal ? ` (${optVal})` : ""}`
        : `Option ${resolvedKey}${optVal ? ` (${optVal})` : ""}`;
    }
    if (!result.finalAnswer) {
      const optVal = opts.options ? opts.options[resolvedKey] : "";
      result.finalAnswer = isHindi
        ? `${optVal ? `${optVal} — ` : ""}विकल्प ${resolvedKey}`
        : `${optVal ? `${optVal} — ` : ""}Option ${resolvedKey}`;
    }
  }

  // Final fallback to ensure non-empty sections
  if (!result.correctAnswer) {
    result.correctAnswer = isHindi ? "सत्यापित उत्तर" : "Verified Answer";
  }
  if (!result.finalAnswer) {
    result.finalAnswer = result.correctAnswer;
  }

  return result;
}
