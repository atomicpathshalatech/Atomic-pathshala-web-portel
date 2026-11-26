import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import PptxGenJS from "pptxgenjs";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, handleApiError } from "@/lib/api/response";
import type { PptQuestionItem } from "@/app/api/team/questions/export-ppt/lookup/route";
import {
  buildSlidePlan,
  validateSlidesBeforeExport,
  type PptExportSettings,
} from "@/lib/questions/question-ppt-plan";

const BRAND_ORANGE = "F97316";
const PURE_BLACK = "000000";
const PURE_WHITE = "FFFFFF";
const BADGE_YELLOW = "FACC15";

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
  out = out.replace(/\$\$/g, "").replace(/\$/g, "");
  out = out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return out;
}

function containsDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

function toPptxRichRuns(
  rawText: string,
  baseOpts: { fontSize: number; color: string; bold?: boolean }
): PptxGenJS.TextProps[] {
  const normalized = normalizeLatexToText(rawText);
  // Nirmala UI renders both crisp Devanagari (Hindi) and Latin/scientific Unicode cleanly
  const fontFace = containsDevanagari(normalized) ? "Nirmala UI" : "Calibri";
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
          fontFace,
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
        fontFace,
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
        fontFace,
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
        fontFace,
      },
    });
  }

  return runs;
}

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

