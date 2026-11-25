import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import PptxGenJS from "pptxgenjs";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, handleApiError } from "@/lib/api/response";
import type { PptQuestionItem } from "@/app/api/team/questions/export-ppt/lookup/route";
import { buildSlidePlan, type PptExportSettings } from "@/lib/questions/question-ppt-plan";

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

    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_16x9";
    pptx.author = "Atomic Pathshala";
    pptx.company = "Atomic Pathshala";
    pptx.title = settings.headerSubtitle || "Classroom Question Practice";

    const slides = buildSlidePlan(questions, settings);

    // Pre-resolve media data URLs (prefer pre-rendered CamDraw PNG, else fetch diagram URL)
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
      slide.background = { color: "FFFFFF" };

      const q = planned.question;
      const qNumLabel = `Q. ${String(planned.questionIndex + 1).padStart(2, "0")}${
        planned.kind === "OPTIONS_ONLY" ? " (Contd.)" : ""
      }`;

      slide.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: 0,
        w: 13.333,
        h: 0.1,
        fill: { color: "0050CB" },
        line: { color: "0050CB", width: 0 },
      });

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

      slide.addShape(pptx.ShapeType.line, {
        x: 0.55,
        y: 0.58,
        w: 12.23,
        h: 0,
        line: { color: "E2E8F0", width: 1 },
      });

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

      const mediaDataUrl = planned.kind !== "OPTIONS_ONLY" ? mediaCache.get(q.id) ?? null : null;
      const hasSideMedia = Boolean(mediaDataUrl) && planned.kind === "FULL";
      const statementW = hasSideMedia ? 7.9 : 12.23;

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

          const stmtBoxH = planned.kind === "STATEMENT_ONLY" ? (mediaDataUrl ? 3.2 : 5.4) : mediaDataUrl ? 2.5 : 2.35;
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

          if (mediaDataUrl) {
            const boxX = hasSideMedia ? 8.7 : 2.5;
            const boxY = hasSideMedia ? 1.15 : cursorY + stmtBoxH + 0.1;
            const boxW = hasSideMedia ? 4.05 : 8.3;
            const boxH = hasSideMedia ? 2.65 : 2.2;
            slide.addImage({
              data: mediaDataUrl,
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

    const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
    const safeName = (body.filename || "Atomic_Pathshala_Questions.pptx")
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
