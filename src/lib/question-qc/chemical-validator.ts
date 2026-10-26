/**
 * ATOMIC PATHSHALA — CHEMICAL FORMULA & CHARGE CONSERVATION VALIDATOR
 * Deterministic validator for chemical symbols, coordination brackets, charge balance, and redox stoichiometry.
 */

import { ChemicalValidationResult } from "../ai-provider/types";

// Standard common oxidation / ion charges for NEET Chemistry validation
const KNOWN_CATION_CHARGES: Record<string, number[]> = {
  H: [1],
  Li: [1],
  Na: [1],
  K: [1],
  Rb: [1],
  Cs: [1],
  Ag: [1],
  NH4: [1],
  Mg: [2],
  Ca: [2],
  Sr: [2],
  Ba: [2],
  Zn: [2],
  Cd: [2],
  Cu: [1, 2],
  Fe: [2, 3],
  Al: [3],
  Cr: [2, 3, 6],
  Mn: [2, 4, 7],
  Co: [2, 3],
  Ni: [2],
  Sn: [2, 4],
  Pb: [2, 4],
};

const KNOWN_ANION_CHARGES: Record<string, number> = {
  F: -1,
  Cl: -1,
  Br: -1,
  I: -1,
  OH: -1,
  NO3: -1,
  NO2: -1,
  HCO3: -1,
  HSO4: -1,
  CN: -1,
  MnO4: -1,
  CH3COO: -1,
  O: -2,
  S: -2,
  SO4: -2,
  SO3: -2,
  CO3: -2,
  C2O4: -2,
  CrO4: -2,
  Cr2O7: -2,
  N: -3,
  P: -3,
  PO4: -3,
};

