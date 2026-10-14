"use client";

import React from "react";
import { Check } from "lucide-react";
import { FormulaText } from "@/components/test-portal/FormulaText";

/**
 * The building blocks of the question review page: one card per language
 * (numbered options, the key in green, an ANSWER bar and a SOLUTION box) and
 * small labelled "chip" cards for classification, source and usage.
 */

export type ReviewTranslation = {
  id: string;
  language: string;
  statement: string;
  options?: unknown;
  correctOptionIds?: unknown;
  solution?: string | null;
};

const LANGUAGE_TAG: Record<string, string> = { ENGLISH: "EN", HINDI: "HI", GUJARATI: "GU", MARATHI: "MR", BENGALI: "BN" };
export const languageTag = (language: string) => LANGUAGE_TAG[language.toUpperCase()] ?? language.slice(0, 2).toUpperCase();

/** Options in display order as [key, text]; accepts the {A: "..."} object and the array forms. */
export function optionEntries(raw: unknown): [string, string][] {
  if (Array.isArray(raw)) {
    return raw
      .map((o, i): [string, string] | null => {
        if (typeof o === "string") return [String.fromCharCode(65 + i), o];
        if (o && typeof o === "object") {
          const r = o as Record<string, unknown>;
          return [String(r.key ?? r.id ?? String.fromCharCode(65 + i)).toUpperCase(), String(r.text ?? r.value ?? "")];
        }
        return null;
      })
      .filter((x): x is [string, string] => x !== null);
  }
  if (raw && typeof raw === "object") return Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k.toUpperCase(), String(v ?? "")]);
  return [];
}

export function answerKeys(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : raw == null || raw === "" ? [] : [raw];
  return list.map((x) => String(x).trim().toUpperCase()).filter(Boolean);
}

/** Option letter → the number shown to reviewers: A → (1). A value answer stays as it is. */
const optionNumber = (key: string, index: number) => (/^[A-Z]$/.test(key) ? key.charCodeAt(0) - 64 : index + 1);

export function LanguageQuestionCard({ t, showLanguageTag, imageUrl }: { t: ReviewTranslation; showLanguageTag: boolean; imageUrl?: string | null }) {
  const options = optionEntries(t.options);
  const keys = answerKeys(t.correctOptionIds);
  const answerLabel = options.length
    ? keys.map((k) => {
        const i = options.findIndex(([ok]) => ok === k);
        return i >= 0 ? `(${optionNumber(k, i)})` : k;
      }).join(", ")
    : keys.join(", ");

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
      <div className="flex items-start gap-3">
        {showLanguageTag && (
          <span className="mt-1 px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
            {languageTag(t.language)}
          </span>
        )}
        <div className="text-base sm:text-[17px] leading-relaxed text-slate-900 dark:text-white flex-1 min-w-0">
          <FormulaText text={t.statement || "(no question text)"} />
        </div>
      </div>

      {imageUrl && (
        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 max-w-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Question figure" className="rounded-lg object-contain max-h-72 w-full" />
        </div>
      )}

      {options.length > 0 && (
        <ol className="space-y-1.5">
          {options.map(([key, text], i) => {
            const correct = keys.includes(key);
            return (
              <li key={key} className={`flex items-start gap-3 rounded-lg px-1.5 py-1 ${correct ? "text-emerald-700 dark:text-emerald-300" : "text-slate-800 dark:text-slate-200"}`}>
                <span className="font-bold tabular-nums w-7 shrink-0">({optionNumber(key, i)})</span>
                <div className={`flex-1 min-w-0 ${correct ? "font-semibold" : ""}`}>
                  <FormulaText text={text || `Option ${key}`} />
                </div>
                {correct && <Check className="w-5 h-5 shrink-0 text-emerald-600" aria-label="correct answer" />}
              </li>
            );
          })}
        </ol>
      )}

      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2.5">
        <span className="text-[11px] font-black tracking-[0.12em] text-emerald-700 dark:text-emerald-300">ANSWER:</span>
        <span className="font-bold text-emerald-800 dark:text-emerald-200">{answerLabel || "not set"}</span>
      </div>

      <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3 space-y-1.5">
        <span className="text-[11px] font-black tracking-[0.12em] text-orange-700 dark:text-orange-300">SOLUTION</span>
        <div className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
          {t.solution?.trim() ? <FormulaText text={t.solution} /> : <span className="text-slate-400 italic">No solution written for this language.</span>}
        </div>
      </div>
    </section>
  );
}

export type Chip = { label: string; value: React.ReactNode };

/** A titled card of label/value chips, in optional groups (e.g. ACADEMIC, EXAM & DIFFICULTY). Empty values are left out. */
export function ChipCard({
  title,
  groups,
  action,
  tone = "plain",
}: {
  title: string;
  groups: { heading?: string; chips: Chip[] }[];
  action?: React.ReactNode;
  tone?: "plain" | "highlight";
}) {
  const visible = groups.map((g) => ({ ...g, chips: g.chips.filter((c) => c.value !== null && c.value !== undefined && c.value !== "") })).filter((g) => g.chips.length > 0);
  return (
    <section
      className={`rounded-2xl p-5 space-y-3 border shadow-sm ${
        tone === "highlight" ? "bg-slate-50 dark:bg-slate-900 border-indigo-300 dark:border-indigo-800" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-black tracking-[0.14em] text-slate-600 dark:text-slate-300">{title.toUpperCase()}</h3>
        {action}
      </div>
      {visible.length === 0 ? (
        <p className="text-xs text-slate-400">Nothing recorded.</p>
      ) : (
        visible.map((g, gi) => (
          <div key={gi} className={`space-y-2 ${gi > 0 ? "pt-3 border-t border-slate-200 dark:border-slate-800" : ""}`}>
            {g.heading && <div className="text-[10px] font-black tracking-[0.14em] text-slate-500">{g.heading.toUpperCase()}</div>}
            <div className="flex flex-wrap gap-2">
              {g.chips.map((c) => (
                <span key={c.label} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-sm">
                  <span className="text-[10px] font-black tracking-wider text-slate-500 uppercase">{c.label}</span>
                  <span className="text-slate-900 dark:text-slate-100">{c.value}</span>
                </span>
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}

export const humanize = (value: string | null | undefined) =>
  value ? value.replace(/_/g, " ").toLowerCase().replace(/(^|\s)\S/g, (s) => s.toUpperCase()) : "";

export const fmtDateTime = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "";
