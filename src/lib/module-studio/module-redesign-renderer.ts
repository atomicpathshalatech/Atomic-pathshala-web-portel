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
import { renderChemDrawSvg } from "./chemdraw-renderer";

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

let globalExampleCounter = 1;
let globalQuestionCounter = 1;
let globalSectionCounter = 1;

/**
 * Converts an individual AST element into exact subject-themed HTML blocks
 */
function renderElementHtml(el: ModuleElementInput, subject: ModuleSubject): string {
  const theme = SUBJECT_THEMES[subject] || SUBJECT_THEMES.CHEMISTRY;
  const contentWithMath = renderLatexInText(el.content || "");

  switch (el.type) {
    case "HEADING": {
      const sectionNum = `1.${globalSectionCounter++}`;
      return `
        <div class="element-heading" style="margin: 28px 0 14px 0; page-break-after: avoid; display: flex; align-items: center; gap: 10px;">
          <div style="
            background: ${theme.primaryColor};
            color: #ffffff;
            font-size: 13px;
            font-weight: 900;
            padding: 4px 12px;
            border-radius: 8px;
            letter-spacing: 0.5px;
            shrink-0;
          ">
            ${sectionNum}
          </div>
          <h2 style="font-size: 17px; font-weight: 900; color: ${theme.darkText}; margin: 0; letter-spacing: -0.3px;">
            ${contentWithMath}
          </h2>
        </div>
      `;
    }

    case "SUBHEADING":
      return `
        <div class="element-subheading" style="margin: 20px 0 10px 0; page-break-after: avoid;">
          <h3 style="font-size: 14.5px; font-weight: 800; color: ${theme.darkText}; margin: 0; letter-spacing: -0.2px;">
            ${contentWithMath}
          </h3>
        </div>
      `;

    case "PARAGRAPH":
      return `
        <p class="element-paragraph" style="font-size: 13px; line-height: 1.68; color: ${theme.darkText}; margin: 0 0 12px 0; text-align: justify;">
          ${contentWithMath}
        </p>
      `;

    case "CALLOUT": {
      const variant = el.variant || "NOTE";
      const isNcert = variant === "NCERT_INSIGHT";
      const isImportant = variant === "CAUTION" || variant === "IMPORTANT" || el.label?.toLowerCase().includes("important") || el.label?.toLowerCase().includes("महत्वपूर्ण");

      if (isImportant) {
        // Red/Peach Important Box from Reference
        return `
          <div class="element-important-box" style="
            background: #FEF2F2;
            border: 1.5px solid #FECACA;
            border-radius: 12px;
            padding: 14px 18px;
            margin: 16px 0;
            page-break-inside: avoid;
          ">
            <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 900; color: #DC2626; text-transform: uppercase; margin-bottom: 8px;">
              <span style="font-size: 14px;">★</span>
              <span>Important</span>
            </div>
            <div style="font-size: 12.5px; line-height: 1.65; color: #7F1D1D;">
              ${contentWithMath}
            </div>
          </div>
        `;
      }

      if (variant === "FORMULA") {
        // Formula Box from Reference
        return `
          <div class="element-formula-box" style="
            background: ${theme.softBg};
            border: 1.5px solid ${theme.primaryColor}40;
            border-radius: 12px;
            padding: 14px 18px;
            margin: 16px 0;
            page-break-inside: avoid;
          ">
            <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 900; color: ${theme.primaryColor}; text-transform: uppercase; margin-bottom: 8px;">
              <span class="material-symbols-outlined" style="font-size: 16px;">functions</span>
              <span>Formula</span>
            </div>
            <div style="font-size: 13px; line-height: 1.65; color: ${theme.darkText}; text-align: center; font-weight: 600;">
              ${contentWithMath}
            </div>
          </div>
        `;
      }

      // Default Key Points Box from Reference
      return `
        <div class="element-keypoints-box" style="
          background: ${theme.lightBg};
          border-radius: 12px;
          padding: 14px 18px;
          margin: 16px 0;
          page-break-inside: avoid;
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
            font-weight: 800;
            letter-spacing: 0.5px;
            margin-bottom: 10px;
          ">
            <span>✦</span>
            <span>${el.label || (isNcert ? "NCERT Key Points" : "Key Points")}</span>
          </div>
          <div style="font-size: 12.5px; line-height: 1.65; color: ${theme.darkText};">
            ${contentWithMath}
          </div>
        </div>
      `;
    }

    case "QUESTION": {
      const qNum = globalQuestionCounter++;
      const chemSvg = renderChemDrawSvg(el.content || "");
      return `
        <div class="element-practice-question-box" style="
          background: #ffffff;
          border: 1.5px solid ${theme.primaryColor}50;
          border-radius: 12px;
          padding: 16px 18px;
          margin: 18px 0 8px 0;
          page-break-inside: avoid;
          position: relative;
        ">
          <!-- Practice Question Top Badge -->
          <div style="
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: ${theme.lightBg};
            color: ${theme.primaryColor};
            border: 1px solid ${theme.primaryColor}40;
            padding: 2px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
            margin-bottom: 10px;
          ">
            <span>✎</span>
            <span>Practice Question</span>
          </div>

          <div style="font-size: 13px; font-weight: 700; color: ${theme.darkText}; line-height: 1.6;">
            <b>Q.${qNum}</b> ${contentWithMath}
          </div>
          ${chemSvg || ""}
        </div>
      `;
    }

    case "OPTION":
      return `
        <div class="element-option" style="
          margin: 4px 0 4px 18px;
          font-size: 12.5px;
          font-weight: 600;
          color: ${theme.darkText};
          line-height: 1.5;
          page-break-inside: avoid;
        ">
          ${contentWithMath}
        </div>
      `;

    case "SOLUTION":
      return `
        <div class="element-solution-box" style="
          margin: 6px 0 16px 18px;
          font-size: 12px;
          color: #475569;
          line-height: 1.6;
          page-break-inside: avoid;
        ">
          <div style="font-size: 11px; font-weight: 800; color: ${theme.primaryColor}; margin-bottom: 2px;">
            Solution :
          </div>
          <div>${contentWithMath}</div>
        </div>
      `;

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
          color: ${theme.darkText};
          page-break-inside: avoid;
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
            font-weight: 900;
            text-transform: uppercase;
            margin-bottom: 8px;
          ">
            <span>⬚</span>
            <span>Diagram / Illustration</span>
          </div>

          ${
            mediaUrl
              ? `<img src="${mediaUrl}" alt="${el.label || "Academic Diagram"}" style="max-width: 100%; max-height: 320px; object-fit: contain; border-radius: 8px; display: block; margin: 0 auto;" />`
              : `<div style="font-size: 12px; color: #64748b; padding: 16px;">[Diagram: ${el.label || el.content}]</div>`
          }

          ${
            el.label
              ? `<div style="font-size: 11px; font-weight: 700; color: ${theme.primaryColor}; margin-top: 6px;">
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
                  ? `<th style="background: ${theme.primaryColor}; color: #ffffff; padding: 7px 10px; font-size: 11.5px; font-weight: 800; border: 1px solid ${theme.primaryColor};">${renderLatexInText(cell)}</th>`
                  : `<td style="padding: 7px 10px; font-size: 11.5px; color: ${theme.darkText}; border: 1px solid #e2e8f0; background: ${rIdx % 2 === 0 ? "#ffffff" : theme.softBg};">${renderLatexInText(cell)}</td>`
              )
              .join("");
            return `<tr>${cellsHtml}</tr>`;
          })
          .join("");

        return `
          <div class="element-table-wrapper" style="margin: 16px 0; overflow-x: auto; page-break-inside: avoid;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; border-radius: 8px; overflow: hidden;">
              ${rowsHtml}
            </table>
          </div>
        `;
      }
      return "";

    default:
      return `
        <div class="element-general" style="font-size: 13px; line-height: 1.65; color: ${theme.darkText}; margin-bottom: 10px;">
          ${contentWithMath}
        </div>
      `;
  }
}

