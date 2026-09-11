import "server-only";
import React from "react";
import type { ReactElement } from "react";
import type { LayoutConfig, TextBlock } from "./layout-types";
import { DEFAULT_LAYER_ORDER } from "./layout-types";
import type { BackgroundValue } from "./background-types";
import { backgroundCss } from "./background-types";
import type { CreativeContentData } from "./content-types";

const PLACEHOLDER_SILHOUETTE =
  "data:image/svg+xml;base64," +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#334155"/><circle cx="100" cy="78" r="38" fill="#64748b"/><path d="M30 190c0-45 32-78 70-78s70 33 70 78z" fill="#64748b"/></svg>`
  ).toString("base64");

function resolveTextValue(field: TextBlock["field"], content: CreativeContentData): string {
  switch (field) {
    case "title":
      return content.title;
    case "subtitle":
      return content.subtitle ?? "";
    case "educatorName":
      return content.educators[0]?.name ?? "";
    case "educatorNames":
      return content.educators.map((e) => e.name).join("  •  ");
    case "batchName":
      return content.batchName ?? "";
    case "chapterName":
      return content.chapterName ?? "";
    case "subjectName":
      return content.subjectName ?? "";
    case "lectureLabel":
      return content.lectureLabel ?? "";
    case "lectureTitle":
      return content.lectureTitle ?? "";
    case "lectureCount":
      return content.lectureCount !== undefined ? `${content.lectureCount} Lecture${content.lectureCount === 1 ? "" : "s"}` : "";
    case "examOrCourse":
      return content.examOrCourse ?? "";
    default:
      return "";
  }
}

/**
 * The ONE rendering function for every creative type (spec section 13 —
 * "do not duplicate rendering logic across Batch, Chapter, Test Series and
 * Lecture"). Takes a LayoutConfig (design) + CreativeContentData (content) +
 * background and produces the JSX tree next/og's ImageResponse rasterizes.
 * Every position is a percentage of the canvas, so the same config renders
 * correctly at any of the output presets in render-presets.ts.
 */
export function buildCreativeElement(
  layout: LayoutConfig,
  content: CreativeContentData,
  background: BackgroundValue,
  logoUrl?: string
): ReactElement {
  const order = layout.layerOrder ?? DEFAULT_LAYER_ORDER;
  const { width, height } = layout;

  const layers: Record<string, ReactElement | null> = {
    background: renderBackground(background, width, height),
    decorative: null, // reserved for future template decorative elements
    logo: layout.logo && logoUrl ? renderLogo(layout.logo, logoUrl, width, height) : null,
    text: (
      <div key="text" style={{ position: "absolute", inset: 0, display: "flex" }}>
        {layout.text.map((tb, i) => renderTextBlock(tb, content, width, height, i))}
      </div>
    ),
    educators: renderEducatorArea(layout.educatorArea, content, width, height),
    badges: null,
  };

  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        position: "relative",
        overflow: "hidden",
        fontFamily: '"Inter", "Segoe UI", sans-serif',
      }}
    >
      {order.map((k) => layers[k]).filter(Boolean)}
    </div>
  );
}

function renderBackground(bg: BackgroundValue, width: number, height: number): ReactElement {
  if (bg.kind === "IMAGE") {
    return (
      <div key="bg" style={{ position: "absolute", inset: 0, display: "flex" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bg.url} width={width} height={height} style={{ objectFit: "cover", width, height }} alt="" />
        {bg.overlayColor && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: bg.overlayColor,
              opacity: bg.overlayOpacity ?? 0.35,
              display: "flex",
            }}
          />
        )}
      </div>
    );
  }
  return <div key="bg" style={{ position: "absolute", inset: 0, background: backgroundCss(bg), display: "flex" }} />;
}

