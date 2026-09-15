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
}

export interface GeneratePageQuestionsParams {
  pageNumber: number;
  chapterTitle: string;
  subjectName: string;
  className: string;
  language: NCERTLanguage;
  pageText: string;
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
    elementsSummary,
    targetCount = 5,
    excludeQuestions = [],
  } = params;

  if (!pageText || pageText.trim().length < 40) {
    return [];
  }

  const isHindi = language === "HINDI";

  const systemPrompt = isHindi
    ? `आप NCERT आधारित NEET/Board परीक्षा अभ्यास प्रश्न तैयार करने वाले एक अत्यंत सख्त एवं सटीक विशेषज्ञ हैं।

सख्त स्रोत सीमा नियम (STRICT SOURCE BOUNDARY):
1. आपको केवल और केवल दिए गए "NCERT PAGE CONTENT" का उपयोग करना है।
2. पिछले पृष्ठों, अगले पृष्ठों, पूरे अध्याय के अन्य भागों, या बाहरी ज्ञान (general model knowledge) से कोई भी तथ्य न जोड़ें।
3. प्रत्येक प्रश्न, चारों विकल्प और सही उत्तर का सटीक प्रमाण (proof) इसी पृष्ठ के पाठ (text) में मौजूद होना चाहिए।
4. यदि इस पृष्ठ पर केवल 2, 3 या 4 वैध प्रश्न ही बन सकते हैं, तो केवल उतने ही प्रश्न बनाएं। 5 का कोटा पूरा करने के लिए कोई भी मनगढ़ंत या अपुष्ट प्रश्न बिल्कुल न बनाएं। (सटीकता > संख्या)
5. यदि इस पृष्ठ पर कोई वैध प्रश्न नहीं बन सकता, तो खाली सूची [] लौटाएं।
6. भाषा नियम: संपूर्ण प्रश्न, विकल्प A, B, C, D, स्पष्टीकरण (explanation) और sourceTextReference शुद्ध हिंदी में होने चाहिए। NCERT की मूल शब्दावली को न बदलें।
7. प्रत्येक प्रश्न में निश्चित रूप से केवल 1 सही विकल्प (A, B, C, या D) होना चाहिए। अस्पष्टता या एकाधिक सही विकल्प अस्वीकार्य हैं।
8. sourceTextReference में इस पृष्ठ का वह सटीक वाक्य या वाक्यांश उद्धृत करें जो सही उत्तर को प्रमाणित करता है।`
    : `You are an elite, highly rigorous NCERT NEET practice question generation engine.

STRICT SOURCE BOUNDARY RULES:
1. Use ONLY and EXCLUSIVELY the provided "NCERT PAGE CONTENT".
2. Do NOT use facts from previous pages, subsequent pages, other parts of the book, or outside AI knowledge.
3. Every question, all four options (A, B, C, D), and the correct answer must be directly and indisputably supported by the provided page text.
4. TARGET: Up to ${targetCount} high-yield questions. If the page only supports 2, 3, or 4 reliable questions, produce ONLY those. NEVER fabricate or force-generate a question just to reach the quota. ACCURACY > QUANTITY.
5. If the page does not support any valid questions (e.g. index, bibliography, full-page decorative art), return an empty array [].
6. LANGUAGE: The question, options A/B/C/D, explanation, and sourceTextReference must be 100% in English using standard NCERT terminology.
7. EXACTLY ONE correct option (A, B, C, or D). Zero ambiguity.
8. sourceTextReference: Must quote the EXACT sentence or paragraph from this page that proves the correct answer.`;

  const userPrompt = `
CONTEXT:
- Class: ${className}
- Subject: ${subjectName}
- Chapter: ${chapterTitle}
- Page Number: ${pageNumber}
- Language: ${language}
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

Supported Question Types (choose what naturally fits the page):
- SINGLE_CORRECT_MCQ
- ASSERTION_REASON (only if both assertion and reason are verifiable on this page)
- STATEMENT_BASED (Statement I & Statement II format)
- MATCH_FOLLOWING (only if pairings exist on this page)
- DIAGRAM_BASED (only if a diagram or figure caption is described on this page)
- CONCEPTUAL_MCQ

OUTPUT FORMAT:
Respond with ONLY valid JSON adhering to this exact schema (no markdown fences, no other text):
[
  {
    "questionType": "SINGLE_CORRECT_MCQ" | "ASSERTION_REASON" | "STATEMENT_BASED" | "MATCH_FOLLOWING" | "DIAGRAM_BASED" | "CONCEPTUAL_MCQ",
    "question": "question text",
    "options": [
      { "id": "A", "text": "option A" },
      { "id": "B", "text": "option B" },
      { "id": "C", "text": "option C" },
      { "id": "D", "text": "option D" }
    ],
    "correctAnswer": "A" | "B" | "C" | "D",
    "explanation": "Clear explanation citing the page fact",
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

      validatedCandidates.push({
        questionType: qType,
        question: String(item.question).trim(),
        options: formattedOptions,
        correctAnswer: item.correctAnswer as "A" | "B" | "C" | "D",
        explanation: String(item.explanation || "").trim(),
        sourceTextReference: String(item.sourceTextReference).trim(),
        sourceImageReference: item.sourceImageReference ? String(item.sourceImageReference) : null,
      });
    }

    return validatedCandidates;
  } catch (err) {
    console.error("[NCERT AI Generator] Error generating questions:", err);
    return [];
  }
}
