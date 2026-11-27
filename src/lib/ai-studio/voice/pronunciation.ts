export interface PronunciationRuleInput {
  term: string;
  phonetic: string;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Applies user-curated pronunciation corrections (Chemistry/Biology/Physics/NEET
 * terms and English words in Hindi text) before sending text to a TTS provider.
 */
export function applyPronunciationDictionary(
  text: string,
  rules: PronunciationRuleInput[]
): string {
  if (!rules.length) return text;
  let result = text;
  const sorted = [...rules].sort((a, b) => b.term.length - a.term.length);
  for (const rule of sorted) {
    if (!rule.term.trim() || !rule.phonetic.trim()) continue;
    const regex = new RegExp(`\\b${escapeRegExp(rule.term.trim())}\\b`, "gi");
    result = result.replace(regex, rule.phonetic.trim());
  }
  return result;
}
