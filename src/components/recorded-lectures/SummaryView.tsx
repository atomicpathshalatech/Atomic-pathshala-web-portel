"use client";

import { FormulaText } from "@/components/test-portal/FormulaText";

type Block = { kind: "heading"; text: string } | { kind: "item"; text: string; check: boolean } | { kind: "para"; text: string };

function toBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const h = line.match(/^#{1,6}\s+(.*)$/);
    if (h) {
      blocks.push({ kind: "heading", text: h[1]! });
      continue;
    }
    const item = line.match(/^[-*]\s+(\[[ xX]\]\s+)?(.*)$/);
    if (item) {
      blocks.push({ kind: "item", text: item[2]!, check: Boolean(item[1]) });
      continue;
    }
    blocks.push({ kind: "para", text: line });
  }
  return blocks;
}

/**
 * A lecture summary (Markdown headings, bullets, checklist; $LaTeX$ inside).
 * Each line's text goes through the test portal's formula renderer, which
 * escapes HTML, so teacher-written text cannot inject markup.
 */
export function SummaryView({ markdown, className = "" }: { markdown: string; className?: string }) {
  const blocks = toBlocks(markdown);
  const out: JSX.Element[] = [];
  let list: { key: number; check: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const l = list;
    out.push(
      <ul key={`l${l.key}`} className={l.check ? "space-y-1.5" : "list-disc pl-5 space-y-1.5 marker:text-blue-600"}>
        {l.items.map((t, i) => (
          <li key={i} className={l.check ? "flex items-start gap-2" : ""}>
            {l.check && <span className="material-symbols-outlined text-base text-blue-600 mt-0.5" aria-hidden>check_box_outline_blank</span>}
            <FormulaText text={t} className="block leading-relaxed" />
          </li>
        ))}
      </ul>
    );
    list = null;
  };
  blocks.forEach((b, i) => {
    if (b.kind === "item") {
      if (!list || list.check !== b.check) {
        flush();
        list = { key: i, check: b.check, items: [] };
      }
      list.items.push(b.text);
      return;
    }
    flush();
    if (b.kind === "heading") {
      out.push(
        <h4 key={i} className="text-sm font-extrabold text-[#031635] dark:text-white pt-2 first:pt-0">
          <FormulaText text={b.text} />
        </h4>
      );
    } else {
      out.push(<FormulaText key={i} text={b.text} className="block leading-relaxed" />);
    }
  });
  flush();
  return <div className={`space-y-2 text-sm text-slate-700 dark:text-slate-200 ${className}`}>{out}</div>;
}