export function validateChemistry(text: string, solutionText?: string): ChemicalValidationResult {
  const errors: string[] = [];
  const detectedFormulas: string[] = [];
  const ionDiscrepancies: string[] = [];

  const combined = `${text} ${solutionText || ""}`;

  // 1. Bracket and Parenthesis balance in chemical complexes & molecules
  let squareBracketBalance = 0;
  let roundBracketBalance = 0;
  for (let i = 0; i < combined.length; i++) {
    const ch = combined[i];
    if (ch === "[") squareBracketBalance++;
    else if (ch === "]") {
      squareBracketBalance--;
      if (squareBracketBalance < 0) {
        errors.push("Mismatched closing bracket ']' in chemical formula/complex");
        break;
      }
    } else if (ch === "(") roundBracketBalance++;
    else if (ch === ")") {
      roundBracketBalance--;
      if (roundBracketBalance < 0) {
        errors.push("Mismatched closing parenthesis ')' in chemical formula/complex");
        break;
      }
    }
  }
  if (squareBracketBalance > 0) {
    errors.push(`Unclosed chemical complex bracket '[' (unclosed count: ${squareBracketBalance})`);
  }
  if (roundBracketBalance > 0) {
    errors.push(`Unclosed chemical parenthesis '(' (unclosed count: ${roundBracketBalance})`);
  }

  // 2. Identify chemical formula patterns (e.g., [Fe(CN)6]^{4-}, Ca^{2+}, SO4^{2-}, Al2(SO4)3, etc.)
  const formulaRegex = /\b([A-Z][a-z]?(?:\d+)?(?:\[[A-Za-z0-9_]+\])?(?:\([A-Za-z0-9_]+\)\d+)*(?:\^\{?\d*[\+\-]?\}?)?)\b/g;
  let match: RegExpExecArray | null;
  while ((match = formulaRegex.exec(combined)) !== null) {
    const candidate = match[1];
    if (candidate.length > 1 && /[A-Z]/.test(candidate) && !["NEET", "NCERT", "CBSE", "AIIMS", "IIT"].includes(candidate)) {
      detectedFormulas.push(candidate);
    }
  }

  // 3. Check for malformed charges like "^{++}", "^{--}", or inverted sign notation like "+2" instead of "2+"
  const malformedChargeRegex = /\^\{?(\+\+|--|\+\-|\-\+|\d{2,}[\+\-]|\+[\d]+)\}?/g;
  let chargeMatch: RegExpExecArray | null;
  while ((chargeMatch = malformedChargeRegex.exec(combined)) !== null) {
    errors.push(`Suspicious or malformed chemical charge notation: "${chargeMatch[0]}"`);
  }

  // 4. Redox half-reaction charge conservation check:
  // e.g. "Fe^{2+} \rightarrow Fe^{3+} + e^{-}" or "MnO4^- + 8H^+ + 5e^- -> Mn^{2+} + 4H2O"
  const arrowRegex = /([^=\n\r]+?)(?:\\rightarrow|->|→)([^=\n\r]+)/g;
  let rxnMatch: RegExpExecArray | null;
  while ((rxnMatch = arrowRegex.exec(combined)) !== null) {
    const reactantSide = rxnMatch[1];
    const productSide = rxnMatch[2];

    const parseSideCharge = (side: string): number => {
      let totalCharge = 0;
      // Match explicit electron notation first: e^-, 2e^-, e^{-}, 2e^{-}
      const sideWithoutElectrons = side.replace(/(\d*)\s*e\^?\{?-\}?/g, (_, count) => {
        const c = count ? parseInt(count, 10) : 1;
        totalCharge -= c;
        return "";
      });

      // Match ion charges on remaining species like Fe^{3+}, SO4^{2-}, Na^+
      const chargePattern = /(\d*)\s*([A-Za-z0-9()\[\]]+)?\^\{?(\d*)([\+\-])\}?/g;
      let m: RegExpExecArray | null;
      while ((m = chargePattern.exec(sideWithoutElectrons)) !== null) {
        const coeff = m[1] ? parseInt(m[1], 10) : 1;
        const magnitude = m[3] ? parseInt(m[3], 10) : 1;
        const sign = m[4] === "+" ? 1 : -1;
        totalCharge += coeff * magnitude * sign;
      }
      return totalCharge;
    };

    // If both sides contain explicit charge superscripts or electrons, verify balance
    if ((reactantSide.includes("^") || reactantSide.includes("e-")) && (productSide.includes("^") || productSide.includes("e-"))) {
      const qReactant = parseSideCharge(reactantSide);
      const qProduct = parseSideCharge(productSide);
      if (qReactant !== qProduct) {
        ionDiscrepancies.push(
          `Chemical reaction charge imbalance: Reactant charge (${qReactant >= 0 ? "+" + qReactant : qReactant}) does not equal Product charge (${qProduct >= 0 ? "+" + qProduct : qProduct}) across "${rxnMatch[0].trim()}"`
        );
      }
    }
  }

  // 5. Binary ionic stoichiometry neutrality check
  // e.g. AlCl2 is invalid (Al is +3, Cl is -1 => need AlCl3)
  for (const [cation, charges] of Object.entries(KNOWN_CATION_CHARGES)) {
    for (const [anion, anionCharge] of Object.entries(KNOWN_ANION_CHARGES)) {
      if (cation === anion) continue;
      const compoundRegex = new RegExp(`\\b${cation}(\\d+)?${anion}(\\d+)?\\b`, "g");
      let compMatch: RegExpExecArray | null;
      while ((compMatch = compoundRegex.exec(combined)) !== null) {
        const cCount = compMatch[1] ? parseInt(compMatch[1], 10) : 1;
        const aCount = compMatch[2] ? parseInt(compMatch[2], 10) : 1;
        
        // Check if any cation charge satisfies cCount * cationCharge + aCount * anionCharge == 0
        const isNeutral = charges.some(
          (cQ) => cCount * cQ + aCount * anionCharge === 0
        );
        if (!isNeutral) {
          ionDiscrepancies.push(
            `Stoichiometric charge imbalance in formula "${compMatch[0]}": ${cation} (known charge: ${charges.join("/")}) with ${anion} (charge: ${anionCharge}) cannot form neutral ratio ${cCount}:${aCount}`
          );
        }
      }
    }
  }

  const valid = errors.length === 0 && ionDiscrepancies.length === 0;

  return {
    valid,
    chargeBalanced: ionDiscrepancies.length === 0,
    bracketBalanced: squareBracketBalance === 0 && roundBracketBalance === 0,
    errors,
    detectedFormulas: Array.from(new Set(detectedFormulas)),
    ionDiscrepancies,
  };
}
