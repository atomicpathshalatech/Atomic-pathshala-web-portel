/**
 * Structured Solution Definition and Serialization for Atomic Pathshala PYQ & Question Bank.
 * 
 * Provides 6 canonical pedagogical sections:
 * 1. Concept / Theory
 * 2. Required Formula / Rules
 * 3. Step-by-Step Solution
 * 4. Final Answer Explanation
 * 5. Option-wise Explanation
 * 6. Important Takeaway
 * 
 * Serializes into clean GitHub Flavored Markdown / KaTeX format that renders
 * identically in the Student Test Portal, Live Classes, and PDF Exports.
 */

export interface StructuredSolution {
  concept: string;
  formula: string;
  stepByStep: string;
  finalAnswer: string;
  optionExplanation: string;
  takeaway: string;
}

export function createEmptyStructuredSolution(): StructuredSolution {
  return {
    concept: '',
    formula: '',
    stepByStep: '',
    finalAnswer: '',
    optionExplanation: '',
    takeaway: '',
  };
}

export function isEmptyStructuredSolution(sol: StructuredSolution | null | undefined): boolean {
  if (!sol) return true;
  return (
    !sol.concept.trim() &&
    !sol.formula.trim() &&
    !sol.stepByStep.trim() &&
    !sol.finalAnswer.trim() &&
    !sol.optionExplanation.trim() &&
    !sol.takeaway.trim()
  );
}

/**
 * Formats a StructuredSolution into canonical markdown.
 */
export function formatStructuredSolution(sol: StructuredSolution): string {
  const parts: string[] = [];

  if (sol.concept.trim()) {
    parts.push(`### 1. Concept / Theory\n${sol.concept.trim()}`);
  }
  if (sol.formula.trim()) {
    parts.push(`### 2. Formula & Rules\n${sol.formula.trim()}`);
  }
  if (sol.stepByStep.trim()) {
    parts.push(`### 3. Step-by-Step Solution\n${sol.stepByStep.trim()}`);
  }
  if (sol.finalAnswer.trim()) {
    parts.push(`### 4. Final Answer Explanation\n${sol.finalAnswer.trim()}`);
  }
  if (sol.optionExplanation.trim()) {
    parts.push(`### 5. Option Analysis\n${sol.optionExplanation.trim()}`);
  }
  if (sol.takeaway.trim()) {
    parts.push(`### 6. Key Takeaway & Tips\n${sol.takeaway.trim()}`);
  }

  return parts.join('\n\n');
}

/**
 * Parses raw solution string (Markdown or JSON) into StructuredSolution.
 */
export function parseStructuredSolution(raw: string | null | undefined): StructuredSolution {
  const result: StructuredSolution = createEmptyStructuredSolution();
  if (!raw || !raw.trim()) return result;

  const trimmed = raw.trim();

  // Try parsing JSON if stored as JSON string
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      return {
        concept: String(parsed.concept || parsed.conceptTheory || ''),
        formula: String(parsed.formula || parsed.formulaRules || ''),
        stepByStep: String(parsed.stepByStep || parsed.steps || parsed.solution || ''),
        finalAnswer: String(parsed.finalAnswer || parsed.answerExplanation || ''),
        optionExplanation: String(parsed.optionExplanation || parsed.optionsAnalysis || ''),
        takeaway: String(parsed.takeaway || parsed.keyTakeaway || ''),
      };
    } catch {
      // fallback to markdown parsing
    }
  }

  // Regex patterns to identify sections in markdown
  const patterns = [
    { key: 'concept' as const, regex: /(?:^|\n)#{1,4}\s*(?:1[.)]?\s*)?(?:Concept(?:\s*[\/&]\s*Theory)?|अवधारणा|सिद्धांत)[^\n]*\n([\s\S]*?)(?=(?:^|\n)#{1,4}\s*(?:[1-6][.)]?\s*)?(?:Concept|Formula|Step|Final|Option|Key|Important|अवधारणा|सूत्र|हल|उत्तर|विकल्प)|$)/i },
    { key: 'formula' as const, regex: /(?:^|\n)#{1,4}\s*(?:2[.)]?\s*)?(?:Formula(?:s)?(?:\s*[\/&]\s*Rules)?|सूत्र|नियम)[^\n]*\n([\s\S]*?)(?=(?:^|\n)#{1,4}\s*(?:[1-6][.)]?\s*)?(?:Concept|Formula|Step|Final|Option|Key|Important|अवधारणा|सूत्र|हल|उत्तर|विकल्प)|$)/i },
    { key: 'stepByStep' as const, regex: /(?:^|\n)#{1,4}\s*(?:3[.)]?\s*)?(?:Step-by-Step\s*(?:Solution)?|Steps|Detailed\s*Solution|चरणबद्ध\s*हल|हल)[^\n]*\n([\s\S]*?)(?=(?:^|\n)#{1,4}\s*(?:[1-6][.)]?\s*)?(?:Concept|Formula|Step|Final|Option|Key|Important|अवधारणा|सूत्र|हल|उत्तर|विकल्प)|$)/i },
    { key: 'finalAnswer' as const, regex: /(?:^|\n)#{1,4}\s*(?:4[.)]?\s*)?(?:Final\s*Answer(?:\s*Explanation)?|Conclusion|अंतिम\s*उत्तर)[^\n]*\n([\s\S]*?)(?=(?:^|\n)#{1,4}\s*(?:[1-6][.)]?\s*)?(?:Concept|Formula|Step|Final|Option|Key|Important|अवधारणा|सूत्र|हल|उत्तर|विकल्प)|$)/i },
    { key: 'optionExplanation' as const, regex: /(?:^|\n)#{1,4}\s*(?:5[.)]?\s*)?(?:Option(?:-wise)?\s*(?:Analysis|Explanation|Details)?|विकल्प\s*विश्लेषण)[^\n]*\n([\s\S]*?)(?=(?:^|\n)#{1,4}\s*(?:[1-6][.)]?\s*)?(?:Concept|Formula|Step|Final|Option|Key|Important|अवधारणा|सूत्र|हल|उत्तर|विकल्प)|$)/i },
    { key: 'takeaway' as const, regex: /(?:^|\n)#{1,4}\s*(?:6[.)]?\s*)?(?:(?:Key\s*)?Takeaway(?:s)?|Important\s*(?:Note|Tips|Takeaway)|महत्वपूर्ण\s*बिंदु)[^\n]*\n([\s\S]*?)(?=(?:^|\n)#{1,4}\s*(?:[1-6][.)]?\s*)?(?:Concept|Formula|Step|Final|Option|Key|Important|अवधारणा|सूत्र|हल|उत्तर|विकल्प)|$)/i },
  ];

  let matchedAny = false;
  for (const { key, regex } of patterns) {
    const match = trimmed.match(regex);
    if (match && match[1]) {
      result[key] = match[1].trim();
      matchedAny = true;
    }
  }

  // If no structured headers were found, assign the entire raw text to stepByStep
  if (!matchedAny) {
    result.stepByStep = trimmed;
  }

  return result;
}
