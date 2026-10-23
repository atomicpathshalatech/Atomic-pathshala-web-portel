import type { Prisma } from "@prisma/client";
import { canonicalChapter } from "@/lib/academic/canonical-chapter";

/**
 * Every write of a Question goes through here, whichever feature does it
 * (editor, AI generators, NCERT practice, PYQ import, Question Bank import):
 * the chapter is stored as the NCERT master title (see canonical-chapter.ts),
 * and a topic that was written in the chapter field becomes the topic when
 * none is set. Writes without a subject in the same call are left alone.
 */
type QuestionData = { subject?: unknown; chapter?: unknown; topic?: unknown };

function fix(data: QuestionData | undefined) {
  if (!data || typeof data !== "object") return;
  if (typeof data.subject !== "string" || typeof data.chapter !== "string" || !data.chapter.trim()) return;
  const c = canonicalChapter(data.subject, data.chapter);
  if (!c) return;
  data.chapter = c.chapter;
  const topicEmpty = data.topic === undefined || data.topic === null || (typeof data.topic === "string" && !data.topic.trim());
  if (c.topicHint && topicEmpty) data.topic = c.topicHint;
}

export const questionChapterMiddleware: Prisma.Middleware = async (params, next) => {
  if (params.model === "Question") {
    try {
      const args = params.args as Record<string, any> | undefined;
      switch (params.action) {
        case "create":
        case "update":
        case "updateMany":
          fix(args?.data);
          break;
        case "upsert":
          fix(args?.create);
          fix(args?.update);
          break;
        case "createMany":
          if (Array.isArray(args?.data)) args.data.forEach(fix);
          else fix(args?.data);
          break;
      }
    } catch {
      // Never let the clean-up block a save.
    }
  }
  return next(params);
};
