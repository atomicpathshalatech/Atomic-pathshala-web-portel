import "server-only";
import { geminiKeyManager } from "@/lib/ai/gemini-key-manager";
import { normalizeText } from "@/lib/search/normalize";
import type { SearchResult } from "@/lib/search/types";

// Current Gemini Flash family, newest first. `gemini-2.0-flash` was retired
// by Google ("no longer available"); keep a short fallback chain so a single
// deprecation doesn't take the AI search down.
const MODEL_CHAIN = ["gemini-3.1-flash-lite", "gemini-3.6-flash", "gemini-3.5-flash"];

async function generate(prompt: string): Promise<string> {
  let lastErr: unknown = null;
  for (const modelName of MODEL_CHAIN) {
    try {
      return await geminiKeyManager.executeWithRotation(async (client) => {
        const model = client.getGenerativeModel({ model: modelName });
        const res = await model.generateContent(prompt);
        return res.response.text();
      });
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("All Gemini models failed");
}

export const NO_RESULT_ANSWER =
  "मुझे Atomic Pathshala records में इस combination की class नहीं मिली.";

export interface ParsedIntent {
  personName?: string;
  chapter?: string;
  subject?: string;
  /** ISO date (start of day) when the user named a single date. */
  dateFrom?: string;
  /** ISO date (end of day) — equals dateFrom's day for a single date. */
  dateTo?: string;
  keywords: string[];
  wantsClasses: boolean;
  wantsPeople: boolean;
}

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8,
  september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

/**
 * Deterministic date extraction for the common Indian phrasings, so the AI
 * never has to guess a date and we don't depend on the LLM for the one
 * thing it's worst at. Handles "10 September", "10 Sep 2026",
 * "September 10", "10/09/2026", "2026-09-10". Year defaults to the current
 * year, or previous year if that date would be in the future.
 */
export function parseDateRange(raw: string, now = new Date()): { from: Date; to: Date } | null {
  const s = normalizeText(raw);

  // ISO  yyyy-mm-dd
  const iso = s.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) return dayRange(new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));

  // dd/mm/yyyy or dd-mm-yyyy (also dd/mm)
  const dmy = s.match(/\b(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?\b/);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]) - 1;
    let y = dmy[3] ? Number(dmy[3]) : now.getFullYear();
    if (y < 100) y += 2000;
    if (m >= 0 && m <= 11 && d >= 1 && d <= 31) {
      let dt = new Date(y, m, d);
      if (!dmy[3] && dt.getTime() > now.getTime() + 86400000) dt = new Date(y - 1, m, d);
      return dayRange(dt);
    }
  }

  // "10 september [2026]"  /  "september 10 [2026]"
  const words = s.split(" ");
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w && w in MONTHS) {
      const month = MONTHS[w] as number;
      const prev = words[i - 1];
      const next = words[i + 1];
      const dayStr = /^\d{1,2}$/.test(prev ?? "") ? prev : /^\d{1,2}$/.test(next ?? "") ? next : null;
      if (dayStr) {
        const day = Number(dayStr);
        const yearCand = [words[i + 1], words[i + 2], words[i - 2]].find((x) => /^\d{4}$/.test(x ?? ""));
        let year = yearCand ? Number(yearCand) : now.getFullYear();
        let dt = new Date(year, month, day);
        if (!yearCand && dt.getTime() > now.getTime() + 86400000) dt = new Date(year - 1, month, day);
        if (day >= 1 && day <= 31) return dayRange(dt);
      }
    }
  }

  if (/\btoday\b|\baaj\b/.test(s)) return dayRange(now);
  if (/\byesterday\b|\bkal\b/.test(s)) return dayRange(new Date(now.getTime() - 86400000));
  return null;
}

function dayRange(d: Date): { from: Date; to: Date } {
  const from = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const to = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { from, to };
}

function safeJson<T>(text: string): T | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}

/** LLM-assisted intent parse with a hard deterministic fallback. */
export async function parseIntent(query: string): Promise<ParsedIntent> {
  const dr = parseDateRange(query);
  const fallback: ParsedIntent = {
    keywords: normalizeText(query).split(" ").filter(Boolean),
    dateFrom: dr?.from.toISOString(),
    dateTo: dr?.to.toISOString(),
    wantsClasses: /\bclass|lecture|padha|padhaya|padhai|kab|when|recording|schedule\b/i.test(query),
    wantsPeople: /\bsir|maam|teacher|faculty|profile|kaun\b/i.test(query),
  };

  try {
    const prompt = `Extract search intent from this question about the Atomic Pathshala LMS. Return ONLY minified JSON with keys: personName (a human name if one is mentioned, else null), chapter (a chapter/topic name if mentioned, else null), subject (Physics/Chemistry/Biology/Mathematics if mentioned, else null), keywords (array of the most useful search words), wantsClasses (boolean - is the user asking about a class/lecture/schedule/recording), wantsPeople (boolean - is the user asking about a person/teacher/profile). Do NOT invent dates. Question: """${query}"""`;
    const text = await generate(prompt);
    const parsed = safeJson<Partial<ParsedIntent>>(text);
    if (!parsed) return fallback;
    return {
      personName: parsed.personName || undefined,
      chapter: parsed.chapter || undefined,
      subject: parsed.subject || undefined,
      dateFrom: fallback.dateFrom,
      dateTo: fallback.dateTo,
      keywords:
        Array.isArray(parsed.keywords) && parsed.keywords.length > 0
          ? parsed.keywords.map(String)
          : fallback.keywords,
      wantsClasses: parsed.wantsClasses ?? fallback.wantsClasses,
      wantsPeople: parsed.wantsPeople ?? fallback.wantsPeople,
    };
  } catch (e) {
    console.warn("[search/ai] intent parse fell back:", e instanceof Error ? e.message : e);
    return fallback;
  }
}

/**
 * Compose a short answer STRICTLY from the retrieved rows. If there are no
 * rows the caller should not even call this — it returns NO_RESULT_ANSWER
 * defensively anyway.
 */
export async function composeAnswer(query: string, sources: SearchResult[]): Promise<string> {
  if (sources.length === 0) return NO_RESULT_ANSWER;

  const data = sources.slice(0, 12).map((s) => ({
    type: s.type,
    title: s.title,
    subtitle: s.subtitle,
    ...s.meta,
  }));

  const prompt = `You are the Atomic Pathshala search assistant. Answer the user's question using ONLY the DATA array below — never add facts that are not present in it. Keep it to 1-3 sentences. Match the user's language (Hindi/English/Hinglish). If the DATA does not actually answer the question, reply exactly with: "${NO_RESULT_ANSWER}". Do not mention the word "DATA" or JSON.

QUESTION: """${query}"""

DATA: ${JSON.stringify(data)}`;

  try {
    const text = await generate(prompt);
    const answer = text.trim();
    return answer.length > 0 ? answer : NO_RESULT_ANSWER;
  } catch (e) {
    console.warn("[search/ai] compose fell back to raw list:", e instanceof Error ? e.message : e);
    // Deterministic, still grounded: describe the top hit.
    const top = sources[0];
    if (!top) return NO_RESULT_ANSWER;
    return `${top.title}${top.subtitle ? ` — ${top.subtitle}` : ""}`;
  }
}
