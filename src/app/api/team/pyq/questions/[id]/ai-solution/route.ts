import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { requireTeamUser } from "@/lib/pyq/api";
import { executeGeminiWithFailover } from "@/lib/questions/gemini-engine";
import {
  StructuredSolution,
  createEmptyStructuredSolution,
  parseStructuredSolution,
  formatStructuredSolution,
} from "@/lib/pyq/structured-solution";

/**
 * POST /api/team/pyq/questions/[id]/ai-solution
 * Generates or improves structured bilingual pedagogical solutions for PYQ Review.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireTeamUser(PERMISSIONS.QUESTION_READ);
    const { id } = params;

    const body = await request.json().catch(() => ({}));
    const {
      language = "both", // "en" | "hi" | "both"
      mode = "full", // "full" | "improve" | "section"
      targetSection = "",
      currentSolutionEn = null,
      currentSolutionHi = null,
      customPrompt = "",
    } = body;

    const question = await prisma.question.findUnique({
      where: { id },
      include: {
        translations: true,
        pyqOccurrences: {
          include: {
            exam: { select: { name: true } },
          },
        },
      },
    });

    if (!question) {
      return apiError("Question not found", 404);
    }

    const engTranslation = question.translations.find(
      (t) => t.language.toUpperCase() === "ENGLISH"
    );
    const hinTranslation = question.translations.find(
      (t) => t.language.toUpperCase() === "HINDI"
    );

    const statementEn = engTranslation?.statement || "";
    const statementHi = hinTranslation?.statement || "";

    const optionsEn = (engTranslation?.options || {}) as Record<string, string>;
    const optionsHi = (hinTranslation?.options || {}) as Record<string, string>;

    const correctOptionIds = engTranslation?.correctOptionIds || hinTranslation?.correctOptionIds || [];
    const officialAnswer = correctOptionIds.join(", ") || "Unknown";

    const occ = question.pyqOccurrences[0];
    const examInfo = occ ? `${occ.exam.name} ${occ.year || ""}` : (question.pyqExam ? `${question.pyqExam} ${question.pyqYear || ""}` : "NEET/JEE");

    const promptContext = `
You are the Chief Academic Officer & Subject Master at Atomic Pathshala for NEET UG / IIT-JEE.
Provide an exceptionally rigorous, crystal-clear, pedagogical, 6-part bilingual solution.

QUESTION DATA:
- Subject: ${question.subject || "Not Specified"}
- Class: ${question.ncertClass || "11/12"}
- Chapter: ${question.chapter || "Not Specified"}
- Topic: ${question.topic || "Not Specified"}
- Subtopic: ${question.subTopic || "Not Specified"}
- Micro-concept: ${question.microConcept || "Not Specified"}
- Exam: ${examInfo}
- Difficulty: ${question.difficulty}
- Official Answer Key: Option ${officialAnswer}

ENGLISH STATEMENT:
${statementEn}

ENGLISH OPTIONS:
${Object.entries(optionsEn)
  .map(([k, v]) => `(${k}) ${v}`)
  .join("\n")}

${statementHi ? `HINDI STATEMENT:\n${statementHi}\n` : ""}
${Object.keys(optionsHi).length > 0 ? `HINDI OPTIONS:\n${Object.entries(optionsHi).map(([k, v]) => `(${k}) ${v}`).join("\n")}\n` : ""}

${question.imageUrl ? `IMAGE/DIAGRAM URL: ${question.imageUrl}\n` : ""}

MODE: ${mode}
${targetSection ? `TARGET SECTION: ${targetSection}` : ""}
${customPrompt ? `REVIEWER CUSTOM INSTRUCTIONS: ${customPrompt}` : ""}

CRITICAL REQUIREMENTS:
1. Mathematical and chemical formulas must be written in standard LaTeX enclosed in $...$ for inline or $$...$$ for display formulas.
2. In English: Provide a complete 6-section breakdown.
3. In Hindi: Use standard authentic NCERT Hindi terminology (शुद्ध वैज्ञानिक शब्दावली).
4. Perform an independent solution derivation and confirm if the derived answer matches Option ${officialAnswer}.
   If there is ANY discrepancy, ambiguity, or multiple correct interpretations, flag it explicitly in "mismatchWarning".
5. Return a STRICT JSON object with these keys:
{
  "derivedOption": "A" | "B" | "C" | "D",
  "mismatchWarning": string | null,
  "en": {
    "concept": "Core theoretical principle, theorem or scientific law governing this question",
    "formula": "Formulas, equations, reaction mechanisms or rules required",
    "stepByStep": "Detailed step-by-step derivation / logical working leading unambiguously to the answer",
    "finalAnswer": "Explicit conclusion stating which option is correct and why",
    "optionExplanation": "Detailed analysis of each option: why the correct one is right, and why the other three are incorrect/distractors",
    "takeaway": "Key exam tip, common mistake/pitfall to avoid, or shortcut"
  },
  "hi": {
    "concept": "अवधारणा एवं सिद्धांत (NCERT शब्दावली)",
    "formula": "आवश्यक सूत्र एवं नियम",
    "stepByStep": "चरणबद्ध विस्तृत हल",
    "finalAnswer": "अंतिम निष्कर्ष एवं सही विकल्प का विवरण",
    "optionExplanation": "प्रत्येक विकल्प का विश्लेषण (सही विकल्प क्यों सही है एवं अन्य विकल्प क्यों गलत हैं)",
    "takeaway": "महत्वपूर्ण बिंदु, सामान्य गलतियाँ व टिप्स"
  }
}
Return ONLY valid JSON.`;

    const aiResult = await executeGeminiWithFailover(async (client, modelName) => {
      const model = client.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
        },
      });

      const response = await model.generateContent(promptContext);
      const text = response.response.text();
      return JSON.parse(text);
    });

    const parsedEn: StructuredSolution = {
      concept: aiResult?.en?.concept || "",
      formula: aiResult?.en?.formula || "",
      stepByStep: aiResult?.en?.stepByStep || "",
      finalAnswer: aiResult?.en?.finalAnswer || "",
      optionExplanation: aiResult?.en?.optionExplanation || "",
      takeaway: aiResult?.en?.takeaway || "",
    };

    const parsedHi: StructuredSolution = {
      concept: aiResult?.hi?.concept || "",
      formula: aiResult?.hi?.formula || "",
      stepByStep: aiResult?.hi?.stepByStep || "",
      finalAnswer: aiResult?.hi?.finalAnswer || "",
      optionExplanation: aiResult?.hi?.optionExplanation || "",
      takeaway: aiResult?.hi?.takeaway || "",
    };

    const derivedOption = String(aiResult?.derivedOption || "").trim().toUpperCase();
    let mismatchWarning = aiResult?.mismatchWarning || null;

    if (officialAnswer && officialAnswer !== "Unknown" && derivedOption) {
      if (!officialAnswer.toUpperCase().includes(derivedOption)) {
        mismatchWarning = `AI derived Option (${derivedOption}), but official answer key is Option (${officialAnswer}). Please review carefully!`;
      }
    }

    return apiSuccess({
      solutionEn: parsedEn,
      solutionHi: parsedHi,
      markdownEn: formatStructuredSolution(parsedEn),
      markdownHi: formatStructuredSolution(parsedHi),
      derivedOption,
      mismatchWarning,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
