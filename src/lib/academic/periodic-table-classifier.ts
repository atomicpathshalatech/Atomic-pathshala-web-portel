/**
 * PERIODIC TABLE CHEMISTRY CANONICAL CLASSIFICATION ENGINE
 *
 * Implements fine-grained Chemistry concept recognition for NCERT Class 11 Chapter 3:
 * "Classification of Elements and Periodicity in Properties"
 *
 * Strictly adheres to canonical NCERT taxonomy:
 * 3.1: Why do we need to classify Elements?
 * 3.2: Genesis of Periodic Classification (Mendeleev Periodic Table)
 * 3.3: Modern Periodic Law and Present Form of the Periodic Table
 * 3.4: Electronic Configurations of Elements and the Periodic Table (s, p, d, f blocks)
 * 3.5: Periodic Trends in Properties of Elements (Atomic Radii, Ionization Enthalpy, Electron Gain Enthalpy, Electronegativity)
 *
 * Provides granular subtopics matching official NEET/JEE concept specifications.
 * Assigns NEEDS_TOPIC_REVIEW if a question's concept cannot be validated with high certainty.
 */

export interface PeriodicClassificationResult {
  subject: "Chemistry";
  classLevel: "Class 11";
  chapter: string;
  chapterNumber: number;
  topic: string;
  topicNumber: string;
  subTopic: string;
  secondaryTopics: string[];
  conceptGroup: string;
  difficulty: "EASY" | "MEDIUM" | "HARD" | "VERY_HARD";
  confidence: number;
  reasoning: string;
  needsReview: boolean;
}

export const CANONICAL_PERIODIC_TOPICS = {
  NEED: {
    number: "3.1",
    title: "Why do we need to classify Elements?",
  },
  GENESIS: {
    number: "3.2",
    title: "Genesis of Periodic Classification (Mendeleev Periodic Table)",
  },
  MODERN_LAW: {
    number: "3.3",
    title: "Modern Periodic Law and Present Form of the Periodic Table",
  },
  CONFIGURATIONS: {
    number: "3.4",
    title: "Electronic Configurations of Elements and the Periodic Table (s, p, d, f blocks)",
  },
  TRENDS: {
    number: "3.5",
    title: "Periodic Trends in Properties of Elements (Atomic Radii, Ionization Enthalpy, Electron Gain Enthalpy, Electronegativity)",
  },
} as const;

export const CHAPTER_TITLE = "Classification of Elements and Periodicity in Properties";

/**
 * Classifies a Chemistry question statement, options, solution, and section header
 * into its exact canonical topic and specific sub-concept.
 */
