import type { SyllabusChapter } from "@/components/questions/UnifiedQuestionEditor";

/**
 * The chapters (and topics) a test or DPP covers, in the shape the question
 * editor uses to limit each question's metadata. A question added to a paper
 * can only belong to the paper's own syllabus — the editor used to offer
 * (and even pre-pick) any chapter of the subject.
 */

type SavedChapter = {
  subject?: unknown;
  chapterTitle?: unknown;
  isComplete?: unknown;
  topics?: unknown;
  customTopics?: unknown;
};

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : []);

function push(out: SyllabusChapter[], entry: SyllabusChapter) {
  const key = `${entry.subject}|${entry.chapter}`.toLowerCase();
  const existing = out.find((e) => `${e.subject}|${e.chapter}`.toLowerCase() === key);
  if (!existing) {
    out.push(entry);
    return;
  }
  // Same chapter twice: the union of topics, or the whole chapter if either is whole.
  existing.topics = existing.topics.length === 0 || entry.topics.length === 0 ? [] : Array.from(new Set([...existing.topics, ...entry.topics]));
}

/** Test: its saved syllabus ({ chapters: [...] }) plus a chapter test's own chapter. */
export function testSyllabus(test: {
  syllabus: unknown;
  chapter?: { title: string; subject?: { title: string } | null } | null;
}): SyllabusChapter[] {
  const out: SyllabusChapter[] = [];
  let raw: unknown = test.syllabus;
  try {
    if (typeof raw === "string") raw = JSON.parse(raw);
  } catch {
    raw = null;
  }
  const chapters: SavedChapter[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { chapters?: unknown }).chapters)
      ? (raw as { chapters: SavedChapter[] }).chapters
      : [];
  for (const c of chapters) {
    if (typeof c?.subject !== "string" || typeof c?.chapterTitle !== "string" || !c.chapterTitle.trim()) continue;
    const topics = c.isComplete === true ? [] : [...strings(c.topics), ...strings(c.customTopics)];
    push(out, { subject: c.subject.trim(), chapter: c.chapterTitle.trim(), topics });
  }
  if (test.chapter?.title && test.chapter.subject?.title) {
    push(out, { subject: test.chapter.subject.title, chapter: test.chapter.title, topics: [] });
  }
  return out;
}

/** DPP: one subject, one chapter, its listed topics (none listed = the whole chapter). */
export function dppSyllabus(dpp: { subject: string; chapter: string; topics: string[]; topic?: string | null }): SyllabusChapter[] {
  if (!dpp.subject?.trim() || !dpp.chapter?.trim()) return [];
  const topics = strings(dpp.topics);
  if (topics.length === 0 && dpp.topic?.trim()) topics.push(dpp.topic.trim());
  return [{ subject: dpp.subject.trim(), chapter: dpp.chapter.trim(), topics }];
}
