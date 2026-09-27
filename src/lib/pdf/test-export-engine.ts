import "server-only";
import { prisma } from "@/lib/db";
import { renderFormulaContent } from "@/lib/test-portal/formula";
import { exportCamDrawToSvgString, parseCamDrawDocument } from "@/lib/camdraw/renderer";

export interface TestExportOptions {
  withSolution: boolean;
  watermarkText?: string;
  brandName?: string;
  logoUrl?: string | null;
  targetCourse?: string;
  testPattern?: string;
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
  const { withSolution, brandName = "ATOMIC PATHSHALA" } = options;

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
          <div class="font-bold text-[9pt] mb-1">This Booklet contains ${actualTotalPages} pages. इस पुस्तिका में ${actualTotalPages} पृष्ठ हैं।</div>
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
                <div class="inst-point-text">इस प्रश्न पत्र के प्रत्येक विषय में 2 खण्ड हैं। खण्ड A में 35 प्रश्न हैं (सभी प्रश्न अनिवार्य हैं) तथा खण्ड B में 15 प्रश्न हैं। परीक्षार्थी इन 15 प्रश्नों में से कोई भी 10 प्रश्न कर सकता है। यदि परीक्षार्थी 10 से अधिक प्रश्न का उत्तर देता है तो हल किये हुए प्रथम 10 प्रश्न ही मान्य होंगे।</div>
              </div>
              <div class="inst-point-cell inst-cell-right">
                <span class="inst-point-num">3.</span>
                <div class="inst-point-text">In this Test Paper, each subject will consist of <strong>two sections</strong>. Section A will consist of 35 questions (all questions are mandatory) and Section B will have 15 questions. Candidate can choose to attempt any 10 question out of these 15 questions. In case if candidate attempts more than 10 questions, first 10 attempted questions will be considered for marking.</div>
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
        
