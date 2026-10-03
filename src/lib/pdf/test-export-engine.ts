import "server-only";
import { prisma } from "@/lib/db";
import katex from "katex";
import { renderFormulaContent } from "@/lib/test-portal/formula";
import { exportCamDrawToSvgString, parseCamDrawDocument } from "@/lib/camdraw/renderer";
import { DPP_COVER_CSS } from "@/lib/dpp/cover-html";

export interface TestExportOptions {
  withSolution: boolean;
  watermarkText?: string;
  brandName?: string;
  logoUrl?: string | null;
  targetCourse?: string;
  testPattern?: string;
  /** Open the browser's print dialog ("Save as PDF") as soon as the pages are laid out. */
  autoPrint?: boolean;
  /** DPP only: the front page (renderDppCoverHtml), printed before the questions / solutions. */
  dppCoverHtml?: string | null;
}

export interface FormattedQuestionOption {
  key: string; // "1", "2", "3", "4" or "A", "B", "C", "D"
  label: string;
  textEn: string;
  textHi: string;
  isCorrect: boolean;
}

export interface FormattedExportQuestion {
  number: number;
  id: string;
  subject: string;
  sectionName: string;
  statementEn: string;
  statementHi: string;
  options: FormattedQuestionOption[];
  correctOptionKey: string;
  correctOptionLabel: string;
  solutionEn: string;
  solutionHi: string;
  imageUrl?: string | null;
  camDrawSvg?: string | null;
}

export interface FormattedExportSection {
  id: string;
  name: string;
  subject: string;
  order: number;
  targetCount: number;
  marksPerQuestion: number;
  negativeMarks: number;
  syllabus: string;
  questions: FormattedExportQuestion[];
}

export interface FormattedExportTest {
  id: string;
  name: string;
  code: string;
  examType: string;
  durationMin: number;
  totalMarks: number;
  totalQuestions: number;
  correctMarks: number;
  incorrectMarks: number;
  description: string;
  instructions: string;
  createdAt: Date;
  seriesName?: string | null;
  batchName?: string | null;
  sections: FormattedExportSection[];
  allQuestions: FormattedExportQuestion[];
}

function normalizeOptions(
  enOptionsRaw: any,
  hiOptionsRaw: any,
  correctOptionIdsRaw: any
): { options: FormattedQuestionOption[]; correctKey: string; correctLabel: string } {
  const keys = ["A", "B", "C", "D"];
  const numLabels = ["(1)", "(2)", "(3)", "(4)"];
  const options: FormattedQuestionOption[] = [];

  let correctKeys: string[] = [];
  if (Array.isArray(correctOptionIdsRaw)) {
    correctKeys = correctOptionIdsRaw.map((k) => String(k).trim().toUpperCase());
  } else if (typeof correctOptionIdsRaw === "string") {
    try {
      const parsed = JSON.parse(correctOptionIdsRaw);
      if (Array.isArray(parsed)) correctKeys = parsed.map((k) => String(k).trim().toUpperCase());
      else correctKeys = [String(correctOptionIdsRaw).trim().toUpperCase()];
    } catch {
      correctKeys = [correctOptionIdsRaw.trim().toUpperCase()];
    }
  }

  // Parse EN Options
  let enMap: Record<string, string> = {};
  if (enOptionsRaw && typeof enOptionsRaw === "object") {
    if (Array.isArray(enOptionsRaw)) {
      enOptionsRaw.forEach((opt, idx) => {
        const k = keys[idx] || String(idx + 1);
        enMap[k] = typeof opt === "string" ? opt : opt?.text || opt?.statement || "";
      });
    } else {
      enMap = { ...enOptionsRaw };
    }
  }

  // Parse HI Options
  let hiMap: Record<string, string> = {};
  if (hiOptionsRaw && typeof hiOptionsRaw === "object") {
    if (Array.isArray(hiOptionsRaw)) {
      hiOptionsRaw.forEach((opt, idx) => {
        const k = keys[idx] || String(idx + 1);
        hiMap[k] = typeof opt === "string" ? opt : opt?.text || opt?.statement || "";
      });
    } else {
      hiMap = { ...hiOptionsRaw };
    }
  }

  const allKeys = Array.from(
    new Set([...Object.keys(enMap), ...Object.keys(hiMap), "A", "B", "C", "D"])
  ).slice(0, 4);

  let primaryCorrectKey = "1";
  let primaryCorrectLabel = "(1)";

  allKeys.forEach((key, idx) => {
    const numKey = String(idx + 1);
    const numLabel = numLabels[idx] || `(${idx + 1})`;
    const textEn = enMap[key] || enMap[numKey] || "";
    const textHi = hiMap[key] || hiMap[numKey] || textEn || "";
    const isCorrect =
      correctKeys.includes(key.toUpperCase()) ||
      correctKeys.includes(numKey) ||
      correctKeys.includes(numLabel);

    if (isCorrect) {
      primaryCorrectKey = numKey;
      primaryCorrectLabel = numLabel;
    }

    options.push({
      key: numKey,
      label: numLabel,
      textEn,
      textHi,
      isCorrect,
    });
  });

  return {
    options,
    correctKey: primaryCorrectKey,
    correctLabel: primaryCorrectLabel,
  };
}

