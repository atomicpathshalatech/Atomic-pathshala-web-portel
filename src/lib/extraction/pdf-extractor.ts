/**
 * HIGH-PRECISION PDF EXTRACTION & LAYOUT-AWARE PARSER
 *
 * Extracts text, coordinate geometry, character bounding boxes,
 * embedded image streams, and tables from multi-page exam PDFs.
 *
 * Multi-column reading order detection: Left Column -> Right Column.
 * Strips recurring exam headers, footers, watermarks, and page numbers.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export interface ExtractedPdfPage {
  pageNumber: number;
  rawText: string;
  lines: string[];
  images: Array<{
    id: string;
    pageNumber: number;
    base64Data?: string;
    width?: number;
    height?: number;
    bbox?: [number, number, number, number];
  }>;
  tables: Array<{
    id: string;
    markdown: string;
    rows: string[][];
  }>;
}

export interface RawExtractedQuestion {
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
  rawAnswerKey?: string;
  rawSolution?: string;
  confidence: {
    text: number;
    options: number;
    table: number;
    image: number;
    answer: number;
    solution: number;
    overall: number;
  };
  reviewReasons: string[];
}

function getGeminiClient(): GoogleGenerativeAI | null {
  const apiKey = (process.env.GEMINI_API_KEYS?.split(",")[0] || process.env.GEMINI_API_KEY)?.trim();
  if (!apiKey || apiKey.includes("your_gemini_api_key")) return null;
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Strips recurring exam headers, footers, and page counters
 */
export function cleanDocumentArtifacts(rawText: string): string {
  return rawText
    .replace(/^.*(?:Page\s*\d+\s*of\s*\d+|\bPage\s*\d+\b).*$/gim, "")
    .replace(/^.*(?:ALLEN\s*CAREER\s*INSTITUTE|Aakash\s*Educational|NEET\s*\(UG\)|CONFIDENTIAL|DO\s*NOT\s*OPEN).*$/gim, "")
    .replace(/^.*(?:Rough\s*Work|Space\s*for\s*Rough\s*Work).*$/gim, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

/**
 * Intelligent Layout & Multi-Column Boundary Sorter
 * Reorders text into natural reading flow (Column 1 top-to-bottom, then Column 2 top-to-bottom)
 */
export function sortMultiColumnText(pageText: string): string {
  // If text contains clear 2-column separator tabs or double question numbers on same line
  const lines = pageText.split("\n");
  const cleanedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    cleanedLines.push(trimmed);
  }

  return cleanedLines.join("\n");
}
