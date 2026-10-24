import { GoogleGenerativeAI } from "@google/generative-ai";
import { parseAiJson } from "@/lib/ai/latex-json";
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
import { formatOf } from "./type-formats";
import { parseFigure } from "./figures";

/**
 * Holds a generated question to the type it was asked for: the type id is set,
 * the format is checked, and visual types must bring a usable figure (or one of
 * the offered source images). What is wrong is recorded in formatIssue.
 */
export function checkAgainstType(q: RawAiGeneratedQuestion, typeId: string, offeredImages: Set<string>): RawAiGeneratedQuestion {
  const fmt = formatOf(typeId);
  const out: RawAiGeneratedQuestion = { ...q, questionType: typeId, formatIssue: undefined };
  const usesSource = Boolean(q.sourceImageId && offeredImages.has(q.sourceImageId));
  if (!usesSource) out.sourceImageId = undefined;
  if (!fmt.figure) out.figure = undefined;
  let issue = fmt.check(q);
  if (!issue && fmt.figure && !usesSource) {
    if (fmt.figure === "source") {
      issue = "No source image was used (one of the offered images must be chosen).";
    } else {
      const { figure, problem } = parseFigure(q.figure);
      if (!figure) issue = problem ?? "No figure was given for this visual question.";
      else if (fmt.figure === "graph" && figure.kind !== "graph") issue = "A graph question needs a graph figure.";
      else out.figure = figure;
    }
  }
  out.requiresImage = Boolean(fmt.figure) || Boolean(out.sourceImageId);
  if (issue) out.formatIssue = issue;
  return out;
}

const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** The AI's topic label → one of the topics the teacher selected (exact, contains, or word overlap); null if none fits. */
export function matchSelectedTopic(raw: string, selected: string[]): string | null {
  if (!selected.length) return raw || null;
  const r = norm(raw || "");
  if (!r) return null;
  const exact = selected.find((t) => norm(t) === r);
  if (exact) return exact;
  const contains = selected.find((t) => norm(t).includes(r) || r.includes(norm(t)));
  if (contains) return contains;
  const words = new Set(r.split(" ").filter((w) => w.length > 3));
  let best: { t: string; score: number } | null = null;
  for (const t of selected) {
    const tw = norm(t).split(" ").filter((w) => w.length > 3);
    const score = tw.length ? tw.filter((w) => words.has(w)).length / tw.length : 0;
    if (score > (best?.score ?? 0)) best = { t, score };
  }
  return best && best.score >= 0.5 ? best.t : null;
}

