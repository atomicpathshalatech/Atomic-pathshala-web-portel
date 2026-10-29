/**
 * Lecture summary — prompt, response checks and Markdown output. Pure (no
 * SDK, no server import) so it is unit tested in scripts/test-recorded-lectures.ts.
 */

export const SUMMARY_SECTIONS = [
  { key: "topics", en: "Topics Covered", hi: "पढ़ाए गए विषय" },
  { key: "concepts", en: "Important Concepts", hi: "महत्वपूर्ण अवधारणाएँ" },
  { key: "definitions", en: "Important Definitions", hi: "महत्वपूर्ण परिभाषाएँ" },
  { key: "formulas", en: "Important Formulas & Reactions", hi: "महत्वपूर्ण सूत्र और अभिक्रियाएँ" },
  { key: "examPoints", en: "Exam-Oriented Points", hi: "परीक्षा के लिए महत्वपूर्ण बिंदु" },
  { key: "examples", en: "Examples & Applications", hi: "उदाहरण और अनुप्रयोग" },
  { key: "mistakes", en: "Common Mistakes", hi: "आम गलतियाँ" },
  { key: "checklist", en: "Revision Checklist", hi: "रिवीज़न चेकलिस्ट" },
  { key: "homework", en: "Homework / Next Steps", hi: "गृहकार्य / आगे क्या करें" },
] as const;

export type SummaryKey = (typeof SUMMARY_SECTIONS)[number]["key"];

/** Below this the About cannot carry a reliable summary. */
export const MIN_ABOUT_WORDS = 25;

export function aboutWordCount(about: string): number {
  return about.trim().split(/\s+/).filter(Boolean).length;
}

export function isHindi(language: string | null | undefined): boolean {
  return /hindi|हिंदी|हिन्दी/i.test(String(language ?? ""));
}

export function buildSummaryPrompt(p: {
  about: string;
  title: string;
  subject: string;
  chapter: string;
  language: string;
}): string {
  const hindi = isHindi(p.language);
  return `You turn a teacher's own notes about a recorded lecture into a short, student-friendly summary for NEET/JEE students.

LECTURE: "${p.title}" — ${p.subject}, chapter "${p.chapter}". Language: ${p.language}.

THE TEACHER'S NOTES (the ONLY source):
"""
${p.about}
"""

STRICT RULES
- Use ONLY what the notes say. You may reorganise, shorten and phrase it clearly. Do NOT add concepts, formulas, reactions, definitions, examples, numbers, NCERT page numbers or claims that are not in the notes. If a formula or reaction in the notes is incomplete, copy it as written — do not complete or "correct" it.
- Put an item in a section only when the notes support it. Leave a section out (empty list) when the notes say nothing for it. Never invent homework.
- "checklist": 3–8 short "Can I…?" / "Revise…" items built only from the notes' own content.
- Formulas, equations, chemical formulas, units and symbols in LaTeX inside $...$ (e.g. $\\text{H}_2\\text{SO}_4$, $v = u + at$, $\\Delta G = \\Delta H - T\\Delta S$).
- Write in ${hindi ? "Hindi (Devanagari), keeping scientific terms and formulas as commonly written" : "simple English"}.
- If the notes are too short, vague or off-topic to summarise reliably, set "insufficient": true and say in "reason" what the teacher should add.

Return STRICT JSON only:
{"insufficient": false, "reason": "", "sections": {"topics": [], "concepts": [], "definitions": [], "formulas": [], "examPoints": [], "examples": [], "mistakes": [], "checklist": [], "homework": []}}`;
}

export type ParsedSummary =
  | { ok: true; sections: Partial<Record<SummaryKey, string[]>> }
  | { ok: false; insufficient: boolean; error: string };

