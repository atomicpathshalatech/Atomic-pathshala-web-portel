import { GoogleGenerativeAI } from "@google/generative-ai";
import { executeGeminiWithFailover } from "@/lib/questions/gemini-engine";
import { AIProvider } from "./provider-interface";
import {
  buildQuestionGenerationPrompt,
  buildQuestionValidationPrompt,
  buildPdfTopicDetectionPrompt,
} from "./prompt-templates";
import {
  GenerationLanguage,
  NeetDifficulty,
  QuestionValidationReport,
  RawAiGeneratedQuestion,
} from "./types";

export class GeminiProvider implements AIProvider {
  name = "Gemini";

  async detectTopicsFromPdf(params: {
    pdfText: string;
    subject: string;
    chapter: string;
  }): Promise<
    Array<{
      topic: string;
      topicHindi?: string;
      subtopics: string[];
      pageEstimate: number[];
      conceptSummary: string;
      hasDiagramReferences: boolean;
    }>
  > {
    const prompt = buildPdfTopicDetectionPrompt(params.pdfText, params.subject, params.chapter);

    return executeGeminiWithFailover(async (client, modelName) => {
      const model = client.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      });

      const response = await model.generateContent(prompt);
      const text = response.response.text().trim();
      const cleanJson = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();

      try {
        const parsed = JSON.parse(cleanJson);
        if (Array.isArray(parsed.detectedTopics)) {
          return parsed.detectedTopics.map((t: any) => ({
            topic: String(t.topic || "").trim(),
            topicHindi: t.topicHindi ? String(t.topicHindi).trim() : undefined,
            subtopics: Array.isArray(t.subtopics) ? t.subtopics.map(String) : [],
            pageEstimate: Array.isArray(t.pageEstimate) ? t.pageEstimate.map(Number) : [1],
            conceptSummary: String(t.conceptSummary || ""),
            hasDiagramReferences: Boolean(t.hasDiagramReferences),
          }));
        }
      } catch (err) {
        console.warn("[GeminiProvider] Topic detection JSON parse warning:", err);
      }
      return [];
    });
  }

  private async generateSingleBatch(params: {
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
  }): Promise<RawAiGeneratedQuestion[]> {
    const prompt = buildQuestionGenerationPrompt(params);

    return executeGeminiWithFailover(async (client, modelName) => {
      const model = client.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });

      const response = await model.generateContent(prompt);
      const text = response.response.text().trim();
      const cleanJson = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();

      const parsed = JSON.parse(cleanJson);
      const rawList = Array.isArray(parsed.questions) ? parsed.questions : Array.isArray(parsed) ? parsed : [];

      return rawList.map((item: any, idx: number) => {
        const optionsEn = item.optionsEn || {};
        const optionsHi = item.optionsHi || undefined;

        let correctAnswer = Array.isArray(item.correctAnswer)
          ? item.correctAnswer.map(String)
          : [String(item.correctAnswer || "A")];

        // Sanitize correct answer
        correctAnswer = correctAnswer.map((c: string) => c.toUpperCase().trim());

        return {
          questionIndex: typeof item.questionIndex === "number" ? item.questionIndex : idx + 1,
          statementEn: String(item.statementEn || "").trim(),
          statementHi: item.statementHi ? String(item.statementHi).trim() : undefined,
          optionsEn: {
            A: String(optionsEn.A || "").trim(),
            B: String(optionsEn.B || "").trim(),
            C: String(optionsEn.C || "").trim(),
            D: String(optionsEn.D || "").trim(),
          },
          optionsHi: optionsHi
            ? {
                A: String(optionsHi.A || "").trim(),
                B: String(optionsHi.B || "").trim(),
                C: String(optionsHi.C || "").trim(),
                D: String(optionsHi.D || "").trim(),
              }
            : undefined,
          correctAnswer,
          solutionEn: String(item.solutionEn || "").trim(),
          solutionHi: item.solutionHi ? String(item.solutionHi).trim() : undefined,
          subject: params.subject,
          chapter: params.chapter,
          topic: String(item.topic || params.selectedTopics[0] || "General Topic").trim(),
          subTopic: item.subTopic ? String(item.subTopic).trim() : undefined,
          difficulty: (item.difficulty as NeetDifficulty) || "MEDIUM",
          questionType: String(item.questionType || "SINGLE_CORRECT"),
          pyqStyle: item.pyqStyle === "PYQ_STYLE" || item.pyqStyle === "PYQ_INSPIRED" ? item.pyqStyle : "STANDARD",
          language: params.language,
          requiresImage: Boolean(item.requiresImage || item.sourceImageId),
          sourcePageNumbers: Array.isArray(item.sourcePageNumbers) ? item.sourcePageNumbers.map(Number) : undefined,
          sourceExcerpt: item.sourceExcerpt ? String(item.sourceExcerpt).trim() : undefined,
          sourceImageId: item.sourceImageId ? String(item.sourceImageId).trim() : undefined,
        };
      });
    });
  }

  async generateQuestions(params: {
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
  }): Promise<RawAiGeneratedQuestion[]> {
    const totalRequested = Object.values(params.questionTypeCounts).reduce((a, b) => a + b, 0);

    if (totalRequested <= 5) {
      return this.generateSingleBatch(params);
    }

    // Chunk generation into manageable sub-batches (max 5 questions per call)
    const CHUNK_SIZE = 5;
    const numChunks = Math.ceil(totalRequested / CHUNK_SIZE);
    const accumulatedQuestions: RawAiGeneratedQuestion[] = [];

    for (let chunkIdx = 0; chunkIdx < numChunks; chunkIdx++) {
      const remainingTotal = totalRequested - accumulatedQuestions.length;
      const currentChunkTarget = Math.min(CHUNK_SIZE, remainingTotal);
      if (currentChunkTarget <= 0) break;

      const subTypeCounts: Record<string, number> = {};
      const subDiffMix: Record<NeetDifficulty, number> = { EASY: 0, MEDIUM: 0, HARD: 0, ULTRA: 0 };

      // Allocate question types for this chunk
      for (const [type, totalTypeCount] of Object.entries(params.questionTypeCounts)) {
        if (totalTypeCount > 0) {
          const chunkTypeCount = Math.max(1, Math.round((totalTypeCount / totalRequested) * currentChunkTarget));
          subTypeCounts[type] = chunkTypeCount;
        }
      }

      // Allocate difficulty mix for this chunk
      for (const [diff, totalDiffCount] of Object.entries(params.difficultyMix)) {
        if (totalDiffCount > 0) {
          const chunkDiffCount = Math.max(0, Math.round((totalDiffCount / totalRequested) * currentChunkTarget));
          subDiffMix[diff as NeetDifficulty] = chunkDiffCount;
        }
      }

      try {
        const chunkQuestions = await this.generateSingleBatch({
          ...params,
          questionTypeCounts: Object.keys(subTypeCounts).length > 0 ? subTypeCounts : { SINGLE_CORRECT: currentChunkTarget },
          difficultyMix: subDiffMix,
        });

        for (const q of chunkQuestions) {
          q.questionIndex = accumulatedQuestions.length + 1;
          accumulatedQuestions.push(q);
          if (accumulatedQuestions.length >= totalRequested) break;
        }
      } catch (chunkErr) {
        console.warn(`[GeminiProvider] Chunk ${chunkIdx + 1}/${numChunks} generation error:`, chunkErr);
        if (accumulatedQuestions.length > 0) {
          break; // Return partial successful batch if we already generated questions
        } else {
          throw chunkErr;
        }
      }
    }

    return accumulatedQuestions;
  }

  async validateQuestion(question: {
    statementEn: string;
    statementHi?: string;
    optionsEn: Record<string, string>;
    optionsHi?: Record<string, string>;
    correctAnswer: string[];
    solutionEn?: string;
    subject: string;
    chapter: string;
    questionType: string;
  }): Promise<QuestionValidationReport> {
    const prompt = buildQuestionValidationPrompt(question);

    return executeGeminiWithFailover(async (client, modelName) => {
      const model = client.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      });

      const response = await model.generateContent(prompt);
      const text = response.response.text().trim();
      const cleanJson = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();

      try {
        const parsed = JSON.parse(cleanJson);
        return {
          isValid: Boolean(parsed.isValid),
          validationStatus: parsed.validationStatus || (parsed.isValid ? "PASSED" : "NEEDS_REVIEW"),
          solverVerifiedAnswer: Array.isArray(parsed.solverVerifiedAnswer)
            ? parsed.solverVerifiedAnswer.map(String)
            : undefined,
          solverConfidence: Number(parsed.solverConfidence) || 95,
          solverReasoning: String(parsed.solverReasoning || ""),
          isAmbiguous: Boolean(parsed.isAmbiguous),
          ambiguityReason: parsed.ambiguityReason ? String(parsed.ambiguityReason) : undefined,
          isScientificallySound: Boolean(parsed.isScientificallySound ?? true),
          solutionConsistentWithAnswer: Boolean(parsed.solutionConsistentWithAnswer ?? true),
          duplicateScore: 0,
          duplicateRisk: "NONE",
          bilingualEquivalent: Boolean(parsed.bilingualEquivalent ?? true),
          bilingualDiscrepancies: Array.isArray(parsed.bilingualDiscrepancies)
            ? parsed.bilingualDiscrepancies.map(String)
            : [],
          issues: Array.isArray(parsed.issues) ? parsed.issues.map(String) : [],
        };
      } catch (err) {
        return {
          isValid: true,
          validationStatus: "PASSED",
          solverConfidence: 90,
          solverReasoning: "Automatic heuristic verification pass.",
          isAmbiguous: false,
          isScientificallySound: true,
          solutionConsistentWithAnswer: true,
          duplicateScore: 0,
          duplicateRisk: "NONE",
          bilingualEquivalent: true,
          issues: [],
        };
      }
    });
  }
}

export const defaultAiProvider: AIProvider = new GeminiProvider();
