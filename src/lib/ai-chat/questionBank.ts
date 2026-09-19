import crypto from "crypto";
import { getPrisma } from "@/lib/ai-chat/prisma";
import { formatFullQuestionStatement, type QuizQuestion } from "@/lib/ai-chat/quiz";

function normalize(str: string) {
  return str.trim().toLowerCase().replace(/\s+/g, " ");
}

function computeContentHash(question: QuizQuestion, language: string, statementText: string) {
  const base = [
    normalize(question.subject),
    normalize(question.chapter ?? ""),
    normalize(question.topic ?? ""),
    normalize(statementText || question.text),
    language,
  ].join("|");
  return crypto.createHash("sha256").update(base).digest("hex");
}

/**
 * Saves freshly-generated quiz questions into the permanent Question Bank,
 * subject/chapter/topic tagged, de-duplicated by content hash. Safe to call
 * after every quiz generation — repeats just bump `timesUsed` instead of
 * creating duplicate rows.
 */
export async function saveQuestionsToBank(questions: QuizQuestion[], language: string) {
  if (questions.length === 0) return;
  const prisma = getPrisma();

  const results = await Promise.allSettled(
    questions.map((question) => {
      const fullText = formatFullQuestionStatement(question) || question.text;
      const contentHash = computeContentHash(question, language, fullText);
      return prisma.questionBank.upsert({
        where: { contentHash },
        update: { timesUsed: { increment: 1 } },
        create: {
          subject: question.subject,
          chapter: question.chapter,
          topic: question.topic,
          text: fullText,
          options: question.options,
          correctIndex: question.correctIndex,
          explanation: question.explanation,
          difficulty: question.difficulty,
          language,
          source: "AI_GENERATED",
          contentHash,
        },
      });
    })
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    console.warn(`[QuestionBank] ${failed}/${questions.length} questions failed to save.`);
  }
}
