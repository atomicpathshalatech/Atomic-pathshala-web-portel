import { OCRElement, OCRDocument, StructuredQuestion } from "./types";

/**
 * Normalizes mathematical formulas into KaTeX / MathJax compliant LaTeX.
 * Preserves fractions, exponents, square roots, integrals, vectors, and matrices.
 */
export function normalizeMathFormula(formulaText: string): string {
  let cleaned = formulaText.trim();

  // Fraction conversions (e.g. 1/2 -> \frac{1}{2}, -13.6/n^2 -> -\frac{13.6}{n^2})
  cleaned = cleaned.replace(/([-\w\.]+)\s*\/\s*([-\w\.\^\(\)]+)/g, (match, num, den) => {
    if (num.startsWith("http") || num.includes(":") || match.includes("m/s") || match.includes("km/h")) {
      return match;
    }
    return `\\frac{${num.replace(/[()]/g, "")}}{${den.replace(/[()]/g, "")}}`;
  });

  // Superscript normalization (e.g. x^2 or x² -> x^{2}, 10^-3 -> 10^{-3})
  cleaned = cleaned.replace(/(\w|\))\s*[\^]\s*([-\d\w]+)/g, "$1^{$2}");
  cleaned = cleaned.replace(/(\w|\))([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+)/g, (match, base, sups) => {
    const supMap: Record<string, string> = {
      "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
      "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
      "⁺": "+", "⁻": "-",
    };
    const mapped = sups.split("").map((c: string) => supMap[c] || c).join("");
    return `${base}^{${mapped}}`;
  });

  // Square roots (e.g. sqrt(2) or √2 -> \sqrt{2})
  cleaned = cleaned.replace(/sqrt\s*\(([^)]+)\)/gi, "\\sqrt{$1}");
  cleaned = cleaned.replace(/√\s*([0-9a-zA-Z]+|\([^)]+\))/g, (match, val) => {
    return `\\sqrt{${val.replace(/[()]/g, "")}}`;
  });

  // Greek letters normalization
  const greekLetters = [
    "alpha", "beta", "gamma", "delta", "epsilon", "theta",
    "lambda", "mu", "pi", "rho", "sigma", "tau", "phi", "omega",
    "Delta", "Omega", "Theta", "Lambda"
  ];
  for (const greek of greekLetters) {
    const reg = new RegExp(`\\b${greek}\\b`, "g");
    cleaned = cleaned.replace(reg, `\\${greek}`);
  }

  // Ensure mathematical delimiters
  if (!cleaned.startsWith("$") && !cleaned.endsWith("$")) {
    cleaned = `$${cleaned}$`;
  }

  return cleaned;
}

/**
 * Chemistry Formatter: Preserves chemical formulas, subscripts, ionic charges, and reaction arrows
 * (e.g. H2SO4 -> \text{H}_2\text{SO}_4, 2H2 + O2 -> 2H2O, Ca2+ -> \text{Ca}^{2+})
 */
export function formatChemistryNotation(chemText: string): string {
  let cleaned = chemText.trim();

  // Preserve reaction arrows (->, =>, <->, <=>)
  cleaned = cleaned.replace(/\s*(=>|->|→)\s*/g, " \\rightarrow ");
  cleaned = cleaned.replace(/\s*(<=>|<->|⇌|⇄)\s*/g, " \\rightleftharpoons ");

  // Chemical formula subscripting for elements: H2O -> H_2O, CaCO3 -> CaCO_3
  cleaned = cleaned.replace(/([A-Z][a-z]?)([0-9]+)/g, "$1_{$2}");

  // Ionic charge superscripting: Ca2+ -> Ca^{2+}, SO4^2- -> SO_4^{2-}
  cleaned = cleaned.replace(/([A-Za-z0-9_]+)\s*(\^)?\s*([0-9]+)?([+-])/g, (match, base, caret, num, sign) => {
    const charge = (num || "") + sign;
    return `${base}^{${charge}}`;
  });

  // Wrap in LaTeX text / math environment if arrows or subscripts present
  if (cleaned.includes("\\rightarrow") || cleaned.includes("_{") || cleaned.includes("^{")) {
    if (!cleaned.startsWith("$") && !cleaned.endsWith("$")) {
      cleaned = `$${cleaned}$`;
    }
  }

  return cleaned;
}

/**
 * Reconstructs a Structured Question (Statement, Options A/B/C/D, Answer, Solution, Taxonomies)
 * from a list of OCR elements with reading-order preservation.
 */
