/**
 * CAMDRAW — UNIVERSAL CHEMICAL STRUCTURE RECOGNITION, GRAPH ENGINE & CHEMDRAW STUDIO
 * Canonical Type Definitions & Molecular Graph Data Model
 */

export type CamDrawDocType =
  | "chemical"
  | "reaction"
  | "coordination"
  | "mechanism"
  | "physics"
  | "biology"
  | "math"
  | "custom";

export type BondType =
  | "single"
  | "double"
  | "triple"
  | "aromatic"
  | "wedge"
  | "dash"
  | "wavy"
  | "coordinate"
  | "delocalized"
  | "hydrogen"
  | "single_or_double";

export type StereoType =
  | "none"
  | "up" // Solid wedge
  | "down" // Hashed wedge / dash
  | "either" // Wavy / undefined stereochemistry
  | "cis"
  | "trans";

export type RingType =
  | "benzene"
  | "cyclohexane"
  | "cyclopentane"
  | "cyclobutane"
  | "cyclopropane"
  | "cycloheptane"
  | "cyclooctane"
  | "naphthalene"
  | "anthracene"
  | "phenanthrene"
  | "pyridine"
  | "pyrimidine"
  | "pyrazine"
  | "pyrrole"
  | "furan"
  | "thiophene"
  | "imidazole"
  | "indole"
  | "purine"
  | "quinoline";

export type ReactionArrowStyle =
  | "forward"
  | "reversible"
  | "equilibrium"
  | "resonance"
  | "retrosynthetic"
  | "curved_flow";

export type BracketType =
  | "square" // [ ... ] (Coordination complexes, charges)
  | "round" // ( ... )
  | "curly" // { ... }
  | "polymer" // -[ ... ]_n-
  | "transition_state"; // [ ... ]‡

export type PhysicsSymbolType =
  | "resistor"
  | "capacitor"
  | "inductor"
  | "battery"
  | "ground"
  | "switch"
  | "diode"
  | "voltmeter"
  | "ammeter"
  | "ac_source"
  | "pulley"
  | "mass_block"
  | "spring"
  | "inclined_plane"
  | "convex_lens"
  | "concave_lens"
  | "plane_mirror"
  | "concave_mirror"
  | "convex_mirror"
  | "ray_arrow"
  | "force_vector"
  | "coordinate_axes";

export type BioShapeType =
  | "cell_membrane"
  | "nucleus"
  | "mitochondria"
  | "chloroplast"
  | "dna_double_helix"
  | "chromosome"
  | "neuron"
  | "bracket_callout";

export interface Point {
  x: number;
  y: number;
}

export interface BaseElement {
  id: string;
  type: string;
  color?: string;
  layer?: number;
  rotation?: number; // in degrees
  scale?: number;
}

/**
 * High-Fidelity Graph Atom
 */
export interface AtomElement extends BaseElement {
  type: "atom";
  x: number;
  y: number;
  symbol: string; // e.g. 'C', 'H', 'O', 'N', 'CH3', 'COOH', 'OH', 'Pt', 'Fe', etc.
  charge?: string; // '+', '-', '2+', '3+', 'δ+', 'δ-', etc.
  lonePairs?: number; // 0, 1, 2, 3, 4
  radicals?: number; // 0, 1 (radical dot), 2 (diradical)
  subscript?: string;
  superscript?: string;
  fontSize?: number;
  isImplicitH?: boolean;
  implicitHCount?: number;
  isotope?: number; // e.g. 13 for 13C, 2 for D, 3 for T
  valency?: number;
  oxidationState?: number;
  atomIndex?: number;
}

/**
 * High-Fidelity Graph Bond
 */
export interface BondElement extends BaseElement {
  type: "bond";
  start: Point & { atomId?: string };
  end: Point & { atomId?: string };
  bondType: BondType;
  stereo?: StereoType;
  order?: number; // 1, 2, 3, 1.5
  thickness?: number;
  doubleBondAlignment?: "center" | "left" | "right" | "auto";
  donorAtomId?: string; // For coordinate/dative bonds (arrow points start -> end)
  isAromatic?: boolean;
}

/**
 * Ring System Element
 */
export interface RingElement extends BaseElement {
  type: "ring";
  ringType: RingType;
  cx: number;
  cy: number;
  radius: number;
  rotation: number;
  aromaticCircle?: boolean;
  heteroAtoms?: Array<{
    vertexIndex: number; // 0 to N-1
    symbol: string; // e.g. 'N', 'O', 'S'
    charge?: string;
  }>;
  substituents?: Array<{
    vertexIndex: number;
    label: string;
    bondType?: BondType;
    stereo?: StereoType;
    length?: number;
  }>;
}

