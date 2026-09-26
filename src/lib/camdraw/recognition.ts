/**
 * CAMDRAW — AI STRUCTURE RECOGNITION ENGINE
 * Vision-powered extraction of structured STEM diagrams & chemical structures
 * Preserves reference geometry and outputs editable CamDrawDocument JSON
 */

import { geminiKeyManager } from "@/lib/ai/gemini-key-manager";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { CamDrawDocument, CamDrawElement, createEmptyCamDrawDocument } from "./types";

export interface StructureRecognitionResult {
  success: boolean;
  document: CamDrawDocument;
  confidence: number;
  warnings: string[];
  detectedType: string;
  costInfo?: any;
  error?: string;
}

const RECOGNITION_SYSTEM_PROMPT = `You are CamDraw Recognition Engine, an expert AI specialized in recognizing academic scientific diagrams, chemical structures, organic mechanisms, physics schematics, and math plots from reference question images.

YOUR MISSION:
Analyze the input image and convert any visual scientific diagrams or chemical structures into an exact structured CamDraw JSON document.

CRITICAL RULES:
1. GEOMETRY PRESERVATION (MATCH REFERENCE):
   - Preserve relative coordinates, bond angles, branching orientation, and layout as closely as possible to the source image.
   - Do NOT redesign or arbitrarily standardize unless specifically required for clarity.
2. CHEMICAL FIDELITY:
   - Identify all atoms (C, H, O, N, S, P, halogens, R groups, functional groups like OH, COOH, NH2, CHO, NO2, CH3, etc.).
   - Identify all bonds (single, double, triple, aromatic, wedge, dash, wavy, coordinate).
   - Identify ring systems (benzene, cyclohexane, cyclopentane, etc.) and their substituent attachment points.
   - Identify reaction arrows (forward, reversible, equilibrium, resonance) with exact top reagents (e.g. "KMnO4 / H+") and bottom conditions (e.g. "Δ, 273 K").
   - Identify curved mechanism arrows for electron movement with accurate start, control (bezier arc), and end points.
   - Identify formal charges (+, -, δ+, δ-) and lone pair dots.
3. PHYSICS & STEM DIAGRAMS:
   - Identify circuits (resistors, capacitors, inductors, batteries, switches, grounds, meters).
   - Identify ray diagrams (lenses, mirrors, optical axes, rays with arrows, focal points).
   - Identify mechanics (blocks, pulleys, inclined planes, force vectors with angles).
   - Identify math graphs (coordinate axes, curves, parabolas, geometric polygons).
4. CONFIDENCE & WARNINGS:
   - Return an integer confidence score (0 to 100).
   - If any label, subscript, or bond order is ambiguous or stereochemistry is uncertain, include explicit warnings in the "warnings" array.
   - If the image contains ONLY plain text and NO visual diagram/chemical structure, return elements: [] with confidence: 0.

OUTPUT FORMAT (JSON ONLY, NO MARKDOWN OUTSIDE THE JSON BLOCK):
{
  "version": 1,
  "type": "chemical" | "reaction" | "physics" | "biology" | "math" | "custom",
  "canvas": {
    "width": 800,
    "height": 500,
    "background": "transparent"
  },
  "elements": [
    // Array of atoms, bonds, rings, reaction_arrow, curved_arrow, physics_symbol, bio_shape, text, connector
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
    // 1. Prepare image payload (either base64 inlineData or fetch from URL)
    let inlinePart: { inlineData: { data: string; mimeType: string } };

    if (imageSource.startsWith("data:")) {
      const mimeMatch = imageSource.match(/^data:([^;]+);base64,/);
      const mimeType: string = (mimeMatch && mimeMatch[1]) ? mimeMatch[1] : "image/png";
      const base64Data = imageSource.replace(/^data:[^;]+;base64,/, "");
      inlinePart = {
        inlineData: {
          data: base64Data,
          mimeType,
        },
      };
    } else {
      // Remote URL — fetch and convert to base64 buffer
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

    const userPrompt = `Analyze this reference question image. Extract any chemical structure, reaction, physics schematic, or math plot into a high-fidelity CamDraw JSON document. Subject hint: ${
      options.hintSubject || "STEM / Chemistry"
    }. Match original geometry closely.`;

    const rawText = await geminiKeyManager.executeWithRotation(async (client: GoogleGenerativeAI) => {
      const model = client.getGenerativeModel({ model: "gemini-3.8-flash" });
      const response = await model.generateContent([
        RECOGNITION_SYSTEM_PROMPT,
        inlinePart,
        userPrompt,
      ]);
      return response.response?.text() || "";
    });

    // Clean JSON markdown fences if present
    const cleanedJson = rawText
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleanedJson);

    if (parsed && Array.isArray(parsed.elements)) {
      const doc: CamDrawDocument = {
        version: parsed.version || 1,
        type: parsed.type || "chemical",
        canvas: {
          width: parsed.canvas?.width || 800,
          height: parsed.canvas?.height || 500,
          background: parsed.canvas?.background || "transparent",
          gridEnabled: true,
        },
        elements: parsed.elements as CamDrawElement[],
        metadata: {
          confidence: parsed.metadata?.confidence ?? 85,
          matchMode: parsed.metadata?.matchMode || "MATCH_REFERENCE",
          warnings: parsed.metadata?.warnings || [],
          recognizedAt: new Date().toISOString(),
          recognizedFrom: imageSource.startsWith("data:") ? "base64" : imageSource,
        },
      };

      return {
        success: true,
        document: doc,
        confidence: doc.metadata?.confidence || 85,
        warnings: doc.metadata?.warnings || [],
        detectedType: doc.type,
      };
    }

    throw new Error("Invalid structure returned by recognition model.");
  } catch (err: any) {
    console.error("[CamDraw Recognition Error]:", err);
    return {
      success: false,
      document: createEmptyCamDrawDocument(),
      confidence: 0,
      warnings: ["Unable to reconstruct structure automatically. Please author or adjust manually."],
      detectedType: "custom",
      error: err.message || "Recognition failed",
    };
  }
}