/**
 * Builds the complete standalone printable HTML document for the Redesigned Module
 */
export function buildRedesignedModuleHtml(
  elements: ModuleElementInput[],
  options: RedesignRenderOptions
): string {
  // Reset counters per document render
  globalExampleCounter = 1;
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

  // Render elements in order
  const elementsHtml = elements.map((el) => renderElementHtml(el, options.subject)).join("\n");

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
  <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;600&family=Noto+Sans+Devanagari:wght@400;500;600;700;800;900&family=Poppins:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />

  <!-- KaTeX Math Styles -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css" />

  <style>
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      margin: 0;
      padding: 0;
      background: ${isPrintMode ? "#ffffff" : "#0f172a"};
      color: #1f2937;
      font-family: 'Poppins', 'Noto Sans Devanagari', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      line-height: 1.65;
    }

    .module-container {
      width: 210mm;
      min-height: 297mm;
      margin: ${isPrintMode ? "0" : "20px auto"};
      background: #ffffff;
      position: relative;
      box-shadow: ${isPrintMode ? "none" : "0 10px 40px rgba(0,0,0,0.5)"};
    }

    .content-body {
      padding: 24px 32px 32px 32px;
      position: relative;
      z-index: 2;
    }

    @media print {
      body {
        background: #ffffff !important;
      }
      .module-container {
        width: 100% !important;
        box-shadow: none !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      @page {
        size: A4 portrait;
        margin: 0;
      }
    }
  </style>
</head>
<body>
  <div class="module-container">
    ${watermarkHtml}
    ${coverHtml}

    <div class="content-body">
      ${runningHeaderHtml}
      ${elementsHtml}
      ${runningFooterHtml}
    </div>
  </div>
</body>
</html>
  `;
}
