/**
 * QUESTION STRUCTURE NORMALIZATION & INTEGRITY ENGINE
 *
 * Provides deterministic separation of question stem and options,
 * reconstruction of Match-the-Column 2-column tables,
 * formatting of Statement I & II and Assertion-Reason blocks,
 * and structural validation for question import and ingestion pipelines.
 */

export interface OptionMap {
  A: string;
  B: string;
  C: string;
  D: string;
  [key: string]: string;
}

export interface SplitResult {
  cleanStem: string;
  extractedOptions?: OptionMap;
  hasRemovedEmbeddedOptions: boolean;
}

export interface MatchColumnStructure {
  stem: string;
  list1Title: string;
  list2Title: string;
  rows: Array<{
    col1Label: string;
    col1Text: string;
    col2Label: string;
    col2Text: string;
  }>;
  instruction: string;
  markdownTable: string;
}

const INSTRUCTION_REGEX =
  /(?:choose the correct answer|नीचे दिए गए विकल्पों में से सही|उपर्युक्त कथनों के संदर्भ में|निम्नलिखित में से सही विकल्प|select the correct option|in the light of the above statements)/i;

/**
 * Parses and reconstructs Match List / Match Column questions into a clean 2-column table
 * and separates the trailing MCQ options.
 */
export function parseAndFormatMatchColumn(
  statement: string,
  existingOptions?: Record<string, string> | null
): {
  cleanStatement: string;
  extractedOptions?: OptionMap;
  isMatchColumn: boolean;
} {
  const isMatch =
    /match\s+(?:the\s+)?(?:column|list)|सूची\s*[-–I1]*\s*को\s*सूची|स्तम्भ\s*[-–I1]*/i.test(
      statement
    );

  if (!isMatch) {
    return { cleanStatement: statement, isMatchColumn: false };
  }

  // Find instruction line: "Choose the correct answer from the options given below"
  const instrMatch = statement.match(INSTRUCTION_REGEX);
  let mainBody = statement;
  let optionsPart = "";

  if (instrMatch && instrMatch.index !== undefined) {
    // Everything from the start up to the end of the instruction line is the question body
    const instrEndIdx = statement.indexOf("\n", instrMatch.index);
    if (instrEndIdx !== -1) {
      mainBody = statement.slice(0, instrEndIdx).trim();
      optionsPart = statement.slice(instrEndIdx).trim();
    } else {
      mainBody = statement;
    }
  }

  // Extract MCQ options from optionsPart if present
  let extractedOptions: Partial<OptionMap> = {};
  if (optionsPart) {
    const optRegex =
      /\(?([A-Da-d1-4])\)?[\.\:\)]?\s+([\s\S]*?)(?=(?:\r?\n\s*|\s{2,})\(?([A-Da-d1-4])\)?[\.\:\)]?\s+|$)/g;
    let m: RegExpExecArray | null;
    while ((m = optRegex.exec(optionsPart)) !== null) {
      const rawKey = m[1]!.toUpperCase();
      const key =
        rawKey === "1" ? "A" : rawKey === "2" ? "B" : rawKey === "3" ? "C" : rawKey === "4" ? "D" : rawKey;
      if (["A", "B", "C", "D"].includes(key) && !extractedOptions[key]) {
        extractedOptions[key] = m[2]!.trim();
      }
    }
  }

  // Now, check if mainBody already has a table
  if (
    /\|[\s\S]*?\|[\s\S]*?\n\|[-:\s|]+\|/i.test(mainBody) ||
    /\\begin\{array\}/i.test(mainBody)
  ) {
    return {
      cleanStatement: mainBody,
      extractedOptions:
        extractedOptions.A && extractedOptions.B
          ? (extractedOptions as OptionMap)
          : undefined,
      isMatchColumn: true,
    };
  }

  // Reconstruct table from mainBody
  const lines = mainBody
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let stemLines: string[] = [];
  let list1Title = "List I";
  let list2Title = "List II";
  let list1Items: { label: string; text: string }[] = [];
  let list2Items: { label: string; text: string }[] = [];
  let instructionLine = "";

  let currentMode: "STEM" | "LIST1" | "LIST2" | "INSTRUCTION" = "STEM";

  const row1Regex = /^(?:\(?([A-Da-d])\)?[\.\:\)]?)\s+(.+)$/;
  const row2Regex = /^(?:\(?([IVXivx1-4P-Sp-s]+)\)?[\.\:\)]?)\s+(.+)$/;

  for (const line of lines) {
    // Check if line is the main stem (contains match / सुमेलित / मिलाइए)
    if (/match|सुमेलित|सुमेलन|मिलाइए|स्तम्भ.*सुमेलित/i.test(line)) {
      currentMode = "STEM";
      stemLines.push(line);
      continue;
    }

    // Check if line is heading for List I / Column I
    if (
      /^\s*(?:list|column|सूची|स्तम्भ)\s*[-–]?\s*(?:i|1)(?:\s*\(|\s*$|\s+)/i.test(
        line
      ) &&
      !line.match(row1Regex)
    ) {
      currentMode = "LIST1";
      const tm = line.match(/\(([^)]+)\)/);
      const isHi = /[ऀ-ॿ]/.test(line);
      const titleExtra = tm?.[1]?.trim();
      list1Title = titleExtra
        ? isHi
          ? `सूची I (${titleExtra})`
          : `List I (${titleExtra})`
        : isHi
        ? "सूची I"
        : "List I";
      continue;
    }

    // Check if line is heading for List II / Column II
    if (
      /^\s*(?:list|column|सूची|स्तम्भ)\s*[-–]?\s*(?:ii|2)(?:\s*\(|\s*$|\s+)/i.test(
        line
      ) &&
      !line.match(row2Regex)
    ) {
      currentMode = "LIST2";
      const tm = line.match(/\(([^)]+)\)/);
      const isHi = /[ऀ-ॿ]/.test(line);
      const titleExtra2 = tm?.[1]?.trim();
      list2Title = titleExtra2
        ? isHi
          ? `सूची II (${titleExtra2})`
          : `List II (${titleExtra2})`
        : isHi
        ? "सूची II"
        : "List II";
      continue;
    }
    if (INSTRUCTION_REGEX.test(line)) {
      currentMode = "INSTRUCTION";
      instructionLine = line;
      continue;
    }

    if (currentMode === "STEM") {
      stemLines.push(line);
    } else if (currentMode === "LIST1") {
      const m = line.match(row1Regex);
      if (m) {
        list1Items.push({ label: m[1]!.toUpperCase(), text: m[2]!.trim() });
      } else if (list1Items.length > 0) {
        list1Items[list1Items.length - 1]!.text += " " + line;
      }
    } else if (currentMode === "LIST2") {
      const m = line.match(row2Regex);
      if (m) {
        list2Items.push({ label: m[1]!.toUpperCase(), text: m[2]!.trim() });
      } else if (list2Items.length > 0) {
        list2Items[list2Items.length - 1]!.text += " " + line;
      }
    } else if (currentMode === "INSTRUCTION") {
      instructionLine = instructionLine ? instructionLine + " " + line : line;
    }
  }

  if (
    list1Items.length >= 3 &&
    list2Items.length >= 3 &&
    list1Items.length === list2Items.length
  ) {
    let table = `| ${list1Title} | ${list2Title} |\n| :--- | :--- |\n`;
    for (let i = 0; i < list1Items.length; i++) {
      const it1 = list1Items[i]!;
      const it2 = list2Items[i]!;
      table += `| **(${it1.label})** ${it1.text} | **(${it2.label})** ${it2.text} |\n`;
    }

    const isHi = /[ऀ-ॿ]/.test(statement);
    const stem =
      stemLines.join("\n").trim() ||
      (isHi ? "सूची I को सूची II से सुमेलित कीजिए:" : "Match List I with List II.");
    const instr =
      instructionLine.trim() ||
      (isHi
        ? "नीचे दिए गए विकल्पों में से सही उत्तर चुनिए:"
        : "Choose the correct answer from the options given below:");

    return {
      cleanStatement: `${stem}\n\n${table}\n${instr}`,
      extractedOptions:
        extractedOptions.A && extractedOptions.B
          ? (extractedOptions as OptionMap)
          : undefined,
      isMatchColumn: true,
    };
  }

  return {
    cleanStatement: mainBody,
    extractedOptions:
      extractedOptions.A && extractedOptions.B
        ? (extractedOptions as OptionMap)
        : undefined,
    isMatchColumn: true,
  };
}

