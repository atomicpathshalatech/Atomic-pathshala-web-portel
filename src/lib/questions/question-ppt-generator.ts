"use client";

import PptxGenJS from "pptxgenjs";
import { exportCamDrawToSvgString } from "@/lib/camdraw/renderer";
import type { PptQuestionItem } from "@/app/api/team/questions/export-ppt/lookup/route";

export type PptLanguageMode = "ENGLISH" | "HINDI" | "BILINGUAL";
export type PptFontMode = "auto" | "large" | "compact";

export interface PptExportSettings {
  includeBranding: boolean;
  includeQuestionNumber: boolean;
  includeQuestionId: boolean;
  includeCorrectAnswer: boolean;
  includeSubjectHeader: boolean;
  language: PptLanguageMode;
  splitLongQuestions: boolean;
  fontSizeMode: PptFontMode;
  headerSubtitle: string;
}

export const DEFAULT_PPT_SETTINGS: PptExportSettings = {
  includeBranding: true,
  includeQuestionNumber: true,
  includeQuestionId: true,
  includeCorrectAnswer: true,
  includeSubjectHeader: true,
  language: "ENGLISH",
  splitLongQuestions: true,
  fontSizeMode: "auto",
  headerSubtitle: "NEET | QUESTION PRACTICE",
};

export interface PlannedSlide {
  slideNumber: number;
  questionIndex: number;
  question: PptQuestionItem;
  kind: "FULL" | "STATEMENT_ONLY" | "OPTIONS_ONLY";
  isSplit: boolean;
  statementEn: string;
  statementHi: string | null;
  optionsEn: Array<{ key: string; text: string }>;
  optionsHi: Array<{ key: string; text: string }>;
  correctAnswerLabel: string | null;
  estimatedFontPt: number;
}

const OPTION_ORDER = ["A", "B", "C", "D", "E", "F"];

function orderedOptions(map?: Record<string, string> | null): Array<{ key: string; text: string }> {
  if (!map) return [];
  const entries: Array<{ key: string; text: string }> = [];
  for (const key of OPTION_ORDER) {
    const val = map[key];
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      entries.push({ key, text: String(val) });
    }
  }
  // Include any non-standard keys if present
  for (const [k, v] of Object.entries(map)) {
    if (!OPTION_ORDER.includes(k) && v !== undefined && v !== null && String(v).trim() !== "") {
      entries.push({ key: k, text: String(v) });
    }
  }
  return entries;
}

