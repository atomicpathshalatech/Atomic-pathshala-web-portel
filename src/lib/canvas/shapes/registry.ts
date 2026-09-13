/**
 * The one authoritative shape/tool registry for the live whiteboard.
 *
 * This is the fix for the "click Shape A, get Shape B" bug: every shape
 * button the UI renders comes from `SHAPE_DEFS` below, keyed by a unique,
 * stable string `id`. The UI passes that exact id to `setTool()`; the canvas
 * engine reads that exact id back out of `SHAPE_RENDERERS`/`FILLABLE_SHAPE_IDS`
 * to decide what to draw. Nothing anywhere maps a shape by array index or by
 * re-deriving it from another list — see canvas-engine.ts's drawShape()/
 * isInsideShape(), which now just look up `SHAPE_RENDERERS[shape]` instead of
 * an if/else chain of hardcoded ids.
 *
 * Previously `TeacherLiveClassRoom.tsx` defined its own SUBJECT_SHAPES map
 * where ~28 distinct, uniquely-labeled buttons all pointed at only 5 `id`
 * values (line/rectangle/circle/triangle/arrow) — e.g. "Benzene Ring",
 * "Star", and "DNA Helix" all had `id: "circle"`. That's the root cause this
 * registry replaces.
 */
import type { ShapeRenderer } from "./general-shapes";
import { GENERAL_SHAPE_RENDERERS, GENERAL_FILLABLE_IDS } from "./general-shapes";
import { CHEMISTRY_SHAPE_RENDERERS, CHEMISTRY_FILLABLE_IDS } from "./chemistry-shapes";
import { OTHER_SHAPE_RENDERERS } from "./other-shapes";

export type ShapeCategory = "general" | "phys" | "chem" | "bio";
export type ChemSubcategory =
  | "bonds"
  | "carbon-chains"
  | "rings"
  | "aromatic"
  | "functional-groups"
  | "organic-structures"
  | "inorganic";

export interface ShapeDef {
  /** Stable, unique across the ENTIRE registry — never reused, never an
   * array index. This is the only thing setTool()/the canvas ever see. */
  id: string;
  category: ShapeCategory;
  subcategory?: ChemSubcategory;
  label: string;
  icon: string;
}

const GENERAL_DEFS: ShapeDef[] = [
  { id: "line", category: "general", label: "Line", icon: "horizontal_rule" },
  { id: "arrow", category: "general", label: "Arrow", icon: "north_east" },
  { id: "double-arrow", category: "general", label: "Double Arrow", icon: "sync_alt" },
  { id: "curved-arrow", category: "general", label: "Curved Arrow", icon: "turn_right" },
  { id: "circle", category: "general", label: "Circle", icon: "circle" },
  { id: "ellipse", category: "general", label: "Ellipse", icon: "panorama_fish_eye" },
  { id: "rectangle", category: "general", label: "Rectangle", icon: "crop_square" },
  { id: "square", category: "general", label: "Square", icon: "crop_5_4" },
  { id: "rounded-rectangle", category: "general", label: "Rounded Rectangle", icon: "rounded_corner" },
  { id: "triangle", category: "general", label: "Triangle", icon: "change_history" },
  { id: "right-triangle", category: "general", label: "Right Triangle", icon: "play_arrow" },
  { id: "polygon", category: "general", label: "Polygon", icon: "hexagon" },
  { id: "star", category: "general", label: "Star", icon: "star" },
  { id: "diamond", category: "general", label: "Diamond", icon: "diamond" },
  { id: "bracket", category: "general", label: "Bracket", icon: "data_array" },
  { id: "curly-bracket", category: "general", label: "Curly Bracket", icon: "data_object" },
  { id: "arc", category: "general", label: "Arc", icon: "architecture" },
  { id: "freehand-shape", category: "general", label: "Freehand Shape", icon: "gesture" },
  { id: "dashed-line", category: "general", label: "Dashed Line", icon: "remove" },
  { id: "dotted-line", category: "general", label: "Dotted Line", icon: "more_horiz" },
  { id: "check-mark", category: "general", label: "Check Mark", icon: "check" },
  { id: "cross-mark", category: "general", label: "Cross Mark", icon: "close" },
  { id: "question-mark", category: "general", label: "Question Mark", icon: "help" },
  { id: "exclamation-mark", category: "general", label: "Exclamation Mark", icon: "priority_high" },
  { id: "highlight-area", category: "general", label: "Highlight Area", icon: "highlight" },
  { id: "callout", category: "general", label: "Callout", icon: "chat_bubble_outline" },
  { id: "speech-bubble", category: "general", label: "Speech Bubble", icon: "forum" },
];