/**
 * Strips duplicate or trailing MCQ options from a question statement.
 * If existingOptions are provided, verifies that the text matches before stripping.
 * If existingOptions are missing/empty, extracts them from the statement.
 */
export function stripEmbeddedOptions(
  statement: string,
  existingOptions?: Record<string, string> | null
): SplitResult {
  if (!statement || typeof statement !== "string") {
    return { cleanStem: "", hasRemovedEmbeddedOptions: false };
  }

  const raw = statement.trim();

  // If this is a Match-the-column question, let parseAndFormatMatchColumn handle it
  if (
    /match\s+(?:the\s+)?(?:column|list)|सूची\s*[-–I1]*\s*को\s*सूची|स्तम्भ\s*[-–I1]*/i.test(
      raw
    )
  ) {
    const res = parseAndFormatMatchColumn(raw, existingOptions);
    if (res.isMatchColumn) {
      return {
        cleanStem: res.cleanStatement,
        extractedOptions: res.extractedOptions,
        hasRemovedEmbeddedOptions: Boolean(res.extractedOptions),
      };
    }
  }

  // If an instruction line is present, options are strictly after the instruction
  const instrMatch = raw.match(INSTRUCTION_REGEX);
  if (instrMatch && instrMatch.index !== undefined) {
    const afterInstrIdx = raw.indexOf("\n", instrMatch.index);
    if (afterInstrIdx !== -1) {
      const stemCandidate = raw.slice(0, afterInstrIdx).trim();
      const optionsCandidate = raw.slice(afterInstrIdx).trim();

      const extracted: Partial<OptionMap> = {};
      const optRegex =
        /(?:^|\r?\n|\s{2,}|\s+)\(?([A-Da-d1-4])\)?[\.\:\)]?\s+([\s\S]*?)(?=(?:\r?\n\s*|\s{2,}|\s+)\(?([A-Da-d1-4])\)?[\.\:\)]?\s+|$)/g;
      let match: RegExpExecArray | null;
      while ((match = optRegex.exec(optionsCandidate)) !== null) {
        const rawKey = match[1]!.toUpperCase();
        const key =
          rawKey === "1" ? "A" : rawKey === "2" ? "B" : rawKey === "3" ? "C" : rawKey === "4" ? "D" : rawKey;
        if (["A", "B", "C", "D"].includes(key) && !extracted[key]) {
          extracted[key] = match[2]!.trim();
        }
      }

      if (extracted.A && extracted.B && extracted.C && extracted.D) {
        return {
          cleanStem: stemCandidate,
          extractedOptions: extracted as OptionMap,
          hasRemovedEmbeddedOptions: true,
        };
      }
    }
  }

  // Pattern 1: Explicit trailing block of (A)... (B)... (C)... (D)...
  // Note: inline markers require parentheses (A) / (1) so words like "a solution" or "Assertion A" are never matched
  const trailingOptionsMatch = raw.match(
    /(?:\r?\n\s*(?:\((?:A|1)\)|(?:A|1)[.)])|\s+\((?:A|1)\)[.:)]?)\s+[\s\S]+?(?:\r?\n\s*(?:\((?:B|2)\)|(?:B|2)[.)])|\s+\((?:B|2)\)[.:)]?)\s+[\s\S]+?(?:\r?\n\s*(?:\((?:C|3)\)|(?:C|3)[.)])|\s+\((?:C|3)\)[.:)]?)\s+[\s\S]+?(?:\r?\n\s*(?:\((?:D|4)\)|(?:D|4)[.)])|\s+\((?:D|4)\)[.:)]?)\s+[\s\S]+$/i
  );

  if (trailingOptionsMatch && trailingOptionsMatch.index !== undefined) {
    const stemPart = raw.slice(0, trailingOptionsMatch.index).trim();
    const optionsPart = raw.slice(trailingOptionsMatch.index).trim();

    // Parse options from optionsPart
    const extracted: Partial<OptionMap> = {};
    const optRegex =
      /\(?([A-Da-d1-4])\)?[\.\:\)]?\s+([\s\S]*?)(?=(?:\r?\n\s*|\s{2,}|\s+)\(?([A-Da-d1-4])\)?[\.\:\)]?\s+|$)/g;
    let match: RegExpExecArray | null;
    while ((match = optRegex.exec(optionsPart)) !== null) {
      const rawKey = match[1]!.toUpperCase();
      const key =
        rawKey === "1" ? "A" : rawKey === "2" ? "B" : rawKey === "3" ? "C" : rawKey === "4" ? "D" : rawKey;
      if (["A", "B", "C", "D"].includes(key) && !extracted[key]) {
        extracted[key] = match[2]!.trim();
      }
    }

    if (extracted.A && extracted.B && extracted.C && extracted.D) {
      return {
        cleanStem: stemPart,
        extractedOptions: extracted as OptionMap,
        hasRemovedEmbeddedOptions: true,
      };
    }
  }

  // Pattern 2: Line-by-line check from bottom up
  const lines = raw.split(/\r?\n/);
  const optLines: { index: number; key: string; text: string }[] = [];
  const lineOptRegex = /^\s*\(?([A-Da-d1-4])\)?[\.\:\)]?\s+(.+)$/;

  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i]!.trim();
    if (!l) continue;
    const m = l.match(lineOptRegex);
    if (m) {
      const rawKey = m[1]!.toUpperCase();
      const key =
        rawKey === "1" ? "A" : rawKey === "2" ? "B" : rawKey === "3" ? "C" : rawKey === "4" ? "D" : rawKey;
      optLines.unshift({ index: i, key, text: m[2]!.trim() });
    } else {
      break;
    }
  }

  if (optLines.length === 4) {
    const keys = optLines.map((o) => o.key).join("");
    if (keys === "ABCD") {
      const stem = lines.slice(0, optLines[0]!.index).join("\n").trim();
      return {
        cleanStem: stem,
        extractedOptions: {
          A: optLines[0]!.text,
          B: optLines[1]!.text,
          C: optLines[2]!.text,
          D: optLines[3]!.text,
        },
        hasRemovedEmbeddedOptions: true,
      };
    }
  }

  // Pattern 3: If existingOptions are already given, check if trailing text matches option A
  if (existingOptions?.A && existingOptions?.B) {
    const optAText = existingOptions.A.trim();
    const optIdx = raw.lastIndexOf(optAText);
    if (optIdx > 10) {
      const prefix = raw.slice(Math.max(0, optIdx - 15), optIdx);
      const markerMatch = prefix.match(/(?:\s+|^)\(?(?:A|1)\)?[.:)]?\s*$/i);
      if (markerMatch && markerMatch.index !== undefined) {
        const cutPoint = Math.max(0, optIdx - 15) + markerMatch.index;
        return {
          cleanStem: raw.slice(0, cutPoint).trim(),
          hasRemovedEmbeddedOptions: true,
        };
      }
    }
  }

  return { cleanStem: raw, hasRemovedEmbeddedOptions: false };
}

