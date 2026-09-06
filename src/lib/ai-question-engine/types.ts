export type NeetDifficulty = "EASY" | "MEDIUM" | "HARD" | "ULTRA";

export type GenerationMethod = "AI" | "PDF";

export type GenerationLanguage = "ENGLISH" | "HINDI" | "BOTH";

export type PyqClassification = "STANDARD" | "PYQ_STYLE" | "PYQ_INSPIRED";

export interface NeetQuestionTypeDef {
  id: string;
  name: string;
  hindiName: string;
  badge: string;
  category: "STANDARD" | "STATEMENT" | "MATCH" | "VISUAL" | "CALCULATION" | "PASSAGE";
  description: string;
  exampleSnippet: string;
}

export const OFFICIAL_NEET_QUESTION_TYPES: NeetQuestionTypeDef[] = [
  {
    id: "SINGLE_CORRECT",
    name: "Single Correct MCQ",
    hindiName: "एकल सही विकल्प MCQ",
    badge: "MCQ",
    category: "STANDARD",
    description: "Standard multiple-choice question with exactly one correct option among four.",
    exampleSnippet: "Which of the following is the powerhouse of the cell? (A) Ribosome (B) Mitochondria...",
  },
  {
    id: "MULTIPLE_CORRECT",
    name: "Multiple Correct MCQ",
    hindiName: "बहु-विकल्प सही MCQ",
    badge: "Multi-MCQ",
    category: "STANDARD",
    description: "Multiple options can be scientifically correct. Used for comprehensive concept testing.",
    exampleSnippet: "Which of the following organelles contain double membranes?",
  },
  {
    id: "ASSERTION_REASON",
    name: "Assertion-Reason",
    hindiName: "अभिकथन और कारण (A-R)",
    badge: "A-R",
    category: "STATEMENT",
    description: "Contains Assertion (A) and Reason (R). Evaluates truth value and causal relationship.",
    exampleSnippet: "Assertion (A): Photosynthesis is anabolic. Reason (R): Glucose is synthesized.",
  },
  {
    id: "TWO_STATEMENT",
    name: "Statement I / Statement II",
    hindiName: "दो कथन (Statement I & II)",
    badge: "2-Stmt",
    category: "STATEMENT",
    description: "Exactly two distinct statements evaluated for independent correctness.",
    exampleSnippet: "Statement I: DNA replication is semiconservative. Statement II: RNA uses uracil.",
  },
  {
    id: "MULTI_STATEMENT_COMBINATION",
    name: "Multiple Statement Based",
    hindiName: "बहु-कथन संयोजन (3+ कथन)",
    badge: "Multi-Stmt",
    category: "STATEMENT",
    description: "Three or more discrete statements evaluated via combination answer options.",
    exampleSnippet: "Consider statements 1, 2, 3, 4. Which are correct? (A) 1 and 3 only...",
  },
  {
    id: "CORRECT_INCORRECT_STATEMENT",
    name: "Correct / Incorrect Statement",
    hindiName: "सही / गलत कथन पहचान",
    badge: "T/F Stmt",
    category: "STATEMENT",
    description: "Directly asks to identify which among the four statement options is INCORRECT or CORRECT.",
    exampleSnippet: "Which of the following statements regarding enzyme kinetics is INCORRECT?",
  },
  {
    id: "MATCH_THE_FOLLOWING",
    name: "Match the Following",
    hindiName: "सुमेलित कीजिए (2-कॉलम)",
    badge: "Match",
    category: "MATCH",
    description: "Column I (items) matched with Column II (functions/descriptions).",
    exampleSnippet: "Column I: A. Insulin, B. Glucagon | Column II: 1. Beta cells, 2. Alpha cells",
  },
  {
    id: "COLUMN_MATCHING",
    name: "Column Matching (3-Column)",
    hindiName: "त्रि-कॉलम मिलान (3-Column)",
    badge: "Col 3C",
    category: "MATCH",
    description: "Three-way matching structure connecting Organ/Compound ↔ Secretion/Site ↔ Function/Clinical effect.",
    exampleSnippet: "Column I | Column II | Column III: Match Hormone, Gland, Target Organ",
  },
  {
    id: "SEQUENCE_ARRANGEMENT",
    name: "Sequence / Arrangement",
    hindiName: "क्रम / व्यवस्था अनुक्रम",
    badge: "Sequence",
    category: "STANDARD",
    description: "Requires arranging steps, stages, or values in chronological, magnitude, or process order.",
    exampleSnippet: "Arrange the stages of meiosis I prophase in correct sequential order.",
  },
  {
    id: "DIAGRAM_BASED",
    name: "Diagram Based",
    hindiName: "चित्र / आरेख आधारित",
    badge: "Diagram",
    category: "VISUAL",
    description: "Interpretation of an anatomical, physical, or morphological diagram is essential to answer.",
    exampleSnippet: "In the given diagram of the nephron, identify part labelled 'X' and its function.",
  },
  {
    id: "IMAGE_BASED",
    name: "Image Based",
    hindiName: "वास्तविक चित्र आधारित",
    badge: "Image",
    category: "VISUAL",
    description: "Based on real microscopic slide, specimen photograph, or apparatus image extracted from PDF.",
    exampleSnippet: "Identify the tissue shown in the photomicrograph.",
  },
  {
    id: "GRAPH_BASED",
    name: "Graph Based",
    hindiName: "ग्राफ / वक्र आधारित",
    badge: "Graph",
    category: "VISUAL",
    description: "Interpreting axis variables, slopes, area under curve, or rate curves.",
    exampleSnippet: "In the given enzyme activity vs temperature curve, point 'T_opt' represents:",
  },
  {
    id: "TABLE_BASED",
    name: "Table Based",
    hindiName: "तालिका आधारित",
    badge: "Table",
    category: "STANDARD",
    description: "A structured data or property table is provided; answer requires analyzing table cells.",
    exampleSnippet: "Analyze the table of blood groups, antigens and donor compatibility.",
  },
  {
    id: "PASSAGE_COMPREHENSION",
    name: "Passage / Comprehension Based",
    hindiName: "गद्यांश / अवतरण आधारित",
    badge: "Passage",
    category: "PASSAGE",
    description: "A scientific excerpt/passage is provided, followed by deduction and inference questions.",
    exampleSnippet: "Read the excerpt on Lac Operon regulation and answer the following question.",
  },
  {
    id: "CASE_BASED",
    name: "Case Based",
    hindiName: "केस / नैदानिक स्थिति आधारित",
    badge: "Case",
    category: "PASSAGE",
    description: "Clinical patient history, ecological field study, or experimental observation case scenario.",
    exampleSnippet: "A 45-year-old patient presents with polyuria and polydipsia. Lab analysis shows...",
  },
  {
    id: "NUMERICAL_VALUE",
    name: "Numerical Value Based",
    hindiName: "संख्यात्मक गणना आधारित",
    badge: "Numerical",
    category: "CALCULATION",
    description: "Requires multi-step mathematical calculation using standard NCERT physical/chemical formulas.",
    exampleSnippet: "Calculate the root mean square velocity of oxygen molecules at 300 K.",
  },
  {
    id: "INTEGER_ANSWER",
    name: "Integer / Numerical Answer",
    hindiName: "पूर्णांक उत्तर प्रकार",
    badge: "Integer",
    category: "CALCULATION",
    description: "Answer is a single positive integer or whole number (NTA pattern Section B style).",
    exampleSnippet: "How many ATP molecules are net gained during aerobic glycolysis of one glucose?",
  },
  {
    id: "CONCEPT_APPLICATION",
    name: "Concept Application",
    hindiName: "संकल्पना अनुप्रयोग",
    badge: "Concept",
    category: "STANDARD",
    description: "Tests deep understanding by applying a governing law to a novel hypothetical scenario.",
    exampleSnippet: "If atmospheric CO2 concentration doubles, which plant group shows higher saturation?",
  },
  {
    id: "EXPERIMENTAL_PRACTICAL",
    name: "Experimental / Practical Based",
    hindiName: "प्रायोगिक / क्रियाकलाप आधारित",
    badge: "Practical",
    category: "STANDARD",
    description: "Directly tests NCERT laboratory manual experiments, salt analysis, or dissection techniques.",
    exampleSnippet: "During potato osmometer experiment, why is the cavity made in boiled potato inactive?",
  },
  {
    id: "NCERT_LINE_BASED",
    name: "NCERT Line Based",
    hindiName: "NCERT पंक्ति आधारित",
    badge: "NCERT Line",
    category: "STANDARD",
    description: "Direct concept, factual precision, or authentic quote derived verbatim from standard NCERT textbook.",
    exampleSnippet: "According to NCERT, what percentage of photosynthetic active radiation (PAR) is captured?",
  },
];

