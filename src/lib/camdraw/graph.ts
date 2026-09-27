/**
 * CAMDRAW — MOLECULAR GRAPH & GEOMETRY RECONSTRUCTION ENGINE
 * Topology management, IUPAC branch alignment, bond angle snapping,
 * auto-cleaning (force/rule-based), and graph conversions.
 */

import {
  CamDrawDocument,
  CamDrawElement,
  AtomElement,
  BondElement,
  RingElement,
  BracketElement,
  MolecularGraph,
} from "./types";
import { computeMolecularFormula, validateChemicalDocument } from "./validator";

export interface CleanStructureOptions {
  standardBondLength?: number; // default 45px
  snapAngles?: boolean; // snap to 30°, 60°, 90°, 120°, 180°
  alignVerticalBranches?: boolean;
}

/**
 * Extracts a normalized MolecularGraph from CamDrawDocument elements
 */
export function documentToMolecularGraph(doc: CamDrawDocument): MolecularGraph {
  const atoms = doc.elements.filter((el) => el.type === "atom") as AtomElement[];
  const bonds = doc.elements.filter((el) => el.type === "bond") as BondElement[];
  const rings = doc.elements.filter((el) => el.type === "ring") as RingElement[];
  const brackets = doc.elements.filter((el) => el.type === "bracket") as BracketElement[];

  const formula = computeMolecularFormula(doc);

  return {
    atoms,
    bonds,
    rings,
    brackets,
    formula,
  };
}

/**
 * Ensures all bonds with atom endpoints are tightly attached to the exact atom coordinates
 * and fixes IUPAC vertical branches (e.g. NC-C(CH3)(CHO)-CH2-CH2-COOH)
 */
export function normalizeGraphTopology(doc: CamDrawDocument): CamDrawDocument {
  const atoms = doc.elements.filter((el) => el.type === "atom") as AtomElement[];
  const atomMap = new Map<string, AtomElement>();
  atoms.forEach((a) => atomMap.set(a.id, a));

  const SNAP_THRESHOLD = 30; // pixels

  const updatedElements = doc.elements.map((el) => {
    if (el.type === "bond") {
      const bond = { ...el } as BondElement;
      let startX = bond.start.x;
      let startY = bond.start.y;
      let startAtomId = bond.start.atomId;

      let endX = bond.end.x;
      let endY = bond.end.y;
      let endAtomId = bond.end.atomId;

      // 1. If startAtomId is specified, snap to its coordinates
      if (startAtomId && atomMap.has(startAtomId)) {
        const a = atomMap.get(startAtomId)!;
        startX = a.x;
        startY = a.y;
      } else {
        // Find closest atom within SNAP_THRESHOLD
        for (const a of atoms) {
          const dist = Math.hypot(a.x - startX, a.y - startY);
          if (dist <= SNAP_THRESHOLD) {
            startX = a.x;
            startY = a.y;
            startAtomId = a.id;
            break;
          }
        }
      }

      // 2. If endAtomId is specified, snap to its coordinates
      if (endAtomId && atomMap.has(endAtomId)) {
        const a = atomMap.get(endAtomId)!;
        endX = a.x;
        endY = a.y;
      } else {
        // Find closest atom within SNAP_THRESHOLD
        for (const a of atoms) {
          const dist = Math.hypot(a.x - endX, a.y - endY);
          if (dist <= SNAP_THRESHOLD) {
            endX = a.x;
            endY = a.y;
            endAtomId = a.id;
            break;
          }
        }
      }

      // 3. Fix vertical alignment for branches (if near vertical line, snap dx = 0)
      if (Math.abs(startX - endX) < 12 && Math.abs(startY - endY) > 20) {
        const avgX = (startX + endX) / 2;
        startX = avgX;
        endX = avgX;
      }

      // 4. Fix horizontal alignment for chains (if near horizontal line, snap dy = 0)
      if (Math.abs(startY - endY) < 10 && Math.abs(startX - endX) > 20) {
        const avgY = (startY + endY) / 2;
        startY = avgY;
        endY = avgY;
      }

      return {
        ...bond,
        start: { x: startX, y: startY, atomId: startAtomId },
        end: { x: endX, y: endY, atomId: endAtomId },
      };
    }

    return el;
  });

  const molecularGraph = documentToMolecularGraph({
    ...doc,
    elements: updatedElements,
  });

  const validationReport = validateChemicalDocument({
    ...doc,
    elements: updatedElements,
  });

  return {
    ...doc,
    elements: updatedElements,
    molecularGraph,
    metadata: {
      ...doc.metadata,
      validationReport,
      formula: molecularGraph.formula,
    },
  };
}