async function fetchImageDataUrlServer(imageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/png";
    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

let cachedBrandLogoDataUrl: string | null = null;
async function getBrandLogoDataUrl(): Promise<string | null> {
  if (cachedBrandLogoDataUrl) return cachedBrandLogoDataUrl;
  try {
    const logoPath = path.join(process.cwd(), "public", "brand", "logo.png");
    const buf = await fs.readFile(logoPath);
    cachedBrandLogoDataUrl = `data:image/png;base64,${buf.toString("base64")}`;
    return cachedBrandLogoDataUrl;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Unauthorized", 401);
    }
    const allowed = await hasPermission(session.user.id, PERMISSIONS.QUESTION_READ);
    if (!allowed) {
      return apiError("Forbidden: Question Bank read permission required.", 403);
    }

    const body = (await req.json().catch(() => ({}))) as {
      questions?: PptQuestionItem[];
      settings?: PptExportSettings;
      filename?: string;
      camDrawImages?: Record<string, string>;
    };

    const questions = Array.isArray(body.questions) ? body.questions : [];
    const settings = body.settings;
    const camDrawImages = body.camDrawImages ?? {};

    if (questions.length === 0 || !settings) {
      return apiError("Questions and export settings are required.", 400);
    }

    const slides = buildSlidePlan(questions, settings);
    const validation = validateSlidesBeforeExport(slides);
    if (!validation.valid) {
      return apiError("Slide validation failed before export.", 422);
    }

    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_16x9";
    pptx.author = "Atomic Pathshala";
    pptx.company = "Atomic Pathshala";
    pptx.title = "Atomic Pathshala — Question Practice";

    const [logoDataUrl] = await Promise.all([getBrandLogoDataUrl()]);

    const mediaCache = new Map<string, string | null>();
    await Promise.all(
      questions.map(async (q) => {
        if (camDrawImages[q.id]) {
          mediaCache.set(q.id, camDrawImages[q.id]!);
        } else if (q.imageUrl) {
          mediaCache.set(q.id, await fetchImageDataUrlServer(q.imageUrl));
        } else {
          mediaCache.set(q.id, null);
        }
      })
    );

    for (const planned of slides) {
      const slide = pptx.addSlide();
      // 1. Pure Black (#000000) background
      slide.background = { color: PURE_BLACK };

      const q = planned.question;

      // 2. Top-left rounded Orange pill: "Questions No – 1" (black bold text on orange)
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 0.45,
        y: 0.3,
        w: 2.65,
        h: 0.46,
        fill: { color: BRAND_ORANGE },
        line: { color: BRAND_ORANGE, width: 0 },
        rectRadius: 0.23,
      });
      slide.addText(planned.headerTitle, {
        x: 0.45,
        y: 0.3,
        w: 2.65,
        h: 0.46,
        align: "center",
        valign: "middle",
        fontSize: 15,
        bold: true,
        color: PURE_BLACK,
        fontFace: "Calibri",
        margin: 0,
      });

      // 3. Top-right original Atomic Pathshala logo (independent image object, aspect preserved)
      if (logoDataUrl) {
        slide.addImage({
          data: logoDataUrl,
          x: 12.15,
          y: 0.25,
          w: 0.72,
          h: 0.72,
          sizing: { type: "contain", w: 0.72, h: 0.72 },
        });
      }

      const mediaDataUrl = planned.kind !== "OPTIONS_ONLY" ? mediaCache.get(q.id) ?? null : null;
      const hasRightDiagram = Boolean(mediaDataUrl);
      const contentW = hasRightDiagram ? 8.15 : 11.45;
      let cursorY = 0.94;

      // 4. Question statement (left-aligned, compact, white text on black, exact original wording)
      if (planned.kind !== "OPTIONS_ONLY") {
        const combinedStmt = [planned.statementEn, planned.statementHi].filter(Boolean).join("\n\n");
        const tableData = extractFirstTable(combinedStmt);

        if (tableData) {
          const beforeText = normalizeLatexToText(tableData.textBefore);
          if (beforeText) {
            slide.addText(
              toPptxRichRuns(beforeText, { fontSize: planned.estimatedFontPt, color: PURE_WHITE }),
              {
                x: 0.45,
                y: cursorY,
                w: contentW,
                h: 0.75,
                valign: "top",
                margin: 0,
                wrap: true,
              }
            );
            cursorY += 0.78;
          }

          const pptRows: PptxGenJS.TableRow[] = tableData.rows.map((r, rIdx) =>
            r.map((cell) => ({
              text: cell,
              options: {
                fontSize: Math.max(11, planned.estimatedFontPt - 2),
                bold: rIdx === 0,
                fill: { color: rIdx === 0 ? "18181B" : PURE_BLACK },
                color: PURE_WHITE,
                border: { pt: 1, color: "52525B" },
                valign: "middle",
              },
            }))
          );
          const tableH = Math.min(1.65, pptRows.length * 0.36);
          slide.addTable(pptRows, {
            x: 0.45,
            y: cursorY,
            w: contentW,
            h: tableH,
          });
          cursorY += tableH + 0.12;

          const afterText = normalizeLatexToText(tableData.textAfter);
          if (afterText) {
            slide.addText(
              toPptxRichRuns(afterText, { fontSize: planned.estimatedFontPt, color: PURE_WHITE }),
              {
                x: 0.45,
                y: cursorY,
                w: contentW,
                h: 0.55,
                valign: "top",
                margin: 0,
                wrap: true,
              }
            );
            cursorY += 0.58;
          }
        } else {
          const stmtRuns: PptxGenJS.TextProps[] = [];
          if (planned.statementEn) {
            stmtRuns.push(
              ...toPptxRichRuns(planned.statementEn, {
                fontSize: planned.estimatedFontPt,
                color: PURE_WHITE,
              })
            );
          }
          if (planned.statementHi) {
            if (stmtRuns.length > 0) {
              stmtRuns.push({ text: "\n", options: { fontSize: planned.estimatedFontPt } });
            }
            stmtRuns.push(
              ...toPptxRichRuns(planned.statementHi, {
                fontSize: Math.max(13, planned.estimatedFontPt - 0.5),
                color: PURE_WHITE,
              })
            );
          }

          const plainLen = normalizeLatexToText(combinedStmt).length;
          const approxLines = Math.max(
            2,
            Math.ceil(plainLen / (hasRightDiagram ? 68 : 96)) +
              (combinedStmt.match(/\n/g)?.length ?? 0)
          );
          const stmtBoxH =
            planned.kind === "STATEMENT_ONLY"
              ? Math.min(3.8, Math.max(1.8, approxLines * 0.34))
              : Math.min(2.15, Math.max(0.72, approxLines * 0.3));

          slide.addText(stmtRuns, {
            x: 0.45,
            y: cursorY,
            w: contentW,
            h: stmtBoxH,
            valign: "top",
            margin: 0,
            wrap: true,
            lineSpacingMultiple: 1.15,
          });
          cursorY += stmtBoxH + 0.12;
        }

        // Right-side diagram / chemical structure (independent image object, aspect ratio preserved)
        if (mediaDataUrl) {
          slide.addImage({
            data: mediaDataUrl,
            x: 8.85,
            y: 1.1,
            w: 3.95,
            h: 2.35,
            sizing: { type: "contain", w: 3.95, h: 2.35 },
          });
        }
      }

      // 5. Dynamic Source Label badge (ONLY if metadata exists — yellow text, thin yellow outline, black bg)
      if (planned.sourceLabel) {
        const badgeW = Math.min(3.6, Math.max(1.75, planned.sourceLabel.length * 0.115 + 0.45));
        slide.addShape(pptx.ShapeType.roundRect, {
          x: 0.45,
          y: cursorY,
          w: badgeW,
          h: 0.34,
          fill: { color: PURE_BLACK },
          line: { color: BADGE_YELLOW, width: 1 },
          rectRadius: 0.17,
        });
        slide.addText(planned.sourceLabel, {
          x: 0.45,
          y: cursorY,
          w: badgeW,
          h: 0.34,
          align: "center",
          valign: "middle",
          fontSize: 11,
          bold: true,
          color: BADGE_YELLOW,
          fontFace: "Calibri",
          margin: 0,
        });
        cursorY += 0.44;
      }

      // 6. Options (vertically aligned 1, 2, 3, 4 with orange circle markers & white text; NO boxes/borders)
      if (planned.kind !== "STATEMENT_ONLY") {
        const displayOpts =
          planned.optionsEn.length > 0
            ? planned.optionsEn.map((o, i) => ({
                marker: o.marker,
                text:
                  planned.optionsHi[i]?.text && settings.language === "BILINGUAL"
                    ? `${o.text}   |   ${planned.optionsHi[i]!.text}`
                    : o.text,
              }))
            : planned.optionsHi;

        const optStartY = planned.kind === "OPTIONS_ONLY" ? 1.05 : cursorY + 0.04;
        const optRowH = 0.42;
        const optFontPt = Math.max(13, planned.estimatedFontPt - 0.5);

        displayOpts.forEach((opt, idx) => {
          const y = optStartY + idx * optRowH;
          // Editable orange circle marker
          slide.addShape(pptx.ShapeType.ellipse, {
            x: 0.48,
            y: y + 0.04,
            w: 0.28,
            h: 0.28,
            fill: { color: BRAND_ORANGE },
            line: { color: BRAND_ORANGE, width: 0 },
          });
          slide.addText(opt.marker, {
            x: 0.48,
            y: y + 0.04,
            w: 0.28,
            h: 0.28,
            align: "center",
            valign: "middle",
            fontSize: 11.5,
            bold: true,
            color: PURE_BLACK,
            fontFace: "Calibri",
            margin: 0,
          });

          // Editable white option text (no card/outline)
          slide.addText(
            toPptxRichRuns(opt.text, {
              fontSize: optFontPt,
              color: PURE_WHITE,
            }),
            {
              x: 0.88,
              y,
              w: hasRightDiagram && idx < 2 ? 7.75 : 11.8,
              h: 0.36,
              valign: "middle",
              margin: 0,
              wrap: true,
            }
          );
        });
      }
      // Lower portion of the slide remains pure blank black (#000000) for pen-tab solution writing.
    }

    const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
    const safeName =
      (body.filename || "Atomic_Pathshala_Questions.pptx")
        .replace(/[^A-Za-z0-9._-]/g, "_")
        .replace(/\.pptx$/i, "") + ".pptx";

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
