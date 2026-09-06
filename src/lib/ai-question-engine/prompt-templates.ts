import { GenerationLanguage, NeetDifficulty } from "./types";

export const PROMPT_VERSION = "v1.0";

/**
 * Builds the strict NEET Question Generation Prompt
 */
export function buildQuestionGenerationPrompt({
  method,
  subject,
  chapter,
  selectedTopics,
  selectedSubtopics,
  difficultyMix,
  questionTypeCounts,
  language,
  sourceText,
  sourceImageDescriptions,
}: {
  method: "AI" | "PDF";
  subject: string;
  chapter: string;
  selectedTopics: string[];
  selectedSubtopics?: string[];
  difficultyMix: Record<NeetDifficulty, number>;
  questionTypeCounts: Record<string, number>;
  language: GenerationLanguage;
  sourceText?: string;
  sourceImageDescriptions?: Array<{ id: string; page: number; description: string }>;
}): string {
  const isPdfMode = method === "PDF";

  const totalQuestions = Object.values(questionTypeCounts).reduce((a, b) => a + b, 0);

  const typeInstructions = Object.entries(questionTypeCounts)
    .filter(([_, count]) => count > 0)
    .map(([typeId, count]) => `- Question Type "${typeId}": Exactly ${count} question(s)`)
    .join("\n");

  const diffInstructions = Object.entries(difficultyMix)
    .filter(([_, count]) => count > 0)
    .map(([diff, count]) => `- Difficulty "${diff}": Exactly ${count} question(s)`)
    .join("\n");

  let sourceGroundingClause = "";
  if (isPdfMode && sourceText) {
    sourceGroundingClause = `
CRITICAL SOURCE-GROUNDED GENERATION POLICY (BY PDF MODE):
You must generate questions SOLELY and STRICTLY from the provided SOURCE REFERENCE below.
- Do NOT invent facts, definitions, or statements not supported by this text.
- If the source context is insufficient for a specific question, use only standard NCERT Class 11/12 statements directly relevant to this specific chapter.
- For every question generated, cite the "sourceExcerpt" with a short 1-2 sentence verbatim reference from the source.
${
  sourceImageDescriptions && sourceImageDescriptions.length > 0
    ? `- The following extracted diagrams/images are available in the source PDF:
${sourceImageDescriptions.map((img) => `  * [Image ID: "${img.id}", Page: ${img.page}]: ${img.description}`).join("\n")}
When generating a "DIAGRAM_BASED" or "IMAGE_BASED" question, set "sourceImageId" to the corresponding Image ID and write the question referencing its labelled parts.`
    : ""
}

=== SOURCE REFERENCE EXCERPT ===
${sourceText.slice(0, 15000)}
=== END OF SOURCE REFERENCE ===
`;
  } else {
    sourceGroundingClause = `
KNOWLEDGE & SYLLABUS POLICY (BY AI MODE):
- Generate questions adhering strictly to the official NEET UG syllabus and core NCERT Class 11 & 12 textbooks.
- Strictly AVOID: Olympiad trivia, JEE Advanced-exclusive tricks, out-of-syllabus facts, or arbitrary coaching gimmicks.
- Target publicly observable NEET examination conventions: NCERT line-by-line conceptual understanding, statement-based reasoning, and standard NEET question patterns.
`;
  }

  return `You are the Lead Senior Academic Content Master and NEET Examination Architect for Atomic Pathshala.
Your mission is to author a batch of exactly ${totalQuestions} high-precision, production-grade NEET questions.

ACADEMIC METADATA:
- Subject: ${subject}
- Chapter: ${chapter}
- Constrained Topics: ${selectedTopics.length > 0 ? selectedTopics.join(", ") : "All core chapter topics"}
- Subtopics: ${selectedSubtopics && selectedSubtopics.length > 0 ? selectedSubtopics.join(", ") : "Relevant subtopics"}
- Target Language: ${language} (Options: ENGLISH, HINDI, BOTH)

GENERATION QUOTAS TO PRODUCE:
${typeInstructions}

DIFFICULTY DISTRIBUTION:
${diffInstructions}

COGNITIVE DEMAND DEFINITIONS (DO NOT MISCLASSIFY):
- EASY: Direct NCERT concept, authentic definition, basic recall, or 1-step direct formula substitution.
- MEDIUM: Concept application, moderate reasoning, 2-step calculation, or linking 2 related concepts.
- HARD: Multi-step reasoning, concept integration, distractor discrimination, non-obvious application.
- ULTRA: High-level NEET-oriented synthesis requiring deep conceptual clarity across multiple concepts within the syllabus. (NEVER out-of-syllabus Olympiad/JEE-Advanced tricks).

DISTRACTOR QUALITY RULES:
1. Every Single Correct MCQ must have EXACTLY ONE unambiguously correct answer.
2. Wrong options (distractors) MUST be plausible, reflecting common student misconceptions, common sign errors, or closely related concepts.
3. NEVER make distractors obviously absurd.
4. NEVER allow multiple options to be scientifically defendable.

${
  language === "BOTH" || language === "HINDI"
    ? `BILINGUAL QUALITY RULES:
- Statement and options MUST be provided in authentic Hindi (Devanagari script) using official NCERT standard scientific terminology (e.g. 'विद्युत धारा', 'कोशिका झिल्ली', 'प्रकाश संश्लेषण', 'प्रत्यावर्ती धारा').
- Preserve all mathematical formulas, LaTeX notation ($...$, $$...$$), chemical symbols, units, numbers, and scientific names identically in both English and Hindi versions.
- The logical meaning in English and Hindi must be 100% equivalent.
`
    : ""
}
${sourceGroundingClause}

OUTPUT FORMAT:
Return ONLY a valid JSON object matching the following JSON schema with NO markdown codeblock fencing or commentary:

{
  "questions": [
    {
      "questionIndex": 1,
      "statementEn": "Detailed English question statement with LaTeX math...",
      "statementHi": "हिंदी प्रश्न कथन (यदि लागू हो)...",
      "optionsEn": {
        "A": "Option A in English",
        "B": "Option B in English",
        "C": "Option C in English",
        "D": "Option D in English"
      },
      "optionsHi": {
        "A": "विकल्प A हिंदी में",
        "B": "विकल्प B हिंदी में",
        "C": "विकल्प C हिंदी में",
        "D": "विकल्प D हिंदी में"
      },
      "correctAnswer": ["B"],
      "solutionEn": "Comprehensive step-by-step solution in English explaining why B is correct and why other options are incorrect...",
      "solutionHi": "हिंदी में विस्तृत चरण-दर-चरण समाधान...",
      "subject": "${subject}",
      "chapter": "${chapter}",
      "topic": "Specific topic from selected topics",
      "subTopic": "Specific subtopic",
      "difficulty": "MEDIUM",
      "questionType": "SINGLE_CORRECT",
      "pyqStyle": "STANDARD",
      "language": "${language}",
      "requiresImage": false,
      "sourcePageNumbers": [1],
      "sourceExcerpt": "Direct quote from source if PDF mode",
      "sourceImageId": null
    }
  ]
}`;
}

