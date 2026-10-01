import katex from "katex";

type Segment = { type: "text" | "inline" | "block" | "image" | "bold" | "italic"; content: string; width?: string };

/**
 * LaTeX that went through JSON without its backslashes escaped: "\rho" was
 * stored as a carriage return + "ho", "\frac" as a form feed + "rac",
 * "\times"/"\theta"/"\text" as a tab + …, "\beta"/"\bar" as a backspace,
 * "\vec" as a vertical tab. Seen in real questions ("density $\rho$" showed
 * as "ho"). Put the backslash back — only where the control character is
 * followed by a LaTeX command name, so real line breaks and tabs are untouched.
 */
const MANGLED_COMMANDS: Record<string, { letter: string; rest: string[] }> = {
  "\r": { letter: "r", rest: ["ho", "ightarrow", "ightleftharpoons", "ightharpoonup", "ight", "angle", "brace", "ceil", "floor", "m", "vert"] },
  "\t": { letter: "t", rest: ["imes", "heta", "extbf", "extit", "extrm", "ext", "anh", "an", "au", "o", "op", "ilde", "riangle", "frac", "herefore", "extdegree"] },
  "\f": { letter: "f", rest: ["rac", "orall", "lat"] },
  "\b": { letter: "b", rest: ["eta", "ar", "f", "egin", "ullet", "ot", "oxed", "inom", "ecause", "igg", "ig", "old", "oldsymbol"] },
  "\v": { letter: "v", rest: ["ec", "arepsilon", "arphi", "artheta", "arpi", "ee", "ert", "dots"] },
};
const MANGLED_RE = new RegExp(
  `([\\r\\t\\f\\b\\v])(?=(?:${Array.from(new Set(Object.values(MANGLED_COMMANDS).flatMap((c) => c.rest)))
    .sort((a, b) => b.length - a.length)
    .join("|")})(?![a-zA-Z]))`,
  "g"
);

export function repairLatexControlChars(input: string): string {
  if (!input || !/[\r\t\f\b\v]/.test(input)) return input;
  return input.replace(MANGLED_RE, (ch: string, _c: string, offset: number, whole: string) => {
    const spec = MANGLED_COMMANDS[ch];
    if (!spec) return ch;
    const after = whole.slice(offset + 1);
    const hit = spec.rest.find((r) => after.startsWith(r) && !/[a-zA-Z]/.test(after.charAt(r.length)));
    return hit ? `\\${spec.letter}` : ch;
  });
}

/**
 * Cleans OCR artifacts, repeated Devanagari vowel duplications, and corrupt characters
 */
