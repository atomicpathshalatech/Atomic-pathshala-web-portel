import { executeGeminiWithFailover } from "@/lib/questions/gemini-engine";
import { NCERTLanguage, NCERTQuestionType } from "@prisma/client";

export interface CandidateNcertQuestion {
  questionType: NCERTQuestionType;
  question: string;
  options: { id: "A" | "B" | "C" | "D"; text: string }[];
  correctAnswer: "A" | "B" | "C" | "D";
  explanation: string;
  sourceTextReference: string;
  sourceImageReference?: string | null;

  // Canonical Atomic Guru Fields
  assertionText?: string;
  reasonText?: string;
  statements?: string[];
  columnI?: { label: string; text: string }[];
  columnII?: { label: string; text: string }[];
  columnIII?: { label: string; text: string }[];
  sequenceItems?: { label: string; text: string }[];
  tableHeaders?: string[];
  tableRows?: string[][];
  passage?: string;
  imageRequired?: boolean;
  imageDescription?: string;

  // 4-Part Structured Solution Fields
  explainQuestion?: string;
  concept?: string;
  solution?: string;
  finalAnswer?: string;
}

export interface GeneratePageQuestionsParams {
  pageNumber: number;
  chapterTitle: string;
  subjectName: string;
  className: string;
  language: NCERTLanguage;
  pageText: string;
  pageImageUrl?: string | null;
  elementsSummary?: string;
  targetCount?: number;
  excludeQuestions?: string[]; // Questions to avoid repeating for reattempts
}

