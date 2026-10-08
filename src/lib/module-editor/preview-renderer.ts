import {
  HeaderFooterConfig,
  WatermarkConfig,
  ModuleTheme,
  ModuleVariables,
  BoundingBox,
  Transform,
  ModuleEditorObject,
} from "./types";
import { CoordinateEngine, DEFAULT_PAGE_SIZE } from "./coordinate-engine";
import { ThemeEngine } from "./theme-engine";

export interface HeaderFooterRenderModel {
  header: {
    visible: boolean;
    bounds: BoundingBox;
    backgroundColor: string;
    borderBottomColor: string;
    borderBottomWidth: number;
    leftText: string;
    centerText: string;
    rightText: string;
    fontFamily: string;
    fontSize: number;
    image?: {
      source: string;
      position: "left" | "center" | "right";
      width: number;
      height: number;
      x: number;
      y: number;
    };
  };
  footer: {
    visible: boolean;
    bounds: BoundingBox;
    borderTopColor: string;
    borderTopWidth: number;
    leftText: string;
    centerText: string;
    rightText: string;
    fontFamily: string;
    fontSize: number;
    image?: {
      source: string;
      position: "left" | "center" | "right";
      width: number;
      height: number;
      x: number;
      y: number;
    };
  };
}

export interface WatermarkRenderModel {
  visible: boolean;
  type: "text" | "image";
  layer: "BEHIND_CONTENT" | "ABOVE_CONTENT";
  bounds: BoundingBox;
  opacity: number;
  rotation: number;
  scale: number;
  text?: string;
  fontSize?: number;
  color?: string;
  imageSource?: string;
}

export class PreviewRenderer {
  /**
   * Replace template tokens like {page}, {subject}, {teacher}
   */
  public static interpolateVariables(template: string, vars: ModuleVariables): string {
    if (!template) return "";
    let res = template;
    res = res.replace(/\{page\}/gi, String(vars.page));
    res = res.replace(/\{totalPages\}/gi, String(vars.totalPages));
    res = res.replace(/\{subject\}/gi, vars.subject || "");
    res = res.replace(/\{chapter\}/gi, vars.chapter || "");
    res = res.replace(/\{teacher\}/gi, vars.teacher || "");
    res = res.replace(/\{date\}/gi, vars.date || "");
    res = res.replace(/\{moduleNumber\}/gi, vars.moduleNumber || "");
    res = res.replace(/\{targetExam\}/gi, vars.targetExam || "");
    return res;
  }

  /**
   * Check if a component is active on a given page number
   */
  public static isPageActive(
    pageNumber: number,
    range: "ALL" | "ODD" | "EVEN" | "CUSTOM",
    customPages?: number[],
    excludeFirstPage: boolean = false
  ): boolean {
    if (excludeFirstPage && pageNumber === 1) return false;
    if (!range || range === "ALL") return true;
    if (range === "ODD") return pageNumber % 2 !== 0;
    if (range === "EVEN") return pageNumber % 2 === 0;
    if (range === "CUSTOM") {
      return Array.isArray(customPages) && customPages.includes(pageNumber);
    }
    return true;
  }