/**
 * Formats Assertion-Reason questions with bold labels and distinct paragraphs
 */
export function formatAssertionReason(rawStatement: string): string {
  const { cleanStem } = stripEmbeddedOptions(rawStatement);
  let text = cleanStem.trim();

  text = text
    .replace(/(?:^|\n)\s*(?:Assertion\s*(?:\(A\)|A)?\s*[:\-])\s*/gi, "\n\n**Assertion (A):** ")
    .replace(/(?:^|\n)\s*(?:Reason\s*(?:\(R\)|R)?\s*[:\-])\s*/gi, "\n\n**Reason (R):** ")
    .replace(/(?:^|\n)\s*(?:अभिकथन\s*(?:\(A\)|A)?\s*[:\-])\s*/gi, "\n\n**अभिकथन (A):** ")
    .replace(/(?:^|\n)\s*(?:कारण\s*(?:\(R\)|R)?\s*[:\-])\s*/gi, "\n\n**कारण (R):** ")
    .trim();

  return text;
}

/**
 * Formats Statement I & II questions with distinct paragraphs
 */
export function formatMultipleStatements(rawStatement: string): string {
  const { cleanStem } = stripEmbeddedOptions(rawStatement);
  let text = cleanStem.trim();

  text = text
    .replace(/(?:^|\n)\s*(?:Statement\s*(?:I|1)\s*[:\-])\s*/gi, "\n\n**Statement I:** ")
    .replace(/(?:^|\n)\s*(?:Statement\s*(?:II|2)\s*[:\-])\s*/gi, "\n\n**Statement II:** ")
    .replace(/(?:^|\n)\s*(?:Statement\s*(?:III|3)\s*[:\-])\s*/gi, "\n\n**Statement III:** ")
    .replace(/(?:^|\n)\s*(?:Statement\s*(?:IV|4)\s*[:\-])\s*/gi, "\n\n**Statement IV:** ")
    .replace(/(?:^|\n)\s*(?:कथन\s*(?:I|1|एक)\s*[:\-])\s*/gi, "\n\n**कथन I:** ")
    .replace(/(?:^|\n)\s*(?:कथन\s*(?:II|2|दो)\s*[:\-])\s*/gi, "\n\n**कथन II:** ")
    .replace(/(?:^|\n)\s*(?:कथन\s*(?:III|3|तीन)\s*[:\-])\s*/gi, "\n\n**कथन III:** ")
    .replace(/(?:^|\n)\s*(?:कथन\s*(?:IV|4|चार)\s*[:\-])\s*/gi, "\n\n**कथन IV:** ")
    .trim();

  return text;
}

