export interface ChemicalStructureDefinition {
  type: "BENZENE_DERIVATIVE" | "CYCLOALKANE" | "BOND_LINE" | "FUNCTIONAL_TABLE" | "FLOWCHART";
  title?: string;
  svgHtml?: string;
}

/**
 * Generates high-contrast, publication-grade ChemDraw SVG representations
 * for standard organic structures (Toluene, Aniline, Phenol, Xylene, Cyclopentane, etc.)
 */
export function renderChemDrawSvg(nameOrFormula: string, color: string = "#0B7A43"): string | null {
  const norm = nameOrFormula.toLowerCase().trim();

  // 1. Toluene (टॉलूईन)
  if (norm.includes("toluene") || norm.includes("टोल्यूइन") || norm.includes("टॉलूईन") || norm.includes("methylbenzene")) {
    return `
      <svg width="120" height="150" viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 8px auto;">
        <text x="60" y="24" font-family="'Poppins', sans-serif" font-size="14" font-weight="bold" fill="#0f172a" text-anchor="middle">CH₃</text>
        <line x1="60" y1="28" x2="60" y2="48" stroke="#0f172a" stroke-width="2.5" />
        <!-- Benzene Ring -->
        <polygon points="60,48 95,68 95,108 60,128 25,108 25,68" fill="none" stroke="#0f172a" stroke-width="2.5" />
        <circle cx="60" cy="88" r="22" fill="none" stroke="#0f172a" stroke-width="2" />
      </svg>
    `;
  }

  // 2. Phenol (फ़िनोल)
  if (norm.includes("phenol") || norm.includes("फिनोल") || norm.includes("hydroxybenzene")) {
    return `
      <svg width="120" height="150" viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 8px auto;">
        <text x="60" y="24" font-family="'Poppins', sans-serif" font-size="14" font-weight="bold" fill="#0f172a" text-anchor="middle">OH</text>
        <line x1="60" y1="28" x2="60" y2="48" stroke="#0f172a" stroke-width="2.5" />
        <polygon points="60,48 95,68 95,108 60,128 25,108 25,68" fill="none" stroke="#0f172a" stroke-width="2.5" />
        <circle cx="60" cy="88" r="22" fill="none" stroke="#0f172a" stroke-width="2" />
      </svg>
    `;
  }

  // 3. Benzoic Acid (बेंजोइक एसिड)
  if (norm.includes("benzoic") || norm.includes("बेंजोइक") || norm.includes("benzenecarboxylic")) {
    return `
      <svg width="130" height="150" viewBox="0 0 130 150" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 8px auto;">
        <text x="65" y="24" font-family="'Poppins', sans-serif" font-size="14" font-weight="bold" fill="#0f172a" text-anchor="middle">COOH</text>
        <line x1="65" y1="28" x2="65" y2="48" stroke="#0f172a" stroke-width="2.5" />
        <polygon points="65,48 100,68 100,108 65,128 30,108 30,68" fill="none" stroke="#0f172a" stroke-width="2.5" />
        <circle cx="65" cy="88" r="22" fill="none" stroke="#0f172a" stroke-width="2" />
      </svg>
    `;
  }

  // 4. Aniline (एनिलीन)
  if (norm.includes("aniline") || norm.includes("एनिलीन") || norm.includes("benzenamine")) {
    return `
      <svg width="120" height="150" viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 8px auto;">
        <text x="60" y="24" font-family="'Poppins', sans-serif" font-size="14" font-weight="bold" fill="#0f172a" text-anchor="middle">NH₂</text>
        <line x1="60" y1="28" x2="60" y2="48" stroke="#0f172a" stroke-width="2.5" />
        <polygon points="60,48 95,68 95,108 60,128 25,108 25,68" fill="none" stroke="#0f172a" stroke-width="2.5" />
        <circle cx="60" cy="88" r="22" fill="none" stroke="#0f172a" stroke-width="2" />
      </svg>
    `;
  }

  // 5. Cyclopentane / Cyclohexane
  if (norm.includes("cyclopentane") || norm.includes("साइक्लोपेंटेन")) {
    return `
      <svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 8px auto;">
        <polygon points="50,15 88,42 73,85 27,85 12,42" fill="none" stroke="#0f172a" stroke-width="2.5" />
      </svg>
    `;
  }

  if (norm.includes("cyclohexane") || norm.includes("साइक्लोहेक्सेन")) {
    return `
      <svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 8px auto;">
        <polygon points="50,15 85,35 85,75 50,95 15,75 15,35" fill="none" stroke="#0f172a" stroke-width="2.5" />
      </svg>
    `;
  }

  return null;
}