const PHYS_DEFS: ShapeDef[] = [
  { id: "resistor", category: "phys", label: "Resistor", icon: "reorder" },
  { id: "capacitor", category: "phys", label: "Capacitor", icon: "pause" },
  { id: "inductor", category: "phys", label: "Inductor", icon: "waves" },
  { id: "battery", category: "phys", label: "Battery Cell", icon: "battery_charging_full" },
  { id: "pulley", category: "phys", label: "Pulley", icon: "radio_button_checked" },
  { id: "prism", category: "phys", label: "Optics Prism", icon: "change_history" },
  { id: "magnet", category: "phys", label: "Bar Magnet", icon: "crop_5_4" },
];

const BIO_DEFS: ShapeDef[] = [
  { id: "dna", category: "bio", label: "DNA Helix", icon: "grain" },
  { id: "animal-cell", category: "bio", label: "Animal Cell", icon: "lens" },
  { id: "neuron", category: "bio", label: "Neuron Cell", icon: "hub" },
  { id: "heart", category: "bio", label: "Human Heart", icon: "favorite" },
  { id: "leaf", category: "bio", label: "Plant Leaf", icon: "eco" },
];

const CHEM_DEFS: ShapeDef[] = [
  // Bonds
  { id: "bond-single", category: "chem", subcategory: "bonds", label: "Single Bond", icon: "horizontal_rule" },
  { id: "bond-double", category: "chem", subcategory: "bonds", label: "Double Bond", icon: "drag_handle" },
  { id: "bond-triple", category: "chem", subcategory: "bonds", label: "Triple Bond", icon: "reorder" },
  { id: "bond-wedge", category: "chem", subcategory: "bonds", label: "Wedge Bond", icon: "change_history" },
  { id: "bond-dash", category: "chem", subcategory: "bonds", label: "Dashed Bond", icon: "more_horiz" },
  { id: "bond-resonance", category: "chem", subcategory: "bonds", label: "Resonance", icon: "sync_alt" },

  // Carbon chains
  { id: "methane", category: "chem", subcategory: "carbon-chains", label: "Methane", icon: "hub" },
  { id: "ethane", category: "chem", subcategory: "carbon-chains", label: "Ethane", icon: "horizontal_rule" },
  { id: "propane", category: "chem", subcategory: "carbon-chains", label: "Propane", icon: "show_chart" },
  { id: "butane", category: "chem", subcategory: "carbon-chains", label: "Butane", icon: "show_chart" },
  { id: "pentane", category: "chem", subcategory: "carbon-chains", label: "Pentane", icon: "show_chart" },
  { id: "hexane", category: "chem", subcategory: "carbon-chains", label: "Hexane", icon: "show_chart" },
  { id: "heptane", category: "chem", subcategory: "carbon-chains", label: "Heptane", icon: "show_chart" },
  { id: "straight-chain", category: "chem", subcategory: "carbon-chains", label: "Straight Chain", icon: "show_chart" },
  { id: "branched-chain", category: "chem", subcategory: "carbon-chains", label: "Branched Chain", icon: "account_tree" },
  { id: "alkyl-group", category: "chem", subcategory: "carbon-chains", label: "Alkyl Group", icon: "linear_scale" },

  // Rings
  { id: "cyclopropane", category: "chem", subcategory: "rings", label: "Cyclopropane", icon: "change_history" },
  { id: "cyclobutane", category: "chem", subcategory: "rings", label: "Cyclobutane", icon: "crop_square" },
  { id: "cyclopentane", category: "chem", subcategory: "rings", label: "Cyclopentane", icon: "pentagon" },
  { id: "cyclohexane", category: "chem", subcategory: "rings", label: "Cyclohexane", icon: "hexagon" },
  { id: "five-ring-aromatic", category: "chem", subcategory: "rings", label: "5-Ring Aromatic", icon: "pentagon" },

  // Aromatic
  { id: "benzene", category: "chem", subcategory: "aromatic", label: "Benzene", icon: "hexagon" },
  { id: "benzene-circle", category: "chem", subcategory: "aromatic", label: "Benzene (Circle)", icon: "hexagon" },
  { id: "toluene", category: "chem", subcategory: "aromatic", label: "Toluene", icon: "hexagon" },
  { id: "aromatic-phenol", category: "chem", subcategory: "aromatic", label: "Phenol", icon: "hexagon" },
  { id: "aniline", category: "chem", subcategory: "aromatic", label: "Aniline", icon: "hexagon" },
  { id: "chlorobenzene", category: "chem", subcategory: "aromatic", label: "Chlorobenzene", icon: "hexagon" },
  { id: "nitrobenzene", category: "chem", subcategory: "aromatic", label: "Nitrobenzene", icon: "hexagon" },
  { id: "benzaldehyde", category: "chem", subcategory: "aromatic", label: "Benzaldehyde", icon: "hexagon" },
  { id: "benzoic-acid", category: "chem", subcategory: "aromatic", label: "Benzoic Acid", icon: "hexagon" },

  // Functional groups
  { id: "fg-alcohol", category: "chem", subcategory: "functional-groups", label: "Alcohol", icon: "opacity" },
  { id: "fg-phenol", category: "chem", subcategory: "functional-groups", label: "Phenol Group", icon: "opacity" },
  { id: "fg-ether", category: "chem", subcategory: "functional-groups", label: "Ether", icon: "compare_arrows" },
  { id: "fg-aldehyde", category: "chem", subcategory: "functional-groups", label: "Aldehyde", icon: "science" },
  { id: "fg-ketone", category: "chem", subcategory: "functional-groups", label: "Ketone", icon: "science" },
  { id: "fg-carboxylic-acid", category: "chem", subcategory: "functional-groups", label: "Carboxylic Acid", icon: "science" },
  { id: "fg-ester", category: "chem", subcategory: "functional-groups", label: "Ester", icon: "science" },
  { id: "fg-amine", category: "chem", subcategory: "functional-groups", label: "Amine", icon: "science" },
  { id: "fg-amide", category: "chem", subcategory: "functional-groups", label: "Amide", icon: "science" },
  { id: "fg-nitrile", category: "chem", subcategory: "functional-groups", label: "Nitrile", icon: "science" },
  { id: "fg-nitro", category: "chem", subcategory: "functional-groups", label: "Nitro", icon: "science" },
  { id: "fg-halo", category: "chem", subcategory: "functional-groups", label: "Halo Compound", icon: "science" },

  // Organic structures (hydrocarbon classes)
  { id: "alkane", category: "chem", subcategory: "organic-structures", label: "Alkane", icon: "show_chart" },
  { id: "alkene", category: "chem", subcategory: "organic-structures", label: "Alkene", icon: "show_chart" },
  { id: "alkyne", category: "chem", subcategory: "organic-structures", label: "Alkyne", icon: "show_chart" },
  { id: "cycloalkane", category: "chem", subcategory: "organic-structures", label: "Cycloalkane", icon: "hexagon" },
  { id: "cyclic-structure", category: "chem", subcategory: "organic-structures", label: "Basic Cyclic Structure", icon: "pentagon" },

  // Inorganic / common
  { id: "flask", category: "chem", subcategory: "inorganic", label: "Flask / Beaker", icon: "science" },
  { id: "atom-model", category: "chem", subcategory: "inorganic", label: "Atom Model", icon: "bubble_chart" },
  { id: "test-tube", category: "chem", subcategory: "inorganic", label: "Test Tube", icon: "biotech" },
];

