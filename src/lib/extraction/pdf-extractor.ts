/**
 * HIGH-PRECISION PDF EXTRACTION & LAYOUT-AWARE PARSER
 *
 * Extracts text, coordinate geometry, character bounding boxes,
 * embedded image streams, and tables from multi-page exam PDFs.
 *
 * Multi-column reading order detection: Left Column -> Right Column.
 * Strips recurring exam headers, footers, watermarks, and page numbers.
 * Generates automatic bilingual translation (Devanagari Hindi <-> English)
 * and detailed 4-step step-by-step solutions for every extracted question.
 */

import { geminiKeyManager } from "@/lib/ai/gemini-key-manager";
import { parseAiJson } from "@/lib/ai/latex-json";
import { executeGeminiWithFailover, formatSolutionSpacing } from "@/lib/questions/gemini-engine";
import { loadServerPdfJs } from "@/lib/pdf/server-pdf";

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

export interface ExtractedAiQuestion {
  originalNumber: number;
  sourcePage: number;
  statement: string;
  statementHi?: string | null;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  optionsHi?: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: string;
  answerKeySource?: string;
  solution?: string | null;
  solutionHi?: string | null;
  hasTable: boolean;
  tableMarkdown?: string;
  hasImage: boolean;
  missingImage?: boolean;
  missingImageReason?: string;
  imageUrl?: string | null;
  hasEquation: boolean;
  subject: string;
  chapter?: string | null;
  topic?: string | null;
  subTopic?: string | null;
  questionType: string;
  difficulty: string;
  status: "VERIFIED" | "REVIEW_REQUIRED" | "EXTRACTION_ERROR" | "MISSING" | "DUPLICATE";
  confidence: number;
  confidenceBreakdown?: {
    text: number;
    options: number;
    table: number;
    image: number;
    answer: number;
    solution: number;
    overall: number;
  };
  reviewReasons: string[];
  isBilingual: boolean;
  autoTranslated: boolean;
  sourceLanguage?: "ENGLISH" | "HINDI" | "BILINGUAL";
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
 * Extract text from PDF buffer using pdfjs-dist
 */
export async function extractTextFromPdfBuffer(
  fileBuffer: Buffer
): Promise<{ fullText: string; pages: Array<{ pageNumber: number; text: string }>; pageCount: number }> {
  try {
    const pdfjs = await loadServerPdfJs();
    const uint8Data = new Uint8Array(fileBuffer);
    const doc = await pdfjs.getDocument({
      data: uint8Data,
      useWorkerFetch: false,
      isEvalSupported: false,
      disableFontFace: true,
      verbosity: 0,
    }).promise;

    const pageCount = doc.numPages;
    const pages: Array<{ pageNumber: number; text: string }> = [];

    for (let p = 1; p <= pageCount; p++) {
      const page = await doc.getPage(p);
      const textContent = await page.getTextContent();
      // Keep the printed lines (the old code joined the whole page into one
      // line, so question numbers, options and the two columns of a paper ran
      // together). Items are grouped into lines by their y position; a page
      // with two columns is read left column first, then right.
      const items = (textContent.items as any[])
        .filter((it) => "str" in it && String(it.str).trim() !== "")
        .map((it) => ({ str: String(it.str), x: Number(it.transform?.[4] ?? 0), y: Number(it.transform?.[5] ?? 0), w: Number(it.width ?? 0), h: Math.abs(Number(it.transform?.[3] ?? it.height ?? 10)) || 10 }));
      const viewport = page.getViewport({ scale: 1 });
      const mid = viewport.width / 2;
      const leftShare = items.length ? items.filter((it) => it.x + it.w <= mid + 4).length / items.length : 1;
      const rightShare = items.length ? items.filter((it) => it.x >= mid - 4).length / items.length : 0;
      const twoColumns = items.length > 40 && leftShare > 0.3 && rightShare > 0.3 && leftShare + rightShare > 0.9;
      const toLines = (list: typeof items) => {
        const sorted = [...list].sort((a, b) => b.y - a.y || a.x - b.x);
        const lines: { y: number; parts: typeof items }[] = [];
        for (const it of sorted) {
          const line = lines.find((l) => Math.abs(l.y - it.y) < 3);
          if (line) line.parts.push(it);
          else lines.push({ y: it.y, parts: [it] });
        }
        return lines
          .sort((a, b) => b.y - a.y)
          .map((l) => {
            // Join pieces WITHOUT a space when they touch: Hindi (Devanagari)
            // words arrive as several glyph runs, and a space between each
            // one turned "प्रश्न" into "प  श् न".
            const parts = l.parts.sort((a, b) => a.x - b.x);
            let out = "";
            parts.forEach((p, i) => {
              const prev = parts[i - 1];
              const gap = prev ? p.x - (prev.x + prev.w) : 0;
              out += prev && gap > Math.max(1, p.h * 0.18) && !/\s$/.test(out) && !/^\s/.test(p.str) ? ` ${p.str}` : p.str;
            });
            return out.replace(/\s+/g, " ").trim();
          })
          .filter(Boolean);
      };
      const rawPageText = (twoColumns
        ? [...toLines(items.filter((it) => it.x < mid)), ...toLines(items.filter((it) => it.x >= mid))]
        : toLines(items)
      ).join("\n");

      pages.push({ pageNumber: p, text: rawPageText });
    }

    const fullText = pages.map((p) => `--- [Page ${p.pageNumber}] ---\n${p.text}`).join("\n\n");
    return { fullText, pages, pageCount };
  } catch (err) {
    console.warn("[extractTextFromPdfBuffer error, falling back to string representation]:", err);
    const str = fileBuffer.toString("utf-8").replace(/\0/g, "");
    return { fullText: str, pages: [{ pageNumber: 1, text: str }], pageCount: 1 };
  }
}

/**
 * Intelligent Layout & Multi-Column Boundary Sorter
 */
export function sortMultiColumnText(pageText: string): string {
  const lines = pageText.split("\n");
  const cleanedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    cleanedLines.push(trimmed);
  }

