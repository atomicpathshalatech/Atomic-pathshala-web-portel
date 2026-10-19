export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public details?: Record<string, unknown>) {
    super(message);
  }
}

/** fetch + the app's { success, data | error } envelope. */
export async function api<T = any>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...(rest.headers ?? {}) } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    throw new ApiError(body?.error || `Request failed (HTTP ${res.status})`, res.status, body?.code, body?.details);
  }
  return body.data as T;
}

export const SUBJECTS = ["Physics", "Chemistry", "Biology", "Mathematics"] as const;

export type Occurrence = {
  id: string;
  year: number | null;
  session: string | null;
  shift: string | null;
  paper: string | null;
  questionNumber: string | null;
  sourcePage: number | null;
  verificationStatus: string;
  label: string;
  exam: { id: string; name: string };
};

export type LibraryItem = {
  id: string;
  questionCode: string | null;
  subject: string;
  chapter: string | null;
  topic: string | null;
  type: string;
  imageUrl: string | null;
  status: string;
  isPublished: boolean;
  solution: string | null;
  translations: { language: string; statement: string; options: unknown; correctOptionIds: unknown; solution: string | null }[];
  occurrences: Occurrence[];
};

export function optionEntries(raw: unknown): [string, string][] {
  if (Array.isArray(raw)) return raw.map((o, i) => ["ABCD"[i] ?? String(i + 1), typeof o === "string" ? o : String((o as { text?: string })?.text ?? "")]);
  if (raw && typeof raw === "object") return ["A", "B", "C", "D"].filter((k) => (raw as Record<string, unknown>)[k] !== undefined).map((k) => [k, String((raw as Record<string, unknown>)[k] ?? "")]);
  return [];
}

export function answerText(raw: unknown): string {
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return arr.map((x) => String(x)).join(", ") || "—";
}
