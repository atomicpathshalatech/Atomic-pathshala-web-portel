import katex from "katex";

type Segment = { type: "text" | "inline" | "block" | "image" | "bold"; content: string; width?: string };

/**
 * Sanitizes LaTeX formulas, tables, vector notations, and environments
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

  // 3. Fix OCR blackboard bold misinterpretation for vectors:
  // e.g. \mathbb{A}, \mathbb{B}, \mathbb{a}, \mathbb{b} -> \vec{A}, \vec{B}, \vec{a}, \vec{b}
  text = text.replace(/\\mathbb\{([A-Za-z])\}/g, "\\vec{$1}");

  // 4. Fix OCR underline misinterpretation for vectors:
  // e.g. \underline{a}, \underline{b}, \underline{v} -> \vec{a}, \vec{b}, \vec{v}
  text = text.replace(/\\underline\{([A-Za-z])\}/g, "\\vec{$1}");
  text = text.replace(/\\underline\{\s*([A-Za-z])\s*([\+\-])\s*([A-Za-z])\s*\}/g, "\\vec{$1} $2 \\vec{$3}");

  // 5. Convert raw match-the-following LaTeX arrows:
  // e.g. (A)\rightarrow Q, (B)\rightarrow P -> (A) → Q, (B) → P
  text = text.replace(/\\rightarrow(?![a-zA-Z])/g, " → ");
  text = text.replace(/\\leftarrow(?![a-zA-Z])/g, " ← ");
  text = text.replace(/\\Rightarrow(?![a-zA-Z])/g, " ⇒ ");
  text = text.replace(/\\Leftarrow(?![a-zA-Z])/g, " ⇐ ");
  text = text.replace(/\\leftrightarrow(?![a-zA-Z])/g, " ↔ ");
  text = text.replace(/\\to(?![a-zA-Z])/g, " → ");

  // 6. Automatically wrap unwrapped math equations like |a + b| = \sqrt{2}|a - b| into $...$
  text = text.replace(
    /(?<!\$)(?:\|\s*\\vec\{[A-Za-z]\}\s*[\+\-]\s*\\vec\{[A-Za-z]\}\s*\|\s*=\s*[^,\n\$\.]+?)(?=\s*(?:where|then|तो|\,|$|\n))/gi,
    (match) => `$${match.trim()}$`
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

/**
 * Renders any residual inline LaTeX expressions inside plain text chunks
 */
function renderResidualLatexInText(text: string): string {
  // Check if text has any LaTeX commands like \frac, \sqrt, \hat, \vec, \cos, \sin, \tan, etc.
  if (!/\\[a-zA-Z]+|\^\{?[0-9a-zA-Z\+\-]+\}?|_\{?[0-9a-zA-Z\+\-]+\}?/.test(text)) {
    return escapeHtml(text).replace(/\n/g, "<br/>");
  }

  // Regex to identify inline math chunks
  const mathPattern = /(\\[a-zA-Z]+(?:\{[^{}]*\}|\[[^\[\]]*\]|\^[a-zA-Z0-9{}]+|_[a-zA-Z0-9{}]+)*[\w\s\+\-\*\/\=\<\>\(\)\|\,\.\^\_\{\}\\]*|\b[a-zA-Z0-9]+\^[0-9a-zA-Z{}]+|\b[a-zA-Z0-9]+_[0-9a-zA-Z{}]+)/g;

  let result = "";
  let lastIdx = 0;
  let m: RegExpExecArray | null;

  while ((m = mathPattern.exec(text)) !== null) {
    if (m.index > lastIdx) {
      result += escapeHtml(text.slice(lastIdx, m.index)).replace(/\n/g, "<br/>");
    }
    const mathCandidate = m[0].trim();
    if (/\\[a-zA-Z]+|\^|_/.test(mathCandidate)) {
      try {
        result += katex.renderToString(mathCandidate, { throwOnError: false, displayMode: false });
      } catch {
        result += escapeHtml(mathCandidate);
      }
    } else {
      result += escapeHtml(mathCandidate);
    }
    lastIdx = mathPattern.lastIndex;
  }
  if (lastIdx < text.length) {
    result += escapeHtml(text.slice(lastIdx)).replace(/\n/g, "<br/>");
  }

  return result;
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
        return renderResidualLatexInText(seg.content);
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

