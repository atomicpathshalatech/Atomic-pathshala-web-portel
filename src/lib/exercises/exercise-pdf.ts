import { renderFormulaContent } from "@/lib/test-portal/formula";

export interface ExercisePdfOptions {
  languageMode?: "HINDI_ONLY" | "ENGLISH_ONLY" | "BILINGUAL";
  format?: "QUESTION_ONLY" | "WITH_ANSWER_KEY" | "FULL_WITH_SOLUTIONS";
  twoColumn?: boolean;
  instituteName?: string;
  watermarkText?: string;
  showPyqBadge?: boolean;
}

interface QuestionData {
  id: string;
  questionCode: string | null;
  subject: string;
  chapter: string | null;
  topic: string | null;
  subTopic: string | null;
  type: string;
  difficulty: string;
  pyqExam: string | null;
  pyqYear: number | null;
  pyqMonth: string | null;
  pyqQuestionNumber: string | null;
  solution: string | null;
  translations: {
    language: string;
    statement: string;
    options: any;
    correctOptionIds: any;
    solution: string | null;
  }[];
}

interface SectionData {
  id: string;
  title: string;
  description?: string | null;
  topic?: string | null;
  questions: {
    id: string;
    displayOrder: number;
    marks?: number | null;
    negativeMarks?: number | null;
    question: QuestionData;
  }[];
}

interface ExercisePdfData {
  title: string;
  subtitle?: string | null;
  exerciseCode: string;
  subject: string;
  chapter: string;
  instructions?: string | null;
  defaultMarks: number;
  defaultNegativeMarks: number;
  sections: SectionData[];
}

/**
 * Generates self-contained, publication-grade coaching institute HTML for an exercise.
 */
