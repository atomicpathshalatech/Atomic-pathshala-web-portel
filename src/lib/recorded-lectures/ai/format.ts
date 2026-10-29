/**
 * Lecture AI pass — prompts, response checks and output formats. Pure (no
 * SDK, no server import); unit tested in scripts/test-recorded-lectures.ts.
 *
 * The AI reads the video for three things: what the teacher says (timed),
 * what is written/drawn on the board, and what the teacher dictates for
 * students to write down ("ye likh lo…"). The class notes are made from the
 * board and the dictation; the speech is context and the subtitles.
 */

export type Segment = { s: number; e: number; t: string };
export type BoardNote = { at: number; c: string };
/** Something the teacher dictated for the students' copies, as dictated. */
export type DictatedNote = { at: number; c: string };

export function transcriptionPrompt(p: { from: number; to: number; title: string; subject: string; chapter: string; language: string }): string {
  return `This is part of a recorded classroom lecture for NEET/JEE students: "${p.title}" (${p.subject}, chapter "${p.chapter}"). The lecture is mostly in ${p.language}. You are given the part from ${fmt(p.from)} to ${fmt(p.to)} of the full video.

All times below are in SECONDS FROM THE START OF THIS PART (0 = ${fmt(p.from)}).

1. "segments" — everything the teacher says, in order, as short sentence-level segments (2–15 s):
   {"s": start, "e": end, "t": exactly what is said, in the language spoken (Hindi in Devanagari, English in English, technical terms as said)}.
   Do not translate, summarise or correct. Skip silence and non-speech.
2. "board" — everything the teacher WRITES or DRAWS on the board/screen in this part, read carefully from the frames:
   {"at": when it appears, "c": the content exactly as written}.
   - Headings, definitions, points, labels: word for word as written (keep the teacher's language and spelling).
   - Formulas, equations, units, chemical formulas and reactions in LaTeX inside $...$ (e.g. $\\text{CH}_4 + 2\\text{O}_2 \\rightarrow \\text{CO}_2 + 2\\text{H}_2\\text{O}$).
   - A diagram, graph or table: "Diagram: <what it shows, its labels>" / "Table: <rows>" in one entry.
   - When the board is erased and rewritten, list the new writing again. When the same writing stays on screen, list it once.
   - If part of the board is unreadable, write "[unclear]" for that part — never guess.
3. "dictated" — what the teacher DICTATES for the students to write in their copies: when they say "likho", "likh lo", "note kar lo", "write this down", "copy mein likho", or slowly speak a definition/point for writing.
   {"at": when it starts, "c": the dictated text, cleaned of filler words, in the language spoken}.
   Only real dictation — not ordinary explanation.

Return STRICT JSON only:
{"segments": [{"s": 0.0, "e": 4.2, "t": "..."}], "board": [{"at": 12.0, "c": "..."}], "dictated": [{"at": 30.0, "c": "..."}]}`;
}

