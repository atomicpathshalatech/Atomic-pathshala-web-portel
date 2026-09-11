/** One educator as far as a creative cares — name + the ONE image that's
 * actually usable on a creative (falls back through cutout PNG -> normal
 * photo -> null, see resolvers/educators.ts resolveEducatorImage). */
export interface CreativeEducator {
  teacherId: string;
  name: string;
  /** The cutout/creative PNG if uploaded, else the normal profile photo, else null. */
  imageUrl: string | null;
  /** True only when imageUrl came from the transparent cutout — templates
   * that need a true cutout (vs. a boxed photo) can check this. */
  isCutout: boolean;
  creativeAssetVersion: number;
}

/** The CONTENT half of the system — plain data, zero knowledge of layout/
 * design. Populated by lib/creative/resolvers/*.ts, one function per
 * CreativeType, always read live from the existing relations (spec section
 * 12/23: never re-typed, never duplicated except where this object itself
 * briefly holds it in memory during a render). */
export interface CreativeContentData {
  title: string;
  subtitle?: string;
  educators: CreativeEducator[];
  batchName?: string;
  chapterName?: string;
  subjectName?: string;
  lectureLabel?: string; // "LECTURE 01"
  lectureTitle?: string;
  lectureCount?: number;
  examOrCourse?: string;
}
