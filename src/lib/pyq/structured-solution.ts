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
 * Supports subject-adaptive rendering:
 * - For direct/concise conceptual questions (e.g. simple Biology MCQs, 2–4 sentences),
 *   renders cleanly without artificial section headers or filler.
 * - For numerical/multi-part questions, renders headings only for populated sections.
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
 * Formats a StructuredSolution into canonical markdown adaptively.
 * - If only 1 section is populated (e.g. direct 2–4 sentence Biology solution in stepByStep),
 *   returns the direct text without artificial section headers.
 * - If multiple sections are populated, renders headings only for non-empty sections.
 */
export function formatStructuredSolution(sol: StructuredSolution): string {
  if (!sol) return '';

  const c = sol.concept.trim();
  const f = sol.formula.trim();
  const s = sol.stepByStep.trim();
  const a = sol.finalAnswer.trim();
  const o = sol.optionExplanation.trim();
  const t = sol.takeaway.trim();

  const filled = [c, f, s, a, o, t].filter(Boolean);
  if (filled.length === 0) return '';

  // Adaptive: Single coherent explanation does not need artificial headings
  if (filled.length === 1) {
    return c || f || s || a || o || t;
  }

  const parts: string[] = [];

  if (c) {
    parts.push(`### Concept / Theory\n${c}`);
  }
  if (f) {
    parts.push(`### Formula & Rules\n${f}`);
  }
  if (s) {
    const heading = (c || f) ? '### Step-by-Step Solution' : '### Solution & Explanation';
    parts.push(`${heading}\n${s}`);
  }
  if (a) {
    parts.push(`### Final Answer\n${a}`);
  }
  if (o) {
    parts.push(`### Option Analysis\n${o}`);
  }
  if (t) {
    parts.push(`### Key Takeaway & Tips\n${t}`);
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
    { key: 'concept' as const, regex: /(?:^|\n)#{1,4}\s*(?:1[.)]?\s*)?(?:Concept(?:\s*[\/&]\s*Theory)?|अवधारणा|सिद्धांत)[^\n]*\n([\s\S]*?)(?=(?:^|\n)#{1,4}\s*(?:[1-6][.)]?\s*)?(?:Concept|Formula|Step|Solution|Final|Option|Key|Important|अवधारणा|सूत्र|हल|उत्तर|विकल्प)|$)/i },
    { key: 'formula' as const, regex: /(?:^|\n)#{1,4}\s*(?:2[.)]?\s*)?(?:Formula(?:s)?(?:\s*[\/&]\s*Rules)?|सूत्र|नियम)[^\n]*\n([\s\S]*?)(?=(?:^|\n)#{1,4}\s*(?:[1-6][.)]?\s*)?(?:Concept|Formula|Step|Solution|Final|Option|Key|Important|अवधारणा|सूत्र|हल|उत्तर|विकल्प)|$)/i },
    { key: 'stepByStep' as const, regex: /(?:^|\n)#{1,4}\s*(?:3[.)]?\s*)?(?:Step-by-Step\s*(?:Solution)?|Solution\s*&?\s*Explanation|Steps|Detailed\s*Solution|चरणबद्ध\s*हल|हल)[^\n]*\n([\s\S]*?)(?=(?:^|\n)#{1,4}\s*(?:[1-6][.)]?\s*)?(?:Concept|Formula|Step|Solution|Final|Option|Key|Important|अवधारणा|सूत्र|हल|उत्तर|विकल्प)|$)/i },
    { key: 'finalAnswer' as const, regex: /(?:^|\n)#{1,4}\s*(?:4[.)]?\s*)?(?:Final\s*Answer(?:\s*Explanation)?|Conclusion|अंतिम\s*उत्तर)[^\n]*\n([\s\S]*?)(?=(?:^|\n)#{1,4}\s*(?:[1-6][.)]?\s*)?(?:Concept|Formula|Step|Solution|Final|Option|Key|Important|अवधारणा|सूत्र|हल|उत्तर|विकल्प)|$)/i },
    { key: 'optionExplanation' as const, regex: /(?:^|\n)#{1,4}\s*(?:5[.)]?\s*)?(?:Option(?:-wise)?\s*(?:Analysis|Explanation|Details)?|विकल्प\s*विश्लेषण)[^\n]*\n([\s\S]*?)(?=(?:^|\n)#{1,4}\s*(?:[1-6][.)]?\s*)?(?:Concept|Formula|Step|Solution|Final|Option|Key|Important|अवधारणा|सूत्र|हल|उत्तर|विकल्प)|$)/i },
    { key: 'takeaway' as const, regex: /(?:^|\n)#{1,4}\s*(?:6[.)]?\s*)?(?:(?:Key\s*)?Takeaway(?:s)?|Important\s*(?:Note|Tips|Takeaway)|महत्वपूर्ण\s*बिंदु)[^\n]*\n([\s\S]*?)(?=(?:^|\n)#{1,4}\s*(?:[1-6][.)]?\s*)?(?:Concept|Formula|Step|Solution|Final|Option|Key|Important|अवधारणा|सूत्र|हल|उत्तर|विकल्प)|$)/i },
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