function estimateContentWeight(q: PptQuestionItem, settings: PptExportSettings): number {
  const enLen = q.english?.statement?.length ?? 0;
  const hiLen = settings.language !== "ENGLISH" ? (q.hindi?.statement?.length ?? 0) : 0;
  const opts = orderedOptions(q.english?.options);
  const optChars = opts.reduce((acc, o) => acc + o.text.length, 0);
  const hasMedia = Boolean(q.camDrawData || q.imageUrl);
  const hasTable = /<table|<tr|\begin\{(matrix|pmatrix|bmatrix|array)/i.test(
    `${q.english?.statement ?? ""} ${q.hindi?.statement ?? ""}`
  );
  const lineBreaks = (q.english?.statement?.match(/\n|<br\s*\/?>/gi) ?? []).length;

  let score = enLen + hiLen * 0.9 + optChars * 0.85 + lineBreaks * 45;
  if (hasMedia) score += 280;
  if (hasTable) score += 220;
  return score;
}

/**
 * Computes the exact slide sequence used by BOTH the live preview and the
 * exported .pptx file so there is zero mismatch between preview and download.
 */
export function buildSlidePlan(
  questions: PptQuestionItem[],
  settings: PptExportSettings
): PlannedSlide[] {
  const slides: PlannedSlide[] = [];

  questions.forEach((q, qIdx) => {
    const enStmt = q.english?.statement?.trim() || "";
    const hiStmt = q.hindi?.statement?.trim() || "";
    const enOpts = orderedOptions(q.english?.options);
    const hiOpts = orderedOptions(q.hindi?.options);

    const primaryCorrect =
      q.english?.correctOptionIds?.length
        ? q.english.correctOptionIds
        : q.hindi?.correctOptionIds ?? [];
    const correctAnswerLabel =
      primaryCorrect.length > 0 ? primaryCorrect.join(", ") : null;

    const useEn = settings.language === "ENGLISH" || settings.language === "BILINGUAL" || !hiStmt;
    const useHi = (settings.language === "HINDI" || settings.language === "BILINGUAL") && Boolean(hiStmt);

    const statementEn = useEn ? enStmt : "";
    const statementHi = useHi ? hiStmt : null;
    const optionsEn = useEn ? enOpts : [];
    const optionsHi = useHi ? hiOpts : [];

    const weight = estimateContentWeight(q, settings);
    const shouldSplit =
      settings.splitLongQuestions &&
      (weight > 780 || (settings.language === "BILINGUAL" && weight > 620)) &&
      (optionsEn.length > 0 || optionsHi.length > 0);

    const baseFontPt =
      settings.fontSizeMode === "large"
        ? 19
        : settings.fontSizeMode === "compact"
        ? 14
        : weight > 650
        ? 14
        : weight > 420
        ? 16
        : 18;

    if (shouldSplit) {
      slides.push({
        slideNumber: slides.length + 1,
        questionIndex: qIdx,
        question: q,
        kind: "STATEMENT_ONLY",
        isSplit: true,
        statementEn,
        statementHi,
        optionsEn: [],
        optionsHi: [],
        correctAnswerLabel: null,
        estimatedFontPt: Math.min(18, baseFontPt + 1),
      });
      slides.push({
        slideNumber: slides.length + 1,
        questionIndex: qIdx,
        question: q,
        kind: "OPTIONS_ONLY",
        isSplit: true,
        statementEn: "",
        statementHi: null,
        optionsEn,
        optionsHi,
        correctAnswerLabel,
        estimatedFontPt: Math.min(18, baseFontPt + 1),
      });
    } else {
      slides.push({
        slideNumber: slides.length + 1,
        questionIndex: qIdx,
        question: q,
        kind: "FULL",
        isSplit: false,
        statementEn,
        statementHi,
        optionsEn,
        optionsHi,
        correctAnswerLabel,
        estimatedFontPt: baseFontPt,
      });
    }
  });

  return slides;
}

// ============================================================================
// LaTeX / HTML -> Readable PowerPoint Rich Text & Native Table Converters
// ============================================================================

const LATEX_SYMBOLS: Array<[RegExp, string]> = [
  [/\\rightleftharpoons/g, " ⇌ "],
  [/\\leftrightarrow/g, " ↔ "],
  [/\\xrightarrow\{([^}]*)\}/g, " —($1)→ "],
  [/\\rightarrow|\\to/g, " → "],
  [/\\leftarrow/g, " ← "],
  [/\\Rightarrow/g, " ⇒ "],
  [/\\uparrow/g, "↑"],
  [/\\downarrow/g, "↓"],
  [/\\Delta/g, "Δ"],
  [/\\alpha/g, "α"],
  [/\\beta/g, "β"],
  [/\\gamma/g, "γ"],
  [/\\theta/g, "θ"],
  [/\\lambda/g, "λ"],
  [/\\mu/g, "μ"],
  [/\\pi/g, "π"],
  [/\\sigma/g, "σ"],
  [/\\omega/g, "ω"],
  [/\\Omega/g, "Ω"],
  [/\\phi/g, "φ"],
  [/\\rho/g, "ρ"],
  [/\\eta/g, "η"],
  [/\\epsilon/g, "ε"],
  [/\\infty/g, "∞"],
  [/\\times/g, "×"],
  [/\\div/g, "÷"],
  [/\\cdot/g, "·"],
  [/\\pm/g, "±"],
  [/\\mp/g, "∓"],
  [/\\approx/g, "≈"],
  [/\\neq/g, "≠"],
  [/\\leq/g, "≤"],
  [/\\geq/g, "≥"],
  [/\\equiv/g, "≡"],
  [/\\propto/g, "∝"],
  [/\\degree|\^\\circ/g, "°"],
  [/\\sqrt\{([^}]*)\}/g, "√($1)"],
  [/\\frac\{([^}]*)\}\{([^}]*)\}/g, "($1)/($2)"],
  [/\\text\{([^}]*)\}/g, "$1"],
  [/\\mathrm\{([^}]*)\}/g, "$1"],
  [/\\mathbf\{([^}]*)\}/g, "$1"],
  [/\\left|\\right/g, ""],
];

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&rarr;/gi, "→")
    .replace(/&larr;/gi, "←")
    .replace(/&harr;/gi, "↔")
    .replace(/&deg;/gi, "°")
    .replace(/&times;/gi, "×")
    .replace(/&plusmn;/gi, "±")
    .replace(/&Delta;/g, "Δ");
}

