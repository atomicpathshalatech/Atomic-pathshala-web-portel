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

function getBracedArg(str: string, pos: number): { arg: string; nextPos: number } | null {
  if (pos >= str.length || str[pos] !== "{") return null;
  let depth = 0;
  const start = pos + 1;
  for (let i = pos; i < str.length; i++) {
    if (str[i] === "{") depth++;
    else if (str[i] === "}") {
      depth--;
      if (depth === 0) return { arg: str.slice(start, i), nextPos: i + 1 };
    }
  }
  return null;
}

/**
 * Enhances chemical structures in LaTeX (e.g. \underset{\text{CHO}}{\overset{\text{CH}_3}{\text{C}}})
 * by automatically adding authentic vertical bond lines (|) so branches are visually and structurally connected.
 */
function enhanceChemicalBonds(latex: string): string {
  let result = "";
  let i = 0;
  while (i < latex.length) {
    if (latex.startsWith("\\underset", i)) {
      const p1 = i + 8;
      const b1 = getBracedArg(latex, p1);
      if (b1) {
        const b2 = getBracedArg(latex, b1.nextPos);
        if (b2) {
          const inner = b2.arg.trim();
          if (inner.startsWith("\\overset")) {
            const topArg = getBracedArg(inner, 7);
            if (topArg) {
              const centerArg = getBracedArg(inner, topArg.nextPos);
              if (centerArg) {
                const bottom = b1.arg;
                const top = topArg.arg;
                const center = centerArg.arg;
                if (!bottom.includes("|") && !top.includes("|")) {
                  result += `\\underset{\\begin{subarray}{c}|\\\\[-1pt]${bottom}\\end{subarray}}{\\overset{\\begin{subarray}{c}${top}\\\\[-1pt]|\\end{subarray}}{${center}}}`;
                  i = b2.nextPos;
                  continue;
                }
              }
            }
          }
        }
      }
    } else if (latex.startsWith("\\overset", i)) {
      const p1 = i + 7;
      const b1 = getBracedArg(latex, p1);
      if (b1) {
        const b2 = getBracedArg(latex, b1.nextPos);
        if (b2) {
          const inner = b2.arg.trim();
          if (inner.startsWith("\\underset")) {
            const botArg = getBracedArg(inner, 8);
            if (botArg) {
              const centerArg = getBracedArg(inner, botArg.nextPos);
              if (centerArg) {
                const top = b1.arg;
                const bottom = botArg.arg;
                const center = centerArg.arg;
                if (!bottom.includes("|") && !top.includes("|")) {
                  result += `\\underset{\\begin{subarray}{c}|\\\\[-1pt]${bottom}\\end{subarray}}{\\overset{\\begin{subarray}{c}${top}\\\\[-1pt]|\\end{subarray}}{${center}}}`;
                  i = b2.nextPos;
                  continue;
                }
              }
            }
          }
        }
      }
    }
    result += latex[i];
    i++;
  }
  return result;
}

/**
 * Sanitizes LaTeX formulas, tables, and environments
 */
function sanitizeLatexFormulas(input: string): string {
  if (!input) return "";
  let text = input;

  // 1. Fix single backslash line breaks in array/matrix/tabular/aligned/cases environments
  text = text.replace(
    /\\begin\{(array|matrix|pmatrix|bmatrix|vmatrix|tabular|aligned|cases)\}([\s\S]*?)\\end\{\1\}/g,
    (match, env, inner) => {
      let cleanedInner = inner;
      cleanedInner = cleanedInner.replace(/(?<!\\)\\\s*\\hline/g, "\\\\ \\hline");
      cleanedInner = cleanedInner.replace(/([^\\])\s*\\hline/g, "$1 \\\\ \\hline");
      cleanedInner = cleanedInner.replace(/\\\\{3,}/g, "\\\\");
      return `\\begin{${env}}${cleanedInner}\\end{${env}}`;
    }
  );

  // 2. Wrap bare \begin{array}...\end{array} or \begin{matrix} in $$ if not already inside $$ or $
  text = text.replace(
    /(?<!\$)(?:\\begin\{(array|matrix|pmatrix|bmatrix|vmatrix|tabular|aligned|cases)\}[\s\S]*?\\end\{\1\})(?!\$)/g,
    (match) => {
      return `\n$$\n${match}\n$$\n`;
    }
  );

  return text;
}

/**
 * Parses mixed text and math/chemistry into rendered KaTeX segments
 */
function renderMathAndText(text: string): string {
  if (!text || !text.trim()) return "";

  let processed = sanitizeLatexFormulas(text.trim());

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
      return katex.renderToString(enhanceChemicalBonds(mathExpr), {
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
          const math = enhanceChemicalBonds(part.slice(2, -2).trim());
          return katex.renderToString(math, { throwOnError: false, displayMode: true });
        } else if (part.startsWith("$") && part.endsWith("$")) {
          const math = enhanceChemicalBonds(part.slice(1, -1).trim());
          return katex.renderToString(math, { throwOnError: false, displayMode: false });
        } else {
          // Normal text: handle embedded markdown images ![width](url)
          // Check if text has multiline ASCII/Unicode chemical structure with vertical bonds (| or ｜ or ¦)
          const lines = part.split("\n");
          const hasVerticalBonds = lines.some((l) => /[\s\t]*[|｜¦][\s\t]*/.test(l));

          if (hasVerticalBonds && lines.length >= 3) {
            const escaped = lines
              .map((line) =>
                line
                  .replace(/&/g, "&amp;")
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;")
              )
              .join("\n");
            return `<div class="my-2 overflow-x-auto"><pre class="font-mono text-xs sm:text-sm font-bold leading-normal tracking-normal text-slate-900 bg-slate-50 border border-slate-200/90 rounded-xl p-3 inline-block shadow-xs whitespace-pre">${escaped}</pre></div>`;
          }

          let textPart = part
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

          // Handle markdown bold/italic asterisks cleanly without displaying raw '**' or '*'
          textPart = textPart.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>');
          textPart = textPart.replace(/\*(.*?)\*/g, "$1");
          textPart = textPart.replace(/__(.*?)__/g, '<strong class="font-bold text-slate-900">$1</strong>');
          textPart = textPart.replace(/\*/g, "");

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
