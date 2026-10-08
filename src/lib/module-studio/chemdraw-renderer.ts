export interface ChemicalStructureDefinition {
  type: "BENZENE_DERIVATIVE" | "CYCLOALKANE" | "BOND_LINE" | "FUNCTIONAL_TABLE" | "FLOWCHART";
  title?: string;
  svgHtml?: string;
}

/**
 * Generates publication-grade ChemDraw SVG representations ONLY when explicitly requested
 * for isolated chemical entities, preserving original PDF diagram figures without overriding questions.
 */
export function renderChemDrawSvg(nameOrFormula: string, color: string = "#0B7A43"): string | null {
  if (!nameOrFormula || typeof nameOrFormula !== "string") return null;

  const norm = nameOrFormula.toLowerCase().trim();

  // Only trigger for EXACT isolated chemical structure labels (not generic questions)
  if (norm === "toluene" || norm === "टोल्यूइन" || norm === "टॉलूईन" || norm === "methylbenzene") {
    return `
      <svg width="120" height="150" viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 8px auto;">
        <text x="60" y="24" font-family="'Noto Sans Devanagari', 'Poppins', sans-serif" font-size="14" font-weight="bold" fill="#0f172a" text-anchor="middle">CH₃</text>
        <line x1="60" y1="28" x2="60" y2="48" stroke="#0f172a" stroke-width="2.5" />
        <polygon points="60,48 95,68 95,108 60,128 25,108 25,68" fill="none" stroke="#0f172a" stroke-width="2.5" />
        <circle cx="60" cy="88" r="22" fill="none" stroke="#0f172a" stroke-width="2" />
      </svg>
    `;
  }

  if (norm === "phenol" || norm === "फिनोल" || norm === "hydroxybenzene") {
    return `
      <svg width="120" height="150" viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 8px auto;">
        <text x="60" y="24" font-family="'Noto Sans Devanagari', 'Poppins', sans-serif" font-size="14" font-weight="bold" fill="#0f172a" text-anchor="middle">OH</text>
        <line x1="60" y1="28" x2="60" y2="48" stroke="#0f172a" stroke-width="2.5" />
        <polygon points="60,48 95,68 95,108 60,128 25,108 25,68" fill="none" stroke="#0f172a" stroke-width="2.5" />
        <circle cx="60" cy="88" r="22" fill="none" stroke="#0f172a" stroke-width="2" />
      </svg>
    `;
  }

  if (norm === "benzoic acid" || norm === "बेंजोइक एसिड" || norm === "benzenecarboxylic acid") {
    return `
      <svg width="130" height="150" viewBox="0 0 130 150" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 8px auto;">
        <text x="65" y="24" font-family="'Noto Sans Devanagari', 'Poppins', sans-serif" font-size="14" font-weight="bold" fill="#0f172a" text-anchor="middle">COOH</text>
        <line x1="65" y1="28" x2="65" y2="48" stroke="#0f172a" stroke-width="2.5" />
        <polygon points="65,48 100,68 100,108 65,128 30,108 30,68" fill="none" stroke="#0f172a" stroke-width="2.5" />
        <circle cx="65" cy="88" r="22" fill="none" stroke="#0f172a" stroke-width="2" />
      </svg>
    `;
  }

  if (norm === "aniline" || norm === "एनिलीन" || norm === "benzenamine") {
    return `
      <svg width="120" height="150" viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 8px auto;">
        <text x="60" y="24" font-family="'Noto Sans Devanagari', 'Poppins', sans-serif" font-size="14" font-weight="bold" fill="#0f172a" text-anchor="middle">NH₂</text>
        <line x1="60" y1="28" x2="60" y2="48" stroke="#0f172a" stroke-width="2.5" />
        <polygon points="60,48 95,68 95,108 60,128 25,108 25,68" fill="none" stroke="#0f172a" stroke-width="2.5" />
        <circle cx="60" cy="88" r="22" fill="none" stroke="#0f172a" stroke-width="2" />
      </svg>
    `;
  }

  return null;
}
