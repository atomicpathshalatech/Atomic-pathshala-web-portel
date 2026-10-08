// src/question-similarity/text-normalizer.ts
import crypto from "crypto";

export const BOILERPLATE_PHRASES = [
  /\bwhich\s+(of\s+the\s+following\s+)?(statements?|options?|one)?\s*(given\s+below\s*)?(is|are)?\s*(correct|incorrect|true|false|right|wrong|not\s+true|not\s+correct)?\b/gi,
  /\bwhich\s+of\s+the\s+following\b/gi,
  /\bselect\s+the\s+(correct|incorrect|true|false|right|wrong)\s*(statements?|options?|answers?)?\b/gi,
  /\bidentify\s+the\s+(correct|incorrect|true|false|right|wrong)\s*(statements?|options?|pairs?)?\b/gi,
  /\bchoose\s+the\s+(correct|incorrect|true|false|right|wrong)\s*(options?|statements?|answers?)?\b/gi,
  /\bfrom\s+the\s+given\s+options\b/gi,
  /\bwith\s+reference\s+to\s+the\s+above\b/gi,
  /\bनिम्नलिखित\s+में\s+से\s+कौन\s+सा\s*(कथन\s*)?(सही|गलत|सत्य|असत्य)\s*है\b/gi,
  /\bसही\s+विकल्प\s+(का\s+चयन\s+करें|चुनें)\b/gi,
];

export class TextNormalizer {
  /**
   * Cleans text, removes HTML tags, normalizes whitespace and punctuation
   */
  static clean(text: string): string {
    if (!text) return "";
    return text
      .toLowerCase()
      .replace(/<[^>]*>/g, " ") // Strip HTML tags
      .replace(/[^\w\s\u0900-\u097F.+*/^=(){}\[\]\\$-]/gi, " ") // Keep alphanumeric, Hindi, math symbols
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Generates SHA-256 hash of normalized text for instant exact duplicate lookup
   */
  static hash(text: string): string {
    const cleaned = this.clean(text);
    return crypto.createHash("sha256").update(cleaned).digest("hex");
  }

  /**
   * Strips common exam boilerplate phrases so core concepts and data are matched accurately
   */
  static stripBoilerplate(text: string): string {
    let result = text;
    for (const pattern of BOILERPLATE_PHRASES) {
      result = result.replace(pattern, " ");
    }
    return this.clean(result);
  }

  /**
   * Extracts numerical values and replaces them with '#NUM' to construct structural skeleton
   */
  static extractStructuralTemplate(text: string): string {
    const cleaned = this.clean(text);
    return cleaned
      .replace(/\b\d+(\.\d+)?([eE][+-]?\d+)?\b/g, "#NUM") // numbers & scientific notation
      .replace(/\\(frac|sqrt|vec|hat|times|cdot|alpha|beta|gamma|theta|lambda|pi)/g, "#MATH_SYM");
  }

  /**
   * Extracts all numbers found in the text for exact numerical match checking
   */
  static extractNumbers(text: string): number[] {
    const matches = text.match(/\b\d+(\.\d+)?\b/g);
    if (!matches) return [];
    return matches.map(Number).filter((n) => !isNaN(n));
  }

  /**
   * Extracts mathematical formulas / LaTeX expressions
   */
  static extractMathTokens(text: string): string[] {
    const mathBlocks = text.match(/\$([^$]+)\$|\\\[(.*?)\\\]/g);
    if (!mathBlocks) return [];
    return mathBlocks.map((m) => this.clean(m));
  }

  /**
   * Tokenizes text into word-level shingles / n-grams
   */
  static getShingles(text: string, n = 2): Set<string> {
    const tokens = this.clean(text).split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return new Set();
    if (tokens.length < n) return new Set(tokens);

    const shingles = new Set<string>();
    // Include unigrams
    tokens.forEach((t) => {
      if (t.length > 2) shingles.add(t);
    });

    for (let i = 0; i <= tokens.length - n; i++) {
      shingles.add(tokens.slice(i, i + n).join(" "));
    }
    return shingles;
  }
}
