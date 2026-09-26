"use client";

import React, { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface EquationLivePreviewProps {
  content: string;
  label?: string;
  className?: string;
  alwaysShow?: boolean;
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
    !processed.includes("$") &&
    !processed.includes("![");

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
          // Normal text: handle embedded markdown images ![width](url)
          let textPart = part
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

          textPart = textPart.replace(
            /!\[([^\]]*)\]\((https?:\/\/[^\s\)]+|data:image\/[^\s\)]+|\/uploads\/[^\s\)]+|[^\s\)]+)\)/gi,
            (_match, widthParam, url) => {
              let width = "60%";
              const trimmed = (widthParam || "").trim();
              if (/^\d+%?$/.test(trimmed)) {
                width = trimmed.endsWith("%") ? trimmed : `${trimmed}%`;
              } else if (/^\d+px$/.test(trimmed)) {
                width = trimmed;
              }
              return `<img src="${url}" style="width:${width};max-width:100%;height:auto;border-radius:8px;margin:8px 0;display:block;" alt="Figure" />`;
            }
          );

          return textPart.replace(/\n/g, "<br/>");
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
  alwaysShow = false,
}: EquationLivePreviewProps) {
  const html = useMemo(() => renderMathAndText(content), [content]);

  // Render preview if there is content
  const hasMathOrFormula = useMemo(() => {
    if (!content || !content.trim()) return false;
    if (alwaysShow) return true;
    return (
      /!\[.*?\]\(.*?\)/.test(content) ||
      /[_{}\^\\\$]|->|=>|→|⇌|√|\/|[0-9]+[+-]|\b(frac|sqrt|alpha|beta|theta|pi|lambda|Delta|sin|cos|tan)\b/i.test(
        content
      )
    );
  }, [content, alwaysShow]);

  if (!hasMathOrFormula || !html) return null;

  return (
    <div
      className={`p-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs shadow-xs transition-all ${className}`}
    >
      <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-100">
        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1 font-mono">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
          {label} (Live Preview)
        </span>
        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
          Rendered
        </span>
      </div>

      <div
        className="font-medium text-xs sm:text-sm leading-relaxed overflow-x-auto py-0.5 text-slate-800"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
