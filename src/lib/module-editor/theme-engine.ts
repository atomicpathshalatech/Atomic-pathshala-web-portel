import {
  ModuleTheme,
  SubjectThemeType,
  HeadingRule,
  DetectedHeading,
  BoundingBox,
  TextObject,
} from "./types";

export const SUBJECT_THEMES: Record<SubjectThemeType, ModuleTheme> = {
  CHEMISTRY: {
    type: "CHEMISTRY",
    name: "Atomic Chemistry Pro",
    colors: {
      primary: "#047857",         // Emerald 700
      secondary: "#059669",       // Emerald 600
      accent: "#10b981",          // Emerald 500
      border: "#a7f3d0",          // Emerald 200
      lightTint: "#ecfdf5",       // Emerald 50 (subtle callout/card tint)
      paperBg: "#ffffff",         // Pure white page background (NEVER dark fill)
      headerBannerBg: "#f0fdf4",  // Ultra light green header banner
      headingText: "#064e3b",     // Emerald 900
      bodyText: "#1f2937",        // Gray 800
      tagBg: "#d1fae5",           // Emerald 100
      tagText: "#065f46",         // Emerald 800
    },
    structuralDividerThickness: 1.5,
    headerBorderThickness: 2.0,
    badgeBorderRadius: 4,
    enableSubtlePaperTint: false,
  },

  PHYSICS: {
    type: "PHYSICS",
    name: "Atomic Physics Pro",
    colors: {
      primary: "#1d4ed8",         // Blue 700
      secondary: "#2563eb",       // Blue 600
      accent: "#3b82f6",          // Blue 500
      border: "#bfdbfe",          // Blue 200
      lightTint: "#eff6ff",       // Blue 50 (subtle formula/callout card tint)
      paperBg: "#ffffff",         // Pure white page background (NEVER dark fill)
      headerBannerBg: "#f0f7ff",  // Ultra light blue header banner
      headingText: "#1e3a8a",     // Blue 900
      bodyText: "#1f2937",        // Gray 800
      tagBg: "#dbeafe",           // Blue 100
      tagText: "#1e40af",         // Blue 800
    },
    structuralDividerThickness: 1.5,
    headerBorderThickness: 2.0,
    badgeBorderRadius: 4,
    enableSubtlePaperTint: false,
  },

  BIOLOGY: {
    type: "BIOLOGY",
    name: "Atomic Biology Pro",
    colors: {
      primary: "#6d28d9",         // Violet 700
      secondary: "#7c3aed",       // Violet 600
      accent: "#8b5cf6",          // Violet 500
      border: "#ddd6fe",          // Violet 200
      lightTint: "#faf5ff",       // Violet 50 (subtle callout/card tint)
      paperBg: "#ffffff",         // Pure white page background (NEVER dark fill)
      headerBannerBg: "#fbf8ff",  // Ultra light violet header banner
      headingText: "#4c1d95",     // Violet 900
      bodyText: "#1f2937",        // Gray 800
      tagBg: "#ede9fe",           // Violet 100
      tagText: "#5b21b6",         // Violet 800
    },
    structuralDividerThickness: 1.5,
    headerBorderThickness: 2.0,
    badgeBorderRadius: 4,
    enableSubtlePaperTint: false,
  },

  CLASSIC: {
    type: "CLASSIC",
    name: "Atomic Classic Executive",
    colors: {
      primary: "#0f172a",         // Slate 900
      secondary: "#334155",       // Slate 700
      accent: "#ea580c",          // Orange 600
      border: "#e2e8f0",          // Slate 200
      lightTint: "#f8fafc",       // Slate 50
      paperBg: "#ffffff",         // Pure white page background
      headerBannerBg: "#f8fafc",  // Light slate header banner
      headingText: "#0f172a",     // Slate 900
      bodyText: "#1e293b",        // Slate 800
      tagBg: "#e2e8f0",           // Slate 200
      tagText: "#1e293b",         // Slate 800
    },
    structuralDividerThickness: 1.0,
    headerBorderThickness: 1.5,
    badgeBorderRadius: 3,
    enableSubtlePaperTint: false,
  },
};