  /**
   * Generate Live WYSIWYG Header / Footer Render Model
   */
  public static generateHeaderFooterModel(
    config: HeaderFooterConfig,
    theme: ModuleTheme,
    vars: ModuleVariables,
    pageWidth: number = DEFAULT_PAGE_SIZE.width,
    pageHeight: number = DEFAULT_PAGE_SIZE.height
  ): HeaderFooterRenderModel {
    const isVisible = config.enabled && this.isPageActive(vars.page, config.pageRange, config.customPages, config.excludeFirstPage);

    if (!isVisible) {
      return {
        header: { visible: false, bounds: { x: 0, y: 0, width: 0, height: 0 }, backgroundColor: "", borderBottomColor: "", borderBottomWidth: 0, leftText: "", centerText: "", rightText: "", fontFamily: "helvetica", fontSize: 9 },
        footer: { visible: false, bounds: { x: 0, y: 0, width: 0, height: 0 }, borderTopColor: "", borderTopWidth: 0, leftText: "", centerText: "", rightText: "", fontFamily: "helvetica", fontSize: 8 },
      };
    }

    const headerHeight = config.headerHeightPt || 36;
    const headerTopOffset = config.headerTopOffsetPt || 0;
    const footerHeight = config.footerHeightPt || 28;
    const footerBottomOffset = config.footerBottomOffsetPt || 0;

    const headerBounds: BoundingBox = {
      x: 0,
      y: headerTopOffset,
      width: pageWidth,
      height: headerHeight,
    };

    const footerBounds: BoundingBox = {
      x: 0,
      y: pageHeight - footerHeight - footerBottomOffset,
      width: pageWidth,
      height: footerHeight,
    };

    const headerStyle = ThemeEngine.getHeaderStyle(theme);
    const footerStyle = ThemeEngine.getFooterStyle(theme);

    // Image calculations for header
    let headerImageModel = undefined;
    const headerImgSrc = config.headerImageBase64 || config.headerImageUrl;
    if (headerImgSrc) {
      const imgH = (config.headerImageHeight || headerHeight) - 8;
      const imgW = imgH * 2.5; // Aspect ratio estimate for banner logo
      let imgX = 24;
      if (config.headerImagePosition === "center") imgX = (pageWidth - imgW) / 2;
      if (config.headerImagePosition === "right") imgX = pageWidth - imgW - 24;

      headerImageModel = {
        source: headerImgSrc,
        position: config.headerImagePosition || "left",
        width: imgW,
        height: imgH,
        x: imgX,
        y: headerTopOffset + (headerHeight - imgH) / 2,
      };
    }

    // Image calculations for footer
    let footerImageModel = undefined;
    const footerImgSrc = config.footerImageBase64 || config.footerImageUrl;
    if (footerImgSrc) {
      const imgH = (config.footerImageHeight || footerHeight) - 6;
      const imgW = imgH * 2.2;
      let imgX = (pageWidth - imgW) / 2;
      if (config.footerImagePosition === "left") imgX = 24;
      if (config.footerImagePosition === "right") imgX = pageWidth - imgW - 24;

      footerImageModel = {
        source: footerImgSrc,
        position: config.footerImagePosition || "center",
        width: imgW,
        height: imgH,
        x: imgX,
        y: footerBounds.y + (footerHeight - imgH) / 2,
      };
    }

    return {
      header: {
        visible: true,
        bounds: headerBounds,
        backgroundColor: headerStyle.backgroundColor,
        borderBottomColor: config.accentColor || headerStyle.borderBottomColor,
        borderBottomWidth: theme.headerBorderThickness,
        leftText: this.interpolateVariables(config.headerLeft, vars),
        centerText: this.interpolateVariables(config.headerCenter, vars),
        rightText: this.interpolateVariables(config.headerRight, vars),
        fontFamily: config.fontFamily || "helvetica",
        fontSize: config.fontSize || 9,
        image: headerImageModel,
      },
      footer: {
        visible: true,
        bounds: footerBounds,
        borderTopColor: footerStyle.borderTopColor,
        borderTopWidth: theme.structuralDividerThickness,
        leftText: this.interpolateVariables(config.footerLeft, vars),
        centerText: this.interpolateVariables(config.footerCenter, vars),
        rightText: this.interpolateVariables(config.footerRight, vars),
        fontFamily: config.fontFamily || "helvetica",
        fontSize: Math.max(7, (config.fontSize || 9) - 1.5),
        image: footerImageModel,
      },
    };
  }

  /**
   * Generate Live Watermark Render Model
   */
  public static generateWatermarkModel(
    config: WatermarkConfig,
    theme: ModuleTheme,
    pageNumber: number,
    pageWidth: number = DEFAULT_PAGE_SIZE.width,
    pageHeight: number = DEFAULT_PAGE_SIZE.height
  ): WatermarkRenderModel {
    const isVisible = config.enabled && this.isPageActive(pageNumber, config.pageRange, config.customPages, config.excludeFirstPage);

    if (!isVisible) {
      return {
        visible: false,
        type: "text",
        layer: "BEHIND_CONTENT",
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        opacity: 0,
        rotation: 0,
        scale: 1,
      };
    }

    const scale = config.scale || 1.0;
    const baseWidth = config.width || (config.type === "image" ? pageWidth * 0.5 : pageWidth * 0.7);
    const baseHeight = config.height || (config.type === "image" ? pageHeight * 0.3 : 60);

    const scaledWidth = baseWidth * scale;
    const scaledHeight = baseHeight * scale;

    let x = (pageWidth - scaledWidth) / 2;
    let y = (pageHeight - scaledHeight) / 2;

    if (config.position === "TOP") {
      y = 100;
    } else if (config.position === "BOTTOM") {
      y = pageHeight - scaledHeight - 100;
    } else if (config.position === "CUSTOM" && config.customX !== undefined && config.customY !== undefined) {
      x = config.customX;
      y = config.customY;
    }

    return {
      visible: true,
      type: config.type,
      layer: config.layer || "BEHIND_CONTENT",
      bounds: { x, y, width: scaledWidth, height: scaledHeight },
      opacity: Math.max(0.01, Math.min(1.0, config.opacity !== undefined ? config.opacity : 0.08)),
      rotation: config.rotation !== undefined ? config.rotation : (config.type === "image" ? 0 : 35),
      scale,
      text: config.text || "ATOMIC PATHSHALA",
      fontSize: config.fontSize || 32,
      color: config.color || theme.colors.primary,
      imageSource: config.base64Data || config.imageUrl,
    };
  }
}