export function classifyPeriodicTableQuestion(input: {
  statement: string;
  options?: Record<string, string> | { A?: string; B?: string; C?: string; D?: string } | null;
  solution?: string | null;
  sectionHeader?: string | null;
}): PeriodicClassificationResult {
  const statement = String(input.statement || "").trim();
  const optionsText = input.options ? Object.values(input.options).join(" ") : "";
  const solution = String(input.solution || "").trim();
  const header = String(input.sectionHeader || "").trim();
  const fullText = `${header} ${statement} ${optionsText} ${solution}`.toLowerCase();

  // 1. Historical Development of Periodic Table (Dobereiner, Newlands, Lothar Meyer, Mendeleev)
  if (
    /\b(mendeleev|lothar\s*meyer|newland|triad|octave\s*rule|eka[\s-]*(?:aluminium|silicon|boron|manganese)|anomalous\s*pair|atomic\s*weight\s*(?:basis|function))\b/i.test(
      fullText
    ) ||
    /development of periodic table/i.test(header)
  ) {
    let subTopic = "Historical Development of Periodic Table (Dobereiner, Newlands, Mendeleev, Lothar Meyer)";
    if (/lothar\s*meyer/i.test(fullText)) {
      subTopic = "Lothar Meyer Atomic Volume Curves & Physical Periodicity";
    } else if (/triad/i.test(fullText)) {
      subTopic = "Dobereiner's Law of Triads";
    } else if (/newland/i.test(fullText)) {
      subTopic = "Newlands' Law of Octaves & Noble Gas Limitations";
    } else if (/mendeleev|anomalous\s*pair|eka[\s-]/i.test(fullText)) {
      subTopic = "Mendeleev's Periodic Law, Blank Spaces & Anomalous Pairs";
    }

    return {
      subject: "Chemistry",
      classLevel: "Class 11",
      chapter: CHAPTER_TITLE,
      chapterNumber: 3,
      topic: CANONICAL_PERIODIC_TOPICS.GENESIS.title,
      topicNumber: CANONICAL_PERIODIC_TOPICS.GENESIS.number,
      subTopic,
      secondaryTopics: ["History of Chemistry", "Genesis of Classification"],
      conceptGroup: "Historical Development of the Periodic Table",
      difficulty: "EASY",
      confidence: 96,
      reasoning: "Question tests historical classification laws, triads, octaves, Lothar Meyer curves, or Mendeleev predictions.",
      needsReview: false,
    };
  }

  // 2. Ionization Potential / Ionization Enthalpy
  if (
    /\b(ionisation\s*(?:potential|energy|enthalpy)|ionization\s*(?:potential|energy|enthalpy)|1st\s*i\.?p|2nd\s*i\.?p|3rd\s*i\.?p|successive\s*i\.?e|successive\s*ionisation|jump\s*in\s*ip|unipositive\s*ion)\b/i.test(
      fullText
    ) ||
    /ionisation potential/i.test(header)
  ) {
    let subTopic = "Ionization Enthalpy Trends & Factors (Zeff, Size, Screening)";
    if (/successive|ip1|ip2|ip3/i.test(fullText)) {
      subTopic = "Successive Ionization Enthalpies & Valence Shell Determination";
    } else if (/\b(be\s*<\s*b|b\s*<\s*be|n\s*<\s*o|o\s*<\s*n|half[\s-]filled|penetration)\b/i.test(fullText)) {
      subTopic = "Anomalies in Ionization Enthalpy (Be vs B, N vs O Half-Filled Stability)";
    }

    return {
      subject: "Chemistry",
      classLevel: "Class 11",
      chapter: CHAPTER_TITLE,
      chapterNumber: 3,
      topic: CANONICAL_PERIODIC_TOPICS.TRENDS.title,
      topicNumber: CANONICAL_PERIODIC_TOPICS.TRENDS.number,
      subTopic,
      secondaryTopics: ["Periodic Trends", "Electronic Stability"],
      conceptGroup: "Ionization Enthalpy",
      difficulty: /successive|jump/i.test(fullText) ? "HARD" : "MEDIUM",
      confidence: 98,
      reasoning: "Question investigates first or successive ionization energy, electron removal energy, or anomalous IP configurations.",
      needsReview: false,
    };
  }

  // 3. Electron Affinity / Electron Gain Enthalpy
  if (
    /\b(electron\s*affinity|electron\s*gain\s*enthalpy|ea1|ea2|delta[\s_]*egh|\u0394heg|maximum\s*energy\s*released|energy\s*absorbed\s*in\s*second\s*electron|second\s*electron\s*addition|bivalent\s*anion)\b/i.test(
      fullText
    ) ||
    /electron affinity/i.test(header)
  ) {
    let subTopic = "Electron Gain Enthalpy Trends & Magnitude";
    if (/second\s*electron|endothermic|inter[\s-]electronic\s*repulsion/i.test(fullText)) {
      subTopic = "Endothermic Nature of Second Electron Gain Enthalpy (O²⁻, S²⁻ Formation)";
    } else if (/cl\s*>\s*f|chlorine.*fluorine|3rd\s*period.*2nd\s*period/i.test(fullText)) {
      subTopic = "Halogen Electron Gain Enthalpy Anomaly (Cl > F due to 2p Repulsion)";
    }

    return {
      subject: "Chemistry",
      classLevel: "Class 11",
      chapter: CHAPTER_TITLE,
      chapterNumber: 3,
      topic: CANONICAL_PERIODIC_TOPICS.TRENDS.title,
      topicNumber: CANONICAL_PERIODIC_TOPICS.TRENDS.number,
      subTopic,
      secondaryTopics: ["Periodic Trends", "Thermodynamic Periodicity"],
      conceptGroup: "Electron Gain Enthalpy",
      difficulty: "MEDIUM",
      confidence: 97,
      reasoning: "Question examines energy released/absorbed during electron addition, Delta_egH signs, or Cl/F/O anomalies.",
      needsReview: false,
    };
  }

  // 4. Electronegativity & Scales (Pauling / Mulliken) & Bond Polarity
  if (
    /\b(electronegativ|pauling|mulliken|polarity\s*of\s*a\s*bond|most\s*polar\s*bond|least\s*polar\s*bond|difference\s*in\s*electronegativity|\u0394en|2x\s*-\s*ea\s*-\s*ip|mulliken\s*scale)\b/i.test(
      fullText
    ) ||
    /electronegativity/i.test(header)
  ) {
    let subTopic = "Electronegativity Scales (Pauling & Mulliken) & Applications";
    if (/pauling|mulliken|2x|bond\s*energy/i.test(fullText)) {
      subTopic = "Pauling & Mulliken Electronegativity Scales & Formulations";
    } else if (/polar|dipole|c[\s-]i|p[\s-]f/i.test(fullText)) {
      subTopic = "Bond Polarity and Electronegativity Differences";
    }

    return {
      subject: "Chemistry",
      classLevel: "Class 11",
      chapter: CHAPTER_TITLE,
      chapterNumber: 3,
      topic: CANONICAL_PERIODIC_TOPICS.TRENDS.title,
      topicNumber: CANONICAL_PERIODIC_TOPICS.TRENDS.number,
      subTopic,
      secondaryTopics: ["Periodic Trends", "Chemical Bonding Bridge"],
      conceptGroup: "Electronegativity",
      difficulty: "MEDIUM",
      confidence: 97,
      reasoning: "Question focuses on Pauling/Mulliken electronegativity, periodic EN variation, or bond polarity derivation.",
      needsReview: false,
    };
  }

  // 5. Effective Nuclear Charge (Zeff), Shielding Constant & Slater's Rules
  if (
    /\b(zeff|screening\s*constant|screening\s*effect|shielding\s*effect|slater|nuclear\s*charge\s*in\s*hydrogen|inner\s*shell\s*electrons|poor\s*shielding\s*of\s*[df]\s*electrons)\b/i.test(
      fullText
    )
  ) {
    return {
      subject: "Chemistry",
      classLevel: "Class 11",
      chapter: CHAPTER_TITLE,
      chapterNumber: 3,
      topic: CANONICAL_PERIODIC_TOPICS.TRENDS.title,
      topicNumber: CANONICAL_PERIODIC_TOPICS.TRENDS.number,
      subTopic: "Effective Nuclear Charge (Zeff), Shielding Effect & Slater's Rules",
      secondaryTopics: ["Atomic Structure Periodicity", "Shielding Parameters"],
      conceptGroup: "Effective Nuclear Charge and Shielding",
      difficulty: "MEDIUM",
      confidence: 95,
      reasoning: "Question calculates or compares effective nuclear charge (Zeff), shielding/screening constant sigma, or d/f orbital shielding.",
      needsReview: false,
    };
  }

  // 6. Atomic Radii & Contractions (Lanthanoid & Transition Contraction)
  if (
    /\b(atomic\s*radii|atomic\s*radius|covalent\s*radii|metallic\s*radius|vander\s*waal|lanthanoid\s*contraction|lanthanide\s*contraction|transition\s*contraction|zr\s*(?:and|~|\u2248)\s*hf|pd\s*(?:and|~|\u2248)\s*pt|largest\s*radius|smallest\s*radius)\b/i.test(
      fullText
    ) &&
    !/\b(isoelectronic|ion\s*has\s*largest|ionic\s*radii)\b/i.test(fullText)
  ) {
    let subTopic = "Atomic Radius Trends Across Periods and Down Groups";
    if (/lanthanoid\s*contraction|zr.*hf|4d.*5d/i.test(fullText)) {
      subTopic = "Lanthanoid Contraction and Similarity of 4d/5d Consecutives (Zr-Hf)";
    } else if (/transition\s*contraction|ga.*al/i.test(fullText)) {
      subTopic = "Transition Contraction (Ga vs Al Size Anomaly)";
    }

    return {
      subject: "Chemistry",
      classLevel: "Class 11",
      chapter: CHAPTER_TITLE,
      chapterNumber: 3,
      topic: CANONICAL_PERIODIC_TOPICS.TRENDS.title,
      topicNumber: CANONICAL_PERIODIC_TOPICS.TRENDS.number,
      subTopic,
      secondaryTopics: ["Periodic Trends", "d-Block & f-Block Contractions"],
      conceptGroup: "Atomic Radius",
      difficulty: /contraction/i.test(fullText) ? "HARD" : "MEDIUM",
      confidence: 96,
      reasoning: "Question evaluates atomic radius variation, covalent/van der Waals sizes, or lanthanoid/transition contractions.",
      needsReview: false,
    };
  }

  // 7. Ionic Radii & Isoelectronic Species
  if (
    /\b(isoelectronic|ionic\s*radii|ionic\s*radius|size\s*of\s*ions|cation.*anion|ca\s*2\+|na\+|o\s*2\-|n\s*3\-|al\s*3\+|k\+|cl\-|largest\s*ion|decrease.*size\s*of\s*ions)\b/i.test(
      fullText
    )
  ) {
    let subTopic = "Ionic Radii of Isoelectronic Species (Z/e Effect)";
    if (/isoelectronic/i.test(fullText)) {
      subTopic = "Isoelectronic Series Radii Comparison (Effective Nuclear Charge Influence)";
    } else {
      subTopic = "Cationic and Anionic Radii Variation vs Neutral Atoms";
    }

    return {
      subject: "Chemistry",
      classLevel: "Class 11",
      chapter: CHAPTER_TITLE,
      chapterNumber: 3,
      topic: CANONICAL_PERIODIC_TOPICS.TRENDS.title,
      topicNumber: CANONICAL_PERIODIC_TOPICS.TRENDS.number,
      subTopic,
      secondaryTopics: ["Periodic Trends", "Isoelectronic Systems"],
      conceptGroup: "Ionic Radius",
      difficulty: "MEDIUM",
      confidence: 98,
      reasoning: "Question tests ionic radius ordering, cationic/anionic size rules, or isoelectronic species nuclear charge ratio.",
      needsReview: false,
    };
  }

  // 8. IUPAC Nomenclature for Elements with Z > 100 & Superheavy Elements
  if (
    /\b(unnil|unun|unbi|atomic\s*number\s*(?:1[0-2]\d|118|119|112|114|115)|uub|uun|copernicium|flerovium|seaborgium|mendelevium|darmstadtium|lawrencium|transuranic)\b/i.test(
      fullText
    )
  ) {
    return {
      subject: "Chemistry",
      classLevel: "Class 11",
      chapter: CHAPTER_TITLE,
      chapterNumber: 3,
      topic: CANONICAL_PERIODIC_TOPICS.MODERN_LAW.title,
      topicNumber: CANONICAL_PERIODIC_TOPICS.MODERN_LAW.number,
      subTopic: "IUPAC Systematic Nomenclature and Symbols for Elements Z > 100",
      secondaryTopics: ["Superheavy Elements", "Modern Periodic Law"],
      conceptGroup: "Modern Periodic Table Structure",
      difficulty: "EASY",
      confidence: 97,
      reasoning: "Question asks for official IUPAC systematic naming, roots (nil, un, bi, tri, hex, oct, enn), or transuranic element boundaries.",
      needsReview: false,
    };
  }

  // 9. Diagonal Relationship & Anomalous Properties of 2nd Period
  if (
    /\b(diagonal\s*relationship|li\s*(?:and|&)\s*mg|be\s*(?:and|&)\s*al|charge\s*to\s*size\s*ratio|ionic\s*potential|\u03c6\s*=\s*charge\/size)\b/i.test(
      fullText
    )
  ) {
    return {
      subject: "Chemistry",
      classLevel: "Class 11",
      chapter: CHAPTER_TITLE,
      chapterNumber: 3,
      topic: CANONICAL_PERIODIC_TOPICS.TRENDS.title,
      topicNumber: CANONICAL_PERIODIC_TOPICS.TRENDS.number,
      subTopic: "Diagonal Relationships (Li-Mg, Be-Al) and Polarizing Power",
      secondaryTopics: ["Anomalous Properties", "Periodic Trends"],
      conceptGroup: "Diagonal Relationships",
      difficulty: "MEDIUM",
      confidence: 96,
      reasoning: "Question highlights similarity in polarizing power/ionic potential between diagonal elements in 2nd and 3rd periods.",
      needsReview: false,
    };
  }

  // 10. Chemical Properties: Nature of Oxides & Hydrides (Acidic / Basic / Amphoteric / Neutral)
  if (
    /\b(amphoteric\s*(?:oxide|hydroxide)|neutral\s*oxide|basic\s*oxide|acidic\s*oxide|al2o3|beo|zno|sno2|co2|na2o|k2o|cl2o7|acid\s*strength.*(?:hf|hcl|hbr|hi)|bond\s*strength\s*of\s*hf)\b/i.test(
      fullText
    )
  ) {
    return {
      subject: "Chemistry",
      classLevel: "Class 11",
      chapter: CHAPTER_TITLE,
      chapterNumber: 3,
      topic: CANONICAL_PERIODIC_TOPICS.TRENDS.title,
      topicNumber: CANONICAL_PERIODIC_TOPICS.TRENDS.number,
      subTopic: "Periodic Variation in Oxide & Hydroxide Acid-Base Character",
      secondaryTopics: ["Periodic Trends in Chemical Reactivity", "Inorganic Oxides"],
      conceptGroup: "Periodic Trends",
      difficulty: "MEDIUM",
      confidence: 96,
      reasoning: "Question assesses acid-base properties of oxides (acidic, basic, amphoteric, neutral) across periods and down groups.",
      needsReview: false,
    };
  }

  // 11. Electronic Configuration, Blocks (s, p, d, f) and Group/Period Identification
  if (
    /\b(electronic\s*configuration|which\s*group|belongs?\s*to\s*(?:same\s*)?period|belongs?\s*to\s*which\s*group|d[\s-]block|f[\s-]block|p[\s-]block|s[\s-]block|transition\s*elements?|representative\s*elements?|actinides?|lanthanides?|noble\s*gas|4f14|5d|6s|valen(?:ce|cy)\s*shell)\b/i.test(
      fullText
    ) ||
    /period, group and block/i.test(header)
  ) {
    let subTopic = "Determination of Period, Group and Block from Electronic Configuration";
    if (/lanthanide|actinide|4f|5f/i.test(fullText)) {
      subTopic = "Inner-Transition Elements (Lanthanoids & Actinoids Classification)";
    } else if (/transition\s*element|(?:n-1)d/i.test(fullText)) {
      subTopic = "Transition Elements (d-Block) Characteristics & Configurations";
    }

    return {
      subject: "Chemistry",
      classLevel: "Class 11",
      chapter: CHAPTER_TITLE,
      chapterNumber: 3,
      topic: CANONICAL_PERIODIC_TOPICS.CONFIGURATIONS.title,
      topicNumber: CANONICAL_PERIODIC_TOPICS.CONFIGURATIONS.number,
      subTopic,
      secondaryTopics: ["Electronic Structure", "Blocks of Periodic Table"],
      conceptGroup: "Electronic Configuration and Periodic Position",
      difficulty: "MEDIUM",
      confidence: 95,
      reasoning: "Question determines period, group, or s/p/d/f block directly from outer/penultimate electronic configuration.",
      needsReview: false,
    };
  }

  // 12. Modern Periodic Table Structure & Layout
  if (
    /\b(long\s*form\s*of\s*periodic\s*table|number\s*of\s*periods|number\s*of\s*elements\s*in.*period|magic\s*numbers?|moseley|modern\s*periodic\s*law)\b/i.test(
      fullText
    )
  ) {
    return {
      subject: "Chemistry",
      classLevel: "Class 11",
      chapter: CHAPTER_TITLE,
      chapterNumber: 3,
      topic: CANONICAL_PERIODIC_TOPICS.MODERN_LAW.title,
      topicNumber: CANONICAL_PERIODIC_TOPICS.MODERN_LAW.number,
      subTopic: "Structure and Geometry of Modern Long Form Periodic Table",
      secondaryTopics: ["Modern Periodic Law", "Group and Period Architecture"],
      conceptGroup: "Modern Periodic Table Structure",
      difficulty: "EASY",
      confidence: 94,
      reasoning: "Question tests geometry of long form periodic table, periods length (8, 18, 32 elements), or magic numbers.",
      needsReview: false,
    };
  }

  // Fallback: Flag for administrator topic review if ambiguous
  return {
    subject: "Chemistry",
    classLevel: "Class 11",
    chapter: CHAPTER_TITLE,
    chapterNumber: 3,
    topic: "NEEDS_TOPIC_REVIEW",
    topicNumber: "3.5",
    subTopic: "Conceptual Periodicity — Review Required",
    secondaryTopics: ["Periodic Table Review"],
    conceptGroup: "Other / Needs Review",
    difficulty: "MEDIUM",
    confidence: 60,
    reasoning: "Question does not unequivocally match a single periodic trend pattern. Flagged for reviewer inspection.",
    needsReview: true,
  };
}