export function cleanOcrArtifacts(input: string): string {
  if (!input) return "";
  let text = input;

  // 1. Remove duplicate 'है' / 'हैं' suffixes from OCR line endings
  text = text.replace(/है\s*।\s*है/g, "है।");
  text = text.replace(/है\s*\?\s*है/g, "है?");
  text = text.replace(/है\s*:\s*है/g, "है:");
  text = text.replace(/है\s*,\s*है/g, "है,");
  text = text.replace(/हैं\s*।\s*हैं/g, "हैं।");
  text = text.replace(/हैं\s*\?\s*हैं/g, "हैं?");
  text = text.replace(/हैं\s*:\s*हैं/g, "हैं:");
  text = text.replace(/हैं\s*,\s*हैं/g, "हैं,");

  // 2. Fix specific known OCR hallucinated syllable splits
  text = text.replace(/दूरी\s+दू(?!\w)/g, "दूरी");
  text = text.replace(/दुरी\s+दु(?!\w)/g, "दूरी");
  text = text.replace(/घूम\s+घू\s*ता/g, "घूमता");
  text = text.replace(/घू\s*मेगी/g, "घूमेगी");
  text = text.replace(/घुमा\s+घु\s*या/g, "घुमाया");
  text = text.replace(/चित्रानुसा\s+नु\s*र/g, "चित्रानुसार");
  text = text.replace(/अनुसा\s+नु\s*र/g, "अनुसार");
  text = text.replace(/सुमे\s+सु\s*मेलित/g, "सुमेलित");
  text = text.replace(/सुस्\s+सु\s*पष्ट/g, "सुस्पष्ट");
  text = text.replace(/युक्त\s+यु(?!\w)/g, "युक्त");
  text = text.replace(/गुणां\s+गु\s*णां\s*क/g, "गुणांक");
  text = text.replace(/गुणां\s+गु\s*क/g, "गुणांक");
  text = text.replace(/गु\s*णां\s*क/g, "गुणांक");
  text = text.replace(/तीन\s+गुना\s+गु(?!\w)/g, "तीन गुना");
  text = text.replace(/दोगुना\s+गु(?!\w)/g, "दोगुना");
  text = text.replace(/चार\s+गुना\s+गु(?!\w)/g, "चार गुना");
  text = text.replace(/शुद्ध\s+शु(?!\w)/g, "शुद्ध");
  text = text.replace(/विद्युत\s+द्यु(?!\w)/g, "विद्युत");
  text = text.replace(/वैद्युत\s+द्यु(?!\w)/g, "वैद्युत");
  text = text.replace(/चुम्बकीय\s+चु(?!\w)/g, "चुम्बकीय");
  text = text.replace(/चुम्बक\s+चु(?!\w)/g, "चुम्बक");
  text = text.replace(/चुम्\s+चु\s*बक/g, "चुम्बक");
  text = text.replace(/चुम्\s+चु\s*बकीय/g, "चुम्बकीय");
  text = text.replace(/न्यूट्रॉन\s+न्यू(?!\w)/g, "न्यूट्रॉन");
  text = text.replace(/न्यूट्रॉ\s+यू\s*न/g, "न्यूट्रॉन");
  text = text.replace(/न्यूक्लि\s+यू\s*ओटाइड/g, "न्यूक्लियोटाइड");
  text = text.replace(/न्यूक्लि\s+यू\s*ओसाईड/g, "न्यूक्लियोसाइड");
  text = text.replace(/यूके\s+यू\s*केरियोटिक/g, "यूकैरियोटिक");
  text = text.replace(/ऐंटी\s+ऐं\s*बायोटिक/g, "ऐंटीबायोटिक");
  text = text.replace(/पीडि़\s*त/g, "पीड़ित");
  text = text.replace(/पढि़\s*ए/g, "पढ़िए");
  text = text.replace(/पढि़\s*ये/g, "पढ़िए");
  text = text.replace(/चुनि\s*ए/g, "चुनिए");
  text = text.replace(/चुनि\s*ये/g, "चुनिए");
  text = text.replace(/चुनिचुनिए/g, "चुनिए");
  text = text.replace(/चुने\s+नें/g, "चुनें");
  text = text.replace(/लघुबी\s+घु\s*जाणु/g, "लघुबीजाणु");
  text = text.replace(/द्विगुणि\s+गु\s*त/g, "द्विगुणित");
  text = text.replace(/अंगुलि\s+गु(?!\w)/g, "अंगुलि");
  text = text.replace(/अनुपा\s+नु\s*त/g, "अनुपात");
  text = text.replace(/अनुम\s+नु\s*ति/g, "अनुमति");
  text = text.replace(/पुन\s+पु\s*:/g, "पुन:");
  text = text.replace(/पूँछ\s+पूँ(?!\w)/g, "पूँछ");
  text = text.replace(/शुतु\s+शु\s*र\s+तु\s*मुर्ग\s+मु/g, "शुतुरमुर्ग");
  text = text.replace(/गुरू\s+गु\s*त्वाकर्षण/g, "गुरुत्वाकर्षण");
  text = text.replace(/गुरु\s+गु\s*त्वाकर्षण/g, "गुरुत्वाकर्षण");
  text = text.replace(/भूवै\s+भू\s*ज्ञानिक/g, "भूवैज्ञानिक");
  text = text.replace(/ज्वालामुखी\s+मु\s*य/g, "ज्वालामुखीय");
  text = text.replace(/वायुमं\s+यु\s*मं\s*डल/g, "वायुमंडल");
  text = text.replace(/शून्\s+शू\s*य/g, "शून्य");
  text = text.replace(/वृत्ता\s+वृ\s*कार/g, "वृत्ताकार");
  text = text.replace(/वृत्ती\s+वृ\s*य/g, "वृत्तीय");
  text = text.replace(/वृद्धिवृ(?!\w)/g, "वृद्धि");
  text = text.replace(/दृष्टिवृ(?!\w)/g, "दृष्टि");
  text = text.replace(/मूल\s+मू\s*भूत/g, "मूलभूत");
  text = text.replace(/मूल\s+मू(?!\w)/g, "मूल");
  text = text.replace(/पूंज\s+पूं(?!\w)/g, "पुंज");
  text = text.replace(/स्पंज\s+पं(?!\w)/g, "स्पंज");
  text = text.replace(/झिल्लीयुक्त\s+यु(?!\w)/g, "झिल्लीयुक्त");

  // 3. OCR character encoding errors
  text = text.replace(/सं'ysषण/g, "संश्लेषण");
  text = text.replace(/'ysष्मा/g, "श्लेष्मा");
  text = text.replace(/'ysषण/g, "श्लेषण");
  text = text.replace(/'okन/g, "श्वान");
  text = text.replace(/वायवीय\s+'oसन/g, "वायवीय श्वसन");
  text = text.replace(/अंत:'oसन/g, "अंत:श्वसन");
  text = text.replace(/नि:\s*'oसन/g, "नि:श्वसन");
  text = text.replace(/'oसन/g, "श्वसन");
  text = text.replace(/ik'oZ/g, "पार्श्व");

  // 4. Clean stray asterisks and OCR artifact marks
  text = text.replace(/(^|\n|\r)\s*\*\s+/g, "$1");
  text = text.replace(/\s+\*\s*$/g, "");
  text = text.replace(/(\s)\*(\s)/g, "$1$2");
  text = text.replace(/\\\*/g, "*");
  text = text.replace(/^\s*\*\*([\s\S]+?)\*\*\s*$/, "$1");

  return text;
}

/**
 * Sanitizes LaTeX formulas, tables, vector notations, environments, and OCR artifacts
 */
export function sanitizeLatexFormulas(input: string): string {
  if (!input) return "";
  let text = cleanOcrArtifacts(input);

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

/** `sanitized` must already have been through sanitizeLatexFormulas (renderFormulaContent does it once). */
function parseSegments(sanitized: string): Segment[] {
  const segments: Segment[] = [];
  // image | $$block$$ | $inline$ | **bold** | *italic* (a word-bounded single-asterisk
  // span, as in "*Penicillium*" — never "a * b", which OCR cleanup already strips)
  const regex = /!\[(.*?)\]\((.+?)\)|\$\$(.+?)\$\$|\$(.+?)\$|\*\*(.+?)\*\*|(?<![\w*])\*(?![\s*])([^*\n]+?)(?<!\s)\*(?![\w*])/gs;
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
    } else if (match[6] !== undefined) {
      segments.push({ type: "italic", content: match[6] });
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
function renderResidualLatexInText(raw: string, bulleted = false): string {
  // Markdown-style list lines in solutions ("- (i) ...") → a real bullet (once, on the whole text).
  const text = bulleted ? raw : raw.replace(/(^|\n)[ \t]*-[ \t]+(?=\S)/g, "$1• ");
  // Text-mode commands outside $…$ ("\textbf{Statement-A :} …") are plain
  // formatting, not maths: make them HTML first (the maths scanner below cut
  // them apart at "-" and showed a red KaTeX error).
  const TEXT_CMD = /\\(textbf|textit|emph)\{([^{}]*)\}/g;
  if (/\\(textbf|textit|emph)\{[^{}]*\}/.test(text)) {
    let out = "";
    let last = 0;
    for (const m of text.matchAll(TEXT_CMD)) {
      out += renderResidualLatexInText(text.slice(last, m.index), true);
      const inner = renderResidualLatexInText(m[2] ?? "", true);
      out += m[1] === "textbf" ? `<strong>${inner}</strong>` : `<em>${inner}</em>`;
      last = (m.index ?? 0) + m[0].length;
    }
    return out + renderResidualLatexInText(text.slice(last), true);
  }
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

/** Splits on a separator that isn't escaped with a backslash (a literal "\&" stays in the cell). */
function splitUnescaped(s: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (ch === "\\" && i + 1 < s.length) {
      cur += ch + s[i + 1];
      i++;
      continue;
    }
    if (ch === sep) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/** One table cell: plain words stay HTML text (so they wrap), anything mathematical goes through KaTeX. */
function renderTableCell(raw: string): { html: string; header: boolean } {
  const c = raw.trim();
  if (!c) return { html: "", header: false };
  const wrapped = /^\\text(bf|it|rm|sf|normal)?\s*\{([^{}]*)\}$/.exec(c);
  if (wrapped) {
    const text = escapeHtml(wrapped[2]!);
    if (wrapped[1] === "bf") return { html: `<strong>${text}</strong>`, header: true };
    if (wrapped[1] === "it") return { html: `<em>${text}</em>`, header: false };
    return { html: text, header: false };
  }
  if (!/[\\^_{}]/.test(c)) return { html: escapeHtml(c), header: false };
  try {
    return { html: katex.renderToString(c, { throwOnError: false, displayMode: false }), header: false };
  } catch {
    return { html: escapeHtml(c), header: false };
  }
}

/**
 * A LaTeX `array`/`tabular` used as a TABLE (match the column, data
 * tables) → a real HTML table: columns size to their content, text wraps,
 * and it never runs off a phone screen. KaTeX renders such an array as one
 * rigid block of math that can't wrap — the "very long boxes". A matrix
 * (no rules, no words) is left to KaTeX.
 */
export function latexTableToHtml(spec: string, body: string): string | null {
  const bordered = spec.includes("|") || /\\hline/.test(body);
  const wordy = /\\text/.test(body);
  if (!bordered && !wordy) return null;

  const aligns = spec.replace(/[|\s]/g, "").replace(/[pmb]\{[^}]*\}/g, "l").split("");
  const rows = body
    .split(/\\\\(?:\[[^\]]*\])?/)
    .map((r) => r.replace(/\\hline|\\cline\{[^}]*\}/g, "").trim())
    .filter((r) => r.replace(/&/g, "").trim().length > 0 || r.includes("&"))
    .map((r) => splitUnescaped(r, "&").map(renderTableCell))
    .filter((cells) => cells.some((c) => c.html));
  if (rows.length === 0) return null;

  const width = Math.max(...rows.map((r) => r.length));
  const border = bordered ? "border:1px solid #64748b;" : "";
  const htmlRows = rows.map((cells, ri) => {
    const isHeader = ri === 0 && cells.filter((c) => c.html).every((c) => c.header);
    const tag = isHeader ? "th" : "td";
    const tds = Array.from({ length: width }, (_, ci) => {
      const cell = cells[ci];
      const align = aligns[ci] === "c" ? "center" : aligns[ci] === "r" ? "right" : "left";
      return `<${tag} style="${border}padding:3px 8px;vertical-align:top;text-align:${isHeader ? "center" : align};">${cell?.html ?? ""}</${tag}>`;
    });
    return `<tr>${tds.join("")}</tr>`;
  });
  return `<div class="fx-table-wrap" style="max-width:100%;overflow-x:auto;margin:6px 0;"><table class="fx-table" style="border-collapse:collapse;width:auto;max-width:100%;${bordered ? "border:1px solid #64748b;" : ""}">${htmlRows.join("")}</table></div>`;
}

/**
 * Splits a line on "|" outside $…$ math (|x| inside a formula is not a column).
 * Leading / trailing pipes ("| a | b |") are ignored.
 */
function splitPipeRow(line: string): string[] | null {
  const cells: string[] = [];
  let cur = "";
  let inMath = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === "$") inMath = !inMath;
    if (ch === "|" && !inMath) {
      cells.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  cells.push(cur);
  if (cells.length && !cells[0]!.trim()) cells.shift();
  if (cells.length && !cells[cells.length - 1]!.trim()) cells.pop();
  return cells.length >= 2 ? cells.map((c) => c.trim()) : null;
}

const PIPE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/;
const COLUMN_HEADER = /column|colum|list|स्तम्भ|स्तंभ|कॉलम|कालम|सूची/i;

/**
 * Match-the-column (and other) tables written as lines of "a | b" — the way
 * AI-generated and extracted questions often arrive, with or without a
 * markdown "---|---" divider — become a real bordered table instead of
 * showing the pipes as text. Needs at least two rows with the same number
 * of columns; returns the text with each table swapped for a token.
 */
function pipeTablesToTokens(text: string, tables: string[]): string {
  if (!text.includes("|")) return text;
  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const block: { cells: string[] | null; divider: boolean }[] = [];
    let width = 0;
    let j = i;
    while (j < lines.length && !lines[j]!.includes("$$")) {
      const divider = PIPE_DIVIDER.test(lines[j]!);
      const cells = divider ? null : splitPipeRow(lines[j]!);
      if (!divider && !cells) break;
      if (cells) {
        if (width && cells.length !== width) break;
        width = cells.length;
      }
      block.push({ cells, divider });
      j++;
    }
    const rows = block.filter((r) => r.cells).map((r) => r.cells!);
    if (rows.length < 2) {
      out.push(lines[i]!);
      i++;
      continue;
    }
    const headerByDivider = block.length > 1 && block[1]!.divider;
    const header = headerByDivider || rows[0]!.some((c) => COLUMN_HEADER.test(c));
    const cell = (c: string) => renderSegments(parseSegments(c));
    const border = "border:1px solid #64748b;padding:3px 8px;vertical-align:top;";
    const htmlRows = rows.map((r, ri) => {
      const tag = header && ri === 0 ? "th" : "td";
      return `<tr>${r.map((c) => `<${tag} style="${border}text-align:${tag === "th" ? "center" : "left"};">${cell(c)}</${tag}>`).join("")}</tr>`;
    });
    tables.push(
      `<div class="fx-table-wrap" style="max-width:100%;overflow-x:auto;margin:6px 0;"><table class="fx-table" style="border-collapse:collapse;width:auto;max-width:100%;border:1px solid #64748b;">${htmlRows.join("")}</table></div>`
    );
    out.push(TABLE_TOKEN(tables.length - 1));
    i = j;
  }
  return out.join("\n");
}

const TABLE_RE = /\$\$\s*\\begin\{(array|tabular)\}\s*\{((?:[^{}]|\{[^{}]*\})*)\}([\s\S]*?)\\end\{\1\}\s*\$\$|\$\s*\\begin\{(array|tabular)\}\s*\{((?:[^{}]|\{[^{}]*\})*)\}([\s\S]*?)\\end\{\4\}\s*\$/g;
const TABLE_TOKEN = (i: number) => `\u0000FXTABLE${i}\u0000`;

export function renderFormulaContent(input: string): string {
  if (!input) return "";
  const sanitized = sanitizeLatexFormulas(repairLatexControlChars(input));
  // Tables first, each replaced by a token the text renderer leaves alone.
  const tables: string[] = [];
  const withTokens = sanitized.replace(TABLE_RE, (whole, _e1, spec1, body1, _e2, spec2, body2) => {
    const html = latexTableToHtml(spec1 ?? spec2 ?? "", body1 ?? body2 ?? "");
    if (!html) return whole;
    tables.push(html);
    return TABLE_TOKEN(tables.length - 1);
  });
  const html = renderSegments(parseSegments(pipeTablesToTokens(withTokens, tables)));
  return tables.length ? html.replace(/\u0000FXTABLE(\d+)\u0000/g, (_, i) => tables[Number(i)] ?? "") : html;
}

function renderSegments(segments: Segment[]): string {
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
      if (seg.type === "italic") {
        return `<em>${escapeHtml(seg.content)}</em>`;
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

