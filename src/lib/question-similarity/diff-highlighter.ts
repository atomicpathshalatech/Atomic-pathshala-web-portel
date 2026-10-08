// src/question-similarity/diff-highlighter.ts
import { DiffToken, HighlightedComparison } from "./types";
import { TextNormalizer } from "./text-normalizer";

export class DiffHighlighter {
  /**
   * Compares two question statements and generates tokenized spans with match flags
   */
  static generateHighlightedDiff(originalText: string, newText: string): HighlightedComparison {
    if (!originalText || !newText) {
      return {
        originalTokens: [{ text: originalText || "", isMatched: false }],
        newTokens: [{ text: newText || "", isMatched: false }],
        matchedPhrases: [],
      };
    }

    const origWords = originalText.split(/\s+/);
    const newWords = newText.split(/\s+/);

    const origNormalizedWords = origWords.map((w) => TextNormalizer.clean(w));
    const newNormalizedWords = newWords.map((w) => TextNormalizer.clean(w));

    // Build word set from new text
    const newWordSet = new Set(newNormalizedWords.filter((w) => w.length > 2));
    const origWordSet = new Set(origNormalizedWords.filter((w) => w.length > 2));

    // Identify matching bigrams and trigrams
    const matchedPhrases: string[] = [];
    const origShingles = TextNormalizer.getShingles(originalText, 2);
    const newShingles = TextNormalizer.getShingles(newText, 2);

    origShingles.forEach((shingle) => {
      if (newShingles.has(shingle) && shingle.length > 5) {
        matchedPhrases.push(shingle);
      }
    });

    const originalTokens: DiffToken[] = origWords.map((word, idx) => {
      const norm = origNormalizedWords[idx];
      const isNum = /\d/.test(word);
      const isMatch = (norm.length > 2 && newWordSet.has(norm)) || (isNum && newText.includes(word));
      return {
        text: word,
        isMatched: isMatch,
        isNumber: isNum,
      };
    });

    const newTokens: DiffToken[] = newWords.map((word, idx) => {
      const norm = newNormalizedWords[idx];
      const isNum = /\d/.test(word);
      const isMatch = (norm.length > 2 && origWordSet.has(norm)) || (isNum && originalText.includes(word));
      return {
        text: word,
        isMatched: isMatch,
        isNumber: isNum,
      };
    });

    return {
      originalTokens,
      newTokens,
      matchedPhrases: Array.from(new Set(matchedPhrases)).slice(0, 10),
    };
  }
}