function renderLogo(logo: NonNullable<LayoutConfig["logo"]>, url: string, width: number, height: number): ReactElement {
  return (
    <div
      key="logo"
      style={{
        position: "absolute",
        left: (logo.xPct / 100) * width,
        top: (logo.yPct / 100) * height,
        width: (logo.widthPct / 100) * width,
        height: (logo.heightPct / 100) * height,
        display: "flex",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} style={{ width: "100%", height: "100%", objectFit: "contain" }} alt="" />
    </div>
  );
}

function renderTextBlock(tb: TextBlock, content: CreativeContentData, width: number, height: number, key: number): ReactElement | null {
  const value = resolveTextValue(tb.field, content);
  if (!value) return null;
  const text = tb.uppercase ? value.toUpperCase() : value;

  const inner = (
    <span
      style={{
        display: "block",
        fontSize: tb.fontSizePx,
        fontWeight: tb.fontWeight,
        color: tb.color,
        letterSpacing: tb.letterSpacingPx,
        lineHeight: 1.15,
      }}
    >
      {text}
    </span>
  );

  return (
    <div
      key={key}
      style={{
        position: "absolute",
        left: (tb.xPct / 100) * width,
        top: (tb.yPct / 100) * height,
        maxWidth: (tb.maxWidthPct / 100) * width,
        display: "flex",
        justifyContent: tb.align === "center" ? "center" : tb.align === "right" ? "flex-end" : "flex-start",
      }}
    >
      {tb.badge ? (
        <div
          style={{
            display: "flex",
            backgroundColor: tb.badge.backgroundColor,
            padding: `${tb.badge.paddingYPx}px ${tb.badge.paddingXPx}px`,
            borderRadius: tb.badge.radiusPx,
          }}
        >
          {inner}
        </div>
      ) : (
        inner
      )}
    </div>
  );
}

function renderEducatorArea(
  area: LayoutConfig["educatorArea"],
  content: CreativeContentData,
  width: number,
  height: number
): ReactElement {
  const educators = content.educators.slice(0, area.maxCount);
  const areaX = (area.xPct / 100) * width;
  const areaY = (area.yPct / 100) * height;
  const areaW = (area.widthPct / 100) * width;
  const areaH = (area.heightPct / 100) * height;
  const cellW = (area.itemWidthPct / 100) * areaW;
  const cellH = (area.itemHeightPct / 100) * areaH;
  const gap = ((area.gapPct ?? 4) / 100) * areaW;

  const count = Math.max(educators.length, 1);
  const rowWidth = count * cellW + (count - 1) * gap;
  const startX = areaX + Math.max(0, (areaW - rowWidth) / 2);
  const startY = areaY + Math.max(0, (areaH - cellH) / 2);

  const radius = area.shape === "circle" ? cellW / 2 : area.shape === "rounded" ? 16 : 0;

  if (educators.length === 0) {
    // Fallback: a clearly-labeled placeholder, never a silently-swapped low-quality image (spec section 18).
    return (
      <div
        key="educators"
        style={{
          position: "absolute",
          left: startX,
          top: startY,
          width: cellW,
          height: cellH,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radius,
          overflow: "hidden",
          backgroundColor: "#1e293b",
          border: "2px dashed #475569",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PLACEHOLDER_SILHOUETTE} style={{ width: "60%", height: "60%", objectFit: "contain", opacity: 0.6 }} alt="" />
      </div>
    );
  }

  return (
    <div key="educators" style={{ position: "absolute", inset: 0, display: "flex" }}>
      {educators.map((edu, i) => {
        const cx = startX + i * (cellW + gap);
        const imgSrc = edu.imageUrl || PLACEHOLDER_SILHOUETTE;
        return (
          <div
            key={edu.teacherId}
            style={{
              position: "absolute",
              left: cx,
              top: startY,
              width: cellW,
              height: cellH,
              display: "flex",
              borderRadius: radius,
              overflow: "hidden",
              border: area.borderColor ? `${area.borderWidthPx ?? 4}px solid ${area.borderColor}` : undefined,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgSrc}
              style={{
                width: "100%",
                height: "100%",
                objectFit: area.fit,
                objectPosition: area.anchor === "bottom" ? "center bottom" : area.anchor === "top" ? "center top" : "center center",
              }}
              alt=""
            />
          </div>
        );
      })}
    </div>
  );
}
