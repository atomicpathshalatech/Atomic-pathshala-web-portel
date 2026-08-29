import { prisma } from "@/lib/db";

export type MasterLectureItem = {
  id: string;
  lectureCode: string;
  title: string;
  durationMinutes: number;
  type: "LIVE_CLASS" | "RECORDED" | "PRACTICE";
  order: number;
};

export type MasterChapter = {
  id: string;
  chapterCode: string;
  title: string;
  subject: string;
  courseTitle: string;
  targetExam: string;
  facultyName: string;
  facultyId?: string;
  lectures: MasterLectureItem[];
  dppCount: number;
  testCount: number;
  pdfNotesCount: number;
  totalDurationMinutes: number;
};

// Seed/Master academic library of chapters with stable Chapter IDs
export const MASTER_CHAPTER_LIBRARY: MasterChapter[] = [
  {
    id: "ch_bio_001",
    chapterCode: "CH-BIO-001",
    title: "Cell: The Unit of Life & Cell Cycle",
    subject: "Biology",
    courseTitle: "NEET 2-Year Comprehensive Biology",
    targetExam: "NEET UG",
    facultyName: "Yaman Khan Sir",
    dppCount: 5,
    testCount: 2,
    pdfNotesCount: 3,
    totalDurationMinutes: 300,
    lectures: [
      { id: "lec_bio_01", lectureCode: "LEC-BIO-01", title: "Introduction to Cell Theory & Prokaryotic Cells", durationMinutes: 60, type: "LIVE_CLASS", order: 1 },
      { id: "lec_bio_02", lectureCode: "LEC-BIO-02", title: "Eukaryotic Cell Structure & Membrane Dynamics", durationMinutes: 60, type: "LIVE_CLASS", order: 2 },
      { id: "lec_bio_03", lectureCode: "LEC-BIO-03", title: "Endomembrane System & Mitochondria / Plastids", durationMinutes: 60, type: "LIVE_CLASS", order: 3 },
      { id: "lec_bio_04", lectureCode: "LEC-BIO-04", title: "Nucleus, Chromatin & Cytoskeletal Elements", durationMinutes: 60, type: "LIVE_CLASS", order: 4 },
      { id: "lec_bio_05", lectureCode: "LEC-BIO-05", title: "Mitosis vs Meiosis & High-Yield PYQ Analysis", durationMinutes: 60, type: "LIVE_CLASS", order: 5 },
    ],
  },
  {
    id: "ch_che_001",
    chapterCode: "CH-CHE-001",
    title: "Chemical Kinetics & Reaction Rates",
    subject: "Chemistry",
    courseTitle: "NEET & JEE Physical Chemistry Masterclass",
    targetExam: "NEET & JEE",
    facultyName: "Firoz Ali (Firoz Sir)",
    dppCount: 4,
    testCount: 2,
    pdfNotesCount: 2,
    totalDurationMinutes: 240,
    lectures: [
      { id: "lec_che_01", lectureCode: "LEC-CHE-01", title: "Rate of Reaction, Rate Laws & Order of Reaction", durationMinutes: 60, type: "LIVE_CLASS", order: 1 },
      { id: "lec_che_02", lectureCode: "LEC-CHE-02", title: "Zero Order & First Order Kinetics Derivations", durationMinutes: 60, type: "LIVE_CLASS", order: 2 },
      { id: "lec_che_03", lectureCode: "LEC-CHE-03", title: "Arrhenius Equation, Activation Energy & Catalyst Effect", durationMinutes: 60, type: "LIVE_CLASS", order: 3 },
      { id: "lec_che_04", lectureCode: "LEC-CHE-04", title: "Collision Theory, Half-Life & Advanced Numericals", durationMinutes: 60, type: "LIVE_CLASS", order: 4 },
    ],
  },
  {
    id: "ch_phy_001",
    chapterCode: "CH-PHY-001",
    title: "Laws of Motion & Friction Dynamics",
    subject: "Physics",
    courseTitle: "NEET Physics Mechanics Master Series",
    targetExam: "NEET UG",
    facultyName: "Sanu Yadav Sir",
    dppCount: 4,
    testCount: 2,
    pdfNotesCount: 2,
    totalDurationMinutes: 240,
    lectures: [
      { id: "lec_phy_01", lectureCode: "LEC-PHY-01", title: "Newton's First & Second Laws with Free Body Diagrams (FBD)", durationMinutes: 60, type: "LIVE_CLASS", order: 1 },
      { id: "lec_phy_02", lectureCode: "LEC-PHY-02", title: "Newton's Third Law, Tension in Strings & Pulley Blocks", durationMinutes: 60, type: "LIVE_CLASS", order: 2 },
      { id: "lec_phy_03", lectureCode: "LEC-PHY-03", title: "Static & Kinetic Friction on Inclined Planes", durationMinutes: 60, type: "LIVE_CLASS", order: 3 },
      { id: "lec_phy_04", lectureCode: "LEC-PHY-04", title: "Circular Motion Dynamics, Banking of Roads & PYQs", durationMinutes: 60, type: "LIVE_CLASS", order: 4 },
    ],
  },
  {
    id: "ch_che_002",
    chapterCode: "CH-CHE-002",
    title: "Thermodynamics & Thermochemistry",
    subject: "Chemistry",
    courseTitle: "NEET & JEE Physical Chemistry Masterclass",
    targetExam: "NEET & JEE",
    facultyName: "Firoz Ali (Firoz Sir)",
    dppCount: 5,
    testCount: 2,
    pdfNotesCount: 3,
    totalDurationMinutes: 300,
    lectures: [
      { id: "lec_che_05", lectureCode: "LEC-CHE-05", title: "First Law of Thermodynamics, Internal Energy & Enthalpy", durationMinutes: 60, type: "LIVE_CLASS", order: 1 },
      { id: "lec_che_06", lectureCode: "LEC-CHE-06", title: "Isothermal vs Adiabatic Work & Heat Capacities (Cp - Cv)", durationMinutes: 60, type: "LIVE_CLASS", order: 2 },
      { id: "lec_che_07", lectureCode: "LEC-CHE-07", title: "Hess's Law, Bond Enthalpy & Enthalpy of Formation", durationMinutes: 60, type: "LIVE_CLASS", order: 3 },
      { id: "lec_che_08", lectureCode: "LEC-CHE-08", title: "Second Law, Entropy & Gibbs Free Energy ($\Delta G$)", durationMinutes: 60, type: "LIVE_CLASS", order: 4 },
      { id: "lec_che_09", lectureCode: "LEC-CHE-09", title: "Spontaneity Criteria & High-Yield NEET Numericals", durationMinutes: 60, type: "LIVE_CLASS", order: 5 },
    ],
  },
  {
    id: "ch_bio_002",
    chapterCode: "CH-BIO-002",
    title: "Human Physiology: Chemical Coordination & Integration",
    subject: "Biology",
    courseTitle: "NEET 2-Year Comprehensive Biology",
    targetExam: "NEET UG",
    facultyName: "Yaman Khan Sir",
    dppCount: 3,
    testCount: 1,
    pdfNotesCount: 2,
    totalDurationMinutes: 180,
    lectures: [
      { id: "lec_bio_06", lectureCode: "LEC-BIO-06", title: "Endocrine Glands, Hypothalamus & Pituitary Hormones", durationMinutes: 60, type: "LIVE_CLASS", order: 1 },
      { id: "lec_bio_07", lectureCode: "LEC-BIO-07", title: "Thyroid, Parathyroid, Adrenal & Pancreatic Hormones", durationMinutes: 60, type: "LIVE_CLASS", order: 2 },
      { id: "lec_bio_08", lectureCode: "LEC-BIO-08", title: "Mechanism of Hormone Action & Endocrine Disorders", durationMinutes: 60, type: "LIVE_CLASS", order: 3 },
    ],
  },
];

