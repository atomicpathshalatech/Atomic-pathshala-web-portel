import "server-only";
import type { ModuleElementInput } from "@/lib/validation/module";
import { parsePageTextNatively } from "./native-parser";
import { loadServerPdfJs } from "@/lib/pdf/server-pdf";
import { isKrutiDevEncoded, convertKrutiDevToUnicode } from "./krutidev-converter";

export interface ReferenceSource {
  id: string;
  name: string; // e.g. "NCERT Class 11 Chemistry", "Reference Module 01"
  type: "NCERT" | "REFERENCE_MODULE" | "EXTRA_MATERIAL";
  buffer: Buffer;
}

export interface ExtractedReferenceItem {
  sourceName: string;
  topicTitle: string;
  insightText: string;
  sourceType: "NCERT" | "REFERENCE_MODULE" | "EXTRA_MATERIAL";
}

/**
 * Extracts key academic insights from reference PDF buffers natively.
 */
export async function extractReferenceInsights(sources: ReferenceSource[]): Promise<ExtractedReferenceItem[]> {
  const insights: ExtractedReferenceItem[] = [];
  const pdfjs = await loadServerPdfJs();

  for (const src of sources) {
    try {
      const data = new Uint8Array(src.buffer);
      const doc = await pdfjs.getDocument({
        data,
        useWorkerFetch: false,
        isEvalSupported: false,
        disableFontFace: true,
      }).promise;

      const numPages = Math.min(doc.numPages, 50); // safety cap
      for (let p = 1; p <= numPages; p++) {
        const page = await doc.getPage(p);
        const textContent = await page.getTextContent();
        const rawLines = textContent.items
          .map((item: any) => item.str || "")
          .join(" ");

        const normalizedText = isKrutiDevEncoded(rawLines)
          ? convertKrutiDevToUnicode(rawLines)
          : rawLines;

        const parsedElements = parsePageTextNatively(normalizedText, p);

        // Find key callouts, summary points, formulas, or tips from reference
        let currentTopic = "";
        for (const el of parsedElements) {
          if (el.type === "HEADING" || el.type === "SUBHEADING") {
            currentTopic = el.content || "";
          } else if (
            el.type === "CALLOUT" ||
            (el.type === "PARAGRAPH" &&
              (el.content.toLowerCase().includes("ncert") ||
                el.content.toLowerCase().includes("important") ||
                el.content.toLowerCase().includes("note") ||
                el.content.toLowerCase().includes("महत्वपूर्ण") ||
                el.content.toLowerCase().includes("याद रखें")))
          ) {
            insights.push({
              sourceName: src.name,
              topicTitle: currentTopic || "General Topic",
              insightText: el.content,
              sourceType: src.type,
            });
          }
        }
      }
    } catch (err) {
      console.warn(`[reference_extract_warning] Failed reading ${src.name}:`, err);
    }
  }

  return insights;
}

/**
 * Enriches the MAIN PDF AST by injecting reference insights directly below the most relevant topic headings.
 * Does NOT disrupt the original MAIN PDF line-by-line order or questions.
 */
export function enrichMainASTWithReferences(
  mainAst: ModuleElementInput[],
  referenceInsights: ExtractedReferenceItem[],
  maxInsertionsPerTopic: number = 2
): ModuleElementInput[] {
  if (!referenceInsights || referenceInsights.length === 0) {
    return mainAst;
  }

  const enriched: ModuleElementInput[] = [];
  const usedInsights = new Set<number>();

  for (let i = 0; i < mainAst.length; i++) {
    const currentEl = mainAst[i]!;
    enriched.push(currentEl);

    // If current element is a Topic Subheading or major Heading, check for relevant reference insights
    if (currentEl.type === "HEADING" || currentEl.type === "SUBHEADING") {
      const topicWords = (currentEl.content || "")
        .toLowerCase()
        .replace(/[^a-zA-Z0-9\u0900-\u097F\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 3);

      let insertedCount = 0;

      for (let idx = 0; idx < referenceInsights.length; idx++) {
        if (usedInsights.has(idx) || insertedCount >= maxInsertionsPerTopic) continue;

        const ref = referenceInsights[idx]!;
        const refWords = `${ref.topicTitle} ${ref.insightText}`.toLowerCase();

        // Check word overlap for topic relevance
        const matches = topicWords.filter((tw) => refWords.includes(tw));
        const isRelevant = matches.length >= 2 || (topicWords.length === 1 && matches.length === 1);

        if (isRelevant) {
          usedInsights.add(idx);
          insertedCount++;

          enriched.push({
            id: `ref-enrich-${Math.random().toString(36).slice(2, 9)}`,
            type: "CALLOUT",
            variant: "NCERT_INSIGHT",
            label: `NCERT & Reference Key Insight (${ref.sourceName})`,
            content: ref.insightText,
            order: enriched.length,
          });
        }
      }
    }
  }

  return enriched;
}
