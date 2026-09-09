import type { StudyMaterialType } from "@prisma/client";

/**
 * The six study-material categories, in display order. Shared by the
 * admin manager (upload dropdown + section headers) and the student
 * browser (section headers). `icon` values are Material Symbols names.
 */
export const STUDY_MATERIAL_TYPES: {
  value: StudyMaterialType;
  label: string;
  icon: string;
}[] = [
  { value: "MODULE", label: "Modules", icon: "menu_book" },
  { value: "SHORT_NOTES", label: "Short Notes", icon: "sticky_note_2" },
  { value: "MIND_MAP", label: "Mind Maps", icon: "account_tree" },
  { value: "FORMULA_SHEET", label: "Formula Sheets", icon: "functions" },
  { value: "NCERT_HIGHLIGHTED", label: "Highlighted NCERT", icon: "auto_stories" },
  { value: "NCERT_EXEMPLAR", label: "NCERT Exemplar", icon: "library_books" },
];

export const STUDY_MATERIAL_TYPE_LABEL: Record<StudyMaterialType, string> =
  Object.fromEntries(STUDY_MATERIAL_TYPES.map((t) => [t.value, t.label])) as Record<
    StudyMaterialType,
    string
  >;

export function isStudyMaterialType(v: string): v is StudyMaterialType {
  return STUDY_MATERIAL_TYPES.some((t) => t.value === v);
}

export function formatBytes(n: number): string {
  if (!n || n <= 0) return "—";
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
