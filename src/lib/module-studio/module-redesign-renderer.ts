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
  targetExam?: string; // "NEET (UG)" | "JEE (Main+Adv)"
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

/**
 * Converts an individual AST element into subject-themed HTML
 */
function renderElementHtml(el: ModuleElementInput, subject: ModuleSubject): string {
  const theme = SUBJECT_THEMES[subject] || SUBJECT_THEMES.CHEMISTRY;
  const contentWithMath = renderLatexInText(el.content || "");

  switch (el.type) {
    case "HEADING":
      return `
        <div class="element-heading" style="margin: 32px 0 16px 0; page-break-after: avoid;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 6px; height: 28px; border-radius: 3px; background: ${theme.primaryColor};"></div>
            <h2 style="font-size: 20px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.4px;">
              ${contentWithMath}
            </h2>
          </div>
        </div>
      `;

    case "SUBHEADING":
      return `
        <div class="element-subheading" style="margin: 24px 0 12px 0; page-break-after: avoid;">
          <h3 style="font-size: 15px; font-weight: 800; color: ${theme.primaryColor}; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">
            ${contentWithMath}
          </h3>
        </div>
      `;

    case "PARAGRAPH":
      return `
        <p class="element-paragraph" style="font-size: 13.5px; line-height: 1.7; color: #334155; margin: 0 0 14px 0; text-align: justify;">
          ${contentWithMath}
        </p>
      `;

    case "CALLOUT": {
      const variant = el.variant || "NOTE";
      const isNcert = variant === "NCERT_INSIGHT";
      const calloutBg = isNcert ? "#fffbeb" : theme.bgLight;
      const calloutBorder = isNcert ? "#fde68a" : theme.borderLight;
      const calloutAccent = isNcert ? "#b45309" : theme.primaryColor;

      return `
        <div class="element-callout" style="
          background: ${calloutBg};
          border: 1.5px solid ${calloutBorder};
          border-left: 5px solid ${calloutAccent};
          border-radius: ${theme.cardRadius};
          padding: 14px 18px;
          margin: 16px 0;
          page-break-inside: avoid;
        ">
          <div style="font-size: 11px; font-weight: 800; color: ${calloutAccent}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            <span>★</span>
            <span>${el.label || (isNcert ? "NCERT Key Concept" : variant)}</span>
          </div>
          <div style="font-size: 13px; line-height: 1.65; color: #1e293b;">
            ${contentWithMath}
          </div>
        </div>
      `;
    }

    case "QUESTION":
      return `
        <div class="element-question" style="
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: ${theme.cardRadius};
          padding: 16px 20px;
          margin: 18px 0 8px 0;
          page-break-inside: avoid;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
        ">
          <div style="font-size: 13.5px; font-weight: 700; color: #0f172a; line-height: 1.6;">
            ${contentWithMath}
          </div>
        </div>
      `;

    case "OPTION":
      return `
        <div class="element-option" style="
          margin: 4px 0 4px 20px;
          font-size: 13px;
          color: #334155;
          line-height: 1.5;
          page-break-inside: avoid;
        ">
          ${contentWithMath}
        </div>
      `;

    case "SOLUTION":
      return `
        <div class="element-solution" style="
          background: #f8fafc;
          border-left: 3px solid #64748b;
          border-radius: 6px;
          padding: 10px 16px;
          margin: 8px 0 16px 20px;
          font-size: 12.5px;
          color: #475569;
          line-height: 1.6;
          page-break-inside: avoid;
        ">
          <div style="font-size: 10px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 4px;">
            Detailed Solution:
          </div>
          ${contentWithMath}
        </div>
      `;

    case "EQUATION":
      return `
        <div class="element-equation" style="
          background: ${theme.bgLight};
          border: 1px solid ${theme.borderLight};
          border-radius: 8px;
          padding: 12px 18px;
          margin: 14px 0;
          text-align: center;
          font-family: 'Fira Code', monospace;
          color: #0f172a;
          page-break-inside: avoid;
        ">
          ${contentWithMath}
        </div>
      `;

    case "DIAGRAM":
    case "IMAGE": {
      const mediaUrl = (el as any).mediaUrl || (el.content?.startsWith("http") ? el.content : null);
      return `
        <div class="element-visual" style="
          text-align: center;
          margin: 20px 0;
          padding: 14px;
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: ${theme.cardRadius};
          page-break-inside: avoid;
        ">
          ${
            mediaUrl
              ? `<img src="${mediaUrl}" alt="${el.label || "Academic Diagram"}" style="max-width: 100%; max-height: 380px; object-fit: contain; border-radius: 8px;" />`
              : `<div style="font-size: 12px; color: #64748b;">[Visual Representation: ${el.label || el.content}]</div>`
          }
          ${
            el.label
              ? `<div style="font-size: 11px; font-weight: 700; color: ${theme.primaryColor}; margin-top: 8px;">
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
                  ? `<th style="background: ${theme.primaryColor}; color: #ffffff; padding: 8px 12px; font-size: 12px; font-weight: 800; border: 1px solid ${theme.primaryDark};">${renderLatexInText(cell)}</th>`
                  : `<td style="padding: 8px 12px; font-size: 12px; color: #334155; border: 1px solid #e2e8f0; background: ${rIdx % 2 === 0 ? "#ffffff" : theme.bgLight};">${renderLatexInText(cell)}</td>`
              )
              .join("");
            return `<tr>${cellsHtml}</tr>`;
          })
          .join("");

        return `
          <div class="element-table-wrapper" style="margin: 18px 0; overflow-x: auto; page-break-inside: avoid;">
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
              ${rowsHtml}
            </table>
          </div>
        `;
      }
      return "";

    default:
      return `
        <div class="element-general" style="font-size: 13px; line-height: 1.6; color: #334155; margin-bottom: 12px;">
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
  const theme = SUBJECT_THEMES[options.subject] || SUBJECT_THEMES.CHEMISTRY;
  const isPrintMode = !!options.isPrintMode;
  const includeCover = options.includeCover ?? true;

  const headerParams: RenderHeaderFooterParams = {
    subject: options.subject,
    moduleNumber: options.moduleNumber,
    chapterName: options.chapterName,
    facultyName: options.facultyName,
    targetExam: options.targetExam,
    isPrintMode,
  };

  const coverHtml = includeCover ? generateModuleFrontCoverHtml(headerParams) : "";
  const runningHeaderHtml = generateModuleRunningHeaderHtml(headerParams);
  const runningFooterHtml = generateModuleRunningFooterHtml({ ...headerParams, pageNumber: 1, totalPages: 1 });
  const watermarkHtml = generateModuleWatermarkHtml(isPrintMode);

  // Group elements into readable pages or stream
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
      background: ${isPrintMode ? "#ffffff" : "#f1f5f9"};
      color: #0f172a;
      font-family: 'Poppins', 'Noto Sans Devanagari', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13.5px;
      line-height: 1.65;
    }

    .module-container {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: #ffffff;
      position: relative;
      box-shadow: ${isPrintMode ? "none" : "0 8px 30px rgba(0,0,0,0.12)"};
    }

    .content-body {
      padding: 0 32px 32px 32px;
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
        size: A4;
        margin: 10mm 8mm;
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