export const SHAPE_DEFS: ShapeDef[] = [...GENERAL_DEFS, ...PHYS_DEFS, ...CHEM_DEFS, ...BIO_DEFS];

export const CHEM_SUBCATEGORY_LABELS: Record<ChemSubcategory, string> = {
  bonds: "Bonds",
  "carbon-chains": "Carbon Chains",
  rings: "Rings",
  aromatic: "Aromatic",
  "functional-groups": "Functional Groups",
  "organic-structures": "Organic Structures",
  inorganic: "Inorganic / Common",
};

export const CHEM_SUBCATEGORY_ORDER: ChemSubcategory[] = [
  "bonds",
  "carbon-chains",
  "rings",
  "aromatic",
  "functional-groups",
  "organic-structures",
  "inorganic",
];

/** Every id in SHAPE_DEFS is guaranteed unique — enforced at module load so
 * a future addition that accidentally reuses an id (the exact class of bug
 * this registry exists to prevent) fails immediately in development rather
 * than silently reintroducing the aliasing bug. */
function assertUniqueIds(defs: ShapeDef[]) {
  const seen = new Set<string>();
  for (const d of defs) {
    if (seen.has(d.id)) {
      throw new Error(`[shape-registry] duplicate shape id "${d.id}" — every shape must have a unique id.`);
    }
    seen.add(d.id);
  }
}
assertUniqueIds(SHAPE_DEFS);

export const SHAPE_RENDERERS: Record<string, ShapeRenderer> = {
  ...GENERAL_SHAPE_RENDERERS,
  ...OTHER_SHAPE_RENDERERS,
  ...CHEMISTRY_SHAPE_RENDERERS,
};

/** Every registry id must resolve to a renderer — checked at module load for
 * the same reason as assertUniqueIds above. */
function assertAllRendered(defs: ShapeDef[], renderers: Record<string, ShapeRenderer>) {
  for (const d of defs) {
    if (!renderers[d.id]) {
      throw new Error(`[shape-registry] shape id "${d.id}" has no renderer registered.`);
    }
  }
}
assertAllRendered(SHAPE_DEFS, SHAPE_RENDERERS);

/** Ids whose bucket-fill object-fill fast path is worth attempting (see
 * canvas-engine.ts fillAtPoint) — a curated list of shapes that draw a
 * simple closed region. Anything not listed here still gets the raster
 * flood-fill fallback, so omission here is a minor optimization gap, not a
 * correctness bug. */
export const FILLABLE_SHAPE_IDS: string[] = [...GENERAL_FILLABLE_IDS, ...CHEMISTRY_FILLABLE_IDS];

export type { ShapeRenderer } from "./general-shapes";
