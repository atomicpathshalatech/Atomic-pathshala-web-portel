/**
 * Structured Solution Definition and Serialization for Atomic Pathshala PYQ & Question Bank.
 * 
 * Provides a clean, pedagogical, subject-adaptive 3-part structure:
 * 1. Concept: Brief, essential theoretical/NCERT context (only when genuinely needed).
 * 2. Solution: Direct, complete, question-specific explanation:
 *    - Biology: Direct biological reasoning/fact without artificial formulas or procedures.
 *    - Physics: Formula, calculation, and reasoning integrated into one coherent solution.
 *    - Chemistry: Reactions, mechanisms, equations, and calculations integrated cleanly.
 * 3. Option Analysis: Meaningful explanation of why the correct option is right and incorrect options are wrong.
 * 
 * Backward compatibility:
 * Seamlessly parses and displays legacy 6-section solutions without data loss.
 */

export interface StructuredSolution {
  /** Core theoretical / NCERT concept (only when needed; minimal or omitted for direct factual questions) */
  concept: string;
  /** Direct, comprehensive, question-specific explanation */
  solution: string;
  /** Option-by-option analysis (why correct is correct, why incorrect are wrong) */
  optionExplanation: string;

  // Backward-compatibility fields for legacy 6-part questions:
  formula?: string;
  stepByStep?: string;
  finalAnswer?: string;
  takeaway?: string;
}

export function createEmptyStructuredSolution(): StructuredSolution {
  return {
    concept: "",
    solution: "",
    optionExplanation: "",
    formula: "",
    stepByStep: "",
    finalAnswer: "",
    takeaway: "",
  };
}

export function isEmptyStructuredSolution(sol: StructuredSolution | null | undefined): boolean {
  if (!sol) return true;
  return (
    !(sol.concept || "").trim() &&
    !(sol.solution || "").trim() &&
    !(sol.stepByStep || "").trim() &&
    !(sol.formula || "").trim() &&
    !(sol.finalAnswer || "").trim() &&
    !(sol.optionExplanation || "").trim() &&
    !(sol.takeaway || "").trim()
  );
}

/**
 * Formats a StructuredSolution into clean, student-friendly markdown adaptively:
 * - If only a single direct explanation exists, returns it without artificial headers.
 * - Otherwise renders clean headers: ### Concept, ### Solution, ### Option Analysis.
 */
export function formatStructuredSolution(sol: StructuredSolution): string {
  if (!sol) return "";

  const c = (sol.concept || "").trim();
  const mainSolution = (
    sol.solution?.trim() ||
    [sol.formula?.trim(), sol.stepByStep?.trim(), sol.finalAnswer?.trim()]
      .filter(Boolean)
      .join("\n\n")
  ).trim();
  const o = (sol.optionExplanation || "").trim();
  const t = (sol.takeaway || "").trim();

  const populated = [c, mainSolution, o, t].filter(Boolean);
  if (populated.length === 0) return "";

  // Single coherent explanation without multiple sections
  if (populated.length === 1 && mainSolution) {
    return mainSolution;
  }

  const parts: string[] = [];

  if (c) {
    parts.push(`### Concept\n${c}`);
  }
  if (mainSolution) {
    parts.push(`### Solution\n${mainSolution}`);
  }
  if (o) {
    parts.push(`### Option Analysis\n${o}`);
  }
  if (t) {
    parts.push(`### Key Takeaway\n${t}`);
  }

  return parts.join("\n\n");
}

/**
 * Parses raw solution string (Markdown or JSON) into StructuredSolution.
 * Robust against legacy 6-part and new 3-part formats.
 */
