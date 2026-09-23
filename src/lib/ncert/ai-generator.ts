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
    ? `आप NTA NEET UG परीक्षा के मुख्य प्रश्नपत्र निर्माता (Senior Question Paper Setter) स्तर के विशेषज्ञ हैं।
आप NCERT की प्रत्येक पंक्ति से केवल वही प्रश्न तैयार करते हैं जो NEET परीक्षा के दृष्टिकोण से वास्तविक महत्व रखते हैं।

सख्त NEET गुणवत्ता एवं स्रोत सीमा नियम (STRICT NEET QUALITY & SOURCE BOUNDARY):
1. फालतू/परिभाषा रटने वाले प्रश्नों पर पूर्ण प्रतिबंध (NO TRIVIAL DEFINITIONS): 
   - केवल शब्द का अर्थ या साधारण परिभाषा पूछने वाले सतही प्रश्न बिल्कुल न बनाएं (उदा. "रसायन विज्ञान क्या है", "पदार्थ की परिभाषा")।
   - हमेशा गहन वैचारिक (Conceptual), छिपी हुई NCERT पंक्तियाँ (Hidden Lines), अपवाद (Exceptions), कारण-कथन (Assertion-Reason), कथन I व II (Statements), सुमेलन (Match the Columns), और NEET जाल (Exam Traps) वाले प्रश्न बनाएं।
2. स्रोत सीमा: प्रश्न और चारों विकल्पों का आधार केवल और केवल दिए गए "NCERT PAGE CONTENT" पर आधारित होना चाहिए।
3. NTA स्तर के विकल्प (Quality Distractors): गलत विकल्प (Distractors) भी ऐसे तार्किक हों जो सामान्य रूप से छात्रों को भ्रमित करते हैं। कोई भी बचकाना विकल्प न दें।
4. यदि इस पृष्ठ पर 2-4 उच्च स्तरीय प्रश्न ही बन सकते हैं, तो केवल वही बनाएं। संख्या पूरी करने के लिए घटिया प्रश्न न बनाएं।
5. भाषा: शुद्ध प्रामाणिक NCERT शब्दावली में हिंदी।
6. 4-भाग संरचित समाधान (4-Part Structured Solution) अनिवार्य रूप से दें:
   - explainQuestion: प्रश्न क्या जांच रहा है
   - concept: मुख्य NCERT संकल्पना / सिद्धांत
   - solution: चरणबद्ध तार्किक विश्लेषण
   - finalAnswer: सही विकल्प एवं निष्कर्ष`
    : `You are an elite NTA NEET Exam Item-Writer and Senior Subject Expert.
You extract ONLY authentic, high-yield NEET questions from NCERT lines that test true conceptual understanding, critical exceptions, and hidden exam points (top-tier Allen / PW / NTA standard).

STRICT NEET QUALITY & SOURCE BOUNDARY RULES:
1. STRICT PROHIBITION OF TRIVIAL ROTE DEFINITIONS:
   - NEVER create questions that simply ask for dictionary definitions or trivial introductory text (e.g. "What is chemistry?", "Define matter").
   - Target DEEP CONCEPTUAL understanding, hidden NCERT facts, exception rules, comparative trends, mechanisms, multi-statement analysis (Statement I & II), Assertion-Reason, and Match the Following.
2. EXAM TRAPS & REALISTIC DISTRACTORS:
   - Incorrect options (distractors) must represent authentic student traps, common misconceptions, or subtle variations found in NCERT rather than absurd dummy options.
3. SOURCE BOUNDARY:
   - Every question and option must be grounded strictly in the provided "NCERT PAGE CONTENT".
4. ACCURACY & DEPTH OVER RAW COUNT:
   - Produce up to ${targetCount} top-tier NEET questions. If the page only supports 2-3 genuine high-yield concepts, output ONLY those.
5. 4-PART STRUCTURED SOLUTION:
   - explainQuestion: Clear analysis of what is being tested.
   - concept: The exact NCERT principle / rule.
   - solution: Step-by-step rigorous explanation evaluating all options.
   - finalAnswer: Clear conclusion justifying the correct option.`;

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
