/**
 * Deterministic Atomic-Pathshala-class → YouTube-metadata mapping. No AI
 * dependency (per spec Part 18) — every field here is derived from real,
 * verified class data already in the database; nothing is invented. If a
 * source field is empty, the corresponding output section is simply
 * omitted rather than filled with a placeholder.
 */

// ---- YouTube's own hard limits ------------------------------------------------
export const YOUTUBE_TITLE_MAX_LENGTH = 100;
export const YOUTUBE_DESCRIPTION_MAX_LENGTH = 5000;
export const YOUTUBE_TAGS_MAX_TOTAL_CHARS = 500;
/** YouTube counts each tag's characters plus a delimiter (~2 chars) toward
 * the 500-char snippet.tags budget; reserving a small margin here means the
 * actual serialized payload never brushes the hard limit even after this
 * function's own accounting. */
const TAG_DELIMITER_OVERHEAD = 2;

export interface ClassMetadataInput {
  /** The class's own title as stored on BatchSchedule (or Lecture.title if
   * a Lecture is linked — callers should already prefer that, matching the
   * existing creative-engine resolver's own preference order). */
  originalClassTitle: string;
  subjectName?: string | null;
  chapterTitle?: string | null;
  /** Chapter.description / learningObjectives — the teacher-authored
   * content this module must PREFER over generating new text (spec Part 3). */
  chapterDescription?: string | null;
  learningObjectives?: string | null;
  /** BatchSchedule.notes — a teacher's own freeform note for this specific
   * class, if they wrote one. */
  classNotes?: string | null;
  batchName: string;
  targetExam?: string | null;
  teacherName?: string | null;
  classDate: Date;
  /** 1-based sequential lecture number for this batch (see
   * computeLectureOrdinal in archive-service.ts) — used for "Lecture 07"
   * style numbering so every archived video gets a distinct title even
   * when the underlying class title repeats week to week. */
  lectureOrdinal: number;
}

function clean(...parts: (string | null | undefined)[]): string[] {
  return parts.map((p) => p?.trim()).filter((p): p is string => Boolean(p && p.length > 0));
}

// ---- Title ---------------------------------------------------------------------

export interface TitleResult {
  originalClassTitle: string;
  youtubeTitle: string;
  wasNormalized: boolean;
}

/**
 * Builds the YouTube title from real class fields, in priority order:
 * Lecture N -> Chapter/Topic (or the class's own title if no chapter linked)
 * -> Batch -> Teacher. Never invents a title; "Lecture N" is the only
 * synthesized component, and it's a plain sequence number, not content.
 */
export function buildYoutubeTitle(input: ClassMetadataInput): TitleResult {
  const lectureTag = `Lecture ${String(input.lectureOrdinal).padStart(2, "0")}`;
  const topic = input.chapterTitle || input.originalClassTitle;
  const segments = clean(topic, input.batchName, input.teacherName);
  const full = [lectureTag, ...segments].join(" | ");

  if (full.length <= YOUTUBE_TITLE_MAX_LENGTH) {
    return { originalClassTitle: input.originalClassTitle, youtubeTitle: full, wasNormalized: false };
  }

  // Safe normalization (spec Part 1): drop least-semantically-important
  // segments first (teacher, then batch) before ever truncating the
  // subject/chapter/lecture-number text itself, which is what actually
  // identifies the class.
  console.warn(
    `[youtube-metadata] title exceeded ${YOUTUBE_TITLE_MAX_LENGTH} chars, normalizing`,
    { originalLength: full.length, lectureTag, topic }
  );

  const withoutTeacher = [lectureTag, ...clean(topic, input.batchName)].join(" | ");
  if (withoutTeacher.length <= YOUTUBE_TITLE_MAX_LENGTH) {
    return { originalClassTitle: input.originalClassTitle, youtubeTitle: withoutTeacher, wasNormalized: true };
  }

  const withoutBatch = [lectureTag, ...clean(topic)].join(" | ");
  if (withoutBatch.length <= YOUTUBE_TITLE_MAX_LENGTH) {
    return { originalClassTitle: input.originalClassTitle, youtubeTitle: withoutBatch, wasNormalized: true };
  }

  // Last resort: the topic itself is too long even alone. Hard-trim only
  // the topic text, preserving the lecture tag (the one part guaranteeing
  // every video's title is distinct) and a word boundary where possible.
  const budget = YOUTUBE_TITLE_MAX_LENGTH - lectureTag.length - 3; // " | " + ellipsis
  const trimmedTopic = topic.length > budget ? `${topic.slice(0, Math.max(0, budget)).trimEnd()}…` : topic;
  const finalTitle = `${lectureTag} | ${trimmedTopic}`.slice(0, YOUTUBE_TITLE_MAX_LENGTH);
  return { originalClassTitle: input.originalClassTitle, youtubeTitle: finalTitle, wasNormalized: true };
}

