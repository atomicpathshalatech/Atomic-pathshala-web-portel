"use client";

import { useState } from "react";
import { SummaryView } from "./SummaryView";
import { HandwrittenNotes } from "./HandwrittenNotes";

/** Published summaries (or class notes), one per language: tabs when there is more than one. */
export function SummaryLanguageTabs({ summaries, handwritten = false }: { summaries: { language: string; content: string }[]; handwritten?: boolean }) {
  const [active, setActive] = useState(0);
  const label = (l: string) => (/hindi|हिंदी|हिन्दी/i.test(l) ? "हिंदी" : l || "English");
  const current = summaries[Math.min(active, summaries.length - 1)];
  if (!current) return null;
  return (
    <div className="space-y-3">
      {summaries.length > 1 && (
        <div role="tablist" aria-label="Summary language" className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
          {summaries.map((s, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={`rounded-md px-3 py-1 text-xs font-bold ${i === active ? "bg-blue-600 text-white" : "text-slate-600 dark:text-slate-300"}`}
            >
              {label(s.language)}
            </button>
          ))}
        </div>
      )}
      {handwritten ? <HandwrittenNotes markdown={current.content} /> : <SummaryView markdown={current.content} />}
    </div>
  );
}
