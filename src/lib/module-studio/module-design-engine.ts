import "server-only";
import katex from "katex";
import { renderFormulaContent } from "@/lib/test-portal/formula";
import type { ModuleElementInput } from "@/lib/validation/module";

export type ModuleLayoutStyle =
  | "MODERN_ACADEMIC"
  | "PREMIUM_EDTECH"
  | "EXAM_REVISION"
  | "CONCEPT_MAP"
  | "NCERT_ACADEMIC"
  | "VISUAL_LEARNING";

export interface LayoutStyleDefinition {
  id: ModuleLayoutStyle;
  name: string;
  tagline: string;
  description: string;
  badge: string;
  icon: string;
  cardRadius: string;
  typography: {
    headingFont: string;
    bodyFont: string;
    monoFont: string;
    lineHeight: string;
  };
  accentColor: string;
  bannerStyle: string;
}

export const MODULE_LAYOUT_STYLES: Record<ModuleLayoutStyle, LayoutStyleDefinition> = {
  MODERN_ACADEMIC: {
    id: "MODERN_ACADEMIC",
    name: "Modern Academic",
    tagline: "Clean cards, strong visual hierarchy, NEET/JEE optimized",
    description: "Structured card-based layout with sharp borders, clear chapter banners, and high readability.",
    badge: "Default",
    icon: "school",
    cardRadius: "12px",
    typography: {
      headingFont: "system-ui, -apple-system, sans-serif",
      bodyFont: "system-ui, -apple-system, sans-serif",
      monoFont: "ui-monospace, monospace",
      lineHeight: "1.65",
    },
    accentColor: "#1d4ed8",
    bannerStyle: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)",
  },
  PREMIUM_EDTECH: {
    id: "PREMIUM_EDTECH",
    name: "Premium EdTech",
    tagline: "High-quality section headers, visual hierarchy, modern cards",
    description: "Vibrant accent badges, colorful callouts, and elegant glass-card aesthetic.",
    badge: "Popular",
    icon: "auto_awesome",
    cardRadius: "16px",
    typography: {
      headingFont: "system-ui, -apple-system, sans-serif",
      bodyFont: "system-ui, -apple-system, sans-serif",
      monoFont: "ui-monospace, monospace",
      lineHeight: "1.7",
    },
    accentColor: "#ea580c",
    bannerStyle: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)",
  },
  EXAM_REVISION: {
    id: "EXAM_REVISION",
    name: "Exam Revision",
    tagline: "Dense but readable, formula & insight focused",
    description: "Compact spacing, high-density formula boxes, key takeaway highlights, and PYQ reference blocks.",
    badge: "Fast Revision",
    icon: "bolt",
    cardRadius: "8px",
    typography: {
      headingFont: "system-ui, -apple-system, sans-serif",
      bodyFont: "system-ui, -apple-system, sans-serif",
      monoFont: "ui-monospace, monospace",
      lineHeight: "1.5",
    },
    accentColor: "#047857",
    bannerStyle: "linear-gradient(135deg, #064e3b 0%, #047857 100%)",
  },
  CONCEPT_MAP: {
    id: "CONCEPT_MAP",
    name: "Concept Map",
    tagline: "Linked concepts, derivations and step-by-step illustrations",
    description: "Emphasizes the relationship between fundamental definitions, mathematical formulations, and worked examples.",
    badge: "Deep Learning",
    icon: "account_tree",
    cardRadius: "14px",
    typography: {
      headingFont: "system-ui, -apple-system, sans-serif",
      bodyFont: "system-ui, -apple-system, sans-serif",
      monoFont: "ui-monospace, monospace",
      lineHeight: "1.65",
    },
    accentColor: "#6d28d9",
    bannerStyle: "linear-gradient(135deg, #4c1d95 0%, #6d28d9 100%)",
  },
  NCERT_ACADEMIC: {
    id: "NCERT_ACADEMIC",
    name: "NCERT Academic",
    tagline: "Formal, text-structured, standard textbook feel",
    description: "Conservative typographic hierarchy adhering to standard CBSE/NCERT curriculum layout.",
    badge: "Canonical",
    icon: "menu_book",
    cardRadius: "6px",
    typography: {
      headingFont: "Georgia, serif",
      bodyFont: "system-ui, -apple-system, sans-serif",
      monoFont: "ui-monospace, monospace",
      lineHeight: "1.75",
    },
    accentColor: "#334155",
    bannerStyle: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
  },
  VISUAL_LEARNING: {
    id: "VISUAL_LEARNING",
    name: "Visual Learning",
    tagline: "Diagram-centric, chemical structure & mechanism callouts",
    description: "Prioritizes diagrams, reaction mechanisms, flowcharts, anatomical drawings, and full-width figures.",
    badge: "Visuals First",
    icon: "image",
    cardRadius: "16px",
    typography: {
      headingFont: "system-ui, -apple-system, sans-serif",
      bodyFont: "system-ui, -apple-system, sans-serif",
      monoFont: "ui-monospace, monospace",
      lineHeight: "1.65",
    },
    accentColor: "#0284c7",
    bannerStyle: "linear-gradient(135deg, #0369a1 0%, #0284c7 100%)",
  },
};