export function generateExerciseHtml(exercise: ExercisePdfData, opts: ExercisePdfOptions = {}): string {
  const langMode = opts.languageMode || "BILINGUAL";
  const format = opts.format || "FULL_WITH_SOLUTIONS";
  const instituteName = opts.instituteName || "ATOMIC PATHSHALA";
  const watermarkText = opts.watermarkText || instituteName;
  const showPyqBadge = opts.showPyqBadge !== false;

  let totalQuestionsCount = 0;
  for (const s of exercise.sections) {
    totalQuestionsCount += s.questions.length;
  }
  const totalMarks = totalQuestionsCount * exercise.defaultMarks;

  // Flatten questions with 1-based global number
  const flatQuestions: {
    number: number;
    sectionTitle: string;
    eq: SectionData["questions"][0];
    correctAnswers: string[];
    enTranslation?: QuestionData["translations"][0];
    hiTranslation?: QuestionData["translations"][0];
  }[] = [];

  let qNum = 1;
  for (const sec of exercise.sections) {
    for (const q of sec.questions) {
      const en = q.question.translations.find((t) => t.language.toUpperCase() === "ENGLISH");
      const hi = q.question.translations.find((t) => t.language.toUpperCase() === "HINDI");
      
      // Determine correct answer(s)
      let correctAnswers: string[] = [];
      const primaryTrans = en || hi;
      if (primaryTrans && primaryTrans.correctOptionIds) {
        if (Array.isArray(primaryTrans.correctOptionIds)) {
          correctAnswers = primaryTrans.correctOptionIds.map(String);
        } else if (typeof primaryTrans.correctOptionIds === "string") {
          correctAnswers = [primaryTrans.correctOptionIds];
        }
      }

      flatQuestions.push({
        number: qNum++,
        sectionTitle: sec.title,
        eq: q,
        correctAnswers,
        enTranslation: en,
        hiTranslation: hi,
      });
    }
  }

  // Build Sections and Questions HTML
  let sectionsHtml = "";
  let questionCounter = 1;

  for (const sec of exercise.sections) {
    let questionsHtml = "";

    for (const qItem of sec.questions) {
      const currentNumber = questionCounter++;
      const q = qItem.question;
      const en = q.translations.find((t) => t.language.toUpperCase() === "ENGLISH");
      const hi = q.translations.find((t) => t.language.toUpperCase() === "HINDI");

      // PYQ Badge
      let pyqBadge = "";
      if (showPyqBadge && (q.pyqExam || q.pyqYear)) {
        const parts = [q.pyqExam, q.pyqYear ? `${q.pyqYear}` : null, q.pyqMonth].filter(Boolean);
        pyqBadge = `<span class="badge pyq-badge">[${escapeHtml(parts.join(" "))}]</span>`;
      }

      // Metadata info pill
      const metaInfo = `<div class="q-meta">
        <span class="q-num">Q.${currentNumber}</span>
        ${pyqBadge}
        <span class="badge type-badge">${escapeHtml(q.type.replace(/_/g, " "))}</span>
        <span class="badge diff-badge">${escapeHtml(q.difficulty)}</span>
        <span class="q-marks">[+${qItem.marks ?? exercise.defaultMarks}, -${qItem.negativeMarks ?? exercise.defaultNegativeMarks}]</span>
      </div>`;

      // Statement rendering
      let statementHtml = "";
      if (langMode === "BILINGUAL") {
        if (hi?.statement) {
          statementHtml += `<div class="statement statement-hi">${renderFormulaContent(hi.statement)}</div>`;
        }
        if (en?.statement) {
          statementHtml += `<div class="statement statement-en">${renderFormulaContent(en.statement)}</div>`;
        }
      } else if (langMode === "HINDI_ONLY") {
        statementHtml = `<div class="statement statement-hi">${renderFormulaContent(hi?.statement || en?.statement || "(प्रश्न विवरण अनुपलब्ध)")}</div>`;
      } else {
        statementHtml = `<div class="statement statement-en">${renderFormulaContent(en?.statement || hi?.statement || "(Question text unavailable)")}</div>`;
      }

      // Options rendering
      let optionsHtml = "";
      const baseTrans = (langMode === "HINDI_ONLY" ? hi : en) || en || hi;
      const rawOptions = baseTrans?.options;

      if (rawOptions && typeof rawOptions === "object") {
        const optionKeys = ["A", "B", "C", "D"].filter((k) => (rawOptions as any)[k] !== undefined);
        const keysToUse = optionKeys.length > 0 ? optionKeys : Object.keys(rawOptions);

        if (keysToUse.length > 0) {
          let optsListHtml = "";
          for (const key of keysToUse) {
            let optContent = "";
            if (langMode === "BILINGUAL" && hi?.options && en?.options) {
              const hiOpt = (hi.options as any)[key] ? `<div class="opt-hi">${renderFormulaContent((hi.options as any)[key])}</div>` : "";
              const enOpt = (en.options as any)[key] ? `<div class="opt-en">${renderFormulaContent((en.options as any)[key])}</div>` : "";
              optContent = `${hiOpt}${enOpt}`;
            } else {
              const val = (rawOptions as any)[key] || "";
              optContent = renderFormulaContent(val);
            }

            optsListHtml += `
              <div class="option-item">
                <span class="opt-label">(${key})</span>
                <div class="opt-body">${optContent}</div>
              </div>
            `;
          }
          optionsHtml = `<div class="options-grid">${optsListHtml}</div>`;
        }
      }

      questionsHtml += `
        <div class="question-card">
          ${metaInfo}
          <div class="q-content">
            ${statementHtml}
            ${optionsHtml}
          </div>
        </div>
      `;
    }

    sectionsHtml += `
      <section class="exercise-section">
        <div class="section-header">
          <div class="section-title-bar">
            <span class="section-title">${escapeHtml(sec.title)}</span>
          </div>
          ${sec.description ? `<p class="section-desc">${escapeHtml(sec.description)}</p>` : ""}
        </div>
        <div class="questions-container">
          ${questionsHtml}
        </div>
      </section>
    `;
  }

  // Answer Key Section
  let answerKeyHtml = "";
  if (format === "WITH_ANSWER_KEY" || format === "FULL_WITH_SOLUTIONS") {
    let keyCells = "";
    for (const item of flatQuestions) {
      const ans = item.correctAnswers.length > 0 ? item.correctAnswers.join(", ") : "-";
      keyCells += `
        <div class="key-cell">
          <span class="key-q">${item.number}</span>
          <span class="key-ans">${escapeHtml(ans)}</span>
        </div>
      `;
    }

    answerKeyHtml = `
      <div class="page-break"></div>
      <div class="answer-key-section">
        <div class="sub-header-bar">
          <h2>ANSWER KEY / उत्तर कुंजी</h2>
          <span class="meta-tag">${exercise.title} — ${exercise.chapter}</span>
        </div>
        <div class="answer-key-grid">
          ${keyCells}
        </div>
      </div>
    `;
  }

  // Detailed Solutions Section
  let solutionsHtml = "";
  if (format === "FULL_WITH_SOLUTIONS") {
    let solCards = "";
    for (const item of flatQuestions) {
      const q = item.eq.question;
      const ans = item.correctAnswers.length > 0 ? item.correctAnswers.join(", ") : "-";
      
      let solText = "";
      if (langMode === "BILINGUAL") {
        if (item.hiTranslation?.solution) {
          solText += `<div class="sol-hi"><strong>व्याख्या:</strong> ${renderFormulaContent(item.hiTranslation.solution)}</div>`;
        }
        if (item.enTranslation?.solution) {
          solText += `<div class="sol-en"><strong>Explanation:</strong> ${renderFormulaContent(item.enTranslation.solution)}</div>`;
        }
      } else if (langMode === "HINDI_ONLY") {
        solText = renderFormulaContent(item.hiTranslation?.solution || item.enTranslation?.solution || q.solution || "(हल उपलब्ध नहीं है)");
      } else {
        solText = renderFormulaContent(item.enTranslation?.solution || item.hiTranslation?.solution || q.solution || "(Solution not available)");
      }

      if (!solText && q.solution) {
        solText = renderFormulaContent(q.solution);
      }

      solCards += `
        <div class="solution-card">
          <div class="sol-meta">
            <span class="sol-q">Question ${item.number}</span>
            <span class="sol-correct">Correct Option: <strong>(${escapeHtml(ans)})</strong></span>
          </div>
          <div class="sol-body">
            ${solText || "<span class='no-sol'>Direct concept-based question. No extended derivation required.</span>"}
          </div>
        </div>
      `;
    }

    solutionsHtml = `
      <div class="page-break"></div>
      <div class="solutions-section">
        <div class="sub-header-bar">
          <h2>HINTS & DETAILED SOLUTIONS / संकेत एवं विस्तृत हल</h2>
          <span class="meta-tag">${exercise.title} — ${exercise.subject}: ${exercise.chapter}</span>
        </div>
        <div class="solutions-container">
          ${solCards}
        </div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(exercise.title)} — ${escapeHtml(exercise.chapter)}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 10mm 14mm 10mm;
      @bottom-right {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 8pt;
        color: #64748b;
        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      }
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      font-size: 9.5pt;
      line-height: 1.45;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }

    .institute-banner {
      border-bottom: 2px solid #1e293b;
      padding-bottom: 8px;
      margin-bottom: 12px;
      text-align: center;
    }

    .inst-name {
      font-size: 17pt;
      font-weight: 800;
      letter-spacing: 1.5px;
      color: #0f172a;
      text-transform: uppercase;
      margin: 0;
    }

    .inst-sub {
      font-size: 8pt;
      font-weight: 600;
      letter-spacing: 2px;
      color: #d97706;
      text-transform: uppercase;
      margin-top: 1px;
    }

    .exercise-meta-box {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 8px 12px;
      margin-bottom: 14px;
    }

    .meta-row-1 {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 1px dashed #cbd5e1;
      padding-bottom: 5px;
      margin-bottom: 5px;
    }

    .ex-title {
      font-size: 12pt;
      font-weight: 700;
      color: #1e3a8a;
    }

    .ex-code {
      font-size: 8.5pt;
      font-weight: 600;
      color: #475569;
      background: #e2e8f0;
      padding: 2px 6px;
      border-radius: 3px;
    }

    .meta-row-2 {
      display: flex;
      justify-content: space-between;
      font-size: 8.5pt;
      color: #334155;
    }

    .meta-item strong {
      color: #0f172a;
    }

    .instructions-text {
      margin-top: 5px;
      font-size: 8pt;
      color: #64748b;
      font-style: italic;
    }

    /* Section Styling */
    .exercise-section {
      margin-bottom: 16px;
    }

    .section-header {
      margin-bottom: 8px;
      page-break-after: avoid;
    }

    .section-title-bar {
      background: #1e293b;
      color: #ffffff;
      padding: 4px 10px;
      border-radius: 3px;
      display: inline-block;
      font-size: 9.5pt;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    .section-desc {
      font-size: 8pt;
      color: #64748b;
      margin: 4px 0 0 4px;
    }

    /* Questions */
    .question-card {
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid #f1f5f9;
      page-break-inside: avoid;
    }

    .q-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
      font-size: 8pt;
    }

    .q-num {
      font-weight: 800;
      font-size: 9.5pt;
      color: #0f172a;
    }

    .badge {
      font-size: 7pt;
      font-weight: 600;
      padding: 1px 4px;
      border-radius: 2px;
    }

    .pyq-badge {
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #fde68a;
      font-weight: 700;
    }

    .type-badge {
      background: #e0f2fe;
      color: #0369a1;
    }

    .diff-badge {
      background: #f1f5f9;
      color: #475569;
    }

    .q-marks {
      margin-left: auto;
      font-weight: 600;
      color: #64748b;
      font-size: 7.5pt;
    }

    .q-content {
      padding-left: 2px;
    }

    .statement {
      margin-bottom: 6px;
      font-size: 9.5pt;
      line-height: 1.5;
    }

    .statement-hi {
      color: #0f172a;
    }

    .statement-en {
      color: #334155;
    }

    /* Options Grid */
    .options-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 5px 12px;
      margin-top: 6px;
    }

    .option-item {
      display: flex;
      align-items: baseline;
      gap: 4px;
      font-size: 9pt;
      line-height: 1.35;
    }

    .opt-label {
      font-weight: 700;
      color: #1e3a8a;
      flex-shrink: 0;
    }

    .opt-body {
      flex-grow: 1;
    }

    .opt-hi {
      color: #0f172a;
    }

    .opt-en {
      color: #475569;
      font-size: 8.5pt;
    }

    /* Page Breaks */
    .page-break {
      page-break-before: always;
      break-before: page;
    }

    /* Sub Header Bar */
    .sub-header-bar {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 6px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }

    .sub-header-bar h2 {
      margin: 0;
      font-size: 12pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: 0.5px;
    }

    .meta-tag {
      font-size: 8pt;
      color: #64748b;
      font-weight: 600;
    }

    /* Answer Key Grid */
    .answer-key-grid {
      display: grid;
      grid-template-columns: repeat(10, 1fr);
      gap: 4px;
      margin-top: 10px;
    }

    .key-cell {
      border: 1px solid #cbd5e1;
      border-radius: 3px;
      text-align: center;
      padding: 4px 2px;
      background: #f8fafc;
    }

    .key-q {
      display: block;
      font-size: 7.5pt;
      color: #64748b;
      font-weight: 600;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 1px;
      margin-bottom: 2px;
    }

    .key-ans {
      display: block;
      font-size: 9.5pt;
      font-weight: 800;
      color: #1e3a8a;
    }

    /* Solutions Section */
    .solutions-container {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .solution-card {
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 8px 10px;
      background: #fafafa;
      page-break-inside: avoid;
    }

    .sol-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px dashed #cbd5e1;
      padding-bottom: 4px;
      margin-bottom: 6px;
    }

    .sol-q {
      font-weight: 700;
      color: #0f172a;
      font-size: 9pt;
    }

    .sol-correct {
      font-size: 8.5pt;
      color: #047857;
    }

    .sol-correct strong {
      font-size: 9.5pt;
    }

    .sol-body {
      font-size: 8.5pt;
      line-height: 1.45;
      color: #1e293b;
    }

    .sol-hi {
      margin-bottom: 4px;
    }

    .sol-en {
      color: #334155;
    }

    .no-sol {
      font-style: italic;
      color: #94a3b8;
    }

    /* KaTeX formula font sizing */
    .katex {
      font-size: 1em !important;
    }
  </style>
</head>
<body>
  <div class="institute-banner">
    <h1 class="inst-name">${escapeHtml(instituteName)}</h1>
    <div class="inst-sub">CHAPTER PRACTICE MODULE &bull; ASSESSMENT SHEET</div>
  </div>

  <div class="exercise-meta-box">
    <div class="meta-row-1">
      <span class="ex-title">${escapeHtml(exercise.title)}</span>
      <span class="ex-code">${escapeHtml(exercise.exerciseCode)}</span>
    </div>
    <div class="meta-row-2">
      <span class="meta-item"><strong>Subject:</strong> ${escapeHtml(exercise.subject)}</span>
      <span class="meta-item"><strong>Chapter:</strong> ${escapeHtml(exercise.chapter)}</span>
      <span class="meta-item"><strong>Questions:</strong> ${totalQuestionsCount}</span>
      <span class="meta-item"><strong>Total Marks:</strong> ${totalMarks}</span>
    </div>
    ${exercise.instructions ? `<div class="instructions-text">Instructions: ${escapeHtml(exercise.instructions)}</div>` : ""}
  </div>

  <main>
    ${sectionsHtml}
  </main>

  ${answerKeyHtml}
  ${solutionsHtml}
</body>
</html>`;
}

/**
 * Escapes plain text for HTML embedding
 */
function escapeHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Generates vector PDF buffer using headless Chrome/Chromium
 */
export async function generateExercisePdf(exercise: ExercisePdfData, opts: ExercisePdfOptions = {}): Promise<Buffer> {
  const { renderHtmlPdf } = await import("@/lib/pdf/html-to-pdf");
  const html = generateExerciseHtml(exercise, opts);
  return await renderHtmlPdf(html, {
    timeoutMs: 120_000,
  });
}