function normalizeLatexToText(raw: string): string {
  let out = raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/div>/gi, "\n")
    .replace(/<div[^>]*>/gi, "")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<sup>(.*?)<\/sup>/gi, "^{$1}")
    .replace(/<sub>(.*?)<\/sub>/gi, "_{$1}")
    .replace(/<[^>]+>/g, "");

  out = decodeHtmlEntities(out);
  for (const [pattern, replacement] of LATEX_SYMBOLS) {
    out = out.replace(pattern, replacement);
  }
  // Clean remaining $ delimiters while keeping content intact
  out = out.replace(/\$\$/g, "").replace(/\$/g, "");
  out = out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return out;
}

/**
 * Converts text containing ^{...} / _{...} or ^x / _x into pptxgenjs TextProps
 * with native PowerPoint superscript and subscript formatting.
 */
function toPptxRichRuns(
  rawText: string,
  baseOpts: { fontSize: number; color: string; bold?: boolean; fontFace?: string }
): PptxGenJS.TextProps[] {
  const normalized = normalizeLatexToText(rawText);
  const runs: PptxGenJS.TextProps[] = [];
  const tokenRegex = /(\^\{[^}]+\}|_\{[^}]+\}|\^[A-Za-z0-9+\-]|_[A-Za-z0-9+\-])/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(normalized)) !== null) {
    if (match.index > lastIndex) {
      runs.push({
        text: normalized.slice(lastIndex, match.index),
        options: {
          fontSize: baseOpts.fontSize,
          color: baseOpts.color,
          bold: baseOpts.bold,
          fontFace: baseOpts.fontFace ?? "Calibri",
        },
      });
    }
    const token = match[0];
    const isSup = token.startsWith("^");
    const inner = token.slice(1).replace(/^\{|\}$/g, "");
    runs.push({
      text: inner,
      options: {
        fontSize: baseOpts.fontSize,
        color: baseOpts.color,
        bold: baseOpts.bold,
        fontFace: baseOpts.fontFace ?? "Calibri",
        superscript: isSup,
        subscript: !isSup,
      },
    });
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < normalized.length) {
    runs.push({
      text: normalized.slice(lastIndex),
      options: {
        fontSize: baseOpts.fontSize,
        color: baseOpts.color,
        bold: baseOpts.bold,
        fontFace: baseOpts.fontFace ?? "Calibri",
      },
    });
  }

  if (runs.length === 0) {
    runs.push({
      text: normalized,
      options: {
        fontSize: baseOpts.fontSize,
        color: baseOpts.color,
        bold: baseOpts.bold,
        fontFace: baseOpts.fontFace ?? "Calibri",
      },
    });
  }

  return runs;
}

/** Extracts an HTML <table> into rows of cells if present in the statement. */
function extractFirstTable(raw: string): { textBefore: string; rows: string[][]; textAfter: string } | null {
  const tableMatch = raw.match(/<table[\s\S]*?<\/table>/i);
  if (!tableMatch || tableMatch.index === undefined) return null;

  const htmlTable = tableMatch[0];
  const rowMatches = htmlTable.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const rows: string[][] = [];
  for (const rowHtml of rowMatches) {
    const cellMatches = rowHtml.match(/<(?:td|th)[^>]*>[\s\S]*?<\/(?:td|th)>/gi) ?? [];
    const cells = cellMatches.map((c) => normalizeLatexToText(c));
    if (cells.length > 0) rows.push(cells);
  }
  if (rows.length === 0) return null;

  return {
    textBefore: raw.slice(0, tableMatch.index),
    rows,
    textAfter: raw.slice(tableMatch.index + htmlTable.length),
  };
}

