import fs from "fs";
import path from "path";
import PptxGenJS from "pptxgenjs";
import { parseAiJson } from "@/lib/ai/latex-json";
import { studioProviderRouter } from "@/lib/ai-studio/router";
import {
  SLIDE_THEMES,
  SLIDE_TYPES,
  type SlideElement,
  type SlideItem,
  type SlideLayoutVariant,
  type SlideOutlineItem,
  type SlideThemeConfig,
  type SlideThemeId,
  type SlideType,
  type VerbatimQuestionInput,
} from "./types";

function uid(prefix = "el"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function stripHex(color?: string, fallback = "FFFFFF"): string {
  if (!color) return fallback;
  return color.replace(/^#/, "").trim().toUpperCase() || fallback;
}

function getTheme(themeId?: string): SlideThemeConfig {
  if (themeId && themeId in SLIDE_THEMES) {
    return SLIDE_THEMES[themeId as SlideThemeId];
  }
  return SLIDE_THEMES.ATOMIC_BLACK_ORANGE;
}

export interface GenerateOutlineParams {
  topic: string;
  subject?: string | null;
  chapter?: string | null;
  audience?: string | null;
  language: string;
  medium: string;
  slideCount: number;
  contentType: string;
  purpose?: string | null;
  sourceMaterial?: string | null;
  userId?: string;
  roleName?: string;
  projectId?: string;
}

export async function generateSlideOutline(
  params: GenerateOutlineParams
): Promise<SlideOutlineItem[]> {
  const count = Math.max(3, Math.min(30, params.slideCount || 10));
  const systemPrompt = `You are the Academic Slide Architect for Atomic Pathshala (India's premier NEET, JEE & Board exam platform).
Generate a structured, high-impact slide-by-slide presentation outline.
Available slide types: ${SLIDE_TYPES.join(", ")}.
Rules:
- Adapt language (${params.language}) and medium (${params.medium}) naturally.
- Include varied slide types (do not repeat the same layout endlessly).
- For Question / MCQ / PYQ slides, explicitly specify if a real source question or diagram is needed, and NEVER invent exam years or sources.
- Return ONLY a JSON object with key "outline" containing an array of exactly ${count} items:
{
  "outline": [
    {
      "sequence": 1,
      "slideType": "Title",
      "title": "string",
      "content": "Concise bullet points or key text for this slide",
      "visualRequirement": "What visual or layout helps here",
      "diagramRequirement": "Optional diagram description or empty string",
      "questionRequirement": "Optional question/PYQ requirement or empty string",
      "explanation": "Brief pedagogical explanation",
      "teacherNotes": "What Firoz Sir / teacher should emphasize while presenting"
    }
  ]
}`;

  const prompt = `Topic: ${params.topic}
Content Type: ${params.contentType}
Subject: ${params.subject || "General Science"}
Chapter: ${params.chapter || "N/A"}
Target Audience: ${params.audience || "NEET / JEE / Board Aspirants"}
Language: ${params.language} | Medium: ${params.medium}
Presentation Purpose: ${params.purpose || "Concept clarity + exam mastery"}
Slide Count: ${count}
${params.sourceMaterial ? `\nSource Material / Script:\n${params.sourceMaterial.slice(0, 6000)}` : ""}`;

  const res = await studioProviderRouter.generateText({
    prompt,
    systemPrompt,
    taskType: "CONTENT_PLANNING",
    responseFormat: "json",
    feature: "AI_SLIDE_STUDIO",
    userId: params.userId || "system",
    roleName: params.roleName,
    projectId: params.projectId,
  });

  const parsed = parseAiJson<{ outline?: Array<Partial<SlideOutlineItem>> }>(res.text);
  const rawList = Array.isArray(parsed?.outline) ? parsed.outline : [];

  if (rawList.length === 0) {
    return Array.from({ length: count }, (_, idx) => ({
      id: uid("out"),
      sequence: idx + 1,
      slideType: idx === 0 ? "Title" : idx === count - 1 ? "CTA" : "Concept explanation",
      title: idx === 0 ? params.topic : `${params.topic} — Part ${idx + 1}`,
      content: `Key teaching points for ${params.topic} (${idx + 1}).`,
      visualRequirement: "Clean structured layout",
      teacherNotes: "Explain clearly with examples.",
    }));
  }

  return rawList.map((item, idx) => {
    const validType = SLIDE_TYPES.includes(item.slideType as SlideType)
      ? (item.slideType as SlideType)
      : "Concept explanation";
    return {
      id: uid("out"),
      sequence: Number(item.sequence) || idx + 1,
      slideType: validType,
      title: String(item.title || `Slide ${idx + 1}`),
      content: String(item.content || ""),
      visualRequirement: item.visualRequirement ? String(item.visualRequirement) : "",
      diagramRequirement: item.diagramRequirement ? String(item.diagramRequirement) : "",
      questionRequirement: item.questionRequirement ? String(item.questionRequirement) : "",
      explanation: item.explanation ? String(item.explanation) : "",
      teacherNotes: item.teacherNotes ? String(item.teacherNotes) : "",
    };
  });
}

/**
 * Builds an official Atomic Pathshala Question Slide (Black background, #F97316 orange accent,
 * "Questions No – [N]", exact source label, verbatim question text, Options 1-4, optional image,
 * and clean open workspace for live teacher annotation).
 */
export function buildVerbatimQuestionSlide(
  input: VerbatimQuestionInput,
  sequence: number,
  slideType: SlideType = "Question",
  themeId: SlideThemeId = "ATOMIC_BLACK_ORANGE"
): SlideItem {
  // Atomic Pathshala Question Slides default to Black + Orange unless Light Board is chosen
  const theme =
    themeId === "CLEAN_LIGHT_BOARD"
      ? SLIDE_THEMES.CLEAN_LIGHT_BOARD
      : SLIDE_THEMES.ATOMIC_BLACK_ORANGE;

  const hasImage = Boolean(input.imageUrl && input.imageUrl.trim().length > 0);
  const qWidth = hasImage ? 5.6 : 9.0;

  const elements: SlideElement[] = [
    // Top orange accent bar
    {
      id: uid("el"),
      type: "SHAPE",
      shapeType: "rect",
      x: 0,
      y: 0,
      w: 10,
      h: 0.08,
      fillColor: theme.accentColor,
      zIndex: 1,
    },
    // "Questions No – [N]" header pill
    {
      id: uid("el"),
      type: "QUESTION_HEADER",
      x: 0.5,
      y: 0.25,
      w: 3.1,
      h: 0.42,
      text: `Questions No – ${input.questionNumber}`,
      fontSize: 16,
      fontFace: "Arial",
      bold: true,
      color: "#FFFFFF",
      fillColor: theme.accentColor,
      align: "center",
      valign: "middle",
      zIndex: 2,
    },
    // Exact Source Label badge (never invented)
    {
      id: uid("el"),
      type: "TEXT",
      x: 3.75,
      y: 0.25,
      w: 2.5,
      h: 0.42,
      text: input.sourceLabel || "Practice Question",
      fontSize: 13,
      fontFace: "Arial",
      bold: true,
      color: theme.accentColor,
      fillColor: theme.surfaceColor,
      borderColor: theme.accentColor,
      borderWidth: 1,
      align: "center",
      valign: "middle",
      zIndex: 2,
    },
    // Atomic Pathshala Logo (top right)
    {
      id: uid("el"),
      type: "LOGO",
      x: 8.6,
      y: 0.18,
      w: 0.95,
      h: 0.52,
      imageUrl: "/atomic-logo.png",
      zIndex: 3,
    },
    // Verbatim Question Statement
    {
      id: uid("el"),
      type: "TEXT",
      x: 0.5,
      y: 0.85,
      w: qWidth,
      h: 1.45,
      text: input.questionText,
      fontSize: 17,
      fontFace: "Arial",
      bold: false,
      color: theme.textColor,
      align: "left",
      valign: "top",
      zIndex: 4,
    },
  ];

  if (hasImage && input.imageUrl) {
    elements.push({
      id: uid("el"),
      type: "IMAGE",
      x: 6.3,
      y: 0.85,
      w: 3.2,
      h: 2.2,
      imageUrl: input.imageUrl,
      zIndex: 4,
    });
  }

  // Options 1, 2, 3, 4 on the left half so the right/bottom stays open as solution workspace
  const optStartY = 2.45;
  const optH = 0.58;
  const optGap = 0.12;
  const optW = hasImage ? 5.6 : 4.8;

  input.options.forEach((opt, idx) => {
    elements.push({
      id: uid("el"),
      type: "QUESTION_OPTION",
      x: 0.5,
      y: Number((optStartY + idx * (optH + optGap)).toFixed(2)),
      w: optW,
      h: optH,
      text: `(${idx + 1})  ${opt}`,
      fontSize: 15,
      fontFace: "Arial",
      bold: false,
      color: theme.textColor,
      fillColor: theme.surfaceColor,
      borderColor: theme.borderColor,
      borderWidth: 1,
      align: "left",
      valign: "middle",
      zIndex: 5,
    });
  });

  // Solution Workspace label (subtle, unobtrusive on right side)
  if (!hasImage) {
    elements.push({
      id: uid("el"),
      type: "TEXT",
      x: 5.55,
      y: 2.45,
      w: 3.95,
      h: 2.7,
      text: "Solution Workspace",
      fontSize: 11,
      fontFace: "Arial",
      italic: true,
      color: theme.mutedTextColor,
      borderColor: theme.borderColor,
      borderWidth: 1,
      align: "left",
      valign: "top",
      zIndex: 2,
    });
  }

  return {
    id: uid("slide"),
    sequence,
    slideType,
    title: `Questions No – ${input.questionNumber}`,
    layoutVariant: "QUESTION_ATOMIC",
    backgroundColor: theme.backgroundColor,
    accentColor: theme.accentColor,
    teacherNotes: input.explanation || "Discuss concept, eliminate wrong options, and solve step-by-step.",
    sourceLabel: input.sourceLabel,
    questionNumber: input.questionNumber,
    elements,
  };
}

function chooseLayoutVariant(slideType: SlideType, index: number): SlideLayoutVariant {
  switch (slideType) {
    case "Title":
      return "TITLE_HERO";
    case "Definition":
      return "DEFINITION_CARD";
    case "Formula":
      return "FORMULA_GRID";
    case "Comparison":
      return "COMPARISON_TWO_COL";
    case "Process":
    case "Timeline":
      return "PROCESS_STEPS";
    case "Question":
    case "MCQ":
    case "PYQ":
      return "QUESTION_ATOMIC";
    case "Summary":
      return "SUMMARY_CARDS";
    case "CTA":
    case "Motivation":
      return "CTA_BANNER";
    default:
      return index % 2 === 0 ? "CONCEPT_SPLIT" : "DEFINITION_CARD";
  }
}

export function buildSlideFromOutlineDeterministic(
  item: SlideOutlineItem,
  themeId: SlideThemeId,
  questionCounter: { current: number },
  aiEnriched?: {
    headline?: string;
    bullets?: string[];
    leftTitle?: string;
    leftBody?: string;
    rightTitle?: string;
    rightBody?: string;
    questionText?: string;
    options?: [string, string, string, string];
    sourceLabel?: string;
  }
): SlideItem {
  const theme = getTheme(themeId);
  const variant = chooseLayoutVariant(item.slideType, item.sequence);

  if (variant === "QUESTION_ATOMIC") {
    questionCounter.current += 1;
    const opts = aiEnriched?.options || [
      "Option 1 (edit text)",
      "Option 2 (edit text)",
      "Option 3 (edit text)",
      "Option 4 (edit text)",
    ];
    return buildVerbatimQuestionSlide(
      {
        questionNumber: questionCounter.current,
        questionText: aiEnriched?.questionText || item.content || item.title,
        options: opts,
        sourceLabel: aiEnriched?.sourceLabel || "Practice Question",
        explanation: item.explanation || item.teacherNotes,
      },
      item.sequence,
      item.slideType,
      themeId
    );
  }

  const elements: SlideElement[] = [
    // Top accent bar
    {
      id: uid("el"),
      type: "SHAPE",
      shapeType: "rect",
      x: 0,
      y: 0,
      w: 10,
      h: 0.08,
      fillColor: theme.accentColor,
      zIndex: 1,
    },
    // Logo top-right
    {
      id: uid("el"),
      type: "LOGO",
      x: 8.65,
      y: 0.18,
      w: 0.9,
      h: 0.48,
      imageUrl: "/atomic-logo.png",
      zIndex: 3,
    },
  ];

  const headline = aiEnriched?.headline || item.title;
  const bulletsText =
    aiEnriched?.bullets && aiEnriched.bullets.length > 0
      ? aiEnriched.bullets.map((b) => `• ${b}`).join("\n\n")
      : item.content;

  if (variant === "TITLE_HERO") {
    elements.push(
      {
        id: uid("el"),
        type: "TEXT",
        x: 0.8,
        y: 1.35,
        w: 8.4,
        h: 0.4,
        text: "ATOMIC PATHSHALA  •  CONCEPT TO RANK",
        fontSize: 13,
        fontFace: "Arial",
        bold: true,
        color: theme.accentColor,
        align: "center",
        valign: "middle",
        zIndex: 2,
      },
      {
        id: uid("el"),
        type: "TEXT",
        x: 0.8,
        y: 1.9,
        w: 8.4,
        h: 1.6,
        text: headline,
        fontSize: 34,
        fontFace: "Arial",
        bold: true,
        color: theme.textColor,
        align: "center",
        valign: "middle",
        zIndex: 3,
      },
      {
        id: uid("el"),
        type: "TEXT",
        x: 1.4,
        y: 3.7,
        w: 7.2,
        h: 1.0,
        text: item.content,
        fontSize: 16,
        fontFace: "Arial",
        color: theme.mutedTextColor,
        align: "center",
        valign: "top",
        zIndex: 3,
      }
    );
  } else if (variant === "COMPARISON_TWO_COL" || variant === "CONCEPT_SPLIT") {
    // Slide Header + Type Badge
    elements.push(
      {
        id: uid("el"),
        type: "TEXT",
        x: 0.5,
        y: 0.25,
        w: 2.2,
        h: 0.34,
        text: item.slideType.toUpperCase(),
        fontSize: 10,
        fontFace: "Arial",
        bold: true,
        color: "#FFFFFF",
        fillColor: theme.accentColor,
        align: "center",
        valign: "middle",
        zIndex: 2,
      },
      {
        id: uid("el"),
        type: "TEXT",
        x: 0.5,
        y: 0.68,
        w: 8.0,
        h: 0.6,
        text: headline,
        fontSize: 24,
        fontFace: "Arial",
        bold: true,
        color: theme.textColor,
        align: "left",
        valign: "middle",
        zIndex: 3,
      },
      // Left Column Card
      {
        id: uid("el"),
        type: "TEXT",
        x: 0.5,
        y: 1.45,
        w: 4.35,
        h: 3.65,
        text: `${aiEnriched?.leftTitle ? aiEnriched.leftTitle + "\n\n" : ""}${
          aiEnriched?.leftBody || bulletsText
        }`,
        fontSize: 15,
        fontFace: "Arial",
        color: theme.textColor,
        fillColor: theme.surfaceColor,
        borderColor: theme.borderColor,
        borderWidth: 1,
        align: "left",
        valign: "top",
        zIndex: 2,
      },
      // Right Column Card
      {
        id: uid("el"),
        type: "TEXT",
        x: 5.15,
        y: 1.45,
        w: 4.35,
        h: 3.65,
        text:
          aiEnriched?.rightBody ||
          item.explanation ||
          item.visualRequirement ||
          "Key Takeaway / Exam Tip",
        fontSize: 15,
        fontFace: "Arial",
        color: theme.textColor,
        fillColor: theme.surfaceColor,
        borderColor: theme.accentColor,
        borderWidth: 1,
        align: "left",
        valign: "top",
        zIndex: 2,
      }
    );
  } else {
    // DEFINITION_CARD, FORMULA_GRID, PROCESS_STEPS, SUMMARY_CARDS, CTA_BANNER
    elements.push(
      {
        id: uid("el"),
        type: "TEXT",
        x: 0.5,
        y: 0.25,
        w: 2.2,
        h: 0.34,
        text: item.slideType.toUpperCase(),
        fontSize: 10,
        fontFace: "Arial",
        bold: true,
        color: "#FFFFFF",
        fillColor: theme.accentColor,
        align: "center",
        valign: "middle",
        zIndex: 2,
      },
      {
        id: uid("el"),
        type: "TEXT",
        x: 0.5,
        y: 0.68,
        w: 8.0,
        h: 0.6,
        text: headline,
        fontSize: 24,
        fontFace: "Arial",
        bold: true,
        color: theme.textColor,
        align: "left",
        valign: "middle",
        zIndex: 3,
      },
      {
        id: uid("el"),
        type: "TEXT",
        x: 0.5,
        y: 1.45,
        w: 9.0,
        h: 3.65,
        text: bulletsText,
        fontSize: 16,
        fontFace: "Arial",
        color: theme.textColor,
        fillColor: theme.surfaceColor,
        borderColor:
          variant === "FORMULA_GRID" || variant === "CTA_BANNER"
            ? theme.accentColor
            : theme.borderColor,
        borderWidth: variant === "FORMULA_GRID" ? 2 : 1,
        align: variant === "CTA_BANNER" ? "center" : "left",
        valign: variant === "CTA_BANNER" ? "middle" : "top",
        zIndex: 2,
      }
    );
  }

  return {
    id: uid("slide"),
    sequence: item.sequence,
    slideType: item.slideType,
    title: item.title,
    layoutVariant: variant,
    backgroundColor: theme.backgroundColor,
    accentColor: theme.accentColor,
    teacherNotes: item.teacherNotes || item.explanation || "",
    elements,
  };
}

export async function generateSlidesFromOutline(params: {
  outline: SlideOutlineItem[];
  themeId: SlideThemeId;
  topic: string;
  language: string;
  medium: string;
  userId?: string;
  roleName?: string;
  projectId?: string;
}): Promise<SlideItem[]> {
  const systemPrompt = `You are expanding an approved slide outline for Atomic Pathshala into concise, classroom-ready slide copy.
For each outline item (matched by sequence number), return clean bullet points or comparison columns or question/options.
CRITICAL: If a slide is Question/MCQ/PYQ and the outline already provides exact text, preserve it verbatim. Never invent exam years or sources.
Return ONLY JSON:
{
  "slides": [
    {
      "sequence": 1,
      "headline": "Clear slide title",
      "bullets": ["Point 1", "Point 2", "Point 3"],
      "leftTitle": "Optional left heading",
      "leftBody": "Optional left content",
      "rightTitle": "Optional right heading",
      "rightBody": "Optional right content",
      "questionText": "Only for Question/MCQ/PYQ",
      "options": ["Opt 1", "Opt 2", "Opt 3", "Opt 4"],
      "sourceLabel": "Only if known (e.g. NCERT, Practice Question)"
    }
  ]
}`;

  let enrichedMap = new Map<number, Record<string, unknown>>();
  try {
    const res = await studioProviderRouter.generateText({
      prompt: `Topic: ${params.topic}\nLanguage: ${params.language} | Medium: ${params.medium}\nOutline:\n${JSON.stringify(
        params.outline.map((o) => ({
          sequence: o.sequence,
          slideType: o.slideType,
          title: o.title,
          content: o.content,
          explanation: o.explanation,
        }))
      )}`,
      systemPrompt,
      taskType: "CONTENT_PLANNING",
      responseFormat: "json",
      feature: "AI_SLIDE_STUDIO",
      userId: params.userId || "system",
      roleName: params.roleName,
      projectId: params.projectId,
    });
    const parsed = parseAiJson<{ slides?: Array<Record<string, unknown>> }>(res.text);
    if (Array.isArray(parsed?.slides)) {
      for (const s of parsed.slides) {
        const seq = Number(s.sequence);
        if (seq) enrichedMap.set(seq, s);
      }
    }
  } catch {
    // Fallback cleanly to deterministic outline expansion
  }

  const questionCounter = { current: 0 };
  return params.outline.map((item) => {
    const raw = enrichedMap.get(item.sequence);
    const opts = Array.isArray(raw?.options) && raw.options.length === 4
      ? (raw.options.map(String) as [string, string, string, string])
      : undefined;
    return buildSlideFromOutlineDeterministic(item, params.themeId, questionCounter, {
      headline: raw?.headline ? String(raw.headline) : undefined,
      bullets: Array.isArray(raw?.bullets) ? raw.bullets.map(String) : undefined,
      leftTitle: raw?.leftTitle ? String(raw.leftTitle) : undefined,
      leftBody: raw?.leftBody ? String(raw.leftBody) : undefined,
      rightTitle: raw?.rightTitle ? String(raw.rightTitle) : undefined,
      rightBody: raw?.rightBody ? String(raw.rightBody) : undefined,
      questionText: raw?.questionText ? String(raw.questionText) : undefined,
      options: opts,
      sourceLabel: raw?.sourceLabel ? String(raw.sourceLabel) : undefined,
    });
  });
}

function loadLocalLogoBase64(): string | null {
  try {
    const logoPath = path.join(process.cwd(), "public", "atomic-logo.png");
    if (fs.existsSync(logoPath)) {
      const buf = fs.readFileSync(logoPath);
      return `data:image/png;base64,${buf.toString("base64")}`;
    }
  } catch {
    // Ignore if missing
  }
  return null;
}

/**
 * Exports a truly editable PowerPoint (.pptx) file using PptxGenJS.
 * Every text box, question header, option box, shape, logo, and image is added
 * as an individual editable PowerPoint object — NEVER flattened into a raster image.
 */
export async function exportEditablePptxBuffer(
  deckTitle: string,
  slides: SlideItem[]
): Promise<Buffer> {
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_16x9";
  pres.title = deckTitle;
  pres.author = "Atomic Pathshala AI Slide Studio";
  pres.company = "Atomic Pathshala";

  const localLogoData = loadLocalLogoBase64();

  for (const s of slides) {
    const slide = pres.addSlide();
    slide.background = { color: stripHex(s.backgroundColor, "0A0A0A") };

    if (s.teacherNotes) {
      slide.addNotes(s.teacherNotes);
    }

    const sortedElements = [...(s.elements || [])].sort(
      (a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)
    );

    for (const el of sortedElements) {
      const x = Number(el.x) || 0;
      const y = Number(el.y) || 0;
      const w = Math.max(0.2, Number(el.w) || 1);
      const h = Math.max(0.1, Number(el.h) || 0.5);

      if (el.type === "SHAPE") {
        const shapeName =
          el.shapeType === "roundRect"
            ? pres.ShapeType.roundRect
            : el.shapeType === "line"
            ? pres.ShapeType.line
            : pres.ShapeType.rect;
        slide.addShape(shapeName, {
          x,
          y,
          w,
          h,
          fill: el.fillColor ? { color: stripHex(el.fillColor) } : undefined,
          line: el.borderColor
            ? { color: stripHex(el.borderColor), width: el.borderWidth ?? 1 }
            : { type: "none" },
        });
        continue;
      }

      if (el.type === "LOGO" || el.type === "IMAGE") {
        const url = el.imageUrl || "";
        if (el.type === "LOGO" && (url === "/atomic-logo.png" || !url)) {
          if (localLogoData) {
            slide.addImage({ data: localLogoData, x, y, w, h });
          } else {
            slide.addText("ATOMIC PATHSHALA", {
              x,
              y,
              w,
              h,
              fontSize: 9,
              bold: true,
              color: "F97316",
              align: "right",
              valign: "middle",
            });
          }
          continue;
        }
        if (url.startsWith("data:image/")) {
          slide.addImage({ data: url, x, y, w, h });
        } else if (url.startsWith("http://") || url.startsWith("https://")) {
          try {
            slide.addImage({ path: url, x, y, w, h });
          } catch {
            // Fallback placeholder box if remote image fails to fetch during PPTX build
            slide.addText("[Diagram / Image Placeholder]", {
              x,
              y,
              w,
              h,
              fontSize: 11,
              color: "A3A3A3",
              fill: { color: "1A1A1A" },
              line: { color: "F97316", width: 1 },
              align: "center",
              valign: "middle",
            });
          }
        }
        continue;
      }

      // TEXT, QUESTION_HEADER, QUESTION_OPTION -> native editable PPTX textbox
      slide.addText(el.text ?? "", {
        x,
        y,
        w,
        h,
        fontSize: el.fontSize ?? 16,
        fontFace: el.fontFace ?? "Arial",
        bold: Boolean(el.bold),
        italic: Boolean(el.italic),
        color: stripHex(el.color, "FFFFFF"),
        fill: el.fillColor ? { color: stripHex(el.fillColor) } : undefined,
        line: el.borderColor
          ? { color: stripHex(el.borderColor), width: el.borderWidth ?? 1 }
          : undefined,
        align: el.align ?? "left",
        valign: el.valign ?? "top",
        margin: el.type === "QUESTION_OPTION" || el.fillColor ? 8 : 4,
        wrap: true,
      });
    }
  }

  const out = await pres.write({ outputType: "nodebuffer" });
  return Buffer.isBuffer(out) ? out : Buffer.from(out as ArrayBuffer);
}