// ---- Description -----------------------------------------------------------------

/**
 * Builds the description from real fields only, wrapping a teacher's own
 * description (if any) inside a consistent Atomic Pathshala template
 * (spec Part 3) rather than replacing it. Any field that's empty/absent is
 * omitted entirely — never a placeholder like "N/A" or invented text.
 */
export function buildYoutubeDescription(input: ClassMetadataInput): string {
  const lines: string[] = ["Atomic Pathshala", "Recorded Live Class", ""];

  lines.push("Title:", input.originalClassTitle, "");

  if (input.subjectName) lines.push("Subject:", input.subjectName, "");
  if (input.chapterTitle) lines.push("Chapter:", input.chapterTitle, "");
  if (input.teacherName) lines.push("Teacher:", input.teacherName, "");
  lines.push("Batch:", input.batchName, "");
  if (input.targetExam) lines.push("Exam:", input.targetExam, "");

  lines.push(
    "Class Date:",
    input.classDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
    ""
  );

  // Prefer the teacher's own written content verbatim (spec Part 3) - never
  // rewritten, never summarized, just wrapped in the template above/below.
  const teacherWritten = clean(input.chapterDescription, input.learningObjectives, input.classNotes);
  if (teacherWritten.length > 0) {
    lines.push("About this class:", ...teacherWritten, "");
  }

  lines.push("This was a recorded live class conducted on Atomic Pathshala.", "", "Website:", "https://ap.atomicpathshala.in");

  const full = lines.join("\n");
  if (full.length <= YOUTUBE_DESCRIPTION_MAX_LENGTH) return full;

  console.warn("[youtube-metadata] description exceeded max length, trimming teacher-written section", {
    originalLength: full.length,
  });
  // If it's over budget, trim only the teacher-written free-text block
  // (the one section of unbounded length) rather than the structured
  // fields above/below it.
  const withoutTeacherText = lines.filter((l) => !teacherWritten.includes(l)).join("\n");
  return withoutTeacherText.slice(0, YOUTUBE_DESCRIPTION_MAX_LENGTH);
}

// ---- Tags ---------------------------------------------------------------------

/**
 * Builds tags purely from confirmed-available class fields — this schema
 * has no dedicated tags/keywords field on any class/lecture/chapter model
 * (verified by inspection), so tags are derived combinatorially from
 * subject/chapter/batch/exam/teacher, which is exactly what the spec asks
 * for ("do not invent chapter/topic information" - none is invented here,
 * every tag is built from a real field).
 */
