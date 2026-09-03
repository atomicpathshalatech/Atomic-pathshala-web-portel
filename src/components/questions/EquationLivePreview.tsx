"use client";

import React, { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface EquationLivePreviewProps {
  content: string;
  label?: string;
  className?: string;
}

/**
 * Parses mixed text and math/chemistry into rendered KaTeX segments
 */
function renderMathAndText(text: string): string {
  if (!text || !text.trim()) return "";

  let processed = text.trim();

  // If text has raw exponents or subscripts without $ (e.g. {GSHSAU}^2 or H_2SO_4 or 1/2), prepare for KaTeX
  const hasUnwrappedMath =
    /[_{}\^]|\\[a-zA-Z]+|\b(sqrt|alpha|beta|theta|pi|lambda|Delta|rightarrow)\b/i.test(processed) &&
    !processed.includes("$");

  if (hasUnwrappedMath) {
    // Normalization for standalone math expression
    let mathExpr = processed;
    // Format reaction arrows
    mathExpr = mathExpr.replace(/(=>|->|→)/g, "\\rightarrow");
    mathExpr = mathExpr.replace(/(<=>|<->|⇌)/g, "\\rightleftharpoons");
    // Format fraction shorthand e.g. 1/2 -> \frac{1}{2}
    mathExpr = mathExpr.replace(/([-\w\.]+)\s*\/\s*([-\w\.\^\(\)]+)/g, (m, n, d) => {
      if (m.includes("http") || m.includes("m/s") || m.includes("km/h")) return m;
      return `\\frac{${n}}{${d}}`;
    });

    try {
      return katex.renderToString(mathExpr, {
        throwOnError: false,
        displayMode: false,
      });
    } catch {
      // Fallback
    }
  }

  // Handle standard LaTeX $...$ or $$...$$ delimited segments
  try {
    const parts = processed.split(/(\$\$[\s\S]+?\$\$|\$[^\$]+?\$)/g);
    return parts
      .map((part) => {
        if (part.startsWith("$$") && part.endsWith("$$")) {
          const math = part.slice(2, -2).trim();
          return katex.renderToString(math, { throwOnError: false, displayMode: true });
        } else if (part.startsWith("$") && part.endsWith("$")) {
          const math = part.slice(1, -1).trim();
          return katex.renderToString(math, { throwOnError: false, displayMode: false });
        } else {
          // Normal text: preserve spaces and newlines
          return part
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n/g, "<br/>");
        }
      })
      .join("");
  } catch {
    return processed;
  }
}

export function EquationLivePreview({
  content,
  label = "Live Render Preview",
  className = "",
}: EquationLivePreviewProps) {
  const html = useMemo(() => renderMathAndText(content), [content]);

  // Only render preview box if there is actual content and either math/chemistry symbols exist
  const hasMathOrFormula = useMemo(() => {
    if (!content || !content.trim()) return false;
    return /[_{}\^\\\$]|->|=>|→|⇌|√|\/|[0-9]+[+-]|\b(frac|sqrt|alpha|beta|theta|pi|lambda|Delta|sin|cos|tan)\b/i.test(
      content
    );
  }, [content]);

  if (!hasMathOrFormula || !html) return null;

  return (
    <div
      className={`p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 text-xs shadow-sm transition-all ${className}`}
    >
      <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-200/60 dark:border-slate-700/60">
        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1 font-mono">
          <span className="material-symbols-outlined text-xs">visibility</span>
          {label} (Student View)
        </span>
        <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-bold">
          KaTeX / Formula Rendered
        </span>
      </div>

      <div
        className="font-medium text-sm leading-relaxed overflow-x-auto py-1"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