/**
 * ChemDraw Auto-Clean / Angle Standardizer:
 * Standardizes bond lengths and snaps bond angles to 30/60/90/120/180 degrees
 */
export function cleanStructure(
  doc: CamDrawDocument,
  options: CleanStructureOptions = {}
): CamDrawDocument {
  const { standardBondLength = 48, snapAngles = true } = options;

  const normalized = normalizeGraphTopology(doc);
  const atoms = normalized.elements.filter((el) => el.type === "atom") as AtomElement[];
  const bonds = normalized.elements.filter((el) => el.type === "bond") as BondElement[];

  if (atoms.length < 2 && bonds.length === 0) {
    return normalized;
  }

  // Snap angles to nearest standard increment (e.g. 30 degrees)
  const angleIncrement = (Math.PI / 180) * 30;

  const updatedBonds = bonds.map((bond) => {
    let dx = bond.end.x - bond.start.x;
    let dy = bond.end.y - bond.start.y;
    let currentLen = Math.hypot(dx, dy);

    if (currentLen === 0) return bond;

    let angle = Math.atan2(dy, dx);
    if (snapAngles) {
      angle = Math.round(angle / angleIncrement) * angleIncrement;
    }

    // Set standard length if not fixed
    const targetLen =
      currentLen > 15 && currentLen < 150 ? standardBondLength : currentLen;
    const newEndX = bond.start.x + Math.cos(angle) * targetLen;
    const newEndY = bond.start.y + Math.sin(angle) * targetLen;

    return {
      ...bond,
      end: {
        ...bond.end,
        x: Math.round(newEndX),
        y: Math.round(newEndY),
      },
    };
  });

  return normalizeGraphTopology({
    ...normalized,
    elements: normalized.elements.map((el) => {
      if (el.type === "bond") {
        const found = updatedBonds.find((b) => b.id === el.id);
        return found || el;
      }
      return el;
    }),
  });
}

/**
 * Center structure in the canvas with comfortable padding
 */
export function centerStructureOnCanvas(doc: CamDrawDocument, padding: number = 60): CamDrawDocument {
  if (!doc.elements || doc.elements.length === 0) return doc;

  const { width = 800, height = 500 } = doc.canvas;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of doc.elements) {
    if (el.type === "atom") {
      const a = el as AtomElement;
      minX = Math.min(minX, a.x);
      maxX = Math.max(maxX, a.x);
      minY = Math.min(minY, a.y);
      maxY = Math.max(maxY, a.y);
    } else if (el.type === "bond") {
      const b = el as BondElement;
      minX = Math.min(minX, b.start.x, b.end.x);
      maxX = Math.max(maxX, b.start.x, b.end.x);
      minY = Math.min(minY, b.start.y, b.end.y);
      maxY = Math.max(maxY, b.start.y, b.end.y);
    } else if (el.type === "ring") {
      const r = el as RingElement;
      minX = Math.min(minX, r.cx - r.radius);
      maxX = Math.max(maxX, r.cx + r.radius);
      minY = Math.min(minY, r.cy - r.radius);
      maxY = Math.max(maxY, r.cy + r.radius);
    }
  }

  if (minX === Infinity || maxX === -Infinity) return doc;

  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const centerX = minX + contentW / 2;
  const centerY = minY + contentH / 2;

  const targetCenterX = width / 2;
  const targetCenterY = height / 2;

  const shiftX = Math.round(targetCenterX - centerX);
  const shiftY = Math.round(targetCenterY - centerY);

  const updatedElements = doc.elements.map((el) => {
    if (el.type === "atom") {
      const a = el as AtomElement;
      return { ...a, x: a.x + shiftX, y: a.y + shiftY };
    }
    if (el.type === "bond") {
      const b = el as BondElement;
      return {
        ...b,
        start: { ...b.start, x: b.start.x + shiftX, y: b.start.y + shiftY },
        end: { ...b.end, x: b.end.x + shiftX, y: b.end.y + shiftY },
      };
    }
    if (el.type === "ring") {
      const r = el as RingElement;
      return { ...r, cx: r.cx + shiftX, cy: r.cy + shiftY };
    }
    if (el.type === "bracket") {
      const br = el as BracketElement;
      return { ...br, x: br.x + shiftX, y: br.y + shiftY };
    }
    return el;
  });

  return {
    ...doc,
    elements: updatedElements,
  };
}