// ============================================================================
// High-DPI Image & CamDraw SVG -> PNG Data URL Helpers
// ============================================================================

async function renderCamDrawToPngDataUrl(camDrawData: unknown): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const svgString = exportCamDrawToSvgString(camDrawData as Parameters<typeof exportCamDrawToSvgString>[0], "light");
    if (!svgString) return null;

    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = url;
      });

      const scale = 2;
      const w = Math.max(1, img.naturalWidth || 600);
      const h = Math.max(1, img.naturalHeight || 360);
      const canvas = document.createElement("canvas");
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, w, h);

      return {
        dataUrl: canvas.toDataURL("image/png"),
        width: w,
        height: h,
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}

async function fetchImageAsDataUrl(imageUrl: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    if (!dataUrl) return null;

    const dims = await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth || 400, height: img.naturalHeight || 250 });
      img.onerror = () => resolve({ width: 400, height: 250 });
      img.src = dataUrl;
    });
    return { dataUrl, ...dims };
  } catch {
    return null;
  }
}

// ============================================================================
// Main PPTX Generation & Download
// ============================================================================

export async function generateQuestionsPptx(
  questions: PptQuestionItem[],
  settings: PptExportSettings,
  filename = "Atomic_Pathshala_Questions.pptx"
): Promise<{ slideCount: number; filename: string }> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "Atomic Pathshala";
  pptx.company = "Atomic Pathshala";
  pptx.title = settings.headerSubtitle || "Classroom Question Practice";

  const slides = buildSlidePlan(questions, settings);

  // Pre-render all CamDraw & Diagram images in parallel
  const mediaCache = new Map<string, { dataUrl: string; width: number; height: number } | null>();
  await Promise.all(
    questions.map(async (q) => {
      if (q.camDrawData) {
        mediaCache.set(q.id, await renderCamDrawToPngDataUrl(q.camDrawData));
      } else if (q.imageUrl) {
        mediaCache.set(q.id, await fetchImageAsDataUrl(q.imageUrl));
      } else {
        mediaCache.set(q.id, null);
      }
    })
  );

  for (const planned of slides) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };

    const q = planned.question;
    const qNumLabel = `Q. ${String(planned.questionIndex + 1).padStart(2, "0")}${
      planned.kind === "OPTIONS_ONLY" ? " (Contd.)" : ""
    }`;

    // Top Accent Bar
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 13.333,
      h: 0.1,
      fill: { color: "0050CB" },
      line: { color: "0050CB", width: 0 },
    });

    // Header Branding & Subject Row
    if (settings.includeBranding) {
      slide.addText(
        [
          { text: "ATOMIC PATHSHALA", options: { bold: true, color: "0050CB", fontSize: 13, fontFace: "Calibri" } },
          {
            text: `   |   ${
              settings.includeSubjectHeader && q.subject
                ? `${q.subject.toUpperCase()} • ${settings.headerSubtitle}`
                : settings.headerSubtitle
            }`,
            options: { bold: true, color: "64748B", fontSize: 10.5, fontFace: "Calibri" },
          },
        ],
        { x: 0.55, y: 0.18, w: 9.0, h: 0.35, margin: 0 }
      );
    } else if (settings.includeSubjectHeader && q.subject) {
      slide.addText(q.subject.toUpperCase(), {
        x: 0.55,
        y: 0.18,
        w: 8.5,
        h: 0.35,
        fontSize: 11,
        bold: true,
        color: "64748B",
        margin: 0,
      });
    }

    // Top-right Question ID badge
    if (settings.includeQuestionId) {
      const code = q.questionCode || q.id;
      slide.addText(`ID: ${code}`, {
        x: 9.6,
        y: 0.18,
        w: 3.2,
        h: 0.32,
        align: "right",
        fontSize: 10,
        bold: true,
        color: "475569",
        fontFace: "Consolas",
        margin: 0,
      });
    }

    // Subtle divider below header
    slide.addShape(pptx.ShapeType.line, {
      x: 0.55,
      y: 0.58,
      w: 12.23,
      h: 0,
      line: { color: "E2E8F0", width: 1 },
    });

    // TOP: Question Number
    let cursorY = 0.72;
    if (settings.includeQuestionNumber) {
      slide.addText(qNumLabel, {
        x: 0.55,
        y: cursorY,
        w: 3.0,
        h: 0.38,
        fontSize: 16,
        bold: true,
        color: "0050CB",
        fontFace: "Calibri",
        margin: 0,
      });
      cursorY += 0.42;
    }

    const media = planned.kind !== "OPTIONS_ONLY" ? mediaCache.get(q.id) ?? null : null;
    const hasSideMedia = Boolean(media) && planned.kind === "FULL";
    const statementW = hasSideMedia ? 7.9 : 12.23;

    // CENTER: Question Statement (English / Hindi / Bilingual)
    if (planned.kind !== "OPTIONS_ONLY") {
      const combinedStmt = [planned.statementEn, planned.statementHi].filter(Boolean).join("\n\n");
      const tableData = extractFirstTable(combinedStmt);

      if (tableData) {
        const beforeText = normalizeLatexToText(tableData.textBefore);
        if (beforeText) {
          slide.addText(
            toPptxRichRuns(beforeText, {
              fontSize: planned.estimatedFontPt,
              color: "0F172A",
            }),
            {
              x: 0.55,
              y: cursorY,
              w: statementW,
              h: 1.0,
              valign: "top",
              margin: 0,
              wrap: true,
            }
          );
          cursorY += 1.05;
        }

        const pptRows: PptxGenJS.TableRow[] = tableData.rows.map((r, rIdx) =>
          r.map((cell) => ({
            text: cell,
            options: {
              fontSize: Math.max(11, planned.estimatedFontPt - 2),
              bold: rIdx === 0,
              fill: { color: rIdx === 0 ? "EFF6FF" : "FFFFFF" },
              color: "0F172A",
              border: { pt: 1, color: "CBD5E1" },
              valign: "middle",
            },
          }))
        );
        const tableH = Math.min(2.2, pptRows.length * 0.42);
        slide.addTable(pptRows, {
          x: 0.55,
          y: cursorY,
          w: statementW,
          h: tableH,
        });
        cursorY += tableH + 0.15;

        const afterText = normalizeLatexToText(tableData.textAfter);
        if (afterText) {
          slide.addText(
            toPptxRichRuns(afterText, {
              fontSize: planned.estimatedFontPt,
              color: "0F172A",
            }),
            {
              x: 0.55,
              y: cursorY,
              w: statementW,
              h: 0.8,
              valign: "top",
              margin: 0,
              wrap: true,
            }
          );
          cursorY += 0.85;
        }
      } else {
        const stmtRuns: PptxGenJS.TextProps[] = [];
        if (planned.statementEn) {
          stmtRuns.push(
            ...toPptxRichRuns(planned.statementEn, {
              fontSize: planned.estimatedFontPt,
              color: "0F172A",
            })
          );
        }
        if (planned.statementHi) {
          if (stmtRuns.length > 0) {
            stmtRuns.push({ text: "\n\n", options: { fontSize: planned.estimatedFontPt } });
          }
          stmtRuns.push(
            ...toPptxRichRuns(planned.statementHi, {
              fontSize: Math.max(13, planned.estimatedFontPt - 1),
              color: "1E293B",
            })
          );
        }

        const stmtBoxH = planned.kind === "STATEMENT_ONLY" ? (media ? 3.2 : 5.4) : media ? 2.5 : 2.35;
        slide.addText(stmtRuns, {
          x: 0.55,
          y: cursorY,
          w: statementW,
          h: stmtBoxH,
          valign: "top",
          margin: 0,
          wrap: true,
          lineSpacingMultiple: 1.18,
        });

        // Embed Diagram / CamDraw preserving aspect ratio
        if (media) {
          const boxX = hasSideMedia ? 8.7 : 2.5;
          const boxY = hasSideMedia ? 1.15 : cursorY + stmtBoxH + 0.1;
          const boxW = hasSideMedia ? 4.05 : 8.3;
          const boxH = hasSideMedia ? 2.65 : 2.2;
          slide.addImage({
            data: media.dataUrl,
            x: boxX,
            y: boxY,
            w: boxW,
            h: boxH,
            sizing: { type: "contain", w: boxW, h: boxH },
          });
        }

        cursorY += stmtBoxH + 0.15;
      }
    }

    // BELOW QUESTION: Options (A, B, C, D)
    if (planned.kind !== "STATEMENT_ONLY") {
      const displayOpts =
        planned.optionsEn.length > 0
          ? planned.optionsEn.map((o, i) => ({
              key: o.key,
              text:
                planned.optionsHi[i]?.text && settings.language === "BILINGUAL"
                  ? `${o.text}   |   ${planned.optionsHi[i]!.text}`
                  : o.text,
            }))
          : planned.optionsHi;

      if (displayOpts.length > 0) {
        const optStartY = planned.kind === "OPTIONS_ONLY" ? 1.3 : Math.max(cursorY, 3.75);
        const availH = Math.max(1.8, 6.55 - optStartY);
        const rowH = Math.min(0.68, availH / displayOpts.length);
        const optFontPt = Math.max(12.5, planned.estimatedFontPt - 1.5);

        displayOpts.forEach((opt, idx) => {
          const y = optStartY + idx * rowH;
          slide.addShape(pptx.ShapeType.roundRect, {
            x: 0.55,
            y,
            w: 12.23,
            h: rowH - 0.08,
            fill: { color: "F8FAFC" },
            line: { color: "CBD5E1", width: 1 },
            rectRadius: 0.08,
          });

          slide.addText(
            [
              {
                text: `${opt.key}.  `,
                options: {
                  fontSize: optFontPt,
                  bold: true,
                  color: "0050CB",
                  fontFace: "Calibri",
                },
              },
              ...toPptxRichRuns(opt.text, {
                fontSize: optFontPt,
                color: "0F172A",
              }),
            ],
            {
              x: 0.72,
              y: y + 0.04,
              w: 11.9,
              h: rowH - 0.16,
              valign: "middle",
              margin: 0,
              wrap: true,
            }
          );
        });
      }
    }

    // BOTTOM: Correct Answer Footer (Letter/identifier ONLY — NO solution)
    slide.addShape(pptx.ShapeType.line, {
      x: 0.55,
      y: 6.78,
      w: 12.23,
      h: 0,
      line: { color: "E2E8F0", width: 1 },
    });

    if (settings.includeCorrectAnswer && planned.kind !== "STATEMENT_ONLY") {
      const answerText = planned.correctAnswerLabel
        ? `Correct Answer: ${planned.correctAnswerLabel}`
        : "Correct Answer: Not Available";
      slide.addText(answerText, {
        x: 0.55,
        y: 6.88,
        w: 8.0,
        h: 0.42,
        fontSize: 15,
        bold: true,
        color: planned.correctAnswerLabel ? "15803D" : "B91C1C",
        fontFace: "Calibri",
        margin: 0,
      });
    }

    // Slide Number bottom-right
    slide.addText(`Slide ${planned.slideNumber} / ${slides.length}`, {
      x: 10.5,
      y: 6.9,
      w: 2.28,
      h: 0.35,
      align: "right",
      fontSize: 10,
      color: "64748B",
      fontFace: "Calibri",
      margin: 0,
    });
  }

  const safeName = filename.endsWith(".pptx") ? filename : `${filename}.pptx`;
  await pptx.writeFile({ fileName: safeName });
  return { slideCount: slides.length, filename: safeName };
}
