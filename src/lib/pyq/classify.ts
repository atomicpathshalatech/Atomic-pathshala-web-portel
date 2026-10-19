/**
 * Deterministic chapter / topic classification against the app's own NCERT
 * taxonomy (src/lib/academic/master-ncert-catalog.ts — the same chapter
 * titles the Question Bank stores in Question.chapter).
 *
 * Scoring: words of each chapter's title, topic titles and subtopics, weighted
 * by how rare they are across chapters (a word that names one chapter is
 * strong evidence, "law" is not), plus whole-phrase hits on topic titles, plus
 * the existing rule-based NEET detector as one extra vote. The result is a
 * ranked candidate list; it is only "confident" when the winner is clearly
 * ahead — otherwise the question goes to "Needs Chapter Review".
 */

import { getMasterNcertChapters, normalizeSubjectName } from "@/lib/academic/master-ncert-catalog";
import { autoDetectNeetTaxonomy } from "@/lib/questions/neet-taxonomy-detector";
import c11Phys from "@/lib/academic/c11-physics.json";
import c12Phys from "@/lib/academic/c12-physics.json";
import c11Chem from "@/lib/academic/c11-chemistry.json";
import c12Chem from "@/lib/academic/c12-chemistry.json";
import c11Bio from "@/lib/academic/c11-biology.json";
import c12Bio from "@/lib/academic/c12-biology.json";
import c11Math from "@/lib/academic/c11-maths.json";
import c12Math from "@/lib/academic/c12-maths.json";

export type ChapterCandidate = { subject: string; chapter: string; topic: string | null; score: number };
export type Classification = {
  subject: string | null;
  chapter: string | null;
  topic: string | null;
  confident: boolean;
  candidates: ChapterCandidate[];
};

const SUBJECTS = ["Physics", "Chemistry", "Biology", "Mathematics"];
const STOP = new Set(
  "the of and a an in to is are for with on by from as at its it be or which what following correct incorrect statement statements given among all none above below two one not that this these those their when then than into about between due under over also used use using called known can may will would has have had was were being been type types its how why does do number value find calculate question option options true false match column list assertion reason both only most least more less".split(
    " "
  )
);

function tokens(text: string): string[] {
  return String(text || "")
    .toLowerCase()
    .replace(/\$[^$]*\$/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .map((w) => (w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
    .filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));
}

type ChapterEntry = {
  subject: string;
  chapter: string;
  words: Set<string>;
  topics: { title: string; words: string[]; phrase: string }[];
};

let INDEX: { entries: ChapterEntry[]; idf: Map<string, number> } | null = null;

type RawTopic = { title: string; subtopics?: string[] };
type RawChapter = { title: string; topics?: RawTopic[] };

function buildIndex() {
  if (INDEX) return INDEX;
  const datasets = [c11Phys, c12Phys, c11Chem, c12Chem, c11Bio, c12Bio, c11Math, c12Math] as unknown as { name: string; chapters: RawChapter[] }[];
  const entries: ChapterEntry[] = [];
  for (const ds of datasets) {
    const subject = normalizeSubjectName(ds.name);
    for (const ch of ds.chapters || []) {
      const topicList = (ch.topics || []).map((t) => {
        const text = [t.title, ...(t.subtopics || [])].join(" ");
        return { title: t.title, words: tokens(text), phrase: t.title.toLowerCase().replace(/\s*\(.*?\)\s*/g, " ").trim() };
      });
      const words = new Set([...tokens(ch.title), ...topicList.flatMap((t) => t.words)]);
      entries.push({ subject, chapter: ch.title, words, topics: topicList });
    }
  }
  const df = new Map<string, number>();
  for (const e of entries) for (const w of e.words) df.set(w, (df.get(w) ?? 0) + 1);
  const idf = new Map<string, number>();
  for (const [w, n] of df) idf.set(w, Math.log(1 + entries.length / n));
  INDEX = { entries, idf };
  return INDEX;
}

/** The catalog's chapter titles for a subject (validates manual choices). */
export function chapterTitlesFor(subject: string): string[] {
  return getMasterNcertChapters(subject).map((c) => c.title);
}

export function classifyQuestion(input: {
  statement: string;
  options?: Record<string, string> | null;
  subjectHint?: string | null;
  chapterHint?: string | null;
}): Classification {
  const { entries, idf } = buildIndex();
  const text = `${input.statement} ${Object.values(input.options || {}).join(" ")}`;
  const qWords = new Set(tokens(text));
  const lower = text.toLowerCase();
  const hint = input.subjectHint && SUBJECTS.includes(normalizeSubjectName(input.subjectHint)) ? normalizeSubjectName(input.subjectHint) : null;

  let rule: { subject: string; chapter: string } | null = null;
  try {
    const r = autoDetectNeetTaxonomy(input.statement, (input.options || undefined) as Record<string, string> | undefined, hint ?? undefined);
    if (r.chapter && r.confidence >= 70) rule = { subject: normalizeSubjectName(r.subject), chapter: r.chapter };
  } catch {
    // the rule detector is only an extra vote
  }

  const scored: ChapterCandidate[] = [];
  for (const e of entries) {
    if (hint && e.subject !== hint) continue;
    let score = 0;
    for (const w of qWords) if (e.words.has(w)) score += idf.get(w) ?? 0;
    let bestTopic: { title: string; s: number } | null = null;
    for (const t of e.topics) {
      let s = 0;
      for (const w of t.words) if (qWords.has(w)) s += idf.get(w) ?? 0;
      if (t.phrase.length > 6 && lower.includes(t.phrase)) s += 4;
      if (s > (bestTopic?.s ?? 0)) bestTopic = { title: t.title, s };
    }
    score += (bestTopic?.s ?? 0) * 0.5;
    if (input.chapterHint && e.chapter.toLowerCase() === input.chapterHint.toLowerCase()) score += 3;
    if (rule && rule.chapter.toLowerCase() === e.chapter.toLowerCase()) score += 3;
    if (score > 0) scored.push({ subject: e.subject, chapter: e.chapter, topic: bestTopic && bestTopic.s >= 2 ? bestTopic.title : null, score: Math.round(score * 10) / 10 });
  }
  scored.sort((a, b) => b.score - a.score);
  const candidates = scored.slice(0, 3);
  const top = candidates[0];
  const second = candidates[1];
  const confident = Boolean(top && top.score >= 6 && (!second || top.score >= second.score * 1.5));
  return {
    subject: top?.subject ?? hint,
    chapter: confident ? top!.chapter : null,
    topic: confident ? top!.topic : null,
    confident,
    candidates,
  };
}
