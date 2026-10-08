import "server-only";
import katex from "katex";
import type { ModuleElementInput } from "@/lib/validation/module";
import {
  SUBJECT_THEMES,
  ModuleSubject,
  generateModuleFrontCoverHtml,
  generateModuleRunningHeaderHtml,
  generateModuleRunningFooterHtml,
  generateModuleWatermarkHtml,
  RenderHeaderFooterParams,
} from "./subject-design-system";

export interface RedesignRenderOptions {
  subject: ModuleSubject;
  moduleNumber: string; // e.g. "Module 01"
  chapterName: string; // e.g. "IUPAC Nomenclature"
  facultyName?: string | null;
  targetExam?: string; // "CLASS 11 | NEET UG"
  isPrintMode?: boolean; // If true: strictly NO WATERMARK & 300 DPI print optimization
  includeCover?: boolean;
}

/**
 * Safely renders LaTeX formulas in text (supporting $...$ and $$...$$)
 */
function renderLatexInText(text: string): string {
  if (!text) return "";

  // Replace $$...$$ display math
  let processed = text.replace(/\$\$([\s\S]+?)\$\$/g, (_match, math) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
    } catch {
      return `<div class="katex-error">${math}</div>`;
    }
  });

  // Replace $...$ inline math
  processed = processed.replace(/\$([^\$\n]+?)\$/g, (_match, math) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return `<span class="katex-error">${math}</span>`;
    }
  });

  return processed;
}

let globalQuestionCounter = 1;
let globalSectionCounter = 1;

/**
 * Converts an individual AST element into exact subject-themed HTML blocks
 */
