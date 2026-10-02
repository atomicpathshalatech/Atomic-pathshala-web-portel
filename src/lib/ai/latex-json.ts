/**
 * AI models often write LaTeX inside JSON strings with single backslashes:
 * "\text{C}_6" — but in JSON "\t" is a TAB, "\f" a form feed, "\b" a
 * backspace, "\n"/"\r" line breaks, and "\alpha" is not even valid JSON.
 * Parsed as-is, "\text{C}_6\text{H}_8" became "<tab>ext{C}…" and showed
 * as "extC_6extH_8" in questions.
 *
 * `escapeLatexInJson` walks the raw JSON text and, inside string values only,
 * doubles a backslash that starts a LaTeX command (or that isn't a valid JSON
 * escape at all), leaving real escapes ("\n" line breaks, "\"", "\\", "é")
 * untouched. `parseAiJson` = that + JSON.parse.
 */

// LaTeX commands that begin with a letter JSON would treat as an escape.
const LATEX_AFTER_ESCAPE = [
  // \t…
  "text", "textbf", "textit", "textrm", "textsf", "texttt", "textsubscript", "textsuperscript", "times", "theta", "Theta",
  "tau", "tan", "tanh", "to", "top", "tilde", "triangle", "therefore", "tfrac", "textdegree", "triangleq",
  // \f…
  "frac", "forall", "flat", "frown",
  // \b…
  "beta", "bar", "begin", "bf", "bullet", "bot", "boxed", "binom", "because", "big", "bigg", "Big", "Bigg", "bold", "boldsymbol", "bmod", "backslash",
  // \r…
  "rho", "right", "rightarrow", "Rightarrow", "rightleftharpoons", "rangle", "rbrace", "rceil", "rfloor", "rm", "rvert", "rm",
  // \n…
  "nu", "neq", "ne", "nabla", "not", "neg", "nolimits", "nmid", "nleq", "ngeq", "notin", "nexists", "newline", "nRightarrow",
  // \u…
  "uparrow", "Uparrow", "underline", "underbrace", "union", "upsilon", "Upsilon", "ulcorner",
];
const LATEX_RE = new RegExp(`^(?:${[...new Set(LATEX_AFTER_ESCAPE)].sort((a, b) => b.length - a.length).join("|")})(?![a-zA-Z])`);
const VALID_ESCAPE = new Set(['"', "\\", "/", "b", "f", "n", "r", "t", "u"]);

export function escapeLatexInJson(raw: string): string {
  let out = "";
  let inString = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!;
    if (!inString) {
      if (ch === '"') inString = true;
      out += ch;
      continue;
    }
    if (ch === '"') {
      inString = false;
      out += ch;
      continue;
    }
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = raw[i + 1] ?? "";
    if (next === "\\" || next === '"' || next === "/") {
      out += ch + next; // already-escaped backslash / quote / slash
      i++;
      continue;
    }
    if (next === "u" && /^[0-9a-fA-F]{4}$/.test(raw.slice(i + 2, i + 6))) {
      out += raw.slice(i, i + 6); // real \uXXXX escape
      i += 5;
      continue;
    }
    if (!VALID_ESCAPE.has(next) || LATEX_RE.test(raw.slice(i + 1))) {
      out += "\\\\"; // LaTeX command (or invalid escape): keep the backslash literally
      continue;
    }
    out += ch; // a real \n, \t, \r, \b, \f escape
  }
  return out;
}

export function parseAiJson<T = any>(raw: string): T {
  try {
    return JSON.parse(escapeLatexInJson(raw)) as T;
  } catch {
    return JSON.parse(raw) as T;
  }
}