export const DEFAULT_HEADING_RULES: HeadingRule[] = [
  {
    id: "rule-h1-chapter",
    pattern: "^(CHAPTER|UNIT|MODULE|TOPIC)\\s+([0-9IVX]+)?",
    level: 1,
    minFontSize: 16,
    style: {
      addAccentBadge: true,
      addLeftBorder: true,
      addBottomDivider: true,
    },
  },
  {
    id: "rule-h2-section",
    pattern: "^([0-9]+\\.[0-9]+|[A-Z]\\.)\\s+[A-Z]",
    level: 2,
    minFontSize: 12,
    style: {
      addAccentBadge: false,
      addLeftBorder: true,
      addBottomDivider: false,
    },
  },
  {
    id: "rule-h3-concepts",
    pattern: "^(DEFINITION|KEY FORMULA|IMPORTANT CONCEPT|SOLVED EXAMPLE|EXERCISE|NOTE|PRACTICE PROBLEM|STEP [0-9]+|CASE [0-9]+):?",
    level: 3,
    minFontSize: 10,
    style: {
      addAccentBadge: true,
      addLeftBorder: false,
      addBottomDivider: false,
    },
  },
];

export class ThemeEngine {
  /**
   * Get theme configuration by subject name or subject theme type
   */
  public static getThemeForSubject(subjectOrTheme: string): ModuleTheme {
    const clean = (subjectOrTheme || "").toUpperCase();
    if (clean.includes("CHEM")) return SUBJECT_THEMES.CHEMISTRY;
    if (clean.includes("PHYS")) return SUBJECT_THEMES.PHYSICS;
    if (clean.includes("BIO") || clean.includes("BOT") || clean.includes("ZOO")) return SUBJECT_THEMES.BIOLOGY;
    return SUBJECT_THEMES.CLASSIC;
  }

  /**
   * Generate CSS / Canvas styling parameters for structural theme elements
   */
  public static getHeaderStyle(theme: ModuleTheme) {
    return {
      backgroundColor: theme.colors.headerBannerBg,
      borderBottomColor: theme.colors.primary,
      borderBottomWidth: theme.headerBorderThickness,
      titleColor: theme.colors.primary,
      subtitleColor: theme.colors.secondary,
      infoColor: theme.colors.bodyText,
    };
  }

  public static getFooterStyle(theme: ModuleTheme) {
    return {
      backgroundColor: "transparent",
      borderTopColor: theme.colors.border,
      borderTopWidth: theme.structuralDividerThickness,
      textColor: theme.colors.secondary,
      pageNumberColor: theme.colors.primary,
    };
  }

  public static getHeadingStyle(theme: ModuleTheme, level: 1 | 2 | 3) {
    switch (level) {
      case 1:
        return {
          textColor: theme.colors.headingText,
          badgeBg: theme.colors.tagBg,
          badgeText: theme.colors.tagText,
          borderColor: theme.colors.primary,
          borderWidth: 3,
          dividerColor: theme.colors.primary,
        };
      case 2:
        return {
          textColor: theme.colors.secondary,
          badgeBg: theme.colors.lightTint,
          badgeText: theme.colors.secondary,
          borderColor: theme.colors.secondary,
          borderWidth: 2,
          dividerColor: theme.colors.border,
        };
      case 3:
      default:
        return {
          textColor: theme.colors.headingText,
          badgeBg: theme.colors.tagBg,
          badgeText: theme.colors.tagText,
          borderColor: theme.colors.accent,
          borderWidth: 1.5,
          dividerColor: theme.colors.border,
        };
    }
  }

  /**
   * Automatic Heading Detector
   * Analyzes text blocks and categorizes headings, applying structural accents
   * WITHOUT modifying or inverting general body text.
   */
  public static detectHeadingsInText(
    textItems: Array<{ id: string; pageNumber: number; text: string; box: BoundingBox; fontSize?: number; isBold?: boolean }>,
    theme: ModuleTheme,
    rules: HeadingRule[] = DEFAULT_HEADING_RULES
  ): DetectedHeading[] {
    const detected: DetectedHeading[] = [];

    for (const item of textItems) {
      const trimmed = item.text.trim();
      if (!trimmed) continue;

      for (const rule of rules) {
        const regex = new RegExp(rule.pattern, "i");
        const matchesPattern = regex.test(trimmed);
        const meetsFontRequirement = rule.minFontSize ? (item.fontSize || 12) >= rule.minFontSize : true;

        if (matchesPattern || (meetsFontRequirement && item.isBold && trimmed.length < 80)) {
          const headingLevel = rule.level;
          const style = this.getHeadingStyle(theme, headingLevel);

          detected.push({
            id: `heading-${item.id}`,
            pageNumber: item.pageNumber,
            text: trimmed,
            boundingBox: item.box,
            level: headingLevel,
            ruleMatched: rule.id,
            appliedStyle: {
              badgeColor: rule.style.addAccentBadge ? style.badgeBg : undefined,
              borderColor: rule.style.addLeftBorder ? style.borderColor : undefined,
              textColor: style.textColor,
            },
          });
          break; // Match first rule
        }
      }
    }

    return detected;
  }
}