function renderSingleElementHtml(el: ModuleElementInput, subject: ModuleSubject): string {
  const theme = SUBJECT_THEMES[subject] || SUBJECT_THEMES.CHEMISTRY;
  const contentWithMath = renderLatexInText(el.content || "");

  switch (el.type) {
    case "HEADING": {
      const sectionNum = `1.${globalSectionCounter++}`;
      return `
        <div class="element-heading" style="margin: 28px 0 14px 0; page-break-after: avoid; display: flex; align-items: center; gap: 10px; width: 100%;">
          <div style="
            background: ${theme.primaryColor};
            color: #ffffff;
            font-size: 13px;
            font-weight: 800;
            padding: 4px 12px;
            border-radius: 8px;
            letter-spacing: 0.5px;
            shrink-0;
          ">
            ${sectionNum}
          </div>
          <h2 style="font-size: 17px; font-weight: 800; color: ${theme.darkText}; margin: 0; letter-spacing: -0.3px;">
            ${contentWithMath}
          </h2>
        </div>
      `;
    }

    case "SUBHEADING":
      return `
        <div class="element-subheading" style="margin: 20px 0 10px 0; page-break-after: avoid; width: 100%;">
          <h3 style="font-size: 14.5px; font-weight: 700; color: ${theme.darkText}; margin: 0; letter-spacing: -0.2px;">
            ${contentWithMath}
          </h3>
        </div>
      `;

    case "PARAGRAPH":
      return `
        <p class="element-paragraph" style="font-size: 13px; font-weight: 400; line-height: 1.75; color: ${theme.darkText}; margin: 0 0 12px 0; text-align: justify; width: 100%;">
          ${contentWithMath}
        </p>
      `;

    case "CALLOUT": {
      const variant = el.variant || "NOTE";
      const isImportant =
        variant === "CAUTION" ||
        variant === "IMPORTANT" ||
        el.label?.toLowerCase().includes("important") ||
        el.label?.toLowerCase().includes("महत्वपूर्ण");

      if (isImportant) {
        return `
          <div class="element-important-box" style="
            background: #FEF2F2;
            border: 1.5px solid #FECACA;
            border-radius: 12px;
            padding: 14px 18px;
            margin: 16px 0;
            page-break-inside: avoid;
            width: 100%;
          ">
            <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 800; color: #DC2626; text-transform: uppercase; margin-bottom: 6px;">
              <span style="font-size: 14px;">★</span>
              <span>Important Point</span>
            </div>
            <div style="font-size: 12.5px; font-weight: 400; line-height: 1.7; color: #7F1D1D;">
              ${contentWithMath}
            </div>
          </div>
        `;
      }

      if (variant === "FORMULA") {
        return `
          <div class="element-formula-box" style="
            background: ${theme.softBg};
            border: 1.5px solid ${theme.primaryColor}40;
            border-radius: 12px;
            padding: 14px 18px;
            margin: 16px 0;
            page-break-inside: avoid;
            width: 100%;
          ">
            <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 800; color: ${theme.primaryColor}; text-transform: uppercase; margin-bottom: 6px;">
              <span>Formula</span>
            </div>
            <div style="font-size: 13px; font-weight: 500; line-height: 1.7; color: ${theme.darkText}; text-align: center;">
              ${contentWithMath}
            </div>
          </div>
        `;
      }

      return `
        <div class="element-keypoints-box" style="
          background: ${theme.lightBg};
          border-radius: 12px;
          padding: 14px 18px;
          margin: 16px 0;
          page-break-inside: avoid;
          width: 100%;
        ">
          <div style="
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: ${theme.primaryColor};
            color: #ffffff;
            padding: 3px 12px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
          ">
            <span>✦</span>
            <span>${el.label || "Key Points"}</span>
          </div>
          <div style="font-size: 12.5px; font-weight: 400; line-height: 1.7; color: ${theme.darkText};">
            ${contentWithMath}
          </div>
        </div>
      `;
    }

    case "EQUATION":
    case "CHEMICAL_EQUATION":
    case "CHEMICAL_STRUCTURE":
      return `
        <div class="element-equation-box" style="
          background: ${theme.softBg};
          border: 1px dashed ${theme.primaryColor}60;
          border-radius: 8px;
          padding: 10px 16px;
          margin: 12px 0;
          text-align: center;
          font-family: 'Fira Code', monospace;
          font-size: 13px;
          font-weight: 500;
          color: ${theme.darkText};
          page-break-inside: avoid;
          width: 100%;
        ">
          ${contentWithMath}
        </div>
      `;

    case "DIAGRAM":
    case "IMAGE": {
      const mediaUrl = (el as any).mediaUrl || (el.content?.startsWith("http") ? el.content : null);
      return `
        <div class="element-diagram-box" style="
          text-align: center;
          margin: 18px 0;
          padding: 12px;
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          page-break-inside: avoid;
          width: 100%;
        ">
          <div style="
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: ${theme.lightBg};
            color: ${theme.primaryColor};
            padding: 2px 10px;
            border-radius: 6px;
            font-size: 10.5px;
            font-weight: 800;
            text-transform: uppercase;
            margin-bottom: 8px;
          ">
            <span>⬚</span>
            <span>Diagram / Figure</span>
          </div>

          ${
            mediaUrl
              ? `<img src="${mediaUrl}" alt="${el.label || "Academic Diagram"}" style="max-width: 100%; max-height: 320px; object-fit: contain; border-radius: 8px; display: block; margin: 0 auto;" />`
              : `<div style="font-size: 12px; color: #64748b; padding: 16px;">[Figure: ${el.label || el.content}]</div>`
          }

          ${
            el.label
              ? `<div style="font-size: 11px; font-weight: 600; color: ${theme.primaryColor}; margin-top: 6px;">
                  Figure: ${el.label}
                 </div>`
              : ""
          }
        </div>
      `;
    }

    case "TABLE":
      if (Array.isArray(el.tableData) && el.tableData.length > 0) {
        const rowsHtml = el.tableData
          .map((row, rIdx) => {
            const isHeader = rIdx === 0;
            const cellsHtml = row
              .map((cell) =>
                isHeader
                  ? `<th style="background: ${theme.primaryColor}; color: #ffffff; padding: 6px 8px; font-size: 11px; font-weight: 700; border: 1px solid ${theme.primaryColor}; text-align: center;">${renderLatexInText(cell)}</th>`
                  : `<td style="padding: 6px 8px; font-size: 11px; font-weight: 400; color: ${theme.darkText}; border: 1px solid #e2e8f0; background: ${rIdx % 2 === 0 ? "#ffffff" : theme.softBg}; text-align: center;">${renderLatexInText(cell)}</td>`
              )
              .join("");
            return `<tr>${cellsHtml}</tr>`;
          })
          .join("");

        return `
          <div class="element-table-wrapper" style="margin: 16px 0; overflow-x: auto; page-break-inside: avoid; width: 100%;">
            <table style="width: 100%; border-collapse: collapse; text-align: center; border-radius: 8px; overflow: hidden;">
              ${rowsHtml}
            </table>
          </div>
        `;
      }
      return "";

    default:
      return `
        <div class="element-general" style="font-size: 13px; font-weight: 400; line-height: 1.7; color: ${theme.darkText}; margin-bottom: 10px; width: 100%;">
          ${contentWithMath}
        </div>
      `;
  }
}

/**
 * Renders structured items with automatic Dual-Column grid wrapping for consecutive Questions
 */
