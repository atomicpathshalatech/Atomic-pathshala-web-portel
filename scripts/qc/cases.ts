import type { QcQuestionInput } from "../../src/lib/qc/question";

/**
 * Acceptance cases for the QC pipeline: questions with a known, deliberately
 * planted error (and a few correct ones that must NOT be failed). Written by
 * hand; the expected outcome is the ground truth for these cases only.
 */
export type QcCase = {
  name: string;
  /** What must come out. clean → VERIFIED; error → not VERIFIED. */
  expect: "CLEAN" | "ERROR";
  /** For ERROR cases: the answer both reviewers should reach (option letter), when there is one. */
  rightAnswer?: string;
  q: QcQuestionInput;
};

let n = 0;
const base = (over: Partial<QcQuestionInput> & Pick<QcQuestionInput, "subject" | "statement" | "storedAnswer">): QcQuestionInput => ({
  id: `case-${++n}`,
  type: "SINGLE_CORRECT",
  language: "ENGLISH",
  difficulty: "MEDIUM",
  examLevel: "NEET",
  options: [],
  hasImage: false,
  solution: null,
  chapter: null,
  topic: null,
  subTopic: null,
  ...over,
});
const opts = (a: string, b: string, c: string, d: string) => [
  { key: "A", text: a },
  { key: "B", text: b },
  { key: "C", text: c },
  { key: "D", text: d },
];