/**
 * Search master chapters by code, title, subject, or query
 */
export async function searchMasterChapters(query: string = ""): Promise<MasterChapter[]> {
  const q = query.toLowerCase().trim();

  // Combine database chapters if any with seed master chapters
  const dbChapters = await prisma.chapter.findMany({
    include: {
      subject: { include: { course: true } },
      lectures: true,
    },
    take: 20,
  });

  const formattedDbChapters: MasterChapter[] = dbChapters.map((ch, idx) => ({
    id: ch.id,
    chapterCode: `CH-${ch.subject.title.slice(0, 3).toUpperCase()}-${String(idx + 10).padStart(3, "0")}`,
    title: ch.title,
    subject: ch.subject.title,
    courseTitle: ch.subject.course?.title || "Academic Program",
    targetExam: "NEET / JEE",
    facultyName: "Atomic Pathshala Faculty",
    // Question no longer relates directly to Chapter (Test Portal schema
    // stores it as a plain string), so this heuristic can't count real
    // questions per chapter anymore — a flat placeholder instead.
    dppCount: 3,
    testCount: 1,
    pdfNotesCount: 2,
    totalDurationMinutes: ch.lectures.length > 0 ? ch.lectures.length * 60 : 180,
    lectures:
      ch.lectures.length > 0
        ? ch.lectures.map((l, lIdx) => ({
            id: l.id,
            lectureCode: `LEC-${String(lIdx + 1).padStart(2, "0")}`,
            title: l.title,
            durationMinutes: 60,
            type: "LIVE_CLASS",
            order: l.order || lIdx + 1,
          }))
        : [
            { id: `${ch.id}_1`, lectureCode: "LEC-01", title: `${ch.title} — Part 1`, durationMinutes: 60, type: "LIVE_CLASS", order: 1 },
            { id: `${ch.id}_2`, lectureCode: "LEC-02", title: `${ch.title} — Part 2`, durationMinutes: 60, type: "LIVE_CLASS", order: 2 },
            { id: `${ch.id}_3`, lectureCode: "LEC-03", title: `${ch.title} — Part 3 & Problem Solving`, durationMinutes: 60, type: "LIVE_CLASS", order: 3 },
          ],
  }));

  const all = [...MASTER_CHAPTER_LIBRARY, ...formattedDbChapters];

  if (!q) return all;

  return all.filter(
    (c) =>
      c.chapterCode.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q) ||
      c.subject.toLowerCase().includes(q) ||
      c.facultyName.toLowerCase().includes(q)
  );
}

/**
 * Fetch a single Master Chapter by its unique Chapter ID or code
 */
export async function getMasterChapterById(idOrCode: string): Promise<MasterChapter | null> {
  const all = await searchMasterChapters();
  const normalized = idOrCode.toLowerCase().trim();
  return (
    all.find((c) => c.id.toLowerCase() === normalized || c.chapterCode.toLowerCase() === normalized) || null
  );
}