export async function fetchCanonicalTestData(testId: string): Promise<FormattedExportTest | null> {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      template: true,
      batchSchedule: { include: { batch: true } },
      testSeries: true,
      sections: {
        orderBy: { order: "asc" },
        include: {
          questions: {
            orderBy: { order: "asc" },
            include: {
              question: {
                include: {
                  translations: true,
                  assets: { orderBy: { order: "asc" } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!test) return null;

  let globalQuestionNumber = 0;
  const allQuestions: FormattedExportQuestion[] = [];

  const formattedSections: FormattedExportSection[] = test.sections.map((section) => {
    const isBio =
      section.name?.toLowerCase().includes("bio") ||
      section.subject?.toLowerCase().includes("bio") ||
      section.name?.toLowerCase().includes("botany") ||
      section.name?.toLowerCase().includes("zoology");
    const target = section.targetCount && section.targetCount > 0 ? section.targetCount : isBio ? 90 : 45;
    const questionsToExport = section.questions.slice(0, target);
    const questions: FormattedExportQuestion[] = questionsToExport.map((sq) => {
      globalQuestionNumber++;
      const q = sq.question;
      const enTrans = q.translations.find((t) => t.language === "ENGLISH" || t.language === "en") || q.translations[0];
      const hiTrans = q.translations.find((t) => t.language === "HINDI" || t.language === "hi") || enTrans;

      const { options, correctKey, correctLabel } = normalizeOptions(
        enTrans?.options,
        hiTrans?.options,
        enTrans?.correctOptionIds || hiTrans?.correctOptionIds
      );

      // STRICT RULE: Only use genuine question diagram/figure image, NEVER reference/OCR screenshot
      const diagramAsset = q.assets?.find((a) => a.type === "DIAGRAM" || a.type === "FIGURE");
      const genuineCandidateUrl = diagramAsset?.publicUrl || q.imageUrl;
      const isReferenceImage =
        Boolean(genuineCandidateUrl) &&
        (genuineCandidateUrl === (q as any).referenceImageUrl ||
          q.assets?.some((a) => a.type === "REFERENCE" && a.publicUrl === genuineCandidateUrl));
      const validDiagramUrl = isReferenceImage ? null : genuineCandidateUrl;

      // Render vector SVG for CamDraw data
      let camDrawSvg: string | null = null;
      const parsedCamDraw = parseCamDrawDocument((q as any).camDrawData);
      if (parsedCamDraw && parsedCamDraw.elements?.length > 0) {
        try {
          camDrawSvg = exportCamDrawToSvgString(parsedCamDraw, "print");
        } catch {
          camDrawSvg = null;
        }
      }

      const formattedQ: FormattedExportQuestion = {
        number: globalQuestionNumber,
        id: q.id,
        subject: section.subject || q.subject || "General",
        sectionName: section.name,
        statementEn: enTrans?.statement || "",
        statementHi: hiTrans?.statement || enTrans?.statement || "",
        options,
        correctOptionKey: correctKey,
        correctOptionLabel: correctLabel,
        solutionEn: enTrans?.solution || q.solution || "",
        solutionHi: hiTrans?.solution || enTrans?.solution || q.solution || "",
        imageUrl: validDiagramUrl || null,
        camDrawSvg,
      };

      allQuestions.push(formattedQ);
      return formattedQ;
    });

    // Extract dynamic syllabus per section from its questions grouped by Chapter
    const chapterMap = new Map<string, Set<string>>();
    questionsToExport.forEach((sq) => {
      const chName = (sq.question.chapter || "").trim();
      if (!chName) return;
      if (!chapterMap.has(chName)) chapterMap.set(chName, new Set());
      const topName = (sq.question.topic || sq.question.subTopic || "").trim();
      if (topName && topName.toLowerCase() !== chName.toLowerCase()) {
        chapterMap.get(chName)!.add(topName);
      }
    });

    let secSyllabus = "";
    if (chapterMap.size > 0) {
      const chapterStrings: string[] = [];
      chapterMap.forEach((topicsSet, chName) => {
        const topicsArr = Array.from(topicsSet);
        if (topicsArr.length > 0) {
          chapterStrings.push(`${chName} (Topic: ${topicsArr.join(", ")})`);
        } else {
          chapterStrings.push(`${chName} (Complete Chapter)`);
        }
      });
      secSyllabus = chapterStrings.join(" | ");
    } else {
      const subjLower = (section.subject || section.name || "").toLowerCase();
      if (subjLower.includes("phys")) {
        secSyllabus = "Ray optics and optical Instruments, Wave optics, Modern Physics, Semiconductor and Digital Electronics";
      } else if (subjLower.includes("chem")) {
        secSyllabus = "Halogen derivatives, Oxygen containing organic compounds, Nitrogen containing organic compounds, Biomolecules, polymers and chemistry in everyday life";
      } else if (subjLower.includes("bot")) {
        secSyllabus = "Organisms and Populations, Ecosystem, Biodiversity and Conservation, Environmental Issues, Demography";
      } else if (subjLower.includes("zoo")) {
        secSyllabus = "Biology In Human Welfare : Human Health and Disease, Strategies For Enhancement In Food Production (Animal Breeding)";
      } else if (subjLower.includes("bio")) {
        secSyllabus = "Plant Physiology, Human Physiology, Genetics and Evolution, Ecology and Environment, Cell Structure & Function";
      } else {
        secSyllabus = `${section.name} (Complete Chapter)`;
      }
    }

    return {
      id: section.id,
      name: section.name,
      subject: section.subject,
      order: section.order,
      targetCount: section.targetCount || questions.length,
      marksPerQuestion: section.marksPerQuestion ?? test.correctMarks ?? 4,
      negativeMarks: section.negativeMarks ?? Math.abs(test.incorrectMarks ?? 1),
      syllabus: secSyllabus,
      questions,
    };
  });

  const totalQuestions = allQuestions.length;
  const totalMarks = formattedSections.reduce(
    (sum, s) => sum + s.questions.reduce((qSum) => qSum + s.marksPerQuestion, 0),
    0
  ) || (totalQuestions * 4);

  return {
    id: test.id,
    name: test.name,
    code: test.code || `AP-TEST-${test.id.slice(-6).toUpperCase()}`,
    examType: test.examType || "NEET(UG)",
    durationMin: test.durationMin || 180,
    totalMarks,
    totalQuestions,
    correctMarks: test.correctMarks || 4,
    incorrectMarks: test.incorrectMarks || -1,
    description: test.description || "",
    instructions: test.instructions || "",
    createdAt: test.createdAt,
    seriesName: test.testSeries?.name || null,
    batchName: test.batchSchedule?.batch?.name || null,
    sections: formattedSections,
    allQuestions,
  };
}

/**
 * Generates the complete, high-fidelity printable HTML document for the test paper.
 */
export function generateTestPaperHtml(
  test: FormattedExportTest,
  options: TestExportOptions
): string {
  const { withSolution, brandName = "ATOMIC PATHSHALA", autoPrint = false } = options;
  // A DPP is practice, not an exam: its sheet has no exam cover, OMR rules,
  // rough-work pages or back cover — just a title strip and the questions.
  const isDpp = String(options.testPattern || test.examType || "").toUpperCase() === "DPP";
  const footerCode = isDpp ? "DPP" : test.code || "9610WMD801490250051";
  // Footer, left: a DPP carries the brand in colour; a test its code.
  const footerLeftHtml = isDpp
    ? `<span class="footer-brand">ATOMIC <span>PATHSHALA</span></span>`
    : `<span class="footer-barcode">${footerCode}</span>`;
  // The batch box is printed only for a real batch (it used to say "PHASE - ALL").
  const phaseBoxHtml = !isDpp && test.batchName ? `<div class="footer-phase-box">${test.batchName}</div>` : "";
  // Header brand: in colour on a DPP.
  const brandHeaderHtml = isDpp ? `ATOMIC <span class="brand-accent">PATHSHALA</span>` : brandName;

  const SITE_HOST = "ap.atomicpathshala.in";
  const SITE_URL = `https://${SITE_HOST}`;
  /** Clickable in the saved PDF (Chrome keeps link annotations). */
  const SITE_LINK_HTML = `<a class="footer-site site-link" href="${SITE_URL}">${SITE_HOST}</a>`;


  const durationHours = Math.floor(test.durationMin / 60);
  const durationRemainder = test.durationMin % 60;
  const durationText = durationHours > 0 
    ? `${durationHours} Hour${durationHours > 1 ? "s" : ""}${durationRemainder > 0 ? ` ${durationRemainder} Mins` : ""}`
    : `${test.durationMin} Minutes`;

  const currentDateStr = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(test.createdAt || new Date());

  // Deterministic series & form code
  const bookletSeries = test.code ? (test.code.length > 8 ? test.code.slice(0, 8) : test.code) : "AP-26";
  const formNumber = Math.abs(test.id.split("").reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) | 0, 100000) % 900000 + 100000);
  const logoUrl = options.logoUrl || "https://lh3.googleusercontent.com/aida-public/AB6AXuDa8QagvEZSN1R6zCaBlM0eWp9DB1GRPhy4yheOUBaJvnKUg9tMNGAPUuG0HJZKPpgI-USkw0DIBEQcokjGHeiAazuM1lTDHYx1Za_F-501AexZPNtMJ-k1sXmJbvL-j0OdFpqHkq17Qp8MtB66bJxDHC9OfMpKJmv1fidamNpe6ORcKNoAW_O3skqdq_xFhix8XysEcocM3LposHxd4osXTqDpiAPr7LRYDNExF8B7CGj0qWoIf_1m-xX6ZiUp8rVVWw";

  // Section syllabus & breakdown calculations
  let currentStart = 1;
  const sectionBreakdowns = test.sections.map((section, idx) => {
    const startQ = currentStart;
    const endQ = currentStart + section.questions.length - 1;
    currentStart = endQ + 1;
    const sectionMarks = section.questions.length * section.marksPerQuestion;
    
    const subjLower = section.subject.toLowerCase();
    let defaultSyllabus = "Mechanics, Electrodynamics, Optics, Thermodynamics, Modern Physics & Wave Motion.";
    if (subjLower.includes("chem")) {
      defaultSyllabus = "Physical Chemistry, Inorganic Chemistry, Organic Chemistry & Applied Principles.";
    } else if (subjLower.includes("bio") || subjLower.includes("bot") || subjLower.includes("zoo")) {
      defaultSyllabus = "Botany (Plant Physiology, Genetics, Ecology) & Zoology (Human Physiology, Reproduction, Evolution).";
    } else if (subjLower.includes("math")) {
      defaultSyllabus = "Calculus, Coordinate Geometry, Algebra, Vectors & 3D, Trigonometry.";
    } else {
      defaultSyllabus = `${section.name} Curriculum & Comprehensive Standard Syllabus.`;
    }

    const pad = (n: number) => n < 10 ? `0${n}` : `${n}`;

    return {
      name: section.subject.toUpperCase(),
      rangeText: `Q ${pad(startQ)}–${pad(endQ)} • ${sectionMarks} M`,
      startQ,
      endQ,
      syllabus: section.syllabus || defaultSyllabus,
      isEven: idx % 2 === 0,
    };
  });

  const sectionBreakdownColsHtml = sectionBreakdowns.map((sb) => `
    <div class="p-2 ${sb.isEven ? "bg-slate-50/50" : ""} flex flex-col">
      <div class="flex items-center justify-between border-b border-slate-200 pb-1 mb-1">
        <span class="font-heading font-extrabold text-slate-950 text-[10.5px] uppercase tracking-wide">${sb.name}</span>
        <span class="font-mono-code text-[8.5px] font-bold text-[#0284c7] bg-sky-50 border border-sky-300 px-1 rounded-xs">${sb.rangeText}</span>
      </div>
      <p class="text-slate-600 text-[9.5px] leading-tight font-medium">
        <strong class="text-slate-800 font-semibold">Syllabus:</strong> ${sb.syllabus}
      </p>
    </div>
  `).join("");

  const enSectionRange = sectionBreakdowns.map((sb) => `${sb.name}: ${sb.startQ}-${sb.endQ}`).join(", ") || `Physics: 1-45, Chemistry: 46-90, Biology: 91-180`;
  const hiSectionRange = sectionBreakdowns.map((sb) => `${sb.name}: ${sb.startQ} से ${sb.endQ}`).join(", ") || `भौतिक विज्ञान: 1 से 45, रसायन विज्ञान: 46 से 90, जीव विज्ञान: 91 से 180`;

  // Instruction on the paper's pattern, from its real sections, e.g.
  // "…तीन खण्ड हैं: Physics, Chemistry, Biology। Physics और Chemistry खण्ड में
  // 45 प्रश्न हैं, सभी 45 प्रश्न अनिवार्य हैं तथा Biology में 90 प्रश्न हैं…"
  const HI_COUNT_WORDS = ["", "एक", "दो", "तीन", "चार", "पाँच", "छह"];
  const EN_COUNT_WORDS = ["", "one", "two", "three", "four", "five", "six"];
  const patternSections = test.sections.filter((s) => s.questions.length > 0);
  const countGroups: { names: string[]; count: number }[] = [];
  patternSections.forEach((s) => {
    const group = countGroups.find((g) => g.count === s.questions.length);
    if (group) group.names.push(s.subject || s.name);
    else countGroups.push({ names: [s.subject || s.name], count: s.questions.length });
  });
  const joinNames = (names: string[], and: string) =>
    names.length > 1 ? `${names.slice(0, -1).join(", ")} ${and} ${names[names.length - 1]}` : names[0] ?? "";
  const nSections = patternSections.length;
  const sectionPatternHi =
    `इस प्रश्न पत्र में ${HI_COUNT_WORDS[nSections] ?? nSections} खण्ड हैं: <strong>${patternSections.map((s) => s.subject || s.name).join(", ")}</strong>। ` +
    countGroups
      .map((g) => `${joinNames(g.names, "और")}${g.names.length > 1 ? " खण्ड" : ""} में <strong>${g.count} प्रश्न</strong> हैं, सभी ${g.count} प्रश्न अनिवार्य हैं`)
      .join(" तथा ") +
    "।";
  const sectionPatternEn =
    `This Test Paper has ${EN_COUNT_WORDS[nSections] ?? nSections} section${nSections === 1 ? "" : "s"}: <strong>${patternSections.map((s) => s.subject || s.name).join(", ")}</strong>. ` +
    countGroups
      .map((g) => `${joinNames(g.names, "and")} ${g.names.length > 1 ? "each have" : "has"} <strong>${g.count} questions</strong>, all ${g.count} compulsory`)
      .join("; ") +
    ".";

  // Helper to compute question vertical height weight accurately
  function computeQuestionWeight(q: FormattedExportQuestion): number {
    let weight = 1.0; // Base question statement + 2x2 short options

    const textEn = q.statementEn || "";
    const textHi = q.statementHi || "";
    const combinedText = textEn + " " + textHi;

    // 1. Diagrams / CamDraw / Inline Images
    if (q.imageUrl) {
      weight += 1.0;
    }
    if (q.camDrawSvg) {
      weight += 0.9;
    }
    const inlineImgCount = (combinedText.match(/!\[.*?\]\(.*?\)/g) || []).length;
    if (inlineImgCount > 0) {
      weight += Math.min(inlineImgCount * 0.7, 1.6);
    }

    // 2. HTML Tables / Markdown Tables
    const hasHtmlTable = /<table/i.test(combinedText);
    const hasMarkdownTable = /\|.*?\|.*?\|/g.test(combinedText);
    if (hasHtmlTable || hasMarkdownTable) {
      const htmlRows = (combinedText.match(/<tr/gi) || []).length;
      const mdRows = (combinedText.match(/\n\s*\|/g) || []).length;
      const maxRows = Math.max(htmlRows, mdRows, 2);
      weight += 0.4 + Math.min(maxRows * 0.18, 1.0);
    }

    // 3. Match List / Column Format
    const isMatchList = /(List\s*[-–—I1]|Column\s*[-–—I1]|कॉलम\s*[-–—I1]|सूची\s*[-–—I1])/i.test(combinedText);
    if (isMatchList && !hasHtmlTable && !hasMarkdownTable) {
      weight += 0.35;
    }

    // 4. Statement Length & Line Breaks
    const maxLen = Math.max(textEn.length, textHi.length);
    if (maxLen > 450) weight += 0.5;
    else if (maxLen > 250) weight += 0.25;

    const lineBreaks = Math.max(
      (textEn.match(/\n|<br\s*\/?>/gi) || []).length,
      (textHi.match(/\n|<br\s*\/?>/gi) || []).length
    );
    if (lineBreaks > 4) weight += Math.min(lineBreaks * 0.1, 0.4);

    // 5. Options height: Stacked vs 2x2 Grid
    const isShortOptions = q.options.every((opt) => {
      const lEn = (opt.textEn || "").length;
      const lHi = (opt.textHi || opt.textEn || "").length;
      return lEn <= 24 && lHi <= 24;
    });

    if (!isShortOptions || q.options.length > 4) {
      weight += 0.35;
      const hasLongOpt = q.options.some((opt) => (opt.textEn || "").length > 60 || (opt.textHi || "").length > 60);
      if (hasLongOpt) weight += 0.3;
    }

    return weight;
  }

  // Helper to chunk questions into authentic exam pages (filling pages sequentially without large empty space)
  function chunkQuestionsIntoPages(questions: FormattedExportQuestion[]): FormattedExportQuestion[][] {
    const chunks: FormattedExportQuestion[][] = [];
    let currentChunk: FormattedExportQuestion[] = [];
    let currentWeight = 0;

    for (const q of questions) {
      const weight = computeQuestionWeight(q);
      const isFirstPage = chunks.length === 0;
      const maxPageCapacity = isFirstPage ? 6.0 : 7.4;

      if (currentChunk.length > 0 && currentWeight + weight > maxPageCapacity) {
        chunks.push(currentChunk);
        currentChunk = [q];
        currentWeight = weight;
      } else {
        currentChunk.push(q);
        currentWeight += weight;
      }
    }
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    return chunks;
  }

  let totalQuestionPagesCount = 0;
  test.sections.forEach((sec) => {
    totalQuestionPagesCount += chunkQuestionsIntoPages(sec.questions).length;
  });

  const intermediateRoughCount = 0;
  const subjectRoughCount = test.sections.length;
  const finalRoughCount = 1;
  const backCoverCount = 1;
  const solutionsPagesCount = withSolution ? 1 + Math.ceil(test.totalQuestions / 6) : 0;
  const actualTotalPages = 1 + totalQuestionPagesCount + subjectRoughCount + finalRoughCount + backCoverCount + solutionsPagesCount;

  // Render Front Cover (Exact User-Specified Authentic Layout Matching Requirements)
  const frontCoverHtml = `
    <div class="a4-sheet border-2 border-slate-900 rounded-xs cover-page">
      <div class="cover-border">
        <!-- TOP HEADER ROW -->
        <div class="cover-top-header">
          <div class="cover-top-left">
            <img src="${logoUrl}" alt="Atomic Pathshala Logo" class="h-14 w-14 object-contain mx-auto" />
          </div>
          <div class="cover-top-center">
            <div class="brand-logo-text">${brandName}</div>
            <div class="brand-sub-program">LEARN • EXPLORE • EXCEL</div>
            <div class="academic-session font-bold">(Academic Session : 2026 - 2027)</div>
          </div>
          <div class="cover-top-right">
            <div class="test-pattern-badge">Test Pattern : <strong>${test.examType || "NEET(UG)"}</strong></div>
            <div class="test-pattern-name">${test.name.toUpperCase()}</div>
            <div class="test-pattern-date">${currentDateStr}</div>
          </div>
        </div>

        <!-- FULL-WIDTH BATCH HEADER STRIP (White Background, Black Text) -->
        <div class="target-banner bg-white border-2 border-black text-black">
          ${test.batchName || test.seriesName || "Selection Pro Batch Neet"}
        </div>

        <!-- Dropper / 12th Pass Students (White Background) -->
        <div class="candidate-level-pill bg-white border border-black text-black font-bold">
          Dropper / 12th Pass Students
        </div>

        <!-- Test Type Box (White Background) -->
        <div class="test-name-box bg-white border-2 border-black">
          <span class="test-type-label">Test Type : </span>
          <span class="test-type-value font-bold">${test.name}</span>
        </div>

        <!-- BOOKLET CONTAINS & WARNING NOTICE -->
        <div class="cover-warning-notice">
          <div class="font-bold text-[9pt] mb-1">This Booklet contains <span class="js-total-pages">${actualTotalPages}</span> pages. इस पुस्तिका में <span class="js-total-pages">${actualTotalPages}</span> पृष्ठ हैं।</div>
          <div class="font-bold text-[9.5pt]">इस परीक्षा पुस्तिका को जब तक ना खोलें जब तक कहा न जाए।</div>
          <div class="font-bold text-[9.5pt]">Do not open this Test Booklet until you are asked to do so.</div>
          <div class="text-[8pt] text-slate-800 mt-1">इस परीक्षा पुस्तिका के पिछले आवरण पर दिए निर्देशों को ध्यान से पढ़ें।</div>
          <div class="text-[8pt] text-slate-800">Read carefully the Instructions on the Back Cover of this Test Booklet.</div>
        </div>

        <!-- INSTRUCTIONS BOX TABLE (POINT-BY-POINT HORIZONTAL BILINGUAL ALIGNMENT) -->
        <div class="instructions-box-table">
          <div class="inst-header-row">
            <div class="inst-heading inst-heading-left">महत्वपूर्ण निर्देश :</div>
            <div class="inst-heading inst-heading-right">Important Instructions :</div>
          </div>
          <div class="inst-points-list">
            <!-- Point 1 -->
            <div class="inst-point-row">
              <div class="inst-point-cell inst-cell-left">
                <span class="inst-point-num">1.</span>
                <div class="inst-point-text">उत्तर पत्र के <strong>पृष्ठ-1</strong> एवं <strong>पृष्ठ-2</strong> पर ध्यानपूर्वक केवल <strong>नीले/काले बॉल पॉइंट पेन</strong> से विवरण भरें।</div>
              </div>
              <div class="inst-point-cell inst-cell-right">
                <span class="inst-point-num">1.</span>
                <div class="inst-point-text">On the Answer Sheet, fill in the particulars on <strong>Side-1 and Side-2</strong> carefully with <strong>blue/black ball point pen only</strong>.</div>
              </div>
            </div>
            <!-- Point 2 -->
            <div class="inst-point-row">
              <div class="inst-point-cell inst-cell-left">
                <span class="inst-point-num">2.</span>
                <div class="inst-point-text">परीक्षा की अवधि <strong>${durationHours} घंटे ${durationRemainder > 0 ? `${durationRemainder} मिनट` : ""}</strong> है एवं परीक्षा पुस्तिका में <strong>${test.totalQuestions} प्रश्न</strong> हैं। प्रत्येक प्रश्न <strong>${test.correctMarks} अंक</strong> का है। प्रत्येक सही उत्तर के लिए परीक्षार्थी को <strong>${test.correctMarks} अंक</strong> दिए जाएंगे। प्रत्येक गलत उत्तर के लिए कुल योग में से <strong>${Math.abs(test.incorrectMarks)} अंक</strong> घटाया जाएगा। अधिकतम अंक <strong>${test.totalMarks}</strong> है।</div>
              </div>
              <div class="inst-point-cell inst-cell-right">
                <span class="inst-point-num">2.</span>
                <div class="inst-point-text">The test is of <strong>${durationHours} hours ${durationRemainder > 0 ? `${durationRemainder} minutes` : ""}</strong> duration and this Test Booklet contains <strong>${test.totalQuestions} questions</strong>. Each question carries <strong>${test.correctMarks} marks</strong>. For each correct response, the candidate will get <strong>${test.correctMarks} marks</strong>. For each incorrect response, <strong>${Math.abs(test.incorrectMarks)} mark</strong> will be deducted from the total scores. The maximum marks are <strong>${test.totalMarks}</strong>.</div>
              </div>
            </div>
            <!-- Point 3 -->
            <div class="inst-point-row">
              <div class="inst-point-cell inst-cell-left">
                <span class="inst-point-num">3.</span>
                <div class="inst-point-text">${sectionPatternHi}</div>
              </div>
              <div class="inst-point-cell inst-cell-right">
                <span class="inst-point-num">3.</span>
                <div class="inst-point-text">${sectionPatternEn}</div>
              </div>
            </div>
            <!-- Point 4 -->
            <div class="inst-point-row">
              <div class="inst-point-cell inst-cell-left">
                <span class="inst-point-num">4.</span>
                <div class="inst-point-text">यदि किसी प्रश्न में एक से अधिक विकल्प सही हों, तो सबसे उचित विकल्प को ही उत्तर माना जायेगा।</div>
              </div>
              <div class="inst-point-cell inst-cell-right">
                <span class="inst-point-num">4.</span>
                <div class="inst-point-text">In case of more than one option correct in any question, the best correct option will be considered as answer.</div>
              </div>
            </div>
            <!-- Point 5 -->
            <div class="inst-point-row">
              <div class="inst-point-cell inst-cell-left">
                <span class="inst-point-num">5.</span>
                <div class="inst-point-text">इस पृष्ठ पर विवरण अंकित करने एवं उत्तर पत्र पर निशान लगाने के लिए <strong>केवल नीले/काले बॉल पॉइंट पेन</strong> का प्रयोग करें।</div>
              </div>
              <div class="inst-point-cell inst-cell-right">
                <span class="inst-point-num">5.</span>
                <div class="inst-point-text">Use <strong>Blue/Black Ball Point Pen only</strong> for writing particulars on this page/marking responses.</div>
              </div>
            </div>
            <!-- Point 6 -->
            <div class="inst-point-row">
              <div class="inst-point-cell inst-cell-left">
                <span class="inst-point-num">6.</span>
                <div class="inst-point-text">रफ कार्य इस परीक्षा पुस्तिका में निर्धारित स्थान पर ही करें।</div>
              </div>
              <div class="inst-point-cell inst-cell-right">
                <span class="inst-point-num">6.</span>
                <div class="inst-point-text">Rough work is to be done on the space provided for this purpose in the Test Booklet only.</div>
              </div>
            </div>
            <!-- Point 7 -->
            <div class="inst-point-row">
              <div class="inst-point-cell inst-cell-left">
                <span class="inst-point-num">7.</span>
                <div class="inst-point-text">परीक्षा सम्पन्न होने पर, परीक्षार्थी <strong>कक्ष/हॉल छोड़ने से पूर्व उत्तर पत्र निरीक्षक को अवश्य सौंप दें</strong>। परीक्षार्थी अपने साथ केवल <strong>परीक्षा पुस्तिका को ले जा सकते हैं</strong>।</div>
              </div>
              <div class="inst-point-cell inst-cell-right">
                <span class="inst-point-num">7.</span>
                <div class="inst-point-text">On completion of the test, the candidate <strong>must hand over the Answer Sheet to the Invigilator before leaving the Room/Hall</strong>. The candidates are <strong>allowed to take away this Test Booklet with them</strong>.</div>
              </div>
            </div>
            <!-- Point 8 -->
            <div class="inst-point-row">
              <div class="inst-point-cell inst-cell-left">
                <span class="inst-point-num">8.</span>
                <div class="inst-point-text">परीक्षार्थी सुनिश्चित करें कि इस उत्तर पत्र को मोड़ा न जाए एवं उस पर कोई अन्य निशान न लगाएं। परीक्षार्थी अपना फॉर्म नम्बर प्रश्न पुस्तिका/उत्तर पत्र में निर्धारित स्थान के अतिरिक्त अन्यत्र न लिखें।</div>
              </div>
              <div class="inst-point-cell inst-cell-right">
                <span class="inst-point-num">8.</span>
                <div class="inst-point-text">The candidates should ensure that the Answer Sheet is not folded. Do not make any stray marks on the Answer Sheet. Do not write your Form No. anywhere else except in the specified space in the Test Booklet/Answer Sheet.</div>
              </div>
            </div>
            <!-- Point 9 -->
            <div class="inst-point-row">
              <div class="inst-point-cell inst-cell-left">
                <span class="inst-point-num">9.</span>
                <div class="inst-point-text">उत्तर पत्र पर किसी प्रकार के संशोधन हेतु व्हाइट फ्लूइड के प्रयोग की अनुमति नहीं है।</div>
              </div>
              <div class="inst-point-cell inst-cell-right">
                <span class="inst-point-num">9.</span>
                <div class="inst-point-text">Use of white fluid for correction is <strong>not permissible</strong> on the Answer Sheet.</div>
              </div>
            </div>
          </div>
        </div>

        <!-- AMBIGUITY BANNER -->
        <div class="ambiguity-banner">
          <div class="font-bold text-[8pt]">प्रश्नों के अनुवाद में किसी अस्पष्टता की स्थिति में, अंग्रेजी संस्करण को ही अंतिम माना जाएगा।</div>
          <div class="text-[7.5pt]">In case of any ambiguity in translation of any question, English version shall be treated as final.</div>
        </div>

        <!-- CANDIDATE PARTICULARS -->
        <div class="candidate-particulars-box">
          <div class="part-row">
            <span class="part-label">परीक्षार्थी का नाम (बड़े अक्षरों में) / Name of the Candidate (in Capitals) :</span>
            <span class="part-line"></span>
          </div>
          <div class="part-row-grid">
            <div class="grid-cell">
              <span class="part-label">फॉर्म नंबर / Form Number : अंकों में / in figures :</span>
              <span class="part-line"></span>
            </div>
            <div class="grid-cell">
              <span class="part-label">: शब्दों में / : in words :</span>
              <span class="part-line"></span>
            </div>
          </div>
          <div class="part-row">
            <span class="part-label">परीक्षा केंद्र (बड़े अक्षरों में) / Centre of Examination (in Capitals) :</span>
            <span class="part-line"></span>
          </div>
          <div class="part-row-grid mt-1">
            <div class="grid-cell">
              <span class="part-label">परीक्षार्थी के हस्ताक्षर / Candidate's Signature :</span>
              <span class="part-line sig-line"></span>
            </div>
            <div class="grid-cell">
              <span class="part-label">निरीक्षक के हस्ताक्षर / Invigilator's Signature :</span>
              <span class="part-line sig-line"></span>
            </div>
          </div>
        </div>

        <!-- BOTTOM TARGET MOTTO (Best Wishes From Atomic Pathshala) -->
        <div class="bottom-target-motto bg-white border-2 border-black text-black font-extrabold">
          BEST WISHES FROM ATOMIC PATHSHALA FOR NEET 2027
        </div>
        
        <div class="flex justify-between text-[7.5pt] font-mono-code font-bold mt-1 text-slate-800">
          ${SITE_LINK_HTML}<span>Page 1/<span class="js-total-pages">${actualTotalPages}</span></span>
        </div>
      </div>
    </div>
  `;

  // ---- Question pages ------------------------------------------------------
  // Each section's questions are emitted as ONE flow and cut into A4 pages in
  // the browser by their real rendered height (paginateBooklet() below). The
  // old fixed "N questions per page" guess clipped long questions — match
  // tables, diagrams, long Hindi statements — off the bottom of the page.
  //
  // A question is a run of Hindi | English lines ("parts"): statement,
  // diagram, one line per option (a) b) c) d), and in the solutions booklet
  // its solution. Both languages of a line sit in one grid row, so they start
  // at the same height; a page may break between lines (statement on one
  // page, options on the next) instead of leaving half a page empty.

  const OPTION_LETTERS = ["a", "b", "c", "d", "e", "f"];
  /**
   * Match-the-column questions already use (a) (b) … / (i) (ii) … inside the
   * columns, so their answer choices are numbered 1) 2) 3) 4) instead —
   * otherwise "(b)" in the table and "b)" as a choice read the same.
   */
  const MATCH_COLUMN = /column|colum|कॉलम|कालम|स्तम्भ|स्तंभ|list[\s-]*(i|1)\b|सूची/i;
  const isMatchColumn = (q: FormattedExportQuestion) => MATCH_COLUMN.test(`${q.statementEn} ${q.statementHi}`);
  /** Printed label of choice i (0-based): a b c d, or 1 2 3 4 for match-the-column. */
  const choiceLabel = (q: FormattedExportQuestion, i: number) => (isMatchColumn(q) ? String(i + 1) : OPTION_LETTERS[i] ?? String(i + 1));
  /** "2" → "b" (or "2" for match-the-column) — the correct choice as printed. */
  const optionLetter = (q: FormattedExportQuestion) => {
    const i = Number(q.correctOptionKey) - 1;
    return Number.isInteger(i) && i >= 0 ? choiceLabel(q, i) : q.correctOptionKey.toLowerCase();
  };

  const diagramFor = (q: FormattedExportQuestion) =>
    q.camDrawSvg
      ? `<div class="q-diagram-wrap q-camdraw-wrap">${q.camDrawSvg}</div>`
      : q.imageUrl
      ? `<div class="q-diagram-wrap"><img src="${q.imageUrl}" alt="Diagram for Question ${q.number}" class="q-diagram-img" /></div>`
      : "";

  const part = (cls: string, hi: string, en: string, attrs = "") =>
    `<div class="q-part ${cls}"${attrs}><div class="qp-cell qp-hi">${hi}</div><div class="qp-cell qp-en">${en}</div></div>`;

  const TABLE_BLOCK = /<div class="fx-table-wrap"[^>]*>[\s\S]*?<\/table><\/div>/g;
  const hasContent = (html: string) => /<img|<svg|class="katex/.test(html) || html.replace(/<[^>]+>/g, "").trim() !== "";
  const trimBreaks = (html: string) => html.replace(/^(\s*<br\s*\/?>)+/, "").replace(/(<br\s*\/?>\s*)+$/, "");
  /** Statement HTML cut at its tables, so a page can break between the text and a tall table. */
  const statementChunks = (html: string) => {
    const chunks: string[] = [];
    let last = 0;
    for (const m of html.matchAll(TABLE_BLOCK)) {
      const before = trimBreaks(html.slice(last, m.index));
      if (hasContent(before)) chunks.push(before);
      chunks.push(m[0]);
      last = (m.index ?? 0) + m[0].length;
    }
    const rest = trimBreaks(html.slice(last));
    if (hasContent(rest) || chunks.length === 0) chunks.push(rest);
    return chunks;
  };

  const PARAGRAPH_BREAK = /(?:<br\s*\/?>\s*){2,}/;
  const balanced = (html: string) =>
    ["div", "span", "strong", "em", "table", "b", "i"].every(
      (t) => (html.match(new RegExp(`<${t}[\\s>]`, "g")) || []).length === (html.match(new RegExp(`</${t}>`, "g")) || []).length
    );
  /** Rendered text cut at its blank lines (only where no element spans the cut). */
  const paragraphs = (html: string) => {
    const paras = html.split(PARAGRAPH_BREAK).filter(hasContent);
    return paras.length > 1 && paras.every(balanced) ? paras : [html];
  };

  /** A text chunk cut at its line breaks (tables are kept whole). */
  const lines = (html: string) => {
    if (html.startsWith('<div class="fx-table-wrap"')) return [html];
    const parts = html.split(/<br\s*\/?>/).map((l) => l.trim()).filter(hasContent);
    return parts.length > 1 && parts.every(balanced) ? parts : [html];
  };

  const questionPartsHtml = (q: FormattedExportQuestion, withSolutionPart: boolean) => {
    const stmtHi = statementChunks(renderFormulaContent(q.statementHi || q.statementEn));
    const stmtEn = statementChunks(renderFormulaContent(q.statementEn || q.statementHi));
    // Finer still: each line of text (Assertion / Reason / …) on its own.
    const lineHi = stmtHi.flatMap(lines);
    const lineEn = stmtEn.flatMap(lines);
    // Split only when both languages cut into the same pieces (so they stay side by side).
    const [hiChunks, enChunks] =
      lineHi.length === lineEn.length
        ? [lineHi, lineEn]
        : stmtHi.length === stmtEn.length
        ? [stmtHi, stmtEn]
        : [[stmtHi.join("<br/>")], [stmtEn.join("<br/>")]];
    const num = withSolutionPart
      ? `<span class="q-num"><span class="q-num-box">${q.number}</span></span>`
      : `<span class="q-num">${q.number}.</span>`;
    // DPP solutions: only the number, answer and solution (the question is already printed above).
    const solutionOnly = withSolutionPart && isDpp;
    const parts = solutionOnly
      ? []
      : [
          part("q-row-item q-stmt", `${num}<div class="q-body">${hiChunks[0]}</div>`, `${num}<div class="q-body">${enChunks[0]}</div>`, ` id="q-${q.number}"`),
          ...hiChunks.slice(1).map((h, i) => part("q-fig q-cont", h, enChunks[i + 1]!)),
        ];
    const diagram = solutionOnly ? "" : diagramFor(q);
    if (diagram) parts.push(part("q-fig", diagram, diagram));
    if (!solutionOnly && q.options.some((o) => o.textEn || o.textHi)) {
      for (let k = 0; k < parts.length; k++) parts[k] = parts[k]!.replace('class="q-part ', 'class="q-part keep-next ');
    }
    if (!solutionOnly) q.options.forEach((opt, i) => {
      if (!opt.textEn && !opt.textHi) return;
      const cell = (hi: boolean) =>
        `<span class="opt-key">${choiceLabel(q, i)})</span><span class="opt-text">${renderFormulaContent(
          hi ? opt.textHi || opt.textEn : opt.textEn || opt.textHi
        )}</span>`;
      parts.push(part("q-opt", cell(true), cell(false)));
    });
    if (withSolutionPart) {
      // One line per paragraph, so a long solution can continue on the next page.
      const ans = optionLetter(q);
      const solHi = q.solutionHi || q.solutionEn;
      const solEn = q.solutionEn || q.solutionHi;
      // Line by line (a blank line stays as a small gap), so a page can break anywhere in it.
      const solLines = (html: string) =>
        paragraphs(html).flatMap((p, i) => lines(p).map((l, j) => (i > 0 && j === 0 ? `<span class="para-gap"></span>${l}` : l)));
      const hiParas = solHi ? solLines(renderFormulaContent(solHi)) : [];
      const enParas = solEn ? solLines(renderFormulaContent(solEn)) : [];
      const lineCount = Math.max(1, hiParas.length, enParas.length);
      for (let i = 0; i < lineCount; i++) {
        const cell = (hi: boolean) => {
          const para = (hi ? hiParas : enParas)[i];
          return `${i === 0 ? `<div class="sol-ans">${hi ? "उत्तर" : "Ans."} (${ans})</div>` : ""}${
            para ? `<div class="sol-text">${i === 0 ? `<b>${hi ? "हल :" : "Sol. :"}</b> ` : ""}${para}</div>` : ""
          }`;
        };
        parts.push(
          i === 0 && solutionOnly
            ? part("sol-row-item q-stmt", `${num}<div class="q-body">${cell(true)}</div>`, `${num}<div class="q-body">${cell(false)}</div>`, ` id="sol-q-${q.number}"`)
            : i === 0
            ? part("sol-row-item q-sol", cell(true), cell(false), ` id="sol-q-${q.number}"`)
            : part("q-sol q-sol-cont", cell(true), cell(false))
        );
      }
    }
    parts[parts.length - 1] = parts[parts.length - 1]!.replace('class="q-part ', 'class="q-part q-last ');
    // Solutions booklet: a little more indent so lines start after the boxed number.
    return withSolutionPart ? parts.map((p) => p.replace('class="q-part ', 'class="q-part in-sol ')).join("") : parts.join("");
  };

  const renderSingleRoughPageHtml = (pNo: number, subjectName?: string) => {
    const isEven = pNo % 2 === 0;
    const headerRow1 = isEven ? `
      <div class="test-header-row-1">
        <div class="test-header-brand">${brandName}</div>
        <div class="test-header-page-no">${pNo}</div>
        <div class="test-header-lang-badge">Hindi + English</div>
      </div>
    ` : `
      <div class="test-header-row-1">
        <div class="test-header-lang-badge">Hindi + English</div>
        <div class="test-header-page-no">${pNo}</div>
        <div class="test-header-brand">${brandName}</div>
      </div>
    `;

    return `
    <div class="page rough-page">
      <div class="test-page-header">
        ${headerRow1}
        <div class="test-header-subject-row">
          SPACE FOR ROUGH WORK / रफ कार्य के लिए जगह ${subjectName ? `(${subjectName.toUpperCase()})` : ""}
        </div>
        <div class="test-header-divider"></div>
      </div>
      <div class="rough-page-content">
        <div class="rough-watermark">SPACE FOR ROUGH WORK / रफ कार्य के लिए जगह</div>
      </div>
      <div class="page-running-footer">
        ${phaseBoxHtml}
        <div class="footer-meta-row">
          ${footerLeftHtml}${SITE_LINK_HTML}
          <span class="footer-date">${currentDateStr}</span>
        </div>
      </div>
    </div>
  `;
  };

  // Question booklet: one flow per subject, a rough page after each.
  // Solutions booklet: answer key first, then each question followed by its
  // solution — no cover, rough pages or back cover.
  let questionPagesHtml = "";
  if (!withSolution || isDpp) {
    test.sections.forEach((section, si) => {
      const dppStrip =
        isDpp && si === 0
          ? `<div class="dpp-strip"><div class="dpp-strip-title">${test.name}</div><div class="dpp-strip-meta">${test.totalQuestions} Questions · ${test.durationMin} min · +${test.correctMarks} / ${test.incorrectMarks}</div></div>`
          : "";
      questionPagesHtml += `
      <div class="q-flow" data-subject="SUBJECT : ${section.subject.toUpperCase().replace(/"/g, "&quot;")}">
        ${dppStrip}${section.questions.map((q) => questionPartsHtml(q, false)).join("")}
      </div>`;
      // Rough page after each subject (page numbers are filled in after pagination).
      if (!isDpp) questionPagesHtml += renderSingleRoughPageHtml(0, section.subject);
    });
  }

  // The frame every question page is cut into (see paginateBooklet()).
  const contentPageTemplateHtml = `
    <template id="tpl-content-page">
      <div class="page content-page">
        <div class="page-watermark"><div class="watermark-text">${brandName}</div></div>
        <div class="test-page-header">
          <div class="test-header-row-1"></div>
          <div class="test-header-subject-row"></div>
          <div class="test-header-divider"></div>
        </div>
        <div class="content-body"><div class="questions-stream"></div></div>
        <div class="page-running-footer">
          ${phaseBoxHtml}
          <div class="footer-meta-row">
            ${footerLeftHtml}${SITE_LINK_HTML}
            <span class="footer-date">${currentDateStr}</span>
          </div>
        </div>
      </div>
    </template>`;

  // Final End Rough Page before Back Cover / Answer Key
  const finalRoughPagesHtml = renderSingleRoughPageHtml(0);

  // Back Cover Page
  const backCoverHtml = `
    <div class="page back-cover-page">
      <div class="back-cover-border">
        <div class="back-cover-table">
          <div class="back-col back-col-hi">
            <div class="back-heading">महत्वपूर्ण निर्देश :</div>
            <ol class="back-list">
              <li>पूछे जाने पर प्रत्येक परीक्षार्थी, निरीक्षक को अपना <strong>पहचान पत्र (Atomic Pathshala ID Card / Admit Card)</strong> दिखाएं।</li>
              <li>निरीक्षक की विशेष अनुमति के बिना कोई परीक्षार्थी अपना स्थान न छोड़े।</li>
              <li>कार्यरत निरीक्षक को अपना उत्तर पत्र दिए बिना कोई परीक्षार्थी परीक्षा हॉल नहीं छोड़े।</li>
              <li>इलेक्ट्रॉनिक / हस्तचलित परिकलक (Calculator) या किसी अन्य डिजिटल उपकरण का उपयोग सर्वथा <strong>वर्जित</strong> है।</li>
              <li>परीक्षा हॉल में आचरण के लिए परीक्षार्थी परीक्षा के सभी नियमों एवं विनियमों द्वारा नियमित है। अनुचित साधन (Unfair Means) के सभी मामलों का फैसला परीक्षा के नियमों एवं विनियमों के अनुसार होगा।</li>
              <li>किसी हालात में परीक्षा पुस्तिका और उत्तर पत्र का कोई भाग अलग न करें।</li>
              <li>परीक्षा पुस्तिका / उत्तर-पत्र में परीक्षार्थी अपना सही नाम व फॉर्म / रोल नम्बर अवश्य लिखें।</li>
            </ol>
          </div>
          <div class="back-col back-col-en">
            <div class="back-heading">Important Instructions :</div>
            <ol class="back-list">
              <li>Each candidate must show on demand his/her <strong>Atomic Pathshala ID Card / Admit Card</strong> to the Invigilator.</li>
              <li>No candidate, without special permission of the Invigilator, would leave his/her seat.</li>
              <li>The candidates should not leave the Examination Hall without handing over their Answer Sheet to the Invigilator on duty.</li>
              <li>Use of <strong>Electronic / Manual Calculator or any smart device</strong> is strictly prohibited.</li>
              <li>The candidates are governed by all Rules and Regulations of the examination with regard to their conduct in the Examination Hall. All cases of unfair means will be dealt with as per Examination Rules.</li>
              <li>No part of the Test Booklet and Answer Sheet shall be detached under any circumstances.</li>
              <li>The candidates will write the Correct Name and Form / Roll No. in the Test Booklet / Answer Sheet.</li>
            </ol>
          </div>
        </div>

        <div class="back-corporate-footer">
          <div class="corp-brand-title">⚡ ATOMIC PATHSHALA</div>
          <div class="corp-address">Registered Office &amp; Online Learning Portal | Rampur / Uttar Pradesh, India</div>
          <div class="corp-contacts">
            <span>Website: <a href="${SITE_URL}" class="site-link"><strong>${SITE_HOST}</strong></a></span>
            <span>·</span>
            <span>Support: <strong>atomic.pathshala.info@gmail.com</strong></span>
            <span>·</span>
            <span>Mobile : <strong>+917668543654</strong></span>
          </div>
        </div>
      </div>
    </div>
  `;

  // Solutions booklet: answer key (columns of 45), then question + solution.
  let solutionsSectionHtml = "";
  if (withSolution) {
    const PER_COLUMN = 45;
    const COLUMNS_PER_TABLE = 5;
    const columns: FormattedExportQuestion[][] = [];
    for (let i = 0; i < test.allQuestions.length; i += PER_COLUMN) columns.push(test.allQuestions.slice(i, i + PER_COLUMN));
    const answerKeyTables: string[] = [];
    if (isDpp) {
      // DPP: horizontal key — a row of question numbers over a row of answers, 15 per strip.
      const PER_STRIP = 15;
      const strips: string[] = [];
      for (let i = 0; i < test.allQuestions.length; i += PER_STRIP) {
        const chunk = test.allQuestions.slice(i, i + PER_STRIP);
        strips.push(
          `<tr><th>Q.</th>${chunk.map((q) => `<td class="ak-q">${q.number}</td>`).join("")}</tr>` +
            `<tr><th>Ans.</th>${chunk.map((q) => `<td class="ak-a">${optionLetter(q)}</td>`).join("")}</tr>`
        );
      }
      answerKeyTables.push(`
        <div class="ak-block">
          <div class="ak-title">ANSWER KEY / उत्तर कुंजी <span>${test.name} · ${test.allQuestions.length} Questions</span></div>
          ${strips.map((rows) => `<table class="ak-table ak-horizontal"><tbody>${rows}</tbody></table>`).join("")}
        </div>`);
    }
    for (let t = 0; t < (isDpp ? 0 : columns.length); t += COLUMNS_PER_TABLE) {
      const group = columns.slice(t, t + COLUMNS_PER_TABLE);
      const rows = Math.max(...group.map((c) => c.length));
      let body = "";
      for (let r = 0; r < rows; r++) {
        body += `<tr>${group
          .map((c) => (c[r] ? `<td class="ak-q">${c[r]!.number}</td><td class="ak-a">${optionLetter(c[r]!)}</td>` : `<td class="ak-q"></td><td class="ak-a"></td>`))
          .join('<td class="ak-gap"></td>')}</tr>`;
      }
      answerKeyTables.push(`
        <div class="ak-block">
          ${t === 0 ? `<div class="ak-title">ANSWER KEY / उत्तर कुंजी <span>${test.name} · ${test.allQuestions.length} Questions</span></div>` : ""}
          <table class="ak-table"><thead><tr>${group.map(() => "<th>Q.</th><th>Ans.</th>").join('<th class="ak-gap"></th>')}</tr></thead><tbody>${body}</tbody></table>
        </div>`);
    }

    // One flow: each subject follows straight on (a heading marks where it starts).
    solutionsSectionHtml = `
      <div class="q-flow" data-subject="ANSWER KEY &amp; SOLUTIONS">
        ${answerKeyTables.join("")}
        ${test.sections
          .map(
            (section) =>
              `<div class="sol-section-title keep-next">SOLUTIONS : ${section.subject.toUpperCase()}</div>${section.questions
                .map((q) => questionPartsHtml(q, true))
                .join("")}`
          )
          .join("")}
      </div>`;
  }

  // Full Document Assembly
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${test.name} - ${currentDateStr} - ATOMIC PATHSHALA${withSolution ? " (Solutions)" : ""}</title>
  
  <!-- Tailwind CSS Engine for Exact Aesthetic Rendering -->
  <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@${katex.version}/dist/katex.min.css" crossorigin="anonymous">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Tinos:ital,wght@0,400;0,700;1,400;1,700&family=PT+Serif:ital,wght@0,400;0,700;1,400;1,700&family=Noto+Serif+Devanagari:wght@400;500;600;700;800&family=Montserrat:wght@700;800;900&family=JetBrains+Mono:wght@600;700&display=swap" rel="stylesheet">

  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      margin: 0;
      padding: 24px 0;
      background: #f1f5f9;
      font-family: 'Tinos', 'Times New Roman', 'PT Serif', 'Noto Serif Devanagari', 'Mangal', serif;
      color: #000000;
      font-size: 10.5pt;
      line-height: 1.36;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .font-heading {
      font-family: 'Montserrat', sans-serif;
    }

    .font-mono-code {
      font-family: 'JetBrains Mono', monospace;
    }

    .fill-line {
      border-bottom: 1.5px dotted #64748b;
      flex-grow: 1;
      height: 1.1em;
      margin-left: 6px;
    }

    .omr-bubble {
      width: 15px;
      height: 15px;
      border: 1.5px solid #1e293b;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      font-weight: 700;
      line-height: 1;
    }

    .doc-container {
      max-width: 210mm;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .a4-sheet {
      width: 794px;
      min-height: 1123px;
      background: #ffffff;
      padding: 28px 36px;
      box-sizing: border-box;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-after: always;
      break-after: page;
      margin-bottom: 24px;
    }

    .page {
      width: 794px;
      min-height: 1123px;
      padding: 20px 32px 16px 32px;
      position: relative;
      background: white;
      page-break-after: always;
      break-after: page;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      margin-bottom: 24px;
      box-sizing: border-box;
      overflow: hidden;
    }

    /* Content Page: Strictly Aligned At The Top, Zero Gap, Generous Margins */
    .page.content-page {
      padding: 16px 32px 14px 32px !important;
      justify-content: space-between !important;
    }

    .page-watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-32deg);
      pointer-events: none;
      z-index: 0;
      user-select: none;
      white-space: nowrap;
    }

    .watermark-text {
      font-family: 'Montserrat', 'PT Serif', sans-serif;
      font-size: 42pt;
      font-weight: 900;
      color: rgba(0, 0, 0, 0.035);
      letter-spacing: 6px;
      text-transform: uppercase;
    }

    @media print {
      body {
        background: transparent;
        padding: 0;
      }
      .doc-container {
        max-width: none;
        margin: 0;
        width: 100%;
      }
      .a4-sheet, .page {
        box-shadow: none;
        width: 100%;
        min-height: 100vh;
        padding: 16px 28px 14px 28px;
        margin-bottom: 0;
        border: none;
      }
      .cover-sheet {
        border: 2px solid #0f172a !important;
      }
      .no-print {
        display: none !important;
      }
    }

    .print-bar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: #0f172a;
      color: white;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .print-bar h1 {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .print-bar-btn {
      background: #16a34a;
      color: white;
      border: none;
      padding: 8px 18px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s;
    }
    .print-bar-btn:hover {
      background: #15803d;
    }

    .page-running-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1.5px solid #0f172a;
      padding-bottom: 4px;
      margin-bottom: 8px;
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .cover-page {
      padding: 8mm;
      justify-content: flex-start;
    }
    .cover-border {
      border: 2.5px solid #000;
      padding: 6mm 7mm;
      min-height: 275mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
    }
    .cover-top-header {
      display: grid;
      grid-template-columns: 100px 1fr 120px;
      align-items: center;
      border-bottom: 2px solid #000;
      padding-bottom: 6px;
      gap: 8px;
    }
    .cover-top-left {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .barcode-pill {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8pt;
      font-weight: 700;
      background: #f1f5f9;
      padding: 2px 4px;
      border: 1px solid #000;
      text-align: center;
    }
    .lang-tag {
      font-size: 8pt;
      font-weight: 700;
      border: 1px solid #000;
      text-align: center;
      padding: 1px 0;
      background: #fff;
    }
    .cover-top-center {
      text-align: center;
    }
    .brand-logo-text {
      font-size: 16pt;
      font-weight: 900;
      letter-spacing: 1px;
      color: #000;
    }
    .brand-sub-program {
      font-size: 8.5pt;
      font-weight: 800;
      letter-spacing: 0.5px;
      margin-top: 1px;
    }
    .academic-session {
      font-size: 7.5pt;
      font-weight: 700;
      color: #334155;
    }
    .cover-top-right {
      border: 1.5px solid #000;
      text-align: center;
      padding: 2px 4px;
      font-size: 7.5pt;
    }
    .test-pattern-badge {
      font-weight: 700;
      border-bottom: 1px solid #000;
      padding-bottom: 1px;
    }
    .test-pattern-name {
      font-weight: 800;
      font-size: 8.5pt;
    }
    .test-pattern-type {
      font-weight: 700;
    }
    .test-pattern-date {
      font-size: 7pt;
    }

    .target-banner {
      background: #000;
      color: #fff;
      text-align: center;
      padding: 4px 6px;
      font-size: 9.5pt;
      font-weight: 800;
      letter-spacing: 0.5px;
      margin: 6px 0;
    }
    .candidate-level-pill {
      background: #000;
      color: #fff;
      text-align: center;
      padding: 2px 8px;
      font-size: 8.5pt;
      font-weight: 700;
      width: fit-content;
      margin: 0 auto 6px auto;
      border-radius: 3px;
    }
    .test-name-box {
      border: 1.5px solid #000;
      border-radius: 18px;
      text-align: center;
      padding: 5px 12px;
      margin: 0 auto 6px auto;
      width: 90%;
    }
    .test-type-label {
      font-size: 11pt;
      font-weight: 800;
    }
    .test-type-value {
      color: #000;
    }
    .cover-warning-notice {
      text-align: center;
      font-size: 8.5pt;
      line-height: 1.35;
      margin-bottom: 6px;
    }

    .instructions-box-table {
      border: 1.5px solid #000;
      border-radius: 6px;
      margin-bottom: 6px;
      background: #fff;
      overflow: hidden;
    }
    .inst-header-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border-bottom: 1px solid #000;
      background: #f8fafc;
    }
    .inst-heading {
      font-size: 8.5pt;
      font-weight: 800;
      padding: 4px 8px;
    }
    .inst-heading-left {
      border-right: 1.5px solid #000;
      font-family: 'Noto Serif Devanagari', sans-serif;
    }
    .inst-heading-right {
      font-family: 'Tinos', 'Times New Roman', 'PT Serif', serif;
    }
    .inst-points-list {
      display: flex;
      flex-direction: column;
    }
    .inst-point-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border-bottom: 1px solid #e2e8f0;
    }
    .inst-point-row:last-child {
      border-bottom: none;
    }
    .inst-point-cell {
      display: flex;
      align-items: baseline;
      padding: 3px 8px;
      font-size: 7.5pt;
      line-height: 1.25;
      gap: 4px;
    }
    .inst-cell-left {
      border-right: 1.5px solid #000;
      font-family: 'Noto Serif Devanagari', sans-serif;
    }
    .inst-cell-right {
      font-family: 'Tinos', 'Times New Roman', 'PT Serif', serif;
    }
    .inst-point-num {
      font-weight: 800;
      min-width: 14px;
      flex-shrink: 0;
    }
    .inst-point-text {
      flex: 1;
    }

    .ambiguity-banner {
      border: 1.5px solid #000;
      border-radius: 8px;
      text-align: center;
      padding: 4px 6px;
      font-size: 7.5pt;
      font-weight: 700;
      margin-bottom: 6px;
      background: #f8fafc;
    }

    .candidate-particulars-box {
      border: 1px solid #000;
      padding: 5px 8px;
      font-size: 7.8pt;
      display: flex;
      flex-direction: column;
      gap: 5px;
      background: #fff;
    }
    .part-row {
      display: flex;
      align-items: flex-end;
      gap: 6px;
    }
    .part-row-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .grid-cell {
      display: flex;
      align-items: flex-end;
      gap: 6px;
    }
    .part-label {
      white-space: nowrap;
      font-weight: 700;
      font-size: 7.5pt;
    }
    .part-line {
      flex: 1;
      border-bottom: 1px dotted #000;
      height: 12px;
    }
    .sig-line {
      border-bottom: 1px solid #000;
    }
    .bottom-target-motto {
      background: #000;
      color: #fff;
      text-align: center;
      font-size: 9pt;
      font-weight: 800;
      letter-spacing: 0.5px;
      padding: 4px;
      margin-top: 6px;
    }

    /* Authentic Academic Exam Typesetting (Matching ALLEN Official Standard) */
    .test-page-header {
      width: 100%;
      margin-bottom: 0px;
      padding-bottom: 0px;
    }

    .test-header-row-1 {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1px;
    }

    /* DPP pages: level watermark, brand in colour in the header and footer. */
    .dpp-doc .page-watermark { transform: translate(-50%, -50%) rotate(0deg); }
    .dpp-doc .watermark-text { color: rgba(0, 0, 0, 0.045); font-size: 36pt; letter-spacing: 4px; }
    .dpp-doc .test-header-brand { color: #14181f; }
    .dpp-doc .test-header-brand .brand-accent { color: #F26A1B; }
    .footer-brand { font-family: 'Montserrat', sans-serif; font-weight: 900; font-size: 9pt; letter-spacing: 0.4px; color: #14181f; }
    .footer-brand span { color: #F26A1B; }

    .test-header-brand {
      font-family: 'Montserrat', sans-serif;
      font-size: 14pt;
      font-weight: 900;
      letter-spacing: 0.5px;
      color: #000000;
    }

    .test-header-page-no {
      font-family: 'Tinos', 'Times New Roman', 'PT Serif', serif;
      font-size: 12.5pt;
      font-weight: 700;
      color: #000000;
    }

    .test-header-lang-badge {
      border: 1px solid #000000;
      padding: 1px 8px;
      font-family: 'Tinos', 'Times New Roman', 'PT Serif', serif;
      font-size: 8pt;
      font-weight: 700;
      color: #000000;
      background: #ffffff;
    }

    .test-header-subject-row {
      text-align: center;
      font-family: 'Tinos', 'Times New Roman', 'PT Serif', serif;
      font-size: 11pt;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: #000000;
      margin-top: 1px;
      margin-bottom: 2px;
    }

    .test-header-divider {
      height: 1.5px;
      background: #000000;
      width: 100%;
      margin-bottom: 2px;
    }

    .content-body {
      flex: 1 0 auto;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      margin-top: 0px !important;
      padding-top: 0px !important;
    }

    .questions-stream {
      display: flex;
      flex-direction: column;
      margin-top: 0px !important;
      padding-top: 0px !important;
    }

    /* Question Row: Two Equal Columns With Continuous Solid Center Line */
    .q-row-item {
      display: grid;
      grid-template-columns: 1fr 1fr;
      padding: 4px 0 6px 0;
      page-break-inside: avoid;
      break-inside: avoid;
      position: relative;
      z-index: 1;
    }

    .q-side {
      display: flex;
      flex-direction: column;
    }

    .q-side-hi {
      padding-right: 14px;
      border-right: 1.5px solid #000000;
    }

    .q-side-en {
      padding-left: 14px;
    }

    .q-head-statement {
      display: flex;
      align-items: baseline;
      gap: 5px;
      text-align: justify;
    }

    .q-statement-body {
      flex: 1;
    }

    /* EXACT EXAM SERIF FONTS MATCHING ALLEN PDF */
    .q-side-en,
    .q-side-en .q-statement-body,
    .q-side-en .opt-value,
    .q-side-en p,
    .q-side-en span:not(.katex *) {
      font-family: 'Tinos', 'Times New Roman', 'PT Serif', 'Nimbus Roman No9 L', 'FreeSerif', 'Liberation Serif', serif !important;
    }

    .q-side-hi,
    .q-side-hi .q-statement-body,
    .q-side-hi .opt-value,
    .q-side-hi p,
    .q-side-hi span:not(.katex *) {
      font-family: 'Noto Serif Devanagari', 'Mangal', 'Kokila', 'Tinos', 'Times New Roman', 'PT Serif', serif !important;
    }

    .q-statement-body,
    .q-statement-body p,
    .q-statement-body span:not(.katex *),
    .opt-value,
    .opt-value p,
    .opt-value span:not(.katex *) {
      font-size: 10pt !important;
      font-weight: 400 !important;
      line-height: 1.36 !important;
      color: #000000 !important;
    }

    .q-num-label {
      font-family: 'Tinos', 'Times New Roman', 'PT Serif', serif !important;
      font-size: 10.5pt !important;
      font-weight: 700 !important;
      color: #000000 !important;
      min-width: 22px;
      flex-shrink: 0;
    }

    .q-opts-wrapper {
      margin-top: 3px;
    }

    .opts-grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: 12px;
      row-gap: 2px;
    }

    .opts-stacked {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .opt-box {
      display: flex;
      align-items: baseline;
      gap: 4px;
    }

    .opt-label {
      font-family: 'Tinos', 'Times New Roman', 'PT Serif', serif !important;
      font-size: 10pt !important;
      font-weight: 400 !important;
      color: #000000 !important;
      min-width: 22px;
      flex-shrink: 0;
    }

    .q-diagram-wrap {
      text-align: center;
      margin: 3px 0;
    }

    .q-diagram-img {
      max-width: 90%;
      max-height: 110px;
      object-fit: contain;
      display: inline-block;
    }

    /* KaTeX Display in questions */
    .katex-display {
      margin: 2px 0 !important;
      max-width: 100% !important;
      overflow-x: auto !important;
    }
    .katex {
      font-size: 9.5pt !important;
      line-height: 1.25 !important;
    }
    .katex-display > .katex {
      text-align: center !important;
    }
    .katex .mtable {
      border-collapse: collapse !important;
      margin: 0 auto !important;
    }

    /* Match the Column / Table Styling */
    .q-statement-body table {
      width: 100% !important;
      border-collapse: collapse !important;
      border: 1.5px solid #000000 !important;
      font-size: 8.5pt !important;
      margin: 4px 0 !important;
      line-height: 1.25 !important;
    }
    .q-statement-body table th,
    .q-statement-body table td {
      border: 1px solid #000000 !important;
      padding: 3px 6px !important;
      text-align: left !important;
    }
    .q-statement-body table th {
      font-weight: 700 !important;
      text-align: center !important;
    }

    /* Running Footer Matching Allen */
    .dpp-strip { border: 1.5px solid #111; border-radius: 6px; padding: 7px 12px; margin: 0 0 10px; display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
    .dpp-strip-title { font-weight: 700; font-size: 14pt; }
    .dpp-strip-meta { font-size: 9.5pt; color: #333; white-space: nowrap; }
    .page-running-footer {
      margin-top: auto;
      padding-top: 2px;
      width: 100%;
    }

    .footer-phase-box {
      border: 1px solid #000000;
      padding: 1px 6px;
      font-family: 'Tinos', 'Times New Roman', 'PT Serif', serif;
      font-size: 7.5pt;
      font-weight: 700;
      width: fit-content;
      margin-bottom: 2px;
    }

    .footer-meta-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1.5px solid #000000;
      padding-top: 2px;
      font-family: 'Tinos', 'Times New Roman', 'PT Serif', serif;
      font-size: 8pt;
      font-weight: 700;
      color: #000000;
    }

    .footer-barcode {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      font-size: 8.5pt;
    }

    .footer-date {
      font-family: 'Tinos', 'Times New Roman', 'PT Serif', serif;
      font-weight: 700;
      font-size: 8.5pt;
    }

    .rough-page {
      background: #ffffff !important;
    }
    .rough-page-content {
      flex: 1;
      border: 1.5px dashed #cbd5e1;
      margin: 10px 0;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff !important;
    }
    .rough-watermark {
      font-size: 16pt;
      font-weight: 800;
      color: #e2e8f0;
      text-transform: uppercase;
      letter-spacing: 2px;
      text-align: center;
      pointer-events: none;
      user-select: none;
    }

    .back-cover-page {
      padding: 8mm;
    }
    .back-cover-border {
      border: 2px solid #000;
      padding: 8mm;
      min-height: 275mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .back-cover-table {
      border: 1.5px solid #000;
      display: grid;
      grid-template-columns: 1fr 1fr;
    }
    .back-col {
      padding: 10px;
    }
    .back-col-hi {
      border-right: 1.5px solid #000;
      font-family: 'Noto Serif Devanagari', 'Mangal', serif;
    }
    .back-col-en {
      font-family: 'Tinos', 'Times New Roman', 'PT Serif', serif;
    }
    .back-heading {
      font-size: 11pt;
      font-weight: 800;
      margin-bottom: 8px;
      text-decoration: underline;
    }
    .back-list {
      margin: 0;
      padding-left: 18px;
      font-size: 9pt;
      line-height: 1.5;
    }
    .back-list li {
      margin-bottom: 8px;
    }
    .back-corporate-footer {
      border-top: 2px solid #000;
      padding-top: 10px;
      text-align: center;
    }
    .corp-brand-title {
      font-size: 12pt;
      font-weight: 900;
      letter-spacing: 1px;
    }
    .corp-address {
      font-size: 8.5pt;
      color: #334155;
      margin-top: 2px;
    }
    .corp-contacts {
      font-size: 8pt;
      margin-top: 4px;
      display: flex;
      justify-content: center;
      gap: 10px;
    }

    .ak-header-banner {
      background: #0f172a;
      color: #fff;
      padding: 8px 12px;
      text-align: center;
      border-radius: 6px;
      margin-bottom: 12px;
    }
    .ak-main-title {
      font-size: 12pt;
      font-weight: 900;
      letter-spacing: 0.5px;
    }
    .ak-sub-title {
      font-size: 8.5pt;
      color: #cbd5e1;
      margin-top: 2px;
    }
    .ak-grid-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
      text-align: center;
    }
    .ak-grid-table th {
      background: #1e293b;
      color: #fff;
      font-weight: 800;
      padding: 4px 6px;
      border: 1px solid #334155;
    }
    .ak-grid-table td {
      border: 1px solid #cbd5e1;
      padding: 3px 6px;
    }
    .ak-qno {
      font-weight: 700;
      background: #f8fafc;
      width: 11%;
    }
    .ak-ans {
      font-weight: 800;
      color: #1e40af;
      width: 11%;
    }
    .ak-sep {
      background: #0f172a;
      width: 4px;
      padding: 0 !important;
      border: none !important;
    }

    .sol-main-header {
      background: #f1f5f9;
      border-left: 4px solid #4f46e5;
      padding: 8px 12px;
      margin-bottom: 12px;
    }
    .sol-main-header h2 {
      margin: 0;
      font-size: 12pt;
      font-weight: 800;
    }
    .sol-main-header p {
      margin: 2px 0 0 0;
      font-size: 8pt;
      color: #475569;
    }
    .sol-section-title {
      background: #1e293b;
      color: white;
      padding: 4px 10px;
      font-size: 9pt;
      font-weight: 800;
      border-radius: 4px;
      margin: 12px 0 6px 0;
    }
    .sol-row-item {
      border-bottom: 1.5px solid #000000;
      padding: 8px 0 10px 0;
      margin-bottom: 0;
      page-break-inside: avoid;
      break-inside: avoid;
      background: transparent;
    }
    .sol-item-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;
    }
    .sol-q-badge {
      font-family: 'Tinos', 'Times New Roman', 'PT Serif', serif;
      font-size: 9.5pt;
      font-weight: 800;
      background: #0f172a;
      color: #ffffff;
      padding: 1px 7px;
      border-radius: 3px;
    }
    .sol-correct-badge {
      font-family: 'Tinos', 'Times New Roman', 'PT Serif', serif;
      font-size: 9.5pt;
      color: #047857;
      font-weight: 700;
    }
    .sol-subject-tag {
      font-size: 7.5pt;
      color: #64748b;
      margin-left: auto;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .sol-grid-two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      width: 100%;
    }
    .sol-col-side {
      display: flex;
      flex-direction: column;
    }
    .sol-side-hi {
      padding-right: 14px;
      border-right: 1.5px solid #000000;
    }
    .sol-side-en {
      padding-left: 14px;
    }
    .sol-stmt-text {
      font-family: 'Noto Serif Devanagari', 'Mangal', 'Tinos', 'Times New Roman', serif;
      font-size: 9pt;
      line-height: 1.35;
      color: #334155;
      margin-bottom: 5px;
      text-align: justify;
    }
    .sol-expl-heading {
      font-family: 'Noto Serif Devanagari', 'Mangal', 'Tinos', 'Times New Roman', serif;
      font-size: 8.5pt;
      font-weight: 700;
      color: #1e40af;
      margin-top: 2px;
      margin-bottom: 3px;
    }
    .sol-body-text {
      font-family: 'Noto Serif Devanagari', 'Mangal', 'Tinos', 'Times New Roman', serif;
      font-size: 9.5pt;
      line-height: 1.45;
      color: #000000;
      text-align: justify;
    }
    .sol-diagram-wrap {
      margin: 4px 0;
      text-align: center;
    }
    .sol-diagram-img {
      max-height: 120px;
      max-width: 100%;
      object-fit: contain;
      display: inline-block;
    }
    .font-devanagari {
      font-family: 'Noto Serif Devanagari', 'Mangal', 'Tinos', 'Times New Roman', serif !important;
    }

    /* ================================================================
       Vector PDF via the browser's "Save as PDF" (overrides above).
       Every sheet is exactly A4; question/solution pages are filled by
       measured height in paginateBooklet (script at the end).
       ================================================================ */
    @page { size: A4; margin: 0; }
    .a4-sheet, .page {
      width: 210mm !important;
      height: 297mm !important;
      min-height: 0 !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
    }
    .page { display: flex !important; flex-direction: column !important; }
    .page .content-body { flex: 1 1 auto !important; min-height: 0 !important; overflow: hidden !important; }
    .page.page-overflow { height: auto !important; min-height: 297mm !important; overflow: visible !important; }
    .page.page-overflow .content-body { overflow: visible !important; }
    /* Before pagination (or with scripts off) the flows still read correctly. */
    .q-flow, .sol-flow { width: 210mm; box-sizing: border-box; padding: 16px 32px; background: #fff; margin-bottom: 24px; }

    @media print {
      html, body { background: #ffffff !important; margin: 0 !important; padding: 0 !important; }
      .doc-container { padding: 0 !important; margin: 0 !important; gap: 0 !important; display: block !important; max-width: none !important; }
      .a4-sheet, .page {
        margin: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        break-after: page;
        page-break-after: always;
      }
      .no-print { display: none !important; }
    }

    /* ---- Question lines (questionPartsHtml): Hindi | English in one grid row ---- */
    .page.content-page, .page.rough-page { padding: 14px 15mm 12px 15mm !important; }
    .q-flow { padding: 16px 15mm; }
    .q-part { display: grid; grid-template-columns: 0.94fr 1.06fr; break-inside: avoid; page-break-inside: avoid; }
    /* Older booklet rules for these class names must not add padding/rules between lines. */
    .q-part.q-row-item, .q-part.sol-row-item { padding: 0 !important; margin: 0 !important; border-bottom: 0 !important; }
    .q-part.q-last { border-bottom: 0.6px solid #bdbdbd !important; }
    .qp-cell { min-width: 0; color: #000; --q-indent: 1.9em; }
    .in-sol .qp-cell { --q-indent: 2.9em; }
    .qp-hi {
      padding-right: 10px; border-right: 1.5px solid #000;
      font-family: 'Noto Serif Devanagari', 'Mangal', 'Tinos', 'Times New Roman', serif;
      font-size: 12pt; line-height: 1.5;
    }
    .qp-en {
      padding-left: 10px;
      font-family: 'Tinos', 'Times New Roman', 'PT Serif', serif;
      font-size: 12.2pt; line-height: 1.4;
    }
    /* Everything but KaTeX inherits the line's font and size. */
    .qp-cell *:not(.katex *):not(.katex) { font-size: inherit; line-height: inherit; }
    .qp-cell .katex { font-size: 1.04em !important; line-height: 1.2 !important; }
    .q-stmt .qp-cell { display: flex; padding-top: 9px; }
    .q-num { flex: 0 0 var(--q-indent); font-weight: 700; }
    .q-num-box {
      display: inline-block; min-width: 1.9em; padding: 0 0.3em; text-align: center;
      border: 1.5px solid #000; border-radius: 3px; background: #e8eef7;
      font-family: 'Tinos', 'Times New Roman', serif; font-weight: 700; line-height: 1.25;
    }
    .q-body { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
    /* Figure, options and solution start at the statement's indent. */
    .q-fig .qp-hi, .q-opt .qp-hi, .q-sol .qp-hi { padding-left: var(--q-indent); }
    .q-fig .qp-en, .q-opt .qp-en, .q-sol .qp-en { padding-left: calc(10px + var(--q-indent)); }
    .q-fig .qp-cell { padding-top: 4px; }
    .q-opt .qp-cell { display: flex; align-items: baseline; gap: 0.5em; padding-top: 3px; }
    .opt-key { flex: 0 0 1.6em; }
    .q-opt .qp-cell:has(.opt-text img) { align-items: flex-start; }
    .opt-text { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
    /* Structures drawn as images were sized for a wide editor (e.g. 30%); never print them tiny. */
    .opt-text img { min-width: 55% !important; max-width: 100% !important; height: auto !important; margin: 3px 0 !important; }
    .q-body img, .q-fig img { max-width: 100% !important; height: auto !important; }
    .q-diagram-img { max-height: 220px !important; }
    .q-last .qp-cell { padding-bottom: 9px; }
    .q-last { border-bottom: 0.6px solid #bdbdbd; }

    /* Solution line */
    .q-sol .qp-cell { padding-top: 6px; }
    .q-sol-cont .qp-cell { padding-top: 1px; }
    .para-gap { display: block; height: 0.5em; }
    .sol-ans { font-weight: 700; }
    .sol-text { overflow-wrap: anywhere; text-align: left; }
    .sol-section-title {
      margin: 10px 0 2px; padding: 5px 8px; border: 1.5px solid #000; background: #f1f5f9; color: #000 !important;
      font-family: 'Montserrat', sans-serif; font-weight: 800; font-size: 11pt; text-align: center; letter-spacing: 0.5px;
    }

    /* Tables (match the column etc.): content-sized; fitWide() zooms any that are too wide. */
    .fx-table-wrap { overflow: visible !important; margin: 4px 0 !important; max-width: 100%; }
    table.fx-table { width: auto !important; max-width: none !important; border-collapse: collapse !important; font-size: 0.86em !important; line-height: 1.3 !important; margin: 0 !important; }
    table.fx-table td, table.fx-table th { border-color: #000000 !important; padding: 2px 6px !important; }

    /* Answer key: columns of 45 */
    .ak-block { padding: 2px 0 8px; }
    .ak-title { font-family: 'Montserrat', sans-serif; font-weight: 800; font-size: 12pt; text-align: center; margin-bottom: 4px; }
    .ak-title span { display: block; font-family: 'Tinos', 'Times New Roman', serif; font-weight: 700; font-size: 9.5pt; color: #333; }
    .ak-table { border-collapse: collapse; margin: 0 auto; font-family: 'Tinos', 'Times New Roman', serif; font-size: 9.5pt; line-height: 1; }
    .ak-table th, .ak-table td.ak-q, .ak-table td.ak-a { border: 1px solid #000; padding: 2px 10px; height: 16px; text-align: center; }
    .ak-table th { background: #e2e8f0; font-weight: 700; }
    .ak-table td.ak-q { font-weight: 700; background: #f8fafc; }
    .ak-table .ak-gap { width: 10px; border: 0; background: transparent; }
    .ak-table.ak-horizontal { margin: 0 auto 6px; }
    .ak-table.ak-horizontal th, .ak-table.ak-horizontal td.ak-q, .ak-table.ak-horizontal td.ak-a { padding: 3px 6px; min-width: 22px; }

    /* Website link in every footer (clickable in the saved PDF) */
    .site-link { color: #1d4ed8 !important; text-decoration: none; font-family: 'Tinos', 'Times New Roman', serif; font-weight: 700; }
    .footer-meta-row .footer-site { font-size: 8.5pt; }

    /* Solutions: Hindi | English share rows too. */
    .sol-row-item { break-inside: avoid; page-break-inside: avoid; }
    .sol-grid-two-col { display: grid !important; grid-template-columns: 1fr 1fr !important; grid-template-rows: repeat(4, auto); column-gap: 0 !important; }
    .sol-col-side { display: grid !important; grid-template-rows: subgrid; grid-row: span 4; min-width: 0; align-content: start; }
    .sol-side-hi { padding-right: 10px !important; border-right: 1px solid #94a3b8 !important; }
    .sol-side-en { padding-left: 10px !important; }
    .sol-diagram-cell { min-width: 0; }
    .sol-body-text, .sol-stmt-text { overflow-wrap: anywhere; text-align: left !important; }
    .solutions-page .page-running-footer, .answer-key-page .page-running-footer {
      display: flex !important; justify-content: space-between !important; align-items: center;
      border-top: 1px solid #000000; padding-top: 3px; margin-top: auto;
      font-family: 'Tinos', 'Times New Roman', 'PT Serif', serif; font-size: 7.5pt; font-weight: 700;
    }

    /* Screen toolbar */
    .print-toolbar {
      position: sticky; top: 0; z-index: 50;
      display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px;
      padding: 10px 16px; background: #0f172a; color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px;
    }
    .print-toolbar .pt-title { font-weight: 800; }
    .print-toolbar .pt-status { color: #94a3b8; }
    .print-toolbar .pt-btn {
      background: #2563eb; color: #fff; border: 0; border-radius: 10px; padding: 8px 16px;
      font-weight: 800; font-size: 13px; cursor: pointer;
    }
    .print-toolbar .pt-btn:disabled { opacity: 0.5; cursor: wait; }
    .print-toolbar .pt-hint { color: #94a3b8; flex-basis: 100%; }
${isDpp && options.dppCoverHtml ? DPP_COVER_CSS : ""}
  </style>
</head>
<body class="${isDpp ? "dpp-doc" : ""}">

  <!-- Screen-only toolbar. The PDF is made by the browser's own "Save as PDF"
       (real text, exact Hindi shaping and maths, small file) — not by
       screenshotting each page into a JPEG as before. -->
  <div class="print-toolbar no-print">
    <div class="pt-title">${test.name} · ${brandName}${withSolution ? " (Solutions)" : ""}</div>
    <div class="pt-status" id="pt-status">Preparing pages…</div>
    <button type="button" class="pt-btn" id="pt-print" disabled>Save as PDF</button>
    <div class="pt-hint">In the print window, choose <b>Save as PDF</b> as the destination.</div>
  </div>

  <div class="doc-container" id="doc-container">
    ${isDpp && options.dppCoverHtml ? options.dppCoverHtml : ""}${isDpp ? questionPagesHtml + (withSolution ? solutionsSectionHtml : "") : withSolution ? solutionsSectionHtml : frontCoverHtml + questionPagesHtml + finalRoughPagesHtml + backCoverHtml}
  </div>
  ${contentPageTemplateHtml}

  <script>
    (function () {
      var BRAND = ${JSON.stringify(brandHeaderHtml)};
      var AUTO_PRINT = ${autoPrint ? "true" : "false"};
      var SAFETY_PX = 8;

      // Page header, mirrored on odd/even pages like a printed booklet.
      function headerRow(n) {
        var brand = '<div class="test-header-brand">' + BRAND + '</div>';
        var num = '<div class="test-header-page-no">' + n + '</div>';
        var badge = '<div class="test-header-lang-badge">Hindi + English</div>';
        return n % 2 === 0 ? brand + num + badge : badge + num + brand;
      }

      // An equation or table wider than its column is shrunk (CSS zoom, so
      // its fixed-size cells shrink too) to fit instead of running into the
      // other language's column.
      function fitWide(root) {
        var els = root.querySelectorAll('.katex-display, .fx-table-wrap, .qp-cell table:not(.fx-table)');
        for (var i = 0; i < els.length; i++) {
          var el = els[i];
          el.style.zoom = '';
          // Room actually available: the parent's content box (clientWidth includes its padding/indent).
          var parent = el.parentElement;
          if (!parent) continue;
          var cs = getComputedStyle(parent);
          var box = parent.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
          if (!(box > 0) || el.scrollWidth <= box + 1) continue;
          // Zoomed content re-wraps, so re-measure until it really fits.
          var zoom = 1;
          for (var n = 0; n < 4 && el.scrollWidth * zoom > box; n++) {
            zoom = Math.max(0.4, Math.floor(zoom * ((box - 2) / (el.scrollWidth * zoom)) * 1000) / 1000);
            el.style.zoom = String(zoom);
          }
        }
      }

      function textHeight(el) {
        var r = document.createRange();
        r.selectNodeContents(el);
        return r.getBoundingClientRect().height;
      }
      function balanceRow(row) {
        if (!row.classList || !row.classList.contains('q-part') || row.classList.contains('q-fig')) return;
        var cells = row.querySelectorAll('.qp-cell');
        if (cells.length !== 2) return;
        var hi = cells[0], en = cells[1];
        var a = textHeight(hi), b = textHeight(en);
        var tall = b > a ? en : hi;
        var line = parseFloat(getComputedStyle(tall).lineHeight) || 20;
        if (Math.abs(b - a) < line * 0.6) return;
        var base = parseFloat(getComputedStyle(tall).fontSize);
        for (var step = 1; step <= 5; step++) {
          tall.style.fontSize = (base * (1 - 0.02 * step)) + 'px';
          if (Math.abs(textHeight(en) - textHeight(hi)) < line * 0.6) return;
        }
        tall.style.fontSize = '';
      }

      // Cuts a flow of question/solution rows into A4 pages by measured height.
      function paginateFlow(flow, templateId, subject) {
        var template = document.getElementById(templateId);
        if (!template) return;
        var items = Array.prototype.slice.call(flow.children);
        // Take the flow out of the document first: otherwise every measurement
        // re-lays out all the lines still waiting in it (minutes for 180 questions).
        var marker = document.createComment('flow');
        flow.parentNode.replaceChild(marker, flow);
        var page, stream, body, first = true;
        function newPage() {
          page = template.content.firstElementChild.cloneNode(true);
          // Header filled now (number fixed up later) so its height is final before measuring.
          var headerRowEl = page.querySelector('.test-header-row-1');
          if (headerRowEl) headerRowEl.innerHTML = headerRow(0);
          var subjectRow = page.querySelector('.test-header-subject-row');
          if (subjectRow) {
            if (first && subject) subjectRow.textContent = subject;
            else subjectRow.parentNode.removeChild(subjectRow);
          }
          first = false;
          marker.parentNode.insertBefore(page, marker);
          stream = page.querySelector('.questions-stream');
          body = page.querySelector('.content-body');
        }
        newPage();
        items.forEach(function (item) {
          stream.appendChild(item);
          fitWide(item);
          balanceRow(item);
          // A few px of slack: late font/KaTeX reflow must never push a row off the page.
          if (stream.offsetHeight <= body.clientHeight - SAFETY_PX) return;
          if (stream.children.length > 1) {
            // Keep headings / a question's statement with the line that
            // follows them — unless they'd fill most of a page by themselves.
            var carry = [];
            var carried = 0;
            var prev = item.previousElementSibling;
            while (prev && prev.classList.contains('keep-next') && carry.length + 1 < stream.children.length) {
              carried += prev.offsetHeight;
              if (carried > body.clientHeight * 0.45) { carry = []; break; }
              carry.unshift(prev);
              prev = prev.previousElementSibling;
            }
            newPage();
            carry.forEach(function (el) { stream.appendChild(el); });
            stream.appendChild(item);
          }
          // A single row taller than a whole page: let that page grow instead of clipping it.
          if (stream.offsetHeight > body.clientHeight - SAFETY_PX) page.classList.add('page-overflow');
        });
        marker.parentNode.removeChild(marker);
      }

      function renumber() {
        var pages = document.querySelectorAll('#doc-container > .a4-sheet, #doc-container > .page');
        var bookletPages = pages.length;
        for (var i = 0; i < pages.length; i++) {
          var n = i + 1;
          var row = pages[i].querySelector('.test-header-row-1');
          if (row) row.innerHTML = headerRow(n);
          var label = pages[i].querySelector('.js-sol-page-label');
          if (label) label.textContent = 'PAGE ' + n;
          if (pages[i].classList.contains('back-cover-page')) bookletPages = n;
        }
        var totals = document.querySelectorAll('.js-total-pages');
        for (var j = 0; j < totals.length; j++) totals[j].textContent = String(bookletPages);
        return pages.length;
      }

      function assetsReady() {
        var waits = [];
        if (document.fonts && document.fonts.ready) waits.push(document.fonts.ready);
        Array.prototype.forEach.call(document.images, function (img) {
          if (!img.complete) waits.push(new Promise(function (r) { img.onload = img.onerror = r; }));
        });
        // Never hang on a slow image/font: 8 s at most.
        return Promise.race([Promise.all(waits), new Promise(function (r) { setTimeout(r, 8000); })]);
      }

      function run() {
        assetsReady().then(function () {
          var flows = document.querySelectorAll('.q-flow');
          for (var i = 0; i < flows.length; i++) paginateFlow(flows[i], 'tpl-content-page', flows[i].getAttribute('data-subject'));
          var sol = document.querySelectorAll('.sol-flow');
          for (var k = 0; k < sol.length; k++) paginateFlow(sol[k], 'tpl-solutions-page', null);
          var total = renumber();
          window.__bookletPages = total;
          document.documentElement.classList.add('booklet-ready');
          var status = document.getElementById('pt-status');
          if (status) status.textContent = 'Ready · ' + total + ' pages';
          var btn = document.getElementById('pt-print');
          if (btn) {
            btn.disabled = false;
            btn.onclick = function () { window.print(); };
          }
          if (AUTO_PRINT) setTimeout(function () { window.print(); }, 400);
        });
      }

      if (document.readyState === 'complete') run();
      else window.addEventListener('load', run);
    })();
  </script>

</body>
</html>`;
}

/**
 * Generates only the authentic Front Cover Page as standalone HTML.
 */
export function generateTestCoverPageOnlyHtml(
  test: FormattedExportTest,
  options: TestExportOptions
): string {
  const fullHtml = generateTestPaperHtml(test, { ...options, withSolution: false });
  // Replace the document container to only contain the cover sheet
  const coverMatch = fullHtml.match(/<div class="a4-sheet border-2 border-slate-900 rounded-xs cover-page">[\s\S]*?<\/div>\s*<\/div>/);
  if (!coverMatch) return fullHtml;

  // Everything before the page container (the tag carries an id, so match the
  // prefix only — the old exact-tag split never matched and returned the
  // whole booklet), minus the print toolbar, which needs the booklet script.
  const headerPart = (fullHtml.split('<div class="doc-container"')[0] ?? "").replace(/<div class="print-toolbar no-print">[\s\S]*?<\/div>\s*<\/div>/, "");
  const footerPart = "</body>\n</html>";

  return `${headerPart}<div class="doc-container">\n${coverMatch[0]}\n</div>\n${footerPart}`;
}