/** Splits `counts` (type → n) so the chunks add up exactly to the plan (largest remainder). */
export function splitCounts(counts: Record<string, number>, chunkTotal: number, remaining: Record<string, number>): Record<string, number> {
  const left = Object.entries(remaining).filter(([, n]) => n > 0);
  const totalLeft = left.reduce((a, [, n]) => a + n, 0);
  if (!totalLeft) return {};
  const target = Math.min(chunkTotal, totalLeft);
  const raw = left.map(([k, n]) => ({ k, exact: (n / totalLeft) * target }));
  const out: Record<string, number> = {};
  let used = 0;
  for (const r of raw) {
    out[r.k] = Math.min(remaining[r.k]!, Math.floor(r.exact));
    used += out[r.k]!;
  }
  for (const r of raw.sort((a, b) => (b.exact % 1) - (a.exact % 1))) {
    if (used >= target) break;
    if ((out[r.k] ?? 0) < remaining[r.k]!) {
      out[r.k] = (out[r.k] ?? 0) + 1;
      used++;
    }
  }
  void counts;
  return Object.fromEntries(Object.entries(out).filter(([, n]) => n > 0));
}

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
        const parsed = parseAiJson(cleanJson);
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
    avoidStatements?: string[];
  }): Promise<RawAiGeneratedQuestion[]> {
    const prompt = buildQuestionGenerationPrompt(params);

    return executeGeminiWithFailover(async (client, modelName) => {
      const model = client.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
          // Bilingual questions with solutions are long — the default output
          // limit cut the JSON off mid-question and the whole chunk was lost.
          maxOutputTokens: 16384,
        },
      });

      const response = await model.generateContent(prompt);
      const text = response.response.text().trim();
      const cleanJson = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();

      const parsed = parseAiJson(cleanJson);
      const rawList = Array.isArray(parsed.questions) ? parsed.questions : Array.isArray(parsed) ? parsed : [];

      return rawList.map((item: any, idx: number) => {
        const optionsEn = item.optionsEn || {};
        const optionsHi = item.optionsHi || undefined;

        // No answer from the model = no answer (it used to default to "A",
        // silently giving wrong keys that then passed validation).
        let correctAnswer: string[] = Array.isArray(item.correctAnswer)
          ? item.correctAnswer.map(String)
          : item.correctAnswer != null && String(item.correctAnswer).trim()
            ? String(item.correctAnswer).split(/[\s,;/&]+/)
            : [];
        correctAnswer = correctAnswer.map((c: string) => c.toUpperCase().replace(/[^A-Z0-9.\-]/g, "").trim()).filter(Boolean);
        // "1"-"4" as printed in many papers → A-D
        correctAnswer = correctAnswer.map((c) => ({ "1": "A", "2": "B", "3": "C", "4": "D" })[c] ?? c);

        // Topic must be one of the selected topics; an unknown label is kept
        // as-is and flagged by the validator instead of being silently relabelled.
        const rawTopic = String(item.topic || "").trim();
        const matchedTopic = matchSelectedTopic(rawTopic, params.selectedTopics);

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
          topic: matchedTopic || rawTopic || params.selectedTopics[0] || "General Topic",
          subTopic: item.subTopic ? String(item.subTopic).trim() : undefined,
          difficulty: (item.difficulty as NeetDifficulty) || "MEDIUM",
          questionType: String(item.questionType || "SINGLE_CORRECT"),
          pyqStyle: item.pyqStyle === "PYQ_STYLE" || item.pyqStyle === "PYQ_INSPIRED" ? item.pyqStyle : "STANDARD",
          language: params.language,
          requiresImage: Boolean(item.requiresImage || item.sourceImageId),
          sourcePageNumbers: Array.isArray(item.sourcePageNumbers) ? item.sourcePageNumbers.map(Number) : undefined,
          sourceExcerpt: item.sourceExcerpt ? String(item.sourceExcerpt).trim() : undefined,
          sourceImageId: item.sourceImageId ? String(item.sourceImageId).trim() : undefined,
          figure: item.figure && typeof item.figure === "object" ? item.figure : undefined,
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
    deadlineMs?: number;
  }): Promise<RawAiGeneratedQuestion[]> {
    const totalRequested = Object.values(params.questionTypeCounts).reduce((a, b) => a + b, 0);
    const offeredImages = new Set((params.sourceImageDescriptions ?? []).map((i) => i.id));

    // One type per call (at most 5 questions), so each call is told exactly one
    // format and every requested type is really asked for; a few calls run at
    // once to stay inside the time budget. Difficulties are shared out over the
    // calls so the batch adds up to the plan.
    const CHUNK_SIZE = 5;
    const PARALLEL = 4;
    type Job = { typeId: string; count: number; diff: Record<NeetDifficulty, number> };
    const diffLeft: Record<string, number> = { ...params.difficultyMix };
    const plan = (counts: Record<string, number>): Job[] => {
      const jobs: Job[] = [];
      for (const [typeId, n] of Object.entries(counts)) {
        for (let left = n; left > 0; left -= CHUNK_SIZE) {
          const count = Math.min(CHUNK_SIZE, left);
          const sub = splitCounts(params.difficultyMix, count, diffLeft);
          for (const [k, v] of Object.entries(sub)) diffLeft[k] = Math.max(0, (diffLeft[k] ?? 0) - v);
          const diff = { EASY: 0, MEDIUM: 0, HARD: 0, ULTRA: 0 } as Record<NeetDifficulty, number>;
          let assigned = 0;
          for (const [k, v] of Object.entries(sub)) {
            diff[k as NeetDifficulty] = v;
            assigned += v;
          }
          if (assigned < count) diff.MEDIUM += count - assigned;
          jobs.push({ typeId, count, diff });
        }
      }
      return jobs;
    };

    const good: Record<string, RawAiGeneratedQuestion[]> = {};
    const flawed: RawAiGeneratedQuestion[] = [];
    let lastError: unknown = null;
    const runJobs = async (jobs: Job[]) => {
      let next = 0;
      await Promise.all(
        Array.from({ length: Math.min(PARALLEL, jobs.length) }, async () => {
          while (next < jobs.length) {
            const job = jobs[next++]!;
            if (params.deadlineMs && Date.now() > params.deadlineMs) return;
            try {
              const written = Object.values(good).flat().concat(flawed);
              const list = await this.generateSingleBatch({
                ...params,
                questionTypeCounts: { [job.typeId]: job.count },
                difficultyMix: job.diff,
                avoidStatements: written.map((q) => q.statementEn || q.statementHi || "").filter(Boolean).slice(-25),
              });
              for (const q of list.slice(0, job.count)) {
                const checked = checkAgainstType(q, job.typeId, offeredImages);
                if (checked.formatIssue) flawed.push(checked);
                else (good[job.typeId] ??= []).push(checked);
              }
            } catch (err) {
              lastError = err;
              console.warn(`[GeminiProvider] Generation call for ${job.typeId} failed:`, err instanceof Error ? err.message : err);
            }
          }
        })
      );
    };

    await runJobs(plan(params.questionTypeCounts));

    // Types that came back short (or not in their format) are asked for once more.
    const missing: Record<string, number> = {};
    for (const [typeId, n] of Object.entries(params.questionTypeCounts)) {
      const short = n - (good[typeId]?.length ?? 0);
      if (short > 0) missing[typeId] = short;
    }
    if (Object.keys(missing).length && (!params.deadlineMs || Date.now() < params.deadlineMs - 20_000)) {
      for (const k of Object.keys(diffLeft)) diffLeft[k] = 0;
      for (const [k, n] of Object.entries(params.difficultyMix)) diffLeft[k] = n;
      await runJobs(plan(missing));
    }

    // Requested order; a type still short is filled with its flawed questions
    // (saved with the reason, so the teacher sees what went wrong).
    const out: RawAiGeneratedQuestion[] = [];
    for (const [typeId, n] of Object.entries(params.questionTypeCounts)) {
      const ok = (good[typeId] ?? []).slice(0, n);
      const extra = flawed.filter((q) => q.questionType === typeId).slice(0, n - ok.length);
      out.push(...ok, ...extra);
    }
    if (!out.length && lastError) throw lastError;
    out.forEach((q, i) => (q.questionIndex = i + 1));
    return out.slice(0, totalRequested);
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
    topic?: string;
    allowedTopics?: string[];
    figureDescription?: string;
  }): Promise<QuestionValidationReport> {
    const prompt = buildQuestionValidationPrompt(question);

    return executeGeminiWithFailover(async (client, modelName) => {
      const model = client.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
          maxOutputTokens: 4096,
        },
      });

      const response = await model.generateContent(prompt);
      const text = response.response.text().trim();
      const cleanJson = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();

      // An unreadable audit is NOT a pass — the caller marks the question for review.
      {
        const parsed = parseAiJson(cleanJson);
        const qs = parsed.qualityScore && typeof parsed.qualityScore === "object" ? parsed.qualityScore : null;
        const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(100, Number(v))) : d);
        return {
          aiValidated: true,
          topicRelevant: parsed.topicRelevant === undefined ? undefined : Boolean(parsed.topicRelevant),
          qualityScore: qs
            ? {
                contentAccuracy: num(qs.contentAccuracy, 0),
                answerConfidence: num(qs.answerConfidence, 0),
                ncertAlignment: num(qs.ncertAlignment, 0),
                neetRelevance: num(qs.neetRelevance, 0),
                languageQuality: num(qs.languageQuality, 0),
                overallScore: num(qs.overallScore, 0),
              }
            : undefined,
          isValid: Boolean(parsed.isValid),
          validationStatus: parsed.validationStatus || (parsed.isValid ? "PASSED" : "NEEDS_REVIEW"),
          solverVerifiedAnswer: Array.isArray(parsed.solverVerifiedAnswer)
            ? parsed.solverVerifiedAnswer.map(String)
            : undefined,
          solverConfidence: num(parsed.solverConfidence, 0),
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
      }
    });
  }
}

export const defaultAiProvider: AIProvider = new GeminiProvider();
