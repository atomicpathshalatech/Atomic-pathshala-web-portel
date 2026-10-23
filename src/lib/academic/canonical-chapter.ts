import { getMasterNcertChapters, normalizeSubjectName } from "@/lib/academic/master-ncert-catalog";

/**
 * One standard chapter list everywhere: the NCERT master catalog.
 *
 * Questions, tests, DPPs and imports wrote chapters however they came —
 * "Cell - The Unit of Life", "Cell: The Unit of Life", "कोशिका: जीवन की इकाई",
 * "[Class 11] Ch 8: …", or a topic such as "Optical Isomerism" in the
 * chapter field — so the same chapter showed up several times and filters
 * and assignments missed questions. canonicalChapter() maps any of these to
 * the master chapter's title (and, when the name was really a topic, keeps it
 * as a topic hint). Names that match nothing are left as they are.
 */

export type CanonicalChapter = {
  subject: string;
  chapter: string;
  classNumber: number;
  chapterNumber: number;
  /** The input named a topic of this chapter rather than the chapter itself. */
  topicHint?: string;
  how: "exact" | "alias" | "fuzzy";
};

/** Letters (any script) and digits only, lower-case; prefixes like "[Class 11] Ch 8:" removed. */
export function chapterKey(name: string | null | undefined): string {
  return String(name ?? "")
    .normalize("NFKC")
    .replace(/^\s*\[\s*class\s*\d+\s*\]\s*/i, "")
    .replace(/^\s*(?:ch(?:apter)?\.?\s*\d+\s*[:.\-–]?\s*)/i, "")
    .replace(/^\s*\d+\s*[.:\-–)]\s*/, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim();
}

const STOP = new Set(["and", "of", "the", "in", "its", "their", "some", "a", "an"]);
const words = (key: string) => new Set(key.split(" ").filter((w) => w && !STOP.has(w)));

const GOC = "Organic Chemistry – Some Basic Principles and Techniques";

/**
 * Known other names → the NCERT chapter. `topic` marks names that are really
 * a topic of that chapter (kept as the question's topic hint).
 */
const ALIAS_SOURCE: Record<string, Array<[name: string, chapter: string, topic?: true]>> = {
  Chemistry: [
    ["Optical Isomerism", GOC, true],
    ["Structural and Geometrical Isomerism", GOC, true],
    ["Some Basic Concepts of Chemistry - Isomerism", GOC, true],
    ["Some Basic Concepts of Chemistry - Sterio isomerism", GOC, true],
    ["Some Basic Concepts of Chemistry - Stereo isomerism", GOC, true],
    ["Classification and Nomenclature", GOC, true],
    ["Some Basic Concepts of Organic Chemistry", GOC],
    ["Some Basic Principles and Techniques", GOC],
    ["Some Basic Principles of Organic Chemistry", GOC],
    ["Organic Chemistry - Some Basic Principles", GOC],
    ["GOC", GOC],
    ["Amines and Nitrogen Compounds", "Amines"],
    ["Periodic Table", "Classification of Elements and Periodicity in Properties", true],
  ],
  Physics: [
    ["Mathematical Methods", "Basic Mathematics"],
    ["Mathematical Tools", "Basic Mathematics"],
  ],
  // Hindi chapter names as written in our Hindi-medium material.
  Biology: [
    ["उत्सर्जन उत्पाद और उनका निष्कासन", "Excretory Products and their Elimination"],
    ["जैव प्रौद्योगिकी: सिद्धांत और प्रक्रियाएं", "Biotechnology: Principles and Processes"],
    ["जैव प्रौद्योगिकी: सिद्धांत एवं प्रक्रम", "Biotechnology: Principles and Processes"],
    ["तंत्रिकीय नियंत्रण और समन्वय", "Neural Control and Coordination"],
    ["पादप वृद्धि और परिवर्धन", "Plant Growth and Development"],
    ["पादप वृद्धि और विकास", "Plant Growth and Development"],
    ["पादपों में श्वसन", "Respiration in Plants"],
    ["पारिस्थितिक तंत्र", "Ecosystem"],
    ["पारिस्थितिकी तंत्र", "Ecosystem"],
    ["मानव स्वास्थ्य और रोग", "Human Health and Disease"],
    ["रासायनिक समन्वय और एकीकरण", "Chemical Coordination and Integration"],
    ["वंशागति और विविधता के सिद्धांत", "Principles of Inheritance and Variation"],
    ["वंशागति का आणविक आधार", "Molecular Basis of Inheritance"],
    ["शरीर द्रव और परिसंचरण", "Body Fluids and Circulation"],
  ],
};

const ALIASES: Record<string, Map<string, { chapter: string; topic: boolean }>> = Object.fromEntries(
  Object.entries(ALIAS_SOURCE).map(([subject, list]) => [
    subject,
    new Map(list.map(([name, chapter, topic]) => [chapterKey(name), { chapter, topic: Boolean(topic) }])),
  ])
);

/** Botany / Zoology / "Biology (Botany)" … → Biology; Physics, Chemistry as they are. */
export function canonicalSubject(subject: string | null | undefined): string {
  const s = String(subject ?? "").trim();
  return s ? normalizeSubjectName(s) : s;
}

export function canonicalChapter(subject: string | null | undefined, name: string | null | undefined): CanonicalChapter | null {
  const subj = canonicalSubject(subject);
  const key = chapterKey(name);
  if (!subj || !key) return null;
  const master = getMasterNcertChapters(subj);
  if (master.length === 0) return null;
  const out = (m: (typeof master)[number], how: CanonicalChapter["how"], topicHint?: string): CanonicalChapter => ({
    subject: subj,
    chapter: m.title,
    classNumber: m.classNumber,
    chapterNumber: m.chapterNumber,
    how,
    ...(topicHint ? { topicHint } : {}),
  });

  // 1. Same title (English or Hindi) once punctuation and prefixes are ignored.
  const exact = master.find((m) => chapterKey(m.title) === key || (m.titleHindi && chapterKey(m.titleHindi) === key));
  if (exact) return out(exact, "exact");

  // 2. A known alias (often a topic used as the chapter).
  const alias = ALIASES[subj]?.get(key);
  if (alias) {
    const m = master.find((x) => x.title === alias.chapter);
    // "Some Basic Concepts of Chemistry - Isomerism" → topic "Isomerism".
    const topic = alias.topic ? String(name ?? "").trim().split(/\s+[-–]\s+/).pop()?.trim() : undefined;
    if (m) return out(m, "alias", topic || undefined);
  }

  // 3. Nearly the same words, and clearly closer to one chapter than any other.
  const mine = words(key);
  if (mine.size === 0) return null;
  const scored = master
    .map((m) => {
      const theirs = words(chapterKey(m.title));
      let common = 0;
      for (const w of mine) if (theirs.has(w)) common++;
      const union = mine.size + theirs.size - common;
      return { m, score: union ? common / union : 0 };
    })
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  const second = scored[1];
  if (best && best.score >= 0.75 && (!second || best.score - second.score >= 0.2)) return out(best.m, "fuzzy");
  return null;
}

/** The chapter title to store: the master title when one matches, else the name as given. */
export function standardChapterTitle(subject: string | null | undefined, name: string | null | undefined): string | null | undefined {
  if (typeof name !== "string" || !name.trim()) return name;
  return canonicalChapter(subject, name)?.chapter ?? name.trim();
}
