/**
 * NEET QUESTION TYPE DEFINITIONS & DETERMINISTIC CLASSIFICATION ENGINE
 *
 * Implements the 18 official NEET question formats with structural identification rules.
 * Category is determined by structure (statements count, table presence, column count,
 * diagram requirement, sequence arrows, numerical calculation) rather than superficial wording.
 */

export interface NeetQuestionTypeDef {
  id: string;
  name: string;
  hindiName: string;
  badge: string;
  category: "STANDARD" | "STATEMENT" | "MATCH" | "VISUAL" | "CALCULATION";
  identificationRule: string;
  exampleSnippet: string;
}

export const NEET_QUESTION_TYPES: NeetQuestionTypeDef[] = [
  {
    id: "SINGLE_CORRECT",
    name: "Single Correct MCQ",
    hindiName: "एकल सही विकल्प MCQ",
    badge: "MCQ",
    category: "STANDARD",
    identificationRule: "सामान्य MCQ जिसमें केवल एक option सही है।",
    exampleSnippet: "Which of the following is the powerhouse of the cell?",
  },
  {
    id: "TABLE_BASED",
    name: "Table-based MCQ",
    hindiName: "तालिका आधारित MCQ",
    badge: "Table",
    category: "STANDARD",
    identificationRule: "Question में information/table दी जाती है और answer table की entries को पढ़कर निकालना होता है।",
    exampleSnippet: "Organ | Function\nKidney | Excretion\nWhich matching is correct?",
  },
  {
    id: "ASSERTION_REASON",
    name: "Assertion–Reason",
    hindiName: "अभिकथन और कारण (A-R)",
    badge: "A-R",
    category: "STATEMENT",
    identificationRule: "दो statements होते हैं — Assertion (A) और Reason (R) — और options उनके logical relationship पर आधारित होते हैं।",
    exampleSnippet: "Assertion (A): Photosynthesis is an anabolic process.\nReason (R): Photosynthesis synthesises glucose.",
  },
  {
    id: "STATEMENT_BASED",
    name: "Statement-based",
    hindiName: "कथन आधारित",
    badge: "Statement",
    category: "STATEMENT",
    identificationRule: "Question में सामान्यतः एक statement दिया जाता है और उसी statement की correctness पूछी जाती है।",
    exampleSnippet: "Consider the following statement: 'All enzymes are proteins.' Evaluate its correctness.",
  },
  {
    id: "TWO_STATEMENT",
    name: "Two-Statement",
    hindiName: "दो कथन (Statement I & II)",
    badge: "2-Stmt",
    category: "STATEMENT",
    identificationRule: "Exactly दो statements — Statement I और Statement II दिए जाते हैं और दोनों की individual correctness evaluate की जाती है।",
    exampleSnippet: "Statement I: DNA replication is semiconservative.\nStatement II: Each daughter DNA has one parental strand.",
  },
  {
    id: "MATCH_2_COLUMN",
    name: "Match the Column — 2 Columns",
    hindiName: "कॉलम मिलान — 2 कॉलम",
    badge: "Match 2C",
    category: "MATCH",
    identificationRule: "दो columns — Column I और Column II — और दोनों के बीच matching करनी होती है।",
    exampleSnippet: "Column I | Column II\nA. Insulin | 1. Pancreas\nB. Thyroxine | 2. Thyroid",
  },
  {
    id: "MATCH_3_COLUMN",
    name: "Match the Column — 3 Columns",
    hindiName: "कॉलम मिलान — 3 कॉलम",
    badge: "Match 3C",
    category: "MATCH",
    identificationRule: "तीन अलग-अलग columns होते हैं और तीन-way matching करनी होती है।",
    exampleSnippet: "Column I | Column II | Column III\nA. Insulin | 1. Pancreas | P. Blood glucose",
  },
  {
    id: "MATCH_CONCEPTUAL",
    name: "Match the Column — Conceptual",
    hindiName: "संकल्पनात्मक मिलान",
    badge: "Match Concept",
    category: "MATCH",
    identificationRule: "matching केवल factual names की नहीं, बल्कि concept ↔ principle / situation / interpretation की होती है।",
    exampleSnippet: "Concept | Explanation\nA. Osmosis | 1. Movement across selective membrane",
  },
  {
    id: "SEQUENCE_ORDER",
    name: "Sequence / Arrangement",
    hindiName: "क्रम / व्यवस्था अनुक्रम",
    badge: "Sequence",
    category: "STANDARD",
    identificationRule: "Steps, events, organisms, processes या structures को correct chronological / logical order में arrange करना होता है।",
    exampleSnippet: "Arrange the following events in correct sequence: 2 -> 4 -> 1 -> 3",
  },
  {
    id: "CORRECT_INCORRECT_STATEMENT",
    name: "Correct / Incorrect Statement",
    hindiName: "सही / गलत कथन पहचान",
    badge: "T/F Stmt",
    category: "STATEMENT",
    identificationRule: "सीधे पूछा जाता है कि कौन-सा statement correct या incorrect है।",
    exampleSnippet: "Which of the following statements is INCORRECT?",
  },
  {
    id: "EXCEPT_TYPE",
    name: "EXCEPT Type",
    hindiName: "अपवाद (EXCEPT) प्रकार",
    badge: "EXCEPT",
    category: "STANDARD",
    identificationRule: "चार options में से तीन given condition को satisfy करते हैं और एक exception होता है।",
    exampleSnippet: "All of the following are functions of the liver EXCEPT:",
  },
  {
    id: "NUMERICAL",
    name: "Numerical / Calculation",
    hindiName: "संख्यात्मक / गणना आधारित",
    badge: "Numerical",
    category: "CALCULATION",
    identificationRule: "Answer निकालने के लिए numerical value / mathematical calculation करनी पड़ती है।",
    exampleSnippet: "A body travels with 20 m/s for 5 s. Distance travelled is: (A) 100 m",
  },
  {
    id: "DIAGRAM_BASED",
    name: "Diagram-based",
    hindiName: "चित्र / आरेख आधारित",
    badge: "Diagram",
    category: "VISUAL",
    identificationRule: "Question solve करने के लिए diagram को interpret करना आवश्यक है।",
    exampleSnippet: "In the given diagram of nephron, part labelled P represents:",
  },
  {
    id: "FIGURE_IDENTIFICATION_TABLE",
    name: "Figure Identification + Table",
    hindiName: "चित्र पहचान + तालिका",
    badge: "Fig + Table",
    category: "VISUAL",
    identificationRule: "पहले figure identify करनी है, फिर figure की identity को table/information से match करना है।",
    exampleSnippet: "Identify the organelle in the figure and select its correct feature from the table.",
  },
  {
    id: "FLOWCHART_BASED",
    name: "Flowchart-based",
    hindiName: "फ्लोचार्ट / प्रक्रम आधारित",
    badge: "Flowchart",
    category: "VISUAL",
    identificationRule: "Question में flowchart/process diagram दिया जाता है और missing step, sequence या outcome identify करना होता है।",
    exampleSnippet: "Glucose -> Glycolysis -> Pyruvate -> ? -> CO2 + H2O",
  },
  {
    id: "MULTI_STATEMENT_COMBINATION",
    name: "Multi-Statement Combination",
    hindiName: "बहु-कथन संयोजन (3+ कथन)",
    badge: "Multi-Stmt",
    category: "STATEMENT",
    identificationRule: "तीन या अधिक statements दिए जाते हैं और options statements के combination पर आधारित होते हैं।",
    exampleSnippet: "Consider statements 1, 2, 3, 4. Which are correct? (A) 1 and 3 only",
  },
  {
    id: "CONCEPT_TABLE_COMBINATION",
    name: "Concept + Table Combination",
    hindiName: "संकल्पना + तालिका संयोजन",
    badge: "Concept+Table",
    category: "MATCH",
    identificationRule: "Question पहले किसी concept/principle को test करता है और उसी के साथ table से information interpret करनी पड़ती है।",
    exampleSnippet: "Based on the concept of enzyme inhibition: Type | Inhibitor binds",
  },
  {
    id: "IMAGE_STATEMENT_COMBINATION",
    name: "Image + Statement Combination",
    hindiName: "चित्र + कथन संयोजन",
    badge: "Img + Stmts",
    category: "VISUAL",
    identificationRule: "Question में image/figure + one or more statements होते हैं और image को देखकर statements evaluate करनी होती हैं।",
    exampleSnippet: "[Diagram of heart] Statements: 1. P receives oxygenated blood... Which statements are correct?",
  },
];

