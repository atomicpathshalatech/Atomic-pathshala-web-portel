/**
 * CAMDRAW — PRESET TEMPLATES & ACADEMIC STRUCTURES
 * Extensible library of standardized structures across STEM subjects
 * Includes Organic Rings, Fused Systems, Heterocycles, Coordination Complexes,
 * Reaction Mechanisms, Haworth/Fischer Projections, Physics Circuits, Bio Shapes, and Math Plots.
 */

import { CamDrawDocument } from "./types";

export interface StructureTemplate {
  id: string;
  name: string;
  category:
    | "Organic Rings & Fused"
    | "Heterocycles"
    | "IUPAC & Branched"
    | "Coordination & Inorganic"
    | "Stereochemistry & Projections"
    | "Organic Reactions & Mechanisms"
    | "Physics"
    | "Biology"
    | "Mathematics";
  description: string;
  doc: CamDrawDocument;
}

export const CAMDRAW_TEMPLATES: StructureTemplate[] = [
  // 1. BENZENE RING
  {
    id: "benzene_ring",
    name: "Benzene Ring (C6H6)",
    category: "Organic Rings & Fused",
    description: "Standard aromatic benzene ring with delocalized pi electron ring",
    doc: {
      version: 2,
      type: "chemical",
      canvas: { width: 320, height: 320, background: "transparent" },
      elements: [
        {
          id: "r_benzene",
          type: "ring",
          ringType: "benzene",
          cx: 160,
          cy: 160,
          radius: 65,
          rotation: 0,
          aromaticCircle: true,
          color: "#1e293b",
        },
      ],
    },
  },

  // 2. NAPHTHALENE (FUSED BICYCLIC)
  {
    id: "naphthalene_ring",
    name: "Naphthalene (C10H8)",
    category: "Organic Rings & Fused",
    description: "Fused bicyclic aromatic hydrocarbon with shared bond",
    doc: {
      version: 2,
      type: "chemical",
      canvas: { width: 440, height: 320, background: "transparent" },
      elements: [
        {
          id: "r_naph1",
          type: "ring",
          ringType: "benzene",
          cx: 160,
          cy: 160,
          radius: 60,
          rotation: 30,
          aromaticCircle: true,
          color: "#1e293b",
        },
        {
          id: "r_naph2",
          type: "ring",
          ringType: "benzene",
          cx: 264,
          cy: 160,
          radius: 60,
          rotation: 30,
          aromaticCircle: true,
          color: "#1e293b",
        },
      ],
    },
  },

  // 3. CYCLOHEXANE (CHAIR CONFORMATION)
  {
    id: "cyclohexane_chair",
    name: "Cyclohexane Chair Conformation",
    category: "Organic Rings & Fused",
    description: "Conformationally stable chair form of cyclohexane with axial and equatorial sites",
    doc: {
      version: 2,
      type: "chemical",
      canvas: { width: 400, height: 300, background: "transparent" },
      elements: [
        { id: "a_c1", type: "atom", x: 120, y: 130, symbol: "C", fontSize: 16 },
        { id: "a_c2", type: "atom", x: 200, y: 110, symbol: "C", fontSize: 16 },
        { id: "a_c3", type: "atom", x: 280, y: 140, symbol: "C", fontSize: 16 },
        { id: "a_c4", type: "atom", x: 280, y: 190, symbol: "C", fontSize: 16 },
        { id: "a_c5", type: "atom", x: 200, y: 210, symbol: "C", fontSize: 16 },
        { id: "a_c6", type: "atom", x: 120, y: 180, symbol: "C", fontSize: 16 },
        { id: "b_12", type: "bond", start: { x: 120, y: 130, atomId: "a_c1" }, end: { x: 200, y: 110, atomId: "a_c2" }, bondType: "single" },
        { id: "b_23", type: "bond", start: { x: 200, y: 110, atomId: "a_c2" }, end: { x: 280, y: 140, atomId: "a_c3" }, bondType: "single" },
        { id: "b_34", type: "bond", start: { x: 280, y: 140, atomId: "a_c3" }, end: { x: 280, y: 190, atomId: "a_c4" }, bondType: "single" },
        { id: "b_45", type: "bond", start: { x: 280, y: 190, atomId: "a_c4" }, end: { x: 200, y: 210, atomId: "a_c5" }, bondType: "single" },
        { id: "b_56", type: "bond", start: { x: 200, y: 210, atomId: "a_c5" }, end: { x: 120, y: 180, atomId: "a_c6" }, bondType: "single" },
        { id: "b_61", type: "bond", start: { x: 120, y: 180, atomId: "a_c6" }, end: { x: 120, y: 130, atomId: "a_c1" }, bondType: "single" },
      ],
    },
  },

  // 4. PYRIDINE (HETEROCYCLE)
  {
    id: "pyridine_ring",
    name: "Pyridine (C5H5N)",
    category: "Heterocycles",
    description: "6-membered aromatic heterocycle containing one nitrogen atom",
    doc: {
      version: 2,
      type: "chemical",
      canvas: { width: 320, height: 320, background: "transparent" },
      elements: [
        {
          id: "r_pyr",
          type: "ring",
          ringType: "pyridine",
          cx: 160,
          cy: 160,
          radius: 65,
          rotation: 0,
          aromaticCircle: true,
          color: "#1e293b",
        },
        {
          id: "a_n",
          type: "atom",
          x: 160,
          y: 95,
          symbol: "N",
          fontSize: 20,
          color: "#2563eb",
          lonePairs: 1,
        },
      ],
    },
  },

  // 5. PYRROLE & FURAN
  {
    id: "pyrrole_ring",
    name: "Pyrrole (C4H5N)",
    category: "Heterocycles",
    description: "5-membered aromatic heterocycle containing NH group",
    doc: {
      version: 2,
      type: "chemical",
      canvas: { width: 320, height: 320, background: "transparent" },
      elements: [
        {
          id: "r_pyrrole",
          type: "ring",
          ringType: "pyrrole",
          cx: 160,
          cy: 160,
          radius: 60,
          rotation: 0,
          aromaticCircle: true,
          color: "#1e293b",
        },
        {
          id: "a_nh",
          type: "atom",
          x: 160,
          y: 100,
          symbol: "NH",
          fontSize: 18,
          color: "#2563eb",
        },
      ],
    },
  },

  // 6. INDOLE (FUSED HETEROCYCLE)
  {
    id: "indole_ring",
    name: "Indole (C8H7N)",
    category: "Heterocycles",
    description: "Fused bicyclic system comprising benzene and pyrrole rings",
    doc: {
      version: 2,
      type: "chemical",
      canvas: { width: 440, height: 320, background: "transparent" },
      elements: [
        {
          id: "r_indole_benz",
          type: "ring",
          ringType: "benzene",
          cx: 160,
          cy: 160,
          radius: 60,
          rotation: 30,
          aromaticCircle: true,
        },
        {
          id: "r_indole_pyr",
          type: "ring",
          ringType: "pyrrole",
          cx: 260,
          cy: 160,
          radius: 55,
          rotation: 18,
          aromaticCircle: true,
        },
        {
          id: "a_nh",
          type: "atom",
          x: 295,
          y: 120,
          symbol: "NH",
          fontSize: 18,
          color: "#2563eb",
        },
      ],
    },
  },

  // 7. IUPAC HIGHLY BRANCHED DERIVATIVE (NC-C(CH3)(CHO)-CH2-CH2-COOH)
  {
    id: "iupac_branched_dicarboxylic",
    name: "Branched 2-Cyano-2-Methyl Acid",
    category: "IUPAC & Branched",
    description: "NC—C(CH3)(CHO)—CH2—CH2—COOH showing exact vertical substituent attachment",
    doc: {
      version: 2,
      type: "chemical",
      canvas: { width: 750, height: 360, background: "transparent" },
      elements: [
        { id: "a_nc", type: "atom", x: 90, y: 180, symbol: "NC", fontSize: 20, color: "#0f172a" },
        { id: "a_c2", type: "atom", x: 220, y: 180, symbol: "C", fontSize: 20, color: "#0f172a" },
        { id: "a_ch3", type: "atom", x: 220, y: 70, symbol: "CH3", fontSize: 20, color: "#0f172a" },
        { id: "a_cho", type: "atom", x: 220, y: 290, symbol: "CHO", fontSize: 20, color: "#0f172a" },
        { id: "a_ch2_1", type: "atom", x: 370, y: 180, symbol: "CH2", fontSize: 20, color: "#0f172a" },
        { id: "a_ch2_2", type: "atom", x: 510, y: 180, symbol: "CH2", fontSize: 20, color: "#0f172a" },
        { id: "a_cooh", type: "atom", x: 650, y: 180, symbol: "COOH", fontSize: 20, color: "#0f172a" },

        // Horizontal Chain Bonds
        { id: "b_nc_c2", type: "bond", start: { x: 125, y: 180, atomId: "a_nc" }, end: { x: 205, y: 180, atomId: "a_c2" }, bondType: "single", thickness: 2.5 },
        { id: "b_c2_ch2_1", type: "bond", start: { x: 235, y: 180, atomId: "a_c2" }, end: { x: 340, y: 180, atomId: "a_ch2_1" }, bondType: "single", thickness: 2.5 },
        { id: "b_ch2_1_2", type: "bond", start: { x: 400, y: 180, atomId: "a_ch2_1" }, end: { x: 480, y: 180, atomId: "a_ch2_2" }, bondType: "single", thickness: 2.5 },
        { id: "b_ch2_cooh", type: "bond", start: { x: 540, y: 180, atomId: "a_ch2_2" }, end: { x: 610, y: 180, atomId: "a_cooh" }, bondType: "single", thickness: 2.5 },

        // Vertical Branch Bonds (Strictly attached to central carbon a_c2)
        { id: "b_c2_top", type: "bond", start: { x: 220, y: 160, atomId: "a_c2" }, end: { x: 220, y: 95, atomId: "a_ch3" }, bondType: "single", thickness: 2.5 },
        { id: "b_c2_bot", type: "bond", start: { x: 220, y: 200, atomId: "a_c2" }, end: { x: 220, y: 265, atomId: "a_cho" }, bondType: "single", thickness: 2.5 },
      ],
    },
  },

  // 8. COORDINATION COMPLEX: [Pt(NH3)2Cl2] (CISPLATIN)
  {
    id: "coord_cisplatin",
    name: "Cisplatin [Pt(NH3)2Cl2] (Square Planar)",
    category: "Coordination & Inorganic",
    description: "Square planar platinum anticancer complex with coordination coordinate bonds",
    doc: {
      version: 2,
      type: "coordination",
      canvas: { width: 460, height: 380, background: "transparent" },
      elements: [
        { id: "a_pt", type: "atom", x: 230, y: 190, symbol: "Pt", fontSize: 24, color: "#475569" },
        { id: "a_nh3_1", type: "atom", x: 120, y: 110, symbol: "H3N", fontSize: 20, color: "#2563eb" },
        { id: "a_nh3_2", type: "atom", x: 120, y: 270, symbol: "H3N", fontSize: 20, color: "#2563eb" },
        { id: "a_cl_1", type: "atom", x: 340, y: 110, symbol: "Cl", fontSize: 20, color: "#16a34a" },
        { id: "a_cl_2", type: "atom", x: 340, y: 270, symbol: "Cl", fontSize: 20, color: "#16a34a" },

        // Coordinate and Covalent Bonds
        { id: "b_pt_nh3_1", type: "bond", start: { x: 145, y: 125, atomId: "a_nh3_1" }, end: { x: 210, y: 175, atomId: "a_pt" }, bondType: "coordinate", thickness: 2.2 },
        { id: "b_pt_nh3_2", type: "bond", start: { x: 145, y: 255, atomId: "a_nh3_2" }, end: { x: 210, y: 205, atomId: "a_pt" }, bondType: "coordinate", thickness: 2.2 },
        { id: "b_pt_cl_1", type: "bond", start: { x: 245, y: 175, atomId: "a_pt" }, end: { x: 320, y: 125, atomId: "a_cl_1" }, bondType: "single", thickness: 2.2 },
        { id: "b_pt_cl_2", type: "bond", start: { x: 245, y: 205, atomId: "a_pt" }, end: { x: 320, y: 255, atomId: "a_cl_2" }, bondType: "single", thickness: 2.2 },

        // Bracket enclosing coordination entity
        { id: "br_pt", type: "bracket", bracketType: "square", x: 70, y: 70, width: 320, height: 240, charge: "0", thickness: 2.5 },
      ],
    },
  },

  // 9. COORDINATION COMPLEX: [Fe(CN)6]4- (OCTAHEDRAL)
  {
    id: "coord_ferrocyanide",
    name: "Hexacyanoferrate(II) [Fe(CN)6]⁴⁻ (Octahedral)",
    category: "Coordination & Inorganic",
    description: "Octahedral transition metal complex enclosed in brackets with 4- overall charge",
    doc: {
      version: 2,
      type: "coordination",
      canvas: { width: 480, height: 440, background: "transparent" },
      elements: [
        { id: "a_fe", type: "atom", x: 240, y: 220, symbol: "Fe", fontSize: 24, color: "#ea580c" },
        { id: "a_cn_top", type: "atom", x: 240, y: 100, symbol: "NC", fontSize: 18, color: "#0f172a" },
        { id: "a_cn_bot", type: "atom", x: 240, y: 340, symbol: "CN", fontSize: 18, color: "#0f172a" },
        { id: "a_cn_l", type: "atom", x: 120, y: 220, symbol: "NC", fontSize: 18, color: "#0f172a" },
        { id: "a_cn_r", type: "atom", x: 360, y: 220, symbol: "CN", fontSize: 18, color: "#0f172a" },
        { id: "a_cn_w1", type: "atom", x: 160, y: 270, symbol: "NC", fontSize: 16, color: "#0f172a" },
        { id: "a_cn_d1", type: "atom", x: 320, y: 170, symbol: "CN", fontSize: 16, color: "#0f172a" },

        // Octahedral Coordinate Bonds (Axial, Equatorial, Wedge, Dash)
        { id: "b_fe_top", type: "bond", start: { x: 240, y: 125, atomId: "a_cn_top" }, end: { x: 240, y: 200, atomId: "a_fe" }, bondType: "coordinate", thickness: 2.2 },
        { id: "b_fe_bot", type: "bond", start: { x: 240, y: 315, atomId: "a_cn_bot" }, end: { x: 240, y: 240, atomId: "a_fe" }, bondType: "coordinate", thickness: 2.2 },
        { id: "b_fe_l", type: "bond", start: { x: 145, y: 220, atomId: "a_cn_l" }, end: { x: 220, y: 220, atomId: "a_fe" }, bondType: "coordinate", thickness: 2.2 },
        { id: "b_fe_r", type: "bond", start: { x: 335, y: 220, atomId: "a_cn_r" }, end: { x: 260, y: 220, atomId: "a_fe" }, bondType: "coordinate", thickness: 2.2 },
        { id: "b_fe_w", type: "bond", start: { x: 240, y: 220, atomId: "a_fe" }, end: { x: 185, y: 260, atomId: "a_cn_w1" }, bondType: "wedge", thickness: 2.2 },
        { id: "b_fe_d", type: "bond", start: { x: 240, y: 220, atomId: "a_fe" }, end: { x: 295, y: 180, atomId: "a_cn_d1" }, bondType: "dash", thickness: 2.2 },

        // Square Bracket with 4- charge
        { id: "br_fe", type: "bracket", bracketType: "square", x: 60, y: 55, width: 360, height: 330, charge: "4-", thickness: 2.5 },
      ],
    },
  },

  // 10. STEREOCHEMISTRY: WEDGE-DASH CHIRAL TETRAHEDRON
  {
    id: "stereo_chiral_center",
    name: "Chiral Carbon (Wedge-Dash Stereochemistry)",
    category: "Stereochemistry & Projections",
    description: "Tetrahedral carbon with solid wedge (pointing out) and dashed bond (pointing away)",
    doc: {
      version: 2,
      type: "chemical",
      canvas: { width: 380, height: 340, background: "transparent" },
      elements: [
        { id: "a_c", type: "atom", x: 190, y: 170, symbol: "C*", fontSize: 22, color: "#0f172a" },
        { id: "a_top", type: "atom", x: 190, y: 60, symbol: "COOH", fontSize: 18, color: "#0f172a" },
        { id: "a_left", type: "atom", x: 80, y: 210, symbol: "H3C", fontSize: 18, color: "#0f172a" },
        { id: "a_wedge", type: "atom", x: 260, y: 250, symbol: "NH2", fontSize: 18, color: "#2563eb" },
        { id: "a_dash", type: "atom", x: 290, y: 140, symbol: "H", fontSize: 18, color: "#64748b" },

        { id: "b_c_top", type: "bond", start: { x: 190, y: 150, atomId: "a_c" }, end: { x: 190, y: 85, atomId: "a_top" }, bondType: "single", thickness: 2.2 },
        { id: "b_c_left", type: "bond", start: { x: 175, y: 175, atomId: "a_c" }, end: { x: 115, y: 200, atomId: "a_left" }, bondType: "single", thickness: 2.2 },
        { id: "b_c_w", type: "bond", start: { x: 190, y: 170, atomId: "a_c" }, end: { x: 245, y: 235, atomId: "a_wedge" }, bondType: "wedge", thickness: 2.5 },
        { id: "b_c_d", type: "bond", start: { x: 190, y: 170, atomId: "a_c" }, end: { x: 275, y: 145, atomId: "a_dash" }, bondType: "dash", thickness: 2.5 },
      ],
    },
  },

  // 11. HAWORTH PROJECTION: α-D-GLUCOPYRANOSE
  {
    id: "haworth_d_glucose",
    name: "α-D-Glucopyranose (Haworth Projection)",
    category: "Stereochemistry & Projections",
    description: "6-membered cyclic hemiacetal pyranose ring of D-glucose with stereochemical hydroxyls",
    doc: {
      version: 2,
      type: "chemical",
      canvas: { width: 480, height: 380, background: "transparent" },
      elements: [
        { id: "r_pyran", type: "ring", ringType: "cyclohexane", cx: 240, cy: 190, radius: 65, rotation: 30 },
        { id: "a_o", type: "atom", x: 272, y: 135, symbol: "O", fontSize: 18, color: "#dc2626" },
        { id: "a_c6", type: "atom", x: 175, y: 75, symbol: "CH2OH", fontSize: 16 },
        { id: "a_oh1", type: "atom", x: 310, y: 260, symbol: "OH", fontSize: 16 },
        { id: "a_oh2", type: "atom", x: 240, y: 280, symbol: "OH", fontSize: 16 },
        { id: "a_oh3", type: "atom", x: 170, y: 260, symbol: "HO", fontSize: 16 },
        { id: "a_oh4", type: "atom", x: 140, y: 190, symbol: "OH", fontSize: 16 },

        { id: "b_c6", type: "bond", start: { x: 190, y: 145 }, end: { x: 175, y: 95 }, bondType: "single", thickness: 2.2 },
        { id: "b_oh1", type: "bond", start: { x: 295, y: 215 }, end: { x: 310, y: 245 }, bondType: "single", thickness: 2.2 },
        { id: "b_oh2", type: "bond", start: { x: 240, y: 245 }, end: { x: 240, y: 265 }, bondType: "single", thickness: 2.2 },
      ],
    },
  },

  // 12. ORGANIC REACTION: ALCOHOL OXIDATION
  {
    id: "reaction_alcohol_oxidation",
    name: "Ethanol to Acetic Acid (Oxidation)",
    category: "Organic Reactions & Mechanisms",
    description: "Oxidation of primary alcohol using alkaline KMnO4 with heat",
    doc: {
      version: 2,
      type: "reaction",
      canvas: { width: 700, height: 260, background: "transparent" },
      elements: [
        { id: "a_reactant", type: "atom", x: 120, y: 130, symbol: "CH3-CH2-OH", fontSize: 22, color: "#0f172a" },
        {
          id: "arr_1",
          type: "reaction_arrow",
          start: { x: 250, y: 130 },
          end: { x: 450, y: 130 },
          arrowStyle: "forward",
          topReagents: "Alk. KMnO4 + Δ",
          bottomConditions: "Acidified (H+)",
          thickness: 2.5,
          color: "#0284c7",
        },
        { id: "a_product", type: "atom", x: 570, y: 130, symbol: "CH3-COOH", fontSize: 22, color: "#0f172a" },
      ],
    },
  },

  // 13. SN2 MECHANISM WITH CURVED ARROWS
  {
    id: "mechanism_sn2",
    name: "SN2 Nucleophilic Substitution (Curved Arrow)",
    category: "Organic Reactions & Mechanisms",
    description: "Backside attack of hydroxide on methyl bromide showing electron movement",
    doc: {
      version: 2,
      type: "reaction",
      canvas: { width: 750, height: 320, background: "transparent" },
      elements: [
        { id: "a_nuc", type: "atom", x: 80, y: 160, symbol: "HO⁻", fontSize: 22, lonePairs: 3, color: "#dc2626" },
        { id: "a_sub", type: "atom", x: 270, y: 160, symbol: "CH3-Br", fontSize: 22, color: "#0f172a" },
        {
          id: "c_arr_1",
          type: "curved_arrow",
          start: { x: 115, y: 145 },
          control: { x: 185, y: 95 },
          end: { x: 235, y: 145 },
          arrowHead: "double_barb",
          color: "#dc2626",
        },
        {
          id: "c_arr_2",
          type: "curved_arrow",
          start: { x: 295, y: 145 },
          control: { x: 330, y: 100 },
          end: { x: 350, y: 145 },
          arrowHead: "double_barb",
          color: "#dc2626",
        },
        {
          id: "arr_main",
          type: "reaction_arrow",
          start: { x: 370, y: 160 },
          end: { x: 480, y: 160 },
          arrowStyle: "forward",
          topReagents: "Acetone (polar aprotic)",
          thickness: 2.2,
        },
        { id: "a_prod", type: "atom", x: 600, y: 160, symbol: "HO-CH3  +  Br⁻", fontSize: 22, color: "#0f172a" },
      ],
    },
  },

  // 14. PHYSICS: RC CIRCUIT DIAGRAM
  {
    id: "physics_rc_circuit",
    name: "RC Circuit Diagram",
    category: "Physics",
    description: "Series resistor-capacitor circuit connected with DC battery and switch",
    doc: {
      version: 2,
      type: "physics",
      canvas: { width: 600, height: 380, background: "transparent" },
      elements: [
        { id: "sym_batt", type: "physics_symbol", symbolType: "battery", x: 100, y: 190, width: 50, height: 80, label: "V = 12V" },
        { id: "sym_res", type: "physics_symbol", symbolType: "resistor", x: 300, y: 80, width: 100, height: 35, label: "R = 100 Ω" },
        { id: "sym_cap", type: "physics_symbol", symbolType: "capacitor", x: 480, y: 190, width: 40, height: 80, label: "C = 10 µF" },
        { id: "sym_sw", type: "physics_symbol", symbolType: "switch", x: 170, y: 80, width: 60, height: 35, label: "S (t=0)" },
        { id: "conn_top", type: "connector", points: [{ x: 100, y: 150 }, { x: 100, y: 80 }, { x: 150, y: 80 }], style: "solid" },
        { id: "conn_mid", type: "connector", points: [{ x: 220, y: 80 }, { x: 260, y: 80 }], style: "solid" },
        { id: "conn_top_right", type: "connector", points: [{ x: 350, y: 80 }, { x: 480, y: 80 }, { x: 480, y: 150 }], style: "solid" },
        { id: "conn_bottom", type: "connector", points: [{ x: 480, y: 230 }, { x: 480, y: 300 }, { x: 100, y: 300 }, { x: 100, y: 230 }], style: "solid" },
      ],
    },
  },

  // 15. BIOLOGY: EUKARYOTIC CELL
  {
    id: "biology_cell_diagram",
    name: "Animal Cell Schematic",
    category: "Biology",
    description: "Simplified animal cell with nucleus, mitochondria and cell membrane labels",
    doc: {
      version: 2,
      type: "biology",
      canvas: { width: 600, height: 400, background: "transparent" },
      elements: [
        { id: "cell_mem", type: "bio_shape", shapeType: "cell_membrane", x: 300, y: 200, width: 420, height: 280, label: "Plasma Membrane" },
        { id: "nuc", type: "bio_shape", shapeType: "nucleus", x: 260, y: 180, width: 120, height: 120, label: "Nucleus" },
        { id: "mito_1", type: "bio_shape", shapeType: "mitochondria", x: 420, y: 140, width: 70, height: 40, label: "Mitochondria" },
        { id: "mito_2", type: "bio_shape", shapeType: "mitochondria", x: 180, y: 260, width: 70, height: 40, label: "Mitochondria" },
      ],
    },
  },

  // 16. MATHEMATICS: CARTESIAN PLANE & PARABOLA
  {
    id: "math_parabola_graph",
    name: "Parabolic Graph y = x²",
    category: "Mathematics",
    description: "Standard coordinate axes with quadratic function curve",
    doc: {
      version: 2,
      type: "math",
      canvas: { width: 500, height: 400, background: "transparent" },
      elements: [
        { id: "axes_1", type: "math_plot", plotType: "axes", cx: 250, cy: 280, width: 360, height: 300, xLabel: "X-axis", yLabel: "Y-axis" },
        { id: "curve_parabola", type: "math_plot", plotType: "parabola", cx: 250, cy: 280, width: 160, height: 160, label: "y = x²" },
      ],
    },
  },
];