        <div class="text-right text-[7.5pt] font-mono-code font-bold mt-1 text-slate-800">
          Page 1/${actualTotalPages}
        </div>
      </div>
    </div>
  `;

  // Render Questions Section-wise with Authentic Academic Two-Column Typesetting
  let pageCounter = 2;
  let questionPagesHtml = "";

  // Helper to format options
  const renderOptionItem = (opt: FormattedQuestionOption | undefined, idx: number, isHi: boolean) => {
    if (!opt) return "";
    const raw = isHi ? (opt.textHi || opt.textEn) : opt.textEn;
    const rendered = renderFormulaContent(raw);
    const label = `(${idx + 1})`;
    return `
      <div class="opt-box">
        <span class="opt-label">${label}</span>
        <span class="opt-value">${rendered}</span>
      </div>
    `;
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
        <div class="footer-phase-box">${test.batchName || "PHASE - ALL"}</div>
        <div class="footer-meta-row">
          <span class="footer-barcode">${test.code || "9610WMD801490250051"}</span>
          <span class="footer-date">${currentDateStr}</span>
        </div>
      </div>
    </div>
  `;
  };

  test.sections.forEach((section, sIdx) => {
    const pagesForSection = chunkQuestionsIntoPages(section.questions);

    pagesForSection.forEach((questionsInPage, pIdx) => {
      const questionsChunkHtml = questionsInPage.map((q) => {
        const statementEnHtml = renderFormulaContent(q.statementEn);
        const statementHiHtml = renderFormulaContent(q.statementHi);

        // Check if short options for 2x2 grid (matching Allen standard format)
        const isShort = q.options.every((opt) => {
          const lEn = (opt.textEn || "").length;
          const lHi = (opt.textHi || opt.textEn || "").length;
          return lEn <= 24 && lHi <= 24;
        });

        const optionsHiHtml = isShort && q.options.length === 4
          ? `<div class="opts-grid-2">
               ${renderOptionItem(q.options[0], 0, true)}
               ${renderOptionItem(q.options[1], 1, true)}
               ${renderOptionItem(q.options[2], 2, true)}
               ${renderOptionItem(q.options[3], 3, true)}
             </div>`
          : `<div class="opts-stacked">${q.options.map((opt, i) => renderOptionItem(opt, i, true)).join("")}</div>`;

        const optionsEnHtml = isShort && q.options.length === 4
          ? `<div class="opts-grid-2">
               ${renderOptionItem(q.options[0], 0, false)}
               ${renderOptionItem(q.options[1], 1, false)}
               ${renderOptionItem(q.options[2], 2, false)}
               ${renderOptionItem(q.options[3], 3, false)}
             </div>`
          : `<div class="opts-stacked">${q.options.map((opt, i) => renderOptionItem(opt, i, false)).join("")}</div>`;

        const diagramHi = q.camDrawSvg ? `
          <div class="q-diagram-wrap q-camdraw-wrap">
            ${q.camDrawSvg}
          </div>
        ` : q.imageUrl ? `
          <div class="q-diagram-wrap">
            <img src="${q.imageUrl}" alt="Diagram for Question ${q.number}" class="q-diagram-img" />
          </div>
        ` : "";

        const diagramEn = q.camDrawSvg ? `
          <div class="q-diagram-wrap q-camdraw-wrap">
            ${q.camDrawSvg}
          </div>
        ` : q.imageUrl ? `
          <div class="q-diagram-wrap">
            <img src="${q.imageUrl}" alt="Diagram for Question ${q.number}" class="q-diagram-img" />
          </div>
        ` : "";

        return `
          <div class="q-row-item" id="q-${q.number}">
            <!-- Left Column: Hindi -->
            <div class="q-side q-side-hi">
              <div class="q-head-statement">
                <span class="q-num-label">${q.number}.</span>
                <div class="q-statement-body">${statementHiHtml}</div>
              </div>
              ${diagramHi}
              <div class="q-opts-wrapper">
                ${optionsHiHtml}
              </div>
            </div>
            <!-- Right Column: English -->
            <div class="q-side q-side-en">
              <div class="q-head-statement">
                <span class="q-num-label">${q.number}.</span>
                <div class="q-statement-body">${statementEnHtml}</div>
              </div>
              ${diagramEn}
              <div class="q-opts-wrapper">
                ${optionsEnHtml}
              </div>
            </div>
          </div>
        `;
      }).join("");

      const isEven = pageCounter % 2 === 0;
      const headerRow1 = isEven ? `
        <div class="test-header-row-1">
          <div class="test-header-brand">${brandName}</div>
          <div class="test-header-page-no">${pageCounter}</div>
          <div class="test-header-lang-badge">Hindi + English</div>
        </div>
      ` : `
        <div class="test-header-row-1">
          <div class="test-header-lang-badge">Hindi + English</div>
          <div class="test-header-page-no">${pageCounter}</div>
          <div class="test-header-brand">${brandName}</div>
        </div>
      `;

      const subjectRowHtml = (pIdx === 0) ? `
        <div class="test-header-subject-row">
          SUBJECT : ${section.subject.toUpperCase()}
        </div>
      ` : "";

      const pageHeaderHtml = `
        <div class="test-page-header">
          ${headerRow1}
          ${subjectRowHtml}
          <div class="test-header-divider"></div>
        </div>
      `;

      questionPagesHtml += `
        <div class="page content-page">
          <!-- Light Subtle Background Watermark -->
          <div class="page-watermark">
            <div class="watermark-text">${brandName}</div>
          </div>

          ${pageHeaderHtml}
          
          <!-- Content Body Starts Directly With ZERO Gap -->
          <div class="content-body">
            <div class="questions-stream">
              ${questionsChunkHtml}
            </div>
          </div>

          <!-- Bottom Footer Matching Allen Booklet Standard -->
          <div class="page-running-footer">
            <div class="footer-phase-box">${test.batchName || "PHASE - ALL"}</div>
            <div class="footer-meta-row">
              <span class="footer-barcode">${test.code || "9610WMD801490250051"}</span>
              <span class="footer-date">${currentDateStr}</span>
            </div>
          </div>
        </div>
      `;

      pageCounter++;
    });

    // Dedicated Rough Page after this subject's questions are finished
    questionPagesHtml += renderSingleRoughPageHtml(pageCounter++, section.subject);
  });

  // Final End Rough Page before Back Cover / Answer Key
  const finalRoughPagesHtml = renderSingleRoughPageHtml(pageCounter++);
  const backCoverPageNo = pageCounter++;

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
            <span>Website: <strong>ap.atomicpathshala.com</strong></span>
            <span>·</span>
            <span>Support: <strong>atomic.pathshala.info@gmail.com</strong></span>
            <span>·</span>
            <span>Mobile : <strong>+917668543654</strong></span>
          </div>
        </div>
      </div>
    </div>
  `;

  // Optional: Answer Key Grid & Detailed Solutions
  let solutionsSectionHtml = "";
  if (withSolution) {
    const totalQ = test.allQuestions.length;
    const itemsPerCol = Math.ceil(totalQ / 4);
    const col1 = test.allQuestions.slice(0, itemsPerCol);
    const col2 = test.allQuestions.slice(itemsPerCol, itemsPerCol * 2);
    const col3 = test.allQuestions.slice(itemsPerCol * 2, itemsPerCol * 3);
    const col4 = test.allQuestions.slice(itemsPerCol * 3);

    let answerKeyRowsHtml = "";
    for (let r = 0; r < itemsPerCol; r++) {
      const q1 = col1[r];
      const q2 = col2[r];
      const q3 = col3[r];
      const q4 = col4[r];

      answerKeyRowsHtml += `
        <tr>
          <td class="ak-qno">${q1 ? `Q.${q1.number}` : ""}</td>
          <td class="ak-ans">${q1 ? `<strong>${q1.correctOptionKey}</strong>` : ""}</td>
          <td class="ak-sep"></td>
          <td class="ak-qno">${q2 ? `Q.${q2.number}` : ""}</td>
          <td class="ak-ans">${q2 ? `<strong>${q2.correctOptionKey}</strong>` : ""}</td>
          <td class="ak-sep"></td>
          <td class="ak-qno">${q3 ? `Q.${q3.number}` : ""}</td>
          <td class="ak-ans">${q3 ? `<strong>${q3.correctOptionKey}</strong>` : ""}</td>
          <td class="ak-sep"></td>
          <td class="ak-qno">${q4 ? `Q.${q4.number}` : ""}</td>
          <td class="ak-ans">${q4 ? `<strong>${q4.correctOptionKey}</strong>` : ""}</td>
        </tr>
      `;
    }

    const answerKeyPageHtml = `
      <div class="page answer-key-page">
        <div class="page-running-header">
          <span class="header-left">ANSWER KEY</span>
          <span class="header-center">${brandName} — ${test.name}</span>
          <span class="header-right">CODE : <strong>${test.code}</strong></span>
        </div>

        <div class="ak-header-banner">
          <div class="ak-main-title">OFFICIAL ANSWER KEY — ${test.examType}</div>
          <div class="ak-sub-title">Test Code: <strong>${test.code}</strong> | Total Questions: <strong>${totalQ}</strong> | Max Marks: <strong>${test.totalMarks}</strong></div>
        </div>

        <div class="ak-table-container">
          <table class="ak-grid-table">
            <thead>
              <tr>
                <th>Q.No</th>
                <th>Ans</th>
                <th class="ak-sep"></th>
                <th>Q.No</th>
                <th>Ans</th>
                <th class="ak-sep"></th>
                <th>Q.No</th>
                <th>Ans</th>
                <th class="ak-sep"></th>
                <th>Q.No</th>
                <th>Ans</th>
              </tr>
            </thead>
            <tbody>
              ${answerKeyRowsHtml}
            </tbody>
          </table>
        </div>

        <div class="page-running-footer">
          <span class="footer-left">${test.code}</span>
          <span class="footer-center">ANSWER KEY · ATOMIC PATHSHALA</span>
          <span class="footer-right">PHASE - ALL</span>
        </div>
      </div>
    `;

    const solutionsListHtml = test.sections.map((section) => {
      const solQuestionsHtml = section.questions.map((q) => {
        const stmtEnHtml = renderFormulaContent(q.statementEn || q.statementHi || "");
        const stmtHiHtml = renderFormulaContent(q.statementHi || q.statementEn || "");
        const solEnHtml = renderFormulaContent(q.solutionEn || q.solutionHi || "Detailed explanation provided as per standard textbook principles.");
        const solHiHtml = renderFormulaContent(q.solutionHi || q.solutionEn || "विस्तृत व्याख्या मानक पाठ्यपुस्तक सिद्धांतों के अनुसार प्रदान की गई है।");

        const diagramHi = q.camDrawSvg ? `
          <div class="sol-diagram-wrap sol-camdraw-wrap">
            ${q.camDrawSvg}
          </div>
        ` : q.imageUrl ? `
          <div class="sol-diagram-wrap">
            <img src="${q.imageUrl}" alt="Diagram for Q${q.number}" class="sol-diagram-img" />
          </div>
        ` : "";
        const diagramEn = q.camDrawSvg ? `
          <div class="sol-diagram-wrap sol-camdraw-wrap">
            ${q.camDrawSvg}
          </div>
        ` : q.imageUrl ? `
          <div class="sol-diagram-wrap">
            <img src="${q.imageUrl}" alt="Diagram for Q${q.number}" class="sol-diagram-img" />
          </div>
        ` : "";

        return `
          <div class="sol-row-item" id="sol-q-${q.number}">
            <div class="sol-item-header">
              <span class="sol-q-badge">Q.${q.number}</span>
              <span class="sol-correct-badge">Correct Answer: <strong>Option (${q.correctOptionKey})</strong></span>
              <span class="sol-subject-tag">${q.subject || section.subject}</span>
            </div>
            <div class="sol-grid-two-col">
              <!-- Left Column: Hindi -->
              <div class="sol-col-side sol-side-hi">
                ${stmtHiHtml ? `<div class="sol-stmt-text font-devanagari">${stmtHiHtml}</div>` : ""}
                ${diagramHi}
                <div class="sol-expl-heading font-devanagari">💡 हल एवं व्याख्या (Solution) :</div>
                <div class="sol-body-text font-devanagari">${solHiHtml}</div>
              </div>

              <!-- Right Column: English -->
              <div class="sol-col-side sol-side-en">
                ${stmtEnHtml ? `<div class="sol-stmt-text">${stmtEnHtml}</div>` : ""}
                ${diagramEn}
                <div class="sol-expl-heading">💡 Hint &amp; Step-by-Step Solution :</div>
                <div class="sol-body-text">${solEnHtml}</div>
              </div>
            </div>
          </div>
        `;
      }).join("");

      return `
        <div class="sol-section-group">
          <div class="sol-section-title">HINTS &amp; SOLUTIONS : ${section.subject.toUpperCase()} (${section.name.toUpperCase()})</div>
          ${solQuestionsHtml}
        </div>
      `;
    }).join("");

    const detailedSolutionsPageHtml = `
      <div class="page solutions-page">
        <div class="page-running-header">
          <span class="header-left">HINTS & SOLUTIONS</span>
          <span class="header-center">${brandName} — ${test.name}</span>
          <span class="header-right">CODE : <strong>${test.code}</strong></span>
        </div>

        <div class="content-body">
          <div class="sol-main-header">
            <h2>HINTS & STEP-BY-STEP SOLUTIONS</h2>
            <p>Comprehensive pedagogical explanations with formulas, derivations and concept breakdown.</p>
          </div>
          ${solutionsListHtml}
        </div>

        <div class="page-running-footer">
          <span class="footer-left">${test.code}</span>
          <span class="footer-center">HINTS & SOLUTIONS · ATOMIC PATHSHALA</span>
          <span class="footer-right">END OF SOLUTIONS</span>
        </div>
      </div>
    `;

    solutionsSectionHtml = answerKeyPageHtml + detailedSolutionsPageHtml;
  }

  // Full Document Assembly
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${test.name} - ${currentDateStr} - ATOMIC PATHSHALA</title>
  
  <!-- Tailwind CSS Engine for Exact Aesthetic Rendering -->
  <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css" crossorigin="anonymous">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=PT+Serif:ital,wght@0,400;0,700;1,400;1,700&family=Noto+Serif+Devanagari:wght@400;500;600;700;800&family=Montserrat:wght@700;800;900&family=JetBrains+Mono:wght@600;700&display=swap" rel="stylesheet">

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
      font-family: 'Times New Roman', 'PT Serif', 'Noto Serif Devanagari', 'Mangal', serif;
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
      font-family: 'Times New Roman', 'PT Serif', serif;
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
      font-family: 'Times New Roman', 'PT Serif', serif;
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

    .test-header-brand {
      font-family: 'Montserrat', sans-serif;
      font-size: 14pt;
      font-weight: 900;
      letter-spacing: 0.5px;
      color: #000000;
    }

    .test-header-page-no {
      font-family: 'Times New Roman', 'PT Serif', serif;
      font-size: 12.5pt;
      font-weight: 700;
      color: #000000;
    }

    .test-header-lang-badge {
      border: 1px solid #000000;
      padding: 1px 8px;
      font-family: 'Times New Roman', 'PT Serif', serif;
      font-size: 8pt;
      font-weight: 700;
      color: #000000;
      background: #ffffff;
    }

    .test-header-subject-row {
      text-align: center;
      font-family: 'Times New Roman', 'PT Serif', serif;
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
    .q-side-en span {
      font-family: 'Times New Roman', 'PT Serif', 'Nimbus Roman No9 L', 'FreeSerif', 'Liberation Serif', serif !important;
    }

    .q-side-hi,
    .q-side-hi .q-statement-body,
    .q-side-hi .opt-value,
    .q-side-hi p,
    .q-side-hi span {
      font-family: 'Noto Serif Devanagari', 'Mangal', 'Kokila', 'Times New Roman', 'PT Serif', serif !important;
    }

    .q-statement-body,
    .q-statement-body p,
    .q-statement-body span,
    .opt-value,
    .opt-value p,
    .opt-value span {
      font-size: 10pt !important;
      font-weight: 400 !important;
      line-height: 1.36 !important;
      color: #000000 !important;
    }

    .q-num-label {
      font-family: 'Times New Roman', 'PT Serif', serif !important;
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
      font-family: 'Times New Roman', 'PT Serif', serif !important;
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
    .page-running-footer {
      margin-top: auto;
      padding-top: 2px;
      width: 100%;
    }

    .footer-phase-box {
      border: 1px solid #000000;
      padding: 1px 6px;
      font-family: 'Times New Roman', 'PT Serif', serif;
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
      font-family: 'Times New Roman', 'PT Serif', serif;
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
      font-family: 'Times New Roman', 'PT Serif', serif;
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
      font-family: 'Times New Roman', 'PT Serif', serif;
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
    .page.solutions-page {
      display: block !important;
      height: auto !important;
      min-height: 1123px;
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
      font-family: 'Times New Roman', 'PT Serif', serif;
      font-size: 9.5pt;
      font-weight: 800;
      background: #0f172a;
      color: #ffffff;
      padding: 1px 7px;
      border-radius: 3px;
    }
    .sol-correct-badge {
      font-family: 'Times New Roman', 'PT Serif', serif;
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
      font-family: 'Noto Serif Devanagari', 'Mangal', 'Times New Roman', serif;
      font-size: 9pt;
      line-height: 1.35;
      color: #334155;
      margin-bottom: 5px;
      text-align: justify;
    }
    .sol-expl-heading {
      font-family: 'Noto Serif Devanagari', 'Mangal', 'Times New Roman', serif;
      font-size: 8.5pt;
      font-weight: 700;
      color: #1e40af;
      margin-top: 2px;
      margin-bottom: 3px;
    }
    .sol-body-text {
      font-family: 'Noto Serif Devanagari', 'Mangal', 'Times New Roman', serif;
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
      font-family: 'Noto Serif Devanagari', 'Mangal', 'Times New Roman', serif !important;
    }
  </style>
</head>
<body>

  <div id="pdf-download-overlay" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.96); z-index: 999999; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; backdrop-filter: blur(8px);">
    <div style="background: #1e293b; padding: 36px 40px; border-radius: 24px; border: 1px solid #334155; text-align: center; max-width: 440px; width: 90%; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
      <div style="font-size: 42px; margin-bottom: 12px; animation: bounce 1s infinite alternate;">📥</div>
      <h2 style="margin: 0 0 6px 0; font-size: 19px; font-weight: 800; color: #ffffff;">Downloading Test Booklet PDF...</h2>
      <p style="margin: 0 0 16px 0; font-size: 12px; color: #94a3b8; line-height: 1.4;">${test.name}</p>
      
      <div style="width: 100%; height: 10px; background: #0f172a; border-radius: 999px; overflow: hidden; margin-bottom: 12px; border: 1px solid #334155;">
        <div id="pdf-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #3b82f6, #10b981); transition: width 0.12s ease;"></div>
      </div>
      <div id="pdf-progress-text" style="font-size: 12px; font-weight: 700; color: #60a5fa;">Preparing booklet pages (0%)...</div>
      <div style="font-size: 10.5px; color: #64748b; margin-top: 10px;">File name: ${test.name} - ${currentDateStr} - ATOMIC PATHSHALA.pdf</div>
    </div>
  </div>

  <div class="doc-container" id="doc-container">
    ${frontCoverHtml}
    ${questionPagesHtml}
    ${finalRoughPagesHtml}
    ${backCoverHtml}
    ${solutionsSectionHtml}
  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>

  <script>
    async function autoCompileAndDownloadPdf() {
      try {
        if (!window.jspdf || !window.html2canvas) {
          console.error("PDF libraries not loaded yet, retrying...");
          setTimeout(autoCompileAndDownloadPdf, 500);
          return;
        }

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
          compress: true
        });

        const pages = document.querySelectorAll('.a4-sheet, .page');
        const total = pages.length;
        const progressBar = document.getElementById('pdf-progress-bar');
        const progressText = document.getElementById('pdf-progress-text');

        for (let i = 0; i < total; i++) {
          const pageEl = pages[i];
          const pct = Math.round(((i + 1) / total) * 100);
          if (progressBar) progressBar.style.width = pct + '%';
          if (progressText) progressText.innerText = 'Processing Page ' + (i + 1) + ' of ' + total + ' (' + pct + '%)...';

          const canvas = await html2canvas(pageEl, {
            scale: 1.6, // crisp resolution while keeping file size ~2-3 MB (<5MB)
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
          });

          const imgData = canvas.toDataURL('image/jpeg', 0.90);
          if (i > 0) {
            pdf.addPage('a4', 'portrait');
          }
          pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
        }

        if (progressText) progressText.innerText = '✅ Saving PDF file...';

        const safeTitle = "${test.name}".replace(/[/\\\\?%*:|"<>]/g, '-').trim();
        const fileName = safeTitle + " - ${currentDateStr} - ATOMIC PATHSHALA${withSolution ? ' (Solutions)' : ''}.pdf";
        pdf.save(fileName);

        setTimeout(function() {
          const overlay = document.getElementById('pdf-download-overlay');
          if (overlay) {
            overlay.innerHTML = '<div style="background: #1e293b; padding: 28px 36px; border-radius: 24px; text-align: center; border: 1.5px solid #10b981; max-width: 420px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">' +
              '<div style="font-size: 38px; margin-bottom: 8px;">✅</div>' +
              '<h3 style="margin:0; color:#34d399; font-size:18px; font-weight:800;">PDF Downloaded Successfully!</h3>' +
              '<p style="margin:8px 0 16px 0; font-size:12px; color:#94a3b8; word-break:break-all;">' + fileName + '</p>' +
              '<div style="display:flex; justify-content:center; gap:10px;">' +
                '<button onclick="autoCompileAndDownloadPdf()" style="background:#334155; hover:bg:#475569; color:white; border:none; padding:8px 16px; border-radius:10px; cursor:pointer; font-weight:700; font-size:12px;">Re-Download</button>' +
                '<button onclick="window.close()" style="background:#10b981; color:white; border:none; padding:8px 20px; border-radius:10px; cursor:pointer; font-weight:700; font-size:12px;">Close</button>' +
              '</div>' +
            '</div>';
          }
        }, 500);
      } catch (err) {
        console.error("PDF generation error:", err);
        const progressText = document.getElementById('pdf-progress-text');
        if (progressText) {
          progressText.innerText = "⚠️ Generation error. Click Re-Download to retry.";
        }
      }
    }

    // Auto-trigger direct PDF compilation immediately after fonts and KaTeX render
    window.addEventListener('load', function() {
      setTimeout(autoCompileAndDownloadPdf, 400);
    });
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

  const headerPart = fullHtml.split('<div class="doc-container">')[0];
  const footerPart = "</body>\n</html>";

  return `${headerPart}<div class="doc-container">\n${coverMatch[0]}\n</div>\n${footerPart}`;
}