function renderElementsWithDualColumnLayout(elements: ModuleElementInput[], subject: ModuleSubject): string {
  const theme = SUBJECT_THEMES[subject] || SUBJECT_THEMES.CHEMISTRY;
  const renderedSections: string[] = [];

  let currentQuestionGroup: ModuleElementInput[] = [];

  const flushQuestionGroup = () => {
    if (currentQuestionGroup.length === 0) return;

    // Build question cards by grouping each QUESTION with its following OPTIONs and SOLUTION
    const questionCards: Array<{ question: ModuleElementInput; options: ModuleElementInput[]; solution?: ModuleElementInput }> = [];
    let currentCard: { question: ModuleElementInput; options: ModuleElementInput[]; solution?: ModuleElementInput } | null = null;

    for (const item of currentQuestionGroup) {
      if (item.type === "QUESTION") {
        if (currentCard) questionCards.push(currentCard);
        currentCard = { question: item, options: [] };
      } else if (item.type === "OPTION") {
        if (currentCard) {
          currentCard.options.push(item);
        } else {
          // Fallback if option appears without preceding question
          currentCard = { question: { type: "QUESTION", content: "" } as any, options: [item] };
        }
      } else if (item.type === "SOLUTION") {
        if (currentCard) currentCard.solution = item;
      }
    }
    if (currentCard) questionCards.push(currentCard);

    // Render 2-Column Grid of Question Cards
    const cardsHtml = questionCards
      .map((card) => {
        const qNum = globalQuestionCounter++;
        const qText = renderLatexInText(card.question.content || "");
        const optionsHtml = card.options
          .map((opt) => {
            const optText = renderLatexInText(opt.content || "");
            return `<div class="option-line" style="margin: 3px 0 3px 12px; font-size: 12px; font-weight: 400; color: ${theme.darkText}; line-height: 1.5;">${optText}</div>`;
          })
          .join("");

        const solutionHtml = card.solution
          ? `<div class="solution-box" style="margin-top: 6px; padding: 6px 10px; background: ${theme.softBg}; border-radius: 6px; font-size: 11.5px; color: #475569; line-height: 1.5;">
              <span style="font-weight: 700; color: ${theme.primaryColor};">Sol: </span>${renderLatexInText(card.solution.content || "")}
             </div>`
          : "";

        return `
          <div class="question-card" style="
            background: #ffffff;
            border: 1.5px solid ${theme.primaryColor}35;
            border-radius: 10px;
            padding: 12px 14px;
            margin-bottom: 14px;
            break-inside: avoid;
            page-break-inside: avoid;
          ">
            <div style="font-size: 12.5px; line-height: 1.6; color: ${theme.darkText}; font-weight: 400;">
              <span style="font-weight: 700; color: ${theme.primaryColor}; margin-right: 4px;">Q.${qNum}</span> ${qText}
            </div>
            ${optionsHtml ? `<div style="margin-top: 6px;">${optionsHtml}</div>` : ""}
            ${solutionHtml}
          </div>
        `;
      })
      .join("\n");

    renderedSections.push(`
      <div class="questions-dual-column-container" style="
        column-count: 2;
        column-gap: 20px;
        margin: 16px 0;
        width: 100%;
      ">
        ${cardsHtml}
      </div>
    `);

    currentQuestionGroup = [];
  };

  for (const el of elements) {
    if (el.type === "QUESTION" || el.type === "OPTION" || el.type === "SOLUTION") {
      currentQuestionGroup.push(el);
    } else {
      flushQuestionGroup();
      renderedSections.push(renderSingleElementHtml(el, subject));
    }
  }

  flushQuestionGroup();
  return renderedSections.join("\n");
}

/**
 * Builds the complete standalone printable HTML document for the Redesigned Module
 */
export function buildRedesignedModuleHtml(
  elements: ModuleElementInput[],
  options: RedesignRenderOptions
): string {
  globalQuestionCounter = 1;
  globalSectionCounter = 1;

  const isPrintMode = !!options.isPrintMode;
  const includeCover = options.includeCover ?? true;

  const headerParams: RenderHeaderFooterParams = {
    subject: options.subject,
    moduleNumber: options.moduleNumber,
    chapterName: options.chapterName,
    facultyName: options.facultyName,
    targetExam: options.targetExam || "Class 11 | NEET UG",
    isPrintMode,
  };

  const coverHtml = includeCover ? generateModuleFrontCoverHtml(headerParams) : "";
  const runningHeaderHtml = generateModuleRunningHeaderHtml(headerParams);
  const runningFooterHtml = generateModuleRunningFooterHtml({ ...headerParams, pageNumber: 1, totalPages: 1 });
  const watermarkHtml = generateModuleWatermarkHtml(isPrintMode);

  // Render elements in order with Dual-Column support for questions
  const elementsHtml = renderElementsWithDualColumnLayout(elements, options.subject);

  return `
<!DOCTYPE html>
<html lang="hi" dir="ltr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${options.moduleNumber} - ${options.chapterName} | Atomic Pathshala</title>

  <!-- Google Fonts: Poppins, Noto Sans Devanagari & Fira Code -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;600&family=Noto+Sans+Devanagari:wght@400;500;600;700;800&family=Poppins:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,600&display=swap" rel="stylesheet" />

  <!-- KaTeX Math CSS -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css" />

  <style>
    @page {
      size: A4;
      margin: 18mm 14mm 16mm 14mm;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      margin: 0;
      padding: 0;
      font-family: 'Noto Sans Devanagari', 'Poppins', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      line-height: 1.75;
      color: #0f172a;
      background: #ffffff;
      font-feature-settings: "kern" 1;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }

    .module-container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 16px 20px;
    }

    .katex {
      font-size: 1.05em !important;
    }

    .katex-display {
      margin: 10px 0 !important;
    }

    @media print {
      body {
        background: transparent;
      }
      .module-container {
        max-width: 100%;
        padding: 0;
      }
      .page-break {
        page-break-before: always;
      }
    }
  </style>
</head>
<body>
  ${watermarkHtml}
  ${coverHtml}
  
  <div class="module-container">
    ${runningHeaderHtml}
    <main style="margin-top: 10px;">
      ${elementsHtml}
    </main>
    ${runningFooterHtml}
  </div>
</body>
</html>
  `;
}