export async function generatePageQuestions(
  params: GeneratePageQuestionsParams
): Promise<CandidateNcertQuestion[]> {
  const {
    pageNumber,
    chapterTitle,
    subjectName,
    className,
    language,
    pageText,
    pageImageUrl,
    elementsSummary,
    targetCount = 5,
    excludeQuestions = [],
  } = params;

  if (!pageText || pageText.trim().length < 40) {
    return [];
  }

  const isHindi = language === "HINDI";
  const hasPageImage = Boolean(pageImageUrl);
  const hasDiagramCaption =
    /fig(ure)?[\.\s]+\d+|चित्र[\.\s]*\d+/i.test(pageText) ||
    (elementsSummary && /diagram|figure|चित्र/i.test(elementsSummary));
  const canSupportDiagram = hasPageImage && Boolean(hasDiagramCaption);

  const systemPrompt = isHindi
    ? `आप NCERT आधारित NEET/Board परीक्षा अभ्यास प्रश्न तैयार करने वाले एक अत्यंत सख्त एवं सटीक विशेषज्ञ हैं।
आप Atomic Guru के प्रामाणिक प्रश्न प्रारूप (Canonical Question Schema) का अक्षरशः पालन करते हैं।

सख्त स्रोत सीमा नियम (STRICT SOURCE BOUNDARY):
1. आपको केवल और केवल दिए गए "NCERT PAGE CONTENT" का उपयोग करना है।
2. पिछले पृष्ठों, अगले पृष्ठों, पूरे अध्याय के अन्य भागों, या बाहरी ज्ञान (general model knowledge) से कोई भी तथ्य न जोड़ें।
3. प्रत्येक प्रश्न, चारों विकल्प और सही उत्तर का सटीक प्रमाण (proof) इसी पृष्ठ के पाठ (text) में मौजूद होना चाहिए।
4. यदि इस पृष्ठ पर केवल 2, 3 या 4 वैध प्रश्न ही बन सकते हैं, तो केवल उतने ही प्रश्न बनाएं। 5 का कोटा पूरा करने के लिए कोई भी मनगढ़ंत या अपुष्ट प्रश्न बिल्कुल न बनाएं। (सटीकता > संख्या)
5. यदि इस पृष्ठ पर कोई वैध प्रश्न नहीं बन सकता, तो खाली सूची [] लौटाएं।
6. भाषा नियम: संपूर्ण प्रश्न, विकल्प A, B, C, D, स्पष्टीकरण और उद्धरण शुद्ध हिंदी में होने चाहिए।
7. प्रत्येक प्रश्न में निश्चित रूप से केवल 1 सही विकल्प (A, B, C, या D) होना चाहिए।
8. sourceTextReference में इस पृष्ठ का वह सटीक वाक्य या वाक्यांश उद्धृत करें जो सही उत्तर को प्रमाणित करता है।
9. 4-भाग संरचित समाधान (4-Part Structured Solution):
   - explainQuestion: प्रश्न क्या पूछ रहा है उसका स्पष्ट विश्लेषण
   - concept: मुख्य NCERT संकल्पना / सिद्धांत
   - solution: चरणबद्ध तार्किक व्याख्या (Step-by-Step Solution)
   - finalAnswer: अंतिम उत्तर विकल्प एवं उसका अर्थ`
    : `You are an elite, highly rigorous NCERT NEET practice question generation engine.
You strictly adhere to Atomic Guru's canonical question schema and formats.

STRICT SOURCE BOUNDARY RULES:
1. Use ONLY and EXCLUSIVELY the provided "NCERT PAGE CONTENT".
2. Do NOT use facts from previous pages, subsequent pages, other parts of the book, or outside AI knowledge.
3. Every question, all four options (A, B, C, D), and the correct answer must be directly and indisputably supported by the provided page text.
4. TARGET: Up to ${targetCount} high-yield questions. If the page only supports 2, 3, or 4 reliable questions, produce ONLY those. NEVER fabricate or force-generate a question just to reach the quota. ACCURACY > QUANTITY.
5. If the page does not support any valid questions, return an empty array [].
6. LANGUAGE: 100% in ${isHindi ? "Hindi" : "English"} using standard NCERT terminology.
7. EXACTLY ONE correct option (A, B, C, or D). Zero ambiguity.
8. sourceTextReference: Must quote the EXACT sentence or paragraph from this page that proves the correct answer.
9. 4-PART STRUCTURED SOLUTION: Every question must contain:
   - explainQuestion: Clear explanation of what the question is asking and testing.
   - concept: The core NCERT principle, rule, or mechanism being applied.
   - solution: Step-by-step reasoning evaluating the options.
   - finalAnswer: Concise summary of the correct option and final conclusion.`;

  const userPrompt = `
CONTEXT:
- Class: ${className}
- Subject: ${subjectName}
- Chapter: ${chapterTitle}
- Page Number: ${pageNumber}
- Language: ${language}
- Page Image Available: ${hasPageImage ? "YES" : "NO"}
${elementsSummary ? `- Detected Elements on this page: ${elementsSummary}` : ""}

EXCLUDE / DO NOT REPEAT THESE QUESTIONS (PREVIOUSLY PRACTICED):
${excludeQuestions.length > 0 ? excludeQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n") : "None"}

==================================================
EXACT NCERT PAGE CONTENT (PAGE ${pageNumber}):
==================================================
${pageText}
==================================================

TASK:
Generate up to ${targetCount} unique, high-quality, NEET-relevant NCERT practice questions derived strictly from the text above.

Supported Question Types & Atomic Guru Canonical Schemas:
1. SINGLE_CORRECT_MCQ / CONCEPTUAL_MCQ: Standard 4 options A, B, C, D.
2. ASSERTION_REASON:
   - Provide "assertionText" (Assertion A) and "reasonText" (Reason R) as distinct fields.
   - Options must follow standard NEET Assertion-Reason format:
     A: Both (A) and (R) are true and (R) is the correct explanation of (A)
     B: Both (A) and (R) are true but (R) is NOT the correct explanation of (A)
     C: (A) is true but (R) is false
     D: (A) is false but (R) is true (or both are false)
3. STATEMENT_BASED:
   - Provide "statements": ["Statement I: ...", "Statement II: ..."]
   - Options choose which statements are correct/incorrect.
4. MATCH_FOLLOWING:
   - Provide "columnI": [{"label": "A", "text": "..."}, {"label": "B", "text": "..."}]
   - Provide "columnII": [{"label": "p", "text": "..."}, {"label": "q", "text": "..."}]
   - Options represent combinations (e.g., A-q, B-p, etc.)
5. DIAGRAM_BASED:
   ${
     canSupportDiagram
       ? `ONLY if a specific figure caption exists on this page. Provide "imageRequired": true and "imageDescription": "Caption/Name of the figure from this page".`
       : `STRICT PROHIBITION: No verified diagram image is available for this page. DO NOT generate DIAGRAM_BASED questions! Generate CONCEPTUAL_MCQ, SINGLE_CORRECT_MCQ, ASSERTION_REASON, or STATEMENT_BASED instead.`
   }

OUTPUT FORMAT:
Respond with ONLY valid JSON adhering to this exact schema (no markdown fences, no other text):
[
  {
    "questionType": "SINGLE_CORRECT_MCQ" | "ASSERTION_REASON" | "STATEMENT_BASED" | "MATCH_FOLLOWING" | "DIAGRAM_BASED" | "CONCEPTUAL_MCQ",
    "question": "Question statement or premise",
    "assertionText": "Assertion text if ASSERTION_REASON else omit or null",
    "reasonText": "Reason text if ASSERTION_REASON else omit or null",
    "statements": ["Statement I: ...", "Statement II: ..."] (only if STATEMENT_BASED else omit),
    "columnI": [{"label": "A", "text": "..."}] (only if MATCH_FOLLOWING else omit),
    "columnII": [{"label": "1", "text": "..."}] (only if MATCH_FOLLOWING else omit),
    "imageRequired": true/false,
    "imageDescription": "Figure caption if DIAGRAM_BASED else null",
    "options": [
      { "id": "A", "text": "Option A" },
      { "id": "B", "text": "Option B" },
      { "id": "C", "text": "Option C" },
      { "id": "D", "text": "Option D" }
    ],
    "correctAnswer": "A" | "B" | "C" | "D",
    "explanation": "Clear solution",
    "explainQuestion": "What the question asks",
    "concept": "NCERT Core Concept",
    "solution": "Step-by-step reasoning",
    "finalAnswer": "Final option and conclusion",
    "sourceTextReference": "Exact quote from this page confirming the answer",
    "sourceImageReference": null
  }
]
`;

  try {
    const rawResponse = await executeGeminiWithFailover(async (client, modelName) => {
      const model = client.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.2, // Low temperature for high factual grounding
          topP: 0.8,
          maxOutputTokens: 4000,
          responseMimeType: "application/json",
        },
      });

      const response = await model.generateContent([
        { text: systemPrompt },
        { text: userPrompt },
      ]);

      return response.response.text();
    });

    let cleaned = rawResponse
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    // Extract outer array if there's any commentary
    const firstBracket = cleaned.indexOf("[");
    const lastBracket = cleaned.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      cleaned = cleaned.substring(firstBracket, lastBracket + 1);
    }

    let parsed: any[] = [];
    try {
      parsed = JSON.parse(cleaned);
    } catch (_) {
      try {
        // Replace unescaped newlines/tabs inside strings
        const sanitized = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, (c) => {
          if (c === "\n") return "\\n";
          if (c === "\r") return "";
          if (c === "\t") return "\\t";
          return "";
        });
        parsed = JSON.parse(sanitized);
      } catch (err2) {
        // If string was truncated, attempt to close array at the last valid object
        const lastObjEnd = cleaned.lastIndexOf("}");
        if (lastObjEnd !== -1) {
          try {
            const truncated = cleaned.substring(0, lastObjEnd + 1) + "\n]";
            parsed = JSON.parse(truncated);
          } catch (_) {
            console.warn("[NCERT AI Generator] JSON parse failed after recovery attempts");
          }
        }
      }
    }

    if (!Array.isArray(parsed)) {
      return [];
    }

    const validatedCandidates: CandidateNcertQuestion[] = [];
    for (const item of parsed) {
      if (!item.question || !item.options || !Array.isArray(item.options)) continue;
      if (item.options.length !== 4) continue;
      if (!["A", "B", "C", "D"].includes(item.correctAnswer)) continue;
      if (!item.sourceTextReference || typeof item.sourceTextReference !== "string") continue;

      const formattedOptions = item.options.map((opt: any, idx: number) => {
        const letter = ["A", "B", "C", "D"][idx] as "A" | "B" | "C" | "D";
        return {
          id: (opt.id || letter) as "A" | "B" | "C" | "D",
          text: String(opt.text || "").trim(),
        };
      });

      // Ensure all 4 options have non-empty text
      if (formattedOptions.some((o: { text: string }) => !o.text)) continue;

      let qType: NCERTQuestionType = NCERTQuestionType.SINGLE_CORRECT_MCQ;
      if (Object.values(NCERTQuestionType).includes(item.questionType)) {
        qType = item.questionType as NCERTQuestionType;
      }

      // Diagram question safety check: If model generated DIAGRAM_BASED but no page image is present,
      // downgrade to SINGLE_CORRECT_MCQ or reject diagram requirement so visual fidelity is maintained.
      let imageRequired = Boolean(item.imageRequired || qType === NCERTQuestionType.DIAGRAM_BASED);
      let sourceImageReference = item.sourceImageReference ? String(item.sourceImageReference) : null;
      let imageDescription = item.imageDescription ? String(item.imageDescription).trim() : undefined;

      if (imageRequired) {
        if (!hasPageImage) {
          imageRequired = false;
          if (qType === NCERTQuestionType.DIAGRAM_BASED) {
            qType = NCERTQuestionType.SINGLE_CORRECT_MCQ;
          }
        } else {
          sourceImageReference = pageImageUrl || sourceImageReference;
        }
      }

      // Structured Solution (Atomic Guru 4-part standard)
      const expQ = item.explainQuestion ? String(item.explainQuestion).trim() : `The question evaluates knowledge of NCERT ${subjectName}, Chapter: ${chapterTitle}, Page ${pageNumber}.`;
      const conceptText = item.concept ? String(item.concept).trim() : `${subjectName} · ${chapterTitle} · NCERT Core Principles`;
      const solText = item.solution ? String(item.solution).trim() : String(item.explanation || "").trim();
      const correctOptText = formattedOptions.find((o: { id: string; text: string }) => o.id === item.correctAnswer)?.text || "";
      const finalAnsText = item.finalAnswer ? String(item.finalAnswer).trim() : `(${item.correctAnswer}) ${correctOptText}`;

      // Canonical Statement array
      let statementsList: string[] | undefined = undefined;
      if (Array.isArray(item.statements) && item.statements.length > 0) {
        statementsList = item.statements.map((s: any) => String(s).trim()).filter(Boolean);
      }

      // Canonical Columns
      let colI: { label: string; text: string }[] | undefined = undefined;
      let colII: { label: string; text: string }[] | undefined = undefined;
      if (Array.isArray(item.columnI) && item.columnI.length > 0) {
        colI = item.columnI.map((c: any) => ({
          label: String(c.label || "").trim(),
          text: String(c.text || "").trim(),
        })).filter((c: { label: string; text: string }) => c.text);
      }
      if (Array.isArray(item.columnII) && item.columnII.length > 0) {
        colII = item.columnII.map((c: any) => ({
          label: String(c.label || "").trim(),
          text: String(c.text || "").trim(),
        })).filter((c: { label: string; text: string }) => c.text);
      }

      validatedCandidates.push({
        questionType: qType,
        question: String(item.question).trim(),
        options: formattedOptions,
        correctAnswer: item.correctAnswer as "A" | "B" | "C" | "D",
        explanation: solText,
        sourceTextReference: String(item.sourceTextReference).trim(),
        sourceImageReference,

        // Canonical Atomic Guru Fields
        assertionText: item.assertionText ? String(item.assertionText).trim() : undefined,
        reasonText: item.reasonText ? String(item.reasonText).trim() : undefined,
        statements: statementsList,
        columnI: colI,
        columnII: colII,
        sequenceItems: Array.isArray(item.sequenceItems) ? item.sequenceItems : undefined,
        tableHeaders: Array.isArray(item.tableHeaders) ? item.tableHeaders : undefined,
        tableRows: Array.isArray(item.tableRows) ? item.tableRows : undefined,
        passage: item.passage ? String(item.passage).trim() : undefined,
        imageRequired,
        imageDescription,

        // 4-Part Structured Solution
        explainQuestion: expQ,
        concept: conceptText,
        solution: solText,
        finalAnswer: finalAnsText,
      });
    }

    return validatedCandidates;
  } catch (err) {
    console.error("[NCERT AI Generator] Error generating questions:", err);
    return [];
  }
}