export function parseStructuredSolution(raw: string | null | undefined): StructuredSolution {
  const result: StructuredSolution = createEmptyStructuredSolution();
  if (!raw || !raw.trim()) return result;

  const trimmed = raw.trim();

  // 1. JSON-stored format
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      const concept = String(parsed.concept || parsed.conceptTheory || "");
      const formula = String(parsed.formula || parsed.formulaRules || "");
      const stepByStep = String(parsed.stepByStep || parsed.steps || "");
      const solution = String(parsed.solution || [formula, stepByStep].filter(Boolean).join("\n\n") || "");
      const finalAnswer = String(parsed.finalAnswer || parsed.answerExplanation || "");
      const optionExplanation = String(parsed.optionExplanation || parsed.optionsAnalysis || parsed.option_explanations || "");
      const takeaway = String(parsed.takeaway || parsed.keyTakeaway || parsed.important_takeaway || "");

      return {
        concept,
        solution: solution || stepByStep || formula,
        optionExplanation,
        formula,
        stepByStep: stepByStep || solution,
        finalAnswer,
        takeaway,
      };
    } catch {
      // fallback to markdown parsing below
    }
  }

  // 2. Markdown sections regex
  const patterns = [
    { key: "concept" as const, regex: /(?:^|\n)#{1,4}\s*(?:1[.)]?\s*)?(?:Concept(?:\s*[\/&]\s*Theory)?|अवधारणा|सिद्धांत)[^\n]*\n([\s\S]*?)(?=(?:^|\n)#{1,4}\s*(?:[1-6][.)]?\s*)?(?:Concept|Formula|Step|Solution|Final|Option|Key|Important|अवधारणा|सूत्र|हल|उत्तर|विकल्प)|$)/i },
    { key: "formula" as const, regex: /(?:^|\n)#{1,4}\s*(?:2[.)]?\s*)?(?:Formula(?:s)?(?:\s*[\/&]\s*Rules)?|सूत्र|नियम)[^\n]*\n([\s\S]*?)(?=(?:^|\n)#{1,4}\s*(?:[1-6][.)]?\s*)?(?:Concept|Formula|Step|Solution|Final|Option|Key|Important|अवधारणा|सूत्र|हल|उत्तर|विकल्प)|$)/i },
    { key: "solution" as const, regex: /(?:^|\n)#{1,4}\s*(?:[23][.)]?\s*)?(?:Step-by-Step\s*(?:Solution)?|Solution\s*&?\s*Explanation|Solution|Detailed\s*Solution|चरणबद्ध\s*हल|हल)[^\n]*\n([\s\S]*?)(?=(?:^|\n)#{1,4}\s*(?:[1-6][.)]?\s*)?(?:Concept|Formula|Step|Solution|Final|Option|Key|Important|अवधारणा|सूत्र|हल|उत्तर|विकल्प)|$)/i },
    { key: "finalAnswer" as const, regex: /(?:^|\n)#{1,4}\s*(?:4[.)]?\s*)?(?:Final\s*Answer(?:\s*Explanation)?|Conclusion|अंतिम\s*उत्तर)[^\n]*\n([\s\S]*?)(?=(?:^|\n)#{1,4}\s*(?:[1-6][.)]?\s*)?(?:Concept|Formula|Step|Solution|Final|Option|Key|Important|अवधारणा|सूत्र|हल|उत्तर|विकल्प)|$)/i },
    { key: "optionExplanation" as const, regex: /(?:^|\n)#{1,4}\s*(?:5[.)]?\s*)?(?:Option(?:-wise)?\s*(?:Analysis|Explanation|Details)?|विकल्प\s*विश्लेषण)[^\n]*\n([\s\S]*?)(?=(?:^|\n)#{1,4}\s*(?:[1-6][.)]?\s*)?(?:Concept|Formula|Step|Solution|Final|Option|Key|Important|अवधारणा|सूत्र|हल|उत्तर|विकल्प)|$)/i },
    { key: "takeaway" as const, regex: /(?:^|\n)#{1,4}\s*(?:6[.)]?\s*)?(?:(?:Key\s*)?Takeaway(?:s)?|Important\s*(?:Note|Tips|Takeaway)|महत्वपूर्ण\s*बिंदु)[^\n]*\n([\s\S]*?)(?=(?:^|\n)#{1,4}\s*(?:[1-6][.)]?\s*)?(?:Concept|Formula|Step|Solution|Final|Option|Key|Important|अवधारणा|सूत्र|हल|उत्तर|विकल्प)|$)/i },
  ];

  let matchedAny = false;
  for (const { key, regex } of patterns) {
    const match = trimmed.match(regex);
    if (match && match[1]) {
      result[key] = match[1].trim();
      matchedAny = true;
    }
  }

  // Synthesize unified solution field if legacy fields were matched
  if (!result.solution) {
    result.solution = [result.formula, result.finalAnswer].filter(Boolean).join("\n\n").trim();
  }
  result.stepByStep = result.solution;

  // If no structured headers were found, assign entire text as solution
  if (!matchedAny) {
    result.solution = trimmed;
    result.stepByStep = trimmed;
  }

  return result;
}
