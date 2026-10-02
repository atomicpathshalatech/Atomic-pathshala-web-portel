/** Choices for the DPP hierarchy (Subject → Class → Exam → Chapter → Topic → Sub-topic). */

export const DPP_CLASSES = ["Class 11", "Class 12", "Dropper"] as const;

export const DPP_EXAMS = ["NEET", "JEE Main", "JEE Advanced", "CBSE Board", "Foundation"] as const;

/** NCERT class number a class choice maps to (Dropper → both years). */
export function classNumberOf(className: string | null | undefined): number | null {
  const m = /(\d{2})/.exec(className ?? "");
  return m ? Number(m[1]) : null;
}

/** "DPP 03" — or the DPP code for older DPPs without a number. */
export function dppNumberLabel(dpp: { dppNumber?: number | null; code: string }): string {
  return dpp.dppNumber ? `DPP ${String(dpp.dppNumber).padStart(2, "0")}` : dpp.code;
}