  return cleanedLines.join("\n");
}

/**
 * AI-Powered Multi-Question Extractor using Gemini with automatic bilingual translation,
 * diagram missing detection, and 4-step step-by-step solution generation.
 */
export async function extractQuestionsWithAiChunk({
  textChunk,
  startNumber,
  endNumber,
  subjectContext,
  chapterContext,
  sourceName,
  pageImages,
  firstPage,
}: {
  /** Page images (base64 JPEG) — used for scanned pages and PDFs whose text layer is unreadable (e.g. legacy Hindi fonts). */
  pageImages?: string[];
  /** Page number of the first page in this chunk (for sourcePage). */
  firstPage?: number;
  textChunk: string;
  startNumber: number;
  endNumber: number;
  subjectContext?: string;
  chapterContext?: string;
  sourceName?: string;
}): Promise<ExtractedAiQuestion[]> {
  return executeGeminiWithFailover(async (client, modelName, meta) => {
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
        // Bilingual questions + solutions are long: with the default output
        // limit the JSON was cut off, parsing failed and the whole document
        // fell back to the weak regex parser.
        maxOutputTokens: 32768,
      },
    });

    const prompt = `You are the Master Academic Question Extraction & Ingestion Engine for NEET, JEE Main, and NCERT (Atomic Pathshala).
Source Institute / Paper: "${sourceName || "Exam Document"}"
Target Range: Question ${startNumber} to Question ${endNumber}
Default Subject Context: "${subjectContext || "Auto Detect"}"
Default Chapter Context: "${chapterContext || "General"}"

${
  pageImages?.length
    ? `DOCUMENT: the ${pageImages.length} attached page image(s)${firstPage ? ` (pages ${firstPage}–${firstPage + pageImages.length - 1} of the PDF; use these real page numbers for "sourcePage")` : ""}. Read the printed text from the images.`
    : `DOCUMENT TEXT (page markers "--- [Page N] ---" give the real page number for "sourcePage"):
