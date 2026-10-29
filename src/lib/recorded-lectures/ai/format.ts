/**
 * Lecture AI pass — prompts, response checks and output formats. Pure (no
 * SDK, no server import); unit tested in scripts/test-recorded-lectures.ts.
 */

export type Segment = { s: number; e: number; t: string };
export type BoardNote = { at: number; c: string };
export type LangCode = "hi" | "en";
export type VoiceChunk = { s: number; e: number; text: string; from: number; to: number };

export const LANG_NAME: Record<LangCode, string> = { hi: "हिंदी", en: "English" };

/** Which languages a lecture gets besides its original: English → Hindi, Hindi → English, mixed → both. */
export function targetLanguages(lectureLanguage: string): LangCode[] {
  const l = lectureLanguage.toLowerCase();
  if (/hindi|हिंदी|हिन्दी/.test(l)) return ["en"];
  if (/english/.test(l)) return ["hi"];
  return ["hi", "en"];
}

export function transcriptionPrompt(p: { from: number; to: number; title: string; subject: string; chapter: string; language: string }): string {
  return `This is part of a recorded classroom lecture for NEET/JEE students: "${p.title}" (${p.subject}, chapter "${p.chapter}"). The lecture is mostly in ${p.language}. You are given the part from ${fmt(p.from)} to ${fmt(p.to)} of the full video.

1. TRANSCRIPT — everything the teacher says, in order, as short sentence-level segments (2–15 seconds each):
   - "s" and "e": start and end time in SECONDS FROM THE START OF THIS PART (0 = ${fmt(p.from)}).
   - "t": exactly what is said, in the language spoken. Hindi words in Devanagari, English words in English, technical terms as said. Do not translate, summarise or correct.
   - Skip silence and non-speech; keep numbers, units and formulas as spoken.
2. BOARD — what the teacher writes or draws on the board/screen in this part:
   - "at": seconds from the start of this part when it appears.
   - "c": the content: text and headings as written; formulas, equations and chemical reactions in LaTeX inside $...$; a diagram described in one line ("Diagram: ...").
   - Only what is actually written/drawn; nothing you infer.

Return STRICT JSON only:
{"segments": [{"s": 0.0, "e": 4.2, "t": "..."}], "board": [{"at": 12.0, "c": "..."}]}`;
}

