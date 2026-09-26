/**
 * CAMDRAW — UNIVERSAL STRUCTURE RECOGNITION, CREATION & QUESTION INTEGRATION
 * Canonical Type Definitions & Data Model
 */

export type CamDrawDocType =
  | "chemical"
  | "reaction"
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
  | "coordinate";

export type RingType =
  | "benzene"
  | "cyclohexane"
  | "cyclopentane"
  | "cyclobutane"
  | "cyclopropane"
  | "pyridine"
  | "pyrrole"
  | "furan"
  | "naphthalene";

export type ReactionArrowStyle =
  | "forward"
  | "reversible"
  | "equilibrium"
  | "resonance"
  | "retrosynthetic";

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

export interface AtomElement extends BaseElement {
  type: "atom";
  x: number;
  y: number;
  symbol: string; // e.g. 'C', 'H', 'O', 'N', 'CH3', 'COOH', 'OH', etc.
  charge?: string; // '+', '-', '2+', 'δ+', 'δ-', etc.
  lonePairs?: number; // 0, 1, 2, 3
  subscript?: string;
  superscript?: string;
  fontSize?: number;
  isImplicitH?: boolean;
}

export interface BondElement extends BaseElement {
  type: "bond";
  start: Point & { atomId?: string };
  end: Point & { atomId?: string };
  bondType: BondType;
  thickness?: number;
  doubleBondAlignment?: "center" | "left" | "right";
}

export interface RingElement extends BaseElement {
  type: "ring";
  ringType: RingType;
  cx: number;
  cy: number;
  radius: number;
  rotation: number;
  aromaticCircle?: boolean;
  substituents?: Array<{
    vertexIndex: number; // 0 to 5 for 6-ring
    label: string;
    bondType?: BondType;
    length?: number;
  }>;
}

export interface ReactionArrowElement extends BaseElement {
  type: "reaction_arrow";
  start: Point;
  end: Point;
  arrowStyle: ReactionArrowStyle;
  topReagents?: string; // e.g. "KMnO4 / H+"
  bottomConditions?: string; // e.g. "Δ, 273 K"
  thickness?: number;
}

export interface CurvedArrowElement extends BaseElement {
  type: "curved_arrow";
  start: Point;
  control: Point;
  end: Point;
  arrowHead: "double_barb" | "single_barb" | "fish_hook"; // electron pair vs radical
  thickness?: number;
}

export interface PhysicsSymbolElement extends BaseElement {
  type: "physics_symbol";
  symbolType: PhysicsSymbolType;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string; // e.g. "R1 = 10 Ω"
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
  | ReactionArrowElement
  | CurvedArrowElement
  | PhysicsSymbolElement
  | BioShapeElement
  | TextAnnotationElement
  | MathPlotElement
  | ConnectorElement
  | FreehandElement;

export interface CamDrawCanvas {
  width: number;
  height: number;
  background?: string;
  gridEnabled?: boolean;
}

export interface CamDrawMetadata {
  title?: string;
  confidence?: number; // 0 - 100%
  matchMode?: "MATCH_REFERENCE" | "AUTO_ORGANIZE";
  warnings?: string[];
  recognizedAt?: string;
  recognizedFrom?: string; // image url or 'manual'
}

export interface CamDrawDocument {
  version: number;
  type: CamDrawDocType;
  canvas: CamDrawCanvas;
  elements: CamDrawElement[];
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
    version: 1,
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
