"use client";

import { Kalam } from "next/font/google";
import { FormulaText } from "@/components/test-portal/FormulaText";

// A handwriting font with Devanagari and Latin: Hindi and English notes look written.
const kalam = Kalam({ subsets: ["latin", "devanagari"], weight: ["400", "700"], display: "swap" });

type Block = (
  | { kind: "heading"; text: string }
  | { kind: "point"; text: string; n: string | null }
  | { kind: "important"; text: string }
  | { kind: "diagram"; text: string }
  | { kind: "para"; text: string }
) & { depth: number };

const DIAGRAM = /^\[(?:Diagram|डायग्राम|चित्र)\s*:\s*(.*)\]$/i;

function toBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    // Sub-points are indented (two spaces or a tab per level); up to three levels shown.
    const depth = Math.min(3, Math.floor(raw.replace(/\t/g, "  ").match(/^ */)![0].length / 2));
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^#{1,6}\s+(.*)$/))) blocks.push({ kind: "heading", text: m[1]!, depth: 0 });
    else if ((m = line.match(/^>\s*(.*)$/))) blocks.push({ kind: "important", text: m[1]!, depth });
    else if ((m = line.match(DIAGRAM))) blocks.push({ kind: "diagram", text: m[1]!, depth });
    else if ((m = line.match(/^(\d+)[.)]\s+(.*)$/))) blocks.push({ kind: "point", text: m[2]!, n: m[1]!, depth });
    else if ((m = line.match(/^[-*]\s+(?:\[[ xX]\]\s+)?(.*)$/))) {
      // "- [Diagram: …]" is still a diagram box, "- > …" still an important line.
      const inner = m[1]!.trim();
      const d = inner.match(DIAGRAM);
      const imp = inner.match(/^>\s*(.*)$/);
      blocks.push(d ? { kind: "diagram", text: d[1]!, depth } : imp ? { kind: "important", text: imp[1]!, depth } : { kind: "point", text: m[1]!, n: null, depth });
    } else blocks.push({ kind: "para", text: line, depth });
  }
  return blocks;
}

/**
 * Class notes shown like a student's notebook page: ruled paper, a margin,
 * blue-ink handwriting font, red headings, highlighted "important" lines and
 * boxed diagram notes. Formulas render with KaTeX; every line goes through
 * FormulaText, which escapes HTML.
 */
export function HandwrittenNotes({ markdown, className = "" }: { markdown: string; className?: string }) {
  const blocks = toBlocks(markdown);
  return (
    <div
      className={`hw-notes ${kalam.className} relative overflow-hidden rounded-2xl border border-amber-200/70 dark:border-slate-700 shadow-sm text-[17px] sm:text-[19px] leading-[2rem] ${className}`}
      style={{
        backgroundColor: "var(--notes-paper)",
        backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent calc(2rem - 1px), var(--notes-rule) calc(2rem - 1px), var(--notes-rule) 2rem)",
        backgroundPosition: "0 1.5rem",
      }}
    >
      <style>{`
        .hw-notes { --notes-paper: #fffdf5; --notes-rule: #c9dcf2; --notes-ink: #1d3a8a; --notes-red: #c0262d; --notes-margin: #f0a3a3; }
        .dark .hw-notes { --notes-paper: #111827; --notes-rule: #1f3350; --notes-ink: #c7d7ff; --notes-red: #ff8a8a; --notes-margin: #6b2b2b; }
      `}</style>
      {/* Notebook margin line */}
      <div aria-hidden className="absolute inset-y-0 left-10 sm:left-14 w-px" style={{ backgroundColor: "var(--notes-margin)" }} />
      <div className="relative pl-14 sm:pl-[4.5rem] pr-4 sm:pr-8 pt-6 pb-8 space-y-0" style={{ color: "var(--notes-ink)" }}>
        {blocks.map((b, i) => {
          const indent = b.depth ? { marginLeft: `${b.depth * 1.5}em` } : undefined;
          if (b.kind === "heading") {
            return (
              <h4 key={i} className="font-bold text-[1.15em] pt-[2rem] first:pt-0 underline decoration-2 underline-offset-[6px]" style={{ color: "var(--notes-red)" }}>
                <FormulaText text={b.text} />
              </h4>
            );
          }
          if (b.kind === "point") {
            return (
              <div key={i} className="flex gap-2" style={indent}>
                <span className="shrink-0 font-bold" aria-hidden>
                  {b.n ? `${b.n}.` : b.depth ? "–" : "•"}
                </span>
                <FormulaText text={b.text} className="block" />
              </div>
            );
          }
          if (b.kind === "important") {
            return (
              <div key={i} className="flex gap-2 -mx-1 px-1 rounded" style={{ ...indent, background: "linear-gradient(transparent 15%, rgba(255, 230, 0, 0.35) 15%, rgba(255, 230, 0, 0.35) 85%, transparent 85%)" }}>
                <span className="shrink-0 font-bold" style={{ color: "var(--notes-red)" }} aria-hidden>
                  ★
                </span>
                <FormulaText text={b.text} className="block font-bold" />
              </div>
            );
          }
          if (b.kind === "diagram") {
            return (
              <div key={i} className="my-[1rem] rounded-lg border-2 border-dashed px-3 py-1" style={{ ...indent, borderColor: "var(--notes-ink)" }}>
                <span className="font-bold">✎ Diagram: </span>
                <FormulaText text={b.text} />
              </div>
            );
          }
          return (
            <div key={i} style={indent}>
              <FormulaText text={b.text} className="block" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
