/**
 * CAMDRAW — ADVANCED CHEMICAL STRUCTURE RECOGNITION ENGINE (CAMDRAW 2.0)
 * Vision-powered extraction of molecular graphs, stereochemistry, coordination complexes,
 * and academic STEM diagrams with geometry preservation and graph topology normalization.
 */

import { executeGeminiWithFailover } from "@/lib/questions/gemini-engine";
import { parseAiJson } from "@/lib/ai/latex-json";
import { lightThinking } from "@/lib/ai/gemini-models";
import { CamDrawDocument, CamDrawElement, createEmptyCamDrawDocument } from "./types";
import { normalizeGraphTopology, centerStructureOnCanvas } from "./graph";
import { validateChemicalDocument } from "./validator";

export interface StructureRecognitionResult {
  success: boolean;
  document: CamDrawDocument;
  confidence: number;
  warnings: string[];
  detectedType: string;
  costInfo?: any;
  error?: string;
}

const ADVANCED_CHEMICAL_SYSTEM_PROMPT = `You are the CamDraw Advanced Chemical Structure & Molecular Graph Engine.
You are an expert computational chemist and structural diagram recognition AI.

YOUR MISSION:
Analyze the input image and convert any chemical structure, molecular graph, reaction mechanism, coordination complex, or STEM schematic into a canonical, editable CamDraw JSON document.

CRITICAL ARCHITECTURAL RULES:
1. CHEMICAL MOLECULAR GRAPH & TOPOLOGY FIRST:
   - Treat structures as structured graphs of atoms (nodes) and bonds (edges) with 2D geometry, NEVER as plain OCR text or flat drawings.
   - Give each atom a unique ID (e.g. "a_c1", "a_ch3", "a_cho", "a_oh").
   - Give each bond explicit start and end atomId references (e.g. start: { x: 220, y: 180, atomId: "a_c2" }, end: { x: 220, y: 70, atomId: "a_ch3" }).

2. EXACT IUPAC BRANCH ATTACHMENT & VERTICAL BONDS:
   - For branched molecules (e.g. NC — C(CH3)(CHO) — CH2 — CH2 — COOH):
     * Identify the EXACT carbon atom that carries the substituents.
     * Place top substituents (e.g. CH3) vertically aligned above that specific carbon atom ('C').
     * Place bottom substituents (e.g. CHO) vertically aligned below that specific carbon atom ('C').
     * Attach the vertical bonds directly to that central carbon atom ('C'), NEVER to adjacent groups like 'CH2'.
     * Maintain straight horizontal chain alignment for the main backbone (NC - C - CH2 - CH2 - COOH).

3. STEREOCHEMISTRY & BONDS:
   - Solid wedges: bondType = "wedge" (tapered filled triangle pointing toward viewer).
   - Hashed wedges / dashes: bondType = "dash" (tapered dashed line pointing away).
   - Wavy / racemic bonds: bondType = "wavy" (unknown stereochemistry).
   - Double bonds: bondType = "double".
   - Triple bonds: bondType = "triple".
   - Coordinate / dative bonds: bondType = "coordinate" (arrow pointing from donor to acceptor).

4. RINGS, FUSED SYSTEMS & HETEROCYCLES:
   - Identify ring systems (benzene, cyclohexane, cyclopentane, naphthalene, pyridine, pyrrole, furan, indole).
   - If aromatic, set aromaticCircle: true.
   - For heteroatoms inside rings (e.g. Pyridine N, Pyrrole NH), include them at their exact ring vertices.

5. COORDINATION COMPLEXES & INORGANIC COMPOUNDS:
   - Complexes like [Pt(NH3)2Cl2] or [Fe(CN)6]4-:
     * Identify central metal atom (Pt, Fe, Co, Ni, Cu, etc.) and surrounding ligands.
     * Enclose the complex in a "bracket" element (bracketType: "square", charge: "2+", "4-", etc.).

6. REACTION MECHANISMS & ARROWS:
   - Identify reaction arrows (arrowStyle: "forward" | "reversible" | "equilibrium" | "resonance") with topReagents and bottomConditions.
   - Identify electron movement curved arrows (curved_arrow) with start, control (quadratic arc apex), and end points.

7. GEOMETRY PRESERVATION (MATCH REFERENCE):
   - Scale canvas coordinates cleanly into an 800 x 500 viewport.
   - Preserve relative orientations, substituents, and structural layout from the reference image.

OUTPUT SCHEMA (STRICT JSON ONLY):
{
  "version": 2,
  "type": "chemical" | "reaction" | "coordination" | "physics" | "biology" | "math",
  "canvas": {
    "width": 800,
    "height": 500,
    "background": "transparent"
  },
  "elements": [
    // Elements array: AtomElement, BondElement, RingElement, BracketElement, ReactionArrowElement, CurvedArrowElement, etc.
  ],
  "metadata": {
    "confidence": 95,
    "matchMode": "MATCH_REFERENCE",
    "warnings": []
  }
}
`;