/** Checks the model's JSON: known sections only, non-empty strings, something to show. */
export function parseSummaryResponse(raw: unknown): ParsedSummary {
  if (!raw || typeof raw !== "object") return { ok: false, insufficient: false, error: "The AI returned no summary." };
  const r = raw as { insufficient?: unknown; reason?: unknown; sections?: unknown };
  if (r.insufficient === true) {
    const reason = typeof r.reason === "string" && r.reason.trim() ? r.reason.trim().slice(0, 400) : "Add more detail about what was taught.";
    return { ok: false, insufficient: true, error: reason };
  }
  if (!r.sections || typeof r.sections !== "object") return { ok: false, insufficient: false, error: "The AI response had no sections." };
  const sections: Partial<Record<SummaryKey, string[]>> = {};
  let total = 0;
  for (const { key } of SUMMARY_SECTIONS) {
    const list = (r.sections as Record<string, unknown>)[key];
    if (!Array.isArray(list)) continue;
    const items = list
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.replace(/\s+\n/g, "\n").trim())
      .filter((x) => x.length > 0)
      .slice(0, 25)
      .map((x) => x.slice(0, 600));
    if (items.length) {
      sections[key] = items;
      total += items.length;
    }
  }
  if (total === 0) return { ok: false, insufficient: true, error: "The notes did not give enough to summarise. Add what was taught." };
  if (!sections.topics?.length && !sections.concepts?.length) {
    return { ok: false, insufficient: false, error: "The AI summary named no topics or concepts — try again or add detail to the About." };
  }
  return { ok: true, sections };
}

/** Markdown the teacher edits and students read (KaTeX renders the $…$). */
export function summaryToMarkdown(sections: Partial<Record<SummaryKey, string[]>>, language: string): string {
  const hindi = isHindi(language);
  const out: string[] = [];
  for (const s of SUMMARY_SECTIONS) {
    const items = sections[s.key];
    if (!items?.length) continue;
    out.push(`### ${hindi ? s.hi : s.en}`);
    for (const item of items) out.push(s.key === "checklist" ? `- [ ] ${item}` : `- ${item}`);
    out.push("");
  }
  return out.join("\n").trim();
}

/**
 * Summary from the lecture itself: what the teacher said and wrote on the
 * board (timed), plus the teacher's About as a hint. Same rule: only what
 * the lecture contains.
 */
export function buildVideoSummaryPrompt(p: {
  source: string;
  about: string | null;
  title: string;
  subject: string;
  chapter: string;
  language: string;
}): string {
  const hindi = isHindi(p.language);
  return `You turn a recorded classroom lecture into a short, student-friendly summary for NEET/JEE students.

LECTURE: "${p.title}" — ${p.subject}, chapter "${p.chapter}".

WHAT HAPPENED IN THE LECTURE (the source — SAID = the teacher's words, BOARD = what was written/drawn, with times):
"""
${p.source}
"""
${p.about?.trim() ? `\nTHE TEACHER'S OWN NOTE ABOUT THE LECTURE (a hint, same rules):\n"""\n${p.about.trim()}\n"""\n` : ""}
STRICT RULES
- Use ONLY what the lecture contains (speech and board). You may reorganise, shorten and phrase it clearly. Do NOT add concepts, formulas, reactions, definitions, examples, numbers or NCERT page numbers that the teacher did not say or write.
- Prefer what was written on the BOARD for formulas, reactions and definitions; copy them as written (LaTeX in $...$).
- Put an item in a section only when the lecture supports it; leave other sections empty. Never invent homework.
- "checklist": 3–8 short "Can I…?" / "Revise…" items from the lecture's own content.
- Formulas, equations, chemical formulas, units and symbols in LaTeX inside $...$.
- Write in ${hindi ? "Hindi (Devanagari), keeping scientific terms and formulas as commonly written" : "simple English"}.
- If the source is too short or unclear to summarise reliably, set "insufficient": true and say why in "reason".

Return STRICT JSON only:
{"insufficient": false, "reason": "", "sections": {"topics": [], "concepts": [], "definitions": [], "formulas": [], "examPoints": [], "examples": [], "mistakes": [], "checklist": [], "homework": []}}`;
}
