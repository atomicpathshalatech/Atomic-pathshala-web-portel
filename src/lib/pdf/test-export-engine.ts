import "server-only";
import { prisma } from "@/lib/db";
import { renderFormulaContent } from "@/lib/test-portal/formula";

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
}

export interface FormattedExportSection {
  id: string;
  name: string;
  subject: string;
  order: number;
  targetCount: number;
  marksPerQuestion: number;
  negativeMarks: number;
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
    const questions: FormattedExportQuestion[] = section.questions.map((sq) => {
      globalQuestionNumber++;
      const q = sq.question;
      const enTrans = q.translations.find((t) => t.language === "ENGLISH" || t.language === "en") || q.translations[0];
      const hiTrans = q.translations.find((t) => t.language === "HINDI" || t.language === "hi") || enTrans;

      const { options, correctKey, correctLabel } = normalizeOptions(
        enTrans?.options,
        hiTrans?.options,
        enTrans?.correctOptionIds || hiTrans?.correctOptionIds
      );

      const imageUrl = q.imageUrl || q.assets?.find((a) => a.type === "DIAGRAM" || a.type === "REFERENCE")?.publicUrl;

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
        imageUrl: imageUrl || null,
      };

      allQuestions.push(formattedQ);
      return formattedQ;
    });

    return {
      id: section.id,
      name: section.name,
      subject: section.subject,
      order: section.order,
      targetCount: section.targetCount || questions.length,
      marksPerQuestion: section.marksPerQuestion ?? test.correctMarks ?? 4,
      negativeMarks: section.negativeMarks ?? Math.abs(test.incorrectMarks ?? 1),
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
      syllabus: defaultSyllabus,
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

  // Helper to chunk questions into authentic pages of 3-4 questions each (matching ALLEN density)
  function chunkQuestionsIntoPages(questions: FormattedExportQuestion[], maxWeight = 4): FormattedExportQuestion[][] {
    const chunks: FormattedExportQuestion[][] = [];
    let currentChunk: FormattedExportQuestion[] = [];
    let currentWeight = 0;

    for (const q of questions) {
      let weight = 1.0;
      if (q.imageUrl) weight += 0.5;
      if ((q.statementEn && q.statementEn.length > 220) || (q.statementHi && q.statementHi.length > 220)) weight += 0.4;
      
      if (currentChunk.length > 0 && currentWeight + weight > maxWeight) {
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
    totalQuestionPagesCount += chunkQuestionsIntoPages(sec.questions, 4).length;
  });

  const intermediateRoughCount = test.sections.length >= 3 ? 1 : 0;
  const finalRoughCount = 2;
  const backCoverCount = 1;
  const solutionsPagesCount = withSolution ? 1 + Math.ceil(test.totalQuestions / 6) : 0;
  const actualTotalPages = 1 + totalQuestionPagesCount + intermediateRoughCount + finalRoughCount + backCoverCount + solutionsPagesCount;

  // Render Front Cover (Exact User-Specified Authentic Layout)
  const frontCoverHtml = `
    <div class="a4-sheet border-2 border-slate-900 rounded-xs cover-sheet">
      <div class="flex flex-col gap-3">
        <!-- TOP META BAR: CONFIDENTIAL STRIP -->
        <div class="flex items-center justify-between border-b-2 border-slate-900 pb-1 text-[9px] tracking-wider uppercase font-semibold text-slate-700 font-mono-code">
          <div class="flex items-center gap-2">
            <span class="bg-slate-900 text-white px-2 py-0.5 rounded-xs font-bold text-[8.5px] tracking-wide">STRICTLY CONFIDENTIAL</span>
            <span class="font-bold text-red-600">DO NOT OPEN UNTIL INSTRUCTED</span>
          </div>
          <div class="flex items-center gap-4">
            <span>BOOKLET SERIES: <strong class="text-slate-950 font-bold text-[10px] bg-slate-100 px-1.5 py-0.5 border border-slate-300">${bookletSeries}</strong></span>
            <span>FORM NO: <strong class="text-slate-950 font-bold text-[10px]">${formNumber}</strong></span>
          </div>
        </div>

        <!-- MAIN HEADER WITH ATOMIC PATHSHALA BRANDING -->
        <div class="flex items-center justify-between pb-2 border-b border-slate-300">
          <!-- Logo and Brand Info -->
          <div class="flex items-center gap-3">
            <img alt="Atomic Pathshala Logo" class="w-14 h-14 object-contain rounded-sm border border-slate-200 p-0.5 bg-white shadow-xs" src="${logoUrl}" />
            <div>
              <h1 class="font-heading font-black text-[22px] tracking-tight text-slate-900 leading-none">
                ATOMIC <span class="text-[#0284c7]">PATHSHALA</span>
              </h1>
              <p class="text-[9.5px] font-bold tracking-[0.18em] text-slate-700 uppercase mt-1">LEARN • EXPLORE • EXCEL</p>
            </div>
          </div>
          <!-- Series Emblem Badge -->
          <div class="text-right flex flex-col items-end">
            <div class="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-50 border border-sky-300 rounded-[3px]">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span class="font-heading font-extrabold text-[11px] text-sky-950 tracking-wider">ALL INDIA TEST SERIES (${test.examType || "NEET UG"})</span>
            </div>
            <div class="mt-1 text-[9px] font-bold text-slate-700 tracking-wide font-heading">
              NEET (UG) | JEE (MAIN+ADV) | FOUNDATION
            </div>
            <div class="text-[8px] text-slate-500 font-mono-code mt-0.5">
              EXAM ID: <span class="text-slate-900 font-bold">${test.code}</span>
            </div>
          </div>
        </div>

        <!-- EXAM TITLE BANNER -->
        <div class="text-center py-2 bg-slate-50 border border-slate-300 rounded-sm">
          <div class="text-[8.5px] font-extrabold uppercase tracking-[0.25em] text-[#0284c7]">
            TARGET MEDICAL ENTRANCE EXAMINATION
          </div>
          <h2 class="font-heading font-black text-[18px] tracking-wide text-slate-950 uppercase leading-tight my-0.5">
            ${test.name.toUpperCase()}
          </h2>
          <div class="flex items-center justify-center gap-2 text-[10px] font-bold text-slate-700 font-mono-code">
            <span>${test.examType || "NEET UG"}</span>
            <span>•</span>
            <span class="text-[#0284c7]">TEST SERIES 2026</span>
            <span>•</span>
            <span>COMPREHENSIVE LEVEL 1</span>
          </div>
        </div>

        <!-- EXAM METRIC GRID -->
        <div class="border border-slate-900 rounded-xs overflow-hidden">
          <div class="grid grid-cols-4 bg-white text-center divide-x divide-slate-800 border-b border-slate-800">
            <div class="py-1.5 px-2">
              <div class="text-[7.5px] uppercase tracking-wider font-bold text-slate-500">Course Target</div>
              <div class="font-heading font-extrabold text-[11px] text-slate-900">${test.examType || "NEET UG"}</div>
            </div>
            <div class="py-1.5 px-2 bg-sky-50/50">
              <div class="text-[7.5px] uppercase tracking-wider font-bold text-slate-500">Test Pattern</div>
              <div class="font-heading font-extrabold text-[11px] text-[#0369a1]">FULL SYLLABUS</div>
            </div>
            <div class="py-1.5 px-2">
              <div class="text-[7.5px] uppercase tracking-wider font-bold text-slate-500">Duration</div>
              <div class="font-heading font-extrabold text-[11px] text-slate-900">${test.durationMin} MINUTES (${(test.durationMin / 60).toFixed(1)} Hrs)</div>
            </div>
            <div class="py-1.5 px-2 bg-slate-50">
              <div class="text-[7.5px] uppercase tracking-wider font-bold text-slate-500">Maximum Marks</div>
              <div class="font-heading font-black text-[12px] text-slate-950">${test.totalMarks} MARKS</div>
            </div>
          </div>
        </div>

        <!-- TEST COVERAGE SECTION -->
        <div class="border border-slate-900 rounded-xs overflow-hidden">
          <div class="bg-slate-900 text-white px-3 py-1 flex items-center justify-between">
            <span class="font-heading font-bold text-[9.5px] tracking-wider uppercase">TEST SYLLABUS &amp; SUBJECT BREAKDOWN</span>
            <span class="text-[8px] font-mono-code text-sky-300 font-semibold">TOTAL: ${test.totalMarks} MARKS • ${test.totalQuestions} QUESTIONS</span>
          </div>

          <div class="grid grid-cols-${Math.min(sectionBreakdowns.length, 4) || 3} divide-x divide-slate-300 bg-white text-slate-800 text-[10px]">
            ${sectionBreakdownColsHtml}
          </div>
        </div>

        <!-- IMPORTANT INSTRUCTIONS FOR CANDIDATES (8-ITEM DUAL COLUMN) -->
        <div class="border border-slate-900 rounded-xs bg-slate-50/70 p-3.5">
          <div class="flex items-center justify-between border-b border-slate-400 pb-1.5 mb-2.5">
            <div class="font-heading font-extrabold text-[12px] text-slate-950 uppercase flex items-center gap-2">
              <span class="w-2.5 h-4 bg-[#0284c7] inline-block rounded-[1px]"></span>
              IMPORTANT INSTRUCTIONS FOR CANDIDATES / परीक्षार्थियों के लिए महत्वपूर्ण निर्देश
            </div>
            <span class="text-[9px] font-bold text-slate-700 font-mono-code tracking-wider">[READ CAREFULLY BEFORE ATTEMPTING]</span>
          </div>
          <ol class="grid grid-cols-2 gap-x-6 gap-y-3 text-[11.5px] leading-snug text-slate-900">
            <li class="flex items-start gap-2">
              <span class="font-mono-code font-extrabold text-slate-950 text-[13px] shrink-0">1.</span>
              <div>
                <div class="font-semibold text-slate-950">The test booklet contains <strong>${test.totalQuestions} multiple-choice questions</strong> (${enSectionRange}).</div>
                <div class="text-slate-700 mt-0.5 text-[10.5px] leading-tight font-medium">प्रश्न पुस्तिका में ${test.totalQuestions} बहुविकल्पीय प्रश्न हैं (${hiSectionRange})।</div>
              </div>
            </li>
            <li class="flex items-start gap-2">
              <span class="font-mono-code font-extrabold text-slate-950 text-[13px] shrink-0">2.</span>
              <div>
                <div class="font-semibold text-slate-950">Each correct answer carries <strong>${test.correctMarks} marks (+${test.correctMarks})</strong>. Total maximum marks: <strong>${test.totalMarks}</strong>.</div>
                <div class="text-slate-700 mt-0.5 text-[10.5px] leading-tight font-medium">प्रत्येक सही उत्तर के लिए ${test.correctMarks} अंक (+${test.correctMarks}) दिए जाएंगे। कुल अधिकतम अंक: ${test.totalMarks}।</div>
              </div>
            </li>
            <li class="flex items-start gap-2">
              <span class="font-mono-code font-extrabold text-slate-950 text-[13px] shrink-0">3.</span>
              <div>
                <div class="font-semibold text-slate-950"><strong>${Math.abs(test.incorrectMarks)} mark will be deducted</strong> for each incorrect response (-${Math.abs(test.incorrectMarks)}). No penalty for unattempted questions.</div>
                <div class="text-slate-700 mt-0.5 text-[10.5px] leading-tight font-medium">प्रत्येक गलत उत्तर के लिए ${Math.abs(test.incorrectMarks)} अंक (-${Math.abs(test.incorrectMarks)}) काटा जाएगा। अनुत्तरित प्रश्नों के लिए कोई अंक नहीं काटा जाएगा।</div>
              </div>
            </li>
            <li class="flex items-start gap-2">
              <span class="font-mono-code font-extrabold text-slate-950 text-[13px] shrink-0">4.</span>
              <div>
                <div class="font-semibold text-slate-950">Duration of the examination is <strong>${test.durationMin} minutes (${(test.durationMin / 60).toFixed(1)} Hours)</strong>.</div>
                <div class="text-slate-700 mt-0.5 text-[10.5px] leading-tight font-medium">परीक्षा की कुल अवधि ${test.durationMin} मिनट (${(test.durationMin / 60).toFixed(1)} घंटे) है।</div>
              </div>
            </li>
            <li class="flex items-start gap-2">
              <span class="font-mono-code font-extrabold text-slate-950 text-[13px] shrink-0">5.</span>
              <div>
                <div class="font-semibold text-slate-950">Use <strong>Blue or Black Ballpoint Pen only</strong> for writing details and darkening OMR circles.</div>
                <div class="text-slate-700 mt-0.5 text-[10.5px] leading-tight font-medium">विवरण भरने एवं OMR गोले काले/नीले करने के लिए केवल नीले या काले बॉलपॉइंट पेन का उपयोग करें।</div>
              </div>
            </li>
            <li class="flex items-start gap-2">
              <span class="font-mono-code font-extrabold text-slate-950 text-[13px] shrink-0">6.</span>
              <div>
                <div class="font-semibold text-slate-950">Darken only one circle completely for each question. Rough work must be done only in the booklet.</div>
                <div class="text-slate-700 mt-0.5 text-[10.5px] leading-tight font-medium">प्रत्येक प्रश्न के लिए केवल एक वृत्त को पूरी तरह से गहरा करें। रफ कार्य केवल पुस्तिका में दिए गए स्थान पर करें।</div>
              </div>
            </li>
            <li class="flex items-start gap-2">
              <span class="font-mono-code font-extrabold text-slate-950 text-[13px] shrink-0">7.</span>
              <div>
                <div class="font-semibold text-slate-950">Verify that your Test Booklet Code and OMR Answer Sheet Code match before attempting.</div>
                <div class="text-slate-700 mt-0.5 text-[10.5px] leading-tight font-medium">प्रश्न हल करने से पहले सुनिश्चित करें कि आपकी टेस्ट बुकलेट कोड और OMR शीट कोड समान हैं।</div>
              </div>
            </li>
            <li class="flex items-start gap-2">
              <span class="font-mono-code font-extrabold text-slate-950 text-[13px] shrink-0">8.</span>
              <div>
                <div class="font-semibold text-slate-950">Electronic devices, calculators, and mobile phones are strictly prohibited in the examination hall.</div>
                <div class="text-slate-700 mt-0.5 text-[10.5px] leading-tight font-medium">परीक्षा कक्ष में इलेक्ट्रॉनिक उपकरण, कैलकुलेटर एवं मोबाइल फोन पूर्णतः वर्जित हैं।</div>
              </div>
            </li>
          </ol>
        </div>

        <!-- CANDIDATE & EXAMINATION RECORD SECTION -->
        <div class="border-2 border-slate-900 rounded-xs p-3 bg-white">
          <div class="flex items-center justify-between border-b border-slate-300 pb-1.5 mb-2.5">
            <div class="flex items-center gap-2">
              <span class="bg-slate-900 text-white text-[8px] px-2 py-0.5 rounded-xs font-mono-code font-bold tracking-wide">MANDATORY</span>
              <span class="font-heading font-extrabold text-[11px] text-slate-950 uppercase tracking-wider">CANDIDATE &amp; EXAMINATION RECORD</span>
            </div>
            <span class="text-[8px] text-slate-500 italic font-medium">Fill in using Blue/Black Ballpoint Pen only</span>
          </div>
          <div class="space-y-2.5 text-[11px] mb-3">
            <div class="flex items-baseline">
              <span class="font-bold text-slate-900 w-40 shrink-0">Student's Full Name:</span>
              <span class="fill-line"></span>
            </div>
            <div class="grid grid-cols-2 gap-6">
              <div class="flex items-baseline">
                <span class="font-bold text-slate-900 w-40 shrink-0">Roll / Enrolment No.:</span>
                <span class="fill-line"></span>
              </div>
              <div class="flex items-baseline">
                <span class="font-bold text-slate-900 w-32 shrink-0">OMR Sheet No.:</span>
                <span class="fill-line"></span>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-6">
              <div class="flex items-baseline">
                <span class="font-bold text-slate-900 w-40 shrink-0">Batch Name:</span>
                <span class="fill-line"></span>
              </div>
              <div class="flex items-baseline">
                <span class="font-bold text-slate-900 w-32 shrink-0">Center Code:</span>
                <span class="fill-line"></span>
              </div>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-6 pt-2 border-t border-slate-200">
            <div class="flex flex-col items-center">
              <div class="w-full h-14 border border-dashed border-slate-400 rounded-xs bg-slate-50/60"></div>
              <span class="text-[9.5px] font-bold text-slate-900 mt-1 uppercase font-mono-code tracking-wider">CANDIDATE'S SIGNATURE</span>
            </div>
            <div class="flex flex-col items-center">
              <div class="w-full h-14 border border-dashed border-slate-400 rounded-xs bg-slate-50/60"></div>
              <span class="text-[9.5px] font-bold text-slate-900 mt-1 uppercase font-mono-code tracking-wider">INVIGILATOR'S SIGNATURE &amp; STAMP</span>
            </div>
          </div>
        </div>
      </div>

      <!-- CLEAN AUTHENTIC FOOTER -->
      <div class="pt-2 border-t-2 border-slate-900 mt-2">
        <div class="flex items-center justify-between text-[8.5px] text-slate-600 font-mono-code">
          <div class="flex items-center gap-2">
            <strong class="text-slate-900 font-heading font-extrabold text-[9.5px]">ATOMIC PATHSHALA</strong>
            <span class="text-slate-400">•</span>
            <span>Official Test Booklet</span>
            <span class="text-slate-400">•</span>
            <span class="font-bold text-slate-800">${test.examType || "NEET-UG"}</span>
          </div>
          <div class="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 border border-slate-300">
            PAGE 1 OF ${actualTotalPages} (COVER)
          </div>
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

  test.sections.forEach((section, sIdx) => {
    const pagesForSection = chunkQuestionsIntoPages(section.questions, 4.0);

    pagesForSection.forEach((questionsInPage) => {
      const questionsChunkHtml = questionsInPage.map((q) => {
        const statementEnHtml = renderFormulaContent(q.statementEn);
        const statementHiHtml = renderFormulaContent(q.statementHi);

        // Check if short options for 2x2 grid (matching Image 1)
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

        const diagramHi = q.imageUrl ? `
          <div class="q-diagram-wrap">
            <img src="${q.imageUrl}" alt="Diagram for Question ${q.number}" class="q-diagram-img" />
          </div>
        ` : "";

        const diagramEn = q.imageUrl ? `
          <div class="q-diagram-wrap">
            <img src="${q.imageUrl}" alt="Diagram for Question ${q.number}" class="q-diagram-img" />
          </div>
        ` : "";

        return `
          <div class="q-row-item" id="q-${q.number}">
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

      questionPagesHtml += `
        <div class="page content-page">
          <!-- Top Header: Brand, Page Number, [Hindi + English], Subject -->
          <div class="test-page-header">
            <div class="test-header-row-1">
              <div class="test-header-brand">${brandName}</div>
              <div class="test-header-page-no">${pageCounter}</div>
              <div class="test-header-lang-badge">Hindi + English</div>
            </div>
            <div class="test-header-subject-row">
              SUBJECT : ${section.subject.toUpperCase()}${section.name && section.name.toLowerCase() !== section.subject.toLowerCase() ? ` (${section.name.toUpperCase()})` : ""}
            </div>
            <div class="test-header-divider"></div>
          </div>
          
          <!-- Content Body Starts Directly With ZERO Gap -->
          <div class="content-body">
            <div class="questions-stream">
              ${questionsChunkHtml}
            </div>
          </div>

          <!-- Bottom Footer Matching Official Test Booklet -->
          <div class="page-running-footer">
            <div class="footer-phase-box">PHASE - ALL</div>
            <div class="footer-meta-row">
              <span class="footer-barcode">${test.code || "AP-TEST-BOOKLET"}</span>
              <span class="footer-rough-note">SPACE FOR ROUGH WORK / रफ कार्य के लिए जगह</span>
              <span class="footer-date">${currentDateStr}</span>
            </div>
          </div>
        </div>
      `;

      pageCounter++;
    });

    // Add intermediate rough page after middle section if >= 3 sections
    if (sIdx === 1 && test.sections.length >= 3) {
      questionPagesHtml += `
        <div class="page rough-page">
          <div class="test-page-header">
            <div class="test-header-row-1">
              <div class="test-header-brand">${brandName}</div>
              <div class="test-header-page-no">${pageCounter}</div>
              <div class="test-header-lang-badge">Hindi + English</div>
            </div>
            <div class="test-header-subject-row">
              SPACE FOR ROUGH WORK / रफ कार्य के लिए जगह
            </div>
            <div class="test-header-divider"></div>
          </div>
          <div class="rough-page-content">
            <div class="rough-watermark">SPACE FOR ROUGH WORK / रफ कार्य के लिए जगह</div>
            <div class="rough-grid-canvas"></div>
          </div>
          <div class="page-running-footer">
            <div class="footer-phase-box">PHASE - ALL</div>
            <div class="footer-meta-row">
              <span class="footer-barcode">${test.code}</span>
              <span class="footer-rough-note">SPACE FOR ROUGH WORK</span>
              <span class="footer-date">${currentDateStr}</span>
            </div>
          </div>
        </div>
      `;
      pageCounter++;
    }
  });

  // Dedicated End-of-Paper Rough Pages (2 Pages)
  const roughPage1No = pageCounter++;
  const roughPage2No = pageCounter++;
  const backCoverPageNo = pageCounter++;

  const finalRoughPagesHtml = `
    <div class="page rough-page">
      <div class="test-page-header">
        <div class="test-header-row-1">
          <div class="test-header-brand">${brandName}</div>
          <div class="test-header-page-no">${roughPage1No}</div>
          <div class="test-header-lang-badge">Hindi + English</div>
        </div>
        <div class="test-header-subject-row">
          SPACE FOR ROUGH WORK / रफ कार्य के लिए जगह
        </div>
        <div class="test-header-divider"></div>
      </div>
      <div class="rough-page-content">
        <div class="rough-watermark">SPACE FOR ROUGH WORK / रफ कार्य के लिए जगह</div>
        <div class="rough-grid-canvas"></div>
      </div>
      <div class="page-running-footer">
        <div class="footer-phase-box">PHASE - ALL</div>
        <div class="footer-meta-row">
          <span class="footer-barcode">${test.code}</span>
          <span class="footer-rough-note">SPACE FOR ROUGH WORK</span>
          <span class="footer-date">${currentDateStr}</span>
        </div>
      </div>
    </div>

    <div class="page rough-page">
      <div class="test-page-header">
        <div class="test-header-row-1">
          <div class="test-header-brand">${brandName}</div>
          <div class="test-header-page-no">${roughPage2No}</div>
          <div class="test-header-lang-badge">Hindi + English</div>
        </div>
        <div class="test-header-subject-row">
          SPACE FOR ROUGH WORK / रफ कार्य के लिए जगह
        </div>
        <div class="test-header-divider"></div>
      </div>
      <div class="rough-page-content">
        <div class="rough-watermark">SPACE FOR ROUGH WORK / रफ कार्य के लिए जगह</div>
        <div class="rough-grid-canvas"></div>
      </div>
      <div class="page-running-footer">
        <div class="footer-phase-box">PHASE - ALL</div>
        <div class="footer-meta-row">
          <span class="footer-barcode">${test.code}</span>
          <span class="footer-rough-note">SPACE FOR ROUGH WORK</span>
          <span class="footer-date">${currentDateStr}</span>
        </div>
      </div>
    </div>
  `;

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
          <div class="corp-brand-title">⚡ ATOMIC PATHSHALA PRIVATE LIMITED</div>
          <div class="corp-address">Registered Office & Online Learning Portal | Kota / New Delhi, India</div>
          <div class="corp-contacts">
            <span>Website: <strong>www.atomicpathshala.com</strong></span>
            <span>·</span>
            <span>Support: <strong>support@atomicpathshala.com</strong></span>
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
        const solEnHtml = renderFormulaContent(q.solutionEn || "Detailed explanation provided as per standard textbook principles.");
        const solHiHtml = renderFormulaContent(q.solutionHi || q.solutionEn || "");

        return `
          <div class="sol-item-block">
            <div class="sol-item-header">
              <span class="sol-q-badge">Q.${q.number}</span>
              <span class="sol-correct-badge">Correct Answer: <strong>Option (${q.correctOptionKey})</strong></span>
              <span class="sol-subject-tag">${q.subject}</span>
            </div>
            <div class="sol-statement-brief">
              <div class="sol-stmt-hi">${renderFormulaContent(q.statementHi)}</div>
              <div class="sol-stmt-en">${renderFormulaContent(q.statementEn)}</div>
            </div>
            <div class="sol-explanation-box">
              <div class="sol-heading">💡 Hint & Step-by-Step Solution :</div>
              <div class="sol-body-content">
                <div class="sol-en">${solEnHtml}</div>
                ${q.solutionHi && q.solutionHi !== q.solutionEn ? `<div class="sol-hi">${solHiHtml}</div>` : ""}
              </div>
            </div>
          </div>
        `;
      }).join("");

      return `
        <div class="sol-section-group">
          <div class="sol-section-title">HINTS & SOLUTIONS : ${section.subject.toUpperCase()} (${section.name.toUpperCase()})</div>
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
  <title>${test.name} - ${test.code} | ${brandName}</title>
  
  <!-- Tailwind CSS Engine for Exact Aesthetic Rendering -->
  <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css" crossorigin="anonymous">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Montserrat:wght@600;700;800;900&family=JetBrains+Mono:wght@500;600;700&family=Noto+Serif+Devanagari:wght@400;500;600;700;800&family=PT+Serif:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">

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
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #0f172a;
      font-size: 11pt;
      line-height: 1.4;
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
      padding: 28px 32px;
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
      padding: 24px 28px;
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
    }

    /* Content Page: Strictly Aligned At The Top, Zero Gap */
    .page.content-page {
      padding: 18px 26px 14px 26px !important;
      justify-content: flex-start !important;
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
        padding: 20px 24px;
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
      background: #4f46e5;
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
      background: #4338ca;
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
    .page-running-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1.5px solid #0f172a;
      padding-top: 4px;
      margin-top: 8px;
      font-size: 8pt;
      color: #334155;
      font-weight: 600;
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
      border-radius: 10px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      margin-bottom: 6px;
      background: #fff;
    }
    .inst-col {
      padding: 5px 8px;
    }
    .inst-col-left {
      border-right: 1.5px solid #000;
      font-family: 'Noto Sans Devanagari', sans-serif;
    }
    .inst-col-right {
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
    .inst-heading {
      font-size: 9pt;
      font-weight: 800;
      margin-bottom: 4px;
      text-decoration: underline;
    }
    .inst-list {
      margin: 0;
      padding-left: 14px;
      font-size: 7.5pt;
      line-height: 1.3;
    }
    .inst-list li {
      margin-bottom: 3px;
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

    /* Authentic Academic Exam Typesetting (Matching ALLEN / NTA Official Standards) */
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
      font-family: 'Montserrat', 'Times New Roman', sans-serif;
      font-size: 14pt;
      font-weight: 900;
      letter-spacing: 0.5px;
      color: #000000;
    }

    .test-header-page-no {
      font-family: 'Times New Roman', 'PT Serif', serif;
      font-size: 13.5pt;
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
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #000000;
      margin-top: 1px;
      margin-bottom: 3px;
    }

    .test-header-divider {
      height: 1.5px;
      background: #000000;
      width: 100%;
      margin-bottom: 3px;
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
      padding: 6px 0 8px 0;
      border-bottom: 1px solid #cbd5e1;
      page-break-inside: avoid;
      break-inside: avoid;
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

    /* UNIFIED SERIF FONT & EXACT SAME FONT SIZE FOR BOTH HINDI & ENGLISH */
    .q-statement-body,
    .q-statement-body p,
    .q-statement-body span,
    .opt-value,
    .opt-value p,
    .opt-value span {
      font-family: 'Times New Roman', 'PT Serif', 'Noto Serif Devanagari', 'Cambria', Georgia, serif !important;
      font-size: 10pt !important;
      line-height: 1.38 !important;
      color: #000000 !important;
    }

    .q-num-label {
      font-family: 'Times New Roman', 'PT Serif', serif !important;
      font-size: 10pt !important;
      font-weight: 800 !important;
      color: #000000 !important;
      min-width: 18px;
      flex-shrink: 0;
    }

    .q-opts-wrapper {
      margin-top: 4px;
    }

    .opts-grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: 12px;
      row-gap: 3px;
    }

    .opts-stacked {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .opt-box {
      display: flex;
      align-items: baseline;
      gap: 4px;
    }

    .opt-label {
      font-family: 'Times New Roman', 'PT Serif', serif !important;
      font-size: 10pt !important;
      font-weight: 700 !important;
      color: #000000 !important;
      min-width: 22px;
      flex-shrink: 0;
    }

    .q-diagram-wrap {
      text-align: center;
      margin: 4px 0 2px 0;
    }

    .q-diagram-img {
      max-width: 88%;
      max-height: 120px;
      object-fit: contain;
      display: inline-block;
    }

    /* Footer Styles */
    .page-running-footer {
      margin-top: auto;
      padding-top: 4px;
      width: 100%;
    }

    .footer-phase-box {
      border: 1px solid #000000;
      padding: 1px 6px;
      font-family: 'Times New Roman', serif;
      font-size: 7.5pt;
      font-weight: 800;
      width: fit-content;
      margin-bottom: 2px;
    }

    .footer-meta-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #000000;
      padding-top: 2px;
      font-family: 'Times New Roman', 'JetBrains Mono', serif;
      font-size: 8pt;
      font-weight: 600;
      color: #000000;
    }

    .footer-barcode {
      font-family: 'JetBrains Mono', 'Times New Roman', monospace;
      font-weight: 700;
    }

    .rough-page-content {
      flex: 1;
      border: 1.5px dashed #94a3b8;
      margin: 10px 0;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fafafa;
    }
    .rough-watermark {
      font-size: 16pt;
      font-weight: 800;
      color: #cbd5e1;
      text-transform: uppercase;
      letter-spacing: 2px;
      text-align: center;
      pointer-events: none;
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
      font-family: 'Noto Sans Devanagari', sans-serif;
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
    .sol-item-block {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 10px;
      margin-bottom: 8px;
      page-break-inside: avoid;
      break-inside: avoid;
      background: #fff;
    }
    .sol-item-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .sol-q-badge {
      font-size: 9pt;
      font-weight: 800;
      background: #0f172a;
      color: #fff;
      padding: 1px 6px;
      border-radius: 4px;
    }
    .sol-correct-badge {
      font-size: 8.5pt;
      color: #047857;
      font-weight: 700;
    }
    .sol-subject-tag {
      font-size: 7.5pt;
      color: #64748b;
      margin-left: auto;
      font-weight: 600;
    }
    .sol-statement-brief {
      font-size: 8.2pt;
      color: #334155;
      border-left: 2px solid #cbd5e1;
      padding-left: 6px;
      margin-bottom: 6px;
    }
    .sol-explanation-box {
      background: #f8fafc;
      border-radius: 4px;
      padding: 6px 8px;
      border: 1px solid #e2e8f0;
    }
    .sol-heading {
      font-size: 8pt;
      font-weight: 700;
      color: #4f46e5;
      margin-bottom: 3px;
    }
    .sol-body-content {
      font-size: 8.5pt;
      line-height: 1.4;
      color: #0f172a;
    }
    .sol-en {
      margin-bottom: 4px;
    }
    .sol-hi {
      font-family: 'Noto Sans Devanagari', sans-serif;
      color: #1e293b;
      border-top: 1px dashed #e2e8f0;
      padding-top: 3px;
    }
  </style>
</head>
<body>

  <div class="print-bar no-print">
    <div>
      <h1>${brandName} — ${test.name}</h1>
      <div style="font-size: 11px; opacity: 0.8;">${test.code} · ${withSolution ? "With Complete Solutions & Answer Key" : "Without Solution (Exam Paper)"}</div>
    </div>
    <div style="display: flex; gap: 10px;">
      <button onclick="window.print()" class="print-bar-btn">
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
        <span>Print or Save as PDF</span>
      </button>
    </div>
  </div>

  <div class="doc-container">
    ${frontCoverHtml}
    ${questionPagesHtml}
    ${finalRoughPagesHtml}
    ${backCoverHtml}
    ${solutionsSectionHtml}
  </div>

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
  const coverMatch = fullHtml.match(/<div class="a4-sheet border-2 border-slate-900 rounded-xs cover-sheet">[\s\S]*?<\/div>\s*<\/div>/);
  if (!coverMatch) return fullHtml;

  const headerPart = fullHtml.split('<div class="doc-container">')[0];
  const footerPart = "</body>\n</html>";

  return `${headerPart}<div class="doc-container">\n${coverMatch[0]}\n</div>\n${footerPart}`;
}
