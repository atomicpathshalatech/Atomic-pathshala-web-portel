"use client";

import { exportCamDrawToSvgString } from "@/lib/camdraw/renderer";
import type { PptQuestionItem } from "@/app/api/team/questions/export-ppt/lookup/route";
import {
  buildSlidePlan,
  DEFAULT_PPT_SETTINGS,
  type PptExportSettings,
  type PptFontMode,
  type PptLanguageMode,
  type PlannedSlide,
} from "./question-ppt-plan";

export {
  buildSlidePlan,
  DEFAULT_PPT_SETTINGS,
  type PptExportSettings,
  type PptFontMode,
  type PptLanguageMode,
  type PlannedSlide,
};

async function renderCamDrawToPngDataUrl(camDrawData: unknown): Promise<string | null> {
  try {
    const svgString = exportCamDrawToSvgString(
      camDrawData as Parameters<typeof exportCamDrawToSvgString>[0],
      "light"
    );
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

      return canvas.toDataURL("image/png");
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}

export async function generateQuestionsPptx(
  questions: PptQuestionItem[],
  settings: PptExportSettings,
  filename = "Atomic_Pathshala_Questions.pptx"
): Promise<{ slideCount: number; filename: string }> {
  const slides = buildSlidePlan(questions, settings);

  // Pre-render any CamDraw vector chemical structures in the browser to 2x PNG data URLs
  const camDrawImages: Record<string, string> = {};
  await Promise.all(
    questions.map(async (q) => {
      if (q.camDrawData) {
        const png = await renderCamDrawToPngDataUrl(q.camDrawData);
        if (png) camDrawImages[q.id] = png;
      }
    })
  );

  const safeName = filename.endsWith(".pptx") ? filename : `${filename}.pptx`;

  const res = await fetch("/api/team/questions/export-ppt/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      questions,
      settings,
      filename: safeName,
      camDrawImages,
    }),
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.error || "Failed to generate PowerPoint presentation.");
  }

  const blob = await res.blob();
  const downloadUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = safeName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(downloadUrl);
  }

  return { slideCount: slides.length, filename: safeName };
}