export interface NeetTypeDetectionResult {
  detectedType: string;
  typeDef: NeetQuestionTypeDef;
  confidence: number;
  reason: string;
}

/**
 * Deterministic Structural Classifier for NEET Question Types
 * Evaluates structure (Assertion-Reason, Statements count, Columns count, Table syntax, Sequence arrows, Numerical calculation, Diagram requirement)
 */
export function detectNeetQuestionType(
  statement: string,
  options?: { A?: string; B?: string; C?: string; D?: string } | Record<string, string>,
  hasImage: boolean = false
): NeetTypeDetectionResult {
  const text = (statement || "").trim();
  const lowerText = text.toLowerCase();
  const optionsText = Object.values(options || {}).join(" ").toLowerCase();
  const fullText = `${lowerText} ${optionsText}`;

  // 1. ASSERTION - REASON (Explicit Assertion and Reason markers)
  const isAssertionReason =
    (/\bassertion\s*(\(a\)|\b)[\s\S]*?\breason\s*(\(r\)|\b)/i.test(text) ||
      /\b(अभिकथन|assertion)\b[\s\S]*?\b(कारण|reason)\b/i.test(text)) &&
    (/(both a and r are true|a is true|r is the correct explanation)/i.test(optionsText) ||
      /(both a and r|assertion and reason)/i.test(lowerText));

  if (isAssertionReason) {
    return {
      detectedType: "ASSERTION_REASON",
      typeDef: NEET_QUESTION_TYPES.find((t) => t.id === "ASSERTION_REASON")!,
      confidence: 99,
      reason: "Contains explicit Assertion (A) and Reason (R) statements with logical relationship options.",
    };
  }

  // 2. TWO-STATEMENT (Exactly Statement I and Statement II)
  const hasStatementI = /\bstatement\s*(i|1)\b|\bकथन\s*(i|1|एक)\b/i.test(text);
  const hasStatementII = /\bstatement\s*(ii|2)\b|\bकथन\s*(ii|2|दो)\b/i.test(text);
  const hasStatementIII = /\bstatement\s*(iii|3)\b|\bकथन\s*(iii|3|तीन)\b/i.test(text);

  if (hasStatementI && hasStatementII && !hasStatementIII) {
    return {
      detectedType: "TWO_STATEMENT",
      typeDef: NEET_QUESTION_TYPES.find((t) => t.id === "TWO_STATEMENT")!,
      confidence: 98,
      reason: "Structured with exactly two distinct statements (Statement I and Statement II).",
    };
  }

  // 3. SEQUENCE / ARRANGEMENT (Chronological / magnitude order with arrows or arrange keyword)
  const hasSequenceArrows = /→|->|-->|⇒|\b\d+\s*→\s*\d+/i.test(text) || /→|->|-->/i.test(optionsText);
  const hasArrangeKeyword = /\b(arrange|increasing order|decreasing order|chronological|sequence|order of|क्रम में व्यवस्थित|बढ़ते क्रम|घटते क्रम)\b/i.test(lowerText);

  if (hasArrangeKeyword || hasSequenceArrows) {
    return {
      detectedType: "SEQUENCE_ORDER",
      typeDef: NEET_QUESTION_TYPES.find((t) => t.id === "SEQUENCE_ORDER")!,
      confidence: 95,
      reason: "Requires arranging steps/events/magnitudes in logical or chronological sequence.",
    };
  }

  // 4. MATCH THE COLUMN - 3 COLUMNS (Column I, Column II, Column III)
  const hasColumn1 = /\bcolumn\s*(i|1)\b|\bकॉलम\s*(i|1)\b/i.test(text);
  const hasColumn2 = /\bcolumn\s*(ii|2)\b|\bकॉलम\s*(ii|2)\b/i.test(text);
  const hasColumn3 = /\bcolumn\s*(iii|3)\b|\bकॉलम\s*(iii|3)\b/i.test(text);

  if (hasColumn1 && hasColumn2 && hasColumn3) {
    return {
      detectedType: "MATCH_3_COLUMN",
      typeDef: NEET_QUESTION_TYPES.find((t) => t.id === "MATCH_3_COLUMN")!,
      confidence: 98,
      reason: "Three-way column matching structure (Column I, Column II, and Column III).",
    };
  }

  // 5. MATCH THE COLUMN - 2 COLUMNS (Column I & Column II or matching pairs)
  const hasMatchPairOptions = /\ba[\s–-]*[1-4p-s]/i.test(optionsText) || /\bp[\s–-]*[1-4a-d]/i.test(optionsText);
  const is2ColumnMatch = (hasColumn1 && hasColumn2) || (/\bmatch\b|\bमिलान\b/i.test(lowerText) && hasMatchPairOptions);

  if (is2ColumnMatch) {
    // Check if conceptual matching (e.g. concept ↔ principle/inhibition)
    const isConceptual = /\b(concept|principle|interpretation|theory|inhibition|hypothesis|संकल्पना|सिद्धांत)\b/i.test(lowerText);
    if (isConceptual) {
      return {
        detectedType: "MATCH_CONCEPTUAL",
        typeDef: NEET_QUESTION_TYPES.find((t) => t.id === "MATCH_CONCEPTUAL")!,
        confidence: 92,
        reason: "Column matching based on theoretical concepts, scientific principles, or interpretations.",
      };
    }
    return {
      detectedType: "MATCH_2_COLUMN",
      typeDef: NEET_QUESTION_TYPES.find((t) => t.id === "MATCH_2_COLUMN")!,
      confidence: 96,
      reason: "Standard two-column matching structure (Column I ↔ Column II).",
    };
  }

  // 6. FLOWCHART BASED (Process diagram with arrows or missing step X/?)
  const hasFlowchartPointers = /([a-z0-9]+\s*→\s*[a-z0-9]+\s*→\s*\?|[a-z0-9]+\s*->\s*[a-z0-9]+\s*->\s*x)/i.test(text);
  const isFlowchartText = /\b(flowchart|flow chart|process pathway|missing process|x represents|\? represents|फ्लोचार्ट)\b/i.test(lowerText);

  if (hasFlowchartPointers || isFlowchartText) {
    return {
      detectedType: "FLOWCHART_BASED",
      typeDef: NEET_QUESTION_TYPES.find((t) => t.id === "FLOWCHART_BASED")!,
      confidence: 94,
      reason: "Represents a step-by-step biological or chemical process flowchart with missing steps.",
    };
  }

  // 7. TABLE BASED & COMBINATIONS (Check for markdown table syntax |---| or multiple tabbed data)
  const hasMarkdownTable = /\|[\s\S]*?\|[\s\S]*?\n\|[-:\s|]+\|/i.test(text) || (text.split("\n").filter((l) => l.includes("\t") || l.split("|").length >= 3).length >= 2);
  const isTableMentioned = /\b(given table|following table|तालिका|entries in the table)\b/i.test(lowerText);

  if (hasMarkdownTable || isTableMentioned) {
    if (hasImage || /\b(figure|diagram|microscopic|आरेख|चित्र)\b/i.test(lowerText)) {
      return {
        detectedType: "FIGURE_IDENTIFICATION_TABLE",
        typeDef: NEET_QUESTION_TYPES.find((t) => t.id === "FIGURE_IDENTIFICATION_TABLE")!,
        confidence: 94,
        reason: "Dual requirement: Identify image structure and match properties from a data table.",
      };
    }
    if (/\b(concept of|principle|represents|active transport|inhibition)\b/i.test(lowerText)) {
      return {
        detectedType: "CONCEPT_TABLE_COMBINATION",
        typeDef: NEET_QUESTION_TYPES.find((t) => t.id === "CONCEPT_TABLE_COMBINATION")!,
        confidence: 91,
        reason: "Requires conceptual reasoning integrated with data table interpretation.",
      };
    }
    return {
      detectedType: "TABLE_BASED",
      typeDef: NEET_QUESTION_TYPES.find((t) => t.id === "TABLE_BASED")!,
      confidence: 93,
      reason: "Table acts as the primary data and information source for answering.",
    };
  }

  // 8. MULTI-STATEMENT COMBINATION (3+ statements or numbered statements with combination options)
  const hasCombinationOptions = /\b(1 and 3 only|1, 2 and 3|only 1 and 2|all of the above|1, 3 and 4|केवल 1 और 2)\b/i.test(optionsText);
  const hasNumberedStatements = /(?:^|\n)\s*(?:\([1-4i-v]\)|[1-4i-v][\.\)])\s+/i.test(text);

  if ((hasNumberedStatements && hasCombinationOptions) || (/\bconsider the following statements\b|\bदिए गए कथनों पर विचार\b/i.test(lowerText) && hasCombinationOptions)) {
    if (hasImage || /\b(given figure|diagram below|labelled|दिए गए चित्र)\b/i.test(lowerText)) {
      return {
        detectedType: "IMAGE_STATEMENT_COMBINATION",
        typeDef: NEET_QUESTION_TYPES.find((t) => t.id === "IMAGE_STATEMENT_COMBINATION")!,
        confidence: 95,
        reason: "Diagram provided alongside multiple statements evaluated jointly.",
      };
    }
    return {
      detectedType: "MULTI_STATEMENT_COMBINATION",
      typeDef: NEET_QUESTION_TYPES.find((t) => t.id === "MULTI_STATEMENT_COMBINATION")!,
      confidence: 96,
      reason: "Contains 3+ discrete statements evaluated via combination answer options.",
    };
  }

  // 9. STATEMENT-BASED (Single statement in quotes or block evaluated for correctness)
  const hasQuotedStatement = /"[^"]{10,}"|'[^']{10,}'|«[^»]{10,}»/i.test(text);
  const isSingleStatementEval = /\bconsider the following statement\b|\bइस कथन का मूल्यांकन\b/i.test(lowerText);

  if (isSingleStatementEval || (hasQuotedStatement && /\b(statement is|correct evaluation|कथन सही है)\b/i.test(lowerText))) {
    return {
      detectedType: "STATEMENT_BASED",
      typeDef: NEET_QUESTION_TYPES.find((t) => t.id === "STATEMENT_BASED")!,
      confidence: 91,
      reason: "Evaluates the validity and nuances of a single standalone scientific statement.",
    };
  }

  // 10. EXCEPT TYPE (All of the following... EXCEPT / सिवाय / को छोड़कर)
  const isExcept = /\b(except|not a|exclude|सिवाय|को छोड़कर|के अलावा)\b/i.test(text);
  if (isExcept) {
    return {
      detectedType: "EXCEPT_TYPE",
      typeDef: NEET_QUESTION_TYPES.find((t) => t.id === "EXCEPT_TYPE")!,
      confidence: 95,
      reason: "Three options satisfy the given condition, while one represents the required exception.",
    };
  }

  // 11. DIAGRAM / VISUAL BASED (Diagram essential)
  const isDiagramBased = hasImage || /\b(given diagram|labelled structure|diagram below|in the figure|दिए गए चित्र|रेखाचित्र)\b/i.test(lowerText);
  if (isDiagramBased) {
    return {
      detectedType: "DIAGRAM_BASED",
      typeDef: NEET_QUESTION_TYPES.find((t) => t.id === "DIAGRAM_BASED")!,
      confidence: 94,
      reason: "Interpretation of an anatomical, physical, or chemical diagram is essential to solve.",
    };
  }

  // 12. NUMERICAL / CALCULATION (Formulas, mathematical calculations, SI units)
  const hasNumericalValues = /\b\d+(\.\d+)?\s*(m\/s|m\s*s⁻¹|kg|mol|l|mol⁻¹|v|volt|ohm|ampere|joule|cal|nm|hz|kpa|atm|molar|molarity|molality|ph|μf|pf)\b/i.test(fullText);
  const hasCalculateKeywords = /\b(calculate|find the value|determine the magnitude|ratio of|distance travelled|molar volume|गणना करें|मान ज्ञात)\b/i.test(lowerText);

  if (hasNumericalValues || (hasCalculateKeywords && /\b\d+\b/.test(text))) {
    return {
      detectedType: "NUMERICAL",
      typeDef: NEET_QUESTION_TYPES.find((t) => t.id === "NUMERICAL")!,
      confidence: 93,
      reason: "Requires mathematical or physical formula calculation to determine numerical value.",
    };
  }

  // 13. CORRECT / INCORRECT STATEMENT (General statement identification among options)
  const isCorrectIncorrect = /\b(which of the following statement[s]? is (correct|incorrect|not correct|true|false)|निम्नलिखित में से कौन सा कथन (सही|गलत|असत्य) है)\b/i.test(lowerText);
  if (isCorrectIncorrect) {
    return {
      detectedType: "CORRECT_INCORRECT_STATEMENT",
      typeDef: NEET_QUESTION_TYPES.find((t) => t.id === "CORRECT_INCORRECT_STATEMENT")!,
      confidence: 90,
      reason: "Directly asks to distinguish a single correct or incorrect fact among four options.",
    };
  }

  // 14. DEFAULT: SINGLE CORRECT MCQ
  return {
    detectedType: "SINGLE_CORRECT",
    typeDef: NEET_QUESTION_TYPES.find((t) => t.id === "SINGLE_CORRECT")!,
    confidence: 85,
    reason: "Standard multiple choice question with a single correct option.",
  };
}