export const QC_CASES: QcCase[] = [
  {
    name: "1. incorrect answer key (kinetic energy)",
    expect: "ERROR",
    rightAnswer: "C",
    q: base({
      subject: "Physics",
      chapter: "Work, Energy and Power",
      topic: "Kinetic Energy",
      statement: "A body of mass 2 kg moves with a speed of 5 m/s. Its kinetic energy is",
      options: opts("10 J", "15 J", "25 J", "50 J"),
      storedAnswer: ["B"],
      solution: "KE = (1/2)mv^2 = (1/2)(2)(5)^2 = 25 J. Final Answer : Option (B)",
    }),
  },
  {
    name: "2. incorrect formula in solution (KE = mv^2)",
    expect: "ERROR",
    q: base({
      subject: "Physics",
      chapter: "Work, Energy and Power",
      topic: "Kinetic Energy",
      statement: "A body of mass 4 kg moves with a speed of 3 m/s. Its kinetic energy is",
      options: opts("12 J", "18 J", "36 J", "72 J"),
      storedAnswer: ["C"],
      solution: "Kinetic energy KE = m v^2 = 4 × 3^2 = 36 J. Final Answer : Option (C)",
    }),
  },
  {
    name: "3. arithmetic mistake (moles of NaOH)",
    expect: "ERROR",
    rightAnswer: "A",
    q: base({
      subject: "Chemistry",
      chapter: "Some Basic Concepts of Chemistry",
      topic: "Mole Concept",
      statement: "The number of moles of NaOH present in 20 g of NaOH (molar mass 40 g/mol) is",
      options: opts("0.5", "2", "0.2", "5"),
      storedAnswer: ["B"],
      solution: "Moles = mass / molar mass = 20 / 40 = 2 mol. Final Answer : Option (B)",
    }),
  },
  {
    name: "4. correct answer missing from options",
    expect: "ERROR",
    q: base({
      subject: "Physics",
      chapter: "Motion in a Straight Line",
      topic: "Equations of Motion",
      statement: "A car starts from rest and accelerates uniformly at 2 m/s². The distance it covers in 5 s is",
      options: opts("10 m", "20 m", "30 m", "50 m"),
      storedAnswer: ["B"],
      solution: "s = ut + (1/2)at^2 = 0 + (1/2)(2)(5)^2 = 20 m. Final Answer : Option (B)",
    }),
  },
  {
    name: "5. multiple correct options in a single-correct question",
    expect: "ERROR",
    q: base({
      subject: "Chemistry",
      chapter: "Classification of Elements and Periodicity in Properties",
      topic: "Periodic Table",
      statement: "Which of the following is a noble gas?",
      options: opts("Helium", "Neon", "Nitrogen", "Oxygen"),
      storedAnswer: ["A"],
      solution: "Helium belongs to group 18 and is a noble gas. Final Answer : Option (A)",
    }),
  },
  {
    name: "6. duplicate options",
    expect: "ERROR",
    q: base({
      subject: "Biology",
      chapter: "Cell: The Unit of Life",
      topic: "Cell Organelles",
      statement: "Which organelle is called the powerhouse of the cell?",
      options: opts("Mitochondria", "Ribosome", "Mitochondria", "Golgi apparatus"),
      storedAnswer: ["A"],
      solution: "Mitochondria produce ATP by aerobic respiration, hence the powerhouse of the cell. Final Answer : Option (A)",
    }),
  },
  {
    name: "7. answer key differs between Hindi and English",
    expect: "ERROR",
    q: base({
      subject: "Biology",
      chapter: "Biological Classification",
      topic: "Kingdom Monera",
      statement: "Which of the following organisms are prokaryotes?",
      options: opts("Bacteria", "Fungi", "Algae", "Protozoa"),
      storedAnswer: ["A"],
      otherLanguageAnswer: ["B"],
      solution: "Bacteria lack a membrane-bound nucleus and are prokaryotes (Kingdom Monera). Final Answer : Option (A)",
    }),
  },
  {
    name: "8. incorrect topic (genetics question filed under Plant Kingdom)",
    expect: "ERROR",
    q: base({
      subject: "Biology",
      chapter: "Plant Kingdom",
      topic: "Algae",
      statement: "In a monohybrid cross between two heterozygous tall pea plants (Tt × Tt), the phenotypic ratio of tall to dwarf plants in the progeny is",
      options: opts("1 : 1", "3 : 1", "1 : 2 : 1", "9 : 3 : 3 : 1"),
      storedAnswer: ["B"],
      solution: "Tt × Tt gives TT : Tt : tt = 1 : 2 : 1, so tall : dwarf = 3 : 1. Final Answer : Option (B)",
    }),
  },
  {
    name: "9. incorrect unit in the keyed option",
    expect: "ERROR",
    q: base({
      subject: "Physics",
      chapter: "Laws of Motion",
      topic: "Newton's Second Law",
      statement: "A force acts on a body of mass 5 kg and produces an acceleration of 2 m/s². The magnitude of the force is",
      options: opts("10 J", "10 W", "10 kg", "10 Pa"),
      storedAnswer: ["A"],
      solution: "F = ma = 5 × 2 = 10 J. Final Answer : Option (A)",
    }),
  },
  {
    name: "10. incorrect organic product (propene + HBr, no peroxide)",
    expect: "ERROR",
    rightAnswer: "B",
    q: base({
      subject: "Chemistry",
      chapter: "Hydrocarbons",
      topic: "Alkenes",
      statement: "The major product formed when propene reacts with HBr in the absence of peroxide is",
      options: opts("1-Bromopropane", "2-Bromopropane", "1,2-Dibromopropane", "Propane"),
      storedAnswer: ["A"],
      solution: "HBr adds to propene to give 1-bromopropane as the major product. Final Answer : Option (A)",
    }),
  },
  {
    name: "11. ambiguous question (missing condition)",
    expect: "ERROR",
    q: base({
      subject: "Physics",
      chapter: "Motion in a Straight Line",
      topic: "Equations of Motion",
      statement: "A ball is thrown and it reaches the ground after some time. The speed with which it hits the ground is",
      options: opts("10 m/s", "20 m/s", "30 m/s", "40 m/s"),
      storedAnswer: ["B"],
      solution: "Using v = u + gt, v = 20 m/s. Final Answer : Option (B)",
    }),
  },
  {
    name: "12. solution and key disagree (pH)",
    expect: "ERROR",
    rightAnswer: "C",
    q: base({
      subject: "Chemistry",
      chapter: "Equilibrium",
      topic: "pH",
      statement: "The pH of a 0.001 M HCl solution at 25 °C is",
      options: opts("1", "2", "3", "11"),
      storedAnswer: ["B"],
      solution: "HCl is a strong acid, [H+] = 10^-3 M, pH = -log(10^-3) = 3. Final Answer : Option (B)",
    }),
  },
  {
    name: "13. incomplete solution (answer only)",
    expect: "ERROR",
    q: base({
      subject: "Physics",
      chapter: "Current Electricity",
      topic: "Ohm's Law",
      statement: "A potential difference of 12 V is applied across a resistor of 4 Ω. The current through it is",
      options: opts("48 A", "3 A", "0.33 A", "16 A"),
      storedAnswer: ["B"],
      solution: "",
    }),
  },
  {
    name: "14. factual error in the key (site of the Krebs cycle)",
    expect: "ERROR",
    rightAnswer: "B",
    q: base({
      subject: "Biology",
      chapter: "Respiration in Plants",
      topic: "Krebs Cycle",
      statement: "In eukaryotic cells, the Krebs cycle (tricarboxylic acid cycle) takes place in the",
      options: opts("cytoplasm", "mitochondrial matrix", "inner mitochondrial membrane", "nucleus"),
      storedAnswer: ["A"],
      solution: "The Krebs cycle occurs in the cytoplasm of the cell. Final Answer : Option (A)",
    }),
  },
  {
    name: "15. numerical question with a wrong stored value",
    expect: "ERROR",
    q: base({
      subject: "Chemistry",
      type: "NUMERICAL",
      chapter: "Some Basic Concepts of Chemistry",
      topic: "Molarity",
      statement: "4 g of NaOH (molar mass 40 g/mol) is dissolved in water and the solution is made up to 500 mL. The molarity of the solution in mol/L is ____.",
      storedAnswer: ["0.5"],
      solution: "Moles = 4/40 = 0.1 mol. Molarity = 0.1 / 0.5 = 0.5 M.",
    }),
  },
  // ── correct questions: must come out VERIFIED ──
  {
    name: "C1. correct physics numerical",
    expect: "CLEAN",
    q: base({
      subject: "Physics",
      chapter: "Work, Energy and Power",
      topic: "Kinetic Energy",
      statement: "A body of mass 2 kg moves with a speed of 5 m/s. Its kinetic energy is",
      options: opts("10 J", "15 J", "25 J", "50 J"),
      storedAnswer: ["C"],
      solution: "KE = (1/2)mv^2 = (1/2)(2)(5)^2 = 25 J. Final Answer : Option (C)",
    }),
  },
  {
    name: "C2. correct chemistry numerical",
    expect: "CLEAN",
    q: base({
      subject: "Chemistry",
      chapter: "Equilibrium",
      topic: "pH",
      statement: "The pH of a 0.001 M HCl solution at 25 °C is",
      options: opts("1", "2", "3", "11"),
      storedAnswer: ["C"],
      solution: "HCl is a strong acid, so [H+] = 10^-3 M and pH = -log(10^-3) = 3. Final Answer : Option (C)",
    }),
  },
  {
    name: "C3. correct biology fact",
    expect: "CLEAN",
    q: base({
      subject: "Biology",
      chapter: "Respiration in Plants",
      topic: "Krebs Cycle",
      statement: "In eukaryotic cells, the Krebs cycle (tricarboxylic acid cycle) takes place in the",
      options: opts("cytoplasm", "mitochondrial matrix", "inner mitochondrial membrane", "nucleus"),
      storedAnswer: ["B"],
      solution: "The enzymes of the Krebs cycle are located in the mitochondrial matrix. Final Answer : Option (B)",
    }),
  },
  {
    name: "C4. correct organic chemistry",
    expect: "CLEAN",
    q: base({
      subject: "Chemistry",
      chapter: "Hydrocarbons",
      topic: "Alkenes",
      statement: "The major product formed when propene reacts with HBr in the absence of peroxide is",
      options: opts("1-Bromopropane", "2-Bromopropane", "1,2-Dibromopropane", "Propane"),
      storedAnswer: ["B"],
      solution: "By Markovnikov's rule H adds to the carbon with more hydrogens, giving the more stable secondary carbocation; the product is 2-bromopropane. Final Answer : Option (B)",
    }),
  },
  {
    name: "C5. correct genetics, correctly classified",
    expect: "CLEAN",
    q: base({
      subject: "Biology",
      chapter: "Principles of Inheritance and Variation",
      topic: "Monohybrid Cross",
      statement: "In a monohybrid cross between two heterozygous tall pea plants (Tt × Tt), the phenotypic ratio of tall to dwarf plants in the progeny is",
      options: opts("1 : 1", "3 : 1", "1 : 2 : 1", "9 : 3 : 3 : 1"),
      storedAnswer: ["B"],
      solution: "Tt × Tt gives TT : Tt : tt = 1 : 2 : 1, so tall : dwarf = 3 : 1. Final Answer : Option (B)",
    }),
  },
];
