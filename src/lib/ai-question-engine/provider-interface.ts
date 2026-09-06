import {
  GenerationLanguage,
  NeetDifficulty,
  QuestionValidationReport,
  RawAiGeneratedQuestion,
} from "./types";

export interface AIProvider {
  name: string;

  detectTopicsFromPdf(params: {
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
  >;

  generateQuestions(params: {
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
  }): Promise<RawAiGeneratedQuestion[]>;

  validateQuestion(question: {
    statementEn: string;
    statementHi?: string;
    optionsEn: Record<string, string>;
    optionsHi?: Record<string, string>;
    correctAnswer: string[];
    solutionEn?: string;
    subject: string;
    chapter: string;
    questionType: string;
  }): Promise<QuestionValidationReport>;
}
