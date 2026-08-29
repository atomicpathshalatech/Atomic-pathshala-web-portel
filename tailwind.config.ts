import type { Config } from "tailwindcss";

/**
 * NOTE ON DESIGN SYSTEM:
 * This palette comes from the Stitch-generated landing page design
 * (Material Design 3 style tokens: primary/on-primary, surface/on-surface,
 * etc). Since no shadcn/ui primitives were built yet in Phase 1, we've
 * adopted this token set as the project's official design system rather
 * than running two conflicting palettes side by side. If shadcn/ui
 * components are introduced later, map them onto these same tokens
 * instead of reintroducing the old --primary/--secondary CSS variables.
 */
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        "inverse-primary": "#b3c5ff",
        "surface-container-lowest": "#ffffff",
        "inverse-on-surface": "#eef0ff",
        "secondary-container": "#00ccf9",
        "primary-container": "#0066ff",
        "outline-variant": "#c2c6d8",
        primary: "#0050cb",
        "surface-container-highest": "#dae2fd",
        "tertiary-container": "#008256",
        "surface-tint": "#0054d6",
        surface: "#faf8ff",
        "on-surface-variant": "#424656",
        "surface-dark": "#161B22",
        "error-container": "#ffdad6",
        "on-error": "#ffffff",
        background: "#faf8ff",
        "on-tertiary": "#ffffff",
        "on-secondary-fixed": "#001f28",
        outline: "#727687",
        "on-secondary": "#ffffff",
        "border-subtle": "rgba(0, 102, 255, 0.1)",
        "on-tertiary-container": "#e1ffeb",
        "on-background": "#131b2e",
        secondary: "#00677f",
        "tertiary-fixed": "#6afcb9",
        "on-primary-container": "#f8f7ff",
        tertiary: "#006643",
        "surface-container": "#eaedff",
        "on-tertiary-fixed-variant": "#005235",
        "surface-bright": "#faf8ff",
        "on-tertiary-fixed": "#002113",
        "on-primary-fixed": "#001849",
        "surface-dim": "#d2d9f4",
        "primary-fixed": "#dae1ff",
        "on-primary-fixed-variant": "#003fa4",
        "on-primary": "#ffffff",
        "text-light": "#0F172A",
        "surface-container-low": "#f2f3ff",
        "inverse-surface": "#283044",
        "surface-light": "#F8FAFC",
        "surface-container-high": "#e2e7ff",
        "on-secondary-container": "#005266",
        "on-secondary-fixed-variant": "#004e60",
        error: "#ba1a1a",
        "bg-light": "#FFFFFF",
        "primary-fixed-dim": "#b3c5ff",
        "secondary-fixed-dim": "#4cd6ff",
        "on-error-container": "#93000a",
        "on-surface": "#131b2e",
        "bg-dark": "#0B0E14",
        "surface-variant": "#dae2fd",
        "tertiary-fixed-dim": "#49df9f",
        "secondary-fixed": "#b7eaff",
        "text-dark": "#F1F5F9",

        // AI Chat / Atomic Guru palette (imported from _import_atomic-ai-chat).
        // Namespaced under "atomic-*" so it sits alongside this project's own
        // Material Design 3 token set above without colliding with it.
        "atomic-orange": "#f97316",
        "atomic-orange-dark": "#ea580c",
        "atomic-blue": "#1e40af",
        "atomic-blue-light": "#3b82f6",
        "atomic-navy": "#0f172a",
        "atomic-slate": "#1e293b",
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px",
      },
      spacing: {
        "margin-mobile": "20px",
        gutter: "24px",
        "stack-md": "16px",
        "container-max": "1280px",
        "margin-desktop": "64px",
        "stack-lg": "32px",
        "stack-sm": "8px",
      },
      fontFamily: {
        "body-lg": ["Inter", "sans-serif"],
        "label-sm": ["Inter", "sans-serif"],
        "display-lg-mobile": ["Geist", "sans-serif"],
        "label-md": ["Inter", "sans-serif"],
        "headline-lg": ["Geist", "sans-serif"],
        "display-lg": ["Geist", "sans-serif"],
        "headline-md": ["Geist", "sans-serif"],
        "body-md": ["Inter", "sans-serif"],
      },
      fontSize: {
        "body-lg": ["18px", { lineHeight: "28px", fontWeight: "400" }],
        "label-sm": ["12px", { lineHeight: "16px", fontWeight: "500" }],
        "display-lg-mobile": [
          "36px",
          { lineHeight: "42px", letterSpacing: "-0.02em", fontWeight: "700" },
        ],
        "label-md": ["14px", { lineHeight: "20px", letterSpacing: "0.01em", fontWeight: "600" }],
        "headline-lg": ["32px", { lineHeight: "40px", fontWeight: "600" }],
        "display-lg": ["48px", { lineHeight: "56px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-md": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "body-md": ["16px", { lineHeight: "24px", fontWeight: "400" }],
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/container-queries")],
};

export default config;
