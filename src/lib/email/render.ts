import "server-only";

/**
 * Replaces `{{variable}}` tokens in a template string. Unknown/undefined
 * variables render as an empty string rather than leaking the literal
 * `{{token}}` into a sent email — a template edited to reference a variable
 * that a particular event doesn't provide should degrade quietly, not show
 * broken syntax to the recipient.
 */
export function renderTemplate(source: string, vars: Record<string, string | undefined | null>): string {
  return source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = vars[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

/** Every `{{token}}` referenced in a template string, for the editor's "available variables" hint and for validating a custom template before saving. */
export function extractTemplateVariables(source: string): string[] {
  const found = new Set<string>();
  for (const match of source.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) {
    if (match[1]) found.add(match[1]);
  }
  return [...found];
}
