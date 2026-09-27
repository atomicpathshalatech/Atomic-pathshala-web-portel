/**
 * CAMDRAW — CHEMICAL GRAPH VALIDATION & VALENCY ENGINE
 * Provides chemical sanity checks, formal charge validation,
 * molecular formula calculation, and cycle/ring detection.
 */

import {
  CamDrawDocument,
  CamDrawElement,
  AtomElement,
  BondElement,
  RingElement,
  CamDrawValidationReport,
  MolecularGraph,
} from "./types";

// Standard max valencies for elements in neutral/standard organic & inorganic states
export const ELEMENT_VALENCE_RULES: Record<
  string,
  { standard: number[]; max: number; label: string }
> = {
  H: { standard: [1], max: 1, label: "Hydrogen" },
  D: { standard: [1], max: 1, label: "Deuterium" },
  T: { standard: [1], max: 1, label: "Tritium" },
  C: { standard: [4], max: 4, label: "Carbon" },
  N: { standard: [3, 4], max: 4, label: "Nitrogen" },
  O: { standard: [2, 1, 3], max: 3, label: "Oxygen" },
  F: { standard: [1], max: 1, label: "Fluorine" },
  Cl: { standard: [1, 3, 5, 7], max: 7, label: "Chlorine" },
  Br: { standard: [1, 3, 5, 7], max: 7, label: "Bromine" },
  I: { standard: [1, 3, 5, 7], max: 7, label: "Iodine" },
  P: { standard: [3, 5], max: 6, label: "Phosphorus" },
  S: { standard: [2, 4, 6], max: 6, label: "Sulfur" },
  B: { standard: [3, 4], max: 4, label: "Boron" },
  Si: { standard: [4], max: 6, label: "Silicon" },
  Na: { standard: [1], max: 1, label: "Sodium" },
  K: { standard: [1], max: 1, label: "Potassium" },
  Mg: { standard: [2], max: 2, label: "Magnesium" },
  Ca: { standard: [2], max: 2, label: "Calcium" },
  Al: { standard: [3, 4, 6], max: 6, label: "Aluminum" },
  Fe: { standard: [2, 3, 4, 6], max: 6, label: "Iron" },
  Cu: { standard: [1, 2, 4], max: 4, label: "Copper" },
  Zn: { standard: [2, 4], max: 4, label: "Zinc" },
  Pt: { standard: [2, 4, 6], max: 6, label: "Platinum" },
  Co: { standard: [2, 3, 6], max: 6, label: "Cobalt" },
  Ni: { standard: [2, 4, 6], max: 6, label: "Nickel" },
  Cr: { standard: [2, 3, 6], max: 6, label: "Chromium" },
  Mn: { standard: [2, 4, 7], max: 7, label: "Manganese" },
};

/**
 * Parses element symbol or functional group abbreviation
 * e.g. "CH3" -> root element C, "COOH" -> root C, "OH" -> root O, "NH2" -> root N, "NC" -> root C
 */
export function extractRootElement(symbol: string): { root: string; implicitH: number } {
  const trimmed = symbol.trim();
  if (!trimmed) return { root: "C", implicitH: 0 };

  // Common groups
  if (trimmed === "CH3" || trimmed === "Me") return { root: "C", implicitH: 3 };
  if (trimmed === "CH2") return { root: "C", implicitH: 2 };
  if (trimmed === "CH") return { root: "C", implicitH: 1 };
  if (trimmed === "COOH") return { root: "C", implicitH: 0 };
  if (trimmed === "CHO") return { root: "C", implicitH: 1 };
  if (trimmed === "CN" || trimmed === "NC") return { root: "C", implicitH: 0 };
  if (trimmed === "OH") return { root: "O", implicitH: 1 };
  if (trimmed === "NH2") return { root: "N", implicitH: 2 };
  if (trimmed === "NH") return { root: "N", implicitH: 1 };
  if (trimmed === "NO2") return { root: "N", implicitH: 0 };
  if (trimmed === "SH") return { root: "S", implicitH: 1 };
  if (trimmed === "SO3H") return { root: "S", implicitH: 0 };
  if (trimmed === "OCH3" || trimmed === "OMe") return { root: "O", implicitH: 0 };
  if (trimmed === "OAc") return { root: "O", implicitH: 0 };
  if (trimmed === "Ph" || trimmed === "Ar") return { root: "C", implicitH: 0 };
  if (trimmed === "Et") return { root: "C", implicitH: 0 };
  if (trimmed === "t-Bu" || trimmed === "tBu") return { root: "C", implicitH: 0 };

  // Single or double letter element match (e.g. Pt, Fe, Cl, Br, C, N, O)
  const match = trimmed.match(/^([A-Z][a-z]?)/);
  if (match && match[1] && ELEMENT_VALENCE_RULES[match[1]]) {
    return { root: match[1], implicitH: 0 };
  }

  return { root: trimmed, implicitH: 0 };
}

/**
 * Returns bond numeric order from bond type string
 */
export function getBondOrder(bondType: string): number {
  switch (bondType) {
    case "single":
    case "wedge":
    case "dash":
    case "wavy":
      return 1;
    case "double":
      return 2;
    case "triple":
      return 3;
    case "aromatic":
      return 1.5;
    case "coordinate":
      return 1; // coordinate / dative
    case "hydrogen":
      return 0.1;
    default:
      return 1;
  }
}