/**
 * Reaction Arrow with Top/Bottom Reagents and Conditions
 */
export interface ReactionArrowElement extends BaseElement {
  type: "reaction_arrow";
  start: Point;
  end: Point;
  arrowStyle: ReactionArrowStyle;
  topReagents?: string; // e.g. "KMnO4 / H+"
  bottomConditions?: string; // e.g. "Δ, 273 K"
  thickness?: number;
}

/**
 * Curved Electron Flow Arrow for Reaction Mechanisms
 */
export interface CurvedArrowElement extends BaseElement {
  type: "curved_arrow";
  start: Point;
  control: Point;
  end: Point;
  arrowHead: "double_barb" | "single_barb" | "fish_hook"; // electron pair (double) vs radical (single)
  sourceType?: "atom" | "bond" | "lone_pair";
  targetType?: "atom" | "bond";
  sourceId?: string;
  targetId?: string;
  thickness?: number;
}

/**
 * Coordination Complex or Polymer Bracket
 */
export interface BracketElement extends BaseElement {
  type: "bracket";
  bracketType: BracketType;
  x: number; // Top-left x
  y: number; // Top-left y
  width: number;
  height: number;
  charge?: string; // e.g. "2+", "4-", "-"
  subscript?: string; // e.g. "n" for polymer
  label?: string; // e.g. "‡" for transition state
  thickness?: number;
}

export interface PhysicsSymbolElement extends BaseElement {
  type: "physics_symbol";
  symbolType: PhysicsSymbolType;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  value?: string;
}

export interface BioShapeElement extends BaseElement {
  type: "bio_shape";
  shapeType: BioShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

export interface TextAnnotationElement extends BaseElement {
  type: "text";
  x: number;
  y: number;
  text: string;
  fontSize?: number;
  fontWeight?: string;
  italic?: boolean;
}

export interface MathPlotElement extends BaseElement {
  type: "math_plot";
  plotType: "axes" | "parabola" | "sine" | "circle" | "vector" | "triangle";
  cx: number;
  cy: number;
  width: number;
  height: number;
  xLabel?: string;
  yLabel?: string;
  label?: string;
}

export interface ConnectorElement extends BaseElement {
  type: "connector";
  points: Point[];
  style: "solid" | "dashed" | "dotted";
  arrowStart?: boolean;
  arrowEnd?: boolean;
}

export interface FreehandElement extends BaseElement {
  type: "freehand";
  points: Point[];
  strokeWidth: number;
}

export type CamDrawElement =
  | AtomElement
  | BondElement
  | RingElement
  | BracketElement
  | ReactionArrowElement
  | CurvedArrowElement
  | PhysicsSymbolElement
  | BioShapeElement
  | TextAnnotationElement
  | MathPlotElement
  | ConnectorElement
  | FreehandElement;

export interface MolecularGraph {
  atoms: AtomElement[];
  bonds: BondElement[];
  rings?: RingElement[];
  brackets?: BracketElement[];
  formula?: string; // e.g. "C6H12O6"
  smiles?: string;
  iupacName?: string;
}

export interface CamDrawCanvas {
  width: number;
  height: number;
  background?: string;
  gridEnabled?: boolean;
}

export interface CamDrawValidationReport {
  valid: boolean;
  warnings: string[];
  errors: string[];
  valencyMap?: Record<string, { current: number; max: number; valid: boolean }>;
}

export interface CamDrawMetadata {
  title?: string;
  confidence?: number; // 0 - 100%
  matchMode?: "MATCH_REFERENCE" | "AUTO_ORGANIZE";
  warnings?: string[];
  recognizedAt?: string;
  recognizedFrom?: string; // image url or 'manual'
  formula?: string;
  molecularWeight?: number;
  validationReport?: CamDrawValidationReport;
}

export interface CamDrawDocument {
  version: number;
  type: CamDrawDocType;
  canvas: CamDrawCanvas;
  elements: CamDrawElement[];
  molecularGraph?: MolecularGraph;
  metadata?: CamDrawMetadata;
}

/**
 * Creates an empty default CamDraw document
 */
export function createEmptyCamDrawDocument(
  type: CamDrawDocType = "chemical",
  width: number = 800,
  height: number = 500
): CamDrawDocument {
  return {
    version: 2,
    type,
    canvas: {
      width,
      height,
      background: "transparent",
      gridEnabled: true,
    },
    elements: [],
    metadata: {
      matchMode: "MATCH_REFERENCE",
      confidence: 100,
    },
  };
}