function fmt(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

const round = (n: number) => Math.round(n * 10) / 10;

function timedNotes(list: unknown, offset: number, len: number): { at: number; c: string }[] {
  const out: { at: number; c: string }[] = [];
  for (const x of Array.isArray(list) ? list : []) {
    const at = Number((x as any)?.at);
    const c = typeof (x as any)?.c === "string" ? (x as any).c.trim() : "";
    if (!c || !Number.isFinite(at) || at < 0 || at > len + 2) continue;
    out.push({ at: round(offset + at), c: c.slice(0, 1200) });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** Checks one window's answer and moves its times onto the full video's clock. */
export function parseTranscriptWindow(raw: unknown, offset: number, windowEnd: number): { segments: Segment[]; board: BoardNote[]; dictated: DictatedNote[] } {
  const r = (raw && typeof raw === "object" ? raw : {}) as { segments?: unknown; board?: unknown; dictated?: unknown };
  const len = windowEnd - offset;
  const segments: Segment[] = [];
  for (const x of Array.isArray(r.segments) ? r.segments : []) {
    const s = Number((x as any)?.s);
    const e = Number((x as any)?.e);
    const t = typeof (x as any)?.t === "string" ? (x as any).t.trim() : "";
    if (!t || !Number.isFinite(s) || !Number.isFinite(e) || s < 0 || s > len + 2) continue;
    const start = offset + s;
    const end = offset + Math.min(Math.max(e, s + 0.5), len + 2);
    segments.push({ s: round(start), e: round(end), t: t.slice(0, 800) });
  }
  segments.sort((a, b) => a.s - b.s);
  // No overlaps: a segment ends where the next begins.
  for (let i = 0; i < segments.length - 1; i++) {
    if (segments[i]!.e > segments[i + 1]!.s) segments[i]!.e = segments[i + 1]!.s;
  }
  return {
    segments: segments.filter((x) => x.e > x.s),
    board: timedNotes(r.board, offset, len),
    dictated: timedNotes(r.dictated, offset, len),
  };
}

/** WebVTT subtitles of what was said. */
export function toVtt(segments: Segment[]): string {
  const ts = (n: number) => {
    const h = Math.floor(n / 3600);
    const m = Math.floor((n % 3600) / 60);
    const s = n % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`;
  };
  const lines = ["WEBVTT", ""];
  segments.forEach((seg, i) => {
    const text = seg.t.trim();
    if (!text) return;
    lines.push(String(i + 1), `${ts(seg.s)} --> ${ts(Math.max(seg.e, seg.s + 0.5))}`, text.replace(/-->/g, "→"), "");
  });
  return lines.join("\n");
}

/** Text the summary is made from: the lecture's own speech, board and dictation, with times. */
export function lectureSourceText(segments: Segment[], board: BoardNote[], dictated: DictatedNote[] = [], maxChars = 120_000): string {
  const items = [
    ...segments.map((s) => ({ at: s.s, line: `[${fmt(s.s)}] SAID: ${s.t}` })),
    ...board.map((b) => ({ at: b.at, line: `[${fmt(b.at)}] BOARD: ${b.c}` })),
    ...dictated.map((d) => ({ at: d.at, line: `[${fmt(d.at)}] DICTATED: ${d.c}` })),
  ].sort((a, b) => a.at - b.at);
  let out = "";
  for (const it of items) {
    if (out.length + it.line.length + 1 > maxChars) break;
    out += `${it.line}\n`;
  }
  return out.trim();
}

/**
 * What the notes are made from: everything written on the board and
 * everything dictated, in order. The speech is not included (it would turn
 * the notes into a transcript); only the board and the dictation.
 */
export function notesSourceText(board: BoardNote[], dictated: DictatedNote[], maxChars = 100_000): string {
  const items = [
    ...board.map((b) => ({ at: b.at, line: `[${fmt(b.at)}] BOARD: ${b.c}` })),
    ...dictated.map((d) => ({ at: d.at, line: `[${fmt(d.at)}] DICTATED: ${d.c}` })),
  ].sort((a, b) => a.at - b.at);
  let out = "";
  for (const it of items) {
    if (out.length + it.line.length + 1 > maxChars) break;
    out += `${it.line}\n`;
  }
  return out.trim();
}

export function buildNotesPrompt(p: { source: string; title: string; subject: string; chapter: string; language: string }): string {
  const hindi = /hindi|हिंदी|हिन्दी/i.test(p.language);
  return `You are making a student's class-notes copy from a recorded NEET/JEE lecture: "${p.title}" (${p.subject}, chapter "${p.chapter}").

SOURCE — everything the teacher WROTE ON THE BOARD (BOARD) and DICTATED for students to write (DICTATED), in time order:
"""
${p.source}
"""

Write the notes exactly as a good student's notebook would have them after this class:
- ONLY what is in the source. Do not add any concept, definition, formula, reaction, example, number or fact the teacher did not write or dictate. Do not explain beyond what was written. Do not "correct" the teacher.
- Keep the teacher's words for definitions and dictated points; you may fix obvious spelling and put things in order.
- Remove repeats (the same board writing seen twice).
- Structure: "### " for each topic heading as the teacher used them; "- " for points; "1. " for steps; "> " for a line the teacher stressed as important / a note / a trick.
- Every formula, equation, unit, chemical formula and reaction in LaTeX inside $...$, copied exactly. Only standard KaTeX commands; symbols such as ♀ ♂ ✓ ✗ as plain characters. A chain of words with arrows (Gene → RNA → Protein) is plain text with →, not LaTeX.
- "**term**" for the word a definition defines; sub-points indented by two spaces under their point.
- A diagram the teacher drew: one line "[Diagram: <what it shows, with its labels>]" where it came.
- "[unclear]" in the source stays "[unclear]".
- Language: ${hindi ? "as the teacher wrote/dictated it (Hindi in Devanagari; keep English technical terms the teacher used)" : "as the teacher wrote/dictated it (English; keep Hindi words the teacher used)"}.
- If the source has nothing a student would write in notes, set "empty": true.

Return STRICT JSON only: {"empty": false, "markdown": "### ...\\n- ..."}`;
}

/** The notes answer: Markdown with at least one heading or point. */
export function parseNotesResponse(raw: unknown): { ok: true; markdown: string } | { ok: false; empty: boolean; error: string } {
  const r = (raw && typeof raw === "object" ? raw : {}) as { empty?: unknown; markdown?: unknown };
  if (r.empty === true) return { ok: false, empty: true, error: "The AI found nothing written or dictated for notes in this lecture." };
  const md = typeof r.markdown === "string" ? r.markdown.replace(/\r\n/g, "\n").trim() : "";
  if (!md) return { ok: false, empty: false, error: "The AI returned no notes." };
  if (!/^(###\s|- |\d+\.\s|>\s)/m.test(md)) return { ok: false, empty: false, error: "The AI notes had no headings or points — try again." };
  return { ok: true, markdown: md.slice(0, 30000) };
}
