import katex from "katex";

type Segment = { type: "text" | "inline" | "block" | "image" | "bold"; content: string; width?: string };

/**
 * Sanitizes LaTeX formulas, tables, and environments
 * - Fixes single backslash line breaks before \hline in array/matrix/tabular environments
 * - Ensures unwrapped \begin{array}...\end{array} or matrices are wrapped in block math $$...$$
 */
export function sanitizeLatexFormulas(input: string): string {
  if (!input) return "";
  let text = input;

  // 1. Fix single backslash line breaks in array/matrix/tabular/aligned/cases environments
  text = text.replace(
    /\\begin\{(array|matrix|pmatrix|bmatrix|vmatrix|tabular|aligned|cases)\}([\s\S]*?)\\end\{\1\}/g,
    (match, env, inner) => {
      let cleanedInner = inner;
      // Fix single slash before \hline e.g. " \ \hline" -> " \\ \hline "
      cleanedInner = cleanedInner.replace(/(?<!\\)\\\s*\\hline/g, "\\\\ \\hline");
      // Fix missing \\ before \hline if line ends without \\
      cleanedInner = cleanedInner.replace(/([^\\])\s*\\hline/g, "$1 \\\\ \\hline");
      // Clean excessive backslashes
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

function parseSegments(input: string): Segment[] {
  const sanitized = sanitizeLatexFormulas(input);
  const segments: Segment[] = [];
  const regex = /!\[(.*?)\]\((.+?)\)|\$\$(.+?)\$\$|\$(.+?)\$|\*\*(.+?)\*\*/gs;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(sanitized)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: sanitized.slice(lastIndex, match.index) });
    }
    if (match[2] !== undefined && match[1] !== undefined) {
      segments.push({ type: "image", content: match[2], width: match[1] });
    } else if (match[3] !== undefined) {
      segments.push({ type: "block", content: match[3] });
    } else if (match[4] !== undefined) {
      segments.push({ type: "inline", content: match[4] });
    } else if (match[5] !== undefined) {
      segments.push({ type: "bold", content: match[5] });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < sanitized.length) {
    segments.push({ type: "text", content: sanitized.slice(lastIndex) });
  }
  return segments;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderFormulaContent(input: string): string {
  if (!input) return "";
  const segments = parseSegments(input);
  return segments
    .map((seg) => {
      if (seg.type === "text") {
        // Check if there's any stray LaTeX array/matrix that slipped through
        if (/\\begin\{(array|matrix|pmatrix|cases)\}/.test(seg.content)) {
          try {
            return katex.renderToString(seg.content.trim(), {
              throwOnError: false,
              displayMode: true,
            });
          } catch {
            // Fallback
          }
        }
        return escapeHtml(seg.content).replace(/\n/g, "<br/>");
      }
      if (seg.type === "bold") {
        return `<strong>${escapeHtml(seg.content).replace(/\n/g, "<br/>")}</strong>`;
      }
      if (seg.type === "image") {
        let width = "60%";
        const rawWidth = (seg.width || "").trim();
        if (/^\d+%?$/.test(rawWidth)) {
          width = rawWidth.endsWith("%") ? rawWidth : `${rawWidth}%`;
        } else if (/^\d+px$/.test(rawWidth)) {
          width = rawWidth;
        }
        return `<img src="${escapeHtml(seg.content)}" style="width:${width};max-width:100%;height:auto;display:block;margin:8px 0;border-radius:8px;" alt="Diagram" />`;
      }
      try {
        const cleanFormula = seg.content.trim();
        return katex.renderToString(cleanFormula, {
          throwOnError: false,
          displayMode: seg.type === "block",
        });
      } catch {
        return escapeHtml(seg.content);
      }
    })
    .join("");
}