export function reconstructQuestionFromElements(
  elements: OCRElement[],
  documentMeta?: OCRDocument["metadata"]
): StructuredQuestion {
  const lowConfidenceFields: string[] = [];
  const confidenceThreshold = 0.8;

  let statementEnParts: string[] = [];
  let statementHiParts: string[] = [];

  const optionsEn: Record<string, string> = { A: "", B: "", C: "", D: "" };
  const optionsHi: Record<string, string> = { A: "", B: "", C: "", D: "" };

  const tables: string[][][] = [];
  let solutionEn = "";
  let solutionHi = "";
  let correctAnswer = ["A"];
  let hasFigure = false;
  let figureCaption: string | undefined;

  // Option regex patterns (e.g. "(A)", "(1)", "A.", "1.", "(a)")
  const optionRegex = /^(?:\(([A-D1-4a-d])\)|([A-D1-4a-d])[\.\)]|\b([A-D1-4a-d])\))\s*(.*)$/i;
  const answerRegex = /(?:Ans|Answer|Correct Option|उत्तर)\s*[:=\-]?\s*\(?([A-D1-4a-d])\)?/i;

  let currentTarget: "statement" | "option" | "solution" = "statement";
  let currentOptionKey: string = "A";

  for (const el of elements) {
    if (el.confidence < confidenceThreshold) {
      el.needsReview = true;
    }

    if (el.type === "diagram") {
      hasFigure = true;
      figureCaption = el.content || "Figure 1.1";
      continue;
    }

    if (el.type === "table" && el.tableData) {
      tables.push(el.tableData);
      continue;
    }

    let textContent = el.latex || el.content;
    if (el.type === "formula" && el.latex) {
      textContent = el.latex;
    } else if (el.type === "chemistry") {
      textContent = formatChemistryNotation(el.content);
    }

    // Check for Answer key declaration
    const ansMatch = textContent.match(answerRegex);
    if (ansMatch && ansMatch[1]) {
      const char = ansMatch[1].toUpperCase();
      const mappedChar = char === "1" ? "A" : char === "2" ? "B" : char === "3" ? "C" : char === "4" ? "D" : char;
      correctAnswer = [mappedChar];
      continue;
    }

    // Check for Solution section header
    if (/^(?:Solution|Explanation|हल|व्याख्या)\s*[:\-]/i.test(textContent)) {
      currentTarget = "solution";
      textContent = textContent.replace(/^(?:Solution|Explanation|हल|व्याख्या)\s*[:\-]\s*/i, "");
    }

    // Check if this line is an option (A, B, C, D)
    const optMatch = textContent.match(optionRegex);
    if (optMatch) {
      const matchGroup = optMatch[1] || optMatch[2] || optMatch[3];
      if (matchGroup) {
        currentTarget = "option";
        const rawKey = matchGroup.toUpperCase();
        currentOptionKey = rawKey === "1" ? "A" : rawKey === "2" ? "B" : rawKey === "3" ? "C" : rawKey === "4" ? "D" : rawKey;
        textContent = optMatch[4] || "";
      }
    }

    const isHindi = el.language === "hi" || /[\u0900-\u097F]/.test(textContent);

    if (currentTarget === "statement") {
      if (isHindi) {
        statementHiParts.push(textContent);
      } else {
        statementEnParts.push(textContent);
      }
    } else if (currentTarget === "option") {
      if (isHindi) {
        optionsHi[currentOptionKey] = (optionsHi[currentOptionKey] ? optionsHi[currentOptionKey] + " " : "") + textContent;
      } else {
        optionsEn[currentOptionKey] = (optionsEn[currentOptionKey] ? optionsEn[currentOptionKey] + " " : "") + textContent;
      }
    } else if (currentTarget === "solution") {
      if (isHindi) {
        solutionHi = (solutionHi ? solutionHi + "\n" : "") + textContent;
      } else {
        solutionEn = (solutionEn ? solutionEn + "\n" : "") + textContent;
      }
    }
  }

  const statementEn = statementEnParts.join(" ").trim();
  const statementHi = statementHiParts.join(" ").trim();

  // Evaluate low-confidence fields
  const avgConfidence = elements.length > 0
    ? elements.reduce((acc, el) => acc + el.confidence, 0) / elements.length
    : 0.9;

  if (statementEn && elements.filter((e) => e.needsReview && statementEn.includes(e.content)).length > 0) {
    lowConfidenceFields.push("statementEn");
  }
  if (statementHi && elements.filter((e) => e.needsReview && statementHi.includes(e.content)).length > 0) {
    lowConfidenceFields.push("statementHi");
  }
  for (const k of ["A", "B", "C", "D"]) {
    if (optionsEn[k] && elements.filter((e) => e.needsReview && optionsEn[k].includes(e.content)).length > 0) {
      lowConfidenceFields.push(`option_${k}_En`);
    }
    if (optionsHi[k] && elements.filter((e) => e.needsReview && optionsHi[k].includes(e.content)).length > 0) {
      lowConfidenceFields.push(`option_${k}_Hi`);
    }
  }

  // Subject and Chapter Taxonomy heuristics
  const fullText = (statementEn + " " + statementHi + " " + Object.values(optionsEn).join(" ")).toLowerCase();
  let subject: "Physics" | "Chemistry" | "Biology" | "Mathematics" | "Science" = "Physics";
  let chapter = "General Physics";
  let topic = "Core Concept";

  if (/chemical|reaction|mole|acid|base|organic|orbital|bond|molarity|atom|h2so4|nacl/i.test(fullText)) {
    subject = "Chemistry";
    chapter = "Chemical Bonding & Atomic Structure";
    topic = "Molecular Structure";
  } else if (/cell|dna|rna|plant|tissue|protein|genetics|organism|photosynthesis|mitosis|zoology|botany/i.test(fullText)) {
    subject = "Biology";
    chapter = "Cell Biology & Genetics";
    topic = "Cell Structure & Function";
  } else if (/matrix|integral|derivative|triangle|polynomial|equation|probability|vector|limit/i.test(fullText)) {
    subject = "Mathematics";
    chapter = "Calculus & Algebra";
    topic = "Differential & Integral Calculus";
  }

  return {
    statementEn,
    statementHi,
    optionsEn,
    optionsHi,
    correctAnswer,
    solutionEn,
    solutionHi,
    hasFigure,
    figureCaption,
    tables: tables.length > 0 ? tables : undefined,
    subject,
    chapter,
    topic,
    difficulty: "MEDIUM",
    type: "SINGLE_CORRECT",
    category: "NCERT Canonical",
    tags: ["NEET", "NCERT", subject],
    confidence: Math.round(avgConfidence * 100) / 100,
    lowConfidenceFields,
    isBilingual: Boolean(statementEn && statementHi),
    elements,
  };
}