export interface RawAiGeneratedQuestion {
  questionIndex: number;
  statementEn: string;
  statementHi?: string;
  optionsEn: {
    A: string;
    B: string;
    C: string;
    D: string;
    [key: string]: string;
  };
  optionsHi?: {
    A: string;
    B: string;
    C: string;
    D: string;
    [key: string]: string;
  };
  correctAnswer: string[]; // e.g. ["A"]
  solutionEn: string;
  solutionHi?: string;
  subject: string;
  chapter: string;
  topic: string;
  subTopic?: string;
  difficulty: NeetDifficulty;
  questionType: string;
  pyqStyle: PyqClassification;
  language: GenerationLanguage;
  requiresImage?: boolean;
  sourcePageNumbers?: number[];
  sourceExcerpt?: string;
  sourceImageId?: string;
}

export interface QuestionValidationReport {
  isValid: boolean;
  validationStatus: "PASSED" | "NEEDS_REVIEW" | "FAILED" | "ANSWER_VALIDATION_FAILED" | "BILINGUAL_VALIDATION_FAILED";
  solverVerifiedAnswer?: string[];
  solverConfidence: number;
  solverReasoning: string;
  isAmbiguous: boolean;
  ambiguityReason?: string;
  isScientificallySound: boolean;
  solutionConsistentWithAnswer: boolean;
  duplicateScore: number;
  duplicateRisk: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE";
  potentialDuplicateCode?: string;
  bilingualEquivalent: boolean;
  bilingualDiscrepancies?: string[];
  issues: string[];
}

export interface QuestionQualityScores {
  contentAccuracy: number; // 0 - 100
  answerConfidence: number; // 0 - 100
  ncertAlignment: number; // 0 - 100
  neetRelevance: number; // 0 - 100
  languageQuality: number; // 0 - 100
  overallScore: number; // 0 - 100
}

export interface GenerationPlanItem {
  questionTypeId: string;
  typeName: string;
  count: number;
  difficultyBreakdown?: Record<NeetDifficulty, number>;
}

export interface GenerationPlan {
  totalQuestions: number;
  items: GenerationPlanItem[];
  difficultyMix: Record<NeetDifficulty, number>;
  language: GenerationLanguage;
}