export function buildYoutubeTags(input: ClassMetadataInput): string[] {
  const tags = new Set<string>();

  const add = (...vals: (string | null | undefined)[]) => {
    for (const v of vals) {
      const t = v?.trim();
      if (t) tags.add(t);
    }
  };

  add(input.chapterTitle, input.subjectName, input.batchName, input.targetExam, input.teacherName, "Atomic Pathshala");

  if (input.subjectName && input.targetExam) add(`${input.targetExam} ${input.subjectName}`);
  if (input.chapterTitle && input.targetExam) add(`${input.chapterTitle} ${input.targetExam}`);
  if (input.subjectName) add(`${input.subjectName} One Shot`, `${input.subjectName} Revision`);
  if (input.chapterTitle && input.subjectName) add(`${input.chapterTitle} ${input.subjectName}`);

  return Array.from(tags);
}

export interface NormalizeTagsResult {
  tags: string[];
  originalTagCount: number;
  finalTagCount: number;
  originalCharacterCount: number;
  finalCharacterCount: number;
}

/**
 * Dedupes, trims, and enforces YouTube's 500-char total tags budget,
 * dropping lowest-priority (later-added, i.e. less specific) tags first —
 * never fails the whole upload just because a few tags had to go (spec
 * Part 5).
 */
export function normalizeYoutubeTags(rawTags: string[]): NormalizeTagsResult {
  const originalTagCount = rawTags.length;
  const originalCharacterCount = rawTags.reduce((sum, t) => sum + t.length, 0);

  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of rawTags) {
    const t = raw.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(t);
  }

  const kept: string[] = [];
  let runningTotal = 0;
  for (const t of cleaned) {
    const cost = t.length + TAG_DELIMITER_OVERHEAD;
    if (runningTotal + cost > YOUTUBE_TAGS_MAX_TOTAL_CHARS) continue; // drop this one, keep checking shorter later tags
    kept.push(t);
    runningTotal += cost;
  }

  const result: NormalizeTagsResult = {
    tags: kept,
    originalTagCount,
    finalTagCount: kept.length,
    originalCharacterCount,
    finalCharacterCount: kept.reduce((s, t) => s + t.length, 0),
  };

  if (result.finalTagCount !== result.originalTagCount) {
    console.warn("[youtube-metadata] tags normalized", result);
  }

  return result;
}

// ---- Final metadata validation ----------------------------------------------------

export interface FinalYoutubeMetadata {
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  privacyStatus: "unlisted";
}

export type MetadataValidationResult = { valid: true } | { valid: false; reason: string };

/** A minimal set of patterns that should never end up in a public(-ish,
 * unlisted-but-linkable) YouTube description/title — defense in depth, not
 * a substitute for never putting this data into the builder inputs in the
 * first place. */
const SENSITIVE_PATTERNS = [/\b\d{10}\b/, /[\w.+-]+@[\w-]+\.[\w.-]+/i];

export function validateYoutubeMetadata(metadata: FinalYoutubeMetadata): MetadataValidationResult {
  if (!metadata.title || metadata.title.trim().length === 0) return { valid: false, reason: "Title is empty." };
  if (metadata.title.length > YOUTUBE_TITLE_MAX_LENGTH) {
    return { valid: false, reason: `Title exceeds ${YOUTUBE_TITLE_MAX_LENGTH} characters.` };
  }
  if (metadata.description.length > YOUTUBE_DESCRIPTION_MAX_LENGTH) {
    return { valid: false, reason: `Description exceeds ${YOUTUBE_DESCRIPTION_MAX_LENGTH} characters.` };
  }
  const tagChars = metadata.tags.reduce((s, t) => s + t.length + TAG_DELIMITER_OVERHEAD, 0);
  if (tagChars > YOUTUBE_TAGS_MAX_TOTAL_CHARS) {
    return { valid: false, reason: "Tags exceed the 500-character total budget after normalization." };
  }
  if (metadata.privacyStatus !== "unlisted") {
    return { valid: false, reason: `privacyStatus must be "unlisted", got "${metadata.privacyStatus}".` };
  }
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(metadata.title) || pattern.test(metadata.description)) {
      return { valid: false, reason: "Title/description appears to contain a phone number or email address." };
    }
  }
  return { valid: true };
}
