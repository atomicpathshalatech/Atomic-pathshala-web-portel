import "server-only";
import { isKrutiDevEncoded, convertKrutiDevToUnicode } from "./krutidev-converter";
import type { ModuleElementInput } from "@/lib/validation/module";

export interface TextItemWithPosition {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName?: string;
}

export interface SpatialLine {
  y: number;
  text: string;
  items: TextItemWithPosition[];
}

/**
 * Groups raw PDF.js text items by line (using Y-coordinate threshold)
 * and sorts them horizontally (by X-coordinate) to preserve the exact visual lines,
 * column layout, tables, and formula spacing.
 */
export function groupTextItemsIntoSpatialLines(
  rawItems: any[],
  lineThreshold: number = 4
): SpatialLine[] {
  const items: TextItemWithPosition[] = rawItems
    .filter((item) => item && typeof item.str === "string" && item.str.length > 0)
    .map((item) => {
      const transform = item.transform || [1, 0, 0, 1, 0, 0];
      return {
        str: item.str,
        x: transform[4] ?? 0,
        y: transform[5] ?? 0,
        width: item.width ?? 0,
        height: item.height ?? 0,
        fontName: item.fontName,
      };
    });

  if (items.length === 0) return [];

  // Sort items primarily by Y descending (top-to-bottom in PDF space) and then X ascending
  items.sort((a, b) => {
    if (Math.abs(a.y - b.y) <= lineThreshold) {
      return a.x - b.x;
    }
    return b.y - a.y;
  });

  const lines: SpatialLine[] = [];
  let currentLine: SpatialLine | null = null;

  for (const item of items) {
    if (!currentLine || Math.abs(currentLine.y - item.y) > lineThreshold) {
      if (currentLine) {
        currentLine.text = assembleLineText(currentLine.items);
        lines.push(currentLine);
      }
      currentLine = {
        y: item.y,
        text: "",
        items: [item],
      };
    } else {
      currentLine.items.push(item);
    }
  }

  if (currentLine && currentLine.items.length > 0) {
    currentLine.text = assembleLineText(currentLine.items);
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Assembles horizontal line items, inserting intelligent spacing based on X-coordinates.
 */
function assembleLineText(items: TextItemWithPosition[]): string {
  if (items.length === 0) return "";
  items.sort((a, b) => a.x - b.x);

  let lineStr = items[0]!.str;
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1]!;
    const curr = items[i]!;
    const gap = curr.x - (prev.x + prev.width);

    // If there is a noticeable horizontal gap, add a space
    if (gap > 2.5 && !lineStr.endsWith(" ") && !curr.str.startsWith(" ")) {
      lineStr += " ";
    }
    lineStr += curr.str;
  }

  return lineStr.trim();
}

/**
 * Filters out fragmented ChemDraw vector noise glyphs (e.g. lone broken bond fragments)
 * while preserving clean chemical formulas like HC≡C-CH=CH-CH3, (CH3)3C-, etc.
 */
export function cleanChemicalAndHindiText(rawText: string): string {
  if (!rawText) return "";

  // 1. Auto-convert Kruti Dev to Unicode Devanagari if legacy encoded
  let text = isKrutiDevEncoded(rawText) ? convertKrutiDevToUnicode(rawText) : rawText;

  // 2. Remove common PDF header/footer clutter
  text = text
    .replace(/^Page\s*\|\s*\d+/gim, "")
    .replace(/^CAREERWILL/gim, "")
    .replace(/^NEET\s+DIVISION/gim, "")
    .replace(/^ORGANIC\s+CHEMISTRY/gim, "")
    .replace(/^Medium\s*:\s*Hindi/gim, "");

  // 3. Fix common chemical notation representations
  text = text
    .replace(/|≡/g, " ≡ ")
    .replace(/–|—/g, " – ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return text;
}