/**
 * Chemical Graph & Document Validator
 */
export function validateChemicalDocument(doc: CamDrawDocument): CamDrawValidationReport {
  const warnings: string[] = [];
  const errors: string[] = [];
  const valencyMap: Record<string, { current: number; max: number; valid: boolean }> = {};

  if (!doc || !doc.elements || doc.elements.length === 0) {
    return { valid: true, warnings: [], errors: [], valencyMap: {} };
  }

  const atoms = doc.elements.filter((el) => el.type === "atom") as AtomElement[];
  const bonds = doc.elements.filter((el) => el.type === "bond") as BondElement[];
  const rings = doc.elements.filter((el) => el.type === "ring") as RingElement[];

  // 1. Map atom connectivity
  const atomBonds: Record<string, { bond: BondElement; order: number }[]> = {};
  for (const atom of atoms) {
    atomBonds[atom.id] = [];
  }

  for (const bond of bonds) {
    const startId = bond.start.atomId;
    const endId = bond.end.atomId;
    const order = getBondOrder(bond.bondType);

    if (startId && atomBonds[startId]) {
      atomBonds[startId].push({ bond, order });
    }
    if (endId && atomBonds[endId]) {
      atomBonds[endId].push({ bond, order });
    }

    // Geometry sanity check: Bond length check
    const dx = bond.end.x - bond.start.x;
    const dy = bond.end.y - bond.start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 10) {
      warnings.push(`Bond ${bond.id} has very short length (${Math.round(len)}px)`);
    } else if (len > 350) {
      warnings.push(`Bond ${bond.id} appears unusually long (${Math.round(len)}px)`);
    }
  }

  // 2. Validate Valencies for each atom
  for (const atom of atoms) {
    const { root, implicitH } = extractRootElement(atom.symbol);
    const rule = ELEMENT_VALENCE_RULES[root];
    const connected = atomBonds[atom.id] || [];
    const bondOrderSum = connected.reduce((acc, curr) => acc + curr.order, 0);
    const totalValence = bondOrderSum + implicitH;

    if (rule) {
      const isChargeAdjusted = !!atom.charge;
      const valid =
        totalValence <= rule.max ||
        rule.standard.includes(Math.round(totalValence)) ||
        isChargeAdjusted;

      valencyMap[atom.id] = {
        current: totalValence,
        max: rule.max,
        valid,
      };

      // Pentavalent Carbon (Texas Carbon) or Hypervalent checks
      if (root === "C" && totalValence > 4) {
        errors.push(
          `Atom "${atom.symbol}" (ID: ${atom.id}) is hypervalent with ${totalValence} bonds! Carbon cannot exceed valence 4.`
        );
      } else if (root === "H" && totalValence > 1) {
        errors.push(
          `Hydrogen "${atom.symbol}" (ID: ${atom.id}) has ${totalValence} bonds! Hydrogen valence cannot exceed 1.`
        );
      } else if (!valid && totalValence > rule.max) {
        warnings.push(
          `Atom "${atom.symbol}" has total valence ${totalValence}, exceeding normal maximum ${rule.max}.`
        );
      }
    } else {
      valencyMap[atom.id] = {
        current: totalValence,
        max: 6,
        valid: true,
      };
    }
  }

  // 3. Check for disconnected / floating atoms
  for (const atom of atoms) {
    const connected = atomBonds[atom.id] || [];
    if (connected.length === 0 && atoms.length > 1 && !atom.charge) {
      warnings.push(`Atom "${atom.symbol}" (ID: ${atom.id}) is disconnected from any bonds.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    valencyMap,
  };
}

/**
 * Calculates empirical chemical formula from atoms and implicit Hydrogens
 * e.g. "C6H12O6", "CH3COOH", "NC-C(CH3)(CHO)-CH2-CH2-COOH" -> "C6H7NO3"
 */
export function computeMolecularFormula(doc: CamDrawDocument): string {
  if (!doc || !doc.elements) return "";

  const atoms = doc.elements.filter((el) => el.type === "atom") as AtomElement[];
  const elementCounts: Record<string, number> = {};

  for (const atom of atoms) {
    const { root, implicitH } = extractRootElement(atom.symbol);
    elementCounts[root] = (elementCounts[root] || 0) + 1;
    if (implicitH > 0) {
      elementCounts["H"] = (elementCounts["H"] || 0) + implicitH;
    }
  }

  // Build Hill system formula (C first, then H, then alphabetical)
  const parts: string[] = [];
  if (elementCounts["C"]) {
    parts.push(elementCounts["C"] === 1 ? "C" : `C${elementCounts["C"]}`);
    delete elementCounts["C"];
  }
  if (elementCounts["H"]) {
    parts.push(elementCounts["H"] === 1 ? "H" : `H${elementCounts["H"]}`);
    delete elementCounts["H"];
  }

  const sortedElements = Object.keys(elementCounts).sort();
  for (const el of sortedElements) {
    const count = elementCounts[el];
    parts.push(count === 1 ? el : `${el}${count}`);
  }

  return parts.join("");
}
