import { BoundingBox, Transform } from "./types";

/**
 * Standard PDF Page Formats in Points (72 pt per inch)
 */
export const PDF_PAGE_FORMATS = {
  A4: { width: 595.28, height: 841.89 },
  A3: { width: 841.89, height: 1190.55 },
  LETTER: { width: 612.0, height: 792.0 },
  LEGAL: { width: 612.0, height: 1008.0 },
};

export const DEFAULT_PAGE_SIZE = PDF_PAGE_FORMATS.A4;

/**
 * Standard DPI scale: PDF standard is 72 DPI, CSS standard is 96 DPI.
 * 1 pt = 96 / 72 = 1.333333 px.
 */
export const PT_TO_PX_RATIO = 96 / 72; // 1.333333
export const PX_TO_PT_RATIO = 72 / 96; // 0.75

export class CoordinateEngine {
  /**
   * Convert points to CSS pixels at 96 DPI
   */
  public static ptToPx(points: number): number {
    return points * PT_TO_PX_RATIO;
  }

  /**
   * Convert CSS pixels to points at 72 DPI
   */
  public static pxToPt(pixels: number): number {
    return pixels * PX_TO_PT_RATIO;
  }

  /**
   * Converts UI Coordinate (origin: Top-Left) to PDF Coordinate (origin: Bottom-Left)
   *
   * @param uiBox { x, y, width, height } where (x, y) is top-left
   * @param pageHeight Total height of the page in points
   * @returns PDF coordinate { x, y, width, height } where (x, y) is bottom-left
   */
  public static uiToPdfCoord(uiBox: BoundingBox, pageHeight: number = DEFAULT_PAGE_SIZE.height): BoundingBox {
    return {
      x: Math.round(uiBox.x * 100) / 100,
      y: Math.round((pageHeight - uiBox.y - uiBox.height) * 100) / 100,
      width: Math.round(uiBox.width * 100) / 100,
      height: Math.round(uiBox.height * 100) / 100,
    };
  }

  /**
   * Converts PDF Coordinate (origin: Bottom-Left) to UI Coordinate (origin: Top-Left)
   *
   * @param pdfBox { x, y, width, height } where (x, y) is bottom-left
   * @param pageHeight Total height of the page in points
   * @returns UI coordinate { x, y, width, height } where (x, y) is top-left
   */
  public static pdfToUiCoord(pdfBox: BoundingBox, pageHeight: number = DEFAULT_PAGE_SIZE.height): BoundingBox {
    return {
      x: Math.round(pdfBox.x * 100) / 100,
      y: Math.round((pageHeight - pdfBox.y - pdfBox.height) * 100) / 100,
      width: Math.round(pdfBox.width * 100) / 100,
      height: Math.round(pdfBox.height * 100) / 100,
    };
  }

  /**
   * Calculate centered position for an element on a page
   */
  public static getCenteredPosition(
    elementWidth: number,
    elementHeight: number,
    pageWidth: number = DEFAULT_PAGE_SIZE.width,
    pageHeight: number = DEFAULT_PAGE_SIZE.height
  ): { x: number; y: number } {
    return {
      x: Math.max(0, (pageWidth - elementWidth) / 2),
      y: Math.max(0, (pageHeight - elementHeight) / 2),
    };
  }

  /**
   * Check if two bounding boxes intersect
   */
  public static intersects(a: BoundingBox, b: BoundingBox): boolean {
    return !(
      a.x + a.width <= b.x ||
      b.x + b.width <= a.x ||
      a.y + a.height <= b.y ||
      b.y + b.height <= a.y
    );
  }

  /**
   * Check if box A completely contains box B
   */
  public static contains(a: BoundingBox, b: BoundingBox): boolean {
    return (
      b.x >= a.x &&
      b.y >= a.y &&
      b.x + b.width <= a.x + a.width &&
      b.y + b.height <= a.y + a.height
    );
  }

  /**
   * Clamp a bounding box inside the page dimensions
   */
  public static clampToPage(
    box: BoundingBox,
    pageWidth: number = DEFAULT_PAGE_SIZE.width,
    pageHeight: number = DEFAULT_PAGE_SIZE.height
  ): BoundingBox {
    const width = Math.min(box.width, pageWidth);
    const height = Math.min(box.height, pageHeight);
    const x = Math.max(0, Math.min(box.x, pageWidth - width));
    const y = Math.max(0, Math.min(box.y, pageHeight - height));
    return { x, y, width, height };
  }

  /**
   * Normalizes rotation angle to 0..359 degrees
   */
  public static normalizeRotation(degrees: number): number {
    const normalized = degrees % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  }
}