/**
 * Builds the Independent AI Solver & Verification Prompt
 */
export function buildQuestionValidationPrompt(question: {
  statementEn: string;
  statementHi?: string;
  optionsEn: Record<string, string>;
  optionsHi?: Record<string, string>;
  correctAnswer: string[];
  solutionEn?: string;
  subject: string;
  chapter: string;
  questionType: string;
}): string {
  return `You are the Chief Academic Auditor for National Medical Entrance Examination (NEET) at Atomic Pathshala.
Perform an independent, adversarial validation of the following question.

QUESTION TO AUDIT:
Subject: ${question.subject}
Chapter: ${question.chapter}
Type: ${question.questionType}
Statement (English): ${question.statementEn}
${question.statementHi ? `Statement (Hindi): ${question.statementHi}` : ""}
Options (English):
${JSON.stringify(question.optionsEn, null, 2)}
Claimed Correct Answer: Option (${question.correctAnswer.join(", ")})
Claimed Solution: ${question.solutionEn || "None provided"}

INDEPENDENT VERIFICATION STEPS:
1. Solve the question from first principles without trusting the claimed answer.
2. What is the objectively correct answer? (e.g. ["A"])
3. Does the claimed answer match your independently derived answer?
4. Are any other options also potentially or partially correct? (Ambiguity Check)
5. Is the question scientifically sound and completely within the NEET curriculum?
6. Does the provided solution logically and mathematically lead to the claimed answer?
7. If bilingual: Are the English and Hindi statements logically equivalent?

Return a STRICT JSON object with these exact keys:
{
  "isValid": true/false,
  "validationStatus": "PASSED" | "NEEDS_REVIEW" | "FAILED" | "ANSWER_VALIDATION_FAILED" | "BILINGUAL_VALIDATION_FAILED",
  "solverVerifiedAnswer": ["A"],
  "solverConfidence": 98,
  "solverReasoning": "Detailed breakdown of why this option is correct...",
  "isAmbiguous": false,
  "ambiguityReason": null,
  "isScientificallySound": true,
  "solutionConsistentWithAnswer": true,
  "bilingualEquivalent": true,
  "bilingualDiscrepancies": [],
  "qualityScore": {
    "contentAccuracy": 98,
    "answerConfidence": 100,
    "ncertAlignment": 95,
    "neetRelevance": 96,
    "languageQuality": 95,
    "overallScore": 97
  },
  "issues": []
}
Output ONLY raw JSON.`;
}

/**
 * Builds the PDF Topic Detection Prompt
 */
export function buildPdfTopicDetectionPrompt(
  pdfText: string,
  subject: string,
  chapter: string
): string {
  return `You are an expert Academic Curriculum Specialist for NEET NCERT Syllabus.
Analyze the following extracted educational document text for:
Subject: "${subject}"
Chapter: "${chapter}"

TASK:
Identify all distinct syllabus topics, key concepts, subtopics, and whether diagrams/tables are discussed.
The selected Subject and Chapter act as HARD CONSTRAINTS. Do NOT extract topics that belong to unrelated chapters.

EXTRACTED DOCUMENT EXCERPT:
${pdfText.slice(0, 12000)}

Return a STRICT JSON object:
{
  "detectedTopics": [
    {
      "topic": "Topic Name in English",
      "topicHindi": "हिंदी में शीर्षक",
      "subtopics": ["Subtopic 1", "Subtopic 2"],
      "pageEstimate": [1, 2],
      "conceptSummary": "1-line summary of what this topic covers",
      "hasDiagramReferences": true/false
    }
  ]
}
Output ONLY raw JSON.`;
}
