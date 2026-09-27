import katex from "katex";

type Segment = { type: "text" | "inline" | "block" | "image" | "bold"; content: string; width?: string };

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