/**
 * Subject-Aware Adaptor:
 * Detects whether content is Physics, Chemistry, or Biology and adapts block priority and rendering.
 */
export function detectSubjectContext(subjectStr?: string | null, titleStr?: string | null): "PHYSICS" | "CHEMISTRY" | "BIOLOGY" | "GENERAL" {
  const combined = `${subjectStr || ""} ${titleStr || ""}`.toLowerCase();
  if (combined.includes("chem") || combined.includes("organic") || combined.includes("inorganic") || combined.includes("physical chem") || combined.includes("रसायन")) {
    return "CHEMISTRY";
  }
  if (combined.includes("phys") || combined.includes("mechanics") || combined.includes("electrodynamics") || combined.includes("optics") || combined.includes("भौतिक")) {
    return "PHYSICS";
  }
  if (combined.includes("bio") || combined.includes("botany") || combined.includes("zoology") || combined.includes("cell") || combined.includes("genetics") || combined.includes("जीव")) {
    return "BIOLOGY";
  }
  return "GENERAL";
}

/**
 * Generates an academic Cover HTML string for preview & export.
 * Strictly avoids using the raw PDF thumbnail as an ugly background.
 */
export function renderModuleAcademicCover(params: {
  title: string;
  subject?: string | null;
  chapter?: string | null;
  className?: string | null;
  batch?: string | null;
  facultyName?: string | null;
  academicYear?: string | null;
  layoutStyle?: ModuleLayoutStyle;
  brandName?: string;
  logoUrl?: string | null;
}): string {
  const {
    title,
    subject = "Academic Preparation",
    chapter,
    className,
    batch,
    facultyName,
    academicYear = "2026-27",
    layoutStyle = "MODERN_ACADEMIC",
    brandName = "Atomic Pathshala",
    logoUrl,
  } = params;

  const style = MODULE_LAYOUT_STYLES[layoutStyle] || MODULE_LAYOUT_STYLES.MODERN_ACADEMIC;
  const subj = (subject || "GENERAL STUDIES").toUpperCase();

  return `
    <div class="module-academic-cover" style="
      width: 100%;
      min-height: 380px;
      background: ${style.bannerStyle};
      color: #ffffff;
      border-radius: ${style.cardRadius};
      padding: 40px 48px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
      margin-bottom: 32px;
      position: relative;
      overflow: hidden;
    ">
      <!-- Decorative vector accents -->
      <div style="position: absolute; top: -60px; right: -60px; width: 220px; height: 220px; border-radius: 50%; background: rgba(255,255,255,0.06); pointer-events: none;"></div>
      <div style="position: absolute; bottom: -80px; left: 20%; width: 300px; height: 300px; border-radius: 50%; background: rgba(255,255,255,0.04); pointer-events: none;"></div>

      <!-- Top Branding Row -->
      <div style="display: flex; align-items: center; justify-content: space-between; z-index: 2;">
        <div style="display: flex; align-items: center; gap: 12px;">
          ${
            logoUrl
              ? `<img src="${logoUrl}" alt="${brandName}" style="height: 36px; max-width: 140px; object-fit: contain; filter: brightness(0) invert(1);" />`
              : `<div style="font-weight: 800; font-size: 20px; letter-spacing: -0.5px; display: flex; align-items: center; gap: 6px;">
                  <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #ea580c;"></span>
                  ${brandName.toUpperCase()}
                 </div>`
          }
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="background: rgba(255,255,255,0.15); backdrop-filter: blur(8px); padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px;">
            ${subj}
          </span>
          ${
            className
              ? `<span style="background: rgba(255,255,255,0.15); padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700;">
                  CLASS ${className}
                 </span>`
              : ""
          }
          <span style="background: rgba(255,255,255,0.12); padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 600;">
            ${academicYear}
          </span>
        </div>
      </div>

      <!-- Center Title Section -->
      <div style="margin: 36px 0; z-index: 2;">
        <div style="text-transform: uppercase; font-size: 12px; font-weight: 800; letter-spacing: 1.5px; opacity: 0.85; margin-bottom: 8px;">
          ${chapter ? `CHAPTER · ${chapter}` : "COMPREHENSIVE STUDY MODULE"}
        </div>
        <h1 style="font-size: 34px; font-weight: 800; line-height: 1.2; letter-spacing: -0.5px; margin: 0 0 12px 0; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">
          ${title}
        </h1>
        ${
          batch
            ? `<div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(0,0,0,0.2); padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 600;">
                Target: ${batch}
               </div>`
            : ""
        }
      </div>

      <!-- Bottom Faculty & Verification Footer -->
      <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 16px; z-index: 2;">
        <div style="font-size: 13px; font-weight: 600; opacity: 0.95;">
          ${facultyName ? `Prepared & Verified by <b>${facultyName}</b>` : `Atomic Pathshala Academic Council`}
        </div>
        <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; opacity: 0.85;">
          <span>✓ 100% Syllabus Aligned</span>
          <span>•</span>
          <span>${style.name} Edition</span>
        </div>
      </div>
    </div>
  `;
}