function fmt(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

/** Checks one window's answer and moves its times onto the full video's clock. */
export function parseTranscriptWindow(raw: unknown, offset: number, windowEnd: number): { segments: Segment[]; board: BoardNote[] } {
  const r = (raw && typeof raw === "object" ? raw : {}) as { segments?: unknown; board?: unknown };
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
  const board: BoardNote[] = [];
  for (const x of Array.isArray(r.board) ? r.board : []) {
    const at = Number((x as any)?.at);
    const c = typeof (x as any)?.c === "string" ? (x as any).c.trim() : "";
    if (!c || !Number.isFinite(at) || at < 0 || at > len + 2) continue;
    board.push({ at: round(offset + at), c: c.slice(0, 600) });
  }
  return { segments: segments.filter((x) => x.e > x.s), board };
}

const round = (n: number) => Math.round(n * 10) / 10;

export function translationPrompt(lines: string[], target: LangCode, subject: string): string {
  const to =
    target === "hi"
      ? `pure, simple NCERT Hindi (Devanagari) as used in NCERT Hindi-medium ${subject} textbooks — use NCERT's standard Hindi scientific terms (e.g. "सहसंयोजक आबंध", "आयनिक आबंध", "त्वरण", "कोशिका"); keep chemical formulas, symbols, units and numbers exactly as they are`
      : `clear, simple academic English as in NCERT English-medium ${subject} textbooks; keep formulas, symbols, units and numbers exactly as they are`;
  return `Translate each line of a teacher's spoken lecture into ${to}.
Rules: one output line per input line, same order, same count (${lines.length}). Keep the spoken, explaining tone (it will be read aloud to students). Do not add, drop or merge lines; do not explain. If a line is already in the target language, return it cleaned up.

INPUT LINES (JSON array):
${JSON.stringify(lines)}

Return STRICT JSON only: {"t": ["...", "..."]}`;
}

export function parseTranslation(raw: unknown, expected: number): string[] | null {
  const t = (raw && typeof raw === "object" ? (raw as { t?: unknown }).t : null) as unknown;
  if (!Array.isArray(t) || t.length !== expected) return null;
  const out = t.map((x) => (typeof x === "string" ? x.trim() : ""));
  return out.every((x) => x.length > 0) ? out : null;
}

/**
 * Groups translated segments into voice clips: consecutive speech, at most
 * ~25 s and ~450 characters, broken at pauses over 2 s. Each clip plays at
 * its original start time, so the voice follows the video sentence by sentence.
 */
export function buildVoiceChunks(segments: Segment[], texts: string[], maxSec = 25, maxChars = 450): VoiceChunk[] {
  const chunks: VoiceChunk[] = [];
  let cur: VoiceChunk | null = null;
  segments.forEach((seg, i) => {
    const text = (texts[i] ?? "").trim();
    if (!text) return;
    const gap = cur ? seg.s - cur.e : 0;
    if (cur && (gap > 2 || seg.e - cur.s > maxSec || cur.text.length + text.length > maxChars)) {
      chunks.push(cur);
      cur = null;
    }
    if (!cur) cur = { s: seg.s, e: seg.e, text, from: i, to: i };
    else {
      cur.e = seg.e;
      cur.text += ` ${text}`;
      cur.to = i;
    }
  });
  if (cur) chunks.push(cur);
  return chunks;
}

/** WebVTT subtitles for a transcript (original or translated). */
export function toVtt(segments: Segment[], texts?: string[]): string {
  const ts = (n: number) => {
    const h = Math.floor(n / 3600);
    const m = Math.floor((n % 3600) / 60);
    const s = n % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`;
  };
  const lines = ["WEBVTT", ""];
  segments.forEach((seg, i) => {
    const text = (texts ? texts[i] : seg.t)?.trim();
    if (!text) return;
    lines.push(String(i + 1), `${ts(seg.s)} --> ${ts(Math.max(seg.e, seg.s + 0.5))}`, text.replace(/-->/g, "→"), "");
  });
  return lines.join("\n");
}

/** 16-bit mono PCM (what the TTS models return) wrapped as a WAV file browsers play. */
export function pcmToWav(pcm: Uint8Array, sampleRate: number): Uint8Array {
  const header = new DataView(new ArrayBuffer(44));
  const w = (o: number, s: string) => [...s].forEach((c, i) => header.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  header.setUint32(4, 36 + pcm.length, true);
  w(8, "WAVE");
  w(12, "fmt ");
  header.setUint32(16, 16, true);
  header.setUint16(20, 1, true);
  header.setUint16(22, 1, true);
  header.setUint32(24, sampleRate, true);
  header.setUint32(28, sampleRate * 2, true);
  header.setUint16(32, 2, true);
  header.setUint16(34, 16, true);
  w(36, "data");
  header.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length);
  out.set(new Uint8Array(header.buffer), 0);
  out.set(pcm, 44);
  return out;
}

/** Playback speed that fits a clip of `audioSec` into its slot, within natural limits. */
export function fitRate(audioSec: number, slotSec: number): number {
  if (!audioSec || !slotSec) return 1;
  return Math.min(1.35, Math.max(0.9, audioSec / slotSec));
}

/** Text the summary is made from: the lecture's own speech and board, with times. */
export function lectureSourceText(segments: Segment[], board: BoardNote[], maxChars = 120_000): string {
  const items = [
    ...segments.map((s) => ({ at: s.s, line: `[${fmt(s.s)}] SAID: ${s.t}` })),
    ...board.map((b) => ({ at: b.at, line: `[${fmt(b.at)}] BOARD: ${b.c}` })),
  ].sort((a, b) => a.at - b.at);
  let out = "";
  for (const it of items) {
    if (out.length + it.line.length + 1 > maxChars) break;
    out += `${it.line}\n`;
  }
  return out.trim();
}