/**
 * Unified formatter that detects question structure and formats appropriately
 */
export function normalizeQuestionStatement(
  statement: string,
  questionType?: string,
  existingOptions?: Record<string, string> | null
): { cleanStatement: string; cleanOptions?: OptionMap; detectedType: string } {
  const lower = (statement || "").toLowerCase();
  let type = questionType || "SINGLE_CORRECT";

  // 1. Match the column
  if (
    /match\s+(?:the\s+)?(?:column|list)|सूची\s*[-–I1]*\s*को\s*सूची|स्तम्भ/i.test(lower) ||
    type === "MATCH_COLUMN" ||
    type === "MATCH_THE_COLUMN"
  ) {
    const res = parseAndFormatMatchColumn(statement, existingOptions);
    return {
      cleanStatement: res.cleanStatement,
      cleanOptions: res.extractedOptions,
      detectedType: "MATCH_COLUMN",
    };
  }

  // 2. Assertion - Reason
  if (
    /\b(?:assertion|अभिकथन)\b[\s\S]*?\b(?:reason|कारण)\b/i.test(lower) ||
    type === "ASSERTION_REASON"
  ) {
    const stripped = stripEmbeddedOptions(statement, existingOptions);
    const clean = formatAssertionReason(stripped.cleanStem);
    return {
      cleanStatement: clean,
      cleanOptions: stripped.extractedOptions,
      detectedType: "ASSERTION_REASON",
    };
  }

  // 3. Statement based / Multiple statements
  if (
    /\b(?:statement\s*(?:i|1)|कथन\s*(?:i|1))\b/i.test(lower) ||
    type === "STATEMENT_BASED" ||
    type === "TWO_STATEMENT" ||
    type === "MULTI_STATEMENT_COMBINATION"
  ) {
    const stripped = stripEmbeddedOptions(statement, existingOptions);
    const clean = formatMultipleStatements(stripped.cleanStem);
    return {
      cleanStatement: clean,
      cleanOptions: stripped.extractedOptions,
      detectedType: "STATEMENT_BASED",
    };
  }

  // 4. Default standard question / MCQ
  const stripped = stripEmbeddedOptions(statement, existingOptions);
  return {
    cleanStatement: stripped.cleanStem,
    cleanOptions: stripped.extractedOptions,
    detectedType: type,
  };
}