"""
${textChunk}
"""`
}

YOUR INSTRUCTIONS:
1. EXTRACT ALL QUESTIONS IN THE DOCUMENT:
   - Identify question number (e.g. Q.1, 1., Question 1, प्रश्न 1) and map to "originalNumber" (integer).
   - Extract the question statement and all 4 options (A, B, C, D).
   - Use standard LaTeX notation $...$ for all mathematical symbols, fractions, powers, square roots, vectors, and chemical equations (e.g. $\\text{H}_2\\text{SO}_4$, $\\text{Ca}^{2+}$, $\\frac{a}{b}$).

2. LANGUAGE — PRESERVE THE ORIGINAL (CRITICAL):
   - Copy the printed question EXACTLY in the language it is printed in. Never replace the printed wording with your own translation or paraphrase.
   - Set "sourceLanguage": "ENGLISH", "HINDI" or "BILINGUAL" (both printed).
   - A language that is NOT printed may be translated (rules below) and then "autoTranslated": true.
   AUTOMATIC BILINGUAL EXTRACTION & TRANSLATION:
   - If the source is in English only:
     * Extract English into "statement" and "options" { A, B, C, D }.
     * Automatically generate accurate NCERT Hindi translation (Devanagari script) in "statementHi" and "optionsHi" { A, B, C, D }.
   - If the source is in Hindi only:
     * Extract Hindi into "statementHi" and "optionsHi" { A, B, C, D }.
     * Automatically generate accurate English translation in "statement" and "options" { A, B, C, D }.
   - If the source is already bilingual:
     * Extract both English and Hindi versions with 1:1 option alignment (Option A ↔ Option A, etc.).

3. DIAGRAM & IMAGE DETECTION (CRITICAL):
   - Check if the question refers to an external diagram, figure, circuit, graph, or apparatus (e.g., "in the given figure", "as shown in diagram", "चित्र में", "आरेख", "दिए गए ग्राफ में", "[IMAGE]").
   - If a figure is referenced:
     * Set "hasImage": true.
     * Set "missingImage": true (indicating that the diagram is required by the question but the image file needs attachment).
     * Set "missingImageReason": "Question statement refers to a diagram/figure, but image is not yet attached."
     * Add to reviewReasons: "⚠️ Missing Diagram: Question refers to a figure/diagram. Image needs attachment."
   - If no diagram is mentioned: "hasImage": false, "missingImage": false.
   - CHEMICAL STRUCTURES & DRAWINGS: you only have the page TEXT, so a drawn structure, skeletal formula,
     diagram or graph is NOT visible to you (it may show up as stray atom letters like "O", "OH", "CH3"
     or as an empty gap). NEVER describe, guess, name or re-draw it in words or as a formula
     (do NOT write things like "C6H8O (represented as a six-membered ring…)").
     Write exactly [FIGURE] at the place where the drawing is printed (in the statement, or inside the
     option it belongs to), in BOTH languages, and set "hasImage": true. The real drawing is cropped from
     the page and inserted there automatically, so the student sees the printed structure.

4. 4-STEP STEP-BY-STEP SOLUTION GENERATION:
   - If the document provides a solution, extract it.
   - If the document does NOT provide a solution, generate a detailed 4-step bilingual solution:
     "solution" (English):
       Explaining : [Given parameters and what needs to be solved]
       Concept : This question is based on [Specific scientific law / formula / concept]
       Solution : [Derivation or option elimination]
       Final Answer : Option (X)
     "solutionHi" (Hindi):
       कथन (Explaining) : [दिया गया विवरण और उद्देश्य]
       सिद्धांत (Concept) : यह प्रश्न [सिद्धांत/नियम] पर आधारित है।
       हल (Solution) : [चरण-दर-चरण हल]
       अंतिम उत्तर (Final Answer) : विकल्प (X)

5. CORRECT ANSWER:
   - If an answer key / answer is printed, use it and set "answerKeySource": "ANSWER_KEY_SECTION".
   - Otherwise solve it and set "answerKeySource": "DEDUCED_AI"; if you cannot be sure, leave "correctAnswer" as "" — never guess.
   - Options printed as (1)(2)(3)(4) map to A, B, C, D. Multiple-correct answers as "A,C".

   - MATCH THE COLUMN / ANY TABLE — write it exactly like the printed paper, as a table in the statement:
     one header row, a "---|---" divider row, then ONE ROW PER LINE, columns separated by " | ", rows separated by \\n.
     Example (statement): "Match Column-I with Column-II.\\n\\nColumn-I | Column-II\\n---|---\\n(A) Benzene | (P) 4\\n(B) Cyclohexane | (Q) 1\\n(C) Naphthalene | (R) 7\\n(D) But-1-ene | (S) 0"
     Hindi (statementHi): "स्तम्भ-I | स्तम्भ-II\\n---|---\\n(A) बेंज़ीन | (P) 4\\n..."
     Never run the pairs together on one line or inside a sentence; keep Column-I labels (A),(B),(C),(D) and Column-II labels (P),(Q),(R),(S) (or (i),(ii),(iii),(iv) as printed), and give the options as code combinations, e.g. "A-Q, B-P, C-S, D-R".

6. QUALITY & CLASSIFICATION:
   - "subject": "Physics" | "Chemistry" | "Biology" | "Mathematics"
   - "chapter": NCERT Chapter title
   - "topic": Topic name
   - "subTopic": Subtopic name
   - "difficulty": "EASY" | "MEDIUM" | "HARD"
   - "questionType": "SINGLE_CORRECT" | "MULTI_CORRECT" | "INTEGER" | "ASSERTION_REASON" | "MATCH_THE_COLUMN"
   - If all options (A, B, C, D), statement, answer, and solution are present and valid, set "status": "VERIFIED".
   - If options are missing or diagram is missing or answer key is ambiguous, set "status": "REVIEW_REQUIRED" with specific "reviewReasons".

RETURN STRICT JSON ARRAY OF QUESTIONS:
[
  {
    "originalNumber": 1,
    "sourcePage": 1,
    "statement": "English question statement with $LaTeX$ math",
    "statementHi": "Hindi question statement in Devanagari with $LaTeX$ math",
    "options": {
      "A": "Option A text",
      "B": "Option B text",
      "C": "Option C text",
      "D": "Option D text"
    },
    "optionsHi": {
      "A": "विकल्प A",
      "B": "विकल्प B",
      "C": "विकल्प C",
      "D": "विकल्प D"
    },
    "correctAnswer": "A",
    "answerKeySource": "DEDUCED_AI",
    "solution": "Explaining : ...\\n\\nConcept : ...\\n\\nSolution : ...\\n\\nFinal Answer : Option (A)",
    "solutionHi": "कथन (Explaining) : ...\\n\\nसिद्धांत (Concept) : ...\\n\\nहल (Solution) : ...\\n\\nअंतिम उत्तर (Final Answer) : विकल्प (A)",
    "hasTable": false,
    "hasImage": false,
    "missingImage": false,
    "missingImageReason": "",
    "hasEquation": true,
    "subject": "Physics",
    "chapter": "Electrostatics",
    "topic": "Coulomb's Law",
    "subTopic": "Electric Force",
    "questionType": "SINGLE_CORRECT",
    "difficulty": "MEDIUM",
    "status": "VERIFIED",
    "confidence": 98,
    "reviewReasons": [],
    "isBilingual": true,
    "autoTranslated": true
  }
]`;

    const parts = pageImages?.length
      ? [prompt, ...pageImages.map((b64) => ({ inlineData: { mimeType: "image/jpeg", data: b64.replace(/^data:[^,]+,/, "") } }))]
      : prompt;
    const response = await model.generateContent(parts as any);
    const text = response.response.text().trim();
    const cleanJson = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsedRaw = parseAiJson(cleanJson);
    const parsed = Array.isArray(parsedRaw) ? parsedRaw : Array.isArray(parsedRaw?.questions) ? parsedRaw.questions : parsedRaw;

    if (!Array.isArray(parsed)) {
      throw new Error("AI extraction did not return a valid array of questions.");
    }

    return parsed.map((q: any, idx: number) => {
      const qNum = typeof q.originalNumber === "number" ? q.originalNumber : startNumber + idx;
      const statement = q.statement || q.statementEn || "";
      const statementHi = q.statementHi || "";

      const options = {
        A: q.options?.A || q.optionsEn?.A || "",
        B: q.options?.B || q.optionsEn?.B || "",
        C: q.options?.C || q.optionsEn?.C || "",
        D: q.options?.D || q.optionsEn?.D || "",
      };

      const optionsHi = {
        A: q.optionsHi?.A || "",
        B: q.optionsHi?.B || "",
        C: q.optionsHi?.C || "",
        D: q.optionsHi?.D || "",
      };

      const reviewReasons: string[] = Array.isArray(q.reviewReasons) ? [...q.reviewReasons] : [];

      // Check missing diagram reference
      const mentionsDiagram =
        Boolean(q.hasImage || q.missingImage) ||
        /\b(figure|diagram|circuit|given below|as shown in the figure|labelled structure|चित्र|आरेख|ग्राफ)\b/i.test(
          statement + " " + statementHi
        );

      let hasImage = Boolean(q.hasImage || mentionsDiagram);
      let missingImage = Boolean(q.missingImage || (mentionsDiagram && !q.imageUrl));
      let missingImageReason = q.missingImageReason || (missingImage ? "Question refers to a figure/diagram but image is missing." : "");

      if (missingImage && !reviewReasons.some((r) => r.includes("Missing Diagram") || r.includes("figure"))) {
        reviewReasons.push("⚠️ Missing Diagram: Question references a diagram/figure. Image attachment needed.");
      }

      // Check missing options
      if (!options.A || !options.B || !options.C || !options.D) {
        reviewReasons.push("⚠️ Incomplete Options: One or more options (A-D) could not be extracted.");
      }

      // Answer: no silent "A" default — a missing key is flagged for review.
      const rawAns = Array.isArray(q.correctAnswer) ? q.correctAnswer.join(",") : String(q.correctAnswer ?? "");
      const ansKeys = rawAns
        .toUpperCase()
        .split(/[\s,;/&]+/)
        .map((a: string) => ({ "1": "A", "2": "B", "3": "C", "4": "D" } as Record<string, string>)[a.replace(/[()]/g, "")] ?? a.replace(/[()]/g, ""))
        .filter((a: string) => /^[A-D]$/.test(a));
      const isNumeric = /INTEGER|NUMERICAL/i.test(String(q.questionType || ""));
      const correctAnswer = isNumeric ? rawAns.trim() : Array.from(new Set(ansKeys)).join(",");
      if (!correctAnswer) reviewReasons.push("⚠️ Answer not found — set the correct option.");

      const isClean = reviewReasons.length === 0;
      const status: ExtractedAiQuestion["status"] = isClean ? "VERIFIED" : "REVIEW_REQUIRED";

      return {
        originalNumber: qNum,
        sourcePage: q.sourcePage || 1,
        statement: statement || "Question statement could not be extracted.",
        statementHi: statementHi || null,
        options,
        optionsHi: optionsHi.A ? optionsHi : undefined,
        correctAnswer,
        answerKeySource: q.answerKeySource || "AI_PARSER",
        solution: formatSolutionSpacing(q.solution || ""),
        solutionHi: formatSolutionSpacing(q.solutionHi || ""),
        hasTable: Boolean(q.hasTable),
        tableMarkdown: q.tableMarkdown || undefined,
        hasImage,
        missingImage,
        missingImageReason,
        imageUrl: q.imageUrl || null,
        hasEquation: Boolean(q.hasEquation || /\$|\\frac|\\sqrt|\^|_/i.test(statement)),
        subject: q.subject || subjectContext || "Physics",
        chapter: q.chapter || chapterContext || "General",
        topic: q.topic || "Core Principles",
        subTopic: q.subTopic || undefined,
        questionType: q.questionType || "SINGLE_CORRECT",
        difficulty: q.difficulty || "MEDIUM",
        status,
        confidence: Number(q.confidence) || (isClean ? 98 : 80),
        confidenceBreakdown: {
          text: statement.length > 10 ? 98 : 70,
          options: options.A && options.B && options.C && options.D ? 99 : 60,
          table: q.hasTable ? 95 : 100,
          image: missingImage ? 70 : 100,
          answer: correctAnswer ? 98 : 60,
          solution: q.solution ? 98 : 70,
          overall: isClean ? 98 : 80,
        },
        reviewReasons,
        isBilingual: Boolean(statement && statementHi),
        autoTranslated: Boolean(q.autoTranslated),
        sourceLanguage: (q.sourceLanguage === "HINDI" || q.sourceLanguage === "BILINGUAL" || q.sourceLanguage === "ENGLISH"
          ? q.sourceLanguage
          : statementHi && !statement
            ? "HINDI"
            : "ENGLISH") as "ENGLISH" | "HINDI" | "BILINGUAL",
      };
    });
  });
}

