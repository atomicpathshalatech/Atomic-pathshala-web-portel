import type { ModuleElementInput } from "@/lib/validation/module";

export interface ReplacementRule {
  id: string;
  find: string;
  replace: string;
  matchCase?: boolean;
  wholeWord?: boolean;
}

/**
 * Safely replaces occurrences of text in a string while respecting whole word and case sensitivity options.
 */
export function applyTextReplacements(text: string, rules: ReplacementRule[]): string {
  if (!text || rules.length === 0) return text;

  let result = text;
  for (const rule of rules) {
    if (!rule.find || !rule.find.trim()) continue;

    const findTerm = rule.find.trim();
    const replaceTerm = rule.replace ?? "";
    const escaped = findTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const flags = rule.matchCase ? "g" : "gi";
    const pattern = rule.wholeWord
      ? `(^|[^\\p{L}\\p{N}])(${escaped})(?=$|[^\\p{L}\\p{N}])`
      : escaped;

    if (rule.wholeWord) {
      const re = new RegExp(pattern, `${flags}u`);
      result = result.replace(re, (_match, prefix) => `${prefix}${replaceTerm}`);
    } else {
      const re = new RegExp(pattern, flags);
      result = result.replace(re, replaceTerm);
    }
  }

  return result;
}

/**
 * Applies Global Find & Replace recursively across an entire array of Module Elements (AST).
 * Handles text in:
 * - content
 * - label
 * - tableData
 * - options list
 */
export function applyGlobalFindAndReplaceToAST(
  elements: ModuleElementInput[],
  rules: ReplacementRule[]
): ModuleElementInput[] {
  if (!elements || elements.length === 0 || !rules || rules.length === 0) {
    return elements;
  }

  return elements.map((el) => {
    const updated = { ...el };

    if (typeof updated.content === "string") {
      updated.content = applyTextReplacements(updated.content, rules);
    }

    if (typeof updated.label === "string") {
      updated.label = applyTextReplacements(updated.label, rules);
    }

    if (Array.isArray(updated.tableData)) {
      updated.tableData = updated.tableData.map((row) =>
        row.map((cell) => (typeof cell === "string" ? applyTextReplacements(cell, rules) : cell))
      );
    }

    return updated;
  });
}
