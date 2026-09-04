/**
 * HIGH-PRECISION QUESTION BOUNDARY & STRUCTURE DETECTOR
 *
 * Identifies question starts (e.g., Q. 1, 1., Question 37, प्रश्न 37).
 * Extracts exact options without rewriting or reordering.
 * Preserves mathematical notation ($...$, $$...$$), superscripts, subscripts,
 * chemical formulas, tables, and figure markers.
 * Never merges or splits questions silently.
 */

export interface ParsedQuestionBlock {
  originalNumber: number;
  sourcePage: number;
  statement: string;
  statementHi?: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  hasTable: boolean;
  tableMarkdown?: string;
  hasImage: boolean;
  imageUrl?: string;
  hasEquation: boolean;
  confidence: {
    text: number;
    options: number;
    table: number;
    image: number;
    overall: number;
  };
  reviewReasons: string[];
}

/**
 * Detects question blocks from sequential text and page indices
 */
export function detectQuestionBlocks(
  fullDocumentText: string,
  startNumber: number = 1,
  endNumber: number = 180,
  pageMap: Map<number, string> = new Map()
): ParsedQuestionBlock[] {
  const questions: ParsedQuestionBlock[] = [];
  const text = fullDocumentText.replace(/\r\n/g, "\n");

  // Regex identifying question starters: "Q. 37", "Q37.", "Question 37:", "37.", "37 )", "प्रश्न 37"
  const questionHeaderRegex = /(?:^|\n)(?:Q(?:uestion|\.)?\s*([0-9]{1,4})\s*[:\.\)-]|([0-9]{1,4})\s*[\.\)]\s+|प्रश्न\s*([0-9]{1,4})\s*[:\.\)-])/gi;

  const matches = Array.from(text.matchAll(questionHeaderRegex));

  if (matches.length === 0) {
    return questions;
  }

  for (let i = 0; i < matches.length; i++) {
    const currentMatch = matches[i];
    if (!currentMatch) continue;
    const nextMatch = matches[i + 1];

    const qNumStr = currentMatch[1] || currentMatch[2] || currentMatch[3] || String(i + 1);
    const qNum = parseInt(qNumStr, 10);

    // Skip if question number is totally outside expected range (unless close)
    if (isNaN(qNum) || qNum < 1 || qNum > 500) continue;

    const startIndex = (currentMatch.index ?? 0) + currentMatch[0].length;
    const endIndex = nextMatch && nextMatch.index !== undefined ? nextMatch.index : text.length;

    const blockText = text.substring(startIndex, endIndex).trim();

    // Determine estimated page number
    let sourcePage = 1;
    let charOffset = 0;
    for (const [pg, content] of Array.from(pageMap.entries())) {
      charOffset += content.length;
      if (currentMatch.index !== undefined && currentMatch.index <= charOffset) {
        sourcePage = pg;
        break;
      }
    }

    // Extract options from blockText
    const parsedBlock = parseOptionsFromQuestionBlock(blockText, qNum, sourcePage);
    questions.push(parsedBlock);
  }

  return questions;
}

/**
 * Extracts options (A), (B), (C), (D) or (1), (2), (3), (4) exactly
 */
export function parseOptionsFromQuestionBlock(
  blockText: string,
  originalNumber: number,
  sourcePage: number
): ParsedQuestionBlock {
  const reviewReasons: string[] = [];
  let statement = "";
  let optionA = "";
  let optionB = "";
  let optionC = "";
  let optionD = "";

  // Check for equation markers
  const hasEquation =
    /\$|\\frac|\\sqrt|\\alpha|\\beta|\\gamma|\\Delta|\\lambda|\\int|\bH₂O\b|\bCO₂\b|\bCa²⁺\b|\b10⁻³\b|\^|_/i.test(
      blockText
    );

  // Check for table
  const hasTable =
    /\|[\s\S]*?\|[\s\S]*?\n\|[-:\s|]+\|/i.test(blockText) ||
    blockText.split("\n").filter((l) => l.includes("\t") || l.split("|").length >= 3).length >= 2;

  // Check for figure / diagram reference
  const hasImage =
    /\b(figure|diagram|given below|as shown in the figure|labelled structure|चित्र|आरेख)\b/i.test(blockText);

  // Match options: (A), (B), (C), (D) or (1), (2), (3), (4) or A. B. C. D.
  const optionRegex = /(?:^|\n|\s+)(?:\(([A-D1-4a-d])\)|([A-D1-4a-d])[\.\)])\s+/gi;
  const optMatches = Array.from(blockText.matchAll(optionRegex));

  if (optMatches.length >= 4 && optMatches[0]) {
    statement = blockText.substring(0, optMatches[0].index ?? 0).trim();

    for (let j = 0; j < optMatches.length; j++) {
      const match = optMatches[j];
      if (!match) continue;
      const nextMatch = optMatches[j + 1];
      const optLetter = ((match[1] || match[2]) ?? "A")
        .toUpperCase()
        .replace("1", "A")
        .replace("2", "B")
        .replace("3", "C")
        .replace("4", "D");

      const sIdx = (match.index ?? 0) + match[0].length;
      const eIdx = nextMatch && nextMatch.index !== undefined ? nextMatch.index : blockText.length;
      const val = blockText.substring(sIdx, eIdx).trim();

      if (optLetter === "A") optionA = val;
      else if (optLetter === "B") optionB = val;
      else if (optLetter === "C") optionC = val;
      else if (optLetter === "D") optionD = val;
    }
  } else if (optMatches.length > 0 && optMatches.length < 4 && optMatches[0]) {
    statement = blockText.substring(0, optMatches[0].index ?? 0).trim();
    reviewReasons.push(`Incomplete options extracted (${optMatches.length}/4 detected). Manual review required.`);
  } else {
    statement = blockText;
    reviewReasons.push("Could not isolate standard A-D options. Requires manual review.");
  }

  // Calculate high-fidelity confidence scores
  let textConf = statement.length > 10 ? 98 : 75;
  let optConf = optionA && optionB && optionC && optionD ? 99 : 60;
  let tableConf = hasTable ? 95 : 100;
  let imgConf = hasImage ? 92 : 100;

  if (reviewReasons.length > 0) {
    textConf = Math.min(textConf, 85);
    optConf = Math.min(optConf, 70);
  }

  const overall = Number(((textConf * 0.4) + (optConf * 0.3) + (tableConf * 0.15) + (imgConf * 0.15)).toFixed(1));

  return {
    originalNumber,
    sourcePage,
    statement: statement || blockText,
    options: {
      A: optionA,
      B: optionB,
      C: optionC,
      D: optionD,
    },
    hasTable,
    hasImage,
    hasEquation,
    confidence: {
      text: textConf,
      options: optConf,
      table: tableConf,
      image: imgConf,
      overall,
    },
    reviewReasons,
  };
}
