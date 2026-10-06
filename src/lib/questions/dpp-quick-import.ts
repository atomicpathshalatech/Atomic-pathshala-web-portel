export interface DppImportValidationItem {
  inputRaw: string;
  normalizedId: string;
  found: boolean;
  questionId?: string;
  questionCode?: string;
  statementSnippet?: string;
  subject?: string;
  chapter?: string;
  difficulty?: string;
  status?: string;
  isPublished?: boolean;
  alreadyInDpp: boolean;
  isEligible: boolean;
  error?: string;
}

export interface DppQuickImportSummary {
  totalInput: number;
  validCount: number;
  eligibleCount: number;
  duplicateInDppCount: number;
  notApprovedCount: number;
  notFoundCount: number;
  items: DppImportValidationItem[];
}

/**
 * Parses raw input string into distinct normalized Question IDs
 */
export function parseQuestionIds(rawInput: string): string[] {
  if (!rawInput || typeof rawInput !== "string") return [];
  return Array.from(
    new Set(
      rawInput
        .split(/[\s,;\n\r\t]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    )
  );
}