/**
 * Recognizes scientific structure from an image URL or Base64 data
 */
export async function recognizeStructureFromImage(
  imageSource: string,
  options: {
    preferredType?: string;
    hintSubject?: string;
  } = {}
): Promise<StructureRecognitionResult> {
  try {
    // 1. Prepare image payload
    let inlinePart: { inlineData: { data: string; mimeType: string } };

    if (imageSource.startsWith("data:")) {
      const mimeMatch = imageSource.match(/^data:([^;]+);base64,/);
      const mimeType: string = mimeMatch && mimeMatch[1] ? mimeMatch[1] : "image/png";
      const base64Data = imageSource.replace(/^data:[^;]+;base64,/, "");
      inlinePart = {
        inlineData: {
          data: base64Data,
          mimeType,
        },
      };
    } else {
      const res = await fetch(imageSource);
      if (!res.ok) {
        throw new Error(`Failed to fetch image from URL: ${res.statusText}`);
      }
      const buffer = await res.arrayBuffer();
      const base64Data = Buffer.from(buffer).toString("base64");
      const mimeType: string = res.headers.get("content-type") || "image/png";
      inlinePart = {
        inlineData: {
          data: base64Data,
          mimeType,
        },
      };
    }

    const userPrompt = `Deconstruct this academic reference image into a high-precision chemical molecular graph / CamDraw document.
Ensure all atoms, bonds, rings, substituents, vertical branches, stereochemistry wedges/dashes, coordination brackets, and reaction conditions are completely extracted with exact connectivity.
Subject hint: ${options.hintSubject || "Chemistry"}.`;

    const rawText = await executeGeminiWithFailover(async (client, modelName) => {
      // Reading a structure is hard: allow some thinking here.
      const model = client.getGenerativeModel({ model: modelName, generationConfig: lightThinking(modelName, "low") as Record<string, unknown> });
      const response = await model.generateContent([
        ADVANCED_CHEMICAL_SYSTEM_PROMPT,
        inlinePart,
        userPrompt,
      ]);
      return response.response?.text() || "";
    });

    // Clean JSON markdown fences
    const cleanedJson = rawText
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const parsed = parseAiJson(cleanedJson);

    if (parsed && Array.isArray(parsed.elements)) {
      const rawDoc: CamDrawDocument = {
        version: parsed.version || 2,
        type: parsed.type || "chemical",
        canvas: {
          width: parsed.canvas?.width || 800,
          height: parsed.canvas?.height || 500,
          background: parsed.canvas?.background || "transparent",
          gridEnabled: true,
        },
        elements: parsed.elements as CamDrawElement[],
        metadata: {
          confidence: parsed.metadata?.confidence ?? 90,
          matchMode: parsed.metadata?.matchMode || "MATCH_REFERENCE",
          warnings: parsed.metadata?.warnings || [],
          recognizedAt: new Date().toISOString(),
          recognizedFrom: imageSource.startsWith("data:") ? "base64" : imageSource,
        },
      };

      // 2. Post-processing: Normalize topology and center structure
      const normalizedDoc = normalizeGraphTopology(rawDoc);
      const finalDoc = centerStructureOnCanvas(normalizedDoc);
      const validation = validateChemicalDocument(finalDoc);

      const allWarnings = [
        ...(finalDoc.metadata?.warnings || []),
        ...validation.warnings,
      ];

      return {
        success: true,
        document: {
          ...finalDoc,
          metadata: {
            ...finalDoc.metadata,
            validationReport: validation,
            warnings: allWarnings,
          },
        },
        confidence: finalDoc.metadata?.confidence || 90,
        warnings: allWarnings,
        detectedType: finalDoc.type,
      };
    }

    throw new Error("Invalid structure format returned by recognition model.");
  } catch (err: any) {
    console.error("[CamDraw Recognition Error]:", err);
    return {
      success: false,
      document: createEmptyCamDrawDocument(),
      confidence: 0,
      warnings: ["Unable to reconstruct structure automatically. Please author or adjust manually."],
      detectedType: "chemical",
      error: err.message || "Recognition failed",
    };
  }
}
